"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  const client = window.kaerbSupabase;
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const forgotPassword = document.getElementById("forgot-password");
  const googleLogin = document.getElementById("google-login");
  const params = new URLSearchParams(window.location.search);
  const requestedNext = params.get("next");
  const next = requestedNext && /^[a-zA-Z0-9_-]+\.html$/.test(requestedNext) ? requestedNext : "dashboard.html";

  const show = (message) => {
    feedback.textContent = message;
    feedback.hidden = false;
  };

  const button = form.querySelector('button[type="submit"]');

  googleLogin.addEventListener("click", () => {
    show("O acesso com Google estará disponível em breve. Entre com seu e-mail e senha por enquanto.");
  });

  forgotPassword.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      emailInput.focus();
      show("Digite seu e-mail para receber o link de recuperação.");
      return;
    }

    if (!client) {
      show("Não foi possível inicializar o Supabase. Atualize a página e tente novamente.");
      return;
    }

    forgotPassword.disabled = true;
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login.html`
      });
      if (error) throw error;
      show("Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.");
    } catch (error) {
      console.error("Erro ao solicitar recuperação:", error);
      show("Não foi possível enviar o link agora. Verifique o e-mail e tente novamente.");
    } finally {
      forgotPassword.disabled = false;
    }
  });

  if (!client) {
    show("Não foi possível inicializar o Supabase. Atualize a página e tente novamente.");
    return;
  }

  let checkingSession = true;
  button.disabled = true;
  button.textContent = "Verificando sessão...";

  const sessionCheck = client.auth.getSession();
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT_SESSION")), 10000);
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
      button.textContent = "Entrar";
    })
    .catch((error) => {
      console.error("Erro ao validar sessão:", error);
      checkingSession = false;
      button.disabled = false;
      button.textContent = "Entrar";
      show(error.message === "TIMEOUT_SESSION" ? "A conexão com o Supabase está demorando. Verifique sua internet e tente entrar novamente." : "Não foi possível verificar sua sessão. Tente entrar novamente.");
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (checkingSession) {
      show("Aguarde a verificação inicial ou recarregue a página.");
      return;
    }

    feedback.hidden = true;
    button.disabled = true;
    passwordInput.blur();
    button.textContent = "Validando acesso...";

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      if (error) throw error;
      if (!data?.session) {
        show("O login não retornou uma sessão válida. Tente novamente.");
        button.disabled = false;
        button.textContent = "Entrar";
        return;
      }
      window.location.replace(next);
    } catch (error) {
      console.error("Erro no login:", error);
      show(error.message?.includes("Invalid login credentials") ? "E-mail ou senha inválidos." : "Não foi possível entrar. Verifique a conexão e tente novamente.");
      button.disabled = false;
      button.textContent = "Entrar";
    }
  });
});
