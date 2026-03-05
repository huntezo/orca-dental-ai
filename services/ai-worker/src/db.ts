/**
 * Database Client
 * Supabase client for worker with service role key
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
}

/**
 * Create Supabase client with service role
 */
export function createDbClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Database helper class
 */
export class Database {
  private client: SupabaseClient;
  
  constructor() {
    this.client = createDbClient();
  }
  
  /**
   * Get the Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }
  
  /**
   * Claim next pending job
   */
  async claimNextJob(): Promise<{
    job_id: string;
    job_case_id: string;
    job_user_id: string;
    job_attempts: number;
    job_max_attempts: number;
  } | null> {
    const { data, error } = await this.client
      .rpc("claim_next_analysis_job", {
        p_worker_id: process.env.WORKER_ID || "worker-1",
      });
    
    if (error) {
      console.error("Error claiming job:", error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    return data[0];
  }
  
  /**
   * Complete a job successfully
   */
  async completeJob(
    jobId: string,
    providerId: string,
    durationMs: number,
    modelVersion: string,
    resultJson: unknown
  ): Promise<boolean> {
    const { error } = await this.client
      .rpc("complete_analysis_job", {
        p_job_id: jobId,
        p_provider_id: providerId,
        p_duration_ms: durationMs,
        p_model_version: modelVersion,
        p_result_json: resultJson,
      });
    
    if (error) {
      console.error("Error completing job:", error);
      return false;
    }
    
    return true;
  }
  
  /**
   * Fail a job
   */
  async failJob(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    fallbackUsed = false
  ): Promise<boolean> {
    const { error } = await this.client
      .rpc("fail_analysis_job", {
        p_job_id: jobId,
        p_error_code: errorCode,
        p_error_message: errorMessage,
        p_fallback_used: fallbackUsed,
      });
    
    if (error) {
      console.error("Error failing job:", error);
      return false;
    }
    
    return true;
  }
  
  /**
   * Retry a job (set back to pending)
   */
  async retryJob(jobId: string): Promise<boolean> {
    const { error } = await this.client
      .rpc("retry_analysis_job", {
        p_job_id: jobId,
      });
    
    if (error) {
      console.error("Error retrying job:", error);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get case file for analysis
   */
  async getCaseFile(caseId: string): Promise<{
    file_path: string;
    file_name: string;
  } | null> {
    const { data, error } = await this.client
      .from("case_files")
      .select("file_path, file_name")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error("Error getting case file:", error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Download file from storage
   */
  async downloadFile(filePath: string): Promise<Buffer | null> {
    const { data, error } = await this.client
      .storage
      .from("case-files")
      .download(filePath);
    
    if (error || !data) {
      console.error("Error downloading file:", error);
      return null;
    }
    
    return Buffer.from(await data.arrayBuffer());
  }
  
  /**
   * Get active providers
   */
  async getProviders(): Promise<{
    id: string;
    name: string;
    type: "external" | "local";
    is_primary: boolean;
    is_active: boolean;
    config: Record<string, unknown>;
  }[]> {
    const { data, error } = await this.client
      .from("ai_providers")
      .select("id, name, type, is_primary, is_active, config")
      .eq("is_active", true)
      .order("is_primary", { ascending: false });
    
    if (error) {
      console.error("Error getting providers:", error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Get primary provider
   */
  async getPrimaryProvider(): Promise<{
    provider_id: string;
    provider_name: string;
    provider_type: "external" | "local";
    provider_config: Record<string, unknown>;
  } | null> {
    const { data, error } = await this.client
      .rpc("get_primary_provider");
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return data[0];
  }
  
  /**
   * Get fallback provider
   */
  async getFallbackProvider(): Promise<{
    provider_id: string;
    provider_name: string;
    provider_type: "external" | "local";
    provider_config: Record<string, unknown>;
  } | null> {
    const { data, error } = await this.client
      .rpc("get_fallback_provider");
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return data[0];
  }
  
  /**
   * Track fallback usage
   */
  async trackFallback(
    jobId: string,
    primaryProviderId: string,
    fallbackProviderId: string
  ): Promise<void> {
    await this.client
      .rpc("track_fallback_usage", {
        p_job_id: jobId,
        p_primary_provider_id: primaryProviderId,
        p_fallback_provider_id: fallbackProviderId,
      });
  }
  
  /**
   * Timeout stuck jobs
   */
  async timeoutStuckJobs(timeoutMinutes = 5): Promise<number> {
    const { data, error } = await this.client
      .rpc("timeout_stuck_jobs", {
        p_timeout_minutes: timeoutMinutes,
      });
    
    if (error) {
      console.error("Error timing out jobs:", error);
      return 0;
    }
    
    return data || 0;
  }
  
  // ============================================
  // ENTERPRISE: EDGE ROUTING
  // ============================================
  
  /**
   * Get organization details
   */
  async getOrganization(orgId: string): Promise<{
    id: string;
    edge_enabled: boolean;
    edge_routing_strategy: "edge_first" | "edge_only" | "centralized_only";
    custom_model_enabled: boolean;
    current_model_id: string | null;
    deployment_mode: "cloud" | "hybrid" | "onprem";
  } | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("id, edge_enabled, edge_routing_strategy, custom_model_enabled, current_model_id, deployment_mode")
      .eq("id", orgId)
      .single();
    
    if (error || !data) {
      console.error("Error getting organization:", error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Get optimal edge node for organization
   */
  async getOptimalEdgeNode(orgId: string, preferredRegion?: string): Promise<{
    id: string;
    public_url: string;
    hmac_secret: string;
    region: string;
    capacity_score: number;
    current_load: number;
  } | null> {
    const { data, error } = await this.client
      .rpc("get_optimal_edge_node", {
        p_org_id: orgId,
        p_preferred_region: preferredRegion
      });
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return data[0];
  }
  
  /**
   * Record edge node heartbeat
   */
  async recordEdgeHeartbeat(nodeId: string, load: number): Promise<void> {
    await this.client
      .rpc("record_edge_heartbeat", {
        p_node_id: nodeId,
        p_load: load,
        p_metrics: {}
      });
  }
  
  /**
   * Update job edge latency
   */
  async updateJobEdgeLatency(jobId: string, latencyMs: number): Promise<void> {
    await this.client
      .from("analysis_jobs")
      .update({ edge_latency_ms: latencyMs, edge_attempted: true })
      .eq("id", jobId);
  }
  
  /**
   * Get organization-specific model
   */
  async getOrganizationModel(modelId: string): Promise<{
    id: string;
    base_model: string;
    fine_tuned_model_path: string | null;
    training_status: string;
    version: string;
  } | null> {
    const { data, error } = await this.client
      .from("organization_models")
      .select("id, base_model, fine_tuned_model_path, training_status, version")
      .eq("id", modelId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data;
  }
  
  // ============================================
  // ENTERPRISE: LICENSE VALIDATION
  // ============================================
  
  /**
   * Get license for job processing
   */
  async getLicenseForJob(orgId: string): Promise<{
    license_key: string;
    is_valid: boolean;
    max_monthly_jobs: number;
    deployment_mode: string;
  } | null> {
    const { data, error } = await this.client
      .rpc("get_license_for_job", { p_org_id: orgId });
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return data[0];
  }
  
  /**
   * Check if license is expired
   */
  async checkLicenseExpiry(licenseKey: string): Promise<{
    is_expired: boolean;
  } | null> {
    const { data, error } = await this.client
      .from("licenses")
      .select("expires_at")
      .eq("license_key", licenseKey)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      is_expired: new Date(data.expires_at) < new Date()
    };
  }
  
  /**
   * Track telemetry event
   */
  async trackEvent(
    userId: string | null,
    eventType: string,
    entityId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.client.rpc("track_event", {
        p_user_id: userId,
        p_event_type: eventType,
        p_entity_id: entityId,
        p_metadata: metadata
      });
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  }
}

// Singleton instance
export const db = new Database();
