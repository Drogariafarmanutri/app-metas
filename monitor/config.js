// Configuração do Monitor BotVendas.
// API_BASE: função "bv-proxy" no projeto Supabase (repassa as chamadas ao botvendas).
// A chave "anon public" é pública por desenho (a mesma do app de metas); NUNCA coloque aqui chave service_role.
window.MONITOR_CONFIG = {
  API_BASE: "https://pfhkysaprroqgfbzrgsr.supabase.co/functions/v1/bv-proxy",
  PANEL_URL: "https://farmanutri.botvendas.com", // painel web: ao tocar num cliente abre /orders/<id>
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt5c2FwcnJvcWdmYnpyZ3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTUyNDEsImV4cCI6MjEwODYzMTI0MX0.1qruKa3F6IFEoyjqwLn1UBMNRHOZFtIWxBLFIOIdHVA",
};
