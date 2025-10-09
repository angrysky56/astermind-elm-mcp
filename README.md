# AsterMind-ELM MCP Server

Fast, on-device machine learning capabilities for Claude through the Model Context Protocol.

## Overview

This MCP server brings the power of [AsterMind-ELM](https://github.com/infiniteCrank/AsterMind-ELM) to Claude, enabling:

- **Instant Training** - Train text classifiers in milliseconds
- **On-Device Processing** - All computation happens locally, no external APIs
- **Privacy-First** - Your data never leaves your machine
- **Microsecond Inference** - Real-time predictions
- **Multiple ML Capabilities** - Classification, embeddings, online learning

## Key Features

- 🚀 **Fast Training**: Extreme Learning Machines use closed-form solutions (no gradient descent)
- 🔒 **Private**: All processing happens on-device
- 📊 **Versatile**: Classification, regression, embeddings, online learning
- 💾 **Persistent**: Save and load models as JSON
- 🎯 **Simple**: Clean API with clear error handling

## Installation

1. Clone or navigate to this directory:
```bash
cd /astermind-elm-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Add to Claude Desktop configuration:

Edit your Claude Desktop config file (usually at `~/.config/Claude/claude_desktop_config.json` on Linux):

```json
{
  "mcpServers": {
    "astermind-elm": {
      "command": "node",
      "args": [
        "/your-path-to/astermind-elm-mcp/build/index.js"
      ]
    }
  }
}
```

5. Restart Claude Desktop

## Available Tools

### train_classifier
Train a text classification model using Extreme Learning Machine.

**Parameters:**
- `model_id` (string, required): Unique identifier for the model
- `training_data` (array, required): Array of `{text: string, label: string}` objects
- `config` (object, optional): Configuration options
  - `hiddenUnits` (number): Number of hidden units (default: 128)
  - `activation` (string): relu, leakyrelu, sigmoid, tanh, linear, gelu (default: relu)
  - `weightInit` (string): uniform, xavier, he (default: xavier)
  - `ridgeLambda` (number): Ridge regularization (default: 1e-6)
  - `maxLen` (number): Maximum sequence length (default: 30)
  - `dropout` (number): Dropout rate (default: 0)
- `description` (string, optional): Description of the model

**Example:**
```json
{
  "model_id": "sentiment_classifier",
  "training_data": [
    {"text": "I love this!", "label": "positive"},
    {"text": "This is terrible", "label": "negative"}
  ],
  "config": {
    "hiddenUnits": 256,
    "activation": "relu"
  }
}
```

### predict
Make predictions using a trained model.

**Parameters:**
- `model_id` (string, required): ID of the trained model
- `text` (string, required): Text to classify
- `top_k` (number, optional): Number of top predictions (default: 3)

### generate_embedding
Generate embedding vector from text.

**Parameters:**
- `model_id` (string, required): ID of the model
- `text` (string, required): Text to embed

### list_models
List all available models with metadata.

### delete_model
Delete a model from memory.

**Parameters:**
- `model_id` (string, required): ID of model to delete

### save_model
Export model to JSON format for persistence.

**Parameters:**
- `model_id` (string, required): ID of model to save

## Usage Examples

### Text Classification
```typescript
// Train a sentiment classifier
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

### Language Detection
```typescript
{
  "model_id": "language_detector",
  "training_data": [
    {"text": "Hello world", "label": "English"},
    {"text": "Bonjour le monde", "label": "French"},
    {"text": "Hola mundo", "label": "Spanish"},
    {"text": "Hallo Welt", "label": "German"}
  ]
}
```

## Architecture

```
astermind-elm-mcp/
├── src/
│   ├── index.ts           # Main MCP server
│   ├── model-manager.ts   # Model lifecycle management
│   └── types.ts           # TypeScript type definitions
├── build/                 # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Model Creation**: Models are created on-demand and stored in memory
2. **Training**: ELM uses closed-form solutions for instant training
3. **Inference**: Predictions are made in microseconds
4. **Persistence**: Models can be exported/imported as JSON

## Performance

- **Training Time**: Milliseconds for hundreds of examples
- **Inference Time**: Microseconds per prediction
- **Memory**: Minimal footprint, models stored efficiently in RAM
- **No GPU Required**: Runs on CPU with excellent performance

## Technical Details

### Extreme Learning Machines (ELM)
- Random hidden layer with fixed weights
- Closed-form output layer computation
- No iterative training (no gradient descent)
- Fast, efficient, and accurate

### Features
- Multiple activation functions (ReLU, LeakyReLU, Sigmoid, Tanh, Linear, GELU)
- Various weight initialization strategies (Uniform, Xavier, He)
- Ridge regularization for stability
- Dropout support
- Text encoding (character and token-based)

## Troubleshooting

### Server won't start
- Ensure dependencies are installed: `npm install`
- Build the TypeScript: `npm run build`
- Check Node.js version: Requires Node.js 18+

### Models not training
- Check training data format matches `{text: string, label: string}`
- Ensure at least 2 different labels in training data
- Verify model_id is unique

### Poor predictions
- Increase `hiddenUnits` (try 256 or 512)
- Add more training examples
- Try different `activation` functions
- Adjust `ridgeLambda` for regularization

## Development

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run watch
```

## License

MIT

## Credits

Built on [AsterMind-ELM](https://github.com/infiniteCrank/AsterMind-ELM) by infiniteCrank.
