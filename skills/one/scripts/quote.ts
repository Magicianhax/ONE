/**
 * ONE Swap — Quote Script
 * Gets swap quotes from both Uniswap V3 and Mento, compares prices.
 *
 * Usage: npx tsx quote.ts --from cUSD --to CELO --amount 10
 */

import { publicClient, account } from "../../../lib/client.js";
import { resolveToken, TOKENS } from "../../../lib/tokens.js";
import {
  UNISWAP,
  MENTO,
  QUOTER_V2_ABI,
  MENTO_BROKER_ABI,
  ERC20_ABI,
} from "../../../lib/contracts.js";
import { formatAmount, parseAmount, parseArgs, output, fail } from "../../../lib/utils.js";
import { type Address } from "viem";

// Mento exchange provider (BiPoolManager)
const MENTO_PROVIDER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as Address;

// Known Mento exchange IDs for our supported pairs
// All pairs are against cUSD (asset0 = cUSD)
const MENTO_EXCHANGES: Record<string, { id: `0x${string}`; asset0: string; asset1: string }> = {
  "cUSD/CELO": {
    id: "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c",
    asset0: "cUSD",
    asset1: "CELO",
  },
  "cUSD/USDC": {
    id: "0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7",
    asset0: "cUSD",
    asset1: "USDC",
  },
  "cUSD/USDT": {
    id: "0x773bcec109cee923b5e04706044fd9d6a5121b1a6a4c059c36fdbe5b845d4e9b",
    asset0: "cUSD",
    asset1: "USDT",
  },
  "cUSD/cEUR": {
    id: "0x746455363e8f55d04e0a2cc040d1b348a6c031b336ba6af6ae91515c194929c8",
    asset0: "cUSD",
    asset1: "cEUR",
  },
};

// Uniswap V3 fee tiers to try
const FEE_TIERS = [100, 500, 3000, 10000] as const;

interface QuoteResult {
  venue: string;
  amountIn: string;
  amountOut: string;
  price: string;
  fee?: number;
  exchangeId?: string;
}

/** Find the Mento exchange key for a given token pair */
function findMentoExchange(
  fromSymbol: string,
  toSymbol: string
): { key: string; exchangeId: `0x${string}` } | null {
  // Try direct match
  const directKey = `${fromSymbol}/${toSymbol}`;
  if (MENTO_EXCHANGES[directKey]) {
    return { key: directKey, exchangeId: MENTO_EXCHANGES[directKey].id };
  }
  // Try reverse
  const reverseKey = `${toSymbol}/${fromSymbol}`;
  if (MENTO_EXCHANGES[reverseKey]) {
    return { key: reverseKey, exchangeId: MENTO_EXCHANGES[reverseKey].id };
  }
  return null;
}

/** Get Uniswap V3 quote */
async function getUniswapQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsOut: number
): Promise<QuoteResult | null> {
  let bestQuote: QuoteResult | null = null;
  let bestAmountOut = 0n;

  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      if (amountOut > bestAmountOut) {
        bestAmountOut = amountOut;
        bestQuote = {
          venue: "Uniswap V3",
          amountIn: formatAmount(amountIn, 18), // Will be overwritten with proper decimals
          amountOut: formatAmount(amountOut, decimalsOut),
          price: "", // Computed below
          fee,
        };
      }
    } catch {
      // Pool doesn't exist for this fee tier, skip
    }
  }
  return bestQuote;
}

/** Get Mento quote */
async function getMentoQuote(
  exchangeId: `0x${string}`,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsOut: number
): Promise<QuoteResult | null> {
  try {
    const amountOut = (await publicClient.readContract({
      address: MENTO.broker,
      abi: MENTO_BROKER_ABI,
      functionName: "getAmountOut",
      args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn],
    })) as bigint;

    return {
      venue: "Mento",
      amountIn: "", // Will be set by caller
      amountOut: formatAmount(amountOut, decimalsOut),
      price: "",
      exchangeId,
    };
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const fromStr = args.from;
  const toStr = args.to;
  const amountStr = args.amount;

  if (!fromStr || !toStr || !amountStr) {
    fail("Usage: npx tsx quote.ts --from <TOKEN> --to <TOKEN> --amount <AMOUNT>");
  }

  const fromToken = resolveToken(fromStr);
  const toToken = resolveToken(toStr);
  if (!fromToken) fail(`Unknown token: ${fromStr}. Supported: ${Object.keys(TOKENS).join(", ")}`);
  if (!toToken) fail(`Unknown token: ${toStr}. Supported: ${Object.keys(TOKENS).join(", ")}`);

  const amountIn = parseAmount(amountStr, fromToken.decimals);
  const formattedIn = formatAmount(amountIn, fromToken.decimals);

  // Check balance
  const balance = (await publicClient.readContract({
    address: fromToken.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  const hasBalance = balance >= amountIn;

  // Get quotes in parallel
  const [uniQuote, mentoQuote] = await Promise.all([
    getUniswapQuote(fromToken.address, toToken.address, amountIn, toToken.decimals),
    (async () => {
      const exchange = findMentoExchange(fromToken.symbol, toToken.symbol);
      if (!exchange) return null;
      return getMentoQuote(
        exchange.exchangeId,
        fromToken.address,
        toToken.address,
        amountIn,
        toToken.decimals
      );
    })(),
  ]);

  // Compute prices
  const quotes: QuoteResult[] = [];
  if (uniQuote) {
    uniQuote.amountIn = formattedIn;
    uniQuote.price = (parseFloat(uniQuote.amountOut) / parseFloat(formattedIn)).toFixed(6);
    quotes.push(uniQuote);
  }
  if (mentoQuote) {
    mentoQuote.amountIn = formattedIn;
    mentoQuote.price = (parseFloat(mentoQuote.amountOut) / parseFloat(formattedIn)).toFixed(6);
    quotes.push(mentoQuote);
  }

  if (quotes.length === 0) {
    fail(`No quotes found for ${fromToken.symbol} → ${toToken.symbol}. This pair may not be available on Uniswap or Mento.`);
  }

  // Sort by best output (descending)
  quotes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));

  output({
    pair: `${fromToken.symbol} → ${toToken.symbol}`,
    amountIn: `${formattedIn} ${fromToken.symbol}`,
    walletBalance: `${formatAmount(balance, fromToken.decimals)} ${fromToken.symbol}`,
    sufficient: hasBalance,
    quotes: quotes.map((q, i) => ({
      ...q,
      best: i === 0,
    })),
    recommendation:
      quotes.length > 1
        ? `${quotes[0].venue} gives ${quotes[0].amountOut} ${toToken.symbol} vs ${quotes[1].venue}'s ${quotes[1].amountOut} ${toToken.symbol}`
        : `Only ${quotes[0].venue} available: ${quotes[0].amountOut} ${toToken.symbol}`,
  });
}

main().catch((err) => fail(err.message));
