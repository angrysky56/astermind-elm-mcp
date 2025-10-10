/**
 * SurrealDB Client for AsterMind-ELM Persistence
 * Complete client with all persistence, monitoring, and embedding operations
 */

import { Surreal } from 'surrealdb';
import type {
  DBConfig,
  StoredModel,
  StoredDataset,
  PredictionLog,
  ModelMetrics,
  DriftAnalysis,
  EmbeddingRecord,
} from './types.js';

export class SurrealDBClient {
  private db: Surreal;
  private connected: boolean = false;

  constructor(private config: DBConfig) {
    this.db = new Surreal();
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await this.db.connect(this.config.url);
    await this.db.signin({
      username: this.config.username,
      password: this.config.password,
    });
    await this.db.use({
      namespace: this.config.namespace,
      database: this.config.database,
    });

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.db.close();
      this.connected = false;
    }
  }

  // Model Storage Operations

  async storeModel(params: {
    model_id: string;
    version: string;
    config: object;
    weights: Buffer;
    categories: string[];
    trained_on?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    description?: string;
  }): Promise<{ success: boolean; record_id: string }> {
    await this.connect();

    const result = await this.db.create<StoredModel>('models', {
      model_id: params.model_id,
      version: params.version,
      config: params.config,
      weights: params.weights.toString('base64'),
      categories: params.categories,
      created_at: new Date().toISOString(),
      trained_on: params.trained_on,
      tags: params.tags || [],
      metadata: params.metadata || {},
      status: 'active',
      description: params.description,
    });

    return { success: true, record_id: result[0].id! };
  }

  async loadModel(model_id: string, version?: string): Promise<{
    config: object;
    weights: Buffer;
    categories: string[];
    metadata: Record<string, any>;
    version: string;
    description?: string;
  } | null> {
    await this.connect();

    const params: Record<string, any> = { model_id };
    let query: string;

    if (version) {
      query = `SELECT * FROM models WHERE model_id = $model_id AND version = $version AND status = 'active' LIMIT 1`;
      params.version = version;
    } else {
      query = `SELECT * FROM models WHERE model_id = $model_id AND status = 'active' ORDER BY created_at DESC LIMIT 1`;
    }

    const result = await this.db.query<StoredModel[][]>(query, params);

    if (!result || result.length === 0 || result[0].length === 0) return null;

    const model = result[0][0];
    return {
      config: model.config,
      weights: Buffer.from(model.weights, 'base64'),
      categories: model.categories,
      metadata: model.metadata,
      version: model.version,
      description: model.description,
    };
  }

  async listModelVersions(model_id: string): Promise<Array<{
    version: string;
    created_at: string;
    categories: string[];
    metadata: Record<string, any>;
    status: string;
    description?: string;
  }>> {
    await this.connect();

    const query = `SELECT version, created_at, categories, metadata, status, description FROM models WHERE model_id = $model_id AND status = 'active' ORDER BY created_at DESC`;
    const result = await this.db.query<any[][]>(query, { model_id });
    return result[0] || [];
  }

  // Dataset Operations

  async storeDataset(params: {
    dataset_id: string;
    examples: Array<{ text: string; label: string }>;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; record_id: string }> {
    await this.connect();

    const result = await this.db.create<StoredDataset>('datasets', {
      dataset_id: params.dataset_id,
      examples: params.examples,
      size: params.examples.length,
      created_at: new Date().toISOString(),
      metadata: params.metadata || {},
    });

    return { success: true, record_id: result[0].id! };
  }

  async loadDataset(dataset_id: string): Promise<{
    examples: Array<{ text: string; label: string }>;
    size: number;
    metadata: Record<string, any>;
  } | null> {
    await this.connect();

    const query = `SELECT examples, size, metadata FROM datasets WHERE dataset_id = $dataset_id LIMIT 1`;
    const result = await this.db.query<StoredDataset[][]>(query, { dataset_id });

    if (!result || result.length === 0 || result[0].length === 0) return null;

    const dataset = result[0][0];
    return {
      examples: dataset.examples,
      size: dataset.size,
      metadata: dataset.metadata,
    };
  }

  // Prediction Logging

  async logPrediction(params: {
    model_id: string;
    version: string;
    input_text: string;
    predicted_label: string;
    confidence: number;
    ground_truth?: string;
    latency_ms: number;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean }> {
    await this.connect();

    const correct = params.ground_truth !== undefined ? params.predicted_label === params.ground_truth : undefined;

    await this.db.create<PredictionLog>('predictions', {
      model_id: params.model_id,
      version: params.version,
      input_text: params.input_text,
      predicted_label: params.predicted_label,
      confidence: params.confidence,
      ground_truth: params.ground_truth,
      correct,
      latency_ms: params.latency_ms,
      timestamp: new Date().toISOString(),
      metadata: params.metadata || {},
    });

    return { success: true };
  }

  // Performance Metrics

  async getModelMetrics(model_id: string, timeRange?: { start: Date; end: Date }): Promise<ModelMetrics> {
    await this.connect();

    let whereClause = 'WHERE model_id = $model_id';
    const params: Record<string, any> = { model_id };

    if (timeRange) {
      whereClause += ' AND timestamp >= $start AND timestamp <= $end';
      params.start = timeRange.start.toISOString();
      params.end = timeRange.end.toISOString();
    }

    const statsQuery = `SELECT count() as total, math::mean(confidence) as avg_confidence, math::mean(latency_ms) as avg_latency FROM predictions ${whereClause}`;
    const statsResult = await this.db.query<any[][]>(statsQuery, params);
    const stats = statsResult[0][0];

    const labelsQuery = `SELECT predicted_label, count() as count FROM predictions ${whereClause} GROUP BY predicted_label`;
    const labelsResult = await this.db.query<any[][]>(labelsQuery, params);
    const predictions_per_label: Record<string, number> = {};
    for (const row of labelsResult[0]) {
      predictions_per_label[row.predicted_label] = row.count;
    }

    const accuracyQuery = `SELECT count() as total, array::len(array::filter(correct, fn($v) { return $v == true; })) as correct_count FROM predictions ${whereClause} AND correct != NONE`;
    const accuracyResult = await this.db.query<any[][]>(accuracyQuery, params);
    const accuracyStats = accuracyResult[0][0];

    const accuracy = accuracyStats && accuracyStats.total > 0 ? accuracyStats.correct_count / accuracyStats.total : undefined;

    return {
      accuracy,
      total_predictions: stats.total || 0,
      avg_confidence: stats.avg_confidence || 0,
      avg_latency_ms: stats.avg_latency || 0,
      predictions_per_label,
    };
  }

  async getConfusionMatrix(model_id: string, timeRange?: { start: Date; end: Date }): Promise<Record<string, Record<string, number>>> {
    await this.connect();

    let whereClause = 'WHERE model_id = $model_id AND ground_truth != NONE';
    const params: Record<string, any> = { model_id };

    if (timeRange) {
      whereClause += ' AND timestamp >= $start AND timestamp <= $end';
      params.start = timeRange.start.toISOString();
      params.end = timeRange.end.toISOString();
    }

    const query = `SELECT predicted_label, ground_truth, count() as count FROM predictions ${whereClause} GROUP BY predicted_label, ground_truth`;
    const result = await this.db.query<any[][]>(query, params);

    const matrix: Record<string, Record<string, number>> = {};
    for (const row of result[0]) {
      if (!matrix[row.ground_truth]) matrix[row.ground_truth] = {};
      matrix[row.ground_truth][row.predicted_label] = row.count;
    }

    return matrix;
  }

  // Drift Detection

  async detectDrift(params: {
    model_id: string;
    baseline_window: { start: Date; end: Date };
    current_window: { start: Date; end: Date };
  }): Promise<DriftAnalysis> {
    await this.connect();

    const baselineQuery = `SELECT predicted_label, count() as count FROM predictions WHERE model_id = $model_id AND timestamp >= $baseline_start AND timestamp <= $baseline_end GROUP BY predicted_label`;
    const baselineResult = await this.db.query<any[][]>(baselineQuery, {
      model_id: params.model_id,
      baseline_start: params.baseline_window.start.toISOString(),
      baseline_end: params.baseline_window.end.toISOString(),
    });

    const currentQuery = `SELECT predicted_label, count() as count FROM predictions WHERE model_id = $model_id AND timestamp >= $current_start AND timestamp <= $current_end GROUP BY predicted_label`;
    const currentResult = await this.db.query<any[][]>(currentQuery, {
      model_id: params.model_id,
      current_start: params.current_window.start.toISOString(),
      current_end: params.current_window.end.toISOString(),
    });

    const baselineTotal = baselineResult[0].reduce((sum: number, row: any) => sum + row.count, 0);
    const currentTotal = currentResult[0].reduce((sum: number, row: any) => sum + row.count, 0);

    const baselineDist: Record<string, number> = {};
    for (const row of baselineResult[0]) {
      baselineDist[row.predicted_label] = row.count / baselineTotal;
    }

    const currentDist: Record<string, number> = {};
    for (const row of currentResult[0]) {
      currentDist[row.predicted_label] = row.count / currentTotal;
    }

    let driftScore = 0;
    const allLabels = new Set([...Object.keys(baselineDist), ...Object.keys(currentDist)]);

    for (const label of allLabels) {
      const p = baselineDist[label] || 0.001;
      const q = currentDist[label] || 0.001;
      driftScore += p * Math.log(p / q);
    }

    return {
      drift_detected: driftScore > 0.1,
      drift_score: driftScore,
      baseline_distribution: baselineDist,
      current_distribution: currentDist,
    };
  }

  // Embedding Operations

  async storeEmbeddings(params: {
    collection_name: string;
    items: Array<{
      item_id: string;
      text: string;
      embedding: number[];
      metadata?: Record<string, any>;
    }>;
  }): Promise<{ success: boolean; count: number }> {
    await this.connect();

    const records = params.items.map((item) => ({
      collection_name: params.collection_name,
      item_id: item.item_id,
      text: item.text,
      embedding: item.embedding,
      metadata: item.metadata || {},
      created_at: new Date().toISOString(),
    }));

    await this.db.insert<EmbeddingRecord>('embeddings', records);
    return { success: true, count: records.length };
  }

  async searchSimilar(params: {
    collection_name: string;
    query_embedding: number[];
    top_k: number;
  }): Promise<Array<{
    item_id: string;
    text: string;
    similarity: number;
    metadata: Record<string, any>;
  }>> {
    await this.connect();

    const query = `SELECT item_id, text, metadata, vector::similarity::cosine(embedding, $query_embedding) AS similarity FROM embeddings WHERE collection_name = $collection_name ORDER BY similarity DESC LIMIT $top_k`;

    const result = await this.db.query<any[][]>(query, {
      collection_name: params.collection_name,
      query_embedding: params.query_embedding,
      top_k: params.top_k,
    });

    return result[0] || [];
  }
}
