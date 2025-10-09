# AsterMind-ELM MCP Server - Usage Guide

## Quick Start Examples

### Example 1: Simple Sentiment Classifier

Train a basic sentiment classifier in seconds:

```plaintext
Use the train_classifier tool:
- model_id: "my_sentiment"
- training_data: [
    {"text": "I love this product!", "label": "positive"},
    {"text": "This is amazing", "label": "positive"},
    {"text": "Best purchase ever", "label": "positive"},
    {"text": "Terrible quality", "label": "negative"},
    {"text": "Waste of money", "label": "negative"},
    {"text": "Very disappointed", "label": "negative"}
  ]
```

Then predict:
```plaintext
Use the predict tool:
- model_id: "my_sentiment"
- text: "This is awesome!"
- top_k: 2
```

### Example 2: Language Detector

Create a multi-language classifier:

```plaintext
Use the train_classifier tool:
- model_id: "language_detector"
- training_data: [
    {"text": "Hello world", "label": "English"},
    {"text": "How are you today", "label": "English"},
    {"text": "Good morning everyone", "label": "English"},
    {"text": "Bonjour le monde", "label": "French"},
    {"text": "Comment allez-vous", "label": "French"},
    {"text": "Bonne journée", "label": "French"},
    {"text": "Hola mundo", "label": "Spanish"},
    {"text": "¿Cómo estás?", "label": "Spanish"},
    {"text": "Buenos días", "label": "Spanish"},
    {"text": "Hallo Welt", "label": "German"},
    {"text": "Wie geht es dir", "label": "German"},
    {"text": "Guten Tag", "label": "German"}
  ]
```

### Example 3: Intent Classification

Build a chatbot intent classifier:

```plaintext
Use the train_classifier tool:
- model_id: "intent_classifier"
- training_data: [
    {"text": "What's the weather like", "label": "weather"},
    {"text": "Will it rain today", "label": "weather"},
    {"text": "Is it sunny outside", "label": "weather"},
    {"text": "Book a flight to Paris", "label": "booking"},
    {"text": "Reserve a hotel room", "label": "booking"},
    {"text": "Buy tickets for the concert", "label": "booking"},
    {"text": "What time is it", "label": "time"},
    {"text": "Current time please", "label": "time"},
    {"text": "Show me the clock", "label": "time"}
  ]
- config: {
    "hiddenUnits": 256,
    "activation": "relu"
  }
```

### Example 4: Custom Category Classification

Advanced configuration with more parameters:

```plaintext
Use the train_classifier tool:
- model_id: "product_categories"
- training_data: [
    {"text": "laptop computer with 16GB RAM", "label": "electronics"},
    {"text": "smartphone with 5G capability", "label": "electronics"},
    {"text": "cotton t-shirt size large", "label": "clothing"},
    {"text": "running shoes size 10", "label": "clothing"},
    {"text": "mystery thriller novel", "label": "books"},
    {"text": "science fiction paperback", "label": "books"}
  ]
- config: {
    "hiddenUnits": 512,
    "activation": "gelu",
    "weightInit": "he",
    "ridgeLambda": 0.0001,
    "dropout": 0.1
  }
- description: "Product category classifier for e-commerce"
```

## Advanced Features

### Generating Embeddings

Extract vector representations of text:

```plaintext
Use the generate_embedding tool:
- model_id: "my_sentiment"
- text: "This is a test sentence"
```

Returns a numerical vector that can be used for:
- Semantic similarity search
- Clustering
- Visualization
- Feature extraction

### Model Management

List all trained models:
```plaintext
Use the list_models tool
```

Save a model for later use:
```plaintext
Use the save_model tool:
- model_id: "my_sentiment"
```

Delete a model from memory:
```plaintext
Use the delete_model tool:
- model_id: "old_model"
```

## Configuration Parameters Explained

