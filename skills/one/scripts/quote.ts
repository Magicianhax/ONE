/**
 * ONE Quote — Get swap quotes from Uniswap V3 and Mento on Celo
 *
 * Usage: npx tsx quote.ts --from <TOKEN|ADDRESS> --to <TOKEN|ADDRESS> --amount <AMOUNT>
 *   TOKEN can be a symbol (CELO, USDC, etc.) or any ERC-20 address on Celo
 */

import { publicClient, account } from "../../../lib/client.js";
import { resolveTokenDynamic } from "../../../lib/tokens.js";
import {
  UNISWAP,
  MENTO,
  MENTO_PROVIDER,
  MENTO_EXCHANGES,
  QUOTER_V2_ABI,
  MENTO_BROKER_ABI,
  ERC20_ABI,
} from "../../../lib/contracts.js";
import { formatAmount, parseAmount, parseArgs, output, fail } from "../../../lib/utils.js";
import { type Address } from "viem";

const FEE_TIERS = [100, 500, 3000, 10000] as const;

interface QuoteResult {
  venue: string;
  amountIn: string;
  amountOut: string;
  price: string;
  fee?: number;
  exchangeId?: string;
}

/** Get best Uniswap V3 quote across all fee tiers (parallel) */
async function getUniswapQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsIn: number,
  decimalsOut: number
): Promise<QuoteResult | null> {
  let bestOut = 0n;
  let bestFee = 0;

  const results = await Promise.allSettled(
    FEE_TIERS.map(async (fee) => {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      return { fee, amountOut };
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.amountOut > bestOut) {
      bestOut = r.value.amountOut;
      bestFee = r.value.fee;
    }
  }

  if (bestOut === 0n) return null;

  return {
    venue: "Uniswap V3",
    amountIn: formatAmount(amountIn, decimalsIn),
    amountOut: formatAmount(bestOut, decimalsOut),
    price: "",
    fee: bestFee,
  };
}

/** Get Mento quote */
async function getMentoQuote(
  exchangeId: `0x${string}`,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  decimalsIn: number,
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
      amountIn: formatAmount(amountIn, decimalsIn),
      amountOut: formatAmount(amountOut, decimalsOut),
      price: "",
      exchangeId,
    };
  } catch {
    return null;
  }
}

/** Find Mento exchange ID for a pair (either direction) */
function findMentoExchangeId(fromSymbol: string, toSymbol: string): `0x${string}` | null {
  return MENTO_EXCHANGES[`${fromSymbol}/${toSymbol}`] ||
         MENTO_EXCHANGES[`${toSymbol}/${fromSymbol}`] ||
         null;
}

async function main() {
  const args = parseArgs(process.argv);
  const fromStr = args.from;
  const toStr = args.to;
  const amountStr = args.amount;

  if (!fromStr || !toStr || !amountStr) {
    fail("Usage: npx tsx quote.ts --from <TOKEN|ADDRESS> --to <TOKEN|ADDRESS> --amount <AMOUNT>");
  }

  // Dynamic token resolution — any ERC-20 address works
  const fromToken = await resolveTokenDynamic(fromStr, publicClient);
  const toToken = await resolveTokenDynamic(toStr, publicClient);

  const amountIn = parseAmount(amountStr, fromToken.decimals);
  const formattedIn = formatAmount(amountIn, fromToken.decimals);

  // Check balance
  let balance: bigint;
  if (fromToken.symbol === "CELO") {
    balance = await publicClient.getBalance({ address: account.address });
  } else {
    balance = (await publicClient.readContract({
      address: fromToken.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;
  }

  // Get quotes in parallel
  const mentoId = findMentoExchangeId(fromToken.symbol, toToken.symbol);
  const [uniQuote, mentoQuote] = await Promise.all([
    getUniswapQuote(fromToken.address, toToken.address, amountIn, fromToken.decimals, toToken.decimals),
    mentoId
      ? getMentoQuote(mentoId, fromToken.address, toToken.address, amountIn, fromToken.decimals, toToken.decimals)
      : Promise.resolve(null),
  ]);

  // Compute prices
  const quotes: QuoteResult[] = [];
  for (const q of [uniQuote, mentoQuote]) {
    if (q) {
      q.price = (parseFloat(q.amountOut) / parseFloat(formattedIn)).toFixed(6);
      quotes.push(q);
    }
  }

  if (quotes.length === 0) {
    fail(`No quotes found for ${fromToken.symbol} → ${toToken.symbol}. No Uniswap pool or Mento exchange exists for this pair.`);
  }

  quotes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));

  output({
    pair: `${fromToken.symbol} → ${toToken.symbol}`,
    amountIn: `${formattedIn} ${fromToken.symbol}`,
    walletBalance: `${formatAmount(balance, fromToken.decimals)} ${fromToken.symbol}`,
    sufficient: balance >= amountIn,
    quotes: quotes.map((q, i) => ({ ...q, best: i === 0 })),
    recommendation:
      quotes.length > 1
        ? `${quotes[0].venue} gives ${quotes[0].amountOut} ${toToken.symbol} vs ${quotes[1].venue}'s ${quotes[1].amountOut} ${toToken.symbol}`
        : `Only ${quotes[0].venue} available: ${quotes[0].amountOut} ${toToken.symbol}`,
  });
}

main().catch((err) => fail(err.message));
