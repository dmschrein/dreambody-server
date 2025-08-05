#!/usr/bin/env bash

# Exit on error
set -e

echo "🔍 Running pre-PR checks..."

# Check Node.js version
NODE_VERSION=$(node -v)
echo "Using Node.js version: $NODE_VERSION"

# Clean install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run TypeScript build
echo "🏗️ Building project..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

# Check CDK
echo "📊 Checking CDK synthesis..."
cd cdk
npm ci
cdk synth
cd ..

# Build lambda code
echo "🧰 Building Lambda code..."
cd cdk/lambda
npm ci
npm run build
cd ../..

echo "✅ All pre-PR checks passed successfully!" 