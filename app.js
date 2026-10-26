/* KAERB ESPORTS ERP — shell, sessão e navegação */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page || "dashboard";
  const meta = { dashboard: ["Visão geral", "Dashboard", "Acompanhe a operação da Kaerb Esports em um só lugar."], equipes: ["Equipes e jogadores", "Equipes e jogadores", "Organize elencos, jogadores e linhas competitivas."], financeiro: ["Financeiro", "Financeiro", "Estruture receitas, despesas, pagamentos e premiações."], contratos: ["Contratos e documentos", "Contratos e documentos", "Centralize documentos, vigências e responsabilidades."], campeonatos: ["Campeonatos", "Campeonatos", "Acompanhe inscrições, resultados e calendário competitivo."], patrocinadores: ["Patrocinadores", "Patrocinadores", "Organize parceiros, propostas e oportunidades comerciais."], departamentos: ["Departamentos", "Departamentos", "Visualize a estrutura administrativa da organização."], historico: ["Histórico de ações", "Histórico de ações", "Prepare a auditoria das atividades administrativas."] }[page];
  if (page === "login") return;
  if (meta) { document.title = `Kaerb Esports | ${meta[1]}`; document.querySelectorAll("[data-page-title]").forEach((node) => { node.textContent = meta[0]; }); document.querySelectorAll("[data-page-description]").forEach((node) => { node.textContent = meta[2]; }); document.querySelectorAll("[data-breadcrumb]").forEach((node) => { node.textContent = meta[1]; }); }
  document.querySelectorAll("[data-current-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
  document.querySelectorAll("[data-current-date]").forEach((node) => { node.textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date()); });
  document.querySelectorAll("[data-active-page]").forEach((link) => { const active = link.dataset.activePage === page; link.classList.toggle("active", active); if (active) link.setAttribute("aria-current", "page"); });
  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", async () => { await window.kaerbSupabase?.auth.signOut(); window.location.replace("login.html"); }));

  const ready = (async () => {
    if (!window.kaerbSupabase) { window.location.replace(`login.html?next=${encodeURIComponent(window.location.pathname.split("/").pop() || "dashboard.html")}`); return false; }
    const { data, error } = await window.kaerbSupabase.auth.getSession();
    if (error || !data.session) { window.location.replace(`login.html?next=${encodeURIComponent(window.location.pathname.split("/").pop() || "dashboard.html")}`); return false; }
    const user = data.session.user;
    const userName = document.querySelector(".user-info strong"); const userRole = document.querySelector(".user-info span"); const avatar = document.querySelector(".user-avatar");
    if (userName) userName.textContent = user.user_metadata?.nome || user.email?.split("@")[0] || "Administrador";
    if (userRole) userRole.textContent = "Proprietário autenticado";
    if (avatar) avatar.textContent = (user.user_metadata?.nome || user.email || "K").charAt(0).toUpperCase();
    document.dispatchEvent(new CustomEvent("kaerb:ready", { detail: { user } }));
    return true;
  })();
  window.kaerbReady = ready;
  window.kaerbSupabase?.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") window.location.replace("login.html"); });
  document.querySelectorAll("[data-demo-action]").forEach((button) => button.addEventListener("click", () => { const feedback = document.querySelector("[data-feedback]"); if (feedback) { feedback.textContent = "A ação está protegida e será concluída quando o módulo correspondente estiver configurado."; feedback.hidden = false; } }));
});
