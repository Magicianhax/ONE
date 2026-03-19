# ONE — Personal DeFi Agent on Celo

An open-source [OpenClaw](https://openclaw.ai) skill that lets you manage DeFi on Celo through natural language. Talk to it via Telegram — swap any token, earn yield, track prices, and more.

**One agent. All of DeFi.**

## What It Does

- **Swap** any token on Celo with best-price routing (Uniswap V3 vs Mento Protocol)
- **Lend** on AAVE V3 — supply, withdraw, view APYs
- **LP** — view Uniswap V3 concentrated liquidity positions
- **Arbitrage** — scan stablecoin spreads between venues
- **Save** — goal-based savings with auto-sweep to yield
- **Alert** — price alerts with optional auto-trade
- **Market Data** — real-time prices, trending, market cap via CoinGecko
- **3D Room UI** — interactive isometric room with animated agent character

**Tokens:** Any ERC-20 on Celo (named shortcuts: CELO, cUSD, cEUR, USDC, USDT, WETH, stCELO, + any contract address)

**Protocols:** Uniswap V3, Mento, AAVE V3

**Identity:** [ERC-8004](https://agentscan.info) registered on-chain

## Quick Start

### Prerequisites

- [OpenClaw](https://openclaw.ai) installed and running
- Node.js 20+
- A Celo wallet with some CELO for gas

### Install

```bash
git clone https://github.com/Magicianhax/ONE.git
cd ONE
cp .env.example .env
nano .env   # Add your PRIVATE_KEY

# Install dependencies and deploy skill
bash install.sh

# Install CoinGecko CLI for market data
curl -sSfL https://raw.githubusercontent.com/coingecko/coingecko-cli/main/install.sh | sh
cg auth   # Set up free API key from coingecko.com/en/api
```

### Verify

```bash
# Check balances (structured JSON)
npx tsx skills/one/scripts/balance.ts

# Check any token by address
npx tsx skills/one/scripts/balance.ts --token 0x471EcE3750Da237f93B8E339c536989b8978a438

# Get a swap quote
npx tsx skills/one/scripts/quote.ts --from CELO --to USDC --amount 10

# Market price
cg price --symbols celo -o json
```

### Run the 3D UI

```bash
cd ui && npm install
npm run start   # Express server (port 3002) + Vite dev (port 5173)
```

### Use

Talk to your OpenClaw agent via Telegram:

```
check my balance
swap 10 USDC to CELO
swap 100 CELO to 0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58
show AAVE APYs
what's the price of CELO?
what's trending in crypto?
set alert: CELO below $0.05
save $500 for a laptop by June
scan for arbitrage
```

## Architecture

```
ONE/
├── lib/                  # Shared modules (wallet, tokens, contracts, utils)
│   ├── client.ts             # viem wallet + public client (Celo mainnet)
│   ├── tokens.ts             # Token registry + dynamic on-chain resolver
│   ├── contracts.ts          # Contract addresses + ABIs (Uniswap, Mento, AAVE, ERC-8004)
│   └── utils.ts              # Formatting, CLI args, output helpers
├── skills/one/           # The ONE skill
│   ├── SKILL.md              # Agent instructions (triggers → scripts)
│   └── scripts/              # All DeFi scripts
│       ├── balance.ts            # Wallet balances (any ERC-20)
│       ├── quote.ts              # Swap quotes (Uniswap + Mento, parallel)
│       ├── swap.ts               # Execute swaps (exact approval, receipt parsing)
│       ├── lend-positions.ts     # AAVE positions & APYs
│       ├── lend-supply.ts        # Supply to AAVE
│       ├── lend-withdraw.ts      # Withdraw from AAVE
│       ├── lp-positions.ts       # Uniswap V3 LP positions
│       ├── arb-scan.ts           # Stablecoin arbitrage (parallel, all fee tiers)
│       ├── savings-goal.ts       # Savings goal CRUD
│       ├── savings-sweep.ts      # Auto-sweep to AAVE
│       ├── alerts-set.ts         # Set price alerts
│       ├── alerts-list.ts        # List active alerts
│       └── alerts-check.ts       # Check alerts (cron)
├── scripts/              # Standalone utils
│   ├── monitor.ts            # Background daemon (balance, arb, alerts polling)
│   ├── register-8004.ts      # ERC-8004 agent registration
│   └── reputation-setup.ts   # ERC-8004 reputation setup
├── ui/                   # 3D visualization + chat interface
│   ├── src/main.ts           # Three.js isometric room + agent character
│   ├── server/index.ts       # Express + WebSocket server
│   └── index.html            # Chat UI, card popups, toolbar
└── state/                # Runtime state (gitignored)
```

## How It Works

1. You message your OpenClaw agent (Telegram, web chat, or API)
2. OpenClaw matches intent to the **one** skill via SKILL.md triggers
3. SKILL.md tells the agent which `npx tsx` script to run
4. Scripts use `viem` to read/write Celo smart contracts
5. For any unknown token, scripts auto-fetch metadata (symbol, decimals) from the chain
6. JSON results come back, agent formats them for you

### Dynamic Token Resolution

Pass any ERC-20 contract address — the agent resolves it on-chain:

```bash
# Swap CELO to PACT using its contract address
npx tsx skills/one/scripts/swap.ts \
  --from CELO \
  --to 0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58 \
  --amount 10 --venue uniswap --slippage 100
```

## Background Monitor

Zero-LLM-cost daemon that polls on-chain data and triggers the agent only when needed:

```bash
npx tsx scripts/monitor.ts
```

- Balance check: every 5 min (triggers on >5% change)
- Arb scan: every 1 min (triggers on >0.3% spread)
- Alert check: every 30 sec (triggers when condition met)

## 3D Room UI

Interactive isometric bedroom with a cute animated agent character:

- Agent walks to desk (swaps), vault (AAVE), piggy bank (savings), bell (alerts)
- **Desk mode**: camera zooms in, agent sits at computer, monitor shows real action data
- Approve/decline transactions on the 3D monitor screen
- Vault door opens/closes, piggy bank coin drop animation
- Day/night cycle with sleep/wake animations
- Click piggy bank or vault for info card popups
- Markdown rendering in chat (tables, links, bold)

## Tech Stack

- **[OpenClaw](https://openclaw.ai)** — Agent runtime
- **[viem](https://viem.sh)** — TypeScript Ethereum library
- **[Three.js](https://threejs.org)** — 3D visualization
- **[Uniswap V3](https://uniswap.org)** — DEX
- **[Mento](https://mento.org)** — Celo stablecoin exchange
- **[AAVE V3](https://aave.com)** — Lending protocol
- **[ERC-8004](https://agentscan.info)** — On-chain agent identity
- **[CoinGecko CLI](https://github.com/coingecko/coingecko-cli)** — Market data

## License

MIT
