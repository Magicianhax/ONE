import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const URL = "http://192.168.100.71:5173";
const CLIPS_DIR = path.resolve("public/clips");
const VP = { width: 1440, height: 900 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function record(name: string, fn: (page: any) => Promise<void>) {
  console.log(`\n📹 Recording: ${name}`);
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const context = await browser.newContext({
    viewport: VP,
    recordVideo: { dir: CLIPS_DIR, size: VP },
  });
  const page = await context.newPage();
  await page.goto(URL);
  await sleep(4000);

  await fn(page);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath) {
    const dest = path.join(CLIPS_DIR, `${name}.webm`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(videoPath, dest);
    console.log(`  ✅ ${dest}`);
  }
}

async function type(page: any, text: string) {
  await page.click("#chat-input");
  await page.fill("#chat-input", text);
  await page.keyboard.press("Enter");
}

async function main() {
  fs.mkdirSync(CLIPS_DIR, { recursive: true });

  // 1. Idle room (5s)
  await record("01-idle", async (page) => {
    await sleep(5000);
  });

  // 2. Check balance — desk mode
  await record("02-balance", async (page) => {
    await type(page, "check my balance");
    await sleep(30000);
  });

  // 3. Swap with approval
  await record("03-swap", async (page) => {
    await type(page, "swap 1 USDC to CELO");
    await sleep(25000);
    await type(page, "yes");
    await sleep(25000);
  });

  // 4. Savings goal
  await record("04-savings", async (page) => {
    await type(page, "save $100 for headphones by December");
    await sleep(30000);
  });

  // 5. AAVE positions
  await record("05-aave", async (page) => {
    await type(page, "show my AAVE positions");
    await sleep(25000);
  });

  // 6. Night mode
  await record("06-night", async (page) => {
    await page.click("#day-night-btn");
    await sleep(12000);
  });

  console.log("\n🎬 Done! Clips saved to:", CLIPS_DIR);
}

main().catch(console.error);
