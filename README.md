<p align="center">
  <img src="ui/public/logo.png" width="120" alt="ONE Agent" />
</p>

<h1 align="center">ONE — Personal DeFi Agent on Celo</h1>

<p align="center">
  An AI agent that manages your DeFi on Celo through natural language.<br/>
  Swap any token, earn yield, track markets, save for goals — all via chat.
</p>

<p align="center">
  <strong>Celo Mainnet</strong> &middot; <strong>Uniswap V3</strong> &middot; <strong>Mento</strong> &middot; <strong>AAVE V3</strong> &middot; <strong>ERC-8004</strong>
</p>

---

## What is ONE?

ONE is an open-source DeFi agent that runs on [Celo](https://celo.org) and talks to you via Telegram (or a 3D web UI). You tell it what you want in plain English — it figures out which contracts to call, gets the best price, and executes on-chain. No UI dashboards to learn, no wallet switching, no manual contract interaction.

Built as an [OpenClaw](https://openclaw.ai) skill, ONE is a single agent that handles everything:

| Capability | What it does |
|-----------|-------------|
| **Swap** | Trade any ERC-20 token on Celo with best-price routing (Uniswap V3 vs Mento) |
| **Lend** | Supply & withdraw on AAVE V3, view APYs |
| **LP** | View Uniswap V3 concentrated liquidity positions |
| **Arbitrage** | Scan stablecoin spreads between Uniswap and Mento in real-time |
| **Savings** | Goal-based savings plans with auto-sweep idle funds to yield |
| **Alerts** | Price alerts with optional auto-trade when conditions are met |
| **Market Data** | Real-time prices, trending tokens, market cap via CoinGecko |
| **Monitor** | Background daemon that watches your portfolio 24/7 (zero LLM cost) |

**Tokens:** Not limited to a fixed list. ONE works with **any ERC-20 on Celo** — pass a symbol (`CELO`, `USDC`) or a raw contract address (`0x1234...`). The agent auto-fetches token metadata from the chain.

**Identity:** Registered on-chain via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — verifiable agent identity with reputation on [AgentScan](https://agentscan.info).

---

## Demo

Talk to ONE via Telegram or the web UI:

```
> check my balance
Wallet: 0xc6D7...C7
CELO: 114.89  |  USDC: 102.42  |  cUSD: 0.53

> swap 10 USDC to CELO
Uniswap V3: 10 USDC → 129.2 CELO (fee: 0.01%)
Mento: not available for this pair
Best venue: Uniswap V3. Confirm?

> yes
Sold: 10 USDC → Received: 129.2 CELO
tx: celoscan.io/tx/0xabc...

> what's the price of CELO?
CELO: $0.0812 (24h: +2.83%)

> save $350 for a new phone by September
Created savings goal "Phone" — 350 cUSD by Sep 2026
Strategy: AAVE V3 (1.06% APY)
First deposit: 1 cUSD ✓

> scan for arbitrage
cUSD/USDC: Uni 99.89 vs Mento 100.02 — spread 0.13% (below threshold)
cUSD/USDT: Uni 99.95 vs Mento 99.98 — spread 0.03%
No profitable opportunities above 0.3%
```

### 3D Room UI

ONE comes with an interactive 3D isometric room where a cute animated agent character lives. The agent physically walks to different objects in the room based on what it's doing:

- **Desk** — sits at computer for swaps, quotes, balance checks. Camera zooms to the monitor showing real action data. Approve/decline transactions on the 3D screen.
- **Vault** — opens the safe door for AAVE lending operations
- **Piggy Bank** — drops a coin in for savings deposits
- **Alert Bell** — for price alerts and notifications
- **Bed** — day/night cycle with sleep/wake animations

Click the piggy bank or vault in the room to see savings goals or lending positions.

---

## How It Works

```
         You (Telegram / Web UI)
              │
              ▼
         OpenClaw Agent ──── reads SKILL.md (maps intents to scripts)
              │
              ▼
         scripts/ (npx tsx) ──── uses lib/client.ts (viem wallet)
              │
              ▼
         Celo Mainnet (chain 42220)
          ├── Uniswap V3 (swap, LP, quoter)
          ├── Mento Protocol (stablecoin exchange)
          └── AAVE V3 (lending/borrowing)
```

1. You send a message (Telegram, web chat, or API)
2. OpenClaw matches your intent to the **one** skill via triggers in `SKILL.md`
3. `SKILL.md` tells the agent which TypeScript script to run with what arguments
4. Scripts use [viem](https://viem.sh) to read/write Celo smart contracts
5. For unknown tokens, scripts auto-resolve metadata (symbol, decimals) on-chain
6. JSON results come back, agent formats them into a human-readable response

### Dynamic Token Resolution

Every script accepts token symbols OR raw contract addresses:

```bash
# These both work:
npx tsx scripts/quote.ts --from CELO --to USDC --amount 10
npx tsx scripts/quote.ts --from 0x471EcE3750Da237f93B8E339c536989b8978a438 --to 0xcebA9300f2b948710d2653dD7B07f33A8B32118C --amount 10

# Swap CELO to PACT (resolved from address on-chain)
npx tsx scripts/swap.ts --from CELO --to 0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58 --amount 10 --venue uniswap --slippage 100
```

### Security

- Token approvals are **exact amounts only** (not unlimited `uint256.max`)
- Swap results are parsed from **transaction receipts** (actual received, not estimates)
- Agent **always confirms** before executing any transaction
- Private keys are **never exposed** in responses
- 5-minute deadline on all Uniswap swaps

---

## Installation

### Prerequisites

| Requirement | Purpose |
|------------|---------|
| [Node.js](https://nodejs.org) 20+ | Runtime for TypeScript scripts |
| [OpenClaw](https://openclaw.ai) | Agent framework (Telegram/Discord/API) |
| Celo wallet | Private key with some CELO for gas |

### Step 1: Clone and configure

```bash
git clone https://github.com/Magicianhax/ONE.git
cd ONE
cp .env.example .env
```

Edit `.env` and add your Celo wallet private key:

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

### Step 2: Install dependencies and deploy skill

```bash
bash install.sh
```

This installs npm packages and copies the skill to OpenClaw's workspace.

### Step 3: Install CoinGecko CLI (market data)

```bash
curl -sSfL https://raw.githubusercontent.com/coingecko/coingecko-cli/main/install.sh | sh
cg auth   # Get a free API key at coingecko.com/en/api
```

### Step 4: Verify

```bash
# Should output JSON with your wallet address and token balances
npx tsx skills/one/scripts/balance.ts

# Should output a swap quote
npx tsx skills/one/scripts/quote.ts --from CELO --to USDC --amount 1

# Should output CELO price
cg price --symbols celo -o json
```

### Step 5 (optional): Run the 3D web UI

```bash
cd ui
npm install
npm run start   # Express + WebSocket on :3002, Vite on :5173
```

Open `http://localhost:5173` in your browser.

### Step 6 (optional): Start the background monitor

```bash
npx tsx scripts/monitor.ts
```

Runs 24/7 with zero LLM cost — polls balances (5min), arb spreads (1min), and price alerts (30s). Only triggers the agent when something notable happens.

### Step 7 (optional): Register on-chain identity

```bash
npx tsx scripts/register-8004.ts      # ERC-8004 agent identity
npx tsx scripts/reputation-setup.ts   # Reputation + activity metadata
```

---

## Project Structure

```
ONE/
├── lib/                      # Shared modules
│   ├── client.ts                 # viem wallet + public client (Celo mainnet)
│   ├── tokens.ts                 # Token registry + dynamic on-chain resolver
│   ├── contracts.ts              # Addresses + ABIs (Uniswap, Mento, AAVE, ERC-8004)
│   ├── state.ts                  # JSON file-based state (alerts, savings, monitor)
│   └── utils.ts                  # Formatting, CLI arg parsing, output helpers
│
├── skills/one/               # The ONE OpenClaw skill
│   ├── SKILL.md                  # Agent instructions — maps triggers to scripts
│   └── scripts/                  # DeFi operation scripts (each standalone CLI)
│       ├── balance.ts                # Check wallet balances (any ERC-20)
│       ├── quote.ts                  # Get swap quotes (Uniswap + Mento, parallel)
│       ├── swap.ts                   # Execute swaps (exact approval, receipt parsing)
│       ├── lend-positions.ts         # AAVE V3 positions & APYs
│       ├── lend-supply.ts            # Supply tokens to AAVE V3
│       ├── lend-withdraw.ts          # Withdraw from AAVE V3
│       ├── lp-positions.ts           # Uniswap V3 LP positions
│       ├── arb-scan.ts              # Stablecoin arbitrage scanner (parallel)
│       ├── savings-goal.ts           # Savings goal CRUD
│       ├── savings-sweep.ts          # Auto-sweep idle funds to AAVE
│       ├── alerts-set.ts             # Set price alerts
│       ├── alerts-list.ts            # List active alerts
│       ├── alerts-check.ts           # Check alert conditions
│       └── read-monitor.ts           # Read background monitor state
│
├── scripts/                  # Standalone utilities
│   ├── monitor.ts                # Background daemon (zero LLM cost)
│   ├── register-8004.ts          # ERC-8004 on-chain registration
│   └── reputation-setup.ts       # ERC-8004 reputation + metadata
│
├── ui/                       # 3D web interface
│   ├── src/main.ts               # Three.js isometric room + agent animation
│   ├── src/ui/ChatPanel.ts       # Chat with markdown rendering
│   ├── src/ws.ts                 # WebSocket client
│   ├── server/index.ts           # Express server (API + WS + static)
│   ├── index.html                # UI shell + card popup system
│   └── public/                   # Assets (logo, textures, favicon)
│
├── state/                    # Runtime data (gitignored)
├── SKILL.md → skills/one/    # Skill definition
├── SOUL.md                   # Agent personality & safety rules
└── install.sh                # One-command setup
```

---

## How Each Script Works

All scripts are **standalone CLIs** — they share `lib/` but don't import each other. Each outputs structured JSON.

### Swaps

```bash
# Step 1: Get quotes from both venues
npx tsx skills/one/scripts/quote.ts --from CELO --to USDC --amount 10

# Step 2: Execute on the best venue
npx tsx skills/one/scripts/swap.ts --from CELO --to USDC --amount 10 --venue uniswap --slippage 50
```

The swap script:
- Scans all 4 Uniswap V3 fee tiers (100, 500, 3000, 10000) in parallel
- Approves only the exact swap amount (not unlimited)
- Parses the actual received amount from the transaction receipt
- Supports any ERC-20 address, not just named tokens

### Lending (AAVE V3)

```bash
npx tsx skills/one/scripts/lend-positions.ts              # View positions + APYs
npx tsx skills/one/scripts/lend-supply.ts --token USDC --amount 50   # Supply
npx tsx skills/one/scripts/lend-withdraw.ts --token USDC --amount max # Withdraw
```

### Savings Goals

```bash
npx tsx skills/one/scripts/savings-goal.ts --action create --name "Phone" --target 350 --currency cUSD --deadline 2026-09-01 --strategy aave
npx tsx skills/one/scripts/savings-goal.ts --action list
npx tsx skills/one/scripts/savings-goal.ts --action deposit --id <ID> --amount 10
npx tsx skills/one/scripts/savings-sweep.ts --min-idle 5   # Sweep idle funds to AAVE
```

### Market Data (CoinGecko CLI)

```bash
cg price --symbols celo,btc,eth -o json     # Current prices
cg trending -o json                          # Trending tokens
cg search solana -o json                     # Search by name
cg markets --category layer-2 -o json        # Market rankings
cg history celo --days 30 -o json            # Price history
```

---

## Background Monitor

The monitor is a lightweight daemon that polls Celo RPC directly — **no LLM calls**, so it costs nothing to run 24/7.

```bash
npx tsx scripts/monitor.ts
```

| What it watches | Interval | When it triggers the agent |
|----------------|----------|--------------------------|
| Token balances | 5 min | Balance changes > 5% |
| Arb spreads | 1 min | Spread > 0.3% between venues |
| Price alerts | 30 sec | User-set condition is met |

State is written to `state/monitor.json` — the web UI reads from this file for instant panel data.

---

## On-Chain Identity (ERC-8004)

ONE is registered on the [ERC-8004 Identity Registry](https://eips.ethereum.org/EIPS/eip-8004) on Celo, making it a verifiable on-chain agent with:

- **Identity NFT** on the Celo identity registry
- **Reputation feedback** on the reputation registry
- **Agent metadata** — capabilities, supported tokens, protocols, activity stats
- **AgentScan** profile at [agentscan.info](https://agentscan.info/agents)

```bash
# Register your agent
npx tsx scripts/register-8004.ts

# Set up reputation + update metadata with activity stats
npx tsx scripts/reputation-setup.ts
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Agent Runtime | [OpenClaw](https://openclaw.ai) | LLM agent with skill system, Telegram integration |
| Blockchain | [viem](https://viem.sh) | TypeScript client for Celo smart contracts |
| DEX | [Uniswap V3](https://uniswap.org) | Token swaps, LP management, quoter |
| Stablecoin Exchange | [Mento Protocol](https://mento.org) | cUSD pairs (CELO, USDC, USDT, cEUR) |
| Lending | [AAVE V3](https://aave.com) | Supply, borrow, yield |
| Market Data | [CoinGecko CLI](https://github.com/coingecko/coingecko-cli) | Prices, trending, history |
| Agent Identity | [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | On-chain identity + reputation |
| 3D Visualization | [Three.js](https://threejs.org) | Isometric room with animated agent |
| Server | Express + WebSocket | Chat bridge, REST API, static serving |

---

## Contributing

ONE is open source and built for the [Celo Hackathon](https://celo.org). Contributions welcome:

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Push and open a PR

Key areas that could use help:
- More DeFi protocols (Curve, Ubeswap, SushiSwap on Celo)
- Uniswap V4 support when it launches on Celo
- Mobile-optimized 3D room UI
- More token list sources (dynamic pool discovery via subgraph)

---

## License

MIT

