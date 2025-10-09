# AsterMind-ELM MCP Server - Best Practices Guide

## When to Use This Server

### Perfect Use Cases
✅ **Text Classification** - Categorize text into predefined labels
✅ **Sentiment Analysis** - Detect positive/negative/neutral sentiment
✅ **Language Detection** - Identify the language of text
✅ **Intent Recognition** - Classify user intents in chatbots
✅ **Content Moderation** - Filter safe/unsafe content
✅ **Spam Detection** - Classify spam vs legitimate messages
✅ **Topic Classification** - Categorize documents by topic
✅ **Semantic Embeddings** - Generate vectors for similarity search

### Not Ideal For
❌ **Large Language Generation** - Use LLMs for this
❌ **Long-form Text Generation** - Not designed for generation
❌ **Complex Reasoning** - ELM is for classification/embeddings
❌ **Multi-modal Tasks** - Text only (no images/audio)

## Key Advantages

### Speed
- Training: **Milliseconds** (not minutes/hours)
- Inference: **Microseconds** per prediction
- No waiting for model convergence

### Privacy
- All processing **on-device**
- No external API calls
- Complete data privacy
- No cloud dependencies

### Simplicity
- No hyperparameter tuning required
- Works well with defaults
- Minimal configuration needed
- Easy to understand

### Efficiency
- **No GPU required**
- Low memory footprint
- Runs on any modern CPU
- Multiple models simultaneously

## Best Practices

### Training Data

#### Minimum Requirements
- At least **2 categories** (classes)
- At least **3-5 examples per category**
- More examples = better accuracy

#### Optimal Data
- **10-50 examples per category** for good performance
- **Balanced classes** (similar number of examples per category)
- **Diverse examples** (varied phrasings, contexts)
- **Representative samples** (covers real-world use cases)

#### Data Quality Tips
```
✅ Good: Mix of short and long examples
✅ Good: Natural language variations
✅ Good: Real-world examples
❌ Bad: All examples too similar
❌ Bad: Highly imbalanced classes
❌ Bad: Synthetic/templated only
```

### Model Configuration

#### Start with Defaults
```json
{
  "hiddenUnits": 128,
  "activation": "relu",
  "weightInit": "xavier",
  "ridgeLambda": 1e-6
}
```

#### When to Adjust

**Increase hiddenUnits** (256, 512, 1024):
- Many categories (>10)
- Complex patterns
- Plenty of training data
- Need higher accuracy

**Change activation**:
- `relu`: Fast, good default
- `gelu`: Better for complex patterns
- `leakyrelu`: When relu saturates
- `sigmoid/tanh`: Bounded outputs needed

**Increase ridgeLambda** (0.001, 0.01):
- Small training datasets
- Overfitting observed
- Very noisy data

**Add dropout** (0.1-0.3):
- Large training datasets
- Overfitting detected
- Want more robustness

### Workflow Recommendations

#### 1. Rapid Prototyping
```
1. Start with 5-10 examples per category
2. Train with defaults
3. Test predictions
4. Add more examples where needed
5. Iterate quickly (takes seconds!)
```

#### 2. Production Deployment
```
1. Collect 20-50 examples per category
2. Split into train/test sets
3. Train with optimized config
4. Validate on test set
5. Monitor and retrain periodically
```

#### 3. Continuous Learning
```
1. Start with initial model
2. Collect user feedback
3. Add misclassified examples to training
4. Retrain (still takes milliseconds!)
5. Deploy updated model
```

## Common Patterns

### Pattern 1: Two-Stage Classification
First classify broad category, then specific sub-category:

```
Model 1: Is this technical or non-technical?
  ↓
Model 2a: What type of technical issue?
Model 2b: What type of general question?
```

### Pattern 2: Embedding-Based Search
Generate embeddings for semantic search:

```
1. Train classifier on categories
2. Extract embeddings from model
3. Use embeddings for similarity search
4. Find most similar documents
```

### Pattern 3: Confidence-Based Routing
Route based on prediction confidence:

