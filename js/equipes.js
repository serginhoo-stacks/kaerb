
"use strict";

document.addEventListener("kaerb:ready", () => {
  const client = window.kaerbSupabase;
  const root = document.getElementById("crud-root");

  if (!client || !root) return;

  const state = {
    tab: "jogadores",
    lineTeamFilter: "",
    players: [],
    teams: [],
    games: [],
    memberships: [],
    editingPlayer: null,
    editingTeam: null,
    editingMembership: null
  };

  const esc = (value) =>
    String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[char]);

  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR").format(
          new Date(`${String(value).slice(0, 10)}T12:00:00`)
        )
      : "—";

  const today = () => {
    const date = new Date();
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().slice(0, 10);
  };

  const errorText = (error) =>
    error?.message || "Não foi possível concluir a operação.";

  const notify = (message, type = "info") => {
    const el = document.getElementById("crud-feedback");

    if (!el) return;

    el.className = `feedback ${type}`;
    el.textContent = message;
    el.hidden = false;
  };

  const gameName = (id) => {
    const game = state.games.find((item) => item.id === id);
    return game?.nome || game?.nome_jogo || id || "—";
  };

  const playerById = (id) =>
    state.players.find((player) => player.id === id);

  const playerName = (id) =>
    playerById(id)?.nome_completo || id || "—";

  const teamById = (id) =>
    state.teams.find((team) => team.id === id);

  const teamName = (id) =>
    teamById(id)?.nome || id || "—";

  const status = (value) => {
    const labels = {
      ativo: ["Ativo", "badge-success"],
      inativo: ["Inativo", "badge-danger"],
      afastado: ["Afastado", "badge-warning"],
      dispensado: ["Dispensado", "badge-danger"],
      ativa: ["Ativa", "badge-success"],
      inativa: ["Inativa", "badge-danger"],
      encerrada: ["Encerrada", "badge-warning"]
    };

    const [label, badge] = labels[value] || [value || "—", ""];

    return `<span class="badge ${badge}">${esc(label)}</span>`;
  };

  async function loadData() {
    root.innerHTML = `
      <div class="loading-state">
        <span class="spinner"></span>
        Carregando equipes e jogadores autorizados...
      </div>
    `;

    const [players, teams, games, memberships] = await Promise.all([
      client
        .from("jogadores")
        .select("*")
        .order("nome_completo", { ascending: true }),

      client
        .from("equipes")
        .select("*")
        .order("nome", { ascending: true }),

      client
        .from("jogos")
        .select("*")
        .order("nome", { ascending: true }),

      client
        .from("membros_equipe")
        .select("*")
        .order("data_inicio", { ascending: false })
    ]);

    const failed = [players, teams, games, memberships].find(
      (result) => result.error
    );

    if (failed) {
      root.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>
          <h4>Não foi possível carregar os dados</h4>
          <p>${esc(errorText(failed.error))}</p>
          <button
            class="button button-secondary"
            type="button"
            id="retry-crud"
          >
            Tentar novamente
          </button>
        </div>
      `;

      document
        .getElementById("retry-crud")
        .addEventListener("click", loadData);

      return;
    }

    state.players = players.data || [];
    state.teams = teams.data || [];
    state.games = games.data || [];
    state.memberships = memberships.data || [];

    render();
  }

  const gameOptions = (selected = "") => `
    <option value="">Selecionar jogo</option>
    ${state.games.map((game) => `
      <option
        value="${esc(game.id)}"
        ${game.id === selected ? "selected" : ""}
      >
        ${esc(game.nome || game.nome_jogo || game.id)}
      </option>
    `).join("")}
  `;

  const teamOptions = (selected = "") => `
    <option value="">Selecionar equipe</option>
    ${state.teams.map((team) => `
      <option
        value="${esc(team.id)}"
        ${team.id === selected ? "selected" : ""}
      >
        ${esc(team.nome)}
      </option>
    `).join("")}
  `;

  const playerOptions = (selected = "") => `
    <option value="">Selecionar jogador</option>
    ${state.players
      .filter((player) =>
        !["inativo", "dispensado"].includes(player.status) ||
        player.id === selected
      )
      .map((player) => `
        <option
          value="${esc(player.id)}"
          ${player.id === selected ? "selected" : ""}
        >
          ${esc(player.nome_completo)}
          ${player.apelido ? ` · ${esc(player.apelido)}` : ""}
        </option>
      `)
      .join("")}
  `;

  // Navegação principal: apenas Jogadores e Equipes.
  // A LINE faz parte da área Equipes.
  function shell(content) {
    const jogadoresAtivo = state.tab === "jogadores";
    const equipesAtivo = state.tab === "equipes" || state.tab === "line";

    root.innerHTML = `
      <div id="crud-feedback" class="feedback" hidden></div>

      <div
        class="crud-tabs"
        role="tablist"
        aria-label="Gerenciar jogadores e equipes"
      >
        <button
          class="crud-tab ${jogadoresAtivo ? "active" : ""}"
          type="button"
          role="tab"
          aria-selected="${jogadoresAtivo}"
          data-tab="jogadores"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="10" cy="7" r="4"/>
            <path d="M20 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Jogadores
          <span>${state.players.length}</span>
        </button>

        <button
          class="crud-tab ${equipesAtivo ? "active" : ""}"
          type="button"
          role="tab"
          aria-selected="${equipesAtivo}"
          data-tab="equipes"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          Equipes
          <span>${state.teams.length}</span>
        </button>
      </div>

      ${content}
    `;

    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextTab = button.dataset.tab;

        state.tab = nextTab;

        if (nextTab === "jogadores") {
          state.lineTeamFilter = "";
        }

        state.editingPlayer = null;
        state.editingTeam = null;
        state.editingMembership = null;

        render();
      });
    });
  }

  // =========================
  // JOGADORES
  // =========================

  function renderPlayers() {
    shell(`
      <div class="crud-toolbar">
        <div>
          <h3>Jogadores cadastrados</h3>
          <p>
            Cadastre e consulte os jogadores independentemente
            da equipe atual.
          </p>
        </div>

        <button
          class="button button-primary"
          type="button"
          data-action="new-player"
        >
          + Novo jogador
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Apelido</th>
              <th>Jogo</th>
              <th>Data de entrada</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            ${
              state.players.length
                ? state.players.map((player) => `
                    <tr>
                      <td>
                        <strong>${esc(player.nome_completo)}</strong>
                        <small>${esc(player.email || "Sem e-mail")}</small>
                      </td>

                      <td>${esc(player.apelido || "—")}</td>
                      <td>${esc(gameName(player.jogo_id))}</td>
                      <td>${formatDate(player.data_entrada)}</td>
                      <td>${status(player.status)}</td>

                      <td>
                        <div class="row-actions">
                          <button
                            class="text-button"
                            type="button"
                            data-edit-player="${esc(player.id)}"
                          >
                            Editar
                          </button>

                          <button
                            class="text-button danger"
                            type="button"
                            data-deactivate-player="${esc(player.id)}"
                          >
                            ${player.status === "inativo" ? "Ativar" : "Desativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join("")
                : `
                    <tr>
                      <td colspan="6" class="table-empty">
                        <strong>Nenhum jogador cadastrado</strong>
                        <span>
                          Use “Novo jogador” para iniciar o cadastro.
                        </span>
                      </td>
                    </tr>
                  `
            }
          </tbody>
        </table>
      </div>
    `);

    root
      .querySelector('[data-action="new-player"]')
      .addEventListener("click", () => renderPlayerForm());

    root.querySelectorAll("[data-edit-player]").forEach((button) => {
      button.addEventListener("click", () => {
        renderPlayerForm(playerById(button.dataset.editPlayer));
      });
    });

    root.querySelectorAll("[data-deactivate-player]").forEach((button) => {
      button.addEventListener("click", () => {
        togglePlayer(button.dataset.deactivatePlayer);
      });
    });
  }

  function renderPlayerForm(player = null) {
    state.editingPlayer = player?.id || null;

    shell(`
      <div class="crud-toolbar">
        <div>
          <h3>${player ? "Editar jogador" : "Novo jogador"}</h3>
          <p>Campos obrigatórios são validados antes do envio.</p>
        </div>

        <button
          class="button button-secondary"
          type="button"
          data-action="back"
        >
          Voltar para jogadores
        </button>
      </div>

      <form class="crud-form" id="player-form">
        <div class="form-grid">
          <label>
            Nome completo *
            <input
              name="nome_completo"
              required
              value="${esc(player?.nome_completo)}"
            />
          </label>

          <label>
            Apelido
            <input name="apelido" value="${esc(player?.apelido)}" />
          </label>

          <label>
            Jogo
            <select name="jogo_id">
              ${gameOptions(player?.jogo_id)}
            </select>
          </label>

          <label>
            ID do jogo
            <input name="id_jogo" value="${esc(player?.id_jogo)}" />
          </label>

          <label>
            E-mail
            <input
              name="email"
              type="email"
              value="${esc(player?.email)}"
            />
          </label>

          <label>
            Telefone
            <input name="telefone" value="${esc(player?.telefone)}" />
          </label>

          <label>
            Data de nascimento
            <input
              name="data_nascimento"
              type="date"
              value="${esc(player?.data_nascimento)}"
            />
          </label>

          <label>
            Data de entrada
            <input
              name="data_entrada"
              type="date"
              value="${esc(player?.data_entrada || today())}"
            />
          </label>

          <label>
            Status
            <select name="status">
              <option value="ativo" ${player?.status === "ativo" ? "selected" : ""}>Ativo</option>
              <option value="inativo" ${player?.status === "inativo" ? "selected" : ""}>Inativo</option>
              <option value="afastado" ${player?.status === "afastado" ? "selected" : ""}>Afastado</option>
              <option value="dispensado" ${player?.status === "dispensado" ? "selected" : ""}>Dispensado</option>
            </select>
          </label>

          <label class="full-width">
            Observações
            <textarea name="observacoes" rows="4">${esc(player?.observacoes)}</textarea>
          </label>
        </div>

        <div class="form-actions">
          <button
            class="button button-secondary"
            type="button"
            data-action="back"
          >
            Cancelar
          </button>

          <button class="button button-primary" type="submit">
            ${player ? "Salvar alterações" : "Cadastrar jogador"}
          </button>
        </div>
      </form>
    `);

    root.querySelectorAll('[data-action="back"]').forEach((button) => {
      button.addEventListener("click", () => {
        state.editingPlayer = null;
        renderPlayers();
      });
    });

    root
      .querySelector("#player-form")
      .addEventListener("submit", savePlayer);
  }

  async function savePlayer(event) {
    event.preventDefault();

    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries()
    );

    if (!values.nome_completo.trim()) {
      return notify("Informe o nome completo.", "error");
    }

    const payload = {
      nome_completo: values.nome_completo.trim(),
      apelido: values.apelido.trim() || null,
      jogo_id: values.jogo_id || null,
      id_jogo: values.id_jogo.trim() || null,
      email: values.email.trim() || null,
      telefone: values.telefone.trim() || null,
      data_nascimento: values.data_nascimento || null,
      data_entrada: values.data_entrada || null,
      status: values.status,
      observacoes: values.observacoes.trim() || null,
      atualizado_em: new Date().toISOString()
    };

    if (!state.editingPlayer) {
      payload.criado_em = new Date().toISOString();
    }

    const result = state.editingPlayer
      ? await client
          .from("jogadores")
          .update(payload)
          .eq("id", state.editingPlayer)
          .select()
          .single()
      : await client
          .from("jogadores")
          .insert(payload)
          .select()
          .single();

    if (result.error) {
      return notify(
        `Erro ao guardar jogador: ${errorText(result.error)}`,
        "error"
      );
    }

    state.editingPlayer = null;
    await loadData();
    notify("Jogador guardado com sucesso.", "success");
  }

  async function togglePlayer(id) {
    const player = playerById(id);

    if (!player) return;

    const nextStatus = player.status === "inativo" ? "ativo" : "inativo";

    if (
      !window.confirm(
        `${nextStatus === "inativo" ? "Desativar" : "Ativar"} este jogador?`
      )
    ) {
      return;
    }

    const result = await client
      .from("jogadores")
      .update({
        status: nextStatus,
        atualizado_em: new Date().toISOString()
      })
      .eq("id", id);

    if (result.error) {
      return notify(
        `Erro ao atualizar jogador: ${errorText(result.error)}`,
        "error"
      );
    }

    await loadData();
    notify("Status do jogador atualizado.", "success");
  }

  // =========================
  // EQUIPES
  // =========================

  function renderTeams() {
    const cards = state.teams.length
      ? state.teams.map((team) => {
          const members = state.memberships.filter(
            (item) => item.equipe_id === team.id
          );

          const activeMembers = members.filter(
            (item) => item.ativo
          ).length;

          return `
            <article class="team-card">
              <header class="team-card-header">
                <div>
                  <span class="team-kicker">
                    ${esc(team.categoria || "EQUIPE COMPETITIVA")}
                  </span>

                  <h3>${esc(team.nome)}</h3>

                  <p>
                    ${esc(gameName(team.jogo_id))}
                    ${team.descricao ? ` · ${esc(team.descricao)}` : ""}
                  </p>
                </div>

                <div class="team-header-actions">
                  ${status(team.status)}

                  <button
                    class="icon-button"
                    type="button"
                    title="Editar equipe"
                    aria-label="Editar equipe ${esc(team.nome)}"
                    data-edit-team="${esc(team.id)}"
                  >
                    ✎
                  </button>
                </div>
              </header>

              <div class="team-roster-summary">
                <div>
                  <strong>Escalação da equipe</strong>
                  <span>
                    ${activeMembers} jogador(es) ativo(s) na LINE
                    · ${members.length} vínculo(s) no histórico
                  </span>
                </div>

                <button
                  class="button button-secondary"
                  type="button"
                  data-view-line="${esc(team.id)}"
                >
                  Ver LINE da equipe
                </button>
              </div>
            </article>
          `;
        }).join("")
      : `
          <div class="empty-state">
            <span class="empty-icon">♙</span>
            <h4>Nenhuma equipe cadastrada</h4>
            <p>
              Cadastre a primeira equipe para começar a organizar os elencos.
            </p>
            <button
              class="button button-primary"
              type="button"
              data-action="new-team"
            >
              + Nova equipe
            </button>
          </div>
        `;

    shell(`
      <div class="crud-toolbar">
        <div>
          <h3>Equipes cadastradas</h3>
          <p>
            Gerencie suas equipes e acesse a LINE para organizar
            os jogadores de cada elenco.
          </p>
        </div>

        <button
          class="button button-primary"
          type="button"
          data-action="new-team"
        >
          + Nova equipe
        </button>
      </div>

      <div class="team-grid">${cards}</div>
    `);

    root.querySelectorAll('[data-action="new-team"]').forEach((button) => {
      button.addEventListener("click", () => renderTeamForm());
    });

    root.querySelectorAll("[data-edit-team]").forEach((button) => {
      button.addEventListener("click", () => {
        renderTeamForm(teamById(button.dataset.editTeam));
      });
    });

    root.querySelectorAll("[data-view-line]").forEach((button) => {
      button.addEventListener("click", () => {
        state.lineTeamFilter = button.dataset.viewLine;
        state.tab = "line";
        render();
      });
    });
  }

  function renderTeamForm(team = null) {
    state.editingTeam = team?.id || null;
    state.tab = "equipes";

    shell(`
      <div class="crud-toolbar">
        <div>
          <h3>${team ? "Editar equipe" : "Nova equipe"}</h3>
          <p>O jogo oficial da equipe usa o campo jogo_id.</p>
        </div>

        <button
          class="button button-secondary"
          type="button"
          data-action="back"
        >
          Voltar para equipes
        </button>
      </div>

      <form class="crud-form" id="team-form">
        <div class="form-grid">
          <label>
            Nome da equipe *
            <input
              name="nome"
              required
              value="${esc(team?.nome)}"
            />
          </label>

          <label>
            Jogo
            <select name="jogo_id" required>
              ${gameOptions(team?.jogo_id)}
            </select>
          </label>

          <label>
            Categoria
            <input
              name="categoria"
              value="${esc(team?.categoria)}"
              placeholder="Ex.: Principal, Academy"
            />
          </label>

          <label>
            Status
            <select name="status">
              <option value="ativa" ${team?.status === "ativa" ? "selected" : ""}>Ativa</option>
              <option value="inativa" ${team?.status === "inativa" ? "selected" : ""}>Inativa</option>
              <option value="encerrada" ${team?.status === "encerrada" ? "selected" : ""}>Encerrada</option>
            </select>
          </label>

          <label class="full-width">
            Descrição
            <textarea name="descricao" rows="4">${esc(team?.descricao)}</textarea>
          </label>
        </div>

        <div class="form-actions">
          <button
            class="button button-secondary"
            type="button"
            data-action="back"
          >
            Cancelar
          </button>

          <button class="button button-primary" type="submit">
            ${team ? "Salvar alterações" : "Cadastrar equipe"}
          </button>
        </div>
      </form>
    `);

    root.querySelectorAll('[data-action="back"]').forEach((button) => {
      button.addEventListener("click", () => {
        state.editingTeam = null;
        renderTeams();
      });
    });

    root
      .querySelector("#team-form")
      .addEventListener("submit", saveTeam);
  }

  async function saveTeam(event) {
    event.preventDefault();

    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries()
    );

    if (!values.nome.trim() || !values.jogo_id) {
      return notify("Informe o nome e o jogo da equipe.", "error");
    }

    const payload = {
      nome: values.nome.trim(),
      jogo_id: values.jogo_id,
      categoria: values.categoria.trim() || null,
      descricao: values.descricao.trim() || null,
      status: values.status
    };

    if (!state.editingTeam) {
      payload.criado_em = new Date().toISOString();
    }

    const result = state.editingTeam
      ? await client
          .from("equipes")
          .update(payload)
          .eq("id", state.editingTeam)
          .select()
          .single()
      : await client
          .from("equipes")
          .insert(payload)
          .select()
          .single();

    if (result.error) {
      return notify(
        `Erro ao guardar equipe: ${errorText(result.error)}`,
        "error"
      );
    }

    state.editingTeam = null;
    await loadData();
    notify("Equipe guardada com sucesso.", "success");
  }

  // =========================
  // LINE / ESCALAÇÕES
  // =========================

  function renderLine() {
    const filtered = state.lineTeamFilter
      ? state.memberships.filter(
          (item) => item.equipe_id === state.lineTeamFilter
        )
      : state.memberships;

    shell(`
      <div class="crud-toolbar">
        <div>
          <h3>LINE / escalações</h3>
          <p>
            Administre os jogadores vinculados a cada equipe,
            com histórico de entrada, saída e função.
          </p>
        </div>

        <button
          class="button button-primary"
          type="button"
          data-action="new-membership"
        >
          + Adicionar jogador
        </button>
      </div>

      <div class="line-filter-bar">
        <label>
          Filtrar por equipe
          <select id="line-team-filter">
            ${teamOptions(state.lineTeamFilter)}
          </select>
        </label>

        <span class="badge">
          ${filtered.filter((item) => item.ativo).length} vínculos ativos
        </span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Equipe</th>
              <th>Jogador</th>
              <th>Função</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            ${
              filtered.length
                ? filtered.map((item) => {
                    const player = playerById(item.jogador_id);

                    return `
                      <tr>
                        <td>${esc(teamName(item.equipe_id))}</td>

                        <td>
                          <strong>
                            ${esc(player?.nome_completo || item.jogador_id)}
                          </strong>
                          <small>
                            ${esc(player?.apelido || player?.email || "Sem apelido")}
                          </small>
                        </td>

                        <td>${esc(item.funcao || "Não definida")}</td>
                        <td>${formatDate(item.data_inicio)}</td>
                        <td>${formatDate(item.data_fim)}</td>

                        <td>
                          ${
                            item.ativo
                              ? '<span class="badge badge-success">Na LINE</span>'
                              : '<span class="badge badge-danger">Encerrado</span>'
                          }
                        </td>

                        <td>
                          <div class="row-actions">
                            <button
                              class="text-button"
                              type="button"
                              data-edit-membership="${esc(item.id)}"
                            >
                              Editar
                            </button>

                            <button
                              class="text-button danger"
                              type="button"
                              data-end-membership="${esc(item.id)}"
                            >
                              ${item.ativo ? "Encerrar" : "Reativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join("")
                : `
                    <tr>
                      <td colspan="7" class="table-empty">
                        <strong>Nenhum vínculo encontrado</strong>
                        <span>
                          Selecione uma equipe ou adicione o primeiro
                          jogador à LINE.
                        </span>
                      </td>
                    </tr>
                  `
            }
          </tbody>
        </table>
      </div>
    `);

    root
      .querySelector('[data-action="new-membership"]')
      .addEventListener("click", () => {
        renderMembershipForm(null, state.lineTeamFilter);
      });

    root
      .querySelector("#line-team-filter")
      .addEventListener("change", (event) => {
        state.lineTeamFilter = event.target.value;
        renderLine();
      });

    root.querySelectorAll("[data-edit-membership]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = state.memberships.find(
          (entry) => entry.id === button.dataset.editMembership
        );

        if (item) renderMembershipForm(item);
      });
    });

    root.querySelectorAll("[data-end-membership]").forEach((button) => {
      button.addEventListener("click", () => {
        toggleMembership(button.dataset.endMembership);
      });
    });
  }

  function renderMembershipForm(item = null, teamId = null) {
    state.editingMembership = item?.id || null;
    state.tab = "line";

    const selectedTeam = item?.equipe_id || teamId || "";

    shell(`
      <div class="crud-toolbar">
        <div>
          <h3>
            ${item ? "Editar vínculo da LINE" : "Adicionar jogador à LINE"}
          </h3>
          <p>
            O vínculo registra a equipe, o jogador, a função e as datas.
          </p>
        </div>

        <button
          class="button button-secondary"
          type="button"
          data-action="back"
        >
          Voltar para LINE
        </button>
      </div>

      <form class="crud-form" id="membership-form">
        <div class="form-grid">
          <label>
            Equipe *
            <select name="equipe_id" required>
              ${teamOptions(selectedTeam)}
            </select>
          </label>

          <label>
            Jogador *
            <select name="jogador_id" required>
              ${playerOptions(item?.jogador_id)}
            </select>
          </label>

          <label>
            Função
            <input
              name="funcao"
              value="${esc(item?.funcao)}"
              placeholder="Ex.: Capitão, Rush, Suporte"
            />
          </label>

          <label>
            Data de início *
            <input
              name="data_inicio"
              type="date"
              required
              value="${esc(item?.data_inicio || today())}"
            />
          </label>

          <label>
            Data de fim
            <input
              name="data_fim"
              type="date"
              value="${esc(item?.data_fim)}"
            />
          </label>

          <label>
            Status
            <select name="ativo">
              <option value="true" ${item?.ativo !== false ? "selected" : ""}>
                Na LINE
              </option>
              <option value="false" ${item?.ativo === false ? "selected" : ""}>
                Vínculo encerrado
              </option>
            </select>
          </label>
        </div>

        <div class="form-actions">
          <button
            class="button button-secondary"
            type="button"
            data-action="back"
          >
            Cancelar
          </button>

          <button class="button button-primary" type="submit">
            ${item ? "Salvar vínculo" : "Adicionar à LINE"}
          </button>
        </div>
      </form>
    `);

    root.querySelectorAll('[data-action="back"]').forEach((button) => {
      button.addEventListener("click", () => {
        state.editingMembership = null;
        renderLine();
      });
    });

    root
      .querySelector("#membership-form")
      .addEventListener("submit", saveMembership);
  }

  async function saveMembership(event) {
    event.preventDefault();

    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries()
    );

    if (!values.equipe_id || !values.jogador_id || !values.data_inicio) {
      return notify(
        "Informe equipe, jogador e data de início.",
        "error"
      );
    }

    if (values.data_fim && values.data_fim < values.data_inicio) {
      return notify(
        "A data de fim não pode ser anterior à data de início.",
        "error"
      );
    }

    const payload = {
      equipe_id: values.equipe_id,
      jogador_id: values.jogador_id,
      funcao: values.funcao.trim() || null,
      data_inicio: values.data_inicio,
      data_fim: values.data_fim || null,
      ativo: values.ativo === "true"
    };

    if (!payload.ativo && !payload.data_fim) {
      payload.data_fim = today();
    }

    if (payload.ativo) {
      payload.data_fim = null;
    }

    if (!state.editingMembership) {
      payload.criado_em = new Date().toISOString();
    }

    const result = state.editingMembership
      ? await client
          .from("membros_equipe")
          .update(payload)
          .eq("id", state.editingMembership)
          .select()
          .single()
      : await client
          .from("membros_equipe")
          .insert(payload)
          .select()
          .single();

    if (result.error) {
      return notify(
        `Erro ao guardar LINE: ${errorText(result.error)}`,
        "error"
      );
    }

    state.editingMembership = null;
    await loadData();
    notify("Vínculo da LINE guardado com sucesso.", "success");
  }

  async function toggleMembership(id) {
    const item = state.memberships.find((entry) => entry.id === id);

    if (!item) return;

    const next = !item.ativo;

    if (
      !window.confirm(
        `${next ? "Reativar" : "Encerrar"} este vínculo?`
      )
    ) {
      return;
    }

    const result = await client
      .from("membros_equipe")
      .update({
        ativo: next,
        data_fim: next ? null : (item.data_fim || today())
      })
      .eq("id", id);

    if (result.error) {
      return notify(
        `Erro ao atualizar LINE: ${errorText(result.error)}`,
        "error"
      );
    }

    await loadData();
    notify(
      next ? "Vínculo reativado." : "Vínculo encerrado.",
      "success"
    );
  }

  // =========================
  // INICIALIZAÇÃO
  // =========================

  function render() {
    if (state.tab === "equipes") {
      renderTeams();
    } else if (state.tab === "line") {
      renderLine();
    } else {
      renderPlayers();
    }
  }

  loadData();
});
