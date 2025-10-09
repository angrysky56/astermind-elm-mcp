/**
 * Type definitions for AsterMind ELM MCP Server
 */

/**
 * Model types supported by the server
 */
export type ModelType = 'classifier' | 'online' | 'kernel' | 'deep' | 'embedding';

/**
 * Activation functions available for ELM models
 */
export type ActivationType = 'relu' | 'leakyrelu' | 'sigmoid' | 'tanh' | 'linear' | 'gelu';

/**
 * Weight initialization strategies
 */
export type WeightInit = 'uniform' | 'xavier' | 'he';

/**
 * Model metadata stored in the model manager
 */
export interface ModelMetadata {
  id: string;
  type: ModelType;
  created: Date;
  lastUsed: Date;
  trainingExamples?: number;
  categories?: string[];
  description?: string;
}

/**
 * Configuration for training a text classifier
 */
export interface ClassifierConfig {
  categories: string[];
  useTokenizer?: boolean;  // Enable text encoding (required for text classification)
  encoder?: any;  // Optional prebuilt encoder instance (from UniversalEncoder)
  hiddenUnits?: number;
  activation?: ActivationType;
  weightInit?: WeightInit;
  ridgeLambda?: number;
  maxLen?: number;
  dropout?: number;
  charSet?: string;  // Character set for encoding
  tokenizerDelimiter?: RegExp;  // Delimiter for tokenization
}

/**
 * Configuration for online learning models
 */
export interface OnlineConfig {
  inputDim: number;
  outputDim: number;
  hiddenUnits?: number;
  activation?: ActivationType;
  ridgeLambda?: number;
  forgettingFactor?: number;
}

/**
 * Training data format
 */
export interface TrainingData {
  text: string;
  label: string;
}

/**
 * Prediction result
 */
export interface PredictionResult {
  category: string;
  confidence: number;
}

/**
 * Similarity search result
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  capacity?: number;
  normalize?: boolean;
}
