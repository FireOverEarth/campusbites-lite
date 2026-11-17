import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "../src/catalog.ts";
import { answer, search } from "../src/engine.ts";
import { app } from "../src/app.ts";
import { handler } from "../src/qq-handler.ts";
import { QqState } from "../src/qq-state.ts";
const rows = loadCatalog("examples/catalog.json");
test("simple named and bounded queries return source menu items", () => {
  const a = answer(rows, 1, "推荐西苑20元以内的牛肉面");
  assert.equal(a.status, "RESULTS");
  assert.deepEqual(
    a.items.map((x) => x.id),
    [1],
  );
  assert.match(a.text, /￥15/);
});
test("unsupported compound instructions are not silently stripped", () => {
  for (const q of [
    "/查 鸡腿饭",
    "西苑或者中苑的饭",
    "换两家",
    "不要花生的牛肉面",
    "陪我聊天",
    "我想吃不存在的牛肉面",
  ])
    assert.equal(answer(rows, 1, q).status, "HELP", q);
});
test("school isolation and unknown price are preserved", () => {
  const extras = [
    ...rows,
    { ...rows[0]!, id: 9, schoolId: 2 },
    { ...rows[0]!, id: 10, shopId: 10, priceCents: null },
    { ...rows[0]!, id: 11, shopId: 11, unit: "weight" as const },
  ];
  assert.deepEqual(
    search(extras, 1, { name: "牛肉面", maxPriceCents: 2000 }).items.map(
      (x) => x.id,
    ),
    [1],
  );
  assert.equal(search(rows, 2, { name: "" }).status, "NO_RESULT");
});
test("random suggestions stay within source and structured conditions", () => {
  const out = search(rows, 1, {
    name: "",
    area: "西苑",
    maxPriceCents: 2000,
    random: true,
  });
  assert.deepEqual(
    out.items.map((x) => x.id),
    [1],
  );
  assert.ok(answer(rows, 1, "随便推荐").items.length > 0);
});
test("HTTP interface rejects model-like and extra fields", async () => {
  const a = app(rows, 1);
  assert.equal((await a.request("/")).status, 200);
  const good = await a.request("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "牛肉面", maxPriceCents: 2000 }),
  });
  assert.equal((await good.json()).items.length, 1);
  assert.equal(
    (
      await a.request("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"name":"","schoolId":2}',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.request("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"text":"/查 牛肉面"}',
      })
    ).status,
    200,
  );
});
const packet = (id: string, text: string, user = "u", group = "g") => ({
  op: 0,
  t: "GROUP_MESSAGE_CREATE",
  d: {
    id,
    group_openid: group,
    content: "<@bot> " + text,
    author: { member_openid: user },
    mentions: [{ id: "bot", bot: true, is_you: true }],
  },
});
test("QQ scopes groups, deduplicates messages, and feedback belongs to original requester", async () => {
  const state = new QqState(":memory:"),
    sent: string[] = [];
  const h = handler({
    appId: "test",
    selfId: () => "bot",
    groups: new Set(["g"]),
    schoolId: 1,
    rows,
    state,
    send: async (_g, _m, t) => {
      sent.push(t);
    },
  });
  try {
    await h(packet("1", "牛肉面"));
    await h(packet("1", "牛肉面"));
    await h(packet("2", "牛肉面", "u", "other"));
    assert.equal(sent.length, 1);
    const id = /\/准 ([0-9a-f-]{36})/.exec(sent[0]!)![1]!;
    await h(packet("3", "/准 " + id, "other"));
    assert.match(sent.at(-1)!, /只能评价自己/);
    await h(packet("4", "/准 " + id));
    assert.match(sent.at(-1)!, /已记录/);
    await h({
      op: 0,
      t: "GROUP_MESSAGE_CREATE",
      d: {
        id: "5",
        group_openid: "g",
        content: "牛肉面",
        author: { member_openid: "u" },
      },
    });
    assert.equal(sent.length, 3);
  } finally {
    state.close();
  }
});
test("QQ per-user limiter and expiry are enforced", () => {
  const s = new QqState(":memory:");
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(s.claim(String(i), "u", 1000), true);
    assert.equal(s.claim("limit", "u", 1000), false);
    assert.equal(s.claim("other", "v", 1000), true);
    s.prune(86402000);
    assert.equal(s.claim("0", "u", 86402000), true);
  } finally {
    s.close();
  }
});
