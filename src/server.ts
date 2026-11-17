import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { loadCatalog } from "./catalog.ts";
const schoolId = Number(process.env.SCHOOL_ID || 1);
if (!Number.isSafeInteger(schoolId) || schoolId < 1)
  throw Error("Invalid school");
serve({
  fetch: app(loadCatalog(), schoolId).fetch,
  hostname: "127.0.0.1",
  port: Number(process.env.PORT || 8787),
});
console.log("CampusBites Lite: http://127.0.0.1:" + (process.env.PORT || 8787));
