import { type Address } from "viem";

export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}

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
} as const;

/** Resolve a token by symbol (case-insensitive) or address */
export function resolveToken(input: string): TokenInfo | undefined {
  const upper = input.toUpperCase();
  if (TOKENS[upper]) return TOKENS[upper];

  // Try case-insensitive symbol match
  for (const token of Object.values(TOKENS)) {
    if (token.symbol.toUpperCase() === upper) return token;
  }

  // Try address match
  const lower = input.toLowerCase();
  for (const token of Object.values(TOKENS)) {
    if (token.address.toLowerCase() === lower) return token;
  }

  return undefined;
}

/** Get all supported token symbols */
export function supportedSymbols(): string[] {
  return Object.keys(TOKENS);
}
