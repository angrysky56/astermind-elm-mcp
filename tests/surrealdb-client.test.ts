import { describe, expect, it } from 'vitest';
import {
  SurrealDBClient,
  type DatabaseAdapter,
} from '../src/persistence/surrealdb-client.js';
import type { DBConfig } from '../src/persistence/types.js';

const config: DBConfig = {
  url: 'ws://database.test/rpc',
  namespace: 'test',
  database: 'test',
  username: 'user',
  password: 'password',
};

class FakeDatabase implements DatabaseAdapter {
  connectCalls = 0;
  signinCalls = 0;
  useCalls = 0;
  closeCalls = 0;
  releaseConnect: () => void = () => undefined;
  blockConnect = false;
  failSignin = false;
  queryResults: unknown[] = [];
  createResults: unknown[][] = [];
  createCalls: Array<{ resource: string; data: Record<string, unknown> }> = [];
  queryCalls: Array<{ query: string; bindings?: Record<string, unknown> }> = [];
  insertCalls: Array<{ resource: string; data: Array<Record<string, unknown>> }> = [];

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.blockConnect) {
      await new Promise<void>((resolve) => {
        this.releaseConnect = resolve;
      });
    }
  }

  async signin(): Promise<void> {
    this.signinCalls += 1;
    if (this.failSignin) throw new Error('signin failed');
  }

  async use(): Promise<void> {
    this.useCalls += 1;
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
  }

  async create<T>(resource: string, data: Record<string, unknown>): Promise<T[]> {
    this.createCalls.push({ resource, data });
    return (this.createResults.shift() ?? []) as T[];
  }

  async query<T>(query: string, bindings?: Record<string, unknown>): Promise<T> {
    this.queryCalls.push({ query, bindings });
    return (this.queryResults.shift() ?? []) as T;
  }

  async insert<T>(resource: string, data: Array<Record<string, unknown>>): Promise<T[]> {
    this.insertCalls.push({ resource, data });
    return [];
  }
}

describe('SurrealDBClient connection lifecycle', () => {
  it('shares one in-flight connection across concurrent operations', async () => {
    const database = new FakeDatabase();
    database.blockConnect = true;
    const client = new SurrealDBClient(config, database);

    const first = client.connect();
    const second = client.connect();
    await Promise.resolve();

    expect(database.connectCalls).toBe(1);

    database.releaseConnect();
    await Promise.all([first, second]);
    expect(database.signinCalls).toBe(1);
    expect(database.useCalls).toBe(1);
  });

  it('closes partial connections and permits retry after setup failure', async () => {
    const database = new FakeDatabase();
    database.failSignin = true;
    const client = new SurrealDBClient(config, database);

    await expect(client.connect()).rejects.toThrow('signin failed');
    expect(database.closeCalls).toBe(1);

    database.failSignin = false;
    await expect(client.connect()).resolves.toBeUndefined();
    expect(database.connectCalls).toBe(2);
  });
});

describe('SurrealDBClient drift analysis', () => {
  it('reports insufficient data instead of a healthy result for empty windows', async () => {
    const database = new FakeDatabase();
    database.queryResults.push([[]], [[]]);
    const client = new SurrealDBClient(config, database);

    const result = await client.detectDrift({
      model_id: 'model',
      baseline_window: {
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-01T01:00:00Z'),
      },
      current_window: {
        start: new Date('2026-01-02T00:00:00Z'),
        end: new Date('2026-01-02T01:00:00Z'),
      },
    });

    expect(result).toEqual({
      status: 'insufficient_data',
      drift_detected: null,
      drift_score: null,
      baseline_sample_count: 0,
      current_sample_count: 0,
      baseline_distribution: {},
      current_distribution: {},
    });
  });

  it('calculates drift and sample counts when both windows contain data', async () => {
    const database = new FakeDatabase();
    database.queryResults.push(
      [[{ predicted_label: 'positive', count: 8 }, { predicted_label: 'negative', count: 2 }]],
      [[{ predicted_label: 'positive', count: 2 }, { predicted_label: 'negative', count: 8 }]],
    );
    const client = new SurrealDBClient(config, database);

    const result = await client.detectDrift({
      model_id: 'model',
      baseline_window: {
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-01T01:00:00Z'),
      },
      current_window: {
        start: new Date('2026-01-02T00:00:00Z'),
        end: new Date('2026-01-02T01:00:00Z'),
      },
    });

    expect(result).toMatchObject({
      status: 'ok',
      drift_detected: true,
      baseline_sample_count: 10,
      current_sample_count: 10,
      baseline_distribution: { positive: 0.8, negative: 0.2 },
      current_distribution: { positive: 0.2, negative: 0.8 },
    });
    expect(result.drift_score).toBeCloseTo(0.8317766, 6);
  });
});

