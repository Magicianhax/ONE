import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PORT = parseInt(process.env.PORT || "3002", 10);
const SESSION_ID = "one-web";

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || path.join(
  process.env.HOME || process.env.USERPROFILE || "/home/mushahid",
  ".npm-global/bin/openclaw"
);

// Celo context — injected into every agent turn
const CELO_CONTEXT = [
  "You are the ONE DeFi agent on Celo Mainnet (chain 42220).",
  "Supported tokens: CELO, cUSD, cEUR, USDC, USDT, WETH.",
  "Complete the FULL task in one response — run all needed scripts, show all results.",
  "Do NOT say 'First let me...' and stop — finish everything the user asked for.",
  "If a task has multiple steps (create goal + deposit + set schedule), do ALL of them.",
  "Always confirm before executing swaps/transactions. Show exact numbers.",
  "After a transaction, include the celoscan.io link.",
  "Never expose private keys.",
].join(" ");

const app = express();
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});
const DIST_DIR = path.resolve(__dirname, "..", "dist");
app.use(express.static(DIST_DIR));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// ── Detect action → 3D animation target ─────────────────────────
// ORDER MATTERS: more specific checks first, broader checks last

function detectAction(text: string): { action: string; target: string } {
  const lower = text.toLowerCase();

  // Savings / piggy — check FIRST (before swap, since user might say "buy" + "save")
  if (/\b(sav(e|ing)|goal|piggy|piggybank)\b/i.test(lower)) {
    return { action: "savings", target: "piggy" };
  }
  if (/\bsweep\b/i.test(lower)) {
    return { action: "sweep", target: "piggy" };
  }

  // Alerts — check before generic keywords
  if (/\b(alert|notify|watch.*price|bell|remind|notification)\b/i.test(lower)) {
    return { action: "alert", target: "bell" };
  }

  // Arbitrage
  if (/\b(arb|arbitrage|spread)\b/i.test(lower)) {
    return { action: "arb_scan", target: "arb_board" };
  }

  // LP positions
  if (/\b(lp|liquidity|pool)\b/i.test(lower)) {
    return { action: "lp_positions", target: "pool" };
  }

  // Lending — supply (needs token context, not just "deposit")
  if (/\b(supply|deposit)\b/i.test(lower) && /\b(aave|lend|yield|earn|interest)\b/i.test(lower)) {
    return { action: "lend_supply", target: "vault" };
  }
  // Lending — withdraw
  if (/\b(withdraw)\b/i.test(lower) && /\b(aave|lend|position)\b/i.test(lower)) {
    return { action: "lend_withdraw", target: "vault" };
  }
  // Lending — positions/APY
  if (/\b(apy|yield|aave|lend.*position|earn.*rate)\b/i.test(lower)) {
    return { action: "lend_positions", target: "vault" };
  }

  // Swap — only when talking about token operations (not "buy a phone")
  if (/\b(swap|exchange|convert)\b/i.test(lower)) {
    return { action: "swap", target: "desk" };
  }
  // Buy/sell/trade — only if a token is mentioned nearby
  if (/\b(buy|sell|trade)\b/i.test(lower) && /\b(celo|cusd|ceur|usdc|usdt|weth|token)\b/i.test(lower)) {
    return { action: "swap", target: "desk" };
  }

  // Quote / price check
  if (/\b(quote|price)\b/i.test(lower) && /\b(celo|cusd|usdc|token|swap)\b/i.test(lower)) {
    return { action: "quote", target: "desk" };
  }

  // Balance — broad
  if (/\b(balance|wallet|holdings?|portfolio|how much|my tokens)\b/i.test(lower)) {
    return { action: "balance", target: "desk" };
  }

  // Default — desk for general queries
  return { action: "chat", target: "desk" };
}

// ── Detect if response needs user confirmation ──────────────────

function needsConfirmation(text: string): boolean {
  // Must mention a specific transaction amount (e.g., "1 USDC", "0.5 CELO")
  const hasAmount = /\d+\.?\d*\s*(celo|cusd|ceur|usdc|usdt|weth|usd)\b/i.test(text);
  // Must be asking to execute/confirm a financial action
  const hasConfirmPrompt = /\b(confirm|approve|proceed|shall i execute|ready to execute|execute this)\b/i.test(text);
  const hasQuestion = text.includes("?");
  // Only trigger for real transaction confirmations, not conversational follow-ups
  return hasAmount && hasQuestion && hasConfirmPrompt;
}

// ── Detect if response is incomplete (agent tried multi-step but stopped) ──

function isIncomplete(text: string): boolean {
  const trimmed = text.trim();
  // Ends mid-sentence with colon, ellipsis, or comma
  if (/[:…,]\s*$/.test(trimmed)) return true;
  // Says "first" or "step 1" but doesn't mention "done" or "complete"
  if (/\b(first|step 1|let me start)\b/i.test(trimmed) && !/\b(done|complete|finished|success)\b/i.test(trimmed)) return true;
  return false;
}

