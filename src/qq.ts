import { Bot } from "qq-official-bot";
import { qqSdkOptions } from "./qq-sdk-options.ts";
import { QqState } from "./qq-state.ts";
import { handler } from "./qq-handler.ts";
import { loadCatalog } from "./catalog.ts";
const appId = process.env.APPID,
  secret = process.env.APPSECRET,
  groups = new Set(
    (process.env.QQ_ALLOWED_GROUPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
const schoolId = Number(process.env.QQ_SCHOOL_ID || 1);
if (
  !appId ||
  !secret ||
  !groups.size ||
  !Number.isSafeInteger(schoolId) ||
  schoolId < 1
)
  throw Error("Configure APPID, APPSECRET, QQ_ALLOWED_GROUPS and QQ_SCHOOL_ID");
if (process.env.QQ_SEND_ENABLED !== "1")
  throw Error("Set QQ_SEND_ENABLED=1 explicitly to start QQ replies");
const rows = loadCatalog();
if (!rows.some((r) => r.schoolId === schoolId))
  throw Error("No catalog for selected school");
const state = new QqState(".local/private/qq.sqlite"),
  bot = new Bot(qqSdkOptions(appId, secret));
const handle = handler({
  appId,
  selfId: () => bot.self_id,
  groups,
  schoolId,
  rows,
  state,
  send: async (group, message, text) => {
    const token = bot.sessionManager.access_token;
    if (!token) throw Error("QQ token unavailable");
    const response = await fetch(
      `https://api.bot.qq.com/v2/groups/${encodeURIComponent(group)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `QQBot ${token}`,
          "Content-Type": "application/json",
          "X-Union-Appid": appId,
        },
        body: JSON.stringify({
          msg_type: 0,
          content: text,
          msg_id: message,
          msg_seq: 1,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = (await response.json()) as { id?: string; code?: number };
    if (!response.ok || data.code || !data.id) throw Error("QQ send failed");
  },
});
const pending = new Set<Promise<void>>();
let stopping = false;
bot.receiver.prependListener("packet", (packet: unknown) => {
  if (stopping || pending.size >= 16) return;
  const task = handle(packet)
    .catch(() => console.error("QQ_REQUEST_FAILED"))
    .finally(() => pending.delete(task));
  pending.add(task);
});
bot.on("error", () => console.error("QQ_CLIENT_ERROR"));
bot.receiver.on("error", () => console.error("QQ_CONNECTION_ERROR"));
const cleanup = setInterval(() => state.prune(), 60000);
cleanup.unref();
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(cleanup);
  await bot.stop();
  await Promise.allSettled([...pending]);
  state.close();
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
try {
  await bot.start();
  console.log("QQ_READY");
} catch {
  await stop();
  process.exitCode = 1;
  console.error("QQ_START_FAILED");
}
