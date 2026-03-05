/**
 * Base Provider Interface
 * Defines the contract for all AI providers
 */

export interface AIResult {
  version: string;
  raw: unknown;
  structured: {
    measurements: Record<string, number>;
    landmarks: Array<{ x: number; y: number; label: string }>;
    summary: string;
    confidence: number;
  };
}

export interface ProviderConfig {
  endpoint: string;
  api_key?: string;
  timeout_ms: number;
  version: string;
  model?: string;
  [key: string]: unknown;
}

export interface AIProvider {
  readonly name: string;
  readonly type: "external" | "local";
  readonly version: string;
  readonly id: string;
  
  /**
   * Run analysis on the provided image buffer
   * @param input - Image buffer to analyze
   * @returns Promise resolving to AIResult
   */
  run(input: Buffer): Promise<AIResult>;
  
  /**
   * Health check for the provider
   * @returns Promise resolving to boolean indicating health status
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Base class with common provider functionality
 */
export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly type: "external" | "local";
  abstract readonly version: string;
  readonly id: string;
  protected config: ProviderConfig;
  
  constructor(id: string, config: ProviderConfig) {
    this.id = id;
    this.config = {
      timeout_ms: 300000, // 5 minutes default
      ...config,
    };
  }
  
  abstract run(input: Buffer): Promise<AIResult>;
  abstract healthCheck(): Promise<boolean>;
  
  /**
   * Standardize raw result into AIResult format
   */
  protected standardizeResult(raw: unknown, version: string): AIResult {
    const rawData = raw as Record<string, unknown>;
    
    return {
      version,
      raw: rawData,
      structured: {
        measurements: (rawData.measurements as Record<string, number>) || {},
        landmarks: (rawData.landmarks as Array<{ x: number; y: number; label: string }>) || [],
        summary: (rawData.summary as string) || "",
        confidence: (rawData.confidence as number) || 0,
      },
    };
  }
  
  /**
   * Validate image buffer
   */
  protected validateInput(input: Buffer): void {
    if (!input || input.length === 0) {
      throw new ProviderError("Invalid input: empty buffer", "INVALID_INPUT");
    }
    
    // Check for common image magic numbers
    const isJpeg = input[0] === 0xFF && input[1] === 0xD8;
    const isPng = input[0] === 0x89 && input[1] === 0x50;
    const isDicom = input.slice(128, 132).toString() === "DICM";
    
    if (!isJpeg && !isPng && !isDicom) {
      throw new ProviderError("Invalid input: unsupported image format", "INVALID_FORMAT");
    }
  }
}

/**
 * Custom error class for provider errors
 */
export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  
  constructor(message: string, code: string, retryable = false) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
