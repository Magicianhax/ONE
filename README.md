# ONE — Personal DeFi Agent on Celo

An open-source [OpenClaw](https://openclaw.ai) skill that lets you manage DeFi on Celo through natural language. Talk to it via Telegram — swap tokens, earn yield, track prices, and more.

**One skill. All of DeFi.**

## What It Does

- **Swap** tokens with best-price routing (Uniswap V3 vs Mento Protocol)
- **Lend** on AAVE V3 — supply, withdraw, view APYs
- **LP** — view Uniswap V3 concentrated liquidity positions
- **Arbitrage** — scan stablecoin spreads between venues
- **Save** — goal-based savings with auto-sweep to yield
- **Alert** — price alerts with optional auto-trade

**Tokens:** CELO, cUSD, cEUR, USDC, USDT, WETH

**Protocols:** Uniswap V3, Mento, AAVE V3

## Quick Start

### Prerequisites

- [OpenClaw](https://openclaw.ai) installed and running
- Node.js 20+
- A Celo wallet with some CELO for gas

### Install

```bash
git clone https://github.com/mush-ahid/one.git
cd one
cp .env.example .env
nano .env   # Add your private key
bash install.sh
```

### Verify

```bash
npx tsx skills/one/scripts/balance.ts
```

### Use

Talk to your OpenClaw agent via Telegram:

```
check my celo balance
swap 10 USDC to CELO
show AAVE APYs
set alert: CELO below $0.05
save $500 for a laptop by June
scan for arbitrage
```

## Architecture

```
one/
├── lib/                  # Shared modules (wallet, tokens, contracts, utils)
├── skills/one/           # The ONE skill
│   ├── SKILL.md          # Agent instructions (single entry point)
│   └── scripts/          # All DeFi scripts
│       ├── balance.ts        # Wallet balances
│       ├── quote.ts          # Swap quotes (Uniswap + Mento)
│       ├── swap.ts           # Execute swaps
│       ├── lend-positions.ts # AAVE positions & APYs
│       ├── lend-supply.ts    # Supply to AAVE
│       ├── lend-withdraw.ts  # Withdraw from AAVE
│       ├── lp-positions.ts   # Uniswap V3 LP positions
│       ├── arb-scan.ts       # Stablecoin arbitrage scanner
│       ├── savings-goal.ts   # Savings goal CRUD
│       ├── savings-sweep.ts  # Auto-sweep to AAVE
│       ├── alerts-set.ts     # Set price alerts
│       ├── alerts-list.ts    # List active alerts
│       └── alerts-check.ts   # Check alerts (cron)
├── scripts/              # Standalone utils
│   ├── balance.ts            # Quick balance check
│   └── register-8004.ts      # ERC-8004 agent registration
└── state/                # Runtime state (gitignored)
```

## How It Works

1. You message your OpenClaw agent
2. OpenClaw matches "swap", "lend", "balance", etc. to the **one** skill
3. The SKILL.md tells the agent exactly which script to run
4. Scripts use `viem` to interact with Celo smart contracts
5. JSON results come back, agent formats them for you

## Automation (Cron)

```bash
# Price alerts — every 30s
openclaw cron add --id one-alerts --every 30s --command "cd ~/one && npx tsx skills/one/scripts/alerts-check.ts"

# Arbitrage scanner — every 60s
openclaw cron add --id one-arb --every 60s --command "cd ~/one && npx tsx skills/one/scripts/arb-scan.ts"

# Auto-sweep idle stablecoins to AAVE — every 6h
openclaw cron add --id one-sweep --every 6h --command "cd ~/one && npx tsx skills/one/scripts/savings-sweep.ts"
```

## Tech Stack

- **[OpenClaw](https://openclaw.ai)** — Agent runtime (Telegram/Discord/WhatsApp)
- **[viem](https://viem.sh)** — TypeScript Ethereum library
- **[Uniswap V3](https://uniswap.org)** — DEX (swaps + concentrated LP)
- **[Mento](https://mento.org)** — Celo stablecoin exchange
- **[AAVE V3](https://aave.com)** — Lending protocol
- **[ERC-8004](https://agentscan.info)** — On-chain agent identity

## License

MIT
