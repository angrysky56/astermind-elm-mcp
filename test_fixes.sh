#!/usr/bin/env bash
# Test script for AsterMind-ELM MCP fixes
# Run this after reloading the MCP server

set -e

echo "=================================="
echo "AsterMind-ELM MCP Fix Verification"
echo "=================================="
echo ""

# Check if Claude Desktop is running with the MCP
echo "📋 Prerequisites:"
echo "  - SurrealDB must be running"
echo "  - ENABLE_PERSISTENCE=true in .env"
echo "  - Claude Desktop reloaded with updated server"
echo ""
read -p "Press Enter to continue with tests..."

echo ""
echo "=================================="
echo "Test 1: Model Creation (JSON Fix)"
echo "=================================="
echo "Testing if model creation produces valid JSON without warnings..."
echo ""
echo "In Claude Desktop, run:"
echo ""
cat << 'EOF'
astermind-elm:train_classifier({
  model_id: "json_test",
  training_data: [
    { text: "Great product!", label: "positive" },
    { text: "Terrible service!", label: "negative" }
  ]
})
EOF
echo ""
echo "✓ Expected: Success response WITHOUT JSON warnings"
echo "✗ Failure: JSON warnings in output"
read -p "Press Enter when done..."

echo ""
echo "=================================="
echo "Test 2: Model Persistence & Reload"
echo "=================================="
echo "Testing encoder configuration persistence..."
echo ""
echo "Step 1 - Create and persist:"
cat << 'EOF'
astermind-elm:train_classifier({
  model_id: "persist_test",
  training_data: [
    { text: "Excellent", label: "positive" },
    { text: "Awful", label: "negative" },
    { text: "Amazing", label: "positive" },
    { text: "Horrible", label: "negative" }
  ],
  persist: true,
  version: "1.0.0"
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 2 - Test before delete:"
cat << 'EOF'
astermind-elm:predict({
  model_id: "persist_test",
  text: "This is wonderful!"
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 3 - Delete from memory:"
cat << 'EOF'
astermind-elm:delete_model({
  model_id: "persist_test"
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 4 - Load from database:"
cat << 'EOF'
astermind-elm:load_model_persistent({
  model_id: "persist_test"
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 5 - Test after reload (CRITICAL!):"
cat << 'EOF'
astermind-elm:predict({
  model_id: "persist_test",
  text: "This is wonderful!"
})
EOF
echo ""
echo "✓ Expected: Prediction works with confidence scores"
echo "✗ Failure: 'requires useTokenizer:true' error"
read -p "Press Enter when done..."

echo ""
echo "=================================="
echo "Test 3: Metrics Collection"
echo "=================================="
echo "Testing SurrealDB aggregation queries..."
echo ""
echo "Step 1 - Create model with predictions:"
cat << 'EOF'
astermind-elm:train_classifier({
  model_id: "metrics_test",
  training_data: [
    { text: "Good", label: "positive" },
    { text: "Bad", label: "negative" }
  ],
  persist: true
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 2 - Log some predictions:"
cat << 'EOF'
astermind-elm:predict({
  model_id: "metrics_test",
  text: "Excellent service",
  log_prediction: true,
  ground_truth: "positive"
})
EOF
echo ""
read -p "Press Enter when done..."

cat << 'EOF'
astermind-elm:predict({
  model_id: "metrics_test",
  text: "Poor quality",
  log_prediction: true,
  ground_truth: "negative"
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 3 - Get metrics (CRITICAL!):"
cat << 'EOF'
astermind-elm:get_model_metrics({
  model_id: "metrics_test"
})
EOF
echo ""
echo "✓ Expected: Metrics with accuracy, avg_confidence, etc."
echo "✗ Failure: 'Incorrect arguments for function math::mean()' error"
read -p "Press Enter when done..."

echo ""
echo "=================================="
echo "Test 4: Dataset Storage"
echo "=================================="
echo "Testing dataset object serialization..."
echo ""
echo "Step 1 - Store dataset:"
cat << 'EOF'
astermind-elm:store_training_dataset({
  dataset_id: "test_ds",
  training_data: [
    { text: "Love it!", label: "positive" },
    { text: "Hate it!", label: "negative" },
    { text: "Best ever!", label: "positive" }
  ]
})
EOF
echo ""
read -p "Press Enter when done..."

echo ""
echo "Step 2 - Load dataset (CRITICAL!):"
cat << 'EOF'
astermind-elm:load_training_dataset({
  dataset_id: "test_ds"
})
EOF
echo ""
echo "✓ Expected: Complete objects with text and label fields"
echo "✗ Failure: Empty objects like [{}. {}, {}]"
read -p "Press Enter when done..."

echo ""
echo "=================================="
echo "🎉 All Tests Complete!"
echo "=================================="
echo ""
echo "Summary Checklist:"
echo "  [ ] No JSON warnings in model creation"
echo "  [ ] Model reloads and predicts successfully"
echo "  [ ] Metrics return without aggregation errors"
echo "  [ ] Datasets load with complete objects"
echo ""
echo "If all tests passed, update REMAINING_ISSUES.md"
echo "with completion timestamps."
echo ""