// ── Run OpenClaw agent turn ─────────────────────────────────────

function runAgentTurn(message: string, includeContext = false): Promise<{ text: string; durationMs: number }> {
  const fullMessage = includeContext ? `[Context: ${CELO_CONTEXT}]\n\n${message}` : message;
  return new Promise((resolve, reject) => {
    execFile(
      OPENCLAW_BIN,
      ["agent", "-m", fullMessage, "--json", "--session-id", SESSION_ID],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PATH: `${path.dirname(OPENCLAW_BIN)}:${process.env.PATH}`,
        },
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          reject(new Error(stderr || error.message));
          return;
        }
        if (error) {
          console.warn("[agent] non-zero exit with stdout:", stderr || error.message);
        }
        try {
          const result = JSON.parse(stdout);
          const text = result.result?.payloads?.[0]?.text || "No response from agent.";
          const durationMs = result.result?.meta?.durationMs || 0;
          resolve({ text, durationMs });
        } catch {
          resolve({ text: stdout.trim() || "Agent responded.", durationMs: 0 });
        }
      }
    );
  });
}

// ── WebSocket handling ──────────────────────────────────────────

wss.on("connection", (ws: WebSocket) => {
  console.log("[ws] client connected");

  let awaitingApproval = false;
  let approvalTimer: ReturnType<typeof setTimeout> | null = null;
  let lastUserIntent = "";
  let lastTarget = "";

  function setApprovalPending(pending: boolean) {
    awaitingApproval = pending;
    if (approvalTimer) { clearTimeout(approvalTimer); approvalTimer = null; }
    if (pending) {
      // Auto-clear after 60s to prevent stuck state
      approvalTimer = setTimeout(() => {
        if (awaitingApproval) {
          console.log("[approval] timed out after 60s, clearing");
          awaitingApproval = false;
          approvalTimer = null;
        }
      }, 60000);
    }
  }

  ws.on("message", async (raw: Buffer) => {
    try {
      const parsed = JSON.parse(raw.toString());

      // ── Approval response (approve/decline on 3D monitor) ──
      if (parsed.type === "approval") {
        if (!awaitingApproval) {
          send(ws, { type: "action_error", message: "No pending transaction to confirm." });
          return;
        }
        setApprovalPending(false);

        if (parsed.approved) {
          console.log("[approval] user approved — executing");
          try {
            const { text, durationMs } = await runAgentTurn(
              `yes, confirm and execute: ${lastUserIntent}`
            );
            send(ws, {
              type: "action_result",
              action: detectAction(text).action,
              data: { raw: text },
              message: text,
            });
            recordAction("executed", text);
            console.log(`[agent] executed in ${durationMs}ms`);
          } catch (err: any) {
            send(ws, {
              type: "action_error",
              message: `Execution error: ${err.message.slice(0, 200)}`,
            });
          }
        } else {
          console.log("[approval] user declined");
          try { await runAgentTurn("no, cancel"); } catch { /* ignore */ }
          send(ws, {
            type: "action_result",
            action: "cancelled",
            data: {},
            message: "Transaction cancelled.",
          });
        }
        return;
      }

      // ── Chat messages ──
      if (parsed.type !== "chat" || !parsed.message) return;

      const userMessage = parsed.message;
      console.log(`[chat] ${userMessage}`);

      // If approval is pending and user confirms via chat text, treat as approval
      if (awaitingApproval) {
        const lower = userMessage.toLowerCase().trim();
        const isConfirm = /^(yes|confirm|approve|go ahead|do it|ok|yep|yeah|sure|y)$/i.test(lower)
          || /^yes[,.]?\s*(confirm|go|do|execute|swap|proceed)/i.test(lower);
        const isDecline = /^(no|cancel|decline|stop|nah|nope|n)$/i.test(lower);

        if (isConfirm) {
          console.log("[approval] user confirmed via chat text");
          // Reuse the approval handler
          parsed.type = "approval";
          parsed.approved = true;
          setApprovalPending(false);
          try {
            const { text, durationMs } = await runAgentTurn(
              `yes, confirm and execute: ${lastUserIntent}`
            );
            send(ws, {
              type: "action_result",
              action: detectAction(text).action,
              data: { raw: text },
              message: text,
            });
            recordAction("executed", text);
            console.log(`[agent] executed in ${durationMs}ms`);
          } catch (err: any) {
            send(ws, {
              type: "action_error",
              message: `Execution error: ${err.message.slice(0, 200)}`,
            });
          }
          return;
        } else if (isDecline) {
          console.log("[approval] user declined via chat text");
          setApprovalPending(false);
          try { await runAgentTurn("no, cancel"); } catch { /* ignore */ }
          send(ws, {
            type: "action_result",
            action: "cancelled",
            data: {},
            message: "Transaction cancelled.",
          });
          return;
        } else {
          // Not a yes/no — clear stale approval and process as new message
          console.log("[approval] new message overrides pending approval");
          setApprovalPending(false);
        }
      }

      const userAction = detectAction(userMessage);
      lastUserIntent = userMessage;
      lastTarget = userAction.target;

      // Agent starts walking
      send(ws, {
        type: "action_start",
        action: userAction.action,
        target: userAction.target,
      });

      // Run agent
      try {
        let { text, durationMs } = await runAgentTurn(userMessage, true);
        let totalMs = durationMs;

        // If response is incomplete, ask agent to continue (up to 2 retries)
        for (let retry = 0; retry < 2 && isIncomplete(text); retry++) {
          console.log(`[agent] incomplete response, continuing... (retry ${retry + 1})`);
          // Send intermediate update to client
          send(ws, {
            type: "action_approval",
            action: userAction.action,
            message: text + "\n\n⏳ Working on it...",
          });
          const cont = await runAgentTurn("continue — finish the task completely");
          text = text + "\n\n" + cont.text;
          totalMs += cont.durationMs;
        }

        // Show approve/decline on 3D monitor only for desk targets (interactive feature)
        const isDeskTarget = ['desk', 'pool', 'arb_board', 'chat'].includes(userAction.target);
        if (isDeskTarget && needsConfirmation(text)) {
          setApprovalPending(true);
          send(ws, {
            type: "action_approval",
            action: userAction.action,
            message: text,
          });
          console.log(`[agent] awaiting approval on screen (${totalMs}ms)`);
        } else {
          send(ws, {
            type: "action_result",
            action: userAction.action,
            data: { raw: text },
            message: text,
          });
          console.log(`[agent] responded in ${totalMs}ms`);
        }

        recordAction(userAction.action, text);
      } catch (err: any) {
        send(ws, {
          type: "action_error",
          message: `Agent error: ${err.message.slice(0, 200)}`,
        });
      }
    } catch (err: any) {
      console.error("[ws] parse error:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("[ws] client disconnected");
  });
});

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── REST API ────────────────────────────────────────────────────

function runScript(scriptPath: string, args: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("npx", ["tsx", scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error && !stdout) { reject(new Error(stderr || error.message)); return; }
      resolve(stdout.trim());
    });
  });
}

