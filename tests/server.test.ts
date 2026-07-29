import { describe, expect, it } from 'vitest';
import { handleToolCall, type ToolContext } from '../src/index.js';
import { ModelManager } from '../src/model-manager.js';

interface TextContent {
  type: 'text';
  text: string;
}

function readJson(result: { content: TextContent[] }): Record<string, any> {
  return JSON.parse(result.content[0].text) as Record<string, any>;
}

describe('core MCP tool workflow', () => {
  it('trains a classifier and predicts through the public tool handler', async () => {
    const modelId = 'test-core-workflow';

    const trained = await handleToolCall('train_classifier', {
      model_id: modelId,
      training_data: [
        { text: 'love this product', label: 'positive' },
        { text: 'excellent purchase', label: 'positive' },
        { text: 'hate this product', label: 'negative' },
        { text: 'terrible purchase', label: 'negative' },
      ],
      config: { hiddenUnits: 16 },
    });
    const trainingResult = readJson(trained);

    expect(trainingResult).toMatchObject({
      success: true,
      model_id: modelId,
      categories: ['positive', 'negative'],
      training_examples: 4,
    });

    const predicted = await handleToolCall('predict', {
      model_id: modelId,
      text: 'love this purchase',
      top_k: 2,
    });
    const predictionResult = readJson(predicted);

    expect(predictionResult.predictions).toEqual([
      expect.objectContaining({ category: expect.any(String), confidence: expect.any(Number) }),
      expect.objectContaining({ category: expect.any(String), confidence: expect.any(Number) }),
    ]);

    const listed = readJson(await handleToolCall('list_models', {}));
    expect(listed.models).toContainEqual(expect.objectContaining({
      id: modelId,
      trainingExamples: 4,
    }));

    await handleToolCall('delete_model', { model_id: modelId });
  });

  it('rejects empty training data without reserving the model ID', async () => {
    const modelId = 'test-retry-after-invalid-training';

    const rejected = await handleToolCall('train_classifier', {
      model_id: modelId,
      training_data: [],
    });
    expect(rejected.isError).toBe(true);

    const retried = await handleToolCall('train_classifier', {
      model_id: modelId,
      training_data: [
        { text: 'good', label: 'positive' },
        { text: 'bad', label: 'negative' },
      ],
      config: { hiddenUnits: 8 },
    });

    expect(readJson(retried)).toMatchObject({ success: true, model_id: modelId });
    await handleToolCall('delete_model', { model_id: modelId });
  });

  it('does not retain a trained model when requested persistence fails', async () => {
    const modelId = 'test-persistence-rollback';
    const manager = new ModelManager();
    const database = {
      async storeModel() {
        throw new Error('database unavailable');
      },
    } as unknown as NonNullable<ToolContext['dbClient']>;
    const context: ToolContext = {
      modelManager: manager,
      dbClient: database,
      persistenceEnabled: true,
      logPredictions: false,
    };

    const rejected = await handleToolCall('train_classifier', {
      model_id: modelId,
      training_data: [
        { text: 'good', label: 'positive' },
        { text: 'bad', label: 'negative' },
      ],
      config: { hiddenUnits: 8 },
      persist: true,
    }, context);

    expect(rejected.isError).toBe(true);
    expect(readJson(rejected).error).toBe('database unavailable');
    expect(manager.hasModel(modelId)).toBe(false);
  });

  it('rejects prediction limits outside the advertised contract', async () => {
    const result = await handleToolCall('predict', {
      model_id: 'does-not-matter',
      text: 'hello',
      top_k: 0,
    });

    expect(result.isError).toBe(true);
    expect(readJson(result).error).toBe('top_k must be an integer between 1 and 100');
  });

  it('requires classifier training data to contain at least two labels', async () => {
    const result = await handleToolCall('train_classifier', {
      model_id: 'test-one-label',
      training_data: [
        { text: 'one', label: 'same' },
        { text: 'two', label: 'same' },
      ],
    });

    expect(result.isError).toBe(true);
    expect(readJson(result).error).toBe('training_data must contain at least two distinct labels');
  });

  it('uses the same token encoder for training and prediction', async () => {
    const modelId = 'test-token-encoder-consistency';

    await handleToolCall('train_classifier', {
      model_id: modelId,
      training_data: [
        { text: 'a-b', label: 'dashed' },
        { text: 'ab', label: 'plain' },
      ],
      config: { hiddenUnits: 32, maxLen: 8 },
    });

    const dashed = readJson(await handleToolCall('predict', {
      model_id: modelId,
      text: 'a-b',
      top_k: 1,
    }));
    const plain = readJson(await handleToolCall('predict', {
      model_id: modelId,
      text: 'ab',
      top_k: 1,
    }));

    expect(dashed.predictions[0].category).toBe('dashed');
    expect(plain.predictions[0].category).toBe('plain');
    await handleToolCall('delete_model', { model_id: modelId });
  });

  it('logs the persisted model version while honoring an explicit logging opt-out', async () => {
    const manager = new ModelManager();
    const predictionLogs: Array<Record<string, unknown>> = [];
    const database = {
      async storeModel() {
        return { success: true, record_id: 'models:test' };
      },
      async logPrediction(entry: Record<string, unknown>) {
        predictionLogs.push(entry);
        return { success: true };
      },
    } as unknown as NonNullable<ToolContext['dbClient']>;
    const context: ToolContext = {
      modelManager: manager,
      dbClient: database,
      persistenceEnabled: true,
      logPredictions: true,
    };

    await handleToolCall('train_classifier', {
      model_id: 'versioned-model',
      training_data: [
        { text: 'good', label: 'positive' },
        { text: 'bad', label: 'negative' },
      ],
      config: { hiddenUnits: 8 },
    }, context);
    await handleToolCall('store_model_persistent', {
      model_id: 'versioned-model',
      version: '2.1.0',
    }, context);

    await handleToolCall('predict', {
      model_id: 'versioned-model',
      text: 'good',
      log_prediction: false,
    }, context);
    expect(predictionLogs).toHaveLength(0);

    await handleToolCall('predict', {
      model_id: 'versioned-model',
      text: 'good',
    }, context);

    expect(predictionLogs).toHaveLength(1);
    expect(predictionLogs[0]).toMatchObject({
      model_id: 'versioned-model',
      version: '2.1.0',
    });
  });

  it('generates features, summarizes models, and reports missing models', async () => {
    const modelId = 'test-management';
    await handleToolCall('train_classifier', {
      model_id: modelId,
      training_data: [
        { text: 'good', label: 'positive' },
        { text: 'bad', label: 'negative' },
      ],
      config: { hiddenUnits: 8 },
      description: 'management test',
    });

    const embedded = readJson(await handleToolCall('generate_embedding', {
      model_id: modelId,
      text: 'good',
    }));
    expect(embedded.embedding).toHaveLength(8);
    expect((embedded.embedding as number[]).every(Number.isFinite)).toBe(true);

    const summary = readJson(await handleToolCall('save_model', { model_id: modelId }));
    expect(summary).toMatchObject({
      model_id: modelId,
      metadata: { description: 'management test', trainingExamples: 2 },
      summary: { model_info: { has_weights: true, has_bias: true, has_beta: true } },
    });

    expect(readJson(await handleToolCall('delete_model', { model_id: modelId }))).toMatchObject({
      success: true,
    });
    const missing = await handleToolCall('save_model', { model_id: modelId });
    expect(missing.isError).toBe(true);
    expect(readJson(missing).error).toBe(`Model '${modelId}' not found`);
  });

  it('returns a structured error for unknown tools', async () => {
    const result = await handleToolCall('unknown_tool', {});

    expect(result.isError).toBe(true);
    expect(readJson(result)).toEqual({ error: 'Unknown tool: unknown_tool', tool: 'unknown_tool' });
  });
});
