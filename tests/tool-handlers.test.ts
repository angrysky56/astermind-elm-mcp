import { describe, expect, it } from 'vitest';
import {
  handleToolCall,
  type ToolContext,
} from '../src/index.js';
import { ModelManager } from '../src/model-manager.js';

function readJson(result: { content: Array<{ type: 'text'; text: string }> }): Record<string, any> {
  return JSON.parse(result.content[0].text) as Record<string, any>;
}

interface StoredModelPayload {
  model_id: string;
  version: string;
  config: object;
  weights: Buffer;
  categories: string[];
  description?: string;
}

class StubPersistence {
  storedModel?: StoredModelPayload;
  storedDataset?: Array<{ text: string; label: string }>;

  async storeModel(payload: StoredModelPayload) {
    this.storedModel = payload;
    return { success: true, record_id: 'models:one' };
  }

  async loadModel() {
    if (!this.storedModel) return null;
    return {
      config: this.storedModel.config,
      weights: this.storedModel.weights,
      categories: this.storedModel.categories,
      metadata: {},
      version: this.storedModel.version,
      description: this.storedModel.description,
    };
  }

  async listModelVersions() {
    return [{ version: '1.0.0', status: 'active' }];
  }

  async storeDataset(payload: { examples: Array<{ text: string; label: string }> }) {
    this.storedDataset = payload.examples;
    return { success: true, record_id: 'datasets:one' };
  }

  async loadDataset() {
    return {
      examples: this.storedDataset ?? [],
      size: this.storedDataset?.length ?? 0,
      metadata: { source: 'test' },
    };
  }

  async getModelMetrics() {
    return {
      accuracy: 1,
      total_predictions: 2,
      avg_confidence: 0.9,
      avg_latency_ms: 1,
      predictions_per_label: { positive: 1, negative: 1 },
    };
  }

  async getConfusionMatrix() {
    return { positive: { positive: 1 }, negative: { negative: 1 } };
  }

  async detectDrift() {
    return {
      status: 'ok',
      drift_detected: false,
      drift_score: 0,
      baseline_sample_count: 2,
      current_sample_count: 2,
      baseline_distribution: { positive: 0.5, negative: 0.5 },
      current_distribution: { positive: 0.5, negative: 0.5 },
    };
  }

  async storeEmbeddings(payload: { items: unknown[] }) {
    return { success: true, count: payload.items.length };
  }

  async searchSimilar() {
    return [{ item_id: 'one', text: 'hello', similarity: 1, metadata: {} }];
  }
}

function createContext(database: StubPersistence): ToolContext {
  return {
    modelManager: new ModelManager(),
    dbClient: database as unknown as NonNullable<ToolContext['dbClient']>,
    persistenceEnabled: true,
    logPredictions: false,
  };
}

describe('model persistence tool workflow', () => {
  it('restores a persisted classifier with identical predictions', async () => {
    const database = new StubPersistence();
    const context = createContext(database);
    const trainingData = [
      { text: 'love this product', label: 'positive' },
      { text: 'excellent purchase', label: 'positive' },
      { text: 'hate this product', label: 'negative' },
      { text: 'terrible purchase', label: 'negative' },
    ];

    await handleToolCall('train_classifier', {
      model_id: 'roundtrip',
      training_data: trainingData,
      config: { hiddenUnits: 16 },
    }, context);
    const before = readJson(await handleToolCall('predict', {
      model_id: 'roundtrip',
      text: 'love this purchase',
      top_k: 2,
    }, context));

    await handleToolCall('store_model_persistent', {
      model_id: 'roundtrip',
      version: '1.0.0',
    }, context);
    await handleToolCall('delete_model', { model_id: 'roundtrip' }, context);
    const loaded = readJson(await handleToolCall('load_model_persistent', {
      model_id: 'roundtrip',
      version: '1.0.0',
    }, context));
    const after = readJson(await handleToolCall('predict', {
      model_id: 'roundtrip',
      text: 'love this purchase',
      top_k: 2,
    }, context));

    expect(loaded).toMatchObject({
      success: true,
      model_id: 'roundtrip',
      version: '1.0.0',
    });
    expect(after.predictions).toEqual(before.predictions);
  });

  it('preserves token-mode preprocessing across persistence', async () => {
    const database = new StubPersistence();
    const context = createContext(database);

    await handleToolCall('train_classifier', {
      model_id: 'token-roundtrip',
      training_data: [
        { text: 'a-b', label: 'dashed' },
        { text: 'ab', label: 'plain' },
      ],
      config: { hiddenUnits: 32, maxLen: 8 },
    }, context);
    const before = readJson(await handleToolCall('predict', {
      model_id: 'token-roundtrip',
      text: 'a-b',
      top_k: 2,
    }, context));

    await handleToolCall('store_model_persistent', {
      model_id: 'token-roundtrip',
      version: '1.0.0',
    }, context);
    await handleToolCall('delete_model', { model_id: 'token-roundtrip' }, context);
    await handleToolCall('load_model_persistent', {
      model_id: 'token-roundtrip',
      version: '1.0.0',
    }, context);
    const after = readJson(await handleToolCall('predict', {
      model_id: 'token-roundtrip',
      text: 'a-b',
      top_k: 2,
    }, context));

    expect(before.predictions[0].category).toBe('dashed');
    expect(after.predictions).toEqual(before.predictions);
  });

  it('dispatches dataset, monitoring, and vector tools through persistence', async () => {
    const database = new StubPersistence();
    const context = createContext(database);
    const window = {
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-01T01:00:00.000Z',
    };

    const storedDataset = readJson(await handleToolCall('store_training_dataset', {
      dataset_id: 'dataset',
      training_data: [{ text: 'good', label: 'positive' }],
    }, context));
    const loadedDataset = readJson(await handleToolCall('load_training_dataset', {
      dataset_id: 'dataset',
    }, context));
    const versions = readJson(await handleToolCall('list_model_versions', {
      model_id: 'model',
    }, context));
    const metrics = readJson(await handleToolCall('get_model_metrics', {
      model_id: 'model',
      time_range: window,
    }, context));
    const matrix = readJson(await handleToolCall('get_confusion_matrix', {
      model_id: 'model',
      time_range: window,
    }, context));
    const drift = readJson(await handleToolCall('detect_drift', {
      model_id: 'model',
      baseline_window: window,
      current_window: window,
    }, context));
    const storedEmbeddings = readJson(await handleToolCall('store_embeddings', {
      collection_name: 'items',
      items: [{ item_id: 'one', text: 'hello', embedding: [0.1, 0.2] }],
    }, context));
    const similar = readJson(await handleToolCall('search_similar', {
      collection_name: 'items',
      query_embedding: [0.1, 0.2],
      top_k: 1,
    }, context));

    expect(storedDataset).toMatchObject({ success: true, examples: 1 });
    expect(loadedDataset).toMatchObject({ size: 1, examples: [{ text: 'good', label: 'positive' }] });
    expect(versions).toMatchObject({ total_versions: 1 });
    expect(metrics.metrics).toMatchObject({ accuracy: 1, total_predictions: 2 });
    expect(matrix.confusion_matrix).toEqual({
      positive: { positive: 1 },
      negative: { negative: 1 },
    });
    expect(drift.drift_analysis).toMatchObject({ status: 'ok', drift_detected: false });
    expect(storedEmbeddings).toMatchObject({ success: true, stored_count: 1 });
    expect(similar).toMatchObject({ total_results: 1 });
  });
});
