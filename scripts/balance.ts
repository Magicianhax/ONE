import { publicClient, account } from "../lib/client.js";
import { TOKENS, type TokenInfo } from "../lib/tokens.js";
import { ERC20_ABI } from "../lib/contracts.js";
import { formatAmount } from "../lib/utils.js";

async function readBalance(token: TokenInfo): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    return formatAmount(balance as bigint, token.decimals);
  } catch {
    return "error";
  }
}

async function main() {
  console.log(`Wallet: ${account.address}`);
  console.log(`Chain:  Celo Mainnet (42220)\n`);

  // Native CELO balance
  const nativeBalance = await publicClient.getBalance({
    address: account.address,
  });
  console.log(`  CELO (native):  ${formatAmount(nativeBalance, 18)}`);

  // ERC-20 balances
  const entries = Object.values(TOKENS);
  const results = await Promise.all(
    entries.map(async (token) => ({
      symbol: token.symbol,
      balance: await readBalance(token),
    }))
  );

  for (const { symbol, balance } of results) {
    if (symbol === "CELO") continue; // Already shown as native
    console.log(`  ${symbol.padEnd(14)} ${balance}`);
  }
}

main().catch((err) => {
  console.error("Failed to read balances:", err.message);
  process.exit(1);
});
