# ONE

<img src="ui/public/logo.png" width="80" align="right" alt="ONE" />

Personal DeFi agent on Celo. Talk to it via Telegram or a 3D web UI — it swaps tokens, lends on AAVE, tracks arbitrage, saves toward goals, and monitors your portfolio. Works with any ERC-20 on Celo, not just a fixed token list.

Built as an [OpenClaw](https://openclaw.ai) skill. Registered on-chain via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004).

## The problem

Managing DeFi on Celo means juggling multiple UIs, copying contract addresses, calculating slippage, and switching between protocols. ONE consolidates all of it into chat. You say what you want, it figures out the contracts.

## What it does

| | |
|---|---|
| **Swap** | Any token on Celo. Quotes Uniswap V3 (all 4 fee tiers) and Mento in parallel, picks the best price. Pass a symbol or any `0x` address. |
| **Lend** | Supply/withdraw on AAVE V3. Shows APYs before you commit. |
| **Arbitrage** | Scans cUSD/USDC, cUSD/USDT, cUSD/cEUR spreads between Uniswap and Mento. |
| **Save** | Goal-based savings ("save $350 for a phone by September"). Deposits to AAVE for yield. |
| **Alert** | Price alerts with optional auto-trade. Monitor checks every 30s. |
| **Market** | Real-time prices, trending tokens, history via [CoinGecko CLI](https://github.com/coingecko/coingecko-cli). |
| **Monitor** | Background daemon polls balances (5min), arb (1min), alerts (30s). Zero LLM cost — only triggers the agent when something happens. |

## Status

This is a hackathon project (Celo Hackathon V2). **Unaudited. Use with small amounts.**

- Private keys stay local (read from `.env`, never sent anywhere)
- Swap approvals are exact amounts only (not unlimited `uint256.max`)
- Every transaction requires explicit confirmation before execution
- AAVE supply uses unlimited approval to the AAVE V3 pool (we disclose this)

## Setup

You need: **Node.js 20+**, **[OpenClaw](https://openclaw.ai)**, a Celo wallet with some CELO for gas.

```bash
git clone https://github.com/Magicianhax/ONE.git
cd ONE
cp .env.example .env       # add your PRIVATE_KEY
bash install.sh             # installs deps + deploys skill to OpenClaw
```

Optional — market data:
```bash
curl -sSfL https://raw.githubusercontent.com/coingecko/coingecko-cli/main/install.sh | sh
cg auth                     # free API key from coingecko.com/en/api
```

Optional — 3D web UI:
```bash
cd ui && npm install && npm run start
# Express + WS on :3002, Vite on :5173
```

Optional — background monitor:
```bash
npx tsx scripts/monitor.ts  # runs 24/7, zero LLM cost
```

### Verify it works

```bash
npx tsx skills/one/scripts/balance.ts
# → JSON with your wallet address and token balances

npx tsx skills/one/scripts/quote.ts --from CELO --to USDC --amount 1
# → quotes from Uniswap V3 and Mento

cg price --symbols celo -o json
# → {"celo":{"usd":0.0812,"usd_24h_change":2.83}}
```

## Usage

Via Telegram (through OpenClaw) or the web chat:

```
check my balance
swap 10 USDC to CELO
swap 100 CELO to 0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58
show AAVE APYs
supply 50 USDC to AAVE
what's the price of CELO?
save $350 for a phone by September
set alert: CELO below $0.05
scan for arbitrage
what's trending?
```

Any token works — use a symbol or paste a contract address. The agent fetches metadata (symbol, decimals) from the chain automatically.

## How it works

```
You → OpenClaw agent → SKILL.md (intent → script mapping) → npx tsx script → viem → Celo contracts
```

Each script is a standalone CLI that outputs JSON. The agent reads SKILL.md to know which script to run for each user intent. Scripts share `lib/` (wallet client, token registry, contract ABIs) but don't import each other.

For unknown tokens, `resolveTokenDynamic()` calls `symbol()` and `decimals()` on the contract address — so the agent isn't limited to a hardcoded list.

## Project structure

```
lib/                → Shared: viem client, token registry, contract ABIs, utils
skills/one/         → The OpenClaw skill
  SKILL.md          → Agent instructions (triggers → scripts → response format)
  scripts/          → 14 standalone DeFi scripts (balance, quote, swap, lend, arb, savings, alerts...)
scripts/            → Standalone utils (monitor daemon, ERC-8004 registration)
ui/                 → Three.js 3D room + Express server + chat interface
state/              → Runtime JSON state (gitignored)
```

## Things that were harder than expected

**Mento only routes through cUSD.** Want USDC → USDT? It's USDC → cUSD → USDT (two swaps). Took a while to realize this wasn't a bug.

**Uniswap V3 has 4 fee tiers** (0.01%, 0.05%, 0.3%, 1%). Same pair can exist on multiple tiers with different liquidity. We scan all 4 in parallel and pick the best output.

**Token metadata resolution** adds ~500ms per unknown token (on-chain calls for symbol + decimals). Worth it to support any token without a fixed list.

**ERC-8004 registration** uses a base64-encoded JSON agentURI stored on-chain. The spec is still in draft and docs are thin — we learned mostly by reading contracts.

**The 3D room** was originally just a demo gimmick, then it became the main UI. The agent physically walks to different room objects (desk for swaps, vault for AAVE, piggy bank for savings). Camera zooms into the desk monitor for transaction approval. All Three.js, no game engine.

## 3D room UI

The web UI is a Three.js isometric bedroom where a cartoon agent character lives:

- Walks to **desk** for swaps/balance — sits in chair, camera zooms to monitor showing real action data, approve/decline on screen
- Opens the **vault** door for AAVE lending
- Drops a coin into the **piggy bank** for savings deposits
- Day/night cycle with sleep/wake animations
- Click piggy bank or vault for info card popups
- Markdown rendering in chat (tables, links, bold, code)

## Tech

[OpenClaw](https://openclaw.ai) (agent runtime) · [viem](https://viem.sh) (Celo client) · [Uniswap V3](https://uniswap.org) (DEX) · [Mento](https://mento.org) (stablecoin exchange) · [AAVE V3](https://aave.com) (lending) · [Three.js](https://threejs.org) (3D) · [CoinGecko CLI](https://github.com/coingecko/coingecko-cli) (market data) · [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (on-chain identity)

## Contributing

Areas that need work:

- **More protocols** — Curve, Ubeswap, SushiSwap on Celo
- **Multi-hop routing** — TOKEN → cUSD → TARGET in one command
- **Uniswap V4** when it launches on Celo
- **Mobile 3D room** — Three.js on mobile is rough
- **Dynamic pool discovery** via Celo subgraph instead of scanning fee tiers
- **Borrowing on AAVE** — currently supply/withdraw only

Each script in `skills/one/scripts/` is self-contained (<200 lines). Pick one and improve it.

## License

MIT
