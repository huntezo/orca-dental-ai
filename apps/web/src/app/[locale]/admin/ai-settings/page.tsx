"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  getAIProviders,
  createAIProvider,
  updateAIProvider,
  deleteAIProvider,
  setPrimaryProvider,
  toggleProviderActive,
  getProviderStats,
  getProviderRecentStats,
  testProviderConnection,
  type AIProvider,
  type ProviderStats,
  type ProviderRecentStats,
} from "@/lib/db/ai-providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Server,
  Plus,
  Star,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  TestTube,
  ExternalLink,
  Cpu,
  RefreshCw,
} from "lucide-react";

interface ProviderWithStats extends AIProvider {
  stats?: ProviderRecentStats;
}

export default function AISettingsPage() {
  const { t, locale } = useI18n();
  const [providers, setProviders] = useState<ProviderWithStats[]>([]);
  const [providerStats, setProviderStats] = useState<ProviderStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "external" as "external" | "local",
    endpoint: "",
    api_key: "",
    timeout_ms: "300000",
    version: "v1.0",
    model: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [providersRes, statsRes] = await Promise.all([
        getAIProviders(),
        getProviderStats(),
      ]);

      if (providersRes.data) {
        // Load recent stats for each provider
        const providersWithStats = await Promise.all(
          providersRes.data.map(async (provider) => {
            const { data: recentStats } = await getProviderRecentStats(provider.id);
            return { ...provider, stats: recentStats || undefined };
          })
        );
        setProviders(providersWithStats);
      }

      if (statsRes.data) {
        setProviderStats(statsRes.data);
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPrimary(id: string) {
    const { success } = await setPrimaryProvider(id);
    if (success) {
      loadData();
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    const { success } = await toggleProviderActive(id, !currentStatus);
    if (success) {
      loadData();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(locale === "ar" ? "هل أنت متأكد؟" : "Are you sure?")) return;
    
    const { success } = await deleteAIProvider(id);
    if (success) {
      loadData();
    }
  }

  async function handleTest(provider: AIProvider) {
    setTestingProvider(provider.id);
    setTestResult(null);
    
    const result = await testProviderConnection(provider);
    setTestResult(result);
    setTestingProvider(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const config: AIProvider["config"] = {
      endpoint: formData.endpoint,
      timeout_ms: parseInt(formData.timeout_ms),
      version: formData.version,
    };

    if (formData.type === "external") {
      config.api_key = formData.api_key;
      if (formData.model) config.model = formData.model;
    }

    const providerData = {
      name: formData.name,
      type: formData.type,
      is_primary: false,
      is_active: true,
      config,
    };

    if (editingProvider) {
      await updateAIProvider(editingProvider.id, providerData);
    } else {
      await createAIProvider(providerData);
    }

    setShowAddDialog(false);
    setEditingProvider(null);
    resetForm();
    loadData();
  }

  function handleEdit(provider: AIProvider) {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      endpoint: provider.config.endpoint || "",
      api_key: provider.config.api_key || "",
      timeout_ms: String(provider.config.timeout_ms || 300000),
      version: provider.config.version || "v1.0",
      model: provider.config.model || "",
    });
    setShowAddDialog(true);
  }

  function resetForm() {
    setFormData({
      name: "",
      type: "external",
      endpoint: "",
      api_key: "",
      timeout_ms: "300000",
      version: "v1.0",
      model: "",
    });
  }

  function getStatusBadge(provider: AIProvider) {
    if (provider.is_primary) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Star className="w-3 h-3 mr-1" />
          {locale === "ar" ? "أساسي" : "Primary"}
        </Badge>
      );
    }
    if (!provider.is_active) {
      return (
        <Badge variant="secondary">
          {locale === "ar" ? "غير نشط" : "Inactive"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600 border-green-200">
        {locale === "ar" ? "نشط" : "Active"}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "إعدادات الذكاء الاصطناعي" : "AI Settings"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "إدارة مزودي الذكاء الاصطناعي والنماذج"
              : "Manage AI providers and models"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingProvider(null);
                  resetForm();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {locale === "ar" ? "إضافة مزود" : "Add Provider"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingProvider
                    ? locale === "ar"
                      ? "تعديل المزود"
                      : "Edit Provider"
                    : locale === "ar"
                    ? "إضافة مزود جديد"
                    : "Add New Provider"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>
                    {locale === "ar" ? "الاسم" : "Name"}
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={locale === "ar" ? "اسم المزود" : "Provider name"}
                    required
                  />
                </div>

                <div>
                  <Label>
                    {locale === "ar" ? "النوع" : "Type"}
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, type: v as "external" | "local" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          {locale === "ar" ? "خارجي" : "External"}
                        </div>
                      </SelectItem>
                      <SelectItem value="local">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4" />
                          {locale === "ar" ? "محلي" : "Local"}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    {locale === "ar" ? "عنوان النقطة الطرفية" : "Endpoint URL"}
                  </Label>
                  <Input
                    value={formData.endpoint}
                    onChange={(e) =>
                      setFormData({ ...formData, endpoint: e.target.value })
                    }
                    placeholder="https://api.example.com"
                    required
                  />
                </div>

                {formData.type === "external" && (
                  <>
                    <div>
                      <Label>
                        {locale === "ar" ? "مفتاح API" : "API Key"}
                      </Label>
                      <Input
                        type="password"
                        value={formData.api_key}
                        onChange={(e) =>
                          setFormData({ ...formData, api_key: e.target.value })
                        }
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <Label>
                        {locale === "ar" ? "النموذج" : "Model"}
                      </Label>
                      <Input
                        value={formData.model}
                        onChange={(e) =>
                          setFormData({ ...formData, model: e.target.value })
                        }
                        placeholder="gpt-4-vision"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>
                      {locale === "ar" ? "الإصدار" : "Version"}
                    </Label>
                    <Input
                      value={formData.version}
                      onChange={(e) =>
                        setFormData({ ...formData, version: e.target.value })
                      }
                      placeholder="v1.0"
                    />
                  </div>
                  <div>
                    <Label>
                      {locale === "ar" ? "المهلة (مللي ثانية)" : "Timeout (ms)"}
                    </Label>
                    <Input
                      type="number"
                      value={formData.timeout_ms}
                      onChange={(e) =>
                        setFormData({ ...formData, timeout_ms: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    {locale === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button type="submit">
                    {editingProvider
                      ? locale === "ar"
                        ? "حفظ التغييرات"
                        : "Save Changes"
                      : locale === "ar"
                      ? "إضافة"
                      : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Providers List */}
      <div className="grid gap-4">
        {providers.length === 0 && !loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {locale === "ar"
                  ? "لم يتم إضافة مزودين بعد"
                  : "No providers added yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{provider.name}</h3>
                      {getStatusBadge(provider)}
                      <Badge variant="outline">
                        {provider.type === "external" ? (
                          <>
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {locale === "ar" ? "خارجي" : "External"}
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3 h-3 mr-1" />
                            {locale === "ar" ? "محلي" : "Local"}
                          </>
                        )}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                      {provider.config.endpoint}
                    </p>

                    {/* Stats */}
                    {provider.stats && (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>
                            {provider.stats.avg_duration_ms > 0
                              ? `${(provider.stats.avg_duration_ms / 1000).toFixed(1)}s`
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-gray-400" />
                          <span>
                            {provider.stats.total_jobs} {locale === "ar" ? "مهمة" : "jobs"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              provider.stats.failure_rate > 10
                                ? "text-red-500"
                                : "text-gray-400"
                            }`}
                          />
                          <span
                            className={
                              provider.stats.failure_rate > 10
                                ? "text-red-600"
                                : ""
                            }
                          >
                            {provider.stats.failure_rate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Test Result */}
                    {testResult && testingProvider === provider.id && (
                      <div
                        className={`mt-4 p-3 rounded-lg text-sm ${
                          testResult.success
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                        ) : (
                          <XCircle className="w-4 h-4 inline mr-1" />
                        )}
                        {testResult.message}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {!provider.is_primary && provider.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(provider.id)}
                      >
                        <Star className="w-4 h-4 mr-1" />
                        {locale === "ar" ? "تعيين كأساسي" : "Set Primary"}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(provider)}
                      disabled={testingProvider === provider.id}
                    >
                      {testingProvider === provider.id ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4 mr-1" />
                      )}
                      {locale === "ar" ? "اختبار" : "Test"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(provider.id, provider.is_active)}
                    >
                      {provider.is_active
                        ? locale === "ar"
                          ? "إلغاء التنشيط"
                          : "Deactivate"
                        : locale === "ar"
                        ? "تنشيط"
                        : "Activate"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(provider)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {locale === "ar" ? "تعديل" : "Edit"}
                    </Button>

                    {!provider.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(provider.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {locale === "ar" ? "حذف" : "Delete"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Overall Stats */}
      {providerStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {locale === "ar" ? "إحصائيات المزودين" : "Provider Statistics"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">
                      {locale === "ar" ? "المزود" : "Provider"}
                    </th>
                    <th className="text-left py-3 px-4">
                      {locale === "ar" ? "إجمالي المهام" : "Total Jobs"}
                    </th>
                    <th className="text-left py-3 px-4">
                      {locale === "ar" ? "مكتمل" : "Completed"}
                    </th>
                    <th className="text-left py-3 px-4">
                      {locale === "ar" ? "فاشل" : "Failed"}
                    </th>
                    <th className="text-left py-3 px-4">
                      {locale === "ar" ? "متوسط الوقت" : "Avg Duration"}
                    </th>
                    <th className="text-left py-3 px-4">
                      {locale === "ar" ? "معدل الفشل" : "Failure Rate"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {providerStats.map((stat) => (
                    <tr key={stat.provider_id} className="border-b">
                      <td className="py-3 px-4 font-medium">{stat.provider_name}</td>
                      <td className="py-3 px-4">{stat.total_jobs}</td>
                      <td className="py-3 px-4 text-green-600">{stat.completed_jobs}</td>
                      <td className="py-3 px-4 text-red-600">{stat.failed_jobs}</td>
                      <td className="py-3 px-4">
                        {stat.avg_duration_ms > 0
                          ? `${(stat.avg_duration_ms / 1000).toFixed(1)}s`
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            stat.failure_rate > 10
                              ? "text-red-600 font-medium"
                              : "text-green-600"
                          }
                        >
                          {stat.failure_rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
