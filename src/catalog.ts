import { readFileSync } from "node:fs";
import { z } from "zod";
export const Item = z
  .object({
    id: z.number().int().positive(),
    schoolId: z.number().int().positive(),
    shopId: z.number().int().positive(),
    shopName: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    area: z.string().max(80).nullable(),
    priceCents: z.number().int().nonnegative().nullable(),
    unit: z.enum(["item", "weight", "unknown"]),
  })
  .strict();
export type Item = z.infer<typeof Item>;
export function loadCatalog(
  file = process.env.CATALOG_FILE || "examples/catalog.json",
) {
  const rows = z.array(Item).parse(JSON.parse(readFileSync(file, "utf8")));
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw Error("Duplicate catalog ID");
  return rows;
}
