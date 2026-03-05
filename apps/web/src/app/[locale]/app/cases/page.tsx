"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { listCases, searchCases, filterCasesByStatus } from "@/lib/db/cases";
import type { Case, CaseStatus } from "@/lib/db/types";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  ChevronRight,
  MoreHorizontal,
  FileText,
} from "lucide-react";

const statuses: CaseStatus[] = ["new", "uploaded", "processing", "done", "failed"];

export default function CasesPage() {
  const { t, locale } = useI18n();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    setLoading(true);
    const { data, error } = await listCases();
    if (!error && data) {
      setCases(data);
    }
    setLoading(false);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim()) {
      const { data } = await searchCases(query);
      if (data) setCases(data);
    } else {
      loadCases();
    }
  }

  async function handleStatusFilter(status: CaseStatus | "all") {
    setStatusFilter(status);
    if (status === "all") {
      loadCases();
    } else {
      const { data } = await filterCasesByStatus(status);
      if (data) setCases(data);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-gray-100 text-gray-700",
      uploaded: "bg-blue-100 text-blue-700",
      processing: "bg-yellow-100 text-yellow-700",
      done: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <AuthGuard>
      <AppShell>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("cases.title")}
          </h1>
          <Link
            href={`/${locale}/app/cases/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-medical-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("cases.newCase")}
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("cases.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value as CaseStatus | "all")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
            >
              <option value="all">{t("cases.allStatuses")}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {t(`cases.statuses.${status}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cases List */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-medical-blue" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-medical-blue" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {locale === "ar" ? "لا توجد حالات" : "No cases yet"}
              </h3>
              <p className="text-gray-500 mb-2 max-w-sm mx-auto">
                {locale === "ar" 
                  ? "ابدأ بإنشاء حالتك الأولى لتحليل صور الأسنان بالذكاء الاصطناعي."
                  : "Create your first case to start analyzing dental images with AI."}
              </p>
              <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
                {locale === "ar"
                  ? "الخطوات: إنشاء حالة → رفع صور → بدء التحليل → الحصول على التقرير"
                  : "Steps: Create case → Upload images → Start analysis → Get report"}
              </p>
              <Link
                href={`/${locale}/app/cases/new`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-medical-blue text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                {locale === "ar" ? "إنشاء حالة جديدة" : "Create New Case"}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/${locale}/app/cases/${caseItem.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">
                        {caseItem.patient_code}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          caseItem.status
                        )}`}
                      >
                        {t(`cases.statuses.${caseItem.status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(caseItem.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
