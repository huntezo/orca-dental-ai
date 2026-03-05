/**
 * AI Worker Service - Enterprise Edition
 * Multi-provider support with Edge Routing and License Validation
 */

import { db } from "./db";
import { AIProvider, ProviderError, AIResult } from "./providers/baseProvider";
import { ProviderFactory, ProviderManager, ProviderDefinition } from "./providers/providerFactory";
import { EdgeRouter, LicenseValidator } from "./edge-router";

// Configuration
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_CHECK_INTERVAL_MS = 60000;
const JOB_TIMEOUT_MINUTES = 5;
const MAX_RETRY_DELAY_MS = 30000;
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || "cloud";

// Worker state
let isRunning = false;
let pollTimeout: NodeJS.Timeout | null = null;
let timeoutCheckInterval: NodeJS.Timeout | null = null;
const providerManager = new ProviderManager();
const edgeRouter = new EdgeRouter(providerManager);
const licenseValidator = new LicenseValidator();

/**
 * Load and configure providers
 */
async function loadProviders(): Promise<void> {
  console.log("[Worker] Loading AI providers...");
  
  const providers = await db.getProviders();
  
  if (providers.length === 0) {
    console.error("[Worker] No active providers found!");
    
    // In on-prem mode, we must have local providers
    if (DEPLOYMENT_MODE === "onprem") {
      throw new Error("On-prem mode requires at least one local provider");
    }
    return;
  }
  
  // In on-prem mode, filter to local providers only
  let filteredProviders = providers;
  if (DEPLOYMENT_MODE === "onprem") {
    filteredProviders = providers.filter(p => p.type === "local");
    console.log(`[Worker] On-prem mode: filtered to ${filteredProviders.length} local providers`);
  }
  
  const definitions: ProviderDefinition[] = filteredProviders.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    is_primary: p.is_primary,
    is_active: p.is_active,
    config: p.config as ProviderDefinition["config"],
  }));
  
  providerManager.loadProviders(definitions);
  
  const primary = providerManager.getPrimary();
  const fallback = providerManager.getFallback();
  
  console.log(`[Worker] Loaded ${definitions.length} provider(s)`);
  console.log(`[Worker] Primary: ${primary?.name || "none"}`);
  console.log(`[Worker] Fallback: ${fallback?.name || "none"}`);
  console.log(`[Worker] Deployment mode: ${DEPLOYMENT_MODE}`);
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt: number): number {
  const baseDelay = 1000;
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  return Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
}

/**
 * Get organization ID from case
 */
async function getOrgIdFromCase(caseId: string): Promise<string | null> {
  const supabase = db.getClient();
  
  const { data, error } = await supabase
    .from("cases")
    .select("org_id")
    .eq("id", caseId)
    .single();
  
  if (error || !data) {
    console.error("[Worker] Failed to get org_id from case:", error);
    return null;
  }
  
  return data.org_id;
}

/**
 * Process a job with edge routing
 */
async function processWithEdgeRouting(
  jobId: string,
  caseId: string,
  orgId: string,
  imageBuffer: Buffer
): Promise<{ success: boolean; result?: AIResult; error?: ProviderError; fromEdge?: boolean }> {
  
  // Get routing decision
  const routing = await edgeRouter.determineRouting(orgId);
  console.log(`[Worker] Routing decision for job ${jobId}: ${routing.strategy} (${routing.reason})`);
  
  // Get org model config if available
  const modelConfig = await edgeRouter.getOrgModelConfig(orgId);
  if (modelConfig) {
    console.log(`[Worker] Using custom model for org ${orgId}: ${modelConfig.base_model}`);
  }
  
  // Try edge if strategy allows
  if (routing.strategy === "edge" || routing.strategy === "edge_fallback") {
    if (routing.target) {
      try {
        console.log(`[Worker] Sending job ${jobId} to edge node ${routing.target.id}`);
        
        const result = await edgeRouter.executeOnEdge(
          routing.target,
          imageBuffer,
          jobId,
          orgId,
          modelConfig || undefined
        );
        
        return { success: true, result, fromEdge: true };
        
      } catch (error) {
        console.error(`[Worker] Edge inference failed:`, error);
        
        // If edge-only, fail immediately
        if (routing.strategy === "edge") {
          return {
            success: false,
            error: error instanceof ProviderError 
              ? error 
              : new ProviderError("Edge inference failed", "EDGE_FAILED")
          };
        }
        
        // Otherwise fall through to central
        console.log(`[Worker] Falling back to central provider for job ${jobId}`);
      }
    }
  }
  
  // Use central provider
  try {
    const result = await edgeRouter.executeOnCentral(imageBuffer);
    return { success: true, result, fromEdge: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ProviderError 
        ? error 
        : new ProviderError("Central inference failed", "CENTRAL_FAILED")
    };
  }
}

