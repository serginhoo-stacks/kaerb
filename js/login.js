"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  const client = window.kaerbSupabase;
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") && params.get("next").endsWith(".html") ? params.get("next") : "dashboard.html";

  const show = (message) => { feedback.textContent = message; feedback.hidden = false; };
  if (!client) { show("Não foi possível inicializar a conexão com o Supabase."); return; }

  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session) { window.location.replace(next); return; }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "A validar acesso...";
    const { error } = await client.auth.signInWithPassword({
      email: document.getElementById("login-email").value.trim(),
      password: document.getElementById("login-password").value
    });
    if (error) {
      show(error.message.includes("Invalid login credentials") ? "E-mail ou senha inválidos." : `Não foi possível entrar: ${error.message}`);
      button.disabled = false;
      button.textContent = "Entrar no sistema";
      return;
    }
    window.location.replace(next);
  });
});
