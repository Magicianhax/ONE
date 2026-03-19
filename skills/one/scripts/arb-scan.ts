/**
 * ONE Arb — Stablecoin Arbitrage Scanner
 * Compare stablecoin prices between Uniswap V3 and Mento.
 *
 * Usage: npx tsx scan.ts [--threshold 0.3] [--execute]
 */

import { publicClient } from "../../../lib/client.js";
import { TOKENS } from "../../../lib/tokens.js";
import {
  UNISWAP,
  MENTO,
  QUOTER_V2_ABI,
  MENTO_BROKER_ABI,
} from "../../../lib/contracts.js";
import { formatAmount, parseAmount, parseArgs, output } from "../../../lib/utils.js";
import { type Address } from "viem";

const MENTO_PROVIDER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as Address;

const PAIRS: { name: string; from: string; to: string; mentoId: `0x${string}` }[] = [
  {
    name: "cUSD/USDC",
    from: "cUSD",
    to: "USDC",
    mentoId: "0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7",
  },
  {
    name: "cUSD/USDT",
    from: "cUSD",
    to: "USDT",
    mentoId: "0x773bcec109cee923b5e04706044fd9d6a5121b1a6a4c059c36fdbe5b845d4e9b",
  },
  {
    name: "cUSD/cEUR",
    from: "cUSD",
    to: "cEUR",
    mentoId: "0x746455363e8f55d04e0a2cc040d1b348a6c031b336ba6af6ae91515c194929c8",
  },
];

const FEE_TIERS = [100, 500, 3000] as const;

async function getUniswapPrice(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsOut: number
): Promise<number | null> {
  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      return parseFloat(formatAmount(amountOut, decimalsOut));
    } catch {
      continue;
    }
  }
  return null;
}

async function getMentoPrice(
  exchangeId: `0x${string}`,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsOut: number
): Promise<number | null> {
  try {
    const amountOut = (await publicClient.readContract({
      address: MENTO.broker,
      abi: MENTO_BROKER_ABI,
      functionName: "getAmountOut",
      args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn],
    })) as bigint;
    return parseFloat(formatAmount(amountOut, decimalsOut));
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const thresholdPct = parseFloat(args.threshold || "0.3");

  const opportunities: any[] = [];
  const scans: any[] = [];

  for (const pair of PAIRS) {
    const fromToken = TOKENS[pair.from];
    const toToken = TOKENS[pair.to];

    // Use 100 units as test amount for better precision
    const testAmount = parseAmount("100", fromToken.decimals);

    const [uniPrice, mentoPrice] = await Promise.all([
      getUniswapPrice(fromToken.address, toToken.address, testAmount, toToken.decimals),
      getMentoPrice(pair.mentoId, fromToken.address, toToken.address, testAmount, toToken.decimals),
    ]);

    if (uniPrice === null || mentoPrice === null) {
      scans.push({ pair: pair.name, uniswap: uniPrice, mento: mentoPrice, spread: "N/A" });
      continue;
    }

    // Spread as percentage
    const spread = ((Math.abs(uniPrice - mentoPrice) / Math.min(uniPrice, mentoPrice)) * 100);
    const direction = uniPrice > mentoPrice
      ? `Buy on Mento (${mentoPrice.toFixed(4)}), sell on Uniswap (${uniPrice.toFixed(4)})`
      : `Buy on Uniswap (${uniPrice.toFixed(4)}), sell on Mento (${mentoPrice.toFixed(4)})`;

    const scan = {
      pair: pair.name,
      uniswapOut: uniPrice.toFixed(6),
      mentoOut: mentoPrice.toFixed(6),
      spreadPct: spread.toFixed(4),
      profitable: spread > thresholdPct,
      direction,
    };
    scans.push(scan);

    if (spread > thresholdPct) {
      opportunities.push(scan);
    }
  }

  output({
    timestamp: new Date().toISOString(),
    threshold: `${thresholdPct}%`,
    testAmount: "100 units",
    scans,
    opportunities: opportunities.length > 0 ? opportunities : "No profitable opportunities above threshold",
  });
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
