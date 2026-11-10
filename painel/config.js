// Configuração do painel de auditoria Farmácia Popular (mesmo projeto Supabase do app Minhas Metas).
// A chave "anon public" pode ficar aqui: ela só permite o que as regras do banco liberam
// (ler o painel; editar só pela função popular_editar, com login). NUNCA coloque a service_role aqui.
window.PAINEL_CONFIG = {
  SUPABASE_URL: "https://pfhkysaprroqgfbzrgsr.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt5c2FwcnJvcWdmYnpyZ3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTUyNDEsImV4cCI6MjEwODYzMTI0MX0.1qruKa3F6IFEoyjqwLn1UBMNRHOZFtIWxBLFIOIdHVA",
  EMAIL_DOMINIO: "vendedor.farmanutri.app",   // o app faz login com <código>@vendedor.farmanutri.app
  ATUALIZAR_MINUTOS: 5,
};
