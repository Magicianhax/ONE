/**
 * ONE Alerts — List Script
 * Show all active price alerts.
 *
 * Usage: npx tsx list.ts
 */

import { getAlerts } from "../../../lib/state.js";
import { output } from "../../../lib/utils.js";

function main() {
  const alerts = getAlerts();
  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  output({
    active: active.map((a) => ({
      id: a.id,
      rule: `${a.token} ${a.condition} $${a.price}`,
      action: a.action === "notify"
        ? "Notify"
        : `Auto-${a.action} ${a.actionAmount || "?"} ${a.actionToken || a.token}`,
      created: a.createdAt,
    })),
    triggered: triggered.map((a) => ({
      id: a.id,
      rule: `${a.token} ${a.condition} $${a.price}`,
      created: a.createdAt,
    })),
    total: alerts.length,
  });
}

main();
