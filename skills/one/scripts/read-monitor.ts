/**
 * ONE — Read Monitor State
 * Shows latest data from the background monitor.
 *
 * Usage: npx tsx read-monitor.ts
 */

import { readState } from "../../../lib/state.js";
import { output } from "../../../lib/utils.js";

function main() {
  const state = readState("monitor.json", null);

  if (!state) {
    output({ status: "monitor_not_running", message: "No monitor data found. Start with: npx tsx scripts/monitor.ts" });
    return;
  }

  output(state);
}

main();
