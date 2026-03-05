"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  getAdminDashboardStats,
  getRecentFailedJobs,
  formatBytes,
  type AdminDashboardStats,
  type UserWithStats,
} from "@/lib/db/admin";
import { getAuditLogs } from "@/lib/db/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Activity,
  HardDrive,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Server,
  Brain,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<unknown[]>([]);
  const [failedJobs, setFailedJobs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [statsRes, activityRes, jobsRes] = await Promise.all([
        getAdminDashboardStats(),
        getAuditLogs({ limit: 5 }),
        getRecentFailedJobs(5),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (activityRes.data) setRecentActivity(activityRes.data);
      if (jobsRes.data) setFailedJobs(jobsRes.data);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const failureRate = stats
    ? stats.total_analyses > 0
      ? ((stats.failed_analyses / stats.total_analyses) * 100).toFixed(1)
      : "0"
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "لوحة التحكم" : "Admin Dashboard"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "نظرة عامة على النظام والإحصائيات"
              : "System overview and statistics"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadDashboardData}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "إجمالي المستخدمين" : "Total Users"}
            </CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_users?.toLocaleString() ?? "-"}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.active_subscriptions ?? 0}{" "}
              {locale === "ar" ? "اشتراك نشط" : "active subscriptions"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "إجمالي التحاليل" : "Total Analyses"}
            </CardTitle>
            <Activity className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_analyses?.toLocaleString() ?? "-"}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {locale === "ar" ? "عبر جميع المستخدمين" : "across all users"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "معدل الفشل" : "Failure Rate"}
            </CardTitle>
            <AlertTriangle
              className={`w-4 h-4 ${
                parseFloat(failureRate) > 5 ? "text-red-600" : "text-yellow-600"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failureRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.failed_analyses ?? 0} {locale === "ar" ? "فشل" : "failed"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "التخزين المستخدم" : "Storage Used"}
            </CardTitle>
            <HardDrive className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatBytes(stats.total_storage_bytes) : "-"}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.total_cases ?? 0} {locale === "ar" ? "حالة" : "cases"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Failed Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {locale === "ar" ? "النشاط الأخير" : "Recent Activity"}
              </CardTitle>
              <Link
                href={`/${locale}/admin/analytics`}
                className="text-sm text-blue-600 hover:underline"
              >
                {locale === "ar" ? "عرض الكل" : "View all"}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                {locale === "ar" ? "لا يوجد نشاط حديث" : "No recent activity"}
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((log) => {
                  const activity = log as Record<string, unknown>;
                  return (
                    <div
                      key={activity.id as string}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">{activity.action as string}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.created_at as string).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline">{activity.entity as string}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {locale === "ar" ? "المهام الفاشلة" : "Failed Jobs"}
              </CardTitle>
              <Link
                href={`/${locale}/admin/jobs`}
                className="text-sm text-blue-600 hover:underline"
              >
                {locale === "ar" ? "عرض الكل" : "View all"}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {failedJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                {locale === "ar" ? "لا توجد مهام فاشلة" : "No failed jobs"}
              </p>
            ) : (
              <div className="space-y-3">
                {failedJobs.map((job) => {
                  const failedJob = job as Record<string, unknown>;
                  return (
                    <div
                      key={failedJob.id as string}
                      className="py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate max-w-[200px]">
                          {(failedJob.case_id as string)?.slice(0, 8)}...
                        </p>
                        <Badge variant="destructive">
                          {failedJob.attempts as number} attempts
                        </Badge>
                      </div>
                      <p className="text-xs text-red-600 mt-1 truncate">
                        {failedJob.error_message as string}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href={`/${locale}/admin/users`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {locale === "ar" ? "إدارة المستخدمين" : "Manage Users"}
                </h3>
                <p className="text-sm text-gray-500">
                  {locale === "ar" ? "عرض وتعليق المستخدمين" : "View and suspend users"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${locale}/admin/jobs`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {locale === "ar" ? "مراقبة المهام" : "Monitor Jobs"}
                </h3>
                <p className="text-sm text-gray-500">
                  {locale === "ar" ? "عرض حالة معالجة AI" : "View AI processing status"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${locale}/admin/analytics`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {locale === "ar" ? "التحليلات" : "Analytics"}
                </h3>
                <p className="text-sm text-gray-500">
                  {locale === "ar" ? "الرؤى والاتجاهات" : "Insights and trends"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${locale}/admin/ai-settings`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Server className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {locale === "ar" ? "إعدادات AI" : "AI Settings"}
                </h3>
                <p className="text-sm text-gray-500">
                  {locale === "ar" ? "إدارة المزودين" : "Manage providers"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${locale}/admin/models`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {locale === "ar" ? "النماذج" : "Models"}
                </h3>
                <p className="text-sm text-gray-500">
                  {locale === "ar" ? "تدريب وإدارة النماذج" : "Train and manage models"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
