/**
 * ONE Balance — Check wallet token balances on Celo
 *
 * Usage: npx tsx balance.ts [--token <SYMBOL|ADDRESS>]
 *   Without --token: shows all known token balances
 *   With --token: shows balance of a specific token (any ERC-20 address works)
 */

import { publicClient, account } from "../../../lib/client.js";
import { TOKENS, resolveTokenDynamic, type TokenInfo } from "../../../lib/tokens.js";
import { ERC20_ABI } from "../../../lib/contracts.js";
import { formatAmount, parseArgs, output, fail } from "../../../lib/utils.js";

async function getBalance(token: TokenInfo): Promise<{ symbol: string; balance: string; address: string }> {
  try {
    let raw: bigint;
    if (token.symbol === "CELO") {
      raw = await publicClient.getBalance({ address: account.address });
    } else {
      raw = (await publicClient.readContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      })) as bigint;
    }
    return {
      symbol: token.symbol,
      balance: formatAmount(raw, token.decimals),
      address: token.address,
    };
  } catch (err: any) {
    console.error(`Warning: failed to read ${token.symbol}: ${err.message?.slice(0, 80)}`);
    return { symbol: token.symbol, balance: "0", address: token.address };
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.token) {
    // Single token lookup — supports any ERC-20 address
    const token = await resolveTokenDynamic(args.token, publicClient);
    const result = await getBalance(token);
    output({
      wallet: account.address,
      chain: "Celo Mainnet (42220)",
      token: result,
    });
    return;
  }

  // All known tokens
  const entries = Object.values(TOKENS);
  const results = await Promise.all(entries.map(getBalance));

  // Filter to non-zero balances for cleaner output, but include all
  const balances: Record<string, string> = {};
  for (const r of results) {
    balances[r.symbol] = r.balance;
  }

  output({
    wallet: account.address,
    chain: "Celo Mainnet (42220)",
    balances,
    nonZero: results.filter((r) => parseFloat(r.balance) > 0).map((r) => ({
      symbol: r.symbol,
      balance: r.balance,
    })),
  });
}

main().catch((err) => fail(err.message));
