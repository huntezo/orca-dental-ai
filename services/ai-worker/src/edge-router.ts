/**
 * Edge Router
 * Handles intelligent routing between edge nodes and central providers
 */

import axios, { AxiosError } from "axios";
import crypto from "crypto";
import { db } from "./db";
import { AIProvider, AIResult, ProviderError } from "./providers/baseProvider";
import { ProviderManager } from "./providers/providerFactory";

// Configuration
const EDGE_TIMEOUT_MS = 3000; // 3 second timeout for edge nodes
const MAX_EDGE_RETRIES = 1;

export interface EdgeNode {
  id: string;
  public_url: string;
  hmac_secret: string;
  region: string;
  capacity_score: number;
  current_load: number;
}

export interface RoutingDecision {
  strategy: "edge" | "central" | "edge_fallback";
  target: EdgeNode | null;
  reason: string;
}

export interface SignedJobPayload {
  job_id: string;
  org_id: string;
  case_id: string;
  user_id: string;
  timestamp: number;
  signature: string;
  model_config?: {
    base_model: string;
    fine_tuned_path?: string;
  };
}

/**
 * Edge Router class
 * Makes intelligent routing decisions for inference jobs
 */
export class EdgeRouter {
  private providerManager: ProviderManager;
  
  constructor(providerManager: ProviderManager) {
    this.providerManager = providerManager;
  }
  
  /**
   * Determine the best routing strategy for an organization
   */
  async determineRouting(orgId: string, preferredRegion?: string): Promise<RoutingDecision> {
    // Get org configuration
    const org = await db.getOrganization(orgId);
    
    if (!org) {
      return {
        strategy: "central",
        target: null,
        reason: "Organization not found"
      };
    }
    
    // Check deployment mode
    if (org.deployment_mode === "onprem") {
      return {
        strategy: "central",
        target: null,
        reason: "On-prem mode: centralized processing only"
      };
    }
    
    // Check edge enabled
    if (!org.edge_enabled) {
      return {
        strategy: "central",
        target: null,
        reason: "Edge not enabled for organization"
      };
    }
    
    // Check routing strategy
    if (org.edge_routing_strategy === "centralized_only") {
      return {
        strategy: "central",
        target: null,
        reason: "Centralized routing strategy"
      };
    }
    
    if (org.edge_routing_strategy === "edge_only") {
      const edgeNode = await db.getOptimalEdgeNode(orgId, preferredRegion);
      if (!edgeNode) {
        throw new ProviderError(
          "No healthy edge nodes available for edge-only routing",
          "NO_EDGE_AVAILABLE",
          false
        );
      }
      return {
        strategy: "edge",
        target: edgeNode,
        reason: "Edge-only strategy"
      };
    }
    
    // edge_first strategy (default)
    const edgeNode = await db.getOptimalEdgeNode(orgId, preferredRegion);
    if (edgeNode) {
      return {
        strategy: "edge_fallback",
        target: edgeNode,
        reason: "Edge first with central fallback"
      };
    }
    
    return {
      strategy: "central",
      target: null,
      reason: "No healthy edge nodes, using central"
    };
  }
  
  /**
   * Execute inference on an edge node
   */
  async executeOnEdge(
    edgeNode: EdgeNode,
    imageBuffer: Buffer,
    jobId: string,
    orgId: string,
    modelConfig?: { base_model: string; fine_tuned_path?: string }
  ): Promise<AIResult> {
    const startTime = Date.now();
    
    // Create signed payload
    const payload = this.createSignedPayload(jobId, orgId, edgeNode.hmac_secret, modelConfig);
    
    try {
      const formData = new (await import("form-data"))();
      formData.append("image", imageBuffer, {
        filename: "analysis.jpg",
        contentType: "image/jpeg"
      });
      formData.append("payload", JSON.stringify(payload));
      
      const response = await axios.post(
        `${edgeNode.public_url}/infer`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: EDGE_TIMEOUT_MS,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );
      
      const latency = Date.now() - startTime;
      
      // Update edge node load
      await db.recordEdgeHeartbeat(edgeNode.id, edgeNode.current_load + 1);
      
      // Record edge latency
      await db.updateJobEdgeLatency(jobId, latency);
      
      if (!response.data) {
        throw new ProviderError("Empty response from edge node", "EMPTY_RESPONSE");
      }
      
      return this.standardizeEdgeResult(response.data);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
          throw new ProviderError(
            `Edge node timeout after ${EDGE_TIMEOUT_MS}ms`,
            "EDGE_TIMEOUT",
            true
          );
        }
        
        if (axiosError.response?.status === 401) {
          throw new ProviderError(
            "Edge node signature validation failed",
            "EDGE_AUTH_FAILED",
            false
          );
        }
      }
      
