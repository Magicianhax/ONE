import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

function getPrivateKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY || process.env.private_key;
  if (!key) {
    console.error("ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
  }
  if (!key.startsWith("0x")) {
    return `0x${key}` as `0x${string}`;
  }
  return key as `0x${string}`;
}

const privateKey = getPrivateKey();

export const account = privateKeyToAccount(privateKey);

export const publicClient: PublicClient<Transport, Chain> = createPublicClient({
  chain: celo,
  transport: http(),
});

export const walletClient: WalletClient<Transport, Chain, Account> =
  createWalletClient({
    account,
    chain: celo,
    transport: http(),
  });

export { celo };
