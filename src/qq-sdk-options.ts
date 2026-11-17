import { ReceiverMode } from "qq-official-bot";
import type { Client } from "qq-official-bot";
/** Community SDK 1.3.4. Connection/reconnect is SDK-owned; no logging of raw packets or credentials. */
export function qqSdkOptions(
  appid: string,
  secret: string,
): Client.Config<ReceiverMode.WEBSOCKET> {
  return {
    appid,
    secret,
    mode: ReceiverMode.WEBSOCKET,
    intents: ["GROUP_AND_C2C_EVENT"],
    logLevel: "off",
    handleProcessErrors: false,
    removeAt: false,
    autoReconnect: true,
    maxRetries: 3,
    reconnectDelay: 2000,
    timeout: 10000,
    groupMemberCache: false,
    guildMemberCache: false,
    guildCache: false,
    dataDir: ".local/private/qq-sdk",
  };
}