### hiddenUnits
- **What it does**: Controls the capacity of the model
- **Default**: 128
- **Range**: 50-1024 (higher = more capacity but more memory)
- **Recommendation**: Start with 128, increase to 256-512 for complex tasks

### activation
- **What it does**: Non-linear transformation function
- **Options**: relu, leakyrelu, sigmoid, tanh, linear, gelu
- **Default**: relu
- **Recommendation**: 
  - relu: Fast, works well for most tasks
  - gelu: Better for complex patterns
  - sigmoid/tanh: Good for bounded outputs

### weightInit
- **What it does**: How initial random weights are set
- **Options**: uniform, xavier, he
- **Default**: xavier
- **Recommendation**:
  - xavier: Good default for sigmoid/tanh
  - he: Better for relu/leakyrelu
  - uniform: Simple but less effective

### ridgeLambda
- **What it does**: Regularization to prevent overfitting
- **Default**: 1e-6
- **Range**: 1e-8 to 0.1
- **Recommendation**: 
  - Small dataset: Increase to 0.001-0.01
  - Large dataset: Keep at 1e-6
  - Overfitting: Increase value

### maxLen
- **What it does**: Maximum text sequence length
- **Default**: 30
- **Range**: 10-200
- **Recommendation**: 
  - Short texts (tweets): 30-50
  - Medium texts (reviews): 100-150
  - Long texts (documents): 200+

### dropout
- **What it does**: Randomly drops neurons during training
- **Default**: 0
- **Range**: 0.0-0.5
- **Recommendation**:
  - No overfitting: Keep at 0
  - Overfitting: Try 0.1-0.2
  - Heavy overfitting: Try 0.3-0.5

## Performance Tips

### Training
- **Speed**: Training is always fast (milliseconds)
- **More examples**: Better accuracy, minimal speed impact
- **More categories**: Slightly slower but still very fast

### Inference
- **Batch predictions**: Process multiple texts for efficiency
- **Caching**: Models stay in memory for instant reuse
- **Concurrent requests**: Server handles multiple requests

### Memory
- **Small models**: ~1-10MB per model
- **Large models**: 10-50MB with high hiddenUnits
- **Total capacity**: Limited only by available RAM

## Common Use Cases

### 1. Content Moderation
Train on safe/unsafe examples to filter content in real-time.

### 2. Email Classification
Sort emails into folders (spam, work, personal, etc.).

### 3. Customer Support
Classify support tickets by urgency or category.

### 4. Search and Retrieval
Use embeddings for semantic search in documents.

### 5. Data Labeling
Semi-automated labeling of large datasets.

## Troubleshooting

### Low Accuracy
1. Add more training examples (especially for under-represented classes)
2. Increase `hiddenUnits` (256 or 512)
3. Try different `activation` functions
4. Reduce `ridgeLambda` if underfitting

### Overfitting (good training, poor testing)
1. Increase `ridgeLambda`
2. Add `dropout` (0.1-0.3)
3. Reduce `hiddenUnits`
4. Add more diverse training data

### Slow Performance
- Not likely with ELM! Training is always fast
- If embeddings are slow, reduce `hiddenUnits`

### Memory Issues
- Reduce `hiddenUnits`
- Delete unused models
- Train fewer models simultaneously

## Best Practices

1. **Start Simple**: Begin with default parameters
2. **Iterate Quickly**: ELM's speed enables rapid experimentation
3. **Balance Data**: Ensure roughly equal examples per category
4. **Test Thoroughly**: Use separate test data to validate
5. **Version Models**: Save important models with descriptive IDs
6. **Monitor Performance**: Track accuracy over time
7. **Update Regularly**: Retrain with new examples as needed

## Privacy and Security

- ✅ All processing is local
- ✅ No data sent to external servers
- ✅ Models stored only in RAM
- ✅ Complete control over data
- ⚠️  Models cleared on restart (save important ones!)

## Next Steps

1. Try the examples above
2. Experiment with your own data
3. Test different configurations
4. Build custom workflows
5. Share your results!
