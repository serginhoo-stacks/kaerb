
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  const client = window.kaerbSupabase;
  const params = new URLSearchParams(window.location.search);
  const requestedNext = params.get("next");
  const next =
    requestedNext &&
    /^[a-zA-Z0-9_-]+\.html$/.test(requestedNext)
      ? requestedNext
      : "dashboard.html";

  const show = (message) => {
    feedback.textContent = message;
    feedback.hidden = false;
  };

  const button = form.querySelector('button[type="submit"]');

  if (!client) {
    show("Não foi possível inicializar o Supabase. Atualize a página e tente novamente.");
    return;
  }

  // Não bloqueia a tela esperando indefinidamente pela sessão anterior.
  let checkingSession = true;

  button.disabled = true;
  button.textContent = "Verificando sessão...";

  const sessionCheck = client.auth.getSession();

  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("TIMEOUT_SESSION"));
    }, 10000);
  });

  Promise.race([sessionCheck, timeout])
    .then(({ data, error }) => {
      if (error) throw error;

      if (data?.session) {
        window.location.replace(next);
        return;
      }

      checkingSession = false;
      button.disabled = false;
      button.textContent = "Entrar no sistema";
    })
    .catch((error) => {
      console.error("Erro ao validar sessão:", error);

      checkingSession = false;
      button.disabled = false;
      button.textContent = "Entrar no sistema";

      show(
        error.message === "TIMEOUT_SESSION"
          ? "A conexão com o Supabase está demorando. Verifique sua internet e tente entrar novamente."
          : "Não foi possível verificar sua sessão. Tente entrar novamente."
      );
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (checkingSession) {
      show("Aguarde a verificação inicial ou recarregue a página.");
      return;
    }

    feedback.hidden = true;
    button.disabled = true;
    button.textContent = "Validando acesso...";

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value
      });

      if (error) throw error;

      if (!data?.session) {
        show("O login não retornou uma sessão válida. Tente novamente.");
        button.disabled = false;
        button.textContent = "Entrar no sistema";
        return;
      }

      window.location.replace(next);
    } catch (error) {
      console.error("Erro no login:", error);

      show(
        error.message?.includes("Invalid login credentials")
          ? "E-mail ou senha inválidos."
          : "Não foi possível entrar. Verifique a conexão e tente novamente."
      );

      button.disabled = false;
      button.textContent = "Entrar no sistema";
    }
  });
});
