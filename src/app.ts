import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Item } from "./catalog.ts";
import { answer, search } from "./engine.ts";
const Query = z
  .object({
    name: z.string().max(100),
    area: z.string().max(80).optional(),
    maxPriceCents: z.number().int().nonnegative().max(100000).optional(),
    random: z.boolean().optional(),
  })
  .strict();
export function app(rows: Item[], schoolId: number) {
  const app = new Hono();
  app.use("/api/*", bodyLimit({ maxSize: 4096 }));
  app.get("/", (c) =>
    c.html(
      `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CampusBites Lite</title><style>body{font:16px system-ui;max-width:650px;margin:48px auto;padding:16px}input,button{font:inherit;padding:10px;margin:4px}pre{white-space:pre-wrap;line-height:1.8}</style><h1>CampusBites Lite</h1><p>按菜单名称、校区和价格筛选。默认加载虚构演示数据。</p><form id="f"><input id="name" placeholder="完整菜名（可留空）"><input id="area" placeholder="校区（可留空）"><input id="price" type="number" min="0" step="0.01" placeholder="最高价格（元）"><button>查询</button><button type="button" id="random">随便推荐</button></form><pre id="out"></pre><script>async function run(random=false){const q={name:document.querySelector('#name').value,random};const area=document.querySelector('#area').value,price=document.querySelector('#price').value;if(area)q.area=area;if(price!=='')q.maxPriceCents=Math.round(Number(price)*100);const out=document.querySelector('#out');try{const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});const d=await r.json();out.textContent=d.text||d.error;}catch{out.textContent='暂时无法连接，请稍后再试';}}document.querySelector('#f').onsubmit=e=>{e.preventDefault();run()};document.querySelector('#random').onclick=()=>run(true);</script></html>`,
    ),
  );
  app.post("/api/search", async (c) => {
    const q = Query.safeParse(await c.req.json().catch(() => null));
    return q.success
      ? c.json(search(rows, schoolId, q.data))
      : c.json({ error: "请检查查询条件" }, 400);
  });
  app.post("/api/ask", async (c) => {
    const q = z
      .object({ text: z.string().min(1).max(500) })
      .strict()
      .safeParse(await c.req.json().catch(() => null));
    return q.success
      ? c.json(answer(rows, schoolId, q.data.text))
      : c.json({ error: "请提供简短问题" }, 400);
  });
  return app;
}
