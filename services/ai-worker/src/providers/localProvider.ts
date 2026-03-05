/**
 * Local AI Provider
 * Calls local FastAPI model server
 */

import axios, { AxiosError } from "axios";
import FormData from "form-data";
import { BaseProvider, AIResult, ProviderConfig, ProviderError } from "./baseProvider";

export interface LocalProviderConfig extends ProviderConfig {
  endpoint: string;
}

export class LocalProvider extends BaseProvider {
  readonly name: string;
  readonly type: "external" | "local" = "local";
  readonly version: string;
  
  constructor(id: string, name: string, config: LocalProviderConfig) {
    super(id, config);
    this.name = name;
    this.version = config.version || "v1.0";
  }
  
  async run(input: Buffer): Promise<AIResult> {
    this.validateInput(input);
    
    const startTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append("file", input, {
        filename: "analysis.jpg",
        contentType: "image/jpeg",
      });
      
      const response = await axios.post(
        `${this.config.endpoint}/infer`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.config.timeout_ms,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      
      const duration = Date.now() - startTime;
      
      if (!response.data) {
        throw new ProviderError("Empty response from local provider", "EMPTY_RESPONSE");
      }
      
      return this.standardizeResult(response.data, this.version);
      
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
          throw new ProviderError(
            `Local provider timeout after ${this.config.timeout_ms}ms`,
            "TIMEOUT",
            true
          );
        }
        
        if (axiosError.code === "ECONNREFUSED") {
          throw new ProviderError(
            "Local model server not available",
            "CONN_REFUSED",
            true
          );
        }
        
        if (axiosError.response) {
          const status = axiosError.response.status;
          const errorData = axiosError.response.data as { detail?: string; error?: string };
          const errorMessage = errorData?.detail || errorData?.error || `HTTP ${status}`;
          
          throw new ProviderError(
            `Local provider error: ${errorMessage}`,
            `HTTP_${status}`,
            status >= 500 // Retry on server errors
          );
        }
        
        if (axiosError.request) {
          throw new ProviderError(
            "No response from local provider",
            "NO_RESPONSE",
            true
          );
        }
      }
      
      throw new ProviderError(
        `Local provider error: ${(error as Error).message}`,
        "UNKNOWN_ERROR",
        true
      );
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.endpoint}/health`, {
        timeout: 5000, // 5 second timeout for health check
      });
      
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
