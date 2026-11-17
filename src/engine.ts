import { FastParser } from "./fast-query.ts";
import type { Item } from "./catalog.ts";
export const HELP =
  "可以问：牛肉面、我想吃牛肉面、推荐西苑20元以内的牛肉面、随便推荐。也可以使用网页里的筛选框。";
export type Query = {
  name: string;
  area?: string;
  maxPriceCents?: number;
  minPriceCents?: number;
  ingredient?: string;
  random?: boolean;
};
export type Answer = {
  status: "RESULTS" | "NO_RESULT" | "HELP";
  text: string;
  items: Item[];
};
const safe = (s: string) =>
  s.replace(/[\r\n\t\u0000-\u001f\u007f]/gu, " ").replace(/@/gu, "＠");
export function search(rows: Item[], schoolId: number, q: Query): Answer {
  const pool = rows.filter(
    (r) =>
      r.schoolId === schoolId &&
      (!q.name || r.name === q.name) &&
      (!q.ingredient || r.ingredients?.includes(q.ingredient)) &&
      (q.minPriceCents === undefined || (r.unit === "item" && r.priceCents !== null && r.priceCents >= q.minPriceCents)) &&
      (!q.area || r.area?.includes(q.area)) &&
      (q.maxPriceCents === undefined ||
        (r.unit === "item" &&
          r.priceCents !== null &&
          r.priceCents <= q.maxPriceCents)),
  );
  if (q.random) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
  } else
    pool.sort(
      (a, b) =>
        (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity) || a.id - b.id,
    );
  const shops = new Set<number>();
  const items = pool
    .filter((r) => {
      if (shops.has(r.shopId)) return false;
      shops.add(r.shopId);
      return true;
    })
    .slice(0, 3);
  return {
    status: items.length ? "RESULTS" : "NO_RESULT",
    items,
    text: items.length
      ? items
          .map(
            (r) =>
              `${safe(r.name)} · ${r.priceCents === null ? "价格未记录" : "￥" + r.priceCents / 100 + (r.unit === "weight" ? "（按重量计价）" : r.unit === "unknown" ? "（计价单位未记录）" : "")}\n🏠 ${safe(r.shopName)}${r.area ? "\n📍 " + safe(r.area) : ""}`,
          )
          .join("\n\n")
      : "暂时没找到符合条件的菜单，试试其他菜名或调整筛选条件。",
  };
}
const parsers = new WeakMap<Item[], Map<number, FastParser>>();
export function answer(rows: Item[], schoolId: number, text: string): Answer {
  if (text.trim() === "随便推荐")
    return search(rows, schoolId, { name: "", random: true });
  let schools = parsers.get(rows);
  if (!schools) { schools = new Map(); parsers.set(rows, schools); }
  let parser = schools.get(schoolId);
  if (!parser) { parser = new FastParser(rows, schoolId); schools.set(schoolId, parser); }
  const frame = parser.parse(text);
  if (!frame) return { status: "HELP", text: HELP, items: [] };
  return search(rows, schoolId, {
    name: frame.target,
    ...(frame.ingredient ? { ingredient: frame.ingredient } : {}),
    ...(frame.minPriceCents === null ? {} : { minPriceCents: frame.minPriceCents }),
    ...(frame.location ? { area: frame.location } : {}),
    ...(frame.maxPriceCents === null
      ? {}
      : { maxPriceCents: frame.maxPriceCents }),
  });
}
