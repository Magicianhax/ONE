/**
 * ONE Alerts — Check Script
 * Check all active alerts against live prices. Trigger if conditions met.
 *
 * Usage: npx tsx check.ts
 * Designed to run on a cron (every 30s).
 */

import { publicClient } from "../../../lib/client.js";
import { resolveToken } from "../../../lib/tokens.js";
import { UNISWAP, QUOTER_V2_ABI } from "../../../lib/contracts.js";
import { getAlerts, saveAlerts, type PriceAlert } from "../../../lib/state.js";
import { parseAmount, formatAmount, output } from "../../../lib/utils.js";

const FEE_TIERS = [100, 500, 3000, 10000] as const;

/** Get USD price of a token by quoting against cUSD on Uniswap V3 */
async function getUSDPrice(tokenSymbol: string): Promise<number | null> {
  if (tokenSymbol === "cUSD" || tokenSymbol === "USDC" || tokenSymbol === "USDT") {
    return 1.0; // Stablecoins ~ $1
  }

  const token = resolveToken(tokenSymbol);
  const cUSD = resolveToken("cUSD");
  if (!token || !cUSD) return null;

  // Quote 1 unit of token → cUSD
  const oneUnit = parseAmount("1", token.decimals);

  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: token.address,
            tokenOut: cUSD.address,
            amountIn: oneUnit,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      return parseFloat(formatAmount(amountOut, cUSD.decimals));
    } catch {
      continue;
    }
  }
  return null;
}

async function main() {
  const alerts = getAlerts();
  const active = alerts.filter((a) => !a.triggered);

  if (active.length === 0) {
    output({ status: "no_active_alerts" });
    return;
  }

  const triggered: { alert: PriceAlert; currentPrice: number }[] = [];
  const checked: { id: string; token: string; price: number | null; condition: string; target: number; met: boolean }[] = [];

  // Get unique tokens to price
  const tokenSymbols = [...new Set(active.map((a) => a.token))];
  const prices: Record<string, number | null> = {};
  for (const symbol of tokenSymbols) {
    prices[symbol] = await getUSDPrice(symbol);
  }

  for (const alert of active) {
    const currentPrice = prices[alert.token];
    let met = false;

    if (currentPrice !== null) {
      if (alert.condition === "below" && currentPrice < alert.price) met = true;
      if (alert.condition === "above" && currentPrice > alert.price) met = true;
    }

    checked.push({
      id: alert.id,
      token: alert.token,
      price: currentPrice,
      condition: alert.condition,
      target: alert.price,
      met,
    });

    if (met) {
      alert.triggered = true;
      triggered.push({ alert, currentPrice: currentPrice! });
    }
  }

  if (triggered.length > 0) {
    saveAlerts(alerts);
  }

  output({
    timestamp: new Date().toISOString(),
    checkedCount: active.length,
    prices,
    triggered: triggered.map(({ alert, currentPrice }) => ({
      id: alert.id,
      rule: `${alert.token} ${alert.condition} $${alert.price}`,
      currentPrice: `$${currentPrice}`,
      action: alert.action,
      actionAmount: alert.actionAmount,
      actionToken: alert.actionToken,
    })),
    results: checked,
  });
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
