/**
 * Provider Factory
 * Creates and manages AI provider instances
 */

import { AIProvider, ProviderConfig } from "./baseProvider";
import { ExternalProvider, ExternalProviderConfig } from "./externalProvider";
import { LocalProvider, LocalProviderConfig } from "./localProvider";

export interface ProviderDefinition {
  id: string;
  name: string;
  type: "external" | "local";
  is_primary: boolean;
  is_active: boolean;
  config: ProviderConfig;
}

/**
 * Factory class for creating AI provider instances
 */
export class ProviderFactory {
  private static instances: Map<string, AIProvider> = new Map();
  
  /**
   * Create a provider instance from a provider definition
   */
  static create(definition: ProviderDefinition): AIProvider {
    const { id, name, type, config } = definition;
    
    // Check if instance already exists
    const existingKey = `${type}:${id}`;
    if (this.instances.has(existingKey)) {
      return this.instances.get(existingKey)!;
    }
    
    let provider: AIProvider;
    
    if (type === "external") {
      provider = new ExternalProvider(id, name, config as ExternalProviderConfig);
    } else if (type === "local") {
      provider = new LocalProvider(id, name, config as LocalProviderConfig);
    } else {
      throw new Error(`Unknown provider type: ${type}`);
    }
    
    // Cache the instance
    this.instances.set(existingKey, provider);
    
    return provider;
  }
  
  /**
   * Get cached provider instance
   */
  static get(id: string, type: "external" | "local"): AIProvider | undefined {
    return this.instances.get(`${type}:${id}`);
  }
  
  /**
   * Clear all cached instances
   */
  static clear(): void {
    this.instances.clear();
  }
  
  /**
   * Remove a specific provider instance from cache
   */
  static remove(id: string, type: "external" | "local"): boolean {
    return this.instances.delete(`${type}:${id}`);
  }
}

/**
 * Provider manager for handling primary and fallback providers
 */
export class ProviderManager {
  private primaryProvider: AIProvider | null = null;
  private fallbackProvider: AIProvider | null = null;
  private providerDefinitions: Map<string, ProviderDefinition> = new Map();
  
  /**
   * Load providers from definitions
   */
  loadProviders(definitions: ProviderDefinition[]): void {
    this.providerDefinitions.clear();
    this.primaryProvider = null;
    this.fallbackProvider = null;
    
    for (const def of definitions) {
      if (!def.is_active) continue;
      
      this.providerDefinitions.set(def.id, def);
      
      if (def.is_primary) {
        this.primaryProvider = ProviderFactory.create(def);
      } else if (!this.fallbackProvider) {
        // Use first non-primary active provider as fallback
        this.fallbackProvider = ProviderFactory.create(def);
      }
    }
  }
  
  /**
   * Get the primary provider
   */
  getPrimary(): AIProvider | null {
    return this.primaryProvider;
  }
  
  /**
   * Get the fallback provider
   */
  getFallback(): AIProvider | null {
    return this.fallbackProvider;
  }
  
  /**
   * Check if fallback is available
   */
  hasFallback(): boolean {
    return this.fallbackProvider !== null;
  }
  
  /**
   * Get all active providers
   */
  getAllProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    
    if (this.primaryProvider) {
      providers.push(this.primaryProvider);
    }
    
    if (this.fallbackProvider && !providers.includes(this.fallbackProvider)) {
      providers.push(this.fallbackProvider);
    }
    
    return providers;
  }
  
  /**
   * Get provider definition by ID
   */
  getDefinition(id: string): ProviderDefinition | undefined {
    return this.providerDefinitions.get(id);
  }
  
  /**
   * Perform health check on all providers
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [id, def] of this.providerDefinitions) {
      const provider = ProviderFactory.get(id, def.type);
      if (provider) {
        try {
          const isHealthy = await provider.healthCheck();
          results.set(id, isHealthy);
        } catch {
          results.set(id, false);
        }
      }
    }
    
    return results;
  }
}
