#!/usr/bin/env bash

# Exit on error
set -e

echo "🔧 Fixing common build issues..."

# Fix Node.js type definitions
echo "📦 Reinstalling Node.js types..."
npm install @types/node@24 --save-dev

# Fix graphql package versions
echo "📦 Fixing graphql package versions..."
npm install graphql@^16.9.0 graphql-request@^7.1.0

# Fix ESM/CommonJS compatibility issues
echo "🔄 Fixing ESM/CommonJS compatibility issues..."
# Option 1: Remove type: module if you want CommonJS
# sed -i'' -e '/"type": "module",/d' package.json
# Option 2: Keep type: module but fix vitest config
# Vitest config fix is done in a separate step

# Create Node.js types symlink for CDK
echo "🔗 Creating Node.js types symlink for CDK..."
mkdir -p cdk/node_modules/@types
rm -rf cdk/node_modules/@types/node 2>/dev/null || true
ln -sf ../../node_modules/@types/node cdk/node_modules/@types/node

# Echo help message
echo ""
echo "✅ Common build issues fixed!"
echo ""
echo "👉 Run npm run pre-pr to check if all issues are resolved."
echo "👉 If you still have issues, try: npm ci && cd cdk && npm ci && cd .." 