# AsterMind-ELM MCP Server

Fast, on-device machine learning with production-grade persistence through the Model Context Protocol.

## Overview

This MCP server brings the power of [AsterMind-ELM](https://github.com/infiniteCrank/AsterMind-ELM) to Claude with full persistence capabilities, enabling:

- **Instant Training** - Train text classifiers in milliseconds using Extreme Learning Machines
- **Production Persistence** - Models and datasets survive server restarts via SurrealDB
- **Performance Monitoring** - Track accuracy, drift, and prediction logs over time
- **On-Device Processing** - All computation happens locally, no external APIs
- **Privacy-First** - Your data never leaves your machine
- **Microsecond Inference** - Real-time predictions
- **Vector Storage** - Embedding storage with similarity search

## Key Features

- 🚀 **Fast Training**: Extreme Learning Machines use closed-form solutions (no gradient descent)
- 💾 **Production-Ready Persistence**: SurrealDB backend for models, datasets, and monitoring
- 📊 **Model Monitoring**: Track performance metrics, confusion matrices, and drift detection
- 🔒 **Private**: All processing happens on-device
- 🎯 **Versatile**: Classification, embeddings, online learning, similarity search
- 📈 **Reproducible**: Link models to datasets for full experiment tracking

## Installation

### 1. Install Dependencies

```bash
cd /path/to/astermind-elm-mcp
npm install
```

### 2. Set Up SurrealDB (Optional but Recommended)

Install SurrealDB:
```bash
# Linux
curl -sSf https://install.surrealdb.com | sh

# macOS
brew install surrealdb/tap/surreal

# Or download from https://surrealdb.com/install
```

Start SurrealDB:
```bash
surreal start --log trace --user root --pass root memory
```

Initialize the database schema:
```bash
npm run build
node build/scripts/init-db.js
```

### 3. Build the Server

```bash
npm run build
```

### 4. Configure Claude Desktop

Edit your Claude Desktop config file:
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the server configuration:

```json
{
  "mcpServers": {
    "astermind-elm": {
      "command": "node",
      "args": [
        "/full/path/to/astermind-elm-mcp/build/index.js"
      ],
      "env": {
        "ENABLE_PERSISTENCE": "true",
        "LOG_PREDICTIONS": "true",
        "SURREALDB_URL": "ws://127.0.0.1:8000/rpc",
        "SURREALDB_NAMESPACE": "astermind",
        "SURREALDB_DATABASE": "production",
        "SURREALDB_USERNAME": "root",
        "SURREALDB_PASSWORD": "root"
      }
    }
  }
}
```

### 5. Restart Claude Desktop

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PERSISTENCE` | `false` | Enable SurrealDB persistence |
| `LOG_PREDICTIONS` | `false` | Auto-log all predictions for monitoring |
| `SURREALDB_URL` | `ws://127.0.0.1:8000/rpc` | SurrealDB connection URL |
| `SURREALDB_NAMESPACE` | `astermind` | Database namespace |
| `SURREALDB_DATABASE` | `production` | Database name |
| `SURREALDB_USERNAME` | `root` | Database username |
| `SURREALDB_PASSWORD` | `root` | Database password |

## Available Tools

### Core Training & Inference

#### train_classifier
Train a text classification model using Extreme Learning Machine.

**Parameters:**
- `model_id` (string, required): Unique identifier for the model
- `training_data` (array, required): Array of `{text: string, label: string}` objects
- `config` (object, optional): Classifier configuration
  - `hiddenUnits` (number): Hidden layer size (default: 128)
  - `activation` (string): relu, leakyrelu, sigmoid, tanh, linear, gelu (default: relu)
  - `weightInit` (string): uniform, xavier, he (default: xavier)
  - `ridgeLambda` (number): Ridge regularization (default: 1e-6)
  - `maxLen` (number): Max sequence length (default: 30)
  - `dropout` (number): Dropout rate (default: 0)
- `description` (string, optional): Model description
- `persist` (boolean, optional): Save to database immediately
- `version` (string, optional): Version string (default: timestamp)
- `dataset_id` (string, optional): Link to stored dataset
- `tags` (array, optional): Tags for organization

**Example:**
```json
{
  "model_id": "sentiment_v1",
  "training_data": [
    {"text": "I love this!", "label": "positive"},
    {"text": "This is terrible", "label": "negative"}
  ],
  "persist": true,
  "version": "1.0.0",
  "tags": ["sentiment", "production"]
}
```

#### predict
Make predictions using a trained model.

**Parameters:**
- `model_id` (string, required): Model identifier
- `text` (string, required): Text to classify
- `top_k` (number, optional): Number of predictions (default: 3)
- `log_prediction` (boolean, optional): Log to database for monitoring
- `ground_truth` (string, optional): True label for accuracy tracking

#### generate_embedding
Generate embedding vector from text.

**Parameters:**
- `model_id` (string, required): Model to use
- `text` (string, required): Text to embed

#### list_models
List all models currently in memory.

#### delete_model
Remove a model from memory.

**Parameters:**
- `model_id` (string, required): Model to delete

#### save_model
Export model summary (in-memory models only).

**Parameters:**
- `model_id` (string, required): Model to export

### Persistence Tools

#### store_model_persistent
Save a trained model to SurrealDB. Model survives server restarts.

**Parameters:**
- `model_id` (string, required): Model in memory to persist
- `version` (string, required): Version string (e.g., "1.0.0")
- `dataset_id` (string, optional): Dataset used for training
- `tags` (array, optional): Organizational tags
- `description` (string, optional): Model description

**Example:**
```json
{
  "model_id": "sentiment_v1",
  "version": "1.0.0",
  "dataset_id": "reviews_2025",
  "tags": ["production", "sentiment"],
  "description": "Production sentiment classifier"
}
```

#### load_model_persistent
Load a model from SurrealDB into memory.

**Parameters:**
- `model_id` (string, required): Model to load
- `version` (string, optional): Specific version (defaults to latest)

#### list_model_versions
List all persisted versions of a model.

**Parameters:**
- `model_id` (string, required): Model to list versions for

#### store_training_dataset
Save training data to SurrealDB for reproducibility.

**Parameters:**
- `dataset_id` (string, required): Unique dataset identifier
- `training_data` (array, required): Array of `{text, label}` objects
- `metadata` (object, optional): Dataset metadata

**Example:**
```json
{
  "dataset_id": "reviews_2025",
  "training_data": [
    {"text": "Great product!", "label": "positive"},
    {"text": "Disappointed", "label": "negative"}
  ],
  "metadata": {
    "source": "customer_reviews",
    "date": "2025-01-15"
  }
}
```

#### load_training_dataset
Load a stored training dataset from SurrealDB.

**Parameters:**
- `dataset_id` (string, required): Dataset to load

### Monitoring Tools

#### get_model_metrics
Get performance metrics for a model over time.

**Parameters:**
- `model_id` (string, required): Model to analyze
- `time_range` (object, optional): Time window
  - `start` (string): ISO datetime
  - `end` (string): ISO datetime

**Returns:**
- `accuracy`: Overall accuracy (if ground truth provided)
- `total_predictions`: Number of predictions
- `avg_confidence`: Average confidence score
- `avg_latency_ms`: Average inference time
- `predictions_per_label`: Distribution by category

#### get_confusion_matrix
Get confusion matrix showing prediction accuracy by class.

**Parameters:**
- `model_id` (string, required): Model to analyze
- `time_range` (object, optional): Time window

**Returns:**
Confusion matrix with true labels vs predicted labels.

#### detect_drift
Detect if model performance has drifted over time.

**Parameters:**
- `model_id` (string, required): Model to analyze
- `baseline_window` (object, required): Baseline time period
  - `start` (string): ISO datetime
  - `end` (string): ISO datetime
- `current_window` (object, required): Current time period
  - `start` (string): ISO datetime
  - `end` (string): ISO datetime

**Returns:**
- `drift_detected`: Boolean indicating significant drift
- `drift_score`: KL divergence score
- `baseline_distribution`: Label distribution in baseline
- `current_distribution`: Label distribution currently

### Embedding Storage

#### store_embeddings
Store embeddings for similarity search.

**Parameters:**
- `collection_name` (string, required): Collection identifier
- `items` (array, required): Items with embeddings
  - `item_id` (string): Unique item ID
  - `text` (string): Original text
  - `embedding` (array): Vector embedding
  - `metadata` (object, optional): Additional data

#### search_similar
Search for similar items using cosine similarity.

**Parameters:**
- `collection_name` (string, required): Collection to search
- `query_embedding` (array, required): Query vector
- `top_k` (number, optional): Number of results (default: 5)

## Usage Examples

### Basic Text Classification

```json
// Train a model
{
  "model_id": "sentiment",
  "training_data": [
    {"text": "Great product!", "label": "positive"},
    {"text": "Works perfectly", "label": "positive"},
    {"text": "Waste of money", "label": "negative"},
    {"text": "Very disappointing", "label": "negative"}
  ]
}

// Make predictions
{
  "model_id": "sentiment",
  "text": "This is amazing!",
  "top_k": 2
}
```

### Production Workflow with Persistence

```json
// 1. Store your dataset
{
  "dataset_id": "production_reviews_v1",
  "training_data": [...],
  "metadata": {"source": "app", "date": "2025-01-15"}
}

// 2. Train and immediately persist
{
  "model_id": "sentiment_prod",
  "training_data": [...],
  "persist": true,
  "version": "1.0.0",
  "dataset_id": "production_reviews_v1",
  "tags": ["production"]
}

// 3. Later, after server restart
{
  "model_id": "sentiment_prod"
}
// Model loads automatically from database!

// 4. Make predictions with monitoring
{
  "model_id": "sentiment_prod",
  "text": "This is great!",
  "log_prediction": true,
  "ground_truth": "positive"
}

// 5. Check performance metrics
{
  "model_id": "sentiment_prod"
}
```

### Monitoring Model Performance

```json
// Get metrics over last week
{
  "model_id": "sentiment_prod",
  "time_range": {
    "start": "2025-01-08T00:00:00Z",
    "end": "2025-01-15T00:00:00Z"
  }
}

// Get confusion matrix
{
  "model_id": "sentiment_prod"
}

// Detect drift (compare this week vs last week)
{
  "model_id": "sentiment_prod",
  "baseline_window": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-08T00:00:00Z"
  },
  "current_window": {
    "start": "2025-01-08T00:00:00Z",
    "end": "2025-01-15T00:00:00Z"
  }
}
```

### Semantic Search with Embeddings

```json
// 1. Generate embeddings
{
  "model_id": "sentiment",
  "text": "Great customer service"
}

// 2. Store embeddings
{
  "collection_name": "reviews",
  "items": [
    {
      "item_id": "review_1",
      "text": "Great customer service",
      "embedding": [0.123, 0.456, ...],
      "metadata": {"rating": 5}
    }
  ]
}

// 3. Search similar
{
  "collection_name": "reviews",
  "query_embedding": [0.122, 0.458, ...],
  "top_k": 5
}
```

## Architecture

```
astermind-elm-mcp/
├── src/
│   ├── index.ts              # Main MCP server with all tools
│   ├── model-manager.ts      # Model lifecycle management
│   ├── types.ts              # TypeScript type definitions
│   ├── persistence/
│   │   ├── surrealdb-client.ts  # Database client
│   │   └── types.ts             # Persistence types
│   └── scripts/
│       └── init-db.ts        # Database schema initialization
├── build/                    # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

The server uses SurrealDB with the following tables:

- **models**: Model storage with versioning
- **datasets**: Training data management
- **predictions**: Prediction logging for monitoring
- **embeddings**: Vector storage for similarity search

Schema is automatically created by running:
```bash
node build/scripts/init-db.js
```

## Performance

- **Training Time**: Milliseconds for hundreds of examples
- **Inference Time**: Microseconds per prediction
- **Memory**: Efficient RAM usage
- **Storage**: SurrealDB persistence with ~1-5ms overhead
- **No GPU Required**: CPU-only, optimized performance

## Technical Details

### Extreme Learning Machines (ELM)
- Random hidden layer with fixed weights
- Closed-form output layer computation
- No iterative training (no gradient descent)
- Fast, efficient, and accurate

### Persistence Layer
- SurrealDB for production-grade storage
- Models survive server restarts
- Dataset versioning and lineage tracking
- Prediction logging for monitoring
- Drift detection with KL divergence

### Features
- Multiple activation functions (ReLU, LeakyReLU, Sigmoid, Tanh, Linear, GELU)
- Various weight initialization (Uniform, Xavier, He)
- Ridge regularization for stability
- Dropout support
- Character and token-based encoding

## Troubleshooting

### Server won't start
- Ensure dependencies: `npm install`
- Build TypeScript: `npm run build`
- Check Node.js version: Requires Node.js 18+

### SurrealDB connection issues
- Verify SurrealDB is running: `pgrep -f surreal`
- Check connection URL matches config
- Initialize schema: `node build/scripts/init-db.js`

### Models not persisting
- Ensure `ENABLE_PERSISTENCE=true` in environment
- Verify SurrealDB credentials
- Check database logs for errors

### Poor predictions
- Increase `hiddenUnits` (try 256 or 512)
- Add more training examples
- Try different `activation` functions
- Adjust `ridgeLambda` for regularization

### Dataset array issues
- Schema uses proper `.*` wildcard notation for nested fields
- Run `node build/scripts/init-db.js` to update schema
- Verify SurrealDB version (1.0.0+)

## Development

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run watch
```

### Initialize database schema
```bash
node build/scripts/init-db.js
```

## License

MIT

## Credits

Built on [AsterMind-ELM](https://github.com/infiniteCrank/AsterMind-ELM) by infiniteCrank.

## Related Documentation

- [Quick Start Guide](QUICK_START.md) - Get started in 5 minutes
- [Usage Guide](USAGE_GUIDE.md) - Detailed usage examples
- [Persistence Guide](PERSISTENCE_GUIDE.md) - Deep dive into persistence features
- [Quick Reference](QUICK_REFERENCE.md) - Command reference
