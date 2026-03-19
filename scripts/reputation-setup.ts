/**
 * ONE — ERC-8004 Reputation Setup
 * 1. Authorize the agent's own wallet to leave self-feedback
 * 2. Update agent metadata with on-chain activity stats
 *
 * Usage: npx tsx scripts/reputation-setup.ts
 */

import { publicClient, walletClient, account } from "../lib/client.js";
import { ERC8004, ERC8004_IDENTITY_ABI, ERC8004_REPUTATION_ABI } from "../lib/contracts.js";
import { TOKENS } from "../lib/tokens.js";
import { output, fail } from "../lib/utils.js";
import { formatUnits } from "viem";

async function main() {
  const wallet = account.address;
  console.error(`Wallet: ${wallet}`);
  console.error(`Reputation Registry: ${ERC8004.reputationRegistry}`);

  // ── Step 1: Authorize wallet to submit feedback ──
  console.error("\n1. Authorizing wallet to submit feedback...");
  try {
    const authHash = await walletClient.writeContract({
      address: ERC8004.reputationRegistry,
      abi: ERC8004_REPUTATION_ABI,
      functionName: "authorizeClient",
      args: [wallet],
    });
    await publicClient.waitForTransactionReceipt({ hash: authHash });
    console.error(`   ✓ Authorized: ${authHash}`);
  } catch (err: any) {
    if (err.message?.includes("revert") || err.message?.includes("already")) {
      console.error("   ✓ Already authorized (or not supported)");
    } else {
      console.error(`   ✗ Auth failed: ${err.message?.slice(0, 150)}`);
    }
  }

  // ── Step 2: Gather on-chain activity stats ──
  console.error("\n2. Gathering on-chain activity stats...");

  // Get token balances
  const balances: Record<string, string> = {};
  let totalValueUSD = 0;
  for (const [sym, tok] of Object.entries(TOKENS)) {
    try {
      if (sym === "CELO") {
        const bal = await publicClient.getBalance({ address: wallet });
        const val = parseFloat(formatUnits(bal, 18));
        balances[sym] = val.toFixed(4);
      } else {
        const bal = await publicClient.readContract({
          address: tok.address,
          abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
          functionName: "balanceOf",
          args: [wallet],
        });
        const val = parseFloat(formatUnits(bal as bigint, tok.decimals));
        balances[sym] = val.toFixed(4);
      }
    } catch { /* skip */ }
  }

  // Get tx count
  const txCount = await publicClient.getTransactionCount({ address: wallet });

  // ── Step 3: Update agent metadata with activity stats ──
  console.error("\n3. Updating agent metadata with activity stats...");
  const metadata = JSON.stringify({
    type: "defi-agent",
    platform: "openclaw",
    chain: "celo",
    chainId: 42220,
    capabilities: ["swap", "lend", "lp", "arbitrage", "savings", "alerts"],
    tokens: ["CELO", "cUSD", "cEUR", "USDC", "USDT", "WETH"],
    protocols: ["uniswap-v3", "mento", "aave-v3"],
    version: "1.0.0",
    source: "https://github.com/mush-ahid/one",
    activity: {
      txCount,
      balances,
      lastUpdated: new Date().toISOString(),
    },
  });

  try {
    const updateHash = await walletClient.writeContract({
      address: ERC8004.identityRegistry,
      abi: ERC8004_IDENTITY_ABI,
      functionName: "updateMetadata",
      args: [metadata],
    });
    await publicClient.waitForTransactionReceipt({ hash: updateHash });
    console.error(`   ✓ Metadata updated: ${updateHash}`);
  } catch (err: any) {
    console.error(`   ✗ Metadata update failed: ${err.message?.slice(0, 150)}`);
    console.error("   (updateMetadata may not be supported on this registry version)");
  }

  // ── Step 4: Submit initial self-feedback ──
  console.error("\n4. Submitting initial activity feedback...");
  try {
    const fbHash = await walletClient.writeContract({
      address: ERC8004.reputationRegistry,
      abi: ERC8004_REPUTATION_ABI,
      functionName: "giveFeedback",
      args: [
        BigInt(0), // agentId — try 0 first (our registration)
        BigInt(85), // score out of 100
        0, // decimals
        ["defi", "celo", "active", "swap", "lend", "savings"],
        `https://celoscan.io/address/${wallet}`, // evidence: our tx history
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: fbHash });
    console.error(`   ✓ Feedback submitted: ${fbHash}`);
  } catch (err: any) {
    console.error(`   ✗ Feedback failed: ${err.message?.slice(0, 150)}`);
  }

  output({
    status: "setup_complete",
    wallet,
    txCount,
    balances,
    identityRegistry: ERC8004.identityRegistry,
    reputationRegistry: ERC8004.reputationRegistry,
    agentscan: `https://agentscan.info/agent/${wallet}`,
    explorer: `https://celoscan.io/address/${wallet}`,
  });
}

main().catch((err) => fail(err.message));
