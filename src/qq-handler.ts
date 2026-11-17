import { randomUUID } from "node:crypto";
import { groupMessage } from "./qq-protocol.ts";
import { QqState } from "./qq-state.ts";
import { answer } from "./engine.ts";
import type { Item } from "./catalog.ts";
export function handler(options: {
  appId: string;
  selfId: () => string;
  groups: Set<string>;
  schoolId: number;
  rows: Item[];
  state: QqState;
  send: (group: string, message: string, text: string) => Promise<void>;
}) {
  return async (packet: unknown) => {
    const m = groupMessage(packet, options.appId, options.selfId());
    if (
      !m ||
      !options.groups.has(m.groupOpenid) ||
      !options.state.claim(m.eventKey, m.userKey)
    )
      return;
    const feedback = /^\/(准|不准) ([0-9a-f-]{36})$/u.exec(m.text);
    if (feedback) {
      const ok = options.state.vote(
        feedback[2]!,
        m.userKey,
        feedback[1] === "准",
      );
      await options.send(
        m.groupOpenid,
        m.messageId,
        ok ? "已记录，谢谢反馈。" : "只能评价自己在本群收到的有效结果。",
      );
      return;
    }
    const result = answer(options.rows, options.schoolId, m.text),
      id = randomUUID();
    const text =
      result.text +
      (result.status === "RESULTS" ? `\n\n反馈：/准 ${id} 或 /不准 ${id}` : "");
    await options.send(m.groupOpenid, m.messageId, text);
    if (result.status === "RESULTS") options.state.save(id, m.userKey);
  };
}
