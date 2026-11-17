export type Frame = {
  schoolId: number;
  target: string;
  location: string | null;
  maxPriceCents: number | null;
  mode: "CONCEPT" | "EXACT";
};
export function cleanQuery(text: string) {
  return text
    .normalize("NFC")
    .trim()
    .replace(/[!！?？。]+$/u, "")
    .trim();
}
const amount = "([0-9]{1,3}(?:\\.[0-9]{1,2})?)";
export function parseFast(
  text: string,
  known: Set<string>,
  schoolId = 1,
): Frame | null {
  const q = cleanQuery(text);
  let target = q;
  let location: string | null = null;
  let cents: number | null = null;
  let mode: Frame["mode"] = "CONCEPT";
  const exact = q.match(/^只要菜名(?:逐字)?(?:叫|是)[“「"]?(.+?)[”」"]?$/u);
  if (exact) {
    target = exact[1];
    mode = "EXACT";
  } else {
    target = q.replace(/^(?:我想吃|想吃|给我推荐|推荐一下|推荐|来一份)/u, "");
    const l = target.match(/^(西苑|中苑|东苑)(?:的)?(.+)$/u);
    if (l) {
      location = l[1];
      target = l[2];
    }
    const before = target.match(
      new RegExp("^" + amount + "(?:元|块)(?:以内|以下)(?:的)?(.+)$", "u"),
    );
    const after = target.match(
      new RegExp(
        "^(.+?)[，, ](?:预算)?" + amount + "(?:元|块)(?:以内|以下)$",
        "u",
      ),
    );
    if (before) {
      cents = Math.round(Number(before[1]) * 100);
      target = before[2];
    } else if (after) {
      target = after[1];
      cents = Math.round(Number(after[2]) * 100);
    }
  }
  if (!known.has(target)) return null;
  return { schoolId, target, location, maxPriceCents: cents, mode };
}
export function frameKey(frame: Frame) {
  return JSON.stringify(frame);
}
