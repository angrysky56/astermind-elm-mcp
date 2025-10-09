# Guide for AI Assistants Using AsterMind-ELM MCP

## Quick Reference Card

### Available Tools
1. **train_classifier** - Train new classification model
2. **predict** - Classify text with trained model
3. **generate_embedding** - Extract vector representations
4. **list_models** - Show all models
5. **delete_model** - Remove model from memory
6. **save_model** - Export model as JSON

### Decision Tree

```
User wants classification?
  ├─ New categories → train_classifier
  └─ Existing model → predict

User wants semantic search?
  ├─ Need embeddings → generate_embedding
  └─ Compare similarity → Use embedding vectors

User wants model management?
  ├─ See models → list_models
  ├─ Save model → save_model
  └─ Remove model → delete_model
```

## When to Suggest This Tool

### Strong Matches
- "classify this text"
- "detect language"
- "is this spam?"
- "sentiment analysis"
- "categorize these items"
- "filter by category"
- "intent detection"
- "train a classifier"

### Moderate Matches
- "similar documents"
- "search by meaning"
- "group by topic"
- "find patterns in text"

### Poor Matches
- "generate text" → Use LLM instead
- "translate text" → Use translation API
- "summarize document" → Use LLM
- "extract entities" → Use NER tools

## Conversation Patterns

### Pattern 1: Direct Classification Request
```
User: "Is this text positive or negative: 'I hate this product'"

Response:
1. Check if sentiment model exists (list_models)
2. If not, offer to train one with examples
3. If exists, use predict tool
4. Return clear result with confidence
```

### Pattern 2: Custom Category Training
```
User: "I need to classify support tickets"

Response:
1. Ask for example categories
2. Collect 5-10 examples per category
3. Use train_classifier
4. Test with sample predictions
5. Offer to improve with more examples
```

### Pattern 3: Semantic Search
```
User: "Find documents similar to this one"

Response:
1. Use generate_embedding on query
2. Generate embeddings for document set
3. Calculate similarity scores
4. Return ranked results
```

## Example Conversations

### Example 1: Sentiment Analysis

**User**: Can you tell if customer reviews are positive or negative?

**Assistant**: Absolutely! I can train a sentiment classifier for you. Let me create one:

*[Use train_classifier]*
```
model_id: "review_sentiment"
training_data: [
  {"text": "Great product, highly recommend", "label": "positive"},
  {"text": "Excellent quality and fast shipping", "label": "positive"},
  {"text": "Terrible experience, very disappointed", "label": "negative"},
  {"text": "Waste of money, poor quality", "label": "negative"}
]
```

Now trained! What review would you like me to analyze?

### Example 2: Language Detection

**User**: Can you detect what language this is: "Bonjour"?

**Assistant**: I can create a language detector! Let me train it:

*[Use train_classifier]*
```
model_id: "language_detector"
training_data: [
  {"text": "Hello world", "label": "English"},
  {"text": "Bonjour le monde", "label": "French"},
  {"text": "Hola mundo", "label": "Spanish"}
]
```

Now let me check "Bonjour":

*[Use predict]*
Result: French (98% confidence)

### Example 3: Model Management

**User**: What models do I have available?

**Assistant**: Let me check:

*[Use list_models]*

You have:
- sentiment_classifier (created 2 hours ago, 2 categories)
- language_detector (created 1 hour ago, 3 categories)

Would you like to use one of these or create a new model?

## Best Response Patterns

### When Training is Needed

❌ **Don't**: Just say "I can't classify this"

✅ **Do**: 
```
"I don't have a model for that yet, but I can train one quickly! 
Could you provide:
- A few examples of each category you want?
- At least 3-5 examples per category works well"
```

### When Suggesting Improvements

❌ **Don't**: Vague advice like "add more data"

✅ **Do**:
```
"Your model achieved 75% accuracy. To improve:
1. Add 5 more examples for 'neutral' category (underrepresented)
2. Try increasing hiddenUnits from 128 to 256
3. Here's what I recommend adding: [specific examples]"
```

