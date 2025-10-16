#!/usr/bin/env node

/**
 * AsterMind-ELM MCP Server with Persistence
 * Provides fast, on-device machine learning capabilities through MCP
 * with SurrealDB persistence for production use
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { UniversalEncoder } from '@astermind/astermind-elm';
import { ModelManager } from './model-manager.js';
import { SurrealDBClient } from './persistence/surrealdb-client.js';
import type { DBConfig } from './persistence/types.js';
import type { 
  ClassifierConfig, 
  TrainingData, 
  PredictionResult 
} from './types.js';

// Initialize model manager
const modelManager = new ModelManager();

// Initialize persistence layer (optional - controlled by env var)
const ENABLE_PERSISTENCE = process.env.ENABLE_PERSISTENCE === 'true';
const LOG_PREDICTIONS = process.env.LOG_PREDICTIONS === 'true';

let dbClient: SurrealDBClient | null = null;

if (ENABLE_PERSISTENCE) {
  const dbConfig: DBConfig = {
    url: process.env.SURREALDB_URL || 'ws://127.0.0.1:8000/rpc',
    namespace: process.env.SURREALDB_NAMESPACE || 'astermind',
    database: process.env.SURREALDB_DATABASE || 'production',
    username: process.env.SURREALDB_USERNAME || 'root',
    password: process.env.SURREALDB_PASSWORD || 'root',
  };
  dbClient = new SurrealDBClient(dbConfig);
  console.error('✅ Persistence enabled with SurrealDB');
} else {
  console.error('ℹ️  Persistence disabled - using in-memory storage only');
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'train_classifier',
    description: 'Train a text classification model using Extreme Learning Machine. Optionally persist to database.',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'Unique identifier for the model'
        },
        training_data: {
          type: 'array',
          description: 'Array of training examples with text and label',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              label: { type: 'string' }
            },
            required: ['text', 'label']
          }
        },
        config: {
          type: 'object',
          description: 'Configuration for the classifier',
          properties: {
            hiddenUnits: { 
              type: 'number', 
              description: 'Number of hidden units (default: 128)' 
            },
            activation: { 
              type: 'string', 
              description: 'Activation function: relu, leakyrelu, sigmoid, tanh, linear, gelu (default: relu)' 
            },
            weightInit: { 
              type: 'string', 
              description: 'Weight initialization: uniform, xavier, he (default: xavier)' 
            },
            ridgeLambda: { 
              type: 'number', 
              description: 'Ridge regularization parameter (default: 1e-6)' 
            },
            maxLen: { 
              type: 'number', 
              description: 'Maximum sequence length (default: 30)' 
            },
            dropout: { 
              type: 'number', 
              description: 'Dropout rate (default: 0)' 
            }
          }
        },
        description: {
          type: 'string',
          description: 'Optional description of the model'
        },
        persist: {
          type: 'boolean',
          description: 'Whether to persist the model to database (requires ENABLE_PERSISTENCE=true)'
        },
        version: {
          type: 'string',
          description: 'Version string for the model (default: auto-generated timestamp)'
        },
        dataset_id: {
          type: 'string',
          description: 'Optional dataset ID to link this model to stored training data'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for organizing models'
        }
      },
      required: ['model_id', 'training_data']
    }
  },
  {
    name: 'predict',
    description: 'Make predictions using a trained classifier model',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the trained model to use'
        },
        text: {
          type: 'string',
          description: 'Text to classify'
        },
        top_k: {
          type: 'number',
          description: 'Number of top predictions to return (default: 3)'
        },
        log_prediction: {
          type: 'boolean',
          description: 'Whether to log this prediction to database for monitoring'
        },
        ground_truth: {
          type: 'string',
          description: 'Optional ground truth label for accuracy tracking'
        }
      },
      required: ['model_id', 'text']
    }
  },
  {
    name: 'generate_embedding',
    description: 'Generate embedding vector from text using a trained model',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model to use for embeddings'
        },
        text: {
          type: 'string',
          description: 'Text to embed'
        }
      },
      required: ['model_id', 'text']
    }
  },
  {
    name: 'list_models',
    description: 'List all available models in memory',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'delete_model',
    description: 'Delete a model from memory',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model to delete'
        }
      },
      required: ['model_id']
    }
  },
  {
    name: 'save_model',
    description: 'Export model summary (in-memory models only)',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model to save'
        }
      },
      required: ['model_id']
    }
  },
  // Phase 1: Core Persistence Tools
  {
    name: 'store_model_persistent',
    description: 'Save a trained model to SurrealDB for persistence across restarts. Model survives server restarts.',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model in memory to persist'
        },
        version: {
          type: 'string',
          description: 'Version string (e.g., "1.0.0", "2024-10-09")'
        },
        dataset_id: {
          type: 'string',
          description: 'Optional dataset ID this model was trained on'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags like ["production", "sentiment-analysis"]'
        },
        description: {
          type: 'string',
          description: 'Optional description of the model'
        }
      },
      required: ['model_id', 'version']
    }
  },
  {
    name: 'load_model_persistent',
    description: 'Load a model from SurrealDB into memory. Restores a previously saved model.',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model to load'
        },
        version: {
          type: 'string',
          description: 'Optional specific version to load (defaults to latest)'
        }
      },
      required: ['model_id']
    }
  },
  {
    name: 'list_model_versions',
    description: 'List all persisted versions of a model in SurrealDB',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model to list versions for'
        }
      },
      required: ['model_id']
    }
  },
  {
    name: 'store_training_dataset',
    description: 'Save training data to SurrealDB for reproducibility and future retraining',
    inputSchema: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'Unique identifier for the dataset'
        },
        training_data: {
          type: 'array',
          description: 'Array of training examples',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              label: { type: 'string' }
            },
            required: ['text', 'label']
          }
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata about the dataset (source, date, etc.)'
        }
      },
      required: ['dataset_id', 'training_data']
    }
  },
  {
    name: 'load_training_dataset',
    description: 'Load a stored training dataset from SurrealDB',
    inputSchema: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'ID of the dataset to load'
        }
      },
      required: ['dataset_id']
    }
  },
  // Phase 2: Monitoring Tools
  {
    name: 'get_model_metrics',
    description: 'Get performance metrics for a model over time',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model'
        },
        time_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start datetime (ISO format)' },
            end: { type: 'string', description: 'End datetime (ISO format)' }
          },
          description: 'Optional time range for metrics calculation'
        }
      },
      required: ['model_id']
    }
  },
  {
    name: 'get_confusion_matrix',
    description: 'Get confusion matrix for a model showing prediction accuracy by class',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model'
        },
        time_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start datetime (ISO format)' },
            end: { type: 'string', description: 'End datetime (ISO format)' }
          },
          description: 'Optional time range'
        }
      },
      required: ['model_id']
    }
  },
  {
    name: 'detect_drift',
    description: 'Detect if model performance has drifted by comparing prediction distributions',
    inputSchema: {
      type: 'object',
      properties: {
        model_id: {
          type: 'string',
          description: 'ID of the model'
        },
        baseline_window: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' }
          },
          required: ['start', 'end'],
          description: 'Baseline time window (ISO datetime)'
        },
        current_window: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' }
          },
          required: ['start', 'end'],
          description: 'Current time window (ISO datetime)'
        }
      },
      required: ['model_id', 'baseline_window', 'current_window']
    }
  },
  // Embedding storage and search
  {
    name: 'store_embeddings',
    description: 'Store embeddings for similarity search',
    inputSchema: {
      type: 'object',
      properties: {
        collection_name: {
          type: 'string',
          description: 'Name of the collection'
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item_id: { type: 'string' },
              text: { type: 'string' },
              embedding: { 
                type: 'array',
                items: { type: 'number' }
              },
              metadata: { type: 'object' }
            },
            required: ['item_id', 'text', 'embedding']
          }
        }
      },
      required: ['collection_name', 'items']
    }
  },
  {
    name: 'search_similar',
    description: 'Search for similar items using embedding similarity',
    inputSchema: {
      type: 'object',
      properties: {
        collection_name: {
          type: 'string',
          description: 'Name of the collection to search'
        },
        query_embedding: {
          type: 'array',
          items: { type: 'number' },
          description: 'Query embedding vector'
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return',
          default: 5
        }
      },
      required: ['collection_name', 'query_embedding']
    }
  }
];

// Initialize MCP server
const server = new Server(
  {
    name: 'astermind-elm-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'train_classifier': {
        const { 
          model_id, 
          training_data, 
          config, 
          description,
          persist = false,
          version,
          dataset_id,
          tags 
        } = args as {
          model_id: string;
          training_data: TrainingData[];
          config?: ClassifierConfig;
          description?: string;
          persist?: boolean;
          version?: string;
          dataset_id?: string;
          tags?: string[];
        };

        // Extract unique categories from training data
        const categories = Array.from(new Set(training_data.map(d => d.label)));
        
        // Create encoder explicitly for text-based classification
        const encoder = new UniversalEncoder({
          maxLen: config?.maxLen || 30,
          mode: 'char'  // Use character-based encoding
        });
        
        // Create classifier with configuration for TEXT mode
        const classifierConfig: ClassifierConfig = {
          categories,
          useTokenizer: true,  // Enable text mode
          encoder,  // Pass the encoder instance
          hiddenUnits: config?.hiddenUnits || 128,
          activation: config?.activation || 'relu',
          weightInit: config?.weightInit || 'xavier',
          ridgeLambda: config?.ridgeLambda || 1e-6,
          maxLen: config?.maxLen || 30,
          dropout: config?.dropout || 0
        };

        // Create and train model
        const elm = modelManager.createClassifier(model_id, classifierConfig, description);
        
        // Now encoder should be available
        const trainingTexts = training_data.map(d => d.text);
        const trainingLabels = training_data.map(d => d.label);
        
        // Encode training data
        const encodedX = trainingTexts.map(text => encoder.encode(text));
        const encodedY = trainingLabels.map(label => {
          const encoded = new Array(categories.length).fill(0);
          encoded[categories.indexOf(label)] = 1;
          return encoded;
        });
        
        elm.trainFromData(encodedX, encodedY);

        // Create a JSON-safe version of config (without encoder instance)
        const serializableConfig = {
          categories: classifierConfig.categories,
          useTokenizer: classifierConfig.useTokenizer,
          hiddenUnits: classifierConfig.hiddenUnits,
          activation: classifierConfig.activation,
          weightInit: classifierConfig.weightInit,
          ridgeLambda: classifierConfig.ridgeLambda,
          maxLen: classifierConfig.maxLen,
          dropout: classifierConfig.dropout
        };

        const result: any = {
          success: true,
          model_id,
          categories,
          training_examples: training_data.length,
          config: serializableConfig
        };

        // Persist if requested and enabled
        if (persist && dbClient && ENABLE_PERSISTENCE) {
          const modelVersion = version || new Date().toISOString();
          
          // Serialize the model with encoder configuration
          const weights = Buffer.from(JSON.stringify({
            W: elm.model?.W,
            b: elm.model?.b,
            beta: elm.model?.beta,
            charSet: elm.charSet,
            metrics: elm.metrics,
            // Add encoder configuration for reconstruction
            encoderConfig: {
              maxLen: classifierConfig.maxLen,
              mode: 'char',
              useTokenizer: classifierConfig.useTokenizer
            }
          }));

          await dbClient.storeModel({
            model_id,
            version: modelVersion,
            config: serializableConfig,
            weights,
            categories,
            trained_on: dataset_id,
            tags,
            description
          });

          result.persisted = true;
          result.version = modelVersion;
        } else if (persist && !ENABLE_PERSISTENCE) {
          result.warning = 'Persistence requested but ENABLE_PERSISTENCE is not set to true';
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'predict': {
        const { 
          model_id, 
          text, 
          top_k = 3,
          log_prediction = false,
          ground_truth 
        } = args as {
          model_id: string;
          text: string;
          top_k?: number;
          log_prediction?: boolean;
          ground_truth?: string;
        };

        const startTime = Date.now();
        const elm = modelManager.getModel(model_id);
        const results = elm.predict(text, top_k);
        const latency = Date.now() - startTime;
        
        // ELM returns {label, prob} - map to our format
        const predictions: PredictionResult[] = results.map((r: { label: string; prob: number }) => ({
          category: r.label,
          confidence: r.prob
        }));

        // Log prediction if requested
        if ((log_prediction || LOG_PREDICTIONS) && dbClient && ENABLE_PERSISTENCE) {
          await dbClient.logPrediction({
            model_id,
            version: 'in-memory',
            input_text: text,
            predicted_label: predictions[0].category,
            confidence: predictions[0].confidence,
            ground_truth,
            latency_ms: latency
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ 
                predictions,
                latency_ms: latency
              }, null, 2)
            }
          ]
        };
      }

      case 'generate_embedding': {
        const { model_id, text } = args as {
          model_id: string;
          text: string;
        };

        const elm = modelManager.getModel(model_id);
        
        // Get encoder and encode the text
        const encoder = elm.getEncoder();
        if (!encoder) {
          throw new Error('Model does not have an encoder configured');
        }
        
        const encoded = encoder.encode(text);
        // getEmbedding expects 2D array (matrix), so wrap in array
        const embedding = elm.getEmbedding([encoded]);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ embedding: embedding[0] }, null, 2)
            }
          ]
        };
      }

      case 'list_models': {
        const models = modelManager.listModels();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ models }, null, 2)
            }
          ]
        };
      }

      case 'delete_model': {
        const { model_id } = args as { model_id: string };
        
        const success = modelManager.deleteModel(model_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ 
                success, 
                message: success ? `Model '${model_id}' deleted from memory` : `Model '${model_id}' not found` 
              }, null, 2)
            }
          ]
        };
      }

      case 'save_model': {
        const { model_id } = args as { model_id: string };
        
        const elm = modelManager.getModel(model_id);
        const metadata = modelManager.getMetadata(model_id);
        
        // Return model summary (not full matrices which can be huge)
        const modelSummary = {
          config: {
            categories: elm.categories,
            hiddenUnits: elm.hiddenUnits,
            activation: elm.activation,
            maxLen: elm.maxLen,
            charSet: elm.charSet,
            useTokenizer: elm.useTokenizer,
            dropout: elm.dropout,
            ridgeLambda: elm.ridgeLambda
          },
          metrics: elm.metrics,
          model_info: {
            has_weights: elm.model?.W ? true : false,
            weight_dimensions: elm.model?.W ? `${elm.model.W.length}x${elm.model.W[0]?.length}` : null,
            has_bias: elm.model?.b ? true : false,
            has_beta: elm.model?.beta ? true : false
          }
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ 
                model_id,
                metadata,
                summary: modelSummary,
                note: "Use store_model_persistent to save to database for persistence"
              }, null, 2)
            }
          ]
        };
      }

      // Phase 1: Persistence Tools
      case 'store_model_persistent': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { model_id, version, dataset_id, tags, description } = args as {
          model_id: string;
          version: string;
          dataset_id?: string;
          tags?: string[];
          description?: string;
        };

        const elm = modelManager.getModel(model_id);
        const metadata = modelManager.getMetadata(model_id);
        
        // Serialize model weights
        const weights = Buffer.from(JSON.stringify({
          W: elm.model?.W,
          b: elm.model?.b,
          beta: elm.model?.beta,
          charSet: elm.charSet,
          metrics: elm.metrics
        }));

        const config = {
          categories: elm.categories,
          hiddenUnits: elm.hiddenUnits,
          activation: elm.activation,
          maxLen: elm.maxLen,
          useTokenizer: elm.useTokenizer,
          dropout: elm.dropout,
          ridgeLambda: elm.ridgeLambda
        };

        const result = await dbClient.storeModel({
          model_id,
          version,
          config,
          weights,
          categories: elm.categories,
          trained_on: dataset_id,
          tags,
          description: description || metadata.description
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                model_id,
                version,
                record_id: result.record_id,
                message: 'Model persisted to SurrealDB'
              }, null, 2)
            }
          ]
        };
      }

      case 'load_model_persistent': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { model_id, version } = args as {
          model_id: string;
          version?: string;
        };

        const stored = await dbClient.loadModel(model_id, version);
        if (!stored) {
          throw new Error(`Model '${model_id}'${version ? ` version '${version}'` : ''} not found in database`);
        }

        // Deserialize weights
        const weights = JSON.parse(stored.weights.toString());
        
        // Reconstruct encoder from saved configuration
        const encoderConfig = weights.encoderConfig || {
          maxLen: (stored.config as any).maxLen || 30,
          mode: 'char',
          useTokenizer: (stored.config as any).useTokenizer !== false
        };
        
        const encoder = new UniversalEncoder({
          maxLen: encoderConfig.maxLen,
          mode: encoderConfig.mode as 'char' | 'token'
        });

        // Reconstruct classifier config
        const classifierConfig: ClassifierConfig = {
          ...stored.config as any,
          encoder,
          categories: stored.categories
        };

        // Create model in memory
        const elm = modelManager.createClassifier(model_id, classifierConfig, stored.description);
        
        // Restore weights
        elm.model = {
          W: weights.W,
          b: weights.b,
          beta: weights.beta
        };
        elm.charSet = weights.charSet;
        elm.metrics = weights.metrics;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                model_id,
                version: stored.version,
                categories: stored.categories,
                message: 'Model loaded from SurrealDB into memory'
              }, null, 2)
            }
          ]
        };
      }

      case 'list_model_versions': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { model_id } = args as { model_id: string };

        const versions = await dbClient.listModelVersions(model_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                model_id,
                versions,
                total_versions: versions.length
              }, null, 2)
            }
          ]
        };
      }

      case 'store_training_dataset': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { dataset_id, training_data, metadata } = args as {
          dataset_id: string;
          training_data: TrainingData[];
          metadata?: Record<string, any>;
        };

        const result = await dbClient.storeDataset({
          dataset_id,
          examples: training_data,
          metadata
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                dataset_id,
                examples: training_data.length,
                record_id: result.record_id,
                message: 'Dataset stored in SurrealDB'
              }, null, 2)
            }
          ]
        };
      }

      case 'load_training_dataset': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { dataset_id } = args as { dataset_id: string };

        const dataset = await dbClient.loadDataset(dataset_id);
        if (!dataset) {
          throw new Error(`Dataset '${dataset_id}' not found in database`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                dataset_id,
                examples: dataset.examples,
                size: dataset.size,
                metadata: dataset.metadata
              }, null, 2)
            }
          ]
        };
      }

      // Phase 2: Monitoring Tools
      case 'get_model_metrics': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { model_id, time_range } = args as {
          model_id: string;
          time_range?: { start: string; end: string };
        };

        const range = time_range ? {
          start: new Date(time_range.start),
          end: new Date(time_range.end)
        } : undefined;

        const metrics = await dbClient.getModelMetrics(model_id, range);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                model_id,
                time_range,
                metrics
              }, null, 2)
            }
          ]
        };
      }

      case 'get_confusion_matrix': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { model_id, time_range } = args as {
          model_id: string;
          time_range?: { start: string; end: string };
        };

        const range = time_range ? {
          start: new Date(time_range.start),
          end: new Date(time_range.end)
        } : undefined;

        const matrix = await dbClient.getConfusionMatrix(model_id, range);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                model_id,
                confusion_matrix: matrix
              }, null, 2)
            }
          ]
        };
      }

      case 'detect_drift': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { model_id, baseline_window, current_window } = args as {
          model_id: string;
          baseline_window: { start: string; end: string };
          current_window: { start: string; end: string };
        };

        const analysis = await dbClient.detectDrift({
          model_id,
          baseline_window: {
            start: new Date(baseline_window.start),
            end: new Date(baseline_window.end)
          },
          current_window: {
            start: new Date(current_window.start),
            end: new Date(current_window.end)
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                model_id,
                drift_analysis: analysis
              }, null, 2)
            }
          ]
        };
      }

      case 'store_embeddings': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { collection_name, items } = args as {
          collection_name: string;
          items: Array<{
            item_id: string;
            text: string;
            embedding: number[];
            metadata?: Record<string, any>;
          }>;
        };

        const result = await dbClient.storeEmbeddings({
          collection_name,
          items
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                collection_name,
                stored_count: result.count
              }, null, 2)
            }
          ]
        };
      }

      case 'search_similar': {
        if (!dbClient || !ENABLE_PERSISTENCE) {
          throw new Error('Persistence is not enabled. Set ENABLE_PERSISTENCE=true');
        }

        const { collection_name, query_embedding, top_k = 5 } = args as {
          collection_name: string;
          query_embedding: number[];
          top_k?: number;
        };

        const results = await dbClient.searchSimilar({
          collection_name,
          query_embedding,
          top_k
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                collection_name,
                results,
                total_results: results.length
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error in tool ${name}:`, errorMessage);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            error: errorMessage,
            tool: name 
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Cleanup on shutdown
async function cleanup() {
  console.error('Shutting down AsterMind-ELM MCP server...');
  if (dbClient) {
    await dbClient.disconnect();
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Main execution
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (MCP requirement)
  console.error('🚀 AsterMind-ELM MCP server running on stdio');
  console.error(`📊 Tools available: ${TOOLS.length}`);
  console.error(`💾 Persistence: ${ENABLE_PERSISTENCE ? 'ENABLED' : 'DISABLED'}`);
  console.error(`📝 Prediction logging: ${LOG_PREDICTIONS ? 'ENABLED' : 'DISABLED'}`);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
