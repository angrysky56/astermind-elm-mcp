/**
 * Type definitions for the persistence layer
 */

export interface DBConfig {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
}

export interface StoredModel {
  [key: string]: unknown;
  id?: string;
  model_id: string;
  version: string;
  config: object;
  weights: string; // Base64 encoded
  categories: string[];
  created_at: string | Date;
  trained_on?: string;
  tags: string[];
  metadata: Record<string, any>;
  status: 'active' | 'archived' | 'deprecated';
  description?: string;
}

export interface StoredDataset {
  [key: string]: unknown;
  id?: string;
  dataset_id: string;
  examples: Array<{ text: string; label: string }>;
  size: number;
  created_at: string | Date;
  metadata: Record<string, any>;
}

export interface PredictionLog {
  [key: string]: unknown;
  id?: string;
  model_id: string;
  version: string;
  input_text: string;
  predicted_label: string;
  confidence: number;
  ground_truth?: string;
  correct?: boolean;
  latency_ms: number;
  timestamp: string | Date;
  metadata: Record<string, any>;
}

export interface MetricRecord {
  [key: string]: unknown;
  id?: string;
  model_id: string;
  version: string;
  metric_name: string;
  metric_value: number;
  window_start: string | Date;
  window_end: string | Date;
  sample_count: number;
}

export interface EmbeddingRecord {
  [key: string]: unknown;
  id?: string;
  collection_name: string;
  item_id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string | Date;
}

export interface ModelMetrics {
  accuracy?: number;
  total_predictions: number;
  avg_confidence: number;
  avg_latency_ms: number;
  predictions_per_label: Record<string, number>;
}

export interface DriftAnalysis {
  drift_detected: boolean;
  drift_score: number;
  baseline_distribution: Record<string, number>;
  current_distribution: Record<string, number>;
}
