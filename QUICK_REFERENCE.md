# AsterMind-ELM MCP Server - Quick Reference

## Installation (One-Time Setup)
```bash
cd /your-path-to/astermind-elm-mcp
npm install  # Dependencies already installed ✓
npm run build  # Already built ✓
```

## Claude Desktop Configuration
Add to `~/.config/Claude/claude_desktop_config.json`:
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
Then restart Claude Desktop.

## Quick Start Examples

### Train a Sentiment Classifier
```
"Train a sentiment classifier with these examples:
- 'I love this!' → positive
- 'This is great' → positive
- 'Terrible product' → negative
- 'Very disappointed' → negative"
```

### Make Predictions
```
"Using the sentiment classifier, classify: 'This is amazing!'"
```

### List Available Models
```
"Show me all ML models you have trained"
```

## Tool Summary

| Tool | Purpose | Speed |
|------|---------|-------|
| train_classifier | Train new model | Milliseconds |
| predict | Classify text | Microseconds |
| generate_embedding | Get vector | Microseconds |
| list_models | Show models | Instant |
| delete_model | Remove model | Instant |
| save_model | Export JSON | Instant |

## Configuration Presets

### Default (Recommended)
```json
{"hiddenUnits": 128, "activation": "relu"}
```

### High Accuracy
```json
{"hiddenUnits": 512, "activation": "gelu", "dropout": 0.1}
```

### Fast & Light
```json
{"hiddenUnits": 64, "activation": "relu"}
```

## Common Use Cases
- ✅ Sentiment analysis
- ✅ Language detection
- ✅ Intent classification
- ✅ Spam filtering
- ✅ Content categorization
- ✅ Semantic search

## Key Benefits
- ⚡ Instant training (milliseconds)
- 🔒 Complete privacy (on-device)
- 🎯 High accuracy
- 💾 Low memory usage
- 🚀 Real-time inference

## Status: ✅ READY TO USE

Everything is built and ready! Just add to Claude Desktop config and restart.
