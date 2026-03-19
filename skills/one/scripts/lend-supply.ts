/**
 * ONE Lend — Supply Script
 * Supply (deposit) tokens to AAVE V3 on Celo.
 *
 * Usage: npx tsx supply.ts --token cUSD --amount 10
 */

import { publicClient, walletClient, account } from "../../../lib/client.js";
import { resolveToken, TOKENS } from "../../../lib/tokens.js";
import { AAVE, AAVE_POOL_ABI, ERC20_ABI } from "../../../lib/contracts.js";
import { formatAmount, parseAmount, parseArgs, output, fail } from "../../../lib/utils.js";

async function ensureApproval(tokenAddr: `0x${string}`, amount: bigint): Promise<string | null> {
  const allowance = (await publicClient.readContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, AAVE.pool],
  })) as bigint;

  if (allowance >= amount) return null;

  if (allowance > 0n) {
    const resetHash = await walletClient.writeContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [AAVE.pool, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash: resetHash });
  }

  const maxApproval = 2n ** 256n - 1n;
  const hash = await walletClient.writeContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [AAVE.pool, maxApproval],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function main() {
  const args = parseArgs(process.argv);
  const tokenStr = args.token;
  const amountStr = args.amount;

  if (!tokenStr || !amountStr) {
    fail("Usage: npx tsx supply.ts --token <TOKEN> --amount <AMOUNT>");
  }

  const token = resolveToken(tokenStr);
  if (!token) fail(`Unknown token: ${tokenStr}. Supported: ${Object.keys(TOKENS).join(", ")}`);

  const amount = parseAmount(amountStr, token.decimals);

  // Check balance
  const balance = (await publicClient.readContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  if (balance < amount) {
    fail(`Insufficient balance: ${formatAmount(balance, token.decimals)} ${token.symbol} < ${amountStr}`);
  }

  // Approve
  const approvalHash = await ensureApproval(token.address, amount);
  if (approvalHash) {
    console.error(`Approval tx: ${approvalHash}`);
  }

  // Supply to AAVE
  const hash = await walletClient.writeContract({
    address: AAVE.pool,
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [token.address, amount, account.address, 0],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  output({
    status: "success",
    action: "supply",
    token: token.symbol,
    amount: `${formatAmount(amount, token.decimals)} ${token.symbol}`,
    txHash: hash,
    explorer: `https://celoscan.io/tx/${hash}`,
  });
}

main().catch((err) => fail(err.message));
