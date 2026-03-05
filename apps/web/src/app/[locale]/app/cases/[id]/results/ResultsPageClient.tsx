"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { getLatestResult, retryAnalysisEdge, createResultPoller } from "@/lib/db/ai";
import { getLatestJob, createJobPoller, type AIJob } from "@/lib/db/jobs";
import { uploadReportPdf, listReports, getSignedDownloadUrl, formatReportDate } from "@/lib/db/reports";
import type { AIResult, CaseFile } from "@/lib/db/types";
import { telemetry } from "@/lib/services/telemetry";
import { 
  ArrowLeft, 
  Loader2, 
  FileText, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Printer,
  FileDown
} from "lucide-react";

interface ResultsPageClientProps {
  locale: string;
  caseId: string;
}

export default function ResultsPageClient({ locale, caseId }: ResultsPageClientProps) {
  const { t } = useI18n();
  const [result, setResult] = useState<AIResult | null>(null);
  const [job, setJob] = useState<AIJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [reports, setReports] = useState<CaseFile[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    loadResult();
    loadJob();
    loadReports();
    loadUserProfile();
  }, [caseId]);

  // Improved polling with proper cleanup for results
  useEffect(() => {
    if (!result || (result.status !== "processing" && result.status !== "pending")) {
      return;
    }

    const poller = createResultPoller(
      caseId,
      (newResult) => {
        setResult(newResult);
        setLoading(false);
      },
      {
        intervalMs: 3000,
        onComplete: () => setLoading(false),
        onError: () => setLoading(false),
      }
    );

    poller.start();

    return () => {
      poller.stop();
    };
  }, [caseId, result?.status]);

  // Job polling - stops when job status is "done" or "failed"
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed") {
      return;
    }

    const poller = createJobPoller(
      caseId,
      (newJob) => {
        setJob(newJob);
        setLoading(false);
      },
      {
        intervalMs: 3000,
        onComplete: () => setLoading(false),
        onError: () => setLoading(false),
      }
    );

    poller.start();

    return () => {
      poller.stop();
    };
  }, [caseId, job?.status]);

  async function loadResult() {
    const { data } = await getLatestResult(caseId);
    setResult(data);
    setLoading(false);
  }

  async function loadJob() {
    const { data } = await getLatestJob(caseId);
    setJob(data);
  }

  async function loadReports() {
    const { data } = await listReports(caseId);
    if (data) {
      setReports(data);
    }
  }

  async function loadUserProfile() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .single();
      setDoctorName(profile?.full_name || null);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    const { success, error, rateLimited } = await retryAnalysisEdge(caseId);
    if (!success) {
      console.error("Retry failed:", error);
      // Handle rate limit error
      if (rateLimited) {
        setRetryError(t("cases.rateLimitError") || "Rate limit exceeded. Please try again later.");
      } else {
        setRetryError(error || t("cases.retryFailed") || "Retry failed. Please try again.");
      }
    } else {
      await loadResult();
      await loadJob();
    }
    setRetrying(false);
  }

  async function handleGeneratePdf() {
    if (!result || result.status !== "done") {
      setPdfError(t("cases.reportGenerationFailed") || "Cannot generate report: analysis not complete");
      return;
    }

    setGeneratingPdf(true);
    setPdfError(null);
    setPdfSuccess(false);

    try {
      const resultData = result.result_json as {
        patient_code?: string;
      };

      // Dynamic import of PDF generator
      const { generateAIReportPDF } = await import("@/lib/services/pdfGenerator");

      const pdfBytes = await generateAIReportPDF({
        patientCode: resultData?.patient_code || "Unknown",
        doctorName: doctorName,
        date: new Date().toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US"),
        locale: locale as "en" | "ar",
        result: result,
      });

      const { success, error, file } = await uploadReportPdf(
        caseId,
        pdfBytes,
        locale,
        resultData?.patient_code || "Unknown"
      );

      if (success && file) {
        setPdfSuccess(true);
        await loadReports();
        setTimeout(() => setPdfSuccess(false), 3000);
        telemetry.pdfGenerated(caseId);
      } else {
        setPdfError(error || t("cases.uploadFailed") || "Upload failed");
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      setPdfError(t("cases.reportGenerationFailed") || "Failed to generate report");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleDownloadReport(filePath: string) {
    const { url, error } = await getSignedDownloadUrl(filePath);
    if (url) {
      window.open(url, "_blank");
    } else {
      console.error("Download error:", error);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-500";
    if (confidence >= 0.8) return "bg-blue-500";
    if (confidence >= 0.7) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handlePrint = () => {
    window.print();
  };

  const latestReport = reports[0];

  if (loading) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-medical-blue" />
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (!result || result.status === "pending") {
    return (
      <AuthGuard>
        <AppShell>
          <div className="mb-6">
            <Link href={`/${locale}/app/cases/${caseId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-4">
              <ArrowLeft className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`} />
              {t("common.back")}
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{t("cases.results")}</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("cases.noResultsYet")}</h2>
            <p className="text-gray-500 mb-6">{t("cases.notEnoughFiles")}</p>
            <Link href={`/${locale}/app/cases/${caseId}`} className="inline-flex items-center gap-2 px-6 py-2 bg-medical-blue text-white rounded-lg hover:bg-blue-700">
              {t("common.back")}
            </Link>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  // Queued state view
  if (job?.status === "queued") {
    return (
      <AuthGuard>
        <AppShell>
          <div className="mb-6">
            <Link href={`/${locale}/app/cases/${caseId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-4">
              <ArrowLeft className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`} />
              {t("common.back")}
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{t("cases.results")}</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-gray-100 flex items-center justify-center">
                <Clock className="w-10 h-10 text-medical-blue" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("cases.queued") || "Analysis Queued"}</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              {t("cases.analysisQueuedMessage") || "Your analysis is queued and will start soon."}
            </p>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (result.status === "processing" || job?.status === "processing") {
    return (
      <AuthGuard>
        <AppShell>
          <div className="mb-6">
            <Link href={`/${locale}/app/cases/${caseId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-4">
              <ArrowLeft className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`} />
              {t("common.back")}
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{t("cases.results")}</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <Loader2 className="w-24 h-24 animate-spin text-medical-blue" />
              <Clock className="w-8 h-8 text-medical-blue absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("cases.processing")}</h2>
            <p className="text-gray-500">{t("cases.processingMessage")}</p>
            {job?.metadata?.worker_id && (
              <p className="text-sm text-gray-400 mt-2">
                {t("cases.workerInfo") || `Worker: ${job.metadata.worker_id}`}
              </p>
            )}
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (result.status === "failed") {
    return (
      <AuthGuard>
        <AppShell>
          <div className="mb-6">
            <Link href={`/${locale}/app/cases/${caseId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-4">
              <ArrowLeft className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`} />
              {t("common.back")}
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{t("cases.results")}</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("cases.analysisFailed") || "Analysis Failed"}</h2>
            <p className="text-gray-500 mb-2 max-w-md mx-auto">
              {result.error_message || t("cases.analysisFailedMessage") || "The analysis could not be completed."}
            </p>
            {/* Retry error message */}
            {retryError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm max-w-md mx-auto">
                {retryError}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center gap-2 px-6 py-2 bg-medical-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retrying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {t("cases.retryAnalysis") || "Retry Analysis"}
              </button>
              <Link 
                href={`/${locale}/app/cases/${caseId}`} 
                className="inline-flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t("common.back")}
              </Link>
            </div>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  const resultData = result.result_json as {
    patient_code?: string;
    summary_en?: string;
    summary_ar?: string;
    measurements?: Array<{ name: string; value: number; unit: string; ref: string; confidence: number }>;
    findings_en?: string[];
    findings_ar?: string[];
    recommendations_en?: string[];
    recommendations_ar?: string[];
  };

  const summary = locale === "ar" ? resultData?.summary_ar : resultData?.summary_en;
  const findings = locale === "ar" ? resultData?.findings_ar : resultData?.findings_en;
  const recommendations = locale === "ar" ? resultData?.recommendations_ar : resultData?.recommendations_en;

  return (
    <AuthGuard>
      <AppShell>
        {/* Print header - hidden on screen, shown on print */}
        <div className="hidden print:block print:mb-8">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orca Dental AI</h1>
              <p className="text-gray-500">Cephalometric Analysis Report</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{formatDate(result.finished_at || result.created_at)}</p>
              <p>{resultData?.patient_code}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 print:hidden">
          <Link href={`/${locale}/app/cases/${caseId}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-4">
            <ArrowLeft className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`} />
            {t("common.back")}
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t("cases.results")}</h1>
              <p className="text-sm text-gray-500 mt-1">{resultData?.patient_code} • {formatDate(result.finished_at || result.created_at)}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
                <CheckCircle className="w-5 h-5" />
                {t("cases.analysisCompleted")}
              </span>
              
              {/* Generate PDF Button */}
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="inline-flex items-center gap-2 px-4 py-2 bg-medical-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                {t("cases.generateReport") || "Generate PDF Report"}
              </button>

              {latestReport && (
                <button
                  onClick={() => handleDownloadReport(latestReport.file_path)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  {t("cases.downloadReport") || "Download Report"}
                </button>
              )}
              
              <button 
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" />
                {t("cases.print") || "Print"}
              </button>
            </div>
          </div>
          
          {/* PDF Status Messages */}
          {pdfSuccess && (
            <div className="mt-3 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              {t("cases.reportGenerated") || "Report generated successfully"}
            </div>
          )}
          {pdfError && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {pdfError}
            </div>
          )}
          
          {/* Reports List */}
          {reports.length > 0 && (
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                {t("cases.reports") || "Reports"}
              </h3>
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between bg-white rounded p-2">
                    <span className="text-sm text-gray-700">{report.file_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {formatReportDate(report.created_at, locale)}
                      </span>
                      <button
                        onClick={() => handleDownloadReport(report.file_path)}
                        className="text-medical-blue hover:text-blue-700"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6 print:border-gray-300 print:shadow-none">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("cases.summary")}</h2>
          <p className="text-gray-700 leading-relaxed">{summary}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Measurements Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:border-gray-300 print:shadow-none">
            <div className="p-6 border-b border-gray-100 print:border-gray-300">
              <h2 className="text-lg font-semibold text-gray-900">{t("cases.measurements")}</h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">{t("cases.measurement") || "Measurement"}</th>
                      <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">{t("cases.value")}</th>
                      <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">{t("cases.reference")}</th>
                      <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">{t("cases.confidence")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultData?.measurements?.map((m, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 px-3">
                          <span className="font-medium text-gray-900">{m.name}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-medical-blue">{m.value}{m.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-center text-gray-500 text-sm">
                          {m.ref}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            m.confidence >= 0.9 ? "bg-green-100 text-green-700" :
                            m.confidence >= 0.8 ? "bg-blue-100 text-blue-700" :
                            m.confidence >= 0.7 ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getConfidenceColor(m.confidence)}`} />
                            {Math.round(m.confidence * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Findings */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:border-gray-300 print:shadow-none">
              <div className="p-6 border-b border-gray-100 print:border-gray-300">
                <h2 className="text-lg font-semibold text-gray-900">{t("cases.findings")}</h2>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  {findings?.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-medical-blue rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:border-gray-300 print:shadow-none">
              <div className="p-6 border-b border-gray-100 print:border-gray-300">
                <h2 className="text-lg font-semibold text-gray-900">{t("cases.recommendations")}</h2>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  {recommendations?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Print footer */}
        <div className="hidden print:block print:mt-8 print:pt-4 print:border-t">
          <p className="text-xs text-gray-400 text-center">
            Generated by Orca Dental AI • {resultData?.patient_code} • {new Date().toLocaleDateString()}
          </p>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
