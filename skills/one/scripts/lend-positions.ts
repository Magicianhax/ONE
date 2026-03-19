/**
 * ONE Lend — Positions Script
 * Shows current AAVE V3 positions and APYs on Celo.
 *
 * Usage: npx tsx positions.ts [--token cUSD]
 */

import { publicClient, account } from "../../../lib/client.js";
import { TOKENS, type TokenInfo } from "../../../lib/tokens.js";
import { AAVE, AAVE_DATA_PROVIDER_ABI, AAVE_POOL_ABI } from "../../../lib/contracts.js";
import { formatAmount, parseArgs, output, fail } from "../../../lib/utils.js";

const RAY = 10n ** 27n;

function rayToPercent(ray: bigint): string {
  // ray is 1e27, convert to APY percentage
  const pct = Number(ray * 10000n / RAY) / 100;
  return pct.toFixed(2);
}

interface PositionInfo {
  token: string;
  supplied: string;
  supplyAPY: string;
  borrowed: string;
  borrowAPY: string;
  collateralEnabled: boolean;
}

async function getReserveAPY(asset: TokenInfo): Promise<{ supplyAPY: string; borrowAPY: string }> {
  try {
    const data = await publicClient.readContract({
      address: AAVE.poolDataProvider,
      abi: AAVE_DATA_PROVIDER_ABI,
      functionName: "getReserveData",
      args: [asset.address],
    });
    const result = data as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, number];
    return {
      supplyAPY: rayToPercent(result[5]),   // liquidityRate
      borrowAPY: rayToPercent(result[6]),   // variableBorrowRate
    };
  } catch {
    return { supplyAPY: "N/A", borrowAPY: "N/A" };
  }
}

async function getUserPosition(asset: TokenInfo): Promise<PositionInfo | null> {
  try {
    const data = await publicClient.readContract({
      address: AAVE.poolDataProvider,
      abi: AAVE_DATA_PROVIDER_ABI,
      functionName: "getUserReserveData",
      args: [asset.address, account.address],
    });
    const result = data as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, boolean];
    const [aTokenBalance, stableDebt, variableDebt, , , , liquidityRate, , collateralEnabled] = result;

    const apys = await getReserveAPY(asset);

    return {
      token: asset.symbol,
      supplied: formatAmount(aTokenBalance, asset.decimals),
      supplyAPY: apys.supplyAPY,
      borrowed: formatAmount(stableDebt + variableDebt, asset.decimals),
      borrowAPY: apys.borrowAPY,
      collateralEnabled,
    };
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const filterToken = args.token;

  const tokens = filterToken
    ? [TOKENS[filterToken.toUpperCase()]].filter(Boolean)
    : Object.values(TOKENS);

  if (tokens.length === 0) {
    fail(`Unknown token: ${filterToken}`);
  }

  // Get account summary
  let accountSummary;
  try {
    const data = await publicClient.readContract({
      address: AAVE.pool,
      abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData",
      args: [account.address],
    });
    const result = data as readonly [bigint, bigint, bigint, bigint, bigint, bigint];
    accountSummary = {
      totalCollateralUSD: formatAmount(result[0], 8),
      totalDebtUSD: formatAmount(result[1], 8),
      availableBorrowsUSD: formatAmount(result[2], 8),
      healthFactor: result[5] === 2n ** 256n - 1n ? "∞" : formatAmount(result[5], 18),
    };
  } catch {
    accountSummary = null;
  }

  // Get positions for all tokens
  const positions: PositionInfo[] = [];
  const apys: { token: string; supplyAPY: string; borrowAPY: string }[] = [];

  const results = await Promise.all(
    tokens.map(async (token) => {
      const pos = await getUserPosition(token);
      const apy = await getReserveAPY(token);
      return { token: token.symbol, pos, apy };
    })
  );

  for (const { token, pos, apy } of results) {
    if (pos && (parseFloat(pos.supplied) > 0 || parseFloat(pos.borrowed) > 0)) {
      positions.push(pos);
    }
    apys.push({ token, supplyAPY: apy.supplyAPY, borrowAPY: apy.borrowAPY });
  }

  output({
    wallet: account.address,
    protocol: "AAVE V3 on Celo",
    accountSummary,
    positions: positions.length > 0 ? positions : "No active positions",
    currentAPYs: apys,
  });
}

main().catch((err) => fail(err.message));
