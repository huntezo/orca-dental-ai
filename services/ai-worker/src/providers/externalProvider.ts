/**
 * External AI Provider
 * Calls external REST API for analysis
 */

import axios, { AxiosError } from "axios";
import FormData from "form-data";
import { BaseProvider, AIResult, ProviderConfig, ProviderError } from "./baseProvider";

export interface ExternalProviderConfig extends ProviderConfig {
  endpoint: string;
  api_key: string;
  model?: string;
}

export class ExternalProvider extends BaseProvider {
  readonly name: string;
  readonly type: "external" | "local" = "external";
  readonly version: string;
  private apiKey: string;
  
  constructor(id: string, name: string, config: ExternalProviderConfig) {
    super(id, config);
    this.name = name;
    this.version = config.version || "v1.0";
    this.apiKey = config.api_key;
    
    if (!this.apiKey) {
      throw new ProviderError("API key is required for external provider", "CONFIG_ERROR");
    }
  }
  
  async run(input: Buffer): Promise<AIResult> {
    this.validateInput(input);
    
    const startTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append("image", input, {
        filename: "analysis.jpg",
        contentType: "image/jpeg",
      });
      
      if (this.config.model) {
        formData.append("model", this.config.model);
      }
      
      const response = await axios.post(
        `${this.config.endpoint}/analyze`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "Authorization": `Bearer ${this.apiKey}`,
            "X-Provider-Version": this.version,
          },
          timeout: this.config.timeout_ms,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      
      const duration = Date.now() - startTime;
      
      if (!response.data) {
        throw new ProviderError("Empty response from external provider", "EMPTY_RESPONSE");
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
            `External provider timeout after ${this.config.timeout_ms}ms`,
            "TIMEOUT",
            true
          );
        }
        
        if (axiosError.response) {
          const status = axiosError.response.status;
          const errorData = axiosError.response.data as { error?: string; message?: string };
          const errorMessage = errorData?.error || errorData?.message || `HTTP ${status}`;
          
          // Retryable status codes
          const retryableCodes = [408, 429, 502, 503, 504];
          const isRetryable = retryableCodes.includes(status);
          
          throw new ProviderError(
            `External provider error: ${errorMessage}`,
            `HTTP_${status}`,
            isRetryable
          );
        }
        
        if (axiosError.request) {
          throw new ProviderError(
            "No response from external provider",
            "NO_RESPONSE",
            true
          );
        }
      }
      
      throw new ProviderError(
        `External provider error: ${(error as Error).message}`,
        "UNKNOWN_ERROR",
        true
      );
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.endpoint}/health`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
        timeout: 10000, // 10 second timeout for health check
      });
      
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
