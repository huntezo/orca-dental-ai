"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { getCase, updateCaseStatus, deleteCase } from "@/lib/db/cases";
import {
  listCaseFiles,
  uploadCaseFile,
  deleteCaseFile,
  getSignedDownloadUrl,
  formatFileSize,
} from "@/lib/db/files";
import {
  listReports,
  getSignedDownloadUrl as getReportDownloadUrl,
  formatReportDate,
} from "@/lib/db/reports";
import {
  createAnalysisJob,
  getLatestAnalysisJob,
  subscribeToAnalysisJob,
  isJobActive,
  isJobComplete,
  getJobStatusText,
  getJobStatusColor,
  type AnalysisJob,
  type AnalysisJobStatus,
} from "@/lib/db/analysis-jobs";
import { telemetry } from "@/lib/services/telemetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Download,
  Upload,
  FileImage,
  FileText,
  AlertCircle,
  X,
  Play,
  BarChart3,
  Clock,
  Server,
  RotateCcw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { CaseWithFiles, CaseStatus, CaseFile } from "@/lib/db/types";

interface CaseDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseWithFiles | null>(null);
  const [reports, setReports] = useState<CaseFile[]>([]);
  const [analysisJob, setAnalysisJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [caseId, setCaseId] = useState<string>("");
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  // Derived state
  const isAnalyzing = analysisJob ? isJobActive(analysisJob.status) : false;
  const isAnalysisDone = analysisJob?.status === "done";
  const isAnalysisFailed = analysisJob?.status === "failed" || analysisJob?.status === "timeout";
  const canStartAnalysis = !isAnalyzing && !isAnalysisDone;

  useEffect(() => {
    params.then(({ id }) => {
      setCaseId(id);
      loadCase(id);
      loadReports(id);
      loadAnalysisJob(id);
    });

    return () => {
      // Cleanup subscription on unmount
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [params]);

  // Subscribe to job updates when job changes
  useEffect(() => {
    if (!analysisJob?.id) return;

    // Cleanup previous subscription
    if (unsubscribe) {
      unsubscribe();
    }

    // Subscribe to updates
    const unsub = subscribeToAnalysisJob(analysisJob.id, (updatedJob) => {
      setAnalysisJob(updatedJob);

      // Track telemetry on completion
      if (isJobComplete(updatedJob.status)) {
        if (updatedJob.status === "done") {
          telemetry.analysisDone(caseId, updatedJob.duration_ms || 0);
        } else if (updatedJob.status === "failed" || updatedJob.status === "timeout") {
          telemetry.analysisFailed(caseId, updatedJob.error_code || undefined);
        }
        // Refresh case data to get results
        loadCase(caseId);
      }
    });

    setUnsubscribe(() => unsub);

    return () => {
      unsub();
    };
  }, [analysisJob?.id, caseId]);

  async function loadCase(id: string) {
    setLoading(true);
    const { data, error } = await getCase(id);
    if (error) {
      setError(error.message);
    } else if (data) {
      setCaseData(data);
    }
    setLoading(false);
  }

  async function loadReports(id: string) {
    const { data, error } = await listReports(id);
    if (!error && data) {
      setReports(data);
    }
  }

  async function loadAnalysisJob(id: string) {
    const { data, error } = await getLatestAnalysisJob(id);
    if (!error && data) {
      setAnalysisJob(data);
    }
  }

  async function handleStatusChange(status: CaseStatus) {
    if (!caseData) return;
    const { error } = await updateCaseStatus(caseData.id, status);
    if (!error) {
      loadCase(caseData.id);
    }
  }

  async function handleDelete() {
    if (!caseData) return;
    const { error } = await deleteCase(caseData.id);
    if (!error) {
      router.push(`/${locale}/app/cases`);
    }
  }

  async function handleStartAnalysis() {
    if (!caseData) return;
    if (caseData.case_files && caseData.case_files.length === 0) {
      setError(locale === "ar" ? "يرجى رفع صورة أولاً" : "Please upload an image first");
      return;
    }

    setStartingAnalysis(true);
    setError(null);

    // Create analysis job
    const { data: job, error: jobError } = await createAnalysisJob(caseData.id);

    if (jobError || !job) {
      setError(jobError?.message || "Failed to start analysis");
      setStartingAnalysis(false);
      return;
    }

    // Track telemetry
    telemetry.analysisStarted(caseId, "orca-ceph-v1");

    // Update local state
    setAnalysisJob(job);
    setCaseData((prev) => (prev ? { ...prev, status: "processing" } : null));
    setStartingAnalysis(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !caseData) return;

    setUploading(true);
    const { success } = await uploadCaseFile(caseData.id, file);
    if (success) {
      await telemetry.fileUploaded(caseData.id, file.type, file.size);
      loadCase(caseData.id);
    }
    setUploading(false);
    // Reset input
    e.target.value = "";
  }

  async function handleDeleteFile(fileId: string, filePath: string) {
    if (!caseData) return;
    const { error } = await deleteCaseFile(fileId, filePath);
    if (!error) {
      loadCase(caseData.id);
    }
  }

  function getStatusIcon(status: AnalysisJobStatus) {
    switch (status) {
      case "pending":
        return <Clock className="w-5 h-5 text-gray-500" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "done":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
      case "timeout":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  }

  function renderAnalysisStatus() {
    if (!analysisJob) {
      return (
        <div className="text-sm text-gray-500">
          {locale === "ar" ? "لم يبدأ التحليل بعد" : "Analysis not started"}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {getStatusIcon(analysisJob.status)}
          <Badge variant={getJobStatusColor(analysisJob.status)}>
            {getJobStatusText(analysisJob.status, locale as "en" | "ar")}
          </Badge>
          {analysisJob.fallback_used && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-200">
              {locale === "ar" ? "بديل" : "Fallback"}
            </Badge>
          )}
        </div>

        {isAnalyzing && (
          <div className="text-sm text-gray-600">
            {locale === "ar"
              ? "جاري تحليل الصورة... قد تستغرق هذه العملية بضع دقائق"
              : "Analyzing image... This may take a few minutes"}
          </div>
        )}

        {isAnalysisDone && analysisJob.duration_ms && (
          <div className="text-sm text-gray-600">
            {locale === "ar" ? "المدة:" : "Duration:"}{" "}
            {(analysisJob.duration_ms / 1000).toFixed(1)}s
          </div>
        )}

        {isAnalysisFailed && analysisJob.error_message && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {analysisJob.error_message}
          </div>
        )}

        {analysisJob.result_json && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">
              {locale === "ar" ? "النتائج" : "Results"}
            </h4>
            <p className="text-sm text-gray-700 mb-3">
              {analysisJob.result_json.structured.summary}
            </p>
            <div className="text-sm text-gray-500">
              {locale === "ar" ? "الثقة:" : "Confidence:"}{" "}
              {(analysisJob.result_json.structured.confidence * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Link
            href={`/${locale}/app/cases`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {locale === "ar" ? "العودة إلى الحالات" : "Back to cases"}
          </Link>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : caseData ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {caseData.patient_code}
                  </h1>
                  <p className="text-gray-500 mt-1">
                    {locale === "ar" ? "أنشئت:" : "Created:"}{" "}
                    {new Date(caseData.created_at).toLocaleDateString(
                      locale === "ar" ? "ar-SA" : "en-US"
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {locale === "ar" ? "الحالة:" : "Status:"}
                </span>
                <select
                  value={caseData.status}
                  onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
                  className="text-sm border rounded-md px-3 py-1"
                >
                  <option value="new">{locale === "ar" ? "جديد" : "New"}</option>
                  <option value="uploaded">{locale === "ar" ? "تم الرفع" : "Uploaded"}</option>
                  <option value="processing">{locale === "ar" ? "قيد المعالجة" : "Processing"}</option>
                  <option value="done">{locale === "ar" ? "مكتمل" : "Done"}</option>
                  <option value="failed">{locale === "ar" ? "فاشل" : "Failed"}</option>
                </select>
              </div>

              {/* Analysis Section */}
              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    {locale === "ar" ? "تحليل الذكاء الاصطناعي" : "AI Analysis"}
                  </h2>
                  {canStartAnalysis && (
                    <Button
                      onClick={handleStartAnalysis}
                      disabled={startingAnalysis}
                      className="gap-2"
                    >
                      {startingAnalysis ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {locale === "ar" ? "بدء التحليل" : "Start Analysis"}
                    </Button>
                  )}
                  {isAnalysisFailed && (
                    <Button
                      onClick={handleStartAnalysis}
                      disabled={startingAnalysis}
                      variant="outline"
                      className="gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {locale === "ar" ? "إعادة المحاولة" : "Retry"}
                    </Button>
                  )}
                </div>
                {renderAnalysisStatus()}
                {isAnalysisDone && (
                  <Link
                    href={`/${locale}/app/cases/${caseId}/results`}
                    className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {locale === "ar" ? "عرض النتائج الكاملة" : "View Full Results"}
                  </Link>
                )}
              </div>

              {/* Files Section */}
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileImage className="w-5 h-5" />
                  {locale === "ar" ? "الملفات" : "Files"}
                </h2>

                {caseData.case_files && caseData.case_files.length > 0 ? (
                  <div className="space-y-2">
                    {caseData.case_files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileImage className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-sm">{file.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size_bytes || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const { url } = await getSignedDownloadUrl(file.file_path);
                              if (url) window.open(url, "_blank");
                            }}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id, file.file_path)}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    {locale === "ar" ? "لا توجد ملفات" : "No files"}
                  </p>
                )}

                <div className="mt-4">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50">
                    <Upload className="w-4 h-4" />
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>{locale === "ar" ? "رفع ملف" : "Upload file"}</span>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.dcm"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {/* Reports Section */}
              {reports.length > 0 && (
                <div className="bg-white border rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {locale === "ar" ? "التقارير" : "Reports"}
                  </h2>
                  <div className="space-y-2">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-sm">{report.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatReportDate(report.created_at, locale)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const { url } = await getReportDownloadUrl(report.file_path);
                            if (url) window.open(url, "_blank");
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {caseData.notes && (
                <div className="bg-white border rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-2">
                    {locale === "ar" ? "ملاحظات" : "Notes"}
                  </h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{caseData.notes}</p>
                </div>
              )}

              {/* Delete Confirmation */}
              {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                    <div className="flex items-center gap-3 text-red-600 mb-4">
                      <AlertCircle className="w-6 h-6" />
                      <h3 className="text-lg font-semibold">
                        {locale === "ar" ? "تأكيد الحذف" : "Confirm Delete"}
                      </h3>
                    </div>
                    <p className="text-gray-600 mb-6">
                      {locale === "ar"
                        ? "هل أنت متأكد من حذف هذه الحالة؟ لا يمكن التراجع عن هذا الإجراء."
                        : "Are you sure you want to delete this case? This action cannot be undone."}
                    </p>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                        {locale === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button variant="destructive" onClick={handleDelete}>
                        {locale === "ar" ? "حذف" : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
