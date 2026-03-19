/**
 * ONE Background Monitor
 *
 * Part of the ONE skill. Lightweight daemon that polls on-chain data
 * directly via RPC (zero LLM cost). Only triggers the agent when
 * something noteworthy happens.
 *
 * Writes latest state to ~/one/state/monitor.json so the agent can
 * read it anytime (e.g. "what does the monitor show?").
 *
 * Usage: npx tsx skills/one/scripts/monitor.ts
 *   or:  npx tsx scripts/monitor.ts
 */

import { publicClient, account } from "../lib/client.js";
import { TOKENS, type TokenInfo } from "../lib/tokens.js";
import { ERC20_ABI, UNISWAP, MENTO, QUOTER_V2_ABI, MENTO_BROKER_ABI } from "../lib/contracts.js";
import { formatAmount, parseAmount } from "../lib/utils.js";
import { getAlerts, saveAlerts, writeState, readState } from "../lib/state.js";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { type Address } from "viem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || path.join(
  process.env.HOME || "/home/mushahid",
  ".npm-global/bin/openclaw"
);

// ── Config ──────────────────────────────────────────────────────
const BALANCE_INTERVAL = 5 * 60 * 1000;  // 5 min
const ARB_INTERVAL = 60 * 1000;           // 1 min
const ALERT_INTERVAL = 30 * 1000;         // 30 sec
const BALANCE_CHANGE_THRESHOLD = 0.05;    // 5% change triggers agent
const ARB_SPREAD_THRESHOLD = 0.3;         // 0.3% spread triggers agent

// ── State ───────────────────────────────────────────────────────
const lastBalances: Record<string, number> = {};
const MENTO_PROVIDER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as Address;
const FEE_TIERS = [100, 500, 3000] as const;

const ARB_PAIRS = [
  { name: "cUSD/USDC", from: "cUSD", to: "USDC", mentoId: "0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7" as `0x${string}` },
  { name: "cUSD/USDT", from: "cUSD", to: "USDT", mentoId: "0x773bcec109cee923b5e04706044fd9d6a5121b1a6a4c059c36fdbe5b845d4e9b" as `0x${string}` },
];

// ── Notify Agent ────────────────────────────────────────────────
function notifyAgent(message: string): void {
  console.log(`[monitor] TRIGGER → ${message}`);
  execFile(
    OPENCLAW_BIN,
    ["agent", "-m", message, "--session-id", "one-monitor"],
    { cwd: PROJECT_ROOT, timeout: 120000, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      if (error) {
        console.error(`[monitor] agent error: ${stderr || error.message}`);
      } else {
        console.log(`[monitor] agent responded`);
      }
    }
  );
}

// ── Balance Monitor ─────────────────────────────────────────────
async function checkBalances(): Promise<void> {
  try {
    // Native CELO
    const nativeBal = await publicClient.getBalance({ address: account.address });
    const celoAmount = parseFloat(formatAmount(nativeBal, 18));

    // ERC-20 tokens
    const balances: Record<string, number> = { CELO: celoAmount };
    for (const token of Object.values(TOKENS)) {
      if (token.symbol === "CELO") continue;
      try {
        const bal = await publicClient.readContract({
          address: token.address, abi: ERC20_ABI,
          functionName: "balanceOf", args: [account.address],
        }) as bigint;
        balances[token.symbol] = parseFloat(formatAmount(bal, token.decimals));
      } catch { balances[token.symbol] = 0; }
    }

    // Check for significant changes
    const changes: string[] = [];
    for (const [symbol, amount] of Object.entries(balances)) {
      const prev = lastBalances[symbol];
      if (prev !== undefined && prev > 0) {
        const change = Math.abs(amount - prev) / prev;
        if (change > BALANCE_CHANGE_THRESHOLD) {
          const direction = amount > prev ? "increased" : "decreased";
          changes.push(`${symbol} ${direction} by ${(change * 100).toFixed(1)}% (${prev.toFixed(4)} → ${amount.toFixed(4)})`);
        }
      }
      lastBalances[symbol] = amount;
    }

    if (changes.length > 0) {
      notifyAgent(`Balance alert: ${changes.join(", ")}. Check what happened and report.`);
    }

    const summary = Object.entries(balances).map(([s, a]) => `${s}: ${a.toFixed(4)}`).join(", ");
    console.log(`[balance] ${summary}`);

    // Write to state file for agent access
    writeState("monitor.json", {
      ...readState("monitor.json", {} as any),
      wallet: account.address,
      balances,
      balancesUpdatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[balance] error: ${err.message}`);
  }
}

// ── Arbitrage Monitor ───────────────────────────────────────────
async function getUniPrice(tokenIn: Address, tokenOut: Address, amountIn: bigint, decimalsOut: number): Promise<number | null> {
  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2, abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      return parseFloat(formatAmount(amountOut, decimalsOut));
    } catch { continue; }
  }
  return null;
}

async function getMentoPrice(exchangeId: `0x${string}`, tokenIn: Address, tokenOut: Address, amountIn: bigint, decimalsOut: number): Promise<number | null> {
  try {
    const amountOut = await publicClient.readContract({
      address: MENTO.broker, abi: MENTO_BROKER_ABI,
      functionName: "getAmountOut",
      args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn],
    }) as bigint;
    return parseFloat(formatAmount(amountOut, decimalsOut));
  } catch { return null; }
}

async function checkArbitrage(): Promise<void> {
  const arbResults: any[] = [];
  try {
    for (const pair of ARB_PAIRS) {
      const fromToken = TOKENS[pair.from];
      const toToken = TOKENS[pair.to];
      const testAmount = parseAmount("100", fromToken.decimals);

      const [uniPrice, mentoPrice] = await Promise.all([
        getUniPrice(fromToken.address, toToken.address, testAmount, toToken.decimals),
        getMentoPrice(pair.mentoId, fromToken.address, toToken.address, testAmount, toToken.decimals),
      ]);

      if (uniPrice === null || mentoPrice === null) continue;

      const spread = ((Math.abs(uniPrice - mentoPrice) / Math.min(uniPrice, mentoPrice)) * 100);
      const direction = uniPrice > mentoPrice
        ? `Buy Mento (${mentoPrice.toFixed(4)}), sell Uniswap (${uniPrice.toFixed(4)})`
        : `Buy Uniswap (${uniPrice.toFixed(4)}), sell Mento (${mentoPrice.toFixed(4)})`;

      console.log(`[arb] ${pair.name}: spread ${spread.toFixed(4)}% | ${direction}`);
      arbResults.push({ pair: pair.name, uniPrice, mentoPrice, spread, direction, profitable: spread > ARB_SPREAD_THRESHOLD });

      if (spread > ARB_SPREAD_THRESHOLD) {
        notifyAgent(`Arbitrage opportunity found! ${pair.name} spread is ${spread.toFixed(3)}%. ${direction}. Analyze if this is worth executing.`);
      }
    }

    // Write arb state
    writeState("monitor.json", {
      ...readState("monitor.json", {} as any),
      arbitrage: arbResults,
      arbUpdatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[arb] error: ${err.message}`);
  }
}

// ── Alert Monitor ───────────────────────────────────────────────
async function getUSDPrice(tokenSymbol: string): Promise<number | null> {
  if (["cUSD", "USDC", "USDT"].includes(tokenSymbol)) return 1.0;

  const token = TOKENS[tokenSymbol];
  const cUSD = TOKENS["cUSD"];
  if (!token || !cUSD) return null;

  const oneUnit = parseAmount("1", token.decimals);
  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2, abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: token.address, tokenOut: cUSD.address, amountIn: oneUnit, fee, sqrtPriceLimitX96: 0n }],
      });
      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      return parseFloat(formatAmount(amountOut, cUSD.decimals));
    } catch { continue; }
  }
  return null;
}

