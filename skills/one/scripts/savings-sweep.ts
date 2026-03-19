/**
 * ONE Savings — Auto-Sweep
 * Check idle balances and deposit excess to AAVE for yield.
 * Designed to run on cron (every 6h).
 *
 * Usage: npx tsx sweep.ts [--min-idle 5]
 */

import { publicClient, walletClient, account } from "../../../lib/client.js";
import { TOKENS } from "../../../lib/tokens.js";
import { AAVE, AAVE_POOL_ABI, ERC20_ABI } from "../../../lib/contracts.js";
import { getGoals } from "../../../lib/state.js";
import { formatAmount, parseArgs, output } from "../../../lib/utils.js";

// Tokens eligible for AAVE supply (WETH not supported on AAVE Celo)
const SWEEPABLE = ["cUSD", "USDC", "USDT", "cEUR"] as const;

async function ensureApproval(tokenAddr: `0x${string}`, amount: bigint): Promise<void> {
  const allowance = (await publicClient.readContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, AAVE.pool],
  })) as bigint;

  if (allowance >= amount) return;

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
}

async function main() {
  const args = parseArgs(process.argv);
  const minIdle = parseFloat(args["min-idle"] || "5"); // Minimum idle balance to sweep

  const goals = getGoals().filter((g) => g.strategy === "aave");
  const swept: { token: string; amount: string; txHash: string }[] = [];

  for (const symbol of SWEEPABLE) {
    const token = TOKENS[symbol];
    const balance = (await publicClient.readContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;

    const balanceNum = parseFloat(formatAmount(balance, token.decimals));

    // Only sweep if above minimum threshold
    if (balanceNum <= minIdle) continue;

    // Keep minIdle in wallet, sweep the rest
    const keepRaw = BigInt(Math.floor(minIdle * 10 ** token.decimals));
    const sweepAmount = balance - keepRaw;

    if (sweepAmount <= 0n) continue;

    try {
      await ensureApproval(token.address, sweepAmount);

      const hash = await walletClient.writeContract({
        address: AAVE.pool,
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [token.address, sweepAmount, account.address, 0],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      swept.push({
        token: symbol,
        amount: formatAmount(sweepAmount, token.decimals),
        txHash: hash,
      });
    } catch (err: any) {
      console.error(`Failed to sweep ${symbol}: ${err.message}`);
    }
  }

  output({
    timestamp: new Date().toISOString(),
    minIdleThreshold: minIdle,
    activeGoals: goals.length,
    swept: swept.length > 0 ? swept : "No tokens above idle threshold",
  });
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
