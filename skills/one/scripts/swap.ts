/**
 * ONE Swap — Execute Script
 * Executes a token swap on the specified venue.
 *
 * Usage: npx tsx execute.ts --from cUSD --to CELO --amount 10 --venue uniswap --slippage 50
 *   venue: "uniswap" or "mento"
 *   slippage: basis points (50 = 0.5%)
 */

import { publicClient, walletClient, account, celo } from "../../../lib/client.js";
import { resolveToken, TOKENS } from "../../../lib/tokens.js";
import {
  UNISWAP,
  MENTO,
  SWAP_ROUTER_ABI,
  MENTO_BROKER_ABI,
  QUOTER_V2_ABI,
  ERC20_ABI,
} from "../../../lib/contracts.js";
import {
  formatAmount,
  parseAmount,
  withSlippage,
  parseArgs,
  output,
  fail,
} from "../../../lib/utils.js";
import { type Address } from "viem";

const MENTO_PROVIDER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as Address;

const MENTO_EXCHANGES: Record<string, `0x${string}`> = {
  "cUSD/CELO": "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c",
  "CELO/cUSD": "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c",
  "cUSD/USDC": "0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7",
  "USDC/cUSD": "0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7",
  "cUSD/USDT": "0x773bcec109cee923b5e04706044fd9d6a5121b1a6a4c059c36fdbe5b845d4e9b",
  "USDT/cUSD": "0x773bcec109cee923b5e04706044fd9d6a5121b1a6a4c059c36fdbe5b845d4e9b",
  "cUSD/cEUR": "0x746455363e8f55d04e0a2cc040d1b348a6c031b336ba6af6ae91515c194929c8",
  "cEUR/cUSD": "0x746455363e8f55d04e0a2cc040d1b348a6c031b336ba6af6ae91515c194929c8",
};

const FEE_TIERS = [100, 500, 3000, 10000] as const;

async function ensureApproval(
  tokenAddr: Address,
  spender: Address,
  amount: bigint
): Promise<string | null> {
  const allowance = (await publicClient.readContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, spender],
  })) as bigint;

  if (allowance >= amount) return null;

  // Some tokens (USDC) require resetting to 0 before setting new allowance
  if (allowance > 0n) {
    const resetHash = await walletClient.writeContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash: resetHash });
  }

  // Approve max uint256 to avoid repeated approvals
  const maxApproval = 2n ** 256n - 1n;
  const hash = await walletClient.writeContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, maxApproval],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function findBestUniswapFee(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ fee: number; amountOut: bigint } | null> {
  let bestFee = 0;
  let bestOut = 0n;

  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const [amountOut] = result.result as readonly [bigint, bigint, number, bigint];
      if (amountOut > bestOut) {
        bestOut = amountOut;
        bestFee = fee;
      }
    } catch {
      // skip
    }
  }
  return bestOut > 0n ? { fee: bestFee, amountOut: bestOut } : null;
}

async function executeUniswap(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  slippageBps: number,
  decimalsOut: number
): Promise<{ txHash: string; amountOut: string }> {
  const best = await findBestUniswapFee(tokenIn, tokenOut, amountIn);
  if (!best) fail("No Uniswap V3 pool found for this pair");

  const amountOutMin = withSlippage(best.amountOut, slippageBps);

  // Approve
  const approvalHash = await ensureApproval(tokenIn, UNISWAP.swapRouter, amountIn);
  if (approvalHash) {
    console.error(`Approval tx: ${approvalHash}`);
  }

  // Execute swap
  const hash = await walletClient.writeContract({
    address: UNISWAP.swapRouter,
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee: best.fee,
        recipient: account.address,
        amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return {
    txHash: hash,
    amountOut: formatAmount(best.amountOut, decimalsOut),
  };
}

async function executeMento(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  exchangeId: `0x${string}`,
  slippageBps: number,
  decimalsOut: number
): Promise<{ txHash: string; amountOut: string }> {
  // Get expected output
  const expectedOut = (await publicClient.readContract({
    address: MENTO.broker,
    abi: MENTO_BROKER_ABI,
    functionName: "getAmountOut",
    args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn],
  })) as bigint;

  const amountOutMin = withSlippage(expectedOut, slippageBps);

  // Approve
  const approvalHash = await ensureApproval(tokenIn, MENTO.broker, amountIn);
  if (approvalHash) {
    console.error(`Approval tx: ${approvalHash}`);
  }

  // Execute swap
  const hash = await walletClient.writeContract({
    address: MENTO.broker,
    abi: MENTO_BROKER_ABI,
    functionName: "swapIn",
    args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn, amountOutMin],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return {
    txHash: hash,
    amountOut: formatAmount(expectedOut, decimalsOut),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fromStr = args.from;
  const toStr = args.to;
  const amountStr = args.amount;
  const venue = (args.venue || "").toLowerCase();
  const slippageBps = parseInt(args.slippage || "50", 10); // Default 0.5%

  if (!fromStr || !toStr || !amountStr || !venue) {
    fail("Usage: npx tsx execute.ts --from <TOKEN> --to <TOKEN> --amount <AMOUNT> --venue <uniswap|mento> [--slippage <BPS>]");
  }

  if (venue !== "uniswap" && venue !== "mento") {
    fail('venue must be "uniswap" or "mento"');
  }

  const fromToken = resolveToken(fromStr);
  const toToken = resolveToken(toStr);
  if (!fromToken) fail(`Unknown token: ${fromStr}`);
  if (!toToken) fail(`Unknown token: ${toStr}`);

  const amountIn = parseAmount(amountStr, fromToken.decimals);

  // Check balance
  const balance = (await publicClient.readContract({
    address: fromToken.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  if (balance < amountIn) {
    fail(
      `Insufficient balance: ${formatAmount(balance, fromToken.decimals)} ${fromToken.symbol} < ${amountStr} ${fromToken.symbol}`
    );
  }

  let result: { txHash: string; amountOut: string };

  if (venue === "uniswap") {
    result = await executeUniswap(
      fromToken.address,
      toToken.address,
      amountIn,
      slippageBps,
      toToken.decimals
    );
  } else {
    const pairKey = `${fromToken.symbol}/${toToken.symbol}`;
    const exchangeId = MENTO_EXCHANGES[pairKey];
    if (!exchangeId) {
      fail(
        `No Mento exchange for ${pairKey}. Available: ${Object.keys(MENTO_EXCHANGES).join(", ")}`
      );
    }
    result = await executeMento(
      fromToken.address,
      toToken.address,
      amountIn,
      exchangeId,
      slippageBps,
      toToken.decimals
    );
  }

  output({
    status: "success",
    venue,
    pair: `${fromToken.symbol} → ${toToken.symbol}`,
    amountIn: `${formatAmount(amountIn, fromToken.decimals)} ${fromToken.symbol}`,
    amountOut: `${result.amountOut} ${toToken.symbol}`,
    slippage: `${slippageBps / 100}%`,
    txHash: result.txHash,
    explorer: `https://celoscan.io/tx/${result.txHash}`,
  });
}

main().catch((err) => fail(err.message));
