#!/usr/bin/env node

/**
 * AsterMind-ELM MCP Server
 * Provides fast, on-device machine learning capabilities through MCP
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
import type { 
  ClassifierConfig, 
  TrainingData, 
  PredictionResult 
} from './types.js';

// Initialize model manager
const modelManager = new ModelManager();

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'train_classifier',
    description: 'Train a text classification model using Extreme Learning Machine. Trains in milliseconds with on-device processing.',
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
    description: 'List all available models with their metadata',
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
    description: 'Export model to JSON format',
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
        const { model_id, training_data, config, description } = args as {
          model_id: string;
          training_data: TrainingData[];
          config?: ClassifierConfig;
          description?: string;
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

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                model_id,
                categories,
                training_examples: training_data.length,
                config: classifierConfig
              }, null, 2)
            }
          ]
        };
      }

      case 'predict': {
        const { model_id, text, top_k = 3 } = args as {
          model_id: string;
          text: string;
          top_k?: number;
        };

        const elm = modelManager.getModel(model_id);
        const results = elm.predict(text, top_k);
        
        // ELM returns {label, prob} - map to our format
        const predictions: PredictionResult[] = results.map((r: { label: string; prob: number }) => ({
          category: r.label,
          confidence: r.prob
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ predictions }, null, 2)
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
                message: success ? `Model '${model_id}' deleted` : `Model '${model_id}' not found` 
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
                note: "Model is stored in memory. Full weight matrices are too large to export via MCP."
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

// Main execution
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (MCP requirement)
  console.error('AsterMind-ELM MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
