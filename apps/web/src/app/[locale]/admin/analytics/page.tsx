"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { getAnalytics } from "@/lib/services/telemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Users,
  FolderPlus,
  Upload,
  Sparkles,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";

interface DailyStat {
  date: string;
  new_users: number;
  cases_created: number;
  files_uploaded: number;
  analyses_done: number;
  analyses_failed: number;
  pdfs_generated: number;
}

interface EventStat {
  event_type: string;
  count: number;
}

export default function AdminAnalyticsPage() {
  const { locale } = useI18n();
  const [days, setDays] = useState(7);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [eventStats, setEventStats] = useState<EventStat[]>([]);
  const [avgProcessingTime, setAvgProcessingTime] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const { dailyStats, eventStats, avgProcessingTime } = await getAnalytics(days);
      
      if (dailyStats) setDailyStats(dailyStats as DailyStat[]);
      if (eventStats) setEventStats(eventStats as EventStat[]);
      setAvgProcessingTime(avgProcessingTime);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate totals
  const totals = dailyStats.reduce(
    (acc, day) => ({
      newUsers: acc.newUsers + Number(day.new_users || 0),
      casesCreated: acc.casesCreated + Number(day.cases_created || 0),
      filesUploaded: acc.filesUploaded + Number(day.files_uploaded || 0),
      analysesDone: acc.analysesDone + Number(day.analyses_done || 0),
      analysesFailed: acc.analysesFailed + Number(day.analyses_failed || 0),
      pdfsGenerated: acc.pdfsGenerated + Number(day.pdfs_generated || 0),
    }),
    { newUsers: 0, casesCreated: 0, filesUploaded: 0, analysesDone: 0, analysesFailed: 0, pdfsGenerated: 0 }
  );

  const successRate = totals.analysesDone + totals.analysesFailed > 0
    ? Math.round((totals.analysesDone / (totals.analysesDone + totals.analysesFailed)) * 100)
    : 0;

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    subtitle,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    subtitle?: string;
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "التحليلات" : "Analytics"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar" ? "إحصائيات وتحليلات النظام" : "System statistics and analytics"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
          >
            <option value={1}>{locale === "ar" ? "اليوم" : "Today"}</option>
            <option value={7}>{locale === "ar" ? "آخر 7 أيام" : "Last 7 days"}</option>
            <option value={30}>{locale === "ar" ? "آخر 30 يوم" : "Last 30 days"}</option>
          </select>
          <Button
            variant="outline"
            onClick={loadAnalytics}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title={locale === "ar" ? "مستخدمون جدد" : "New Users"}
          value={totals.newUsers}
          icon={Users}
          color="bg-blue-500"
          subtitle={locale === "ar" ? "تسجيلات" : "registrations"}
        />
        <StatCard
          title={locale === "ar" ? "حالات جديدة" : "New Cases"}
          value={totals.casesCreated}
          icon={FolderPlus}
          color="bg-green-500"
          subtitle={locale === "ar" ? "تم إنشاؤها" : "created"}
        />
        <StatCard
          title={locale === "ar" ? "ملفات مرفوعة" : "Files Uploaded"}
          value={totals.filesUploaded}
          icon={Upload}
          color="bg-purple-500"
          subtitle={locale === "ar" ? "ملفات" : "files"}
        />
        <StatCard
          title={locale === "ar" ? "تحاليل منجزة" : "Analyses Done"}
          value={totals.analysesDone}
          icon={Sparkles}
          color="bg-yellow-500"
          subtitle={`${successRate}% ${locale === "ar" ? "نجاح" : "success"}`}
        />
        <StatCard
          title={locale === "ar" ? "تقارير PDF" : "PDF Reports"}
          value={totals.pdfsGenerated}
          icon={FileText}
          color="bg-pink-500"
          subtitle={locale === "ar" ? "تم إنشاؤها" : "generated"}
        />
        <StatCard
          title={locale === "ar" ? "متوسط الوقت" : "Avg Time"}
          value={Math.round(avgProcessingTime)}
          icon={Clock}
          color="bg-indigo-500"
          subtitle={locale === "ar" ? "ثوانٍ" : "seconds"}
        />
      </div>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ar" ? "التفصيل اليومي" : "Daily Breakdown"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{locale === "ar" ? "لا توجد بيانات" : "No data available"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      {locale === "ar" ? "التاريخ" : "Date"}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                      {locale === "ar" ? "مستخدمون" : "Users"}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                      {locale === "ar" ? "حالات" : "Cases"}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                      {locale === "ar" ? "ملفات" : "Files"}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                      {locale === "ar" ? "تحاليل" : "Analyses"}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                      {locale === "ar" ? "PDF" : "PDFs"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStats.map((day, index) => {
                    const prevDay = dailyStats[index + 1];
                    return (
                      <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          {new Date(day.date).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <TrendValue current={Number(day.new_users)} previous={Number(prevDay?.new_users || 0)} />
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <TrendValue current={Number(day.cases_created)} previous={Number(prevDay?.cases_created || 0)} />
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <TrendValue current={Number(day.files_uploaded)} previous={Number(prevDay?.files_uploaded || 0)} />
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-1">
                            <span>{Number(day.analyses_done)}</span>
                            {Number(day.analyses_failed) > 0 && (
                              <span className="text-red-500 text-xs">
                                ({Number(day.analyses_failed)})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          {Number(day.pdfs_generated)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Summary */}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ar" ? "ملخص الأحداث" : "Event Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : eventStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{locale === "ar" ? "لا توجد أحداث" : "No events"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {eventStats.map((stat) => (
                <div key={stat.event_type} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 capitalize">
                    {getEventLabel(stat.event_type, locale)}
                  </p>
                  <p className="text-2xl font-bold">{Number(stat.count).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrendValue({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span>{current}</span>;
  
  const change = current - previous;
  const percent = previous !== 0 ? Math.round((change / previous) * 100) : 0;
  
  return (
    <div className="flex items-center justify-center gap-1">
      <span>{current}</span>
      {change !== 0 && (
        <span className={`text-xs ${change > 0 ? "text-green-500" : "text-red-500"}`}>
          {change > 0 ? "+" : ""}{percent}%
        </span>
      )}
    </div>
  );
}

function getEventLabel(eventType: string, locale: string): string {
  const labels: Record<string, Record<string, string>> = {
    register: { en: "Registrations", ar: "تسجيلات" },
    login: { en: "Logins", ar: "تسجيلات دخول" },
    case_created: { en: "Cases Created", ar: "حالات منشأة" },
    file_uploaded: { en: "Files Uploaded", ar: "ملفات مرفوعة" },
    analysis_started: { en: "Analyses Started", ar: "تحاليل بدأت" },
    analysis_done: { en: "Analyses Done", ar: "تحاليل منجزة" },
    analysis_failed: { en: "Analyses Failed", ar: "تحاليل فاشلة" },
    pdf_generated: { en: "PDFs Generated", ar: "تقارير PDF" },
    ticket_created: { en: "Tickets Created", ar: "طلبات دعم" },
  };
  
  return labels[eventType]?.[locale] || eventType;
}
