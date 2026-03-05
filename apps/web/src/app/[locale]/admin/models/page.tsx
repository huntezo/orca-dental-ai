"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  getOrganizationModels,
  getTrainingJobs,
  createModel,
  startTraining,
  setActiveModel,
  getTrainingStatusText,
  getJobStatusText,
  estimateTrainingCost,
  compareModels,
  type OrganizationModel,
  type TrainingJob,
} from "@/lib/db/models";
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
} from "@/components/ui/dialog";
import {
  Brain,
  Plus,
  Play,
  CheckCircle,
  DollarSign,
  BarChart3,
  RotateCcw,
  History,
} from "lucide-react";

interface ModelWithJobs extends OrganizationModel {
  recentJobs?: TrainingJob[];
}

export default function AdminModelsPage() {
  const { locale } = useI18n();
  const [models, setModels] = useState<ModelWithJobs[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [selectedModel, setSelectedModel] = useState<OrganizationModel | null>(null);
  const [compareModelsList, setCompareModelsList] = useState<OrganizationModel[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    baseModel: "orca-ceph-v1",
    datasetPath: "",
    epochs: "10",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const { data: modelsData } = await getOrganizationModels();

      if (modelsData) {
        // Load recent jobs for each model
        const modelsWithJobs = await Promise.all(
          modelsData.map(async (model) => {
            const { data: jobs } = await getTrainingJobs(model.id, { limit: 3 });
            return { ...model, recentJobs: jobs || [] };
          })
        );
        setModels(modelsWithJobs);
      }
    } catch (error) {
      console.error("Failed to load models:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateModel() {
    const orgId = "current-org-id";
    const { data } = await createModel(orgId, formData.name, formData.baseModel);

    if (data) {
      setShowCreateDialog(false);
      setFormData({ name: "", baseModel: "orca-ceph-v1", datasetPath: "", epochs: "10" });
      loadData();
    }
  }

  async function handleStartTraining() {
    if (!selectedModel) return;

    const orgId = "current-org-id";
    const epochs = parseInt(formData.epochs);

    const { data } = await startTraining(
      orgId,
      selectedModel.id,
      formData.datasetPath,
      epochs,
      estimateTrainingCost(epochs)
    );

    if (data) {
      setShowTrainingDialog(false);
      setSelectedModel(null);
      setFormData({ name: "", baseModel: "orca-ceph-v1", datasetPath: "", epochs: "10" });
      loadData();
    }
  }

  async function handleSetActive(modelId: string) {
    const orgId = "current-org-id";
    await setActiveModel(orgId, modelId);
    loadData();
  }

  function handleCompare(model: OrganizationModel) {
    const readyModels = models.filter(
      (m) => m.id !== model.id && m.training_status === "ready"
    );

    if (readyModels.length > 0) {
      setSelectedModel(model);
      setCompareModelsList([model, readyModels[0]]);
      setShowCompareDialog(true);
    }
  }

  function getStatusBadge(status: OrganizationModel["training_status"]) {
    const variants: Record<string, string> = {
      draft: "secondary",
      training: "default",
      ready: "outline",
      failed: "destructive",
      deprecated: "secondary",
    };

    return (
      <Badge variant={variants[status] as any}>
        {getTrainingStatusText(status, locale as "en" | "ar")}
      </Badge>
    );
  }

  function getJobStatusBadge(status: TrainingJob["status"]) {
    const variants: Record<string, string> = {
      queued: "secondary",
      preparing: "secondary",
      training: "default",
      evaluating: "default",
      completed: "outline",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] as any}>
        {getJobStatusText(status, locale as "en" | "ar")}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "إدارة النماذج" : "Model Management"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "تدريب وإدارة نماذج مخصصة للمؤسسة"
              : "Train and manage custom organization models"}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {locale === "ar" ? "إنشاء نموذج" : "Create Model"}
        </Button>
      </div>

      {/* Models Grid */}
      <div className="grid gap-4">
        {models.length === 0 && !loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {locale === "ar" ? "لا توجد نماذج بعد" : "No models yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          models.map((model) => (
            <Card key={model.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{model.name}</h3>
                      {getStatusBadge(model.training_status)}
                      {model.is_active && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {locale === "ar" ? "نشط" : "Active"}
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-gray-500 space-y-1 mb-4">
                      <p>
                        {locale === "ar" ? "النموذج الأساسي:" : "Base Model:"}{" "}
                        {model.base_model}
                      </p>
                      <p>
                        {locale === "ar" ? "الإصدار:" : "Version:"} {model.version}
                      </p>
                      <p>
                        {locale === "ar" ? "التكلفة:" : "Cost:"} $
                        {model.training_cost?.toFixed(2) || "0.00"}
                      </p>
                    </div>

                    {/* Metrics */}
                    {model.training_status === "ready" && model.metrics_json && (
                      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">
                            {locale === "ar" ? "الدقة" : "Accuracy"}
                          </p>
                          <p className="text-lg font-semibold text-green-600">
                            {((model.metrics_json.final_val_accuracy || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">
                            {locale === "ar" ? "الخسارة" : "Loss"}
                          </p>
                          <p className="text-lg font-semibold">
                            {(model.metrics_json.final_train_loss || 0).toFixed(3)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">
                            {locale === "ar" ? "وقت الاستجابة" : "Inference"}
                          </p>
                          <p className="text-lg font-semibold">
                            {model.metrics_json.inference_time_ms || 0}ms
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Recent Training Jobs */}
                    {model.recentJobs && model.recentJobs.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <History className="w-4 h-4" />
                          {locale === "ar" ? "عمليات التدريب الأخيرة" : "Recent Training Jobs"}
                        </h4>
                        <div className="space-y-2">
                          {model.recentJobs.map((job) => (
                            <div
                              key={job.id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                            >
                              <div className="flex items-center gap-2">
                                {getJobStatusBadge(job.status)}
                                <span>
                                  {new Date(job.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {job.status === "training" && (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 transition-all"
                                      style={{ width: `${job.progress_percent}%` }}
                                    />
                                  </div>
                                  <span className="text-xs">{job.progress_percent}%</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    {model.training_status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModel(model);
                          setShowTrainingDialog(true);
                        }}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {locale === "ar" ? "بدء التدريب" : "Train"}
                      </Button>
                    )}

                    {model.training_status === "ready" && !model.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActive(model.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {locale === "ar" ? "تفعيل" : "Activate"}
                      </Button>
                    )}

                    {model.training_status === "ready" && models.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompare(model)}
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        {locale === "ar" ? "مقارنة" : "Compare"}
                      </Button>
                    )}

                    {model.training_status === "failed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModel(model);
                          setShowTrainingDialog(true);
                        }}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {locale === "ar" ? "إعادة المحاولة" : "Retry"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Model Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "إنشاء نموذج جديد" : "Create New Model"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{locale === "ar" ? "الاسم" : "Name"}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={locale === "ar" ? "اسم النموذج" : "Model name"}
              />
            </div>
            <div>
              <Label>{locale === "ar" ? "النموذج الأساسي" : "Base Model"}</Label>
              <Input
                value={formData.baseModel}
                onChange={(e) => setFormData({ ...formData, baseModel: e.target.value })}
                placeholder="orca-ceph-v1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleCreateModel} disabled={!formData.name}>
                {locale === "ar" ? "إنشاء" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Training Dialog */}
      <Dialog open={showTrainingDialog} onOpenChange={setShowTrainingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "بدء التدريب" : "Start Training"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{locale === "ar" ? "مسار البيانات" : "Dataset Path"}</Label>
              <Input
                value={formData.datasetPath}
                onChange={(e) => setFormData({ ...formData, datasetPath: e.target.value })}
                placeholder="s3://bucket/dataset/"
              />
            </div>
            <div>
              <Label>{locale === "ar" ? "عدد الدورات" : "Epochs"}</Label>
              <Input
                type="number"
                value={formData.epochs}
                onChange={(e) => setFormData({ ...formData, epochs: e.target.value })}
                min="1"
                max="100"
              />
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {locale === "ar" ? "التكلفة المقدرة:" : "Estimated Cost:"}{" "}
                <span className="font-semibold">
                  ${estimateTrainingCost(parseInt(formData.epochs || "10")).toFixed(2)}
                </span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowTrainingDialog(false)}>
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleStartTraining}
                disabled={!formData.datasetPath}
              >
                <Play className="w-4 h-4 mr-1" />
                {locale === "ar" ? "بدء" : "Start"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "مقارنة النماذج" : "Compare Models"}
            </DialogTitle>
          </DialogHeader>
          {compareModelsList.length === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm font-medium border-b pb-2">
                <div>{locale === "ar" ? "المقياس" : "Metric"}</div>
                <div>{compareModelsList[0].name}</div>
                <div>{compareModelsList[1].name}</div>
              </div>
              {compareModels(compareModelsList[0], compareModelsList[1]).map(
                (comp, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-gray-600">{comp.metric}</div>
                    <div
                      className={
                        comp.better === "A"
                          ? "text-green-600 font-medium"
                          : ""
                      }
                    >
                      {comp.modelA.toFixed(3)}
                      {comp.better === "A" && " "}
                    </div>
                    <div
                      className={
                        comp.better === "B"
                          ? "text-green-600 font-medium"
                          : ""
                      }
                    >
                      {comp.modelB.toFixed(3)}
                      {comp.better === "B" && " "}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
