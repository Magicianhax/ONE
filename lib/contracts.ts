import { type Address } from "viem";

// ── Uniswap V3 on Celo ──────────────────────────────────────────────
export const UNISWAP = {
  swapRouter: "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as Address,
  factory: "0xAfE208a311B21f13EF87E33A90049fC17A7acDEc" as Address,
  quoterV2: "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8" as Address,
  positionManager: "0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A" as Address,
} as const;

// ── Mento Protocol on Celo ───────────────────────────────────────────
export const MENTO = {
  broker: "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as Address,
  biPoolManager: "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as Address,
} as const;

// ── AAVE V3 on Celo (from bgd-labs/aave-address-book) ────────────────
export const AAVE = {
  poolAddressesProvider: "0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5" as Address,
  pool: "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as Address,
  poolDataProvider: "0x2e0f8D3B1631296cC7c56538D6Eb6032601E15ED" as Address,
} as const;

// ── ERC-8004 on Celo ─────────────────────────────────────────────────
export const ERC8004 = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address,
} as const;

// ── Minimal ABIs ─────────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const MENTO_BROKER_ABI = [
  {
    name: "getAmountOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "swapIn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "getExchangeProviders",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

export const BIPOOL_MANAGER_ABI = [
  {
    name: "getPoolExchange",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "exchangeId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "asset0", type: "address" },
          { name: "asset1", type: "address" },
        ],
      },
    ],
  },
  {
    name: "getExchangeIds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
] as const;

export const AAVE_POOL_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

export const AAVE_DATA_PROVIDER_ABI = [
  {
    name: "getUserReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "asset", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "currentATokenBalance", type: "uint256" },
      { name: "currentStableDebt", type: "uint256" },
      { name: "currentVariableDebt", type: "uint256" },
      { name: "principalStableDebt", type: "uint256" },
      { name: "scaledVariableDebt", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "stableRateLastUpdated", type: "uint40" },
      { name: "usageAsCollateralEnabled", type: "bool" },
    ],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "unbacked", type: "uint256" },
      { name: "accruedToTreasuryScaled", type: "uint256" },
      { name: "totalAToken", type: "uint256" },
      { name: "totalStableDebt", type: "uint256" },
      { name: "totalVariableDebt", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "variableBorrowRate", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "averageStableBorrowRate", type: "uint256" },
      { name: "liquidityIndex", type: "uint256" },
      { name: "variableBorrowIndex", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint40" },
    ],
  },
] as const;

export const ERC8004_IDENTITY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "metadata", type: "string" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "metadata", type: "string" },
    ],
  },
  {
    name: "updateMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadata", type: "string" }],
    outputs: [],
  },
] as const;

export const ERC8004_REPUTATION_ABI = [
  {
    name: "authorizeClient",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "client", type: "address" }],
    outputs: [],
  },
  {
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "score", type: "int128" },
      { name: "decimals", type: "uint8" },
      { name: "tags", type: "string[]" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "feedbackCount", type: "uint256" },
      { name: "averageScore", type: "int128" },
    ],
  },
] as const;
