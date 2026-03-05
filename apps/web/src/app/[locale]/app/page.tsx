"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { getDashboardStatsClient, getRecentCasesClient } from "@/lib/db/cases";
import { getDashboardAIStats } from "@/lib/db/ai";
import type { Case } from "@/lib/db/types";
import {
  FolderOpen,
  Loader2,
  Clock,
  FileCheck,
  Plus,
  Upload,
  ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<{
    totalCases: number;
    processingCases: number;
    reportsReady: number;
    latestUpload: string | null;
    avgProcessingTime: number;
  } | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [statsData, casesData, aiStats] = await Promise.all([
        getDashboardStatsClient(),
        getRecentCasesClient(5),
        getDashboardAIStats(),
      ]);
      setStats({ ...statsData, reportsReady: aiStats.reportsReady, avgProcessingTime: aiStats.avgProcessingTime });
      setRecentCases(casesData);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
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

  return (
    <AuthGuard>
      <AppShell>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title={t("dashboard.stats.totalCases")}
            value={stats?.totalCases || 0}
            icon={FolderOpen}
            color="blue"
          />
          <StatCard
            title={t("dashboard.stats.processingCases")}
            value={stats?.processingCases || 0}
            icon={Clock}
            color="yellow"
          />
          <StatCard
            title={t("dashboard.stats.reportsReady")}
            value={stats?.reportsReady || 0}
            icon={FileCheck}
            color="green"
          />
          <StatCard
            title={t("dashboard.stats.latestUpload")}
            value={
              stats?.latestUpload
                ? formatDate(stats.latestUpload)
                : "-"
            }
            icon={Upload}
            color="purple"
            isDate
          />
          <StatCard
            title={t("cases.avgProcessingTime")}
            value={stats?.avgProcessingTime ? `${Math.round(stats.avgProcessingTime)}s` : "-"}
            icon={Clock}
            color="indigo"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Cases */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dashboard.recentCases")}
              </h2>
              <Link
                href={`/${locale}/app/cases`}
                className="text-sm text-medical-blue hover:text-blue-700 flex items-center gap-1"
              >
                {t("common.viewAll")}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-6">
              {recentCases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {t("dashboard.noCases")}
                </div>
              ) : (
                <div className="space-y-4">
                  {recentCases.map((caseItem) => (
                    <Link
                      key={caseItem.id}
                      href={`/${locale}/app/cases/${caseItem.id}`}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {caseItem.patient_code}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(caseItem.created_at)}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          caseItem.status
                        )}`}
                      >
                        {t(`cases.statuses.${caseItem.status}`)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dashboard.quickActions")}
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <Link
                href={`/${locale}/app/cases/new`}
                className="w-full p-4 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-medical-blue" />
                  <div>
                    <p className="font-medium text-medical-blue">
                      {t("dashboard.newCase")}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {locale === "ar"
                        ? "بدء حالة تصوير Dental جديدة"
                        : "Start a new dental imaging case"}
                    </p>
                  </div>
                </div>
              </Link>
              <Link
                href={`/${locale}/app/cases`}
                className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <Upload className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {t("dashboard.uploadToCase")}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {locale === "ar"
                        ? "إضافة ملفات لحالة موجودة"
                        : "Add files to an existing case"}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "yellow" | "green" | "purple" | "indigo";
  isDate?: boolean;
}

function StatCard({ title, value, icon: Icon, color, isDate }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-medical-blue",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`font-bold text-gray-900 mt-1 ${isDate ? "text-lg" : "text-2xl"}`}>
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
