/**
 * ONE — ERC-8004 Agent Registration (spec-compliant)
 * Registers with agentURI pointing to a base64-encoded registration file
 * following the ERC-8004 best practices format.
 *
 * Usage: npx tsx scripts/register-8004.ts
 */

import { publicClient, walletClient, account } from "../lib/client.js";
import { ERC8004 } from "../lib/contracts.js";
import { output, fail } from "../lib/utils.js";

// ERC-8004 spec ABI — register(string agentURI) returns (uint256 agentId)
const IDENTITY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
] as const;

async function main() {
  const wallet = account.address;

  // Build ERC-8004 compliant registration file
  const registrationFile = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "ONE",
    description: "Personal DeFi Agent on Celo — swaps, lending, LP management, arbitrage scanning, savings goals, and price alerts. Built with OpenClaw.",
    image: "https://raw.githubusercontent.com/mush-ahid/one/main/ui/public/logo.png",
    active: true,
    services: [
      {
        type: "agentWallet",
        agentWallet: `eip155:42220:${wallet}`,
      },
      {
        type: "oasf",
        oasfVersion: "0.8.0",
        domains: [
          "finance_and_business/investment_services",
          "finance_and_business/financial_analysis",
        ],
        skills: [
          "data_engineering/data_transformation_pipeline",
          "natural_language_processing/natural_language_generation/summarization",
        ],
      },
    ],
    registrations: [
      {
        agentRegistry: `eip155:42220:${ERC8004.identityRegistry}`,
      },
    ],
  };

  // Encode as base64 data URI for on-chain storage
  const jsonStr = JSON.stringify(registrationFile);
  const base64 = Buffer.from(jsonStr).toString("base64");
  const agentURI = `data:application/json;base64,${base64}`;

  console.error("Registering ONE on ERC-8004 (spec-compliant)...");
  console.error(`Wallet: ${wallet}`);
  console.error(`Registry: ${ERC8004.identityRegistry}`);
  console.error(`Registration file: ${jsonStr.length} bytes`);

  try {
    const hash = await walletClient.writeContract({
      address: ERC8004.identityRegistry,
      abi: IDENTITY_ABI,
      functionName: "register",
      args: [agentURI],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    output({
      status: "registered",
      name: "ONE",
      wallet,
      txHash: hash,
      explorer: `https://celoscan.io/tx/${hash}`,
      agentscan: `https://agentscan.info/agents`,
      registrationFile,
    });
  } catch (err: any) {
    // If register(string) fails, try setAgentURI to update existing registration
    if (err.message?.includes("revert") || err.message?.includes("already")) {
      console.error("Registration reverted — trying setAgentURI to update existing...");
      try {
        // Try agentId 0, 1, etc. — our agent might have a different ID
        for (const id of [0n, 1n, 2n]) {
          try {
            const updateHash = await walletClient.writeContract({
              address: ERC8004.identityRegistry,
              abi: IDENTITY_ABI,
              functionName: "setAgentURI",
              args: [id, agentURI],
            });
            const updateReceipt = await publicClient.waitForTransactionReceipt({ hash: updateHash });
            output({
              status: "updated",
              agentId: id.toString(),
              wallet,
              txHash: updateHash,
              explorer: `https://celoscan.io/tx/${updateHash}`,
              agentscan: `https://agentscan.info/agents`,
              registrationFile,
            });
            return;
          } catch { continue; }
        }
        output({
          status: "update_failed",
          wallet,
          error: "Could not update agentURI — agent ID unknown",
          agentscan: `https://agentscan.info/agents`,
        });
      } catch (updateErr: any) {
        fail(updateErr.message);
      }
    } else {
      fail(err.message);
    }
  }
}

main().catch((err) => fail(err.message));
