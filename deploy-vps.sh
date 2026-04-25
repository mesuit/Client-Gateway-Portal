#!/bin/bash
# ============================================================
# Makamesco Nexus Pay — VPS Deploy Script
# Run this on the VPS after git pull
# Usage: bash deploy-vps.sh
# ============================================================
set -e

APP_DIR="/var/www/nexuspay"
PM2_NAME="nexuspay-api"

echo "==> Pulling latest code from GitHub..."
cd $APP_DIR
git pull origin main

echo "==> Installing dependencies..."
pnpm install

echo "==> Pushing DB schema (new tables)..."
pnpm --filter @workspace/db run push

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Building portal (frontend)..."
pnpm --filter @workspace/portal run build

echo "==> Restarting API via PM2..."
pm2 restart $PM2_NAME

echo ""
echo "✅ Deployment complete!"
echo ""
echo "API:    https://pay.makamesco-tech.co.ke/api/health"
echo "Portal: check Nginx — built files in artifacts/portal/dist/"
echo ""
echo "IMPORTANT: Make sure start.sh exports:"
echo "  export CALLBACK_BASE_URL=https://pay.makamesco-tech.co.ke"