### When Explaining Results

❌ **Don't**: Just raw predictions

✅ **Do**:
```
"Classification results:
- Category: positive
- Confidence: 92%
- Meaning: The model is very confident this is positive sentiment

The high confidence suggests this is a clear case. 
Would you like me to analyze more texts?"
```

## Common User Needs and Solutions

### Need: "I have lots of unlabeled data"
**Solution**: 
1. Offer active learning approach
2. Classify a batch
3. Ask user to verify low-confidence predictions
4. Retrain with verified examples
5. Repeat

### Need: "Accuracy is low"
**Solution**:
1. Check training data balance
2. Suggest adding examples for weak categories
3. Try increasing hiddenUnits
4. Test different activation functions
5. Show concrete improvement steps

### Need: "How do I save this for later?"
**Solution**:
1. Use save_model tool
2. Explain JSON can be stored
3. Mention models clear on restart
4. Show how to reload if needed

### Need: "Can this work for my use case?"
**Solution**:
1. Assess if classification task
2. Estimate examples needed
3. Explain privacy benefits (on-device)
4. Show similar successful examples
5. Offer to prototype quickly

## Technical Communication Tips

### Explain Performance
```
"Training took just 50 milliseconds to process 100 examples.
That's why we can iterate so quickly!"
```

### Highlight Privacy
```
"All processing happens on your machine - no data sent anywhere.
Your examples stay completely private."
```

### Set Expectations
```
"ELM excels at fast classification but doesn't generate text.
For that, we'd use the LLM capabilities instead."
```

## Error Recovery

### Model Not Found
```
"I don't see a model with that ID. Let me show you available models:
[list_models]
Would you like to create a new one?"
```

### Poor Results
```
"The predictions seem uncertain (low confidence). 
This usually means:
1. The model needs more training examples
2. The categories might be too similar
3. The text is ambiguous

Let's add more examples - what category should this be?"
```

### Training Failure
```
"The training had an issue. Let me check:
- Do we have at least 2 different categories? ✓
- Are all examples formatted correctly? ✗

I notice some examples are missing labels. Let me help fix that."
```

## Workflow Integration

### With Search Tasks
```
1. User asks to search documents
2. Generate embeddings for query
3. Generate embeddings for documents
4. Calculate similarities
5. Return ranked results
```

### With Data Analysis
```
1. User provides dataset
2. Offer to classify/categorize
3. Train model on sample
4. Apply to full dataset
5. Show distribution/insights
```

### With Content Moderation
```
1. User wants to filter content
2. Train safe/unsafe classifier
3. Apply to incoming content
4. Flag suspicious items
5. Learn from corrections
```

## Advanced Techniques to Suggest

### Ensemble Classification
"I can create multiple models and combine their predictions for better accuracy"

### Active Learning
"Let me identify which examples would be most valuable to label next"

### Transfer Learning
"I can use embeddings from this model as features for another task"

### Confidence Thresholds
"We can set different actions based on prediction confidence levels"

## Summary: Keys to Success

1. **Proactive**: Offer to train models, don't wait to be asked
2. **Educational**: Explain why/how things work
3. **Iterative**: Emphasize fast training enables experimentation
4. **Practical**: Give concrete examples and suggestions
5. **Honest**: Clear about limitations and alternatives
6. **Privacy-aware**: Highlight on-device processing
7. **Helpful**: Guide through full workflow, not just individual tools

## Quick Tips

- ✅ Train first, ask questions later (it's instant!)
- ✅ Always test predictions after training
- ✅ Suggest improvements with specific examples
- ✅ Explain confidence scores in plain language
- ✅ Show model list periodically
- ✅ Offer to save important models
- ✅ Iterate quickly on user feedback

Remember: This tool enables real-time ML experimentation. Take advantage of the speed to help users find the best solution quickly!
