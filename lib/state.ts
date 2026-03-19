import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", "state");

function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

function statePath(file: string): string {
  return resolve(STATE_DIR, file);
}

/** Read a JSON state file, return default if missing */
export function readState<T>(file: string, defaultValue: T): T {
  const path = statePath(file);
  if (!existsSync(path)) return defaultValue;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

/** Write a JSON state file */
export function writeState<T>(file: string, data: T): void {
  ensureStateDir();
  const path = statePath(file);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

// ── Alert types ──────────────────────────────────────────────────────

export interface PriceAlert {
  id: string;
  token: string;
  condition: "above" | "below";
  price: number;
  action?: "notify" | "buy" | "sell";
  actionAmount?: string;
  actionToken?: string;
  createdAt: string;
  triggered: boolean;
}

export function getAlerts(): PriceAlert[] {
  return readState<PriceAlert[]>("alerts.json", []);
}

export function saveAlerts(alerts: PriceAlert[]): void {
  writeState("alerts.json", alerts);
}

// ── Savings goal types ───────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currency: string;
  deadline: string;
  currentAmount: number;
  strategy: "aave" | "hold";
  createdAt: string;
}

export function getGoals(): SavingsGoal[] {
  return readState<SavingsGoal[]>("savings.json", []);
}

export function saveGoals(goals: SavingsGoal[]): void {
  writeState("savings.json", goals);
}
