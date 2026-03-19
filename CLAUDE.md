# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ONE is a personal DeFi agent on Celo built as an [OpenClaw](https://openclaw.ai) skill. Users interact via Telegram to swap tokens, lend on AAVE V3, manage LP positions, scan arbitrage, set savings goals, and configure price alerts. All on Celo Mainnet (chain ID 42220).

## Commands

```bash
# Install dependencies and deploy skill to OpenClaw
bash install.sh

# Run any DeFi script directly
npx tsx skills/one/scripts/balance.ts
npx tsx skills/one/scripts/quote.ts --from CELO --to cUSD --amount 10
npx tsx skills/one/scripts/swap.ts --from CELO --to cUSD --amount 10 --venue uniswap --slippage 50

# Standalone utility scripts
npm run balance          # Quick wallet balance check
npm run register         # ERC-8004 agent registration

# UI (3D visualization)
cd ui && npm run dev     # Vite dev server on :5173
cd ui && npm run server  # Express WebSocket server on :3002
cd ui && npm run start   # Both concurrently

# Background monitor
npx tsx scripts/monitor.ts

# TypeScript check (no build step needed — tsx runs .ts directly)
npx tsc --noEmit
```

No test framework, linter, or CI/CD is configured.

## Architecture

### Root project — Agent skill + blockchain scripts

```
lib/           → Shared modules imported by all scripts
  client.ts    → viem wallet + public client (Celo mainnet, reads PRIVATE_KEY from .env)
  contracts.ts → Contract addresses + minimal ABIs (Uniswap V3, Mento, AAVE V3, ERC-8004)
  tokens.ts    → Token registry (CELO, cUSD, cEUR, USDC, USDT, WETH) with addresses/decimals
  state.ts     → JSON file-based state (alerts, savings goals, monitor state) in state/ dir
  utils.ts     → Formatting, CLI arg parsing, output helpers

skills/one/
  SKILL.md     → OpenClaw skill definition — agent instructions with triggers and script commands
  scripts/     → Individual DeFi operations, each a standalone CLI script

scripts/
  monitor.ts   → Background daemon polling RPC (balances every 5m, arb every 1m, alerts every 30s)
                  Triggers OpenClaw agent only when thresholds are crossed
  balance.ts   → Quick balance check
  register-8004.ts → On-chain agent identity registration
```

### UI project (`ui/`) — 3D visualization

Separate Vite + Three.js app with its own `package.json`. Express server provides WebSocket bridge (`/ws`) between the agent and the 3D scene.

```
ui/src/
  room/        → 3D scene objects (Desk, Vault, Pool, PiggyBank, AlertBell, ArbBoard, etc.)
  agent/       → Agent character model and animation
  effects/     → Visual effects (Coins, Glow)
  ui/          → 2D overlays (ChatPanel, ScreenOverlay)
  ws.ts        → WebSocket client
ui/server/
  index.ts     → Express + WebSocket server
```

### Data flow

1. User messages OpenClaw agent via Telegram
2. OpenClaw matches intent to the `one` skill via SKILL.md triggers
3. SKILL.md tells agent which `npx tsx` script to run with what args
4. Scripts use `lib/client.ts` (viem) to read/write Celo smart contracts
5. Scripts output JSON; agent formats response for user

### install.sh deployment

The install script copies `skills/one/` to `~/.openclaw/workspace/skills/one` and rewrites relative imports (`from "../../../lib/"`) to absolute paths pointing at this repo's `lib/` directory. This means `lib/` must stay in place after installation.

## Key Conventions

- **ES modules** throughout (`"type": "module"`, NodeNext resolution). All local imports use `.js` extension.
- **viem** for all blockchain interaction — never ethers.js.
- **Scripts are standalone CLIs** — each parses its own args and outputs structured results. They share `lib/` but don't import each other.
- **State is file-based JSON** in `state/` (gitignored). Use `lib/state.ts` helpers (`getAlerts`, `saveAlerts`, `writeState`, `readState`).
- **SOUL.md** defines agent personality and safety rules (confirm before transactions, compare venues, show APY before deposits, never expose keys).
- **Supported tokens:** CELO, cUSD, cEUR, USDC, USDT, WETH. Adding a token requires updating `lib/tokens.ts` and potentially `lib/contracts.ts`.
- **Mento only supports pairs through cUSD** (cUSD↔CELO, cUSD↔USDC, cUSD↔USDT, cUSD↔cEUR). Other pairs are Uniswap-only.

## Environment

Requires `.env` with `PRIVATE_KEY=0x...` (Celo wallet private key). See `.env.example`.
