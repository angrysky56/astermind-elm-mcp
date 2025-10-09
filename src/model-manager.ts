/**
 * Model Manager - Single source of truth for all ELM model operations
 * Manages model lifecycle, storage, and retrieval
 */

import { ELM, OnlineELM, KernelELM, DeepELM, EmbeddingStore } from '@astermind/astermind-elm';
import type { 
  ModelMetadata, 
  ClassifierConfig,
  OnlineConfig,
  EmbeddingConfig 
} from './types.js';

/**
 * Union type for all supported model instances
 */
type ModelInstance = ELM | OnlineELM | KernelELM | DeepELM | EmbeddingStore;

/**
 * Model entry with metadata and instance
 */
interface ModelEntry {
  metadata: ModelMetadata;
  instance: ModelInstance;
}

/**
 * ModelManager - Centralized model lifecycle management
 */
export class ModelManager {
  private models: Map<string, ModelEntry> = new Map();

  /**
   * Create a new classifier model
   */
  createClassifier(id: string, config: ClassifierConfig, description?: string): ELM {
    if (this.models.has(id)) {
      throw new Error(`Model '${id}' already exists`);
    }

    const elm = new ELM(config);
    
    this.models.set(id, {
      metadata: {
        id,
        type: 'classifier',
        created: new Date(),
        lastUsed: new Date(),
        categories: config.categories,
        description
      },
      instance: elm
    });

    return elm;
  }

  /**
   * Create a new online learning model
   */
  createOnlineModel(id: string, config: OnlineConfig, description?: string): OnlineELM {
    if (this.models.has(id)) {
      throw new Error(`Model '${id}' already exists`);
    }

    const model = new OnlineELM(config);
    
    this.models.set(id, {
      metadata: {
        id,
        type: 'online',
        created: new Date(),
        lastUsed: new Date(),
        description
      },
      instance: model
    });

    return model;
  }

  /**
   * Create a new embedding store
   */
  createEmbeddingStore(id: string, config?: EmbeddingConfig, description?: string): EmbeddingStore {
    if (this.models.has(id)) {
      throw new Error(`Model '${id}' already exists`);
    }

    const store = new EmbeddingStore(config);
    
    this.models.set(id, {
      metadata: {
        id,
        type: 'embedding',
        created: new Date(),
        lastUsed: new Date(),
        description
      },
      instance: store
    });

    return store;
  }

  /**
   * Get a model by ID
   */
  getModel<T extends ModelInstance = ModelInstance>(id: string): T {
    const entry = this.models.get(id);
    if (!entry) {
      throw new Error(`Model '${id}' not found`);
    }
    
    entry.metadata.lastUsed = new Date();
    return entry.instance as T;
  }

  /**
   * Check if a model exists
   */
  hasModel(id: string): boolean {
    return this.models.has(id);
  }

  /**
   * Delete a model
   */
  deleteModel(id: string): boolean {
    return this.models.delete(id);
  }

  /**
   * List all models with their metadata
   */
  listModels(): ModelMetadata[] {
    return Array.from(this.models.values()).map(entry => entry.metadata);
  }

  /**
   * Get model metadata
   */
  getMetadata(id: string): ModelMetadata {
    const entry = this.models.get(id);
    if (!entry) {
      throw new Error(`Model '${id}' not found`);
    }
    return entry.metadata;
  }

  /**
   * Update model metadata
   */
  updateMetadata(id: string, updates: Partial<ModelMetadata>): void {
    const entry = this.models.get(id);
    if (!entry) {
      throw new Error(`Model '${id}' not found`);
    }
    
    Object.assign(entry.metadata, updates);
  }

  /**
   * Clear all models
   */
  clear(): void {
    this.models.clear();
  }
}
