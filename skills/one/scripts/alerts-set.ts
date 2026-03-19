/**
 * ONE Alerts — Set Alert Script
 * Create a price alert with optional auto-trade action.
 *
 * Usage: npx tsx set.ts --token CELO --condition below --price 0.35 [--action buy --action-amount 10 --action-token cUSD]
 */

import { randomUUID } from "crypto";
import { getAlerts, saveAlerts, type PriceAlert } from "../../../lib/state.js";
import { resolveToken, TOKENS } from "../../../lib/tokens.js";
import { parseArgs, output, fail } from "../../../lib/utils.js";

async function main() {
  const args = parseArgs(process.argv);
  const tokenStr = args.token;
  const condition = args.condition as "above" | "below";
  const priceStr = args.price;
  const action = args.action as "notify" | "buy" | "sell" | undefined;
  const actionAmount = args["action-amount"];
  const actionToken = args["action-token"];

  if (!tokenStr || !condition || !priceStr) {
    fail("Usage: npx tsx set.ts --token <TOKEN> --condition <above|below> --price <PRICE> [--action <notify|buy|sell> --action-amount <AMOUNT> --action-token <TOKEN>]");
  }

  if (condition !== "above" && condition !== "below") {
    fail('condition must be "above" or "below"');
  }

  const token = resolveToken(tokenStr);
  if (!token) fail(`Unknown token: ${tokenStr}. Supported: ${Object.keys(TOKENS).join(", ")}`);

  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) fail("price must be a positive number");

  const alert: PriceAlert = {
    id: randomUUID().slice(0, 8),
    token: token.symbol,
    condition,
    price,
    action: action || "notify",
    actionAmount,
    actionToken,
    createdAt: new Date().toISOString(),
    triggered: false,
  };

  const alerts = getAlerts();
  alerts.push(alert);
  saveAlerts(alerts);

  output({
    status: "created",
    alert: {
      id: alert.id,
      rule: `${token.symbol} ${condition} $${price}`,
      action: alert.action === "notify"
        ? "Notify only"
        : `Auto-${alert.action} ${alert.actionAmount || "?"} ${alert.actionToken || token.symbol}`,
    },
    totalAlerts: alerts.length,
    note: "Run the check script periodically to monitor: npx tsx skills/one-alerts/scripts/check.ts",
  });
}

main().catch((err) => fail(err.message));
