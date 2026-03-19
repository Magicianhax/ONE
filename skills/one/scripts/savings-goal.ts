/**
 * ONE Savings — Goal Management
 * Create, view, update, and delete savings goals.
 *
 * Usage:
 *   npx tsx goal.ts --action create --name "Laptop" --target 500 --currency cUSD --deadline 2026-06-01 --strategy aave
 *   npx tsx goal.ts --action list
 *   npx tsx goal.ts --action deposit --id <ID> --amount 50
 *   npx tsx goal.ts --action delete --id <ID>
 */

import { randomUUID } from "crypto";
import { getGoals, saveGoals, type SavingsGoal } from "../../../lib/state.js";
import { parseArgs, output, fail } from "../../../lib/utils.js";

function main() {
  const args = parseArgs(process.argv);
  const action = args.action;

  if (!action) {
    fail("Usage: npx tsx goal.ts --action <create|list|deposit|delete> [options]");
  }

  const goals = getGoals();

  switch (action) {
    case "create": {
      const name = args.name;
      const targetStr = args.target;
      const currency = args.currency || "cUSD";
      const deadline = args.deadline;
      const strategy = (args.strategy || "aave") as "aave" | "hold";

      if (!name || !targetStr) {
        fail("Required: --name <NAME> --target <AMOUNT> [--currency cUSD] [--deadline 2026-06-01] [--strategy aave|hold]");
      }

      const target = parseFloat(targetStr);
      if (isNaN(target) || target <= 0) fail("target must be a positive number");

      const goal: SavingsGoal = {
        id: randomUUID().slice(0, 8),
        name,
        targetAmount: target,
        currency,
        deadline: deadline || "none",
        currentAmount: 0,
        strategy,
        createdAt: new Date().toISOString(),
      };

      goals.push(goal);
      saveGoals(goals);

      output({
        status: "created",
        goal: {
          id: goal.id,
          name: goal.name,
          target: `${goal.targetAmount} ${goal.currency}`,
          deadline: goal.deadline,
          strategy: goal.strategy === "aave" ? "Earn yield on AAVE" : "Hold only",
        },
      });
      break;
    }

    case "list": {
      output({
        goals: goals.map((g) => ({
          id: g.id,
          name: g.name,
          progress: `${g.currentAmount} / ${g.targetAmount} ${g.currency}`,
          percent: `${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}%`,
          deadline: g.deadline,
          strategy: g.strategy,
        })),
        total: goals.length,
      });
      break;
    }

    case "deposit": {
      const id = args.id;
      const amountStr = args.amount;
      if (!id || !amountStr) fail("Required: --id <ID> --amount <AMOUNT>");

      const goal = goals.find((g) => g.id === id);
      if (!goal) fail(`Goal not found: ${id}`);

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) fail("amount must be a positive number");

      goal.currentAmount += amount;
      const reached = goal.currentAmount >= goal.targetAmount;
      saveGoals(goals);

      output({
        status: reached ? "goal_reached" : "deposited",
        goal: {
          id: goal.id,
          name: goal.name,
          progress: `${goal.currentAmount} / ${goal.targetAmount} ${goal.currency}`,
          percent: `${((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}%`,
        },
        message: reached ? `Congratulations! You've reached your "${goal.name}" savings goal!` : undefined,
      });
      break;
    }

    case "delete": {
      const id = args.id;
      if (!id) fail("Required: --id <ID>");

      const idx = goals.findIndex((g) => g.id === id);
      if (idx === -1) fail(`Goal not found: ${id}`);

      const removed = goals.splice(idx, 1)[0];
      saveGoals(goals);

      output({
        status: "deleted",
        removed: { id: removed.id, name: removed.name },
      });
      break;
    }

    default:
      fail(`Unknown action: ${action}. Use: create, list, deposit, delete`);
  }
}

main();
