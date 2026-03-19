import { formatUnits, parseUnits, type Address } from "viem";

/** Format a bigint token amount to human-readable string */
export function formatAmount(amount: bigint, decimals: number, precision = 6): string {
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.000001) return "<0.000001";
  return num.toFixed(precision).replace(/\.?0+$/, "");
}

/** Parse a human-readable amount to bigint */
export function parseAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

/** Calculate minimum output with slippage */
export function withSlippage(amount: bigint, slippageBps: number): bigint {
  return amount - (amount * BigInt(slippageBps)) / 10000n;
}

/** Format an address for display (0x1234...5678) */
export function shortAddr(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Parse CLI args into a key-value map: --key value */
export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

/** Print a JSON result to stdout (for agent consumption) */
export function output(data: Record<string, unknown>): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Print an error and exit */
export function fail(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}