async function checkAlerts(): Promise<void> {
  try {
    const alerts = getAlerts();
    const active = alerts.filter(a => !a.triggered);
    if (active.length === 0) return;

    const tokenSymbols = [...new Set(active.map(a => a.token))];
    const prices: Record<string, number | null> = {};
    for (const symbol of tokenSymbols) {
      prices[symbol] = await getUSDPrice(symbol);
    }

    const triggered: string[] = [];
    for (const alert of active) {
      const price = prices[alert.token];
      if (price === null) continue;

      let met = false;
      if (alert.condition === "below" && price < alert.price) met = true;
      if (alert.condition === "above" && price > alert.price) met = true;

      if (met) {
        alert.triggered = true;
        triggered.push(
          `${alert.token} is now $${price.toFixed(4)} (${alert.condition} $${alert.price})` +
          (alert.action !== "notify" ? ` — auto-action: ${alert.action} ${alert.actionAmount || ""} ${alert.actionToken || alert.token}` : "")
        );
      }
    }

    if (triggered.length > 0) {
      saveAlerts(alerts);
      notifyAgent(`Price alert triggered! ${triggered.join(". ")}. Take the appropriate action.`);
    }

    const priceLog = Object.entries(prices).filter(([, p]) => p !== null).map(([s, p]) => `${s}: $${p!.toFixed(4)}`).join(", ");
    if (priceLog) console.log(`[alerts] prices: ${priceLog} | ${active.length} active`);

    // Write prices + alert state
    writeState("monitor.json", {
      ...readState("monitor.json", {} as any),
      prices: Object.fromEntries(Object.entries(prices).filter(([, p]) => p !== null)),
      activeAlerts: active.length,
      alertsUpdatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[alerts] error: ${err.message}`);
  }
}

// ── Main Loop ───────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════");
console.log("  ONE Background Monitor");
console.log(`  Wallet: ${account.address}`);
console.log(`  Balance check: every ${BALANCE_INTERVAL / 1000}s`);
console.log(`  Arb scan:      every ${ARB_INTERVAL / 1000}s`);
console.log(`  Alert check:   every ${ALERT_INTERVAL / 1000}s`);
console.log(`  Arb threshold: ${ARB_SPREAD_THRESHOLD}%`);
console.log(`  Balance threshold: ${(BALANCE_CHANGE_THRESHOLD * 100)}%`);
console.log("═══════════════════════════════════════════════════\n");

// Initial run
checkBalances();
checkArbitrage();
checkAlerts();

// Scheduled loops
setInterval(checkBalances, BALANCE_INTERVAL);
setInterval(checkArbitrage, ARB_INTERVAL);
setInterval(checkAlerts, ALERT_INTERVAL);