      throw new ProviderError(
        `Edge inference failed: ${(error as Error).message}`,
        "EDGE_ERROR",
        true
      );
    }
  }
  
  /**
   * Execute inference on central provider
   */
  async executeOnCentral(
    imageBuffer: Buffer,
    provider?: AIProvider
  ): Promise<AIResult> {
    const targetProvider = provider || this.providerManager.getPrimary();
    
    if (!targetProvider) {
      throw new ProviderError("No central provider available", "NO_PROVIDER");
    }
    
    return targetProvider.run(imageBuffer);
  }
  
  /**
   * Create HMAC-signed job payload
   */
  private createSignedPayload(
    jobId: string,
    orgId: string,
    hmacSecret: string,
    modelConfig?: { base_model: string; fine_tuned_path?: string }
  ): SignedJobPayload {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = `${jobId}:${orgId}:${timestamp}`;
    
    const signature = crypto
      .createHmac("sha256", hmacSecret)
      .update(payloadString)
      .digest("hex");
    
    return {
      job_id: jobId,
      org_id: orgId,
      case_id: "", // Will be filled by caller
      user_id: "",
      timestamp,
      signature,
      model_config: modelConfig
    };
  }
  
  /**
   * Standardize edge result to AIResult format
   */
  private standardizeEdgeResult(raw: unknown): AIResult {
    const data = raw as Record<string, unknown>;
    
    return {
      version: (data.version as string) || "edge-v1",
      raw: data,
      structured: {
        measurements: (data.measurements as Record<string, number>) || {},
        landmarks: (data.landmarks as Array<{ x: number; y: number; label: string }>) || [],
        summary: (data.summary as string) || "",
        confidence: (data.confidence as number) || 0
      }
    };
  }
  
  /**
   * Get organization-specific model configuration
   */
  async getOrgModelConfig(orgId: string): Promise<{ base_model: string; fine_tuned_path?: string } | null> {
    const org = await db.getOrganization(orgId);
    
    if (!org?.custom_model_enabled || !org.current_model_id) {
      return null;
    }
    
    const model = await db.getOrganizationModel(org.current_model_id);
    
    if (!model || model.training_status !== "ready") {
      return null;
    }
    
    return {
      base_model: model.base_model,
      fine_tuned_path: model.fine_tuned_model_path || undefined
    };
  }
}

/**
 * License validator
 */
export class LicenseValidator {
  /**
   * Validate license before processing job
   */
  async validate(orgId: string): Promise<{
    valid: boolean;
    reason?: string;
    maxMonthlyJobs?: number;
    deploymentMode?: string;
  }> {
    const license = await db.getLicenseForJob(orgId);
    
    if (!license) {
      return { valid: false, reason: "No license found" };
    }
    
    if (!license.is_valid) {
      // Check if expired
      const expired = await this.checkLicenseExpired(license.license_key);
      if (expired) {
        await this.emitLicenseExpiredEvent(orgId);
        return { valid: false, reason: "License expired" };
      }
      return { valid: false, reason: "License quota exceeded" };
    }
    
    return {
      valid: true,
      maxMonthlyJobs: license.max_monthly_jobs,
      deploymentMode: license.deployment_mode
    };
  }
  
  /**
   * Check if license is expired
   */
  private async checkLicenseExpired(licenseKey: string): Promise<boolean> {
    // This would typically check against a license server
    // For on-prem, check local license table
    const result = await db.checkLicenseExpiry(licenseKey);
    return result?.is_expired || false;
  }
  
  /**
   * Emit license expired telemetry event
   */
  private async emitLicenseExpiredEvent(orgId: string): Promise<void> {
    await db.trackEvent(null, "license_expired", null, { org_id: orgId });
  }
}
