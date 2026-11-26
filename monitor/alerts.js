// Regras de alerta (puras, testáveis). Itens: [{id, name, waitSec, sector}]
(function () {
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // cfg: {maxQueue: 3 -> alerta quando MAIS de 3, maxWaitMin: 10 -> alerta quando MAIS de 10 min}
  function evaluate(items, cfg) {
    const n = items.length;
    const maxWait = items.reduce((m, i) => Math.max(m, i.waitSec || 0), 0);
    const over = items.filter((i) => (i.waitSec || 0) > cfg.maxWaitMin * 60);
    const reasons = [];
    if (n > cfg.maxQueue) reasons.push({ type: 'count', text: `${n} clientes sem atendimento` });
    if (over.length) {
      reasons.push({
        type: 'wait',
        text: `${over.length} cliente${over.length > 1 ? 's' : ''} esperando mais de ${cfg.maxWaitMin} min (maior: ${fmt(maxWait)})`,
      });
    }
    const level = reasons.length ? 'critical' : n > 0 ? 'attention' : 'ok';
    // assinatura: muda quando surge um novo motivo/cliente, para furar o "silenciar"
    const signature = reasons.map((r) => r.type).join('+') + '|' + over.map((i) => i.id).sort().join(',');
    return { level, reasons, count: n, maxWait, over, signature };
  }

  const api = { evaluate, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.Alerts = api;
})();
