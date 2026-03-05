"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { getRecentFailedJobs } from "@/lib/db/admin";
import { getAIJobs } from "@/lib/db/jobs";
import type { AIJob } from "@/lib/db/jobs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Play } from "lucide-react";

export default function AdminJobsPage() {
  const { locale } = useI18n();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [failedJobs, setFailedJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      setLoading(true);
      const [allJobsRes, failedJobsRes] = await Promise.all([
        getAIJobs({ limit: 50 }),
        getRecentFailedJobs(20),
      ]);

      if (allJobsRes.data) setJobs(allJobsRes.data);
      if (failedJobsRes.data) setFailedJobs(failedJobsRes.data as AIJob[]);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "queued":
        return (
          <Badge variant="outline" className="flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" />
            Queued
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
            <Play className="w-3 h-3" />
            Processing
          </Badge>
        );
      case "done":
        return (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const queuedJobs = jobs.filter((j) => j.status === "queued");
  const processingJobs = jobs.filter((j) => j.status === "processing");
  const completedJobs = jobs.filter((j) => j.status === "done");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "مراقبة المهام" : "Job Monitor"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "مراقبة معالجة تحليل AI"
              : "Monitor AI analysis processing"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadJobs}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{queuedJobs.length}</div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "في الانتظار" : "Queued"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {processingJobs.length}
            </div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "قيد المعالجة" : "Processing"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {completedJobs.length}
            </div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "مكتمل" : "Completed"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {failedJobs.length}
            </div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "فاشل" : "Failed"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="failed">
        <TabsList>
          <TabsTrigger value="failed" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            {locale === "ar" ? "فاشل" : "Failed"}
          </TabsTrigger>
          <TabsTrigger value="processing" className="gap-2">
            <Play className="w-4 h-4" />
            {locale === "ar" ? "قيد المعالجة" : "Processing"}
          </TabsTrigger>
          <TabsTrigger value="queued" className="gap-2">
            <Clock className="w-4 h-4" />
            {locale === "ar" ? "في الانتظار" : "Queued"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                {locale === "ar" ? "المهام الفاشلة" : "Failed Jobs"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {failedJobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {locale === "ar" ? "لا توجد مهام فاشلة" : "No failed jobs"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Case ID</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">
                          {job.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {job.case_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.attempts}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-red-600">
                          {job.error_message || "Unknown error"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(job.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <Play className="w-5 h-5" />
                {locale === "ar" ? "قيد المعالجة" : "Processing"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {processingJobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {locale === "ar" ? "لا توجد مهام قيد المعالجة" : "No jobs processing"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Case ID</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processingJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">
                          {job.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {job.case_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{job.model || "-"}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {job.started_at
                            ? new Date(job.started_at).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queued">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {locale === "ar" ? "في الانتظار" : "Queued"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {queuedJobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {locale === "ar" ? "لا توجد مهام في الانتظار" : "No jobs queued"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Case ID</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queuedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">
                          {job.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {job.case_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{job.model || "-"}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(job.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
