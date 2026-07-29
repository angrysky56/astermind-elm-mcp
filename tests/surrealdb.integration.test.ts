import { afterAll, describe, expect, it } from 'vitest';
import { SurrealDBClient } from '../src/persistence/surrealdb-client.js';

const databaseUrl = process.env.SURREALDB_TEST_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;
const runId = `${process.pid}-${Date.now()}`;
const modelId = `integration-model-${runId}`;
const datasetId = `integration-dataset-${runId}`;
const collectionName = `integration-vectors-${runId}`;

describeIntegration('SurrealDB integration', () => {
  const client = new SurrealDBClient({
    url: databaseUrl!,
    namespace: process.env.SURREALDB_TEST_NAMESPACE ?? 'astermind_test',
    database: process.env.SURREALDB_TEST_DATABASE ?? 'integration',
    username: process.env.SURREALDB_TEST_USERNAME ?? 'root',
    password: process.env.SURREALDB_TEST_PASSWORD ?? 'root',
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('round-trips models and datasets through the initialized schema', async () => {
    const modelResult = await client.storeModel({
      model_id: modelId,
      version: '1.0.0',
      config: { hiddenUnits: 8 },
      weights: Buffer.from('integration-weights'),
      categories: ['positive', 'negative'],
      tags: ['integration'],
      metadata: { source: 'test' },
      description: 'integration model',
    });
    expect(modelResult.success).toBe(true);
    expect(String(modelResult.record_id)).toContain('models:');

    await expect(client.loadModel(modelId, '1.0.0')).resolves.toMatchObject({
      config: { hiddenUnits: 8 },
      categories: ['positive', 'negative'],
      metadata: { source: 'test' },
      version: '1.0.0',
      description: 'integration model',
    });
    await expect(client.listModelVersions(modelId)).resolves.toHaveLength(1);

    await client.storeDataset({
      dataset_id: datasetId,
      examples: [
        { text: 'good', label: 'positive' },
        { text: 'bad', label: 'negative' },
      ],
      metadata: { source: 'test' },
    });
    await expect(client.loadDataset(datasetId)).resolves.toEqual({
      examples: [
        { text: 'good', label: 'positive' },
        { text: 'bad', label: 'negative' },
      ],
      size: 2,
      metadata: { source: 'test' },
    });
  });

  it('calculates monitoring results from real prediction records', async () => {
    await client.logPrediction({
      model_id: modelId,
      version: '1.0.0',
      input_text: 'good',
      predicted_label: 'positive',
      confidence: 0.9,
      ground_truth: 'positive',
      latency_ms: 2,
    });
    await client.logPrediction({
      model_id: modelId,
      version: '1.0.0',
      input_text: 'bad',
      predicted_label: 'positive',
      confidence: 0.6,
      ground_truth: 'negative',
      latency_ms: 4,
    });

    await expect(client.getModelMetrics(modelId)).resolves.toEqual({
      accuracy: 0.5,
      total_predictions: 2,
      avg_confidence: 0.75,
      avg_latency_ms: 3,
      predictions_per_label: { positive: 2 },
    });
    await expect(client.getConfusionMatrix(modelId)).resolves.toEqual({
      positive: { positive: 1 },
      negative: { positive: 1 },
    });

    const window = {
      start: new Date(Date.now() - 60_000),
      end: new Date(Date.now() + 60_000),
    };
    await expect(client.detectDrift({
      model_id: modelId,
      baseline_window: window,
      current_window: window,
    })).resolves.toMatchObject({
      status: 'ok',
      drift_detected: false,
      baseline_sample_count: 2,
      current_sample_count: 2,
    });
  });

  it('stores and searches vectors with SurrealDB cosine similarity', async () => {
    await client.storeEmbeddings({
      collection_name: collectionName,
      items: [
        { item_id: 'near', text: 'near', embedding: [1, 0], metadata: { rank: 1 } },
        { item_id: 'far', text: 'far', embedding: [0, 1], metadata: { rank: 2 } },
      ],
    });

    const results = await client.searchSimilar({
      collection_name: collectionName,
      query_embedding: [1, 0],
      top_k: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ item_id: 'near', similarity: 1 });
  });
});