describe('SurrealDBClient monitoring', () => {
  it('returns zeroed metrics when the database has no prediction rows', async () => {
    const database = new FakeDatabase();
    database.queryResults.push([[]], [], []);
    const client = new SurrealDBClient(config, database);

    await expect(client.getModelMetrics('empty-model')).resolves.toEqual({
      accuracy: undefined,
      total_predictions: 0,
      avg_confidence: 0,
      avg_latency_ms: 0,
      predictions_per_label: {},
    });
  });

  it('returns an empty confusion matrix when no labeled predictions exist', async () => {
    const database = new FakeDatabase();
    database.queryResults.push([]);
    const client = new SurrealDBClient(config, database);

    await expect(client.getConfusionMatrix('empty-model')).resolves.toEqual({});
  });

  it('calculates metrics and confusion matrices from prediction rows', async () => {
    const database = new FakeDatabase();
    database.queryResults.push(
      [[{ confidence: 0.8, latency_ms: 2 }, { confidence: 0.6, latency_ms: 4 }]],
      [[{ predicted_label: 'positive', count: 2 }]],
      [[{ total: 2, correct_count: 1 }]],
      [[
        { ground_truth: 'positive', predicted_label: 'positive', count: 1 },
        { ground_truth: 'negative', predicted_label: 'positive', count: 1 },
      ]],
    );
    const client = new SurrealDBClient(config, database);

    await expect(client.getModelMetrics('model')).resolves.toEqual({
      accuracy: 0.5,
      total_predictions: 2,
      avg_confidence: 0.7,
      avg_latency_ms: 3,
      predictions_per_label: { positive: 2 },
    });
    await expect(client.getConfusionMatrix('model')).resolves.toEqual({
      positive: { positive: 1 },
      negative: { positive: 1 },
    });
  });
});

describe('SurrealDBClient persistence operations', () => {
  it('stores and restores model bytes with version metadata', async () => {
    const database = new FakeDatabase();
    database.createResults.push([{ id: 'models:one' }]);
    database.queryResults.push([[
      {
        config: { hiddenUnits: 8 },
        weights: Buffer.from('weights').toString('base64'),
        categories: ['positive', 'negative'],
        metadata: { source: 'test' },
        version: '1.0.0',
        description: 'test model',
      },
    ]]);
    const client = new SurrealDBClient(config, database);

    await expect(client.storeModel({
      model_id: 'model',
      version: '1.0.0',
      config: { hiddenUnits: 8 },
      weights: Buffer.from('weights'),
      categories: ['positive', 'negative'],
    })).resolves.toEqual({ success: true, record_id: 'models:one' });
    expect(database.createCalls[0]).toMatchObject({
      resource: 'models',
      data: {
        model_id: 'model',
        version: '1.0.0',
        weights: Buffer.from('weights').toString('base64'),
      },
    });

    const restored = await client.loadModel('model', '1.0.0');
    expect(restored).toMatchObject({
      config: { hiddenUnits: 8 },
      categories: ['positive', 'negative'],
      metadata: { source: 'test' },
      version: '1.0.0',
      description: 'test model',
    });
    expect(restored?.weights.equals(Buffer.from('weights'))).toBe(true);
  });

  it('stores and restores datasets without lossy coercion', async () => {
    const database = new FakeDatabase();
    database.queryResults.push(
      [[{ id: 'datasets:one' }]],
      [[{
        examples: [{ text: 'good', label: 'positive' }],
        size: 1,
        metadata: { source: 'test' },
      }]],
    );
    const client = new SurrealDBClient(config, database);

    await expect(client.storeDataset({
      dataset_id: 'dataset',
      examples: [{ text: 'good', label: 'positive' }],
      metadata: { source: 'test' },
    })).resolves.toEqual({ success: true, record_id: 'datasets:one' });
    await expect(client.loadDataset('dataset')).resolves.toEqual({
      examples: [{ text: 'good', label: 'positive' }],
      size: 1,
      metadata: { source: 'test' },
    });
  });

  it('records prediction correctness and embedding operations', async () => {
    const database = new FakeDatabase();
    database.createResults.push([{ id: 'predictions:one' }]);
    database.queryResults.push([[
      { item_id: 'one', text: 'hello', similarity: 0.9, metadata: { kind: 'test' } },
    ]]);
    const client = new SurrealDBClient(config, database);

    await client.logPrediction({
      model_id: 'model',
      version: '1.0.0',
      input_text: 'good',
      predicted_label: 'positive',
      confidence: 0.8,
      ground_truth: 'positive',
      latency_ms: 2,
    });
    expect(database.createCalls[0]).toMatchObject({
      resource: 'predictions',
      data: { correct: true },
    });

    await expect(client.storeEmbeddings({
      collection_name: 'items',
      items: [{ item_id: 'one', text: 'hello', embedding: [0.1, 0.2] }],
    })).resolves.toEqual({ success: true, count: 1 });
    expect(database.insertCalls[0]).toMatchObject({
      resource: 'embeddings',
      data: [{ collection_name: 'items', item_id: 'one', embedding: [0.1, 0.2] }],
    });

    await expect(client.searchSimilar({
      collection_name: 'items',
      query_embedding: [0.1, 0.2],
      top_k: 1,
    })).resolves.toEqual([
      { item_id: 'one', text: 'hello', similarity: 0.9, metadata: { kind: 'test' } },
    ]);
  });
});
