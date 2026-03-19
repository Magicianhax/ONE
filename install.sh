#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="${OPENCLAW_SKILLS:-$HOME/.openclaw/workspace/skills}"

echo "ONE DeFi Agent — Installer"
echo "=========================="
echo ""

# Install npm dependencies
echo "[1/4] Installing dependencies..."
cd "$SCRIPT_DIR" && npm install --silent

# Ensure skill directory exists
mkdir -p "$SKILL_DIR"

# Remove old split skills if they exist
echo "[2/4] Cleaning up old skills..."
for old in one-swap one-lend one-lp one-arb one-savings one-alerts one-wallet; do
  rm -rf "$SKILL_DIR/$old" 2>/dev/null && echo "  Removed: $old" || true
done

# Install the single unified skill
echo "[3/4] Installing ONE skill to $SKILL_DIR..."
rm -rf "$SKILL_DIR/one"
cp -r "$SCRIPT_DIR/skills/one" "$SKILL_DIR/one"

# Rewrite script imports to absolute paths
for script in "$SKILL_DIR/one"/scripts/*.ts; do
  [ -f "$script" ] || continue
  sed -i "s|from \"../../../lib/|from \"$SCRIPT_DIR/lib/|g" "$script"
done

echo "  Installed: one"

# Check .env
echo "[4/4] Checking configuration..."
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "  WARNING: No .env file found!"
  echo "  Copy .env.example to .env and add your private key:"
  echo "    cp .env.example .env"
  echo "    nano .env"
else
  echo "  .env found"
fi

echo ""
echo "Done! Restart OpenClaw gateway to load the skill."
echo "Test with: cd $SCRIPT_DIR && npx tsx skills/one/scripts/balance.ts"
