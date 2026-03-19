import { type Address, isAddress } from "viem";

export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}

// Well-known tokens on Celo — shortcuts for common symbols
export const TOKENS: Record<string, TokenInfo> = {
  CELO: {
    symbol: "CELO",
    name: "Celo Native",
    address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    decimals: 18,
  },
  cUSD: {
    symbol: "cUSD",
    name: "Celo Dollar",
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
  },
  cEUR: {
    symbol: "cEUR",
    name: "Celo Euro",
    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
    decimals: 18,
  },
  cREAL: {
    symbol: "cREAL",
    name: "Celo Real",
    address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
    decimals: 18,
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    decimals: 6,
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x66803FB87aBd4aaC3cbB3fAd7C3aa01f6F3FB207",
    decimals: 18,
  },
  stCELO: {
    symbol: "stCELO",
    name: "Staked Celo",
    address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24",
    decimals: 18,
  },
  PACT: {
    symbol: "PACT",
    name: "impactMarket",
    address: "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58",
    decimals: 18,
  },
  UBE: {
    symbol: "UBE",
    name: "Ubeswap",
    address: "0x71e26d0E519D14591b9dE9a0fE9513A398101490",
    decimals: 18,
  },
  USDGLO: {
    symbol: "USDGLO",
    name: "Glo Dollar",
    address: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
    decimals: 18,
  },
};

// ERC-20 ABI for on-chain token metadata lookup
const TOKEN_METADATA_ABI = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

/** Resolve a token by symbol (case-insensitive) or address (from registry) */
export function resolveToken(input: string): TokenInfo | undefined {
  const upper = input.toUpperCase();
  if (TOKENS[upper]) return TOKENS[upper];

  // Case-insensitive symbol match
  for (const token of Object.values(TOKENS)) {
    if (token.symbol.toUpperCase() === upper) return token;
  }

  // Address match against known tokens
  if (isAddress(input)) {
    const lower = input.toLowerCase();
    for (const token of Object.values(TOKENS)) {
      if (token.address.toLowerCase() === lower) return token;
    }
  }

  return undefined;
}

/**
 * Resolve a token by symbol or address. If not in the known registry
 * and the input is a valid address, fetch metadata from the chain.
 * Requires a viem publicClient.
 */
export async function resolveTokenDynamic(
  input: string,
  publicClient: any
): Promise<TokenInfo> {
  // Try known registry first
  const known = resolveToken(input);
  if (known) return known;

  // If input looks like an address, fetch on-chain metadata
  if (isAddress(input)) {
    const address = input as Address;
    try {
      const [symbol, name, decimals] = await Promise.all([
        publicClient.readContract({ address, abi: TOKEN_METADATA_ABI, functionName: "symbol" }),
        publicClient.readContract({ address, abi: TOKEN_METADATA_ABI, functionName: "name" }).catch(() => "Unknown"),
        publicClient.readContract({ address, abi: TOKEN_METADATA_ABI, functionName: "decimals" }),
      ]);
      const tokenInfo: TokenInfo = {
        symbol: symbol as string,
        name: name as string,
        address,
        decimals: Number(decimals),
      };
      // Cache for this session
      TOKENS[(symbol as string).toUpperCase()] = tokenInfo;
      return tokenInfo;
    } catch (err: any) {
      throw new Error(`Cannot read token at ${input}: ${err.message?.slice(0, 100)}`);
    }
  }

  throw new Error(
    `Unknown token: ${input}. Use a symbol (CELO, USDC, etc.) or a valid ERC-20 contract address.`
  );
}

/** Get all known token symbols */
export function supportedSymbols(): string[] {
  return Object.keys(TOKENS);
}