const MONITOR_STATE = path.join(PROJECT_ROOT, "state", "monitor.json");

app.get("/api/monitor", (_req, res) => {
  try {
    if (!existsSync(MONITOR_STATE)) {
      res.json({ status: "error", message: "Monitor not running." });
      return;
    }
    const data = JSON.parse(readFileSync(MONITOR_STATE, "utf-8"));
    res.json({ status: "ok", data });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/api/balance", async (_req, res) => {
  try {
    if (existsSync(MONITOR_STATE)) {
      const data = JSON.parse(readFileSync(MONITOR_STATE, "utf-8"));
      if (data.balances) {
        res.json({ status: "ok", wallet: data.wallet, balances: data.balances, updatedAt: data.balancesUpdatedAt });
        return;
      }
    }
    const output = await runScript(path.join(PROJECT_ROOT, "skills/one/scripts/balance.ts"));
    res.json({ status: "ok", raw: output });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/api/arb-scan", (_req, res) => {
  try {
    if (existsSync(MONITOR_STATE)) {
      const data = JSON.parse(readFileSync(MONITOR_STATE, "utf-8"));
      if (data.arbitrage) {
        res.json({ status: "ok", data: { scans: data.arbitrage, timestamp: data.arbUpdatedAt } });
        return;
      }
    }
    res.json({ status: "error", message: "Monitor not running" });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/api/alerts", async (_req, res) => {
  try {
    const output = await runScript(path.join(PROJECT_ROOT, "skills/one/scripts/alerts-list.ts"));
    res.json({ status: "ok", data: JSON.parse(output) });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/api/lend-positions", async (_req, res) => {
  try {
    const output = await runScript(path.join(PROJECT_ROOT, "skills/one/scripts/lend-positions.ts"));
    res.json({ status: "ok", data: JSON.parse(output) });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/api/savings-goals", async (_req, res) => {
  try {
    const output = await runScript(path.join(PROJECT_ROOT, "skills/one/scripts/savings-goal.ts"), ["--action", "list"]);
    res.json({ status: "ok", data: JSON.parse(output) });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/api/lp-positions", async (_req, res) => {
  try {
    const output = await runScript(path.join(PROJECT_ROOT, "skills/one/scripts/lp-positions.ts"));
    res.json({ status: "ok", data: JSON.parse(output) });
  } catch (err: any) {
    res.json({ status: "error", message: err.message });
  }
});

const actionHistory: { time: string; type: string; message: string }[] = [];

app.get("/api/actions", (_req, res) => {
  res.json({ status: "ok", actions: actionHistory });
});

function recordAction(type: string, message: string) {
  actionHistory.unshift({
    time: new Date().toISOString(),
    type,
    message: message.slice(0, 200),
  });
  if (actionHistory.length > 50) actionHistory.pop();
}

// ── Start ───────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`ONE UI server on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`OpenClaw: ${OPENCLAW_BIN}`);
  console.log(`Session: ${SESSION_ID}`);
});
