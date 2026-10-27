// App de Metas Farmanutri — telas e acesso ao banco (Supabase).
// Modo demonstração: abra com ?demo na URL (ou sem config.js preenchido)
// para ver o app com números de exemplo, sem login real.

const CFG = window.APP_CONFIG || {};
const DEMO =
  new URLSearchParams(location.search).has("demo") ||
  !CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes("SEU-PROJETO");
const DOMINIO_EMAIL = "vendedor.farmanutri.app";
const app = document.getElementById("app");

let sb = null; // cliente Supabase
const estado = { logado: false, perfil: null, dados: null, ranking: [], equipe: [], loja: null, atualizadoEm: null, erro: null, verTodosVencendo: false };
// Gestor (diretoria/gerência) olhando os números de um vendedor: código dele; null = os próprios
let VER = null;
const membro = (codigo) => estado.equipe.find((m) => m.codigo === codigo) || null;
const dadosAlvo = () => (VER != null ? membro(VER)?.dados || null : estado.dados);
const perfilAlvo = () => (VER != null ? membro(VER) : estado.perfil);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = (v, casas = 0) =>
  v == null ? "–" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (v, casas = 0) => (v == null ? "–" : (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%");
const num = (v, casas = 1) => (v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeMes = (mesano) => {
  const [a, m] = String(mesano || "").split("-").map(Number);
  return a && m ? `${MESES[m - 1]} ${a}` : "";
};
const iniciais = (nome) => String(nome || "?").split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
const nomeFaixa = (f) => (f === "super" ? "Supermeta" : `${f}%`);
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

// ícones (traço simples, sem emoji)
const I = {
  cruz: (t = 22) => `<svg width="${t}" height="${t}" viewBox="0 0 22 22" aria-hidden="true"><rect width="22" height="22" rx="5" fill="#FFFFFF"/><path d="M8 4h6v4h4v6h-4v4H8v-4H4V8h4z" fill="#E14544"/></svg>`,
  ok: `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="#32753D"/><path d="M5 9.2l2.6 2.6L13 6.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  relogio: `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="#141414" stroke-width="2"/><path d="M9 5v4.5l3 2" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round"/></svg>`,
  vazio: `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="#4A5560" stroke-width="1.5"/></svg>`,
  tracejado: `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="#4A5560" stroke-width="1.5" stroke-dasharray="3 2"/></svg>`,
  xis: `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="#141414" stroke-width="2"/><path d="M6 6l6 6M12 6l-6 6" stroke="#141414" stroke-width="2" stroke-linecap="round"/></svg>`,
  estrela: `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L1.8 6.8l5-.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  alerta: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>`,
  subir: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1978BC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>`,
  voltar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  cadeado: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5560" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  mes: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  indicadores: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  premio: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/></svg>`,
  vender: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.6"/></svg>`,
  relogioP: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  equipe: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2A5 5 0 0 1 21.5 19"/></svg>`,
  ranking: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>`,
};

// ---------------------------------------------------------------------------
// Dados de exemplo (modo demonstração)
// ---------------------------------------------------------------------------
const EXEMPLO = {
  perfil: { codigo: 0, nome: "Vendedor Exemplo", ativo: true },
  atualizadoEm: new Date().toISOString(),
  ranking: [
    { posicao: 1, codigo: 1, nome: "Vendedor A", supermeta: true },
    { posicao: 2, codigo: 2, nome: "Vendedor B", supermeta: false },
    { posicao: 3, codigo: 3, nome: "Vendedor C", supermeta: false },
    { posicao: 4, codigo: 0, nome: "Vendedor Exemplo", supermeta: false },
    { posicao: 5, codigo: 5, nome: "Vendedor D", supermeta: false },
    { posicao: 6, codigo: 6, nome: "Vendedor E", supermeta: false },
  ],
  dados: {
    mesano: "2026-10",
    faturamento: 47400, meta: 60000, pct_meta: 0.79,
    calendario: { total: 27, decorridos: 22, restantes: 6 },
    hoje: { faturamento: 860, atendimentos: 14 },
    indicadores: { lucratividade: 38.2, lucratividade_minima: 34, identificacao: 0.46, identificacao_escopo: "vendedor", vendas_identificadas: 207, vendas: 450, faltam_identificar: 37, pct_mais_de_1_sku: 0.58, ticket_medio: 68.4, itens_por_venda: 2.3 },
    faixas: [
      { faixa: 70, valor: 42000, atingida: true }, { faixa: 80, valor: 48000, atingida: false },
      { faixa: 90, valor: 54000, atingida: false }, { faixa: 100, valor: 60000, atingida: false },
      { faixa: "super", valor: 66000, atingida: false },
    ],
    proxima_faixa: { faixa: 80, valor: 48000, falta: 600 },
    supermeta: false, meta_hoje: 2100, projecao: 58200, pct_projecao: 0.97,
    premiacao: {
      faixa: 70, pct_lucro: 0.05, lucro_fora_vitaminas: 14200, base: 710,
      condicoes: { faixa_70: true, lucratividade: true, identificacao: false },
      liberada: false, valor_hoje: 0, valor_se_liberar: 710,
      bonus: {
        pct_total: 0.36, valor: 255.6,
        itens: [
          { indicador: "Identificação", ok: true, pct: 0.06, marcado: true },
          { indicador: "Prateleiras", ok: true, pct: 0.06, marcado: true },
          { indicador: "Vencimento", ok: false, pct: 0.06, marcado: false },
          { indicador: "Pós-venda", ok: true, pct: 0.12, marcado: true },
          { indicador: "Farmácia Popular", ok: true, pct: 0.12, marcado: true },
          { indicador: "Lucratividade (bônus)", ok: false, pct: 0.58, marcado: true },
          { indicador: "Notas em dia", ok: true, pct: -0.05, marcado: true },
        ],
      },
      ritmo: { faixa: 90, valor: 1300 },
    },
    ranking: { posicao: 4, total: 6 },
    vencendo: { faturamento: 860.4, lucro: 412.1, itens: 23, posicao: 3, total: 6 },
    mix: {
      vendas_4sku_001: 37, valor_promocao: 6120, qtd_promocao: 402, pct_promocao: 0.129,
      top_vendido: { codigo: 1, nome: "DIPIRONA MONOIDRATADA 1G 10 COMP", qtd: 182 },
      top_lucrativo: { codigo: 2, nome: "PROTETOR SOLAR FPS 50 200ML", lucro: 734.5 },
    },
  },
  loja: {
    vencendo: [
      { codigo: 11, nome: "VITAMINA C 1G 10 EFERV", qtd: 6, vencimento: "2026-11-05", dias: 9, preco: 12.9 },
      { codigo: 12, nome: "SHAMPOO ANTICASPA 200ML", qtd: 3, vencimento: "2026-11-18", dias: 22, preco: 19.9 },
      { codigo: 13, nome: "SORO FISIOLOGICO 500ML", qtd: 12, vencimento: "2026-11-30", dias: 34, preco: 4.5 },
      { codigo: 14, nome: "ALBENDAZOL 400MG 1 COMP", qtd: 8, vencimento: "2026-12-10", dias: 44, preco: null },
    ],
    vencendo_loja: { faturamento: 4310, itens: 141 },
    promocoes: [
      { codigo: 21, nome: "FRALDA INFANTIL G 30UN", termino: "2026-10-31" },
      { codigo: 22, nome: "PROTETOR SOLAR FPS 30 120ML", termino: "2026-11-15" },
    ],
    arrasto: [
      { codigo: 31, nome: "LENCO UMEDECIDO 50UN", vendas: 48 },
      { codigo: 32, nome: "POMADA PARA ASSADURA 45G", vendas: 31 },
    ],
    oportunidades: [{ codigo: 41, nome: "COLAGENO HIDROLISADO 120 CAPS", rank_lucro: 2, qtd: 9 }],
    sazonais: [
      { chave: "este_mes", mes: 10, ano: 2025, itens: [{ codigo: 51, nome: "REPELENTE SPRAY 100ML", posicao: 1 }, { codigo: 52, nome: "PARACETAMOL 750MG 20 COMP", posicao: 2 }] },
      { chave: "proximo_mes", mes: 11, ano: 2025, itens: [{ codigo: 53, nome: "PROTETOR SOLAR FPS 50 200ML", posicao: 1 }] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Acesso ao Supabase
// ---------------------------------------------------------------------------
async function iniciarSupabase() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
}

const emailDo = (codigo) => `${String(codigo).trim()}@${DOMINIO_EMAIL}`;

function traduzErroLogin(msg = "") {
  if (/invalid login/i.test(msg)) return "Código ou senha incorretos. Se ainda não criou sua senha, toque em “Primeiro acesso”.";
  if (/banned/i.test(msg)) return "Seu acesso foi encerrado. Fale com o seu supervisor.";
  if (/fetch|network/i.test(msg)) return "Sem conexão com a internet. Tente de novo.";
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}

function traduzErroCadastro(msg = "") {
  if (/already registered|already been registered/i.test(msg)) return "Este código já tem acesso. Volte e use “Entrar”. Se esqueceu a senha, fale com o supervisor.";
  if (/password/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/database error/i.test(msg)) return "Não foi possível criar o acesso. Confira o código e o CPF (precisam ser os do seu cadastro no Automatiza). Se este código já tiver acesso, fale com o supervisor.";
  if (/fetch|network/i.test(msg)) return "Sem conexão com a internet. Tente de novo.";
  return "Não foi possível criar o acesso agora. Tente de novo em instantes.";
}

async function carregarDados() {
  if (DEMO) {
    const gestor = new URLSearchParams(location.search).has("gestor");
    Object.assign(estado, {
      perfil: { ...EXEMPLO.perfil, gestor, nome: gestor ? "Gerente Exemplo" : EXEMPLO.perfil.nome },
      dados: gestor ? null : EXEMPLO.dados,
      ranking: EXEMPLO.ranking,
      loja: EXEMPLO.loja,
      atualizadoEm: EXEMPLO.atualizadoEm,
      equipe: gestor ? equipeExemplo() : [],
    });
    return;
  }
  // "gestor" só existe depois da atualização do banco; sem ela, segue como vendedor
  let { data: perfil, error: e1 } = await sb.from("vendedores").select("codigo,nome,ativo,bloqueado,gestor").eq("user_id", (await sb.auth.getUser()).data.user?.id).maybeSingle();
  if (e1) ({ data: perfil, error: e1 } = await sb.from("vendedores").select("codigo,nome,ativo,bloqueado").maybeSingle());
  if (e1) throw e1;
  if (!perfil || !perfil.ativo || perfil.bloqueado) {
    await sb.auth.signOut();
    estado.logado = false;
    estado.erro = "Seu acesso foi encerrado. Fale com o seu supervisor.";
    return;
  }
  const [{ data: inds, error: e2 }, { data: rk, error: e3 }, { data: sinc }, { data: vend }] = await Promise.all([
    perfil.gestor
      ? sb.from("indicadores").select("codigo,mesano,dados,atualizado_em")
      : sb.from("indicadores").select("codigo,mesano,dados,atualizado_em").eq("codigo", perfil.codigo),
    sb.from("ranking").select("*").order("posicao"),
    sb.from("sincronizacao").select("atualizado_em").maybeSingle(),
    perfil.gestor ? sb.from("vendedores").select("codigo,nome,ativo,tem_meta") : Promise.resolve({ data: [] }),
  ]);
  if (e2) throw e2;
  if (e3) throw e3;
  const { data: lj } = await sb.from("loja").select("dados").maybeSingle().then((r) => r, () => ({ data: null }));
  estado.loja = lj?.dados || null;
  const comMes = (x) => (x ? { ...x.dados, mesano: x.mesano } : null);
  const ind = (inds || []).find((x) => x.codigo === perfil.codigo);
  estado.perfil = perfil;
  estado.dados = comMes(ind);
  const fotos = Object.fromEntries((rk || []).map((r) => [r.codigo, r.foto]));
  estado.equipe = perfil.gestor
    ? (vend || []).filter((v) => v.ativo && v.tem_meta).map((v) => ({
        codigo: v.codigo, nome: v.nome, foto: fotos[v.codigo] || null,
        dados: comMes((inds || []).find((x) => x.codigo === v.codigo)),
      }))
    : [];
  estado.ranking = rk || [];
  estado.atualizadoEm = sinc?.atualizado_em || ind?.atualizado_em || null;
}

// ---------------------------------------------------------------------------
// Moldura das telas internas
// ---------------------------------------------------------------------------
const ABAS = [
  ["mes", "Meu Mês", I.mes],
  ["indicadores", "Indicadores", I.indicadores],
  ["vender", "Vender", I.vender],
  ["premio", "Prêmio", I.premio],
  ["ranking", "Ranking", I.ranking],
];
const abasDe = (...ids) => ids.map((id) => ABAS.find((a) => a[0] === id));

function moldura(aba, titulo, subtitulo, corpo) {
  const d = dadosAlvo() || estado.dados || estado.equipe.find((m) => m.dados)?.dados;
  const vendo = VER != null ? membro(VER) : null;
  const abas = vendo
    ? [["equipe", "Equipe", I.equipe], ...abasDe("mes", "indicadores", "premio").map(([id, rot, ic]) => [`v/${VER}/${id}`, rot.replace("Meu ", ""), ic, id])]
    : estado.perfil?.gestor ? [["equipe", "Equipe", I.equipe], ...abasDe("vender", "ranking")] : ABAS;
  return `
    ${DEMO ? `<div class="aviso-demo">Modo demonstração · números de exemplo</div>` : ""}
    <header class="topo">
      <div class="topo-linha">
        <div class="marca"><img class="simbolo" src="icones/simbolo-64.png" alt="" width="26" height="26"><span>FARMANUTRI</span></div>
        <div class="topo-linha">
          <span class="topo-mes">${esc(nomeMes(d?.mesano))}</span>
          <button class="sair" data-acao="sair" type="button">Sair</button>
        </div>
      </div>
      ${subtitulo ? `<p style="margin-top:10px">${subtitulo}</p>` : ""}
      <h1>${titulo}</h1>
    </header>
    ${vendo ? `<a class="vendo" href="#/equipe">${I.voltar}<span>Vendo <strong>${esc(vendo.nome)}</strong> · voltar para a equipe</span></a>` : ""}
    <main id="conteudo" tabindex="-1">
      ${corpo}
      ${estado.atualizadoEm ? `<p class="nota centro">Atualizado às ${hora(estado.atualizadoEm)} · dados do Automatiza</p>` : ""}
    </main>
    <nav class="abas" aria-label="Navegação principal"><div class="dentro" style="grid-template-columns:repeat(${abas.length},minmax(0,1fr))">
      ${abas.map(([id, rot, ic, base]) => `<a href="#/${id}" ${(base || id) === aba && (vendo ? id !== "equipe" : true) ? 'aria-current="page"' : ""}>${ic}${rot}</a>`).join("")}
    </div></nav>`;
}

function semDados(aba, titulo) {
  const msg = estado.perfil?.gestor && VER == null
    ? "Você não tem meta própria neste mês. Veja os números de todos na aba Equipe."
    : "Ainda não há números neste mês. Assim que houver vendas e meta cadastradas, eles aparecem aqui.";
  return moldura(aba, titulo, "", `<section class="cartao"><p style="margin:0;font-weight:600">${msg}</p></section>`);
}

// ---------------------------------------------------------------------------
// Tela: Meu Mês
// ---------------------------------------------------------------------------
function telaMes() {
  const d = dadosAlvo();
  if (!d) return semDados("mes", "Meu Mês");
  const primeiroNome = esc(String(perfilAlvo()?.nome || "").split(" ")[0]);
  if (d.sem_meta) {
    return moldura("mes", "Sua meta ainda não foi cadastrada", `Olá, ${primeiroNome}`, `
      <section class="cartao"><span class="rotulo">Vendido no mês</span><span class="valor-g">${brl(d.faturamento)}</span></section>`);
  }
  const prox = d.proxima_faixa;
  const titulo = d.supermeta ? "Supermeta batida! Parabéns!" : prox ? `Faltam ${brl(prox.falta)} para ${prox.faixa === "super" ? "a Supermeta" : `os ${prox.faixa}%`}` : "Meta batida!";
  const escala = d.meta * 1.1;
  const largura = Math.min(d.faturamento / escala, 1) * 100;
  const marcas = d.faixas.map((f) => `<div class="barra-marca" style="left:calc(${(f.valor / escala) * 100}% - 1px)"></div>`).join("");
  const faixas = d.faixas.map((f) => {
    const ehProx = prox && f.faixa === prox.faixa;
    const icone = f.atingida ? I.ok : ehProx ? I.relogio : f.faixa === "super" ? I.estrela : I.vazio;
    const dir = f.atingida ? "<b>Atingida</b>" : `<b>faltam ${brl(f.valor - d.faturamento)}</b>`;
    return `<div class="faixa ${f.atingida ? "ok" : ""} ${ehProx ? "proxima" : ""}"><span>${icone}${nomeFaixa(f.faixa)} · ${brl(f.valor)}</span><span>${dir}</span></div>`;
  }).join("");
  const metaHoje = d.meta_hoje || 0;
  return moldura("mes", titulo, `Olá, ${primeiroNome}`, `
    <section class="cartao">
      <div class="linha-base"><span class="rotulo">Vendido no mês</span><span class="rotulo">Meta ${brl(d.meta)}</span></div>
      <div style="display:flex;align-items:baseline;gap:8px"><span class="valor-g">${brl(d.faturamento)}</span><span class="valor-p azul" style="font-size:16px">${pct(d.pct_meta)}</span></div>
      <div class="barra" role="img" aria-label="${pct(d.pct_meta)} da meta">
        <div class="barra-cheia" style="width:${largura}%"></div>${marcas}
      </div>
      <div class="faixas">${faixas}</div>
    </section>
    <div class="grade-2">
      <section class="cartao">
        <span class="rotulo">${VER != null ? "Meta de hoje" : "Sua meta de hoje"}</span>
        <span class="valor-m azul">${brl(metaHoje)}</span>
        <span class="nota">${d.calendario.restantes} ${d.calendario.restantes === 1 ? "dia" : "dias"} de venda restantes</span>
      </section>
      <section class="cartao">
        <span class="rotulo">Se mantiver o ritmo</span>
        <span class="valor-m ${d.pct_projecao >= 1 ? "verde" : ""}">${pct(d.pct_projecao)}</span>
        <span class="nota">projeção ${brl(d.projecao)}</span>
      </section>
    </div>
    <section class="cartao" style="flex-direction:row;justify-content:space-between;align-items:center">
      <div style="display:flex;flex-direction:column">
        <span class="rotulo">Hoje até agora</span>
        <span class="valor-p">${brl(d.hoje.faturamento)} <span class="rotulo">de ${brl(metaHoje)}</span></span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        <span class="rotulo">Atendimentos</span>
        <span class="valor-p">${d.hoje.atendimentos}</span>
      </div>
    </section>`);
}

// ---------------------------------------------------------------------------
// Tela: Indicadores
// ---------------------------------------------------------------------------
function barraIndicador(rotulo, valorTxt, largura, cor, marca, aria, legenda) {
  return `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="linha-base"><span style="font-size:15px;font-weight:700">${rotulo}</span><span class="valor-p" style="font-size:18px">${valorTxt}</span></div>
      <div class="barra fina" role="img" aria-label="${aria}">
        <div class="barra-cheia" style="width:${Math.max(0, Math.min(largura, 100))}%;background:${cor}"></div>
        ${marca != null ? `<div class="barra-marca" style="left:calc(${marca}% - 1px)"></div>` : ""}
      </div>
      ${legenda ? `<span class="nota" style="font-size:13px">${legenda}</span>` : ""}
    </div>`;
}

function telaIndicadores() {
  const d = dadosAlvo();
  if (!d) return semDados("indicadores", "Meus Indicadores");
  const i = d.indicadores;
  const ident = i.identificacao ?? 0;
  const lucr = i.lucratividade ?? 0;
  const escalaLucr = Math.max(i.lucratividade_minima, lucr, 1) * 1.25;
  const daLoja = i.identificacao_escopo === "loja";
  const alerta = i.vendas && ident <= 0.5 ? `
    <section class="alerta">${I.alerta}<div>
      <strong>Identificação ${daLoja ? "da loja " : ""}abaixo de 50%</strong>
      <span>${daLoja
        ? `Faltam ${i.faltam_identificar} vendas identificadas na loja para liberar a premiação de todos. Peça o CPF em todas as vendas!`
        : `Peça o CPF em mais ${i.faltam_identificar} ${i.faltam_identificar === 1 ? "venda" : "vendas"} para liberar a sua premiação.`}</span>
    </div></section>` : "";
  const itens = d.premiacao?.bonus?.itens || [];
  const checklist = itens.length ? `
    <section class="cartao">
      <h2>Checklist do mês <span class="rotulo" style="font-weight:500">· marcado pelo supervisor</span></h2>
      <div class="checklist">
        ${itens.map((it) => it.ok && it.marcado
          ? `<span>${I.ok}${esc(it.indicador)}</span>`
          : `<span class="pendente">${it.marcado ? I.xis : I.tracejado}${esc(it.indicador)}${it.marcado ? "" : ": pendente"}</span>`).join("")}
      </div>
    </section>` : "";
  return moldura("indicadores", "Meus Indicadores", "", `
    ${alerta}
    <section class="cartao" style="gap:14px">
      ${barraIndicador(`Identificação de clientes${daLoja ? " (loja)" : ""}`, pct(i.identificacao), ident * 100, ident > 0.5 ? "var(--verde)" : "var(--ouro)", 50,
        `${pct(i.identificacao)} de identificação; mínimo 50%`, `${i.vendas_identificadas} de ${i.vendas} vendas · mínimo para premiação: 50%`)}
      ${barraIndicador("Lucratividade", `<span class="${lucr > i.lucratividade_minima ? "verde" : ""}">${num(i.lucratividade)}%</span>`,
        (lucr / escalaLucr) * 100, lucr > i.lucratividade_minima ? "var(--verde)" : "var(--ouro)", (i.lucratividade_minima / escalaLucr) * 100,
        `${num(i.lucratividade)}% de lucratividade; mínimo ${num(i.lucratividade_minima, 0)}%`, `Mínimo da sua função: ${num(i.lucratividade_minima, 0)}% · sem vitaminas`)}
      ${barraIndicador("Vendas com mais de 1 item", pct(i.pct_mais_de_1_sku), (i.pct_mais_de_1_sku || 0) * 100, "var(--azul)", null,
        `${pct(i.pct_mais_de_1_sku)} das vendas com mais de 1 item`, "")}
    </section>
    <div class="grade-2">
      <section class="cartao"><span class="rotulo">Ticket médio</span><span class="valor-m" style="font-size:22px">${brl(i.ticket_medio, 2)}</span></section>
      <section class="cartao"><span class="rotulo">Itens por venda</span><span class="valor-m" style="font-size:22px">${num(i.itens_por_venda)}</span></section>
    </div>
    ${blocoMix(d)}
    ${checklist}`);
}

// ---------------------------------------------------------------------------
// Tela: Premiação
// ---------------------------------------------------------------------------
function telaPremio() {
  const d = dadosAlvo();
  if (!d || !d.premiacao) return semDados("premio", "Minha Premiação");
  const p = d.premiacao;
  const i = d.indicadores;
  const motivos = [];
  if (!p.condicoes.faixa_70) motivos.push(`passar de 70% da meta (faltam ${brl(d.faixas[0].valor - d.faturamento)})`);
  if (!p.condicoes.lucratividade) motivos.push(`lucratividade acima de ${num(i.lucratividade_minima, 0)}% (está em ${num(i.lucratividade)}%)`);
  if (!p.condicoes.identificacao) motivos.push(`identificação acima de 50% (está em ${pct(i.identificacao)})`);
  const textoBloqueio = !p.liberada
    ? `<p style="margin:0;font-size:14px;line-height:19px;font-weight:600">Para liberar: ${esc(motivos.join("; "))}.${p.condicoes.faixa_70 ? ` Liberando, hoje você já teria <span class="verde" style="font-weight:800">${brl(p.valor_se_liberar)}</span>.` : ""}</p>`
    : `<p style="margin:0;font-size:14px;font-weight:600">Faixa ${p.faixa}% atingida: ${pct(p.pct_lucro, 1)} do lucro sem vitaminas.</p>`;
  const cond = (ok, texto, valor) => `
    <div class="condicao ${ok ? "" : "falhou"}"><span>${ok ? I.ok : I.xis}${texto}</span><span style="color:${ok ? "var(--cinza)" : "inherit"}">${valor}</span></div>`;
  const tabela = [[70, 0.05], [80, 0.065], [90, 0.075], [100, 0.085]].map(([f, x]) => `
    <div class="${p.faixa === f ? "atual" : ""}"><small>${f}%</small><strong>${num(x * 100, x * 100 % 1 ? 1 : 0)}%</strong></div>`).join("");
  const bonus = p.bonus;
  return moldura("premio", "Minha Premiação", "", `
    <section class="cartao" style="gap:12px">
      <div class="linha">
        <div style="display:flex;flex-direction:column">
          <span class="rotulo" style="font-size:14px">Se o mês fechar hoje</span>
          <span class="valor-g" style="font-size:30px">${brl(p.valor_hoje)}</span>
        </div>
        <span class="selo ${p.liberada ? "verde" : ""}">${p.liberada ? "Liberada" : "Bloqueada"}</span>
      </div>
      ${textoBloqueio}
      <div class="divisor"></div>
      <div class="linha">
        <div style="display:flex;flex-direction:column">
          <span class="rotulo" style="font-size:14px">Mantendo o ritmo até o fim do mês</span>
          <span class="nota" style="font-size:13px">${p.ritmo.faixa ? `faixa ${p.ritmo.faixa}%` : "abaixo de 70%"} · se as condições forem cumpridas</span>
        </div>
        <span class="valor-m verde">${brl(p.ritmo.valor)}</span>
      </div>
    </section>
    <section class="cartao" style="gap:8px">
      <h2>Para liberar a premiação</h2>
      ${cond(p.condicoes.faixa_70, "Passar de 70% da meta", pct(d.pct_meta))}
      ${cond(p.condicoes.lucratividade, `Lucratividade acima de ${num(i.lucratividade_minima, 0)}%`, `${num(i.lucratividade)}%`)}
      ${cond(p.condicoes.identificacao, "Identificação acima de 50%", pct(i.identificacao))}
    </section>
    <section class="cartao" style="gap:8px">
      <h2>Quanto do lucro vira prêmio</h2>
      <div class="tabela-faixas">${tabela}</div>
      <span class="nota" style="font-size:13px">Faixa de meta atingida · % sobre o lucro sem vitaminas (${brl(p.lucro_fora_vitaminas)} até agora)</span>
    </section>
    <section class="cartao" style="gap:8px">
      <div class="linha"><h2>Bônus por indicadores</h2><span class="valor-p">${brl(bonus.valor)}</span></div>
      <span class="nota" style="font-size:13px">${bonus.pct_total >= 0 ? "+" : ""}${pct(bonus.pct_total)} sobre a base de ${brl(p.base)} · identificação, prateleiras e vencimento +6% cada · pós-venda e Farmácia Popular +12% cada · lucratividade +58% · notas pendentes −5%</span>
    </section>`);
}

// ---------------------------------------------------------------------------
// Tela: Ranking (só posição dos colegas; o próprio % só para o vendedor)
// ---------------------------------------------------------------------------
// Foto do vendedor (coluna FOTO da METAS.xlsx); se não houver ou não carregar, mostra as iniciais
function avatar(r, pequeno = false) {
  const classe = pequeno ? "avatar mini" : "avatar";
  const ini = esc(iniciais(r.nome));
  const foto = typeof r.foto === "string" && /^https:\/\//i.test(r.foto) ? r.foto : "";
  if (!foto) return `<div class="${classe}">${ini}</div>`;
  return `<div class="${classe}" data-ini="${ini}"><img src="${esc(foto)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=this.parentNode.dataset.ini"></div>`;
}

function telaRanking() {
  const rk = estado.ranking || [];
  const eu = estado.perfil?.codigo;
  const d = estado.dados;
  if (!rk.length) return moldura("ranking", "Ranking do mês", "", `<section class="cartao"><p style="margin:0;font-weight:600">O ranking aparece assim que houver vendas no mês.</p></section>`);
  const porPos = (n) => rk.find((r) => r.posicao === n);
  const degrau = (r, classe, altura, tam) => !r ? "<div></div>" : `
    <div class="${classe}">
      ${r.supermeta ? `<span class="selo-super">SUPERMETA</span>` : ""}
      ${avatar(r)}
      <span class="nome">${r.codigo === eu ? "Você" : esc(r.nome)}</span>
      <div class="degrau" style="height:${altura}px;font-size:${tam}px;${classe === "primeiro" ? "background:var(--azul);color:#fff" : ""}">${r.posicao}º</div>
    </div>`;
  const resto = rk.filter((r) => r.posicao > 3);
  const minhaPos = d?.ranking?.posicao;
  const dica = minhaPos && minhaPos > 3
    ? `<section class="cartao" style="flex-direction:row;align-items:center;gap:12px">${I.subir}<span style="font-size:14px;font-weight:600;line-height:18px">Você está a <strong>${minhaPos - 3} ${minhaPos - 3 === 1 ? "posição" : "posições"}</strong> do pódio. Cada venda conta!</span></section>`
    : minhaPos ? `<section class="cartao" style="flex-direction:row;align-items:center;gap:12px">${I.subir}<span style="font-size:14px;font-weight:600">Você está no pódio! Continue assim.</span></section>` : "";
  return moldura("ranking", "Ranking do mês", "", `
    <section class="cartao podio" style="padding-bottom:0">
      ${degrau(porPos(2), "segundo", 56, 24)}
      ${degrau(porPos(1), "primeiro", 80, 28)}
      ${degrau(porPos(3), "terceiro", 40, 22)}
    </section>
    ${resto.length ? `<section class="cartao lista-rank">
      ${resto.map((r) => r.codigo === eu
        ? `<div class="item eu"><span class="pos">${r.posicao}º</span>${avatar(r, true)}<span class="quem">Você</span><span>seu resultado: ${pct(d?.pct_meta)}</span></div>`
        : `<div class="item"><span class="pos">${r.posicao}º</span>${avatar(r, true)}<span class="quem">${esc(r.nome)}</span>${r.supermeta ? `<span class="selo-super">SUPERMETA</span>` : ""}</div>`).join("")}
    </section>` : ""}
    ${dica}`);
}

// ---------------------------------------------------------------------------
// Mix de vendas (na tela Indicadores)
// ---------------------------------------------------------------------------
function blocoMix(d) {
  const m = d?.mix;
  if (!m) return "";
  const prod = (t, extra) => (t ? `<strong>${esc(t.nome)}</strong> <span class="nota">· ${extra}</span>` : "–");
  return `
    <section class="cartao" style="gap:10px">
      <h2>Mix de vendas no mês</h2>
      <div class="grade-2" style="gap:8px">
        <div class="mini-cartao"><span class="rotulo">Vendido em promoção</span><span class="valor-p">${brl(m.valor_promocao)}</span><span class="nota">${pct(m.pct_promocao, 1)} das suas vendas</span></div>
        <div class="mini-cartao"><span class="rotulo">Vendas +4 itens e item R$ 0,01</span><span class="valor-p">${m.vendas_4sku_001 ?? 0}</span></div>
      </div>
      <div class="linha-texto"><span class="rotulo">Seu mais vendido</span>${prod(m.top_vendido, `${num(m.top_vendido?.qtd, 0)} un.`)}</div>
      <div class="linha-texto"><span class="rotulo">Seu mais lucrativo</span>${prod(m.top_lucrativo, "maior lucro no mês")}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Vender (vencendo, promoções, leve junto, oportunidades, sazonais)
// ---------------------------------------------------------------------------
const dataCurta = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "");
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function telaVender() {
  const lj = estado.loja;
  const d = estado.dados;
  if (!lj) return moldura("vender", "Vender", "", `<section class="cartao"><p style="margin:0;font-weight:600">As listas de produtos aparecem assim que a próxima sincronização terminar.</p></section>`);
  const v = d?.vencendo;
  const meu = v ? `
    <section class="cartao" style="gap:6px">
      <div class="linha-base"><span class="rotulo">Você vendeu de produtos vencendo</span>${v.posicao ? `<span class="selo">${v.posicao}º de ${v.total}</span>` : ""}</div>
      <span class="valor-m">${brl(v.faturamento)}</span>
      <span class="nota" style="font-size:13px">${num(v.itens, 0)} unidades no mês · loja: ${brl(lj.vencendo_loja?.faturamento)}</span>
    </section>` : "";
  const lista = lj.vencendo || [];
  const mostrar = estado.verTodosVencendo ? lista : lista.slice(0, 12);
  const urg = (dias) => (dias == null ? "" : dias <= 15 ? "urgente" : dias <= 45 ? "atencao" : "");
  const vencendo = lista.length ? `
    <section class="cartao lista-prod">
      <h2>Vencendo · ofereça primeiro <span class="rotulo">(${lista.length})</span></h2>
      ${mostrar.map((p) => `
        <div class="prod">
          <div class="prod-nome">${esc(p.nome)}<span class="nota">${num(p.qtd, 0)} un.${p.preco ? ` · ${brl(p.preco, 2)}` : ""}</span></div>
          <span class="vence ${urg(p.dias)}">${I.relogioP}${dataCurta(p.vencimento)}${p.dias != null ? `<small>${p.dias} d</small>` : ""}</span>
        </div>`).join("")}
      ${lista.length > 12 ? `<button class="link" type="button" data-acao="todos-vencendo">${estado.verTodosVencendo ? "Mostrar menos" : `Ver todos os ${lista.length}`}</button>` : ""}
    </section>` : "";
  const simples = (titulo, itens, dir) => (itens?.length ? `
    <section class="cartao lista-prod">
      <h2>${titulo}</h2>
      ${itens.map((p, i) => `<div class="prod"><div class="prod-nome"><span class="num">${i + 1}</span>${esc(p.nome)}</div>${dir ? `<span class="nota">${dir(p)}</span>` : ""}</div>`).join("")}
    </section>` : "");
  const saz = (lj.sazonais || []).filter((s) => s.itens?.length);
  return moldura("vender", "Vender", "O que oferecer hoje", `
    ${meu}
    ${vencendo}
    ${simples(`Em promoção hoje <span class="rotulo">(${(lj.promocoes || []).length})</span>`, lj.promocoes, (p) => (p.termino ? `até ${dataCurta(p.termino)}` : ""))}
    ${simples("Leve junto · mais vendidos com as promoções", lj.arrasto, (p) => `${p.vendas} vendas`)}
    ${simples("Alta margem, pouca venda · indique", lj.oportunidades)}
    ${saz.map((s) => simples(`Mais vendidos em ${MESES_ABREV[s.mes - 1]}/${s.ano}${s.chave === "proximo_mes" ? " · prepare-se" : ""}`, s.itens)).join("")}`);
}

// ---------------------------------------------------------------------------
// Tela: Equipe (diretoria/gerência)
// ---------------------------------------------------------------------------
function telaEquipe() {
  const eq = estado.equipe.filter((m) => m.dados && !m.dados.sem_meta);
  if (!eq.length) return moldura("equipe", "Equipe", "", `<section class="cartao"><p style="margin:0;font-weight:600">Ainda não há vendedores com meta e vendas neste mês.</p></section>`);
  const tot = eq.reduce((a, m) => ({ fat: a.fat + m.dados.faturamento, meta: a.meta + m.dados.meta }), { fat: 0, meta: 0 });
  const proj = eq.reduce((a, m) => a + (m.dados.projecao || 0), 0);
  const bateu70 = eq.filter((m) => m.dados.premiacao?.condicoes?.faixa_70).length;
  const liberadas = eq.filter((m) => m.dados.premiacao?.liberada);
  const totPremio = liberadas.reduce((a, m) => a + (m.dados.premiacao.valor_hoje || 0), 0);
  const ordem = [...eq].sort((a, b) => (b.dados.pct_meta || 0) - (a.dados.pct_meta || 0));
  const linha = (m) => {
    const d = m.dados, p = d.premiacao || {};
    const cor = d.pct_meta >= 1 ? "var(--verde)" : d.pct_meta > 0.7 ? "var(--azul)" : "var(--ouro)";
    const motivo = !p.condicoes?.faixa_70 ? "abaixo de 70%" : !p.condicoes?.lucratividade ? "lucratividade" : !p.condicoes?.identificacao ? "identificação" : "";
    return `
      <a class="cartao membro" href="#/v/${m.codigo}/mes">
        <div class="linha" style="gap:12px">
          ${avatar(m, true)}
          <div style="flex:1;min-width:0">
            <div class="linha-base"><strong class="nome-membro">${esc(m.nome)}</strong><span class="valor-p" style="color:${cor}">${pct(d.pct_meta)}</span></div>
            <span class="nota" style="font-size:13px">${brl(d.faturamento)} de ${brl(d.meta)} · ritmo ${pct(d.pct_projecao)}</span>
          </div>
        </div>
        <div class="barra fina"><div class="barra-cheia" style="width:${Math.min((d.pct_meta || 0) / 1.1, 1) * 100}%;background:${cor}"></div></div>
        <div class="linha" style="font-size:13px;font-weight:600;color:var(--cinza)">
          <span>Lucrat. ${num(d.indicadores?.lucratividade)}% · Hoje ${brl(d.hoje?.faturamento)}</span>
          <span>${p.liberada ? `<span class="verde">Prêmio ${brl(p.valor_hoje)}</span>` : `Bloqueado${motivo ? `: ${motivo}` : ""}`}</span>
        </div>
      </a>`;
  };
  return moldura("equipe", "Equipe", `Olá, ${esc(String(estado.perfil?.nome || "").split(" ")[0])}`, `
    <section class="cartao">
      <div class="linha-base"><span class="rotulo">Vendido pela equipe</span><span class="rotulo">Meta ${brl(tot.meta)}</span></div>
      <div style="display:flex;align-items:baseline;gap:8px"><span class="valor-g">${brl(tot.fat)}</span><span class="valor-p azul" style="font-size:16px">${pct(tot.meta ? tot.fat / tot.meta : 0)}</span></div>
      <div class="barra"><div class="barra-cheia" style="width:${Math.min(tot.meta ? tot.fat / tot.meta / 1.1 : 0, 1) * 100}%"></div><div class="barra-marca" style="left:calc(${100 / 1.1}% - 1px)"></div></div>
      <span class="nota" style="font-size:13px">Projeção do mês: ${brl(proj)} (${pct(tot.meta ? proj / tot.meta : 0)} da meta)</span>
    </section>
    <div class="grade-2">
      <section class="cartao"><span class="rotulo">Passaram de 70%</span><span class="valor-m">${bateu70} de ${eq.length}</span></section>
      <section class="cartao"><span class="rotulo">Prêmios liberados</span><span class="valor-m verde">${liberadas.length}</span><span class="nota">${brl(totPremio)} hoje</span></section>
    </div>
    <h2 style="margin:4px 0 0;font-size:15px;font-weight:700">Vendedores · toque para ver o detalhe</h2>
    ${ordem.map(linha).join("")}`);
}

function equipeExemplo() {
  const base = EXEMPLO.dados;
  const nomes = [["Vendedor A", 1.13, true], ["Vendedor B", 0.98, true], ["Vendedor C", 0.91, true], ["Vendedor Exemplo", 0.79, false], ["Vendedor D", 0.74, false], ["Vendedor E", 0.66, false]];
  return nomes.map(([nome, p, lib], i) => ({
    codigo: i + 1, nome, foto: null,
    dados: {
      ...base, faturamento: Math.round(base.meta * p), pct_meta: p, pct_projecao: p * 1.2, projecao: Math.round(base.meta * p * 1.2),
      hoje: { faturamento: 600 + i * 150, atendimentos: 10 + i },
      premiacao: { ...base.premiacao, liberada: lib, valor_hoje: lib ? 900 - i * 120 : 0, condicoes: { faixa_70: p > 0.7, lucratividade: true, identificacao: lib } },
    },
  }));
}

// ---------------------------------------------------------------------------
// Telas de entrada
// ---------------------------------------------------------------------------
function telaLogin(erro = "") {
  return `
    <div class="entrada">
      <div class="logo">
        <img class="logo-img" src="icones/logo-completa.png" alt="Drogaria Popular Farmanutri" width="220" height="224">
        <p>Minhas Metas</p>
      </div>
      <form class="cartao" id="form-login" novalidate>
        ${erro ? `<div class="erro" role="alert">${esc(erro)}</div>` : ""}
        <div class="campo"><label for="codigo">Código do Automatiza</label>
          <input id="codigo" name="codigo" inputmode="numeric" autocomplete="username" required placeholder="Ex.: 97"></div>
        <div class="campo"><label for="senha">Senha do app</label>
          <input id="senha" name="senha" type="password" autocomplete="current-password" required placeholder="A senha que você criou no app"></div>
        <button class="botao" type="submit">Entrar</button>
        <a class="link" href="#/primeiro-acesso">Primeiro acesso? Crie sua senha</a>
      </form>
      <p class="rodape-entrada">Esqueceu a senha? Fale com o seu supervisor.</p>
    </div>`;
}

function telaPrimeiroAcesso(erro = "") {
  return `
    <div class="entrada simples">
      <a class="voltar" href="#/login">${I.voltar}Voltar</a>
      <div style="display:flex;flex-direction:column;gap:4px">
        <h1 style="margin:0;font-size:28px;line-height:32px;font-weight:800">Primeiro acesso</h1>
        <p style="margin:0;font-size:15px;line-height:20px;font-weight:500;color:var(--cinza)">Confirme quem você é e crie a senha do app. Ela é só do app, não muda nada no Automatiza.</p>
      </div>
      <form class="cartao" id="form-primeiro" novalidate>
        ${erro ? `<div class="erro" role="alert">${esc(erro)}</div>` : ""}
        <div class="campo"><label for="pa-codigo">Código do Automatiza</label>
          <input id="pa-codigo" name="codigo" inputmode="numeric" autocomplete="username" required placeholder="Ex.: 97"></div>
        <div class="campo"><label for="pa-cpf">CPF</label>
          <input id="pa-cpf" name="cpf" inputmode="numeric" required placeholder="000.000.000-00">
          <span class="nota" style="font-size:13px">Precisa ser o mesmo do seu cadastro no Automatiza.</span></div>
        <div class="divisor"></div>
        <div class="campo"><label for="pa-senha">Crie sua senha</label>
          <input id="pa-senha" name="senha" type="password" autocomplete="new-password" required minlength="6" placeholder="Mínimo de 6 caracteres"></div>
        <div class="campo"><label for="pa-senha2">Repita a senha</label>
          <input id="pa-senha2" name="senha2" type="password" autocomplete="new-password" required></div>
        <button class="botao" type="submit">Criar senha e entrar</button>
      </form>
      <div style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:18px;color:var(--cinza);font-weight:600">
        ${I.cadeado}<span>O acesso vale enquanto o seu cadastro estiver ativo no Automatiza.</span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------
const TELAS = { mes: telaMes, indicadores: telaIndicadores, vender: telaVender, premio: telaPremio, ranking: telaRanking, equipe: telaEquipe };

function rotaAtual() {
  return (location.hash.replace(/^#\/?/, "") || "").split("?")[0];
}

function render() {
  const rota = rotaAtual();
  if (!estado.logado) {
    app.innerHTML = rota === "primeiro-acesso" ? telaPrimeiroAcesso() : telaLogin(estado.erro || "");
    estado.erro = null;
    return;
  }
  // gestor vendo um vendedor: #/v/<codigo>/<mes|indicadores|premio>
  const m = rota.match(/^v\/(\d+)\/(mes|indicadores|premio)$/);
  VER = m && estado.perfil?.gestor && membro(Number(m[1])) ? Number(m[1]) : null;
  const nome = m && VER != null ? m[2] : rota;
  const padrao = estado.perfil?.gestor ? TELAS.equipe : TELAS.mes;
  const tela = (nome === "equipe" && !estado.perfil?.gestor) ? TELAS.mes : TELAS[nome] || padrao;
  app.innerHTML = tela();
  window.scrollTo(0, 0);
}

async function entrar(codigo, senha) {
  if (DEMO) { estado.logado = true; await carregarDados(); location.hash = estado.perfil?.gestor ? "#/equipe" : "#/mes"; render(); return null; }
  const { error } = await sb.auth.signInWithPassword({ email: emailDo(codigo), password: senha });
  if (error) return traduzErroLogin(error.message);
  estado.logado = true;
  await carregarDados();
  location.hash = estado.perfil?.gestor ? "#/equipe" : "#/mes";
  render();
  return null;
}

async function criarAcesso(codigo, cpf, senha) {
  if (DEMO) return entrar(codigo, senha);
  const { data, error } = await sb.auth.signUp({
    email: emailDo(codigo),
    password: senha,
    options: { data: { codigo: Number(codigo), cpf: cpf.replace(/\D/g, "") } },
  });
  if (error) return traduzErroCadastro(error.message);
  if (!data.session) {
    // Supabase exigindo confirmação por e-mail: configuração a corrigir no painel
    return "Acesso criado, mas o servidor pediu confirmação por e-mail. Avise o administrador para desligar “Confirm email” no Supabase.";
  }
  estado.logado = true;
  await carregarDados();
  location.hash = estado.perfil?.gestor ? "#/equipe" : "#/mes";
  render();
  return null;
}

app.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const botao = form.querySelector("button[type=submit]");
  const f = Object.fromEntries(new FormData(form));
  let erro = null;
  if (!/^\d+$/.test(String(f.codigo || "").trim())) erro = "Digite o seu código do Automatiza (só números).";
  else if (form.id === "form-primeiro") {
    if (String(f.cpf || "").replace(/\D/g, "").length !== 11) erro = "Digite o CPF completo (11 números).";
    else if (String(f.senha || "").length < 6) erro = "A senha precisa ter pelo menos 6 caracteres.";
    else if (f.senha !== f.senha2) erro = "As duas senhas não são iguais.";
  } else if (!f.senha) erro = "Digite a sua senha.";

  if (!erro) {
    botao.disabled = true;
    botao.textContent = "Aguarde…";
    try {
      erro = form.id === "form-primeiro"
        ? await criarAcesso(f.codigo.trim(), f.cpf, f.senha)
        : await entrar(f.codigo.trim(), f.senha);
    } catch (ex) {
      console.error(ex);
      estado.logado = false;
      erro = "Algo deu errado. Verifique a internet e tente de novo.";
    }
  }
  if (erro) {
    app.innerHTML = form.id === "form-primeiro" ? telaPrimeiroAcesso(erro) : telaLogin(erro);
    const campo = app.querySelector(form.id === "form-primeiro" ? "#pa-codigo" : "#codigo");
    if (campo) campo.value = f.codigo || "";
  }
});

app.addEventListener("click", async (e) => {
  if (e.target.closest("[data-acao=todos-vencendo]")) {
    estado.verTodosVencendo = !estado.verTodosVencendo;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    return;
  }
  if (e.target.closest("[data-acao=sair]")) {
    if (!DEMO && sb) await sb.auth.signOut();
    Object.assign(estado, { logado: false, perfil: null, dados: null, ranking: [] });
    location.hash = "#/login";
    render();
  }
});

window.addEventListener("hashchange", render);

// Atualiza os números ao voltar para o app e a cada 5 minutos
async function atualizar() {
  if (!estado.logado) return;
  try { await carregarDados(); render(); } catch (ex) { console.warn("Falha ao atualizar", ex); }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") atualizar(); });
setInterval(atualizar, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
(async function iniciar() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  try {
    if (!DEMO) {
      await iniciarSupabase();
      const { data } = await sb.auth.getSession();
      if (data.session) {
        estado.logado = true;
        await carregarDados();
      }
    }
  } catch (ex) {
    console.error(ex);
    estado.logado = false;
    estado.erro = "Não foi possível conectar. Verifique a internet e tente de novo.";
  }
  render();
})();
