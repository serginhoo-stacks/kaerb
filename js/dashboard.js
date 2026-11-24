"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const db = window.kaerbSupabase;
  const root = document.getElementById("dashboard-root");
  let initialized = false;
  if (!root) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const date = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
  const day = value => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`)) : "—";
  const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const setText = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };

  function notice(message, type = "info") {
    const old = root.querySelector("[data-dashboard-notice]");
    if (old) old.remove();
    const node = document.createElement("div");
    node.dataset.dashboardNotice = "";
    node.className = `notice notice-${type}`;
    node.innerHTML = `<span class="notice-icon">i</span><div><strong>${esc(message)}</strong><p>Os indicadores são atualizados diretamente a partir do Supabase.</p></div>`;
    root.prepend(node);
  }

  async function query(table, columns, options = {}) {
    let request = db.from(table).select(columns);
    if (options.order) request = request.order(options.order.column, { ascending: options.order.ascending ?? false });
    if (options.limit) request = request.limit(options.limit);
    return request;
  }

  function renderActivities(logs) {
    const target = root.querySelector("[data-activity-list]");
    if (!target) return;
    target.innerHTML = logs.length ? logs.map(log => `
      <div class="activity-row">
        <span class="activity-icon">${log.acao === "criação" ? "+" : log.acao === "edição" ? "↗" : "•"}</span>
        <div><strong>${esc(log.descricao || `${log.acao || "Ação"} em ${log.entidade || "registro"}`)}</strong><span>${esc(log.acao || "Atividade")} · ${date(log.criado_em)}</span></div>
      </div>`).join("") : `<div class="table-empty dashboard-empty"><strong>Nenhuma atividade registrada</strong><span>As ações aparecerão aqui depois que o SQL de auditoria for executado.</span></div>`;
  }

  function renderEvents(events) {
    const target = root.querySelector("[data-event-list]");
    if (!target) return;
    target.innerHTML = events.length ? events.map(event => `
      <div class="event-row"><div class="event-date"><strong>${day(event.data_inicio)}</strong><span>${esc(event.horario || "")}</span></div><div><strong>${esc(event.nome)}</strong><span>${esc(event.jogo || "Evento competitivo")} · ${esc(event.status || "Agendado")}</span></div></div>`).join("") : `<div class="table-empty dashboard-empty"><strong>Nenhum evento próximo</strong><span>Cadastre eventos na tabela de competições para vê-los aqui.</span></div>`;
  }

  function renderReport(entries) {
    const target = root.querySelector("[data-finance-list]");
    if (!target) return;
    target.innerHTML = entries.length ? entries.slice(0, 5).map(entry => `
      <div class="report-row"><div><strong>${esc(entry.descricao)}</strong><span>${esc(entry.categoria || "Sem categoria")} · ${date(entry.data_lancamento || entry.criado_em)}</span></div><strong class="report-value ${entry.tipo === "despesa" ? "is-expense" : "is-income"}">${entry.tipo === "despesa" ? "−" : "+"} ${money(entry.valor)}</strong></div>`).join("") : `<div class="table-empty dashboard-empty"><strong>Nenhum lançamento encontrado</strong><span>Inclua receitas e despesas em <a href="./financeiro.html">Financeiro</a>.</span></div>`;
  }

  async function load() {
    if (!db) return;
    root.innerHTML = `<div class="loading-state"><span class="spinner"></span>Carregando indicadores e relatórios...</div>`;

    const [teamsResult, playersResult, financeResult, eventsResult, logsResult] = await Promise.all([
      query("equipes", "id, nome, status"),
      query("jogadores", "id, nome_completo, apelido, status"),
      query("erp_lancamentos", "id, descricao, categoria, tipo, valor, status, data_lancamento, criado_em", { order: { column: "data_lancamento" }, limit: 100 }),
      query("erp_eventos", "id, nome, jogo, status, data_inicio, horario", { order: { column: "data_inicio", ascending: true }, limit: 20 }),
      query("auditoria_acoes", "id, acao, entidade, descricao, usuario_id, criado_em", { order: { column: "criado_em" }, limit: 8 })
    ]);

    const teams = teamsResult.data || [];
    const players = playersResult.data || [];
    const finances = financeResult.error ? [] : financeResult.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const events = eventsResult.error ? [] : (eventsResult.data || []).filter(event => event.data_inicio >= today && event.status !== "cancelado").slice(0, 5);
    const logs = logsResult.error ? [] : logsResult.data || [];
    const activeTeams = teams.filter(team => ["ativa", "ativo", "active"].includes(String(team.status || "").toLowerCase())).length;
    const activePlayers = players.filter(player => !player.status || ["ativo", "ativa", "active"].includes(String(player.status).toLowerCase())).length;
    const validFinance = finances.filter(item => item.status !== "cancelado" && item.status !== "cancelada");
    const balance = validFinance.reduce((total, item) => total + (item.tipo === "despesa" ? -Number(item.valor || 0) : Number(item.valor || 0)), 0);

    root.innerHTML = `
      <section class="metric-grid dashboard-metrics" aria-label="Indicadores da operação">
        <article class="metric-card"><div class="metric-top"><span>Equipes ativas</span><span class="metric-icon tone-purple">♙</span></div><strong class="metric-value">${activeTeams}</strong><small class="metric-note">de ${teams.length} cadastradas</small></article>
        <article class="metric-card"><div class="metric-top"><span>Jogadores ativos</span><span class="metric-icon tone-blue">♟</span></div><strong class="metric-value">${activePlayers}</strong><small class="metric-note">de ${players.length} cadastrados</small></article>
        <article class="metric-card"><div class="metric-top"><span>Saldo atual</span><span class="metric-icon tone-green">R$</span></div><strong class="metric-value metric-money">${money(balance)}</strong><small class="metric-note">lançamentos não cancelados</small></article>
        <article class="metric-card"><div class="metric-top"><span>Próximos eventos</span><span class="metric-icon tone-orange">♜</span></div><strong class="metric-value">${events.length}</strong><small class="metric-note">no calendário competitivo</small></article>
      </section>
      <div class="content-grid dashboard-content-grid">
        <section class="panel"><div class="panel-heading"><div><h3>Atividade recente</h3><p>Registro das ações realizadas no ERP.</p></div><a class="button button-secondary" href="./historico.html">Ver histórico</a></div><div data-activity-list class="activity-list"></div></section>
        <section class="panel"><div class="panel-heading"><div><h3>Próximos eventos</h3><p>Competições agendadas.</p></div><a class="button button-secondary" href="./campeonatos.html">Calendário</a></div><div data-event-list class="event-list"></div></section>
      </div>
      <section class="panel dashboard-report-panel"><div class="panel-heading"><div><h3>Relatório financeiro recente</h3><p>Últimos lançamentos registrados.</p></div><a class="button button-secondary" href="./financeiro.html">Abrir financeiro</a></div><div data-finance-list class="report-list"></div></section>
    `;
    renderActivities(logs);
    renderEvents(events);
    renderReport(validFinance);

    const missing = [financeResult.error ? "lancamentos" : "", eventsResult.error ? "eventos" : "", logsResult.error ? "auditoria" : ""].filter(Boolean);
    if (teamsResult.error || playersResult.error) notice("Não foi possível carregar equipes ou jogadores. Verifique as políticas RLS e os nomes das tabelas.", "error");
    else if (missing.length) notice(`Para completar o dashboard, execute o SQL: faltam ${missing.join(", ")}.`, "info");
  }

  function init() {
    if (initialized) return;
    initialized = true;
    load().catch(error => {
      console.error("Kaerb ERP — erro ao carregar o dashboard:", error);
      root.innerHTML = `<div class="notice notice-error"><span class="notice-icon">!</span><div><strong>Não foi possível carregar o dashboard.</strong><p>${esc(error.message || "Verifique a conexão com o Supabase.")}</p></div></div>`;
    });
  }

  document.addEventListener("kaerb:ready", init, { once: true });
  if (window.kaerbReady && typeof window.kaerbReady.then === "function") {
    window.kaerbReady.then(isReady => { if (isReady) init(); });
  }
});