/**
 * Process a single job
 */
async function processJob(job: {
  job_id: string;
  job_case_id: string;
  job_user_id: string;
  job_attempts: number;
  job_max_attempts: number;
}): Promise<void> {
  const { job_id, job_case_id, job_attempts, job_max_attempts } = job;
  
  console.log(`[Worker] Processing job ${job_id} for case ${job_case_id} (attempt ${job_attempts})`);
  
  // Get organization ID
  const orgId = await getOrgIdFromCase(job_case_id);
  if (!orgId) {
    await db.failJob(job_id, "NO_ORG", "Failed to determine organization");
    return;
  }
  
  // Validate license (skip in cloud mode for backward compatibility)
  if (DEPLOYMENT_MODE !== "cloud") {
    const licenseCheck = await licenseValidator.validate(orgId);
    if (!licenseCheck.valid) {
      console.error(`[Worker] License validation failed for org ${orgId}: ${licenseCheck.reason}`);
      await db.failJob(job_id, "LICENSE_INVALID", licenseCheck.reason || "License validation failed");
      return;
    }
  }
  
  // Get case file
  const caseFile = await db.getCaseFile(job_case_id);
  if (!caseFile) {
    await db.failJob(job_id, "NO_FILE", "No file found for case");
    return;
  }
  
  // Download file
  const fileBuffer = await db.downloadFile(caseFile.file_path);
  if (!fileBuffer) {
    await db.failJob(job_id, "DOWNLOAD_FAILED", "Failed to download file");
    return;
  }
  
  // Process with edge routing
  const startTime = Date.now();
  const result = await processWithEdgeRouting(job_id, job_case_id, orgId, fileBuffer);
  const duration = Date.now() - startTime;
  
  if (result.success && result.result) {
    // Success
    await db.completeJob(
      job_id,
      result.fromEdge ? "edge-node" : (providerManager.getPrimary()?.id || "central"),
      duration,
      result.result.version,
      result.result
    );
    
    console.log(`[Worker] Job ${job_id} completed successfully (${result.fromEdge ? "edge" : "central"})`);
    
  } else {
    // Failure
    const error = result.error!;
    
    // Check if retryable
    if (error.retryable && job_attempts < job_max_attempts) {
      const delay = getRetryDelay(job_attempts);
      console.log(`[Worker] Job ${job_id} failed with retryable error, retrying in ${delay}ms`);
      await db.retryJob(job_id);
      return;
    }
    
    // Final failure
    await db.failJob(job_id, error.code, error.message);
    console.error(`[Worker] Job ${job_id} failed: ${error.message}`);
  }
}

/**
 * Poll for and process jobs
 */
async function poll(): Promise<void> {
  if (!isRunning) return;
  
  try {
    const job = await db.claimNextJob();
    
    if (job) {
      await processJob(job);
    }
  } catch (error) {
    console.error("[Worker] Error during poll:", error);
  }
  
  if (isRunning) {
    pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
  }
}

/**
 * Check for and timeout stuck jobs
 */
async function checkTimeouts(): Promise<void> {
  try {
    const timedOutCount = await db.timeoutStuckJobs(JOB_TIMEOUT_MINUTES);
    if (timedOutCount > 0) {
      console.log(`[Worker] Timed out ${timedOutCount} stuck job(s)`);
    }
  } catch (error) {
    console.error("[Worker] Error checking timeouts:", error);
  }
}

/**
 * Start the worker
 */
async function start(): Promise<void> {
  if (isRunning) {
    console.log("[Worker] Already running");
    return;
  }
  
  console.log("[Worker] Starting AI Worker Service (Enterprise Edition)...");
  
  // Load providers
  await loadProviders();
  
  isRunning = true;
  
  // Start polling
  poll();
  
  // Start timeout checker
  timeoutCheckInterval = setInterval(checkTimeouts, TIMEOUT_CHECK_INTERVAL_MS);
  
  console.log("[Worker] Service started successfully");
}

/**
 * Stop the worker gracefully
 */
function stop(): void {
  console.log("[Worker] Stopping...");
  
  isRunning = false;
  
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  
  if (timeoutCheckInterval) {
    clearInterval(timeoutCheckInterval);
    timeoutCheckInterval = null;
  }
  
  console.log("[Worker] Stopped");
}

// Handle shutdown signals
process.on("SIGTERM", () => {
  console.log("[Worker] SIGTERM received");
  stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Worker] SIGINT received");
  stop();
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught exception:", error);
  stop();
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled rejection:", reason);
});

// Start the worker
start().catch((error) => {
  console.error("[Worker] Failed to start:", error);
  process.exit(1);
});
