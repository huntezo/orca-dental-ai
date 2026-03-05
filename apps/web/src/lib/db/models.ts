"use client";

import { createClient } from "@/lib/supabase/client";

export type TrainingStatus = "draft" | "training" | "ready" | "failed" | "deprecated";

export interface OrganizationModel {
  id: string;
  org_id: string;
  name: string;
  base_model: string;
  fine_tuned_model_path: string | null;
  version: string;
  training_status: TrainingStatus;
  metrics_json: {
    final_train_loss?: number;
    final_val_accuracy?: number;
    epochs_trained?: number;
    training_history?: Array<{
      epoch: number;
      train_loss: number;
      val_accuracy: number;
    }>;
    model_size_mb?: number;
    inference_time_ms?: number;
  };
  training_cost: number | null;
  inference_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingJob {
  id: string;
  org_id: string;
  model_id: string | null;
  dataset_path: string;
  status: "queued" | "preparing" | "training" | "evaluating" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  progress_percent: number;
  epochs_completed: number;
  total_epochs: number | null;
  metrics_json: Record<string, unknown>;
  error_message: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get organization models
 */
export async function getOrganizationModels(orgId?: string): Promise<{
  data: OrganizationModel[] | null;
  error: Error | null;
}> {
  const supabase = createClient();

  let query = supabase
    .from("organization_models")
    .select("*")
    .order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  return { data: data as OrganizationModel[] | null, error };
}

/**
 * Get a specific model
 */
export async function getModel(modelId: string): Promise<{
  data: OrganizationModel | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organization_models")
    .select("*")
    .eq("id", modelId)
    .single();

  return { data: data as OrganizationModel | null, error };
}

/**
 * Create a new model (draft)
 */
export async function createModel(
  orgId: string,
  name: string,
  baseModel: string,
  version: string = "v1.0"
): Promise<{ data: OrganizationModel | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organization_models")
    .insert({
      org_id: orgId,
      name,
      base_model: baseModel,
      version,
      training_status: "draft",
    })
    .select()
    .single();

  return { data: data as OrganizationModel | null, error };
}

/**
 * Start training for a model
 */
export async function startTraining(
  orgId: string,
  modelId: string,
  datasetPath: string,
  totalEpochs: number = 10,
  estimatedCost: number = 5.0
): Promise<{ data: TrainingJob | null; error: Error | null }> {
  const supabase = createClient();

  // Update model status
  await supabase
    .from("organization_models")
    .update({ training_status: "training" })
    .eq("id", modelId);

  // Create training job
  const { data, error } = await supabase
    .from("training_jobs")
    .insert({
      org_id: orgId,
      model_id: modelId,
      dataset_path: datasetPath,
      status: "queued",
      total_epochs: totalEpochs,
      estimated_cost: estimatedCost,
    })
    .select()
    .single();

  return { data: data as TrainingJob | null, error };
}

/**
 * Get training jobs for a model
 */
export async function getTrainingJobs(
  modelId?: string,
  options: { limit?: number } = {}
): Promise<{ data: TrainingJob[] | null; error: Error | null }> {
  const supabase = createClient();
  const { limit = 20 } = options;

  let query = supabase
    .from("training_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (modelId) {
    query = query.eq("model_id", modelId);
  }

  const { data, error } = await query;

  return { data: data as TrainingJob[] | null, error };
}

/**
 * Set active model for organization
 */
export async function setActiveModel(
  orgId: string,
  modelId: string
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = createClient();

  // First, deactivate all models
  await supabase
    .from("organization_models")
    .update({ is_active: false })
    .eq("org_id", orgId);

  // Activate the selected model
  const { error } = await supabase
    .from("organization_models")
    .update({ is_active: true })
    .eq("id", modelId);

  // Update org to enable custom model
  await supabase
    .from("organizations")
    .update({
      custom_model_enabled: true,
      current_model_id: modelId,
    })
    .eq("id", orgId);

  return { success: !error, error };
}

/**
 * Get training status text
 */
export function getTrainingStatusText(
  status: TrainingStatus,
  locale: "en" | "ar"
): string {
  const texts: Record<TrainingStatus, { en: string; ar: string }> = {
    draft: { en: "Draft", ar: "مسودة" },
    training: { en: "Training", ar: "قيد التدريب" },
    ready: { en: "Ready", ar: "جاهز" },
    failed: { en: "Failed", ar: "فاشل" },
    deprecated: { en: "Deprecated", ar: "مهمل" },
  };

  return texts[status][locale];
}

/**
 * Get job status text
 */
export function getJobStatusText(
  status: TrainingJob["status"],
  locale: "en" | "ar"
): string {
  const texts: Record<TrainingJob["status"], { en: string; ar: string }> = {
    queued: { en: "Queued", ar: "في الطابور" },
    preparing: { en: "Preparing", ar: "قيد التحضير" },
    training: { en: "Training", ar: "قيد التدريب" },
    evaluating: { en: "Evaluating", ar: "قيد التقييم" },
    completed: { en: "Completed", ar: "مكتمل" },
    failed: { en: "Failed", ar: "فاشل" },
  };

  return texts[status][locale];
}

/**
 * Get training cost estimate
 */
export function estimateTrainingCost(epochs: number): number {
  // $0.50 per epoch (placeholder)
  return Math.round(epochs * 0.5 * 100) / 100;
}

/**
 * Compare two model versions
 */
export function compareModels(
  modelA: OrganizationModel,
  modelB: OrganizationModel
): {
  metric: string;
  modelA: number;
  modelB: number;
  better: "A" | "B" | "tie";
}[] {
  const comparisons: Array<{
    metric: string;
    modelA: number;
    modelB: number;
    better: "A" | "B" | "tie";
  }> = [];

  // Validation accuracy
  const accA = modelA.metrics_json?.final_val_accuracy || 0;
  const accB = modelB.metrics_json?.final_val_accuracy || 0;
  comparisons.push({
    metric: "Validation Accuracy",
    modelA: accA,
    modelB: accB,
    better: accA > accB ? "A" : accA < accB ? "B" : "tie",
  });

  // Training loss
  const lossA = modelA.metrics_json?.final_train_loss || 999;
  const lossB = modelB.metrics_json?.final_train_loss || 999;
  comparisons.push({
    metric: "Training Loss",
    modelA: lossA,
    modelB: lossB,
    better: lossA < lossB ? "A" : lossA > lossB ? "B" : "tie",
  });

  // Inference time
  const timeA = modelA.metrics_json?.inference_time_ms || 9999;
  const timeB = modelB.metrics_json?.inference_time_ms || 9999;
  comparisons.push({
    metric: "Inference Time (ms)",
    modelA: timeA,
    modelB: timeB,
    better: timeA < timeB ? "A" : timeA > timeB ? "B" : "tie",
  });

  return comparisons;
}
