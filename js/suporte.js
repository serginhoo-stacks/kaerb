"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("support-root");
  const client = window.kaerbSupabase;
  let currentUser = null;
  let isAdmin = false;
  let tickets = [];

  if (!root) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const date = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
  const statusLabel = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" };
  const priorityLabel = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

  const notice = (message, type = "info") => {
    root.querySelectorAll("[data-support-notice]").forEach(node => node.remove());
    const node = document.createElement("div");
    node.dataset.supportNotice = "";
    node.className = `notice notice-${type}`;
    node.textContent = message;
    root.prepend(node);
  };

  const empty = message => `<div class="empty-state support-empty"><span class="empty-icon">?</span><h4>${esc(message)}</h4><p>As solicitações abertas aparecerão aqui.</p></div>`;

  function render() {
    root.innerHTML = `
      <div class="support-layout">
        <section class="panel support-form-panel">
          <div class="panel-heading"><div><h3>Nova solicitação</h3><p>Explique sua dúvida para a equipe de suporte.</p></div></div>
          <form id="support-form" class="support-form">
            <label>Assunto *<input class="field" name="assunto" required maxlength="120" placeholder="Ex.: Não consigo cadastrar um jogador"></label>
            <div class="form-grid">
              <label>Categoria *<select class="field" name="categoria" required><option value="Dúvida">Dúvida</option><option value="Problema">Problema</option><option value="Sugestão">Sugestão</option><option value="Acesso">Acesso</option></select></label>
              <label>Prioridade<select class="field" name="prioridade"><option value="baixa">Baixa</option><option value="normal" selected>Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
            </div>
            <label>Mensagem *<textarea class="field" name="mensagem" required rows="7" maxlength="4000" placeholder="Descreva o que aconteceu ou qual é a sua dúvida."></textarea></label>
            <button class="btn btn-primary" type="submit">Enviar solicitação</button>
          </form>
        </section>
        <section class="panel support-list-panel">
          <div class="panel-heading"><div><h3>${isAdmin ? "Chamados recebidos" : "Minhas solicitações"}</h3><p>${isAdmin ? "Responda e atualize o status dos atendimentos." : "Acompanhe suas dúvidas e respostas."}</p></div><span class="badge">${tickets.length} chamado(s)</span></div>
          <div class="support-tickets">${tickets.length ? tickets.map(ticketCard).join("") : empty(isAdmin ? "Nenhum chamado recebido" : "Você ainda não abriu uma solicitação")}</div>
        </section>
      </div>
    `;

    root.querySelector("#support-form").addEventListener("submit", createTicket);
    root.querySelectorAll("[data-support-resolve]").forEach(button => button.addEventListener("click", () => resolveTicket(button.dataset.supportResolve)));
  }

  function ticketCard(ticket) {
    const response = ticket.resposta ? `<div class="support-response"><strong>Resposta do suporte</strong><p>${esc(ticket.resposta)}</p><small>${date(ticket.atualizado_em)}</small></div>` : "";
    const adminActions = isAdmin ? `
      <div class="support-admin-actions">
        <textarea class="field" data-response-for="${esc(ticket.id)}" rows="3" placeholder="Escreva uma resposta..."></textarea>
        <div class="form-actions"><select class="field" data-status-for="${esc(ticket.id)}"><option value="aberto" ${ticket.status === "aberto" ? "selected" : ""}>Aberto</option><option value="em_andamento" ${ticket.status === "em_andamento" ? "selected" : ""}>Em andamento</option><option value="resolvido" ${ticket.status === "resolvido" ? "selected" : ""}>Resolvido</option></select><button class="btn btn-primary btn-small" type="button" data-support-resolve="${esc(ticket.id)}">Salvar atendimento</button></div>
      </div>` : "";
    return `<article class="support-ticket"><div class="support-ticket-head"><div><span class="support-category">${esc(ticket.categoria)} · ${esc(priorityLabel[ticket.prioridade] || ticket.prioridade)}</span><h4>${esc(ticket.assunto)}</h4></div><span class="status-pill ${ticket.status === "resolvido" ? "is-active" : ""}">${esc(statusLabel[ticket.status] || ticket.status)}</span></div><p class="support-message">${esc(ticket.mensagem)}</p><small class="support-date">Aberto em ${date(ticket.criado_em)}</small>${response}${adminActions}</article>`;
  }

  async function load() {
    if (!client) {
      root.innerHTML = `<div class="notice notice-error">Supabase não inicializado. Verifique a configuração.</div>`;
      return;
    }
    const { data: sessionData } = await client.auth.getSession();
    currentUser = sessionData?.session?.user || null;
    isAdmin = ["admin", "owner", "administrador"].includes(currentUser?.app_metadata?.role);
    const { data, error } = await client.from("suporte_chamados").select("*").order("criado_em", { ascending: false });
    if (error) {
      root.innerHTML = `<div class="notice notice-error">Não foi possível carregar os chamados. Execute o SQL do suporte no Supabase e tente novamente.<br><small>${esc(error.message)}</small></div>`;
      return;
    }
    tickets = data || [];
    render();
  }

  async function createTicket(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());
    const { error } = await client.from("suporte_chamados").insert({ ...values, usuario_id: currentUser.id });
    if (error) notice(`Não foi possível abrir o chamado: ${error.message}`, "error");
    else { await load(); notice("Solicitação enviada com sucesso.", "success"); }
    button.disabled = false;
  }

  async function resolveTicket(id) {
    const response = root.querySelector(`[data-response-for="${CSS.escape(id)}"]`)?.value.trim() || null;
    const status = root.querySelector(`[data-status-for="${CSS.escape(id)}"]`)?.value || "em_andamento";
    const payload = { status, resposta: response, respondido_por: currentUser.id, atualizado_em: new Date().toISOString() };
    const { error } = await client.from("suporte_chamados").update(payload).eq("id", id);
    if (error) notice(`Não foi possível atualizar o chamado: ${error.message}`, "error");
    else { await load(); notice("Atendimento atualizado.", "success"); }
  }

  document.addEventListener("kaerb:ready", load, { once: true });
});
