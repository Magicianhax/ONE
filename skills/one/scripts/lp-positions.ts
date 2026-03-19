/**
 * ONE LP — View Uniswap V3 Positions
 *
 * Usage: npx tsx positions.ts
 */

import { publicClient, account } from "../../../lib/client.js";
import { UNISWAP } from "../../../lib/contracts.js";
import { TOKENS } from "../../../lib/tokens.js";
import { formatAmount, output, fail } from "../../../lib/utils.js";
import { type Address } from "viem";

const NFT_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

function findTokenSymbol(addr: string): string {
  const lower = addr.toLowerCase();
  for (const token of Object.values(TOKENS)) {
    if (token.address.toLowerCase() === lower) return token.symbol;
  }
  return addr.slice(0, 10) + "...";
}

async function main() {
  const nftCount = (await publicClient.readContract({
    address: UNISWAP.positionManager,
    abi: NFT_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  if (nftCount === 0n) {
    output({ positions: "No Uniswap V3 LP positions", total: 0 });
    return;
  }

  const positions: any[] = [];

  for (let i = 0n; i < nftCount; i++) {
    const tokenId = (await publicClient.readContract({
      address: UNISWAP.positionManager,
      abi: NFT_ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [account.address, i],
    })) as bigint;

    const pos = (await publicClient.readContract({
      address: UNISWAP.positionManager,
      abi: NFT_ABI,
      functionName: "positions",
      args: [tokenId],
    })) as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint];

    const [, , token0, token1, fee, tickLower, tickUpper, liquidity, , , tokensOwed0, tokensOwed1] = pos;

    if (liquidity === 0n && tokensOwed0 === 0n && tokensOwed1 === 0n) continue;

    const token0Symbol = findTokenSymbol(token0);
    const token1Symbol = findTokenSymbol(token1);
    const token0Info = Object.values(TOKENS).find((t) => t.address.toLowerCase() === token0.toLowerCase());
    const token1Info = Object.values(TOKENS).find((t) => t.address.toLowerCase() === token1.toLowerCase());

    positions.push({
      tokenId: tokenId.toString(),
      pair: `${token0Symbol}/${token1Symbol}`,
      fee: `${fee / 10000}%`,
      tickRange: `${tickLower} → ${tickUpper}`,
      liquidity: liquidity.toString(),
      unclaimedFees: {
        [token0Symbol]: token0Info ? formatAmount(tokensOwed0, token0Info.decimals) : tokensOwed0.toString(),
        [token1Symbol]: token1Info ? formatAmount(tokensOwed1, token1Info.decimals) : tokensOwed1.toString(),
      },
    });
  }

  output({ positions, total: positions.length });
}

main().catch((err) => fail(err.message));
