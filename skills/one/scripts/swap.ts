/**
 * ONE Swap — Execute a token swap on Celo
 *
 * Usage: npx tsx swap.ts --from <TOKEN|ADDRESS> --to <TOKEN|ADDRESS> --amount <AMOUNT> --venue <uniswap|mento> [--slippage <BPS>]
 *   venue: "uniswap" or "mento"
 *   slippage: basis points (50 = 0.5%, default)
 *   TOKEN can be a symbol (CELO, USDC, etc.) or any ERC-20 address on Celo
 */

import { publicClient, walletClient, account } from "../../../lib/client.js";
import { resolveTokenDynamic } from "../../../lib/tokens.js";
import {
  UNISWAP,
  MENTO,
  MENTO_PROVIDER,
  MENTO_EXCHANGES,
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
import { type Address, parseAbiItem, decodeEventLog } from "viem";

const FEE_TIERS = [100, 500, 3000, 10000] as const;

// Transfer event for parsing actual amountOut from receipt
const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

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

  // Approve only the exact amount needed (not max uint256)
  const hash = await walletClient.writeContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Parse Transfer events from receipt to find actual amount received */
function parseActualOutput(
  receipt: any,
  tokenOutAddr: Address,
  recipient: Address
): bigint | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenOutAddr.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if ((decoded.args as any).to?.toLowerCase() === recipient.toLowerCase()) {
        return (decoded.args as any).value as bigint;
      }
    } catch { continue; }
  }
  return null;
}

async function findBestUniswapFee(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ fee: number; amountOut: bigint } | null> {
  let bestFee = 0;
  let bestOut = 0n;

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

  return bestOut > 0n ? { fee: bestFee, amountOut: bestOut } : null;
}

async function executeUniswap(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  slippageBps: number,
  decimalsOut: number
): Promise<{ txHash: string; estimatedOut: string; actualOut: string }> {
  const best = await findBestUniswapFee(tokenIn, tokenOut, amountIn);
  if (!best) fail("No Uniswap V3 pool found for this pair");

  const amountOutMin = withSlippage(best.amountOut, slippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

  const approvalHash = await ensureApproval(tokenIn, UNISWAP.swapRouter, amountIn);
  if (approvalHash) console.error(`Approval tx: ${approvalHash}`);

  const hash = await walletClient.writeContract({
    address: UNISWAP.swapRouter,
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee: best.fee,
      recipient: account.address,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0n,
    }],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const actualOut = parseActualOutput(receipt, tokenOut, account.address);

  return {
    txHash: hash,
    estimatedOut: formatAmount(best.amountOut, decimalsOut),
    actualOut: actualOut ? formatAmount(actualOut, decimalsOut) : formatAmount(best.amountOut, decimalsOut),
  };
}

async function executeMento(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  exchangeId: `0x${string}`,
  slippageBps: number,
  decimalsOut: number
): Promise<{ txHash: string; estimatedOut: string; actualOut: string }> {
  const expectedOut = (await publicClient.readContract({
    address: MENTO.broker,
    abi: MENTO_BROKER_ABI,
    functionName: "getAmountOut",
    args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn],
  })) as bigint;

  const amountOutMin = withSlippage(expectedOut, slippageBps);

  const approvalHash = await ensureApproval(tokenIn, MENTO.broker, amountIn);
  if (approvalHash) console.error(`Approval tx: ${approvalHash}`);

  const hash = await walletClient.writeContract({
    address: MENTO.broker,
    abi: MENTO_BROKER_ABI,
    functionName: "swapIn",
    args: [MENTO_PROVIDER, exchangeId, tokenIn, tokenOut, amountIn, amountOutMin],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const actualOut = parseActualOutput(receipt, tokenOut, account.address);

  return {
    txHash: hash,
    estimatedOut: formatAmount(expectedOut, decimalsOut),
    actualOut: actualOut ? formatAmount(actualOut, decimalsOut) : formatAmount(expectedOut, decimalsOut),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fromStr = args.from;
  const toStr = args.to;
  const amountStr = args.amount;
  const venue = (args.venue || "").toLowerCase();
  const slippageBps = parseInt(args.slippage || "50", 10);

  if (!fromStr || !toStr || !amountStr || !venue) {
    fail("Usage: npx tsx swap.ts --from <TOKEN|ADDRESS> --to <TOKEN|ADDRESS> --amount <AMOUNT> --venue <uniswap|mento> [--slippage <BPS>]");
  }

  if (venue !== "uniswap" && venue !== "mento") {
    fail('venue must be "uniswap" or "mento"');
  }

  // Dynamic token resolution — works with any ERC-20 address on Celo
  const fromToken = await resolveTokenDynamic(fromStr, publicClient);
  const toToken = await resolveTokenDynamic(toStr, publicClient);

  const amountIn = parseAmount(amountStr, fromToken.decimals);

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

  if (balance < amountIn) {
    fail(`Insufficient balance: ${formatAmount(balance, fromToken.decimals)} ${fromToken.symbol} < ${amountStr} ${fromToken.symbol}`);
  }

  let result: { txHash: string; estimatedOut: string; actualOut: string };

  if (venue === "uniswap") {
    result = await executeUniswap(fromToken.address, toToken.address, amountIn, slippageBps, toToken.decimals);
  } else {
    const pairKey = `${fromToken.symbol}/${toToken.symbol}`;
    const exchangeId = MENTO_EXCHANGES[pairKey];
    if (!exchangeId) {
      fail(`No Mento exchange for ${pairKey}. Mento only supports cUSD pairs: ${Object.keys(MENTO_EXCHANGES).join(", ")}`);
    }
    result = await executeMento(fromToken.address, toToken.address, amountIn, exchangeId, slippageBps, toToken.decimals);
  }

  output({
    status: "success",
    venue,
    pair: `${fromToken.symbol} → ${toToken.symbol}`,
    amountIn: `${formatAmount(amountIn, fromToken.decimals)} ${fromToken.symbol}`,
    received: `${result.actualOut} ${toToken.symbol}`,
    estimated: `${result.estimatedOut} ${toToken.symbol}`,
    slippage: `${slippageBps / 100}%`,
    txHash: result.txHash,
    explorer: `https://celoscan.io/tx/${result.txHash}`,
  });
}

main().catch((err) => fail(err.message));
