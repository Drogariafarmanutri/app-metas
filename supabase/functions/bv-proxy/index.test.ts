// Teste da função com um botvendas simulado.  deno test --allow-net --allow-env --allow-read index.test.ts
import assert from "node:assert";
const assertEquals = (a: unknown, b: unknown) => assert.deepStrictEqual(a, b);

const upstream = Deno.serve({ port: 0, onListen() {} }, async (req) => {
  const u = new URL(req.url);
  const auth = req.headers.get("authorization");
  if (u.pathname === "/api/v2/login") {
    const b = await req.json();
    return Response.json(b.password === "ok" ? { token: "T123" } : { error: "invalid_credentials" });
  }
  if (auth !== "Bearer T123") return Response.json({ message: "Unauthenticated." }, { status: 401 });
  return Response.json({ path: u.pathname + u.search });
});
Deno.env.set("BV_URL", `http://127.0.0.1:${upstream.addr.port}`);

let handler!: (r: Request) => Promise<Response>;
(Deno as any).serve = (_o: unknown, h?: (r: Request) => Promise<Response>) => { handler = (h ?? _o) as any; return {}; };
await import("./index.ts");

const base = "https://x.supabase.co/functions/v1/bv-proxy";
const ORIGIN = "https://drogariafarmanutri.github.io";

Deno.test("OPTIONS libera CORS para o site do app", async () => {
  const r = await handler(new Request(base + "/api/v2/login", { method: "OPTIONS", headers: { origin: ORIGIN } }));
  assertEquals(r.status, 204);
  assertEquals(r.headers.get("access-control-allow-origin"), ORIGIN);
  assertEquals(r.headers.get("access-control-allow-headers")!.includes("x-bv-token"), true);
});
Deno.test("origem desconhecida não recebe CORS dela", async () => {
  const r = await handler(new Request(base + "/api/v2/login", { method: "OPTIONS", headers: { origin: "https://evil.com" } }));
  assertEquals(r.headers.get("access-control-allow-origin"), ORIGIN);
});
Deno.test("login repassado", async () => {
  const r = await handler(new Request(base + "/api/v2/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email: "a@b.c", password: "ok" }) }));
  assertEquals((await r.json()).token, "T123");
});
Deno.test("GET usa x-bv-token como Bearer e preserva a query", async () => {
  const r = await handler(new Request(base + "/api/v2/attendance-dashboard/orders-by-sector-status?status=2&sector=1", { headers: { "x-bv-token": "T123", authorization: "Bearer SUPABASE_ANON" } }));
  assertEquals((await r.json()).path, "/api/v2/attendance-dashboard/orders-by-sector-status?status=2&sector=1");
});
Deno.test("sem x-bv-token = 401 do botvendas (não vaza o JWT do Supabase)", async () => {
  const r = await handler(new Request(base + "/api/v2/sales-summary/sellers", { headers: { authorization: "Bearer SUPABASE_ANON" } }));
  assertEquals(r.status, 401);
});
Deno.test("bloqueia escrita e rotas fora de /api/v2", async () => {
  for (const m of ["PUT", "DELETE", "PATCH"]) assertEquals((await handler(new Request(base + "/api/v2/sellers/1", { method: m, headers: { "x-bv-token": "T123" } }))).status, 403);
  assertEquals((await handler(new Request(base + "/api/v2/webhooks", { method: "POST", body: "{}", headers: { "x-bv-token": "T123" } }))).status, 403);
  assertEquals((await handler(new Request(base + "/outra/rota"))).status, 404);
});
Deno.test({ name: "fim", fn() { upstream.shutdown(); }, sanitizeOps: false, sanitizeResources: false });
