#!/bin/sh
set -e

echo "🚀 Starting MiniChat Web (Next.js)"
echo "📦 NODE_ENV: $NODE_ENV"

# 启动 Next.js
exec node_modules/.bin/next start -p "${PORT:-3100}"
