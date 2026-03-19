/**
 * ONE Lend — Withdraw Script
 * Withdraw tokens from AAVE V3 on Celo.
 *
 * Usage: npx tsx withdraw.ts --token cUSD --amount 10
 *        npx tsx withdraw.ts --token cUSD --amount max  (withdraw all)
 */

import { publicClient, walletClient, account } from "../../../lib/client.js";
import { resolveToken, TOKENS } from "../../../lib/tokens.js";
import { AAVE, AAVE_POOL_ABI, AAVE_DATA_PROVIDER_ABI } from "../../../lib/contracts.js";
import { formatAmount, parseAmount, parseArgs, output, fail } from "../../../lib/utils.js";

async function main() {
  const args = parseArgs(process.argv);
  const tokenStr = args.token;
  const amountStr = args.amount;

  if (!tokenStr || !amountStr) {
    fail("Usage: npx tsx withdraw.ts --token <TOKEN> --amount <AMOUNT|max>");
  }

  const token = resolveToken(tokenStr);
  if (!token) fail(`Unknown token: ${tokenStr}. Supported: ${Object.keys(TOKENS).join(", ")}`);

  // Get current supply balance
  const userData = await publicClient.readContract({
    address: AAVE.poolDataProvider,
    abi: AAVE_DATA_PROVIDER_ABI,
    functionName: "getUserReserveData",
    args: [token.address, account.address],
  });
  const [aTokenBalance] = userData as readonly [bigint, ...bigint[]];

  if (aTokenBalance === 0n) {
    fail(`No ${token.symbol} supplied to AAVE`);
  }

  // max = withdraw everything
  const amount = amountStr.toLowerCase() === "max"
    ? 2n ** 256n - 1n // AAVE interprets max uint as "withdraw all"
    : parseAmount(amountStr, token.decimals);

  const displayAmount = amountStr.toLowerCase() === "max"
    ? formatAmount(aTokenBalance, token.decimals)
    : amountStr;

  // Withdraw
  const hash = await walletClient.writeContract({
    address: AAVE.pool,
    abi: AAVE_POOL_ABI,
    functionName: "withdraw",
    args: [token.address, amount, account.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  output({
    status: "success",
    action: "withdraw",
    token: token.symbol,
    amount: `${displayAmount} ${token.symbol}`,
    txHash: hash,
    explorer: `https://celoscan.io/tx/${hash}`,
  });
}

main().catch((err) => fail(err.message));
