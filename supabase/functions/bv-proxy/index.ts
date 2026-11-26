// Proxy somente-leitura do Monitor BotVendas (Supabase Edge Function / Deno).
// O botvendas só aceita CORS do próprio site; esta função repassa as chamadas e libera o CORS para o app.
// Chamada do app:  <projeto>.supabase.co/functions/v1/bv-proxy/api/v2/...
//   - token do botvendas vem no cabeçalho  x-bv-token  (o Authorization fica livre para o Supabase)
const BV_URL = Deno.env.get("BV_URL") ?? "https://farmanutri.botvendas.com";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://drogariafarmanutri.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Somente leitura: GET em /api/v2/*, e POST apenas para obter/renovar o token.
function permitido(method: string, path: string): boolean {
  if (!path.startsWith("/api/v2/")) return false;
  if (method === "GET") return true;
  if (method === "POST") return path === "/api/v2/login" || path === "/api/v2/refresh-token";
  return false;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, x-bv-token, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(req.url);
  const i = url.pathname.indexOf("/api/v2/");
  if (i < 0) return json(404, { error: "not_found" });
  const path = url.pathname.slice(i);
  if (!permitido(req.method, path)) return json(403, { error: "blocked_by_monitor_proxy" });

  const headers: Record<string, string> = { accept: "application/json" };
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  const token = req.headers.get("x-bv-token");
  if (token) headers["authorization"] = `Bearer ${token}`;

  try {
    const up = await fetch(BV_URL + path + url.search, {
      method: req.method,
      headers,
      body: req.method === "POST" ? await req.text() : undefined,
      signal: AbortSignal.timeout(20000),
    });
    return new Response(up.body, {
      status: up.status,
      headers: { ...cors, "content-type": up.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return json(502, { error: "upstream_unreachable", detail: String((e as Error).message) });
  }
});
