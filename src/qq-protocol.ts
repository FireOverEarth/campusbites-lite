import { z } from "zod";
const GroupEvent = z.object({
  op: z.literal(0),
  t: z.enum(["GROUP_AT_MESSAGE_CREATE", "GROUP_MESSAGE_CREATE"]),
  id: z.string().max(256).optional(),
  d: z.object({
    id: z.string().min(1).max(256),
    group_openid: z.string().min(1).max(256),
    content: z.string().max(4096),
    author: z.object({ member_openid: z.string().min(1).max(256) }),
    mentions: z
      .array(
        z.object({
          id: z.string().min(1).max(256),
          bot: z.boolean().optional(),
          is_you: z.boolean().optional(),
        }),
      )
      .max(100)
      .optional(),
  }),
});
const selfMentionTokens = (self: string) => [`<@${self}>`, `<@!${self}>`];
/** Only a leading mention of the READY-derived bot ID is routing syntax. Other mentions remain user text. */
export function normalizeQqText(content: string, botSelfId?: string) {
  let text = content.trim();
  if (botSelfId) {
    for (const mention of selfMentionTokens(botSelfId))
      if (text.startsWith(mention)) {
        text = text.slice(mention.length).trim();
        break;
      }
  }
  return text;
}
export function groupMessage(
  payload: unknown,
  appId: string,
  botSelfId?: string,
) {
  const parsed = GroupEvent.safeParse(payload);
  if (!parsed.success) return null;
  const d = parsed.data.d;
  // Group-scoped mention IDs can differ from /users/@me and READY IDs.
  // is_you comes only from the authenticated gateway packet or verified webhook.
  const platformSelf =
    d.mentions?.filter((m) => m.bot === true && m.is_you === true) || [];
  if (platformSelf.length > 1) return null;
  const mentionSelfId = platformSelf[0]?.id || botSelfId;
  if (
    parsed.data.t === "GROUP_MESSAGE_CREATE" &&
    (!mentionSelfId ||
      !(
        platformSelf.length === 1 ||
        d.mentions?.some((m) => m.id === mentionSelfId && m.is_you !== false) ||
        selfMentionTokens(mentionSelfId).some((token) =>
          d.content.includes(token),
        )
      ))
  )
    return null;
  const text = normalizeQqText(d.content, mentionSelfId);
  if (!text || text.length > 500) return null;
  return {
    eventKey: JSON.stringify([appId, d.group_openid, d.id]),
    userKey: JSON.stringify([
      appId,
      "group",
      d.group_openid,
      d.author.member_openid,
    ]),
    messageId: d.id,
    groupOpenid: d.group_openid,
    memberOpenid: d.author.member_openid,
    text,
    originalText: d.content,
    eventId: parsed.data.id,
  };
}