```
High confidence (>0.9): Auto-handle
Medium confidence (0.5-0.9): Review
Low confidence (<0.5): Manual review
```

### Pattern 4: Ensemble Predictions
Combine multiple models:

```
Model 1: Sentiment classifier
Model 2: Language detector  
Model 3: Intent classifier
→ Use all three for comprehensive analysis
```

## Performance Optimization

### Training Speed
- Already instant (milliseconds)
- No optimization needed
- Feel free to retrain often

### Inference Speed
- Single predictions: < 1ms
- Batch predictions: Minimal overhead
- Models cached in memory

### Memory Management
```
Small model (128 units): ~1-5 MB
Medium model (256 units): ~5-15 MB
Large model (512 units): ~15-30 MB
XL model (1024 units): ~30-60 MB
```

### Scaling Strategies
1. **Vertical**: Increase hiddenUnits
2. **Horizontal**: Multiple specialized models
3. **Hybrid**: Combine both approaches

## Error Handling

### Common Issues and Solutions

#### "Model not found"
- Check model_id spelling
- Use list_models to see available models
- Model may have been deleted

#### "Training failed"
- Verify data format: `{text: string, label: string}`
- Ensure at least 2 different labels
- Check for empty text fields

#### "Poor accuracy"
- Add more training examples
- Increase hiddenUnits
- Try different activation
- Balance class distribution

#### "Categories mismatch"
- Ensure label consistency
- Check for typos in labels
- Case-sensitive labels

## Testing Strategies

### Unit Testing
Test individual predictions:
```
Input: "I love this!"
Expected: "positive" with high confidence
```

### Integration Testing
Test full workflows:
```
1. Train model
2. Make predictions
3. Generate embeddings
4. Verify results
```

### A/B Testing
Compare configurations:
```
Model A: hiddenUnits=128, activation=relu
Model B: hiddenUnits=256, activation=gelu
→ Which performs better?
```

## Monitoring

### Key Metrics
- **Accuracy**: % of correct predictions
- **Confidence**: Average prediction confidence
- **Coverage**: % of predictions above threshold
- **Latency**: Time per prediction (should be <1ms)

### When to Retrain
- Accuracy drops below acceptable threshold
- New categories emerge
- Data distribution shifts
- User feedback indicates issues

## Security Considerations

### Data Privacy
✅ All data stays local
✅ No network calls
✅ Complete control

### Model Security
✅ Models in memory only
✅ No persistence unless explicitly saved
✅ Clear on restart

### Input Validation
⚠️ Always validate user inputs
⚠️ Sanitize text before processing
⚠️ Handle edge cases gracefully

## Advanced Techniques

### Transfer Learning
Use embeddings from one model as features for another:
```
1. Train base model on general data
2. Extract embeddings
3. Use as features for specialized model
```

### Active Learning
Strategically select examples to label:
```
1. Train initial model
2. Find low-confidence predictions
3. Label those examples
4. Retrain with new examples
```

### Model Compression
Reduce model size while maintaining accuracy:
```
1. Train large model (512+ units)
2. Evaluate performance
3. Gradually reduce hiddenUnits
4. Find smallest acceptable model
```

## Integration Patterns

### With LLMs
```
LLM generates candidates
  ↓
ELM classifies/filters
  ↓
Return curated results
```

### With Databases
```
Query database
  ↓
ELM classifies results
  ↓
Return categorized data
```

### With APIs
```
API returns data
  ↓
ELM enriches with classifications
  ↓
Return enhanced results
```

## Summary

**Remember:**
- ELM excels at fast, simple classification
- Default configs work well for most tasks
- Training is instant - iterate freely
- Privacy-first, on-device processing
- Perfect for real-time applications

**Quick Checklist:**
- [ ] At least 5 examples per category
- [ ] Balanced class distribution
- [ ] Descriptive model_id
- [ ] Test with unseen examples
- [ ] Monitor accuracy over time
- [ ] Retrain when needed
