
(() => {
  'use strict';

  const root = document.getElementById('crud-root');

  if (!root) {
    console.error('Kaerb ERP: elemento #crud-root não encontrado.');
    return;
  }

  let db = null;
  let teams = [];
  let games = [];
  let players = [];
  let members = [];
  let tab = 'players';
  let selected = '';
  let editTeam = null;
  let editMember = null;
  let editPlayer = null;
  let initialized = false;
  let loading = false;

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));

  const today = () => {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  };

  function notice(message, type = 'info') {
    let element = root.querySelector('[data-teams-notice]');

    if (!element) {
      element = document.createElement('div');
      element.dataset.teamsNotice = '';
      root.prepend(element);
    }

    element.className = `notice notice-${type}`;
    element.textContent = message;
    element.hidden = false;
  }

  function showError(message) {
    root.innerHTML = `
      <div class="notice notice-error">
        <strong>Não foi possível carregar Jogadores e LINEs.</strong>
        <p>${esc(message)}</p>
        <button type="button" class="btn" id="retry-teams">
          Tentar novamente
        </button>
      </div>
    `;

    root.querySelector('#retry-teams')
      .addEventListener('click', load);
  }

  async function load() {
    if (!db || loading) return;

    loading = true;

    root.innerHTML = `
      <div class="loading-state">
        <span class="spinner"></span>
        Carregando jogadores e LINEs...
      </div>
    `;

    try {
      const results = await Promise.all([
        db.from('equipes').select('*').order('nome'),
        db.from('jogos').select('*'),
        db.from('jogadores').select('*').order('nome_completo'),
        db.from('membros_equipe')
          .select('*')
          .order('data_inicio', { ascending: false })
      ]);

      const failed = results.find(result => result.error);

      if (failed) {
        showError(failed.error.message);
        return;
      }

      [teams, games, players, members] =
        results.map(result => result.data || []);

      render();
    } catch (error) {
      console.error('Kaerb ERP — erro ao carregar:', error);
      showError(error.message || 'Erro inesperado.');
    } finally {
      loading = false;
    }
  }

  function gameName(id) {
    const game = games.find(
      item => String(item.id) === String(id)
    );

    return game
      ? game.nome || game.nome_jogo || '—'
      : '—';
  }

  function playerName(id) {
    const player = players.find(
      item => String(item.id) === String(id)
    );

    return player
      ? player.apelido || player.nome_completo || 'Jogador'
      : 'Jogador';
  }

  function render() {
    root.innerHTML = `
      <div class="crud-tabs">
        <button
          type="button"
          class="crud-tab ${tab === 'players' ? 'active' : ''}"
          data-tab="players"
        >
          Jogadores
        </button>

        <button
          type="button"
          class="crud-tab ${tab === 'lines' ? 'active' : ''}"
          data-tab="lines"
        >
          LINEs
        </button>
      </div>

      <div id="content"></div>
    `;

    root.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        tab = button.dataset.tab;
        render();
      });
    });

    const content = root.querySelector('#content');

    if (tab === 'players') {
      renderPlayers(content);
    } else {
      renderLines(content);
    }
  }

  // =====================================================
  // JOGADORES — cadastro independente das LINEs
  // =====================================================

  function renderPlayers(content) {
    content.innerHTML = `
      <div class="crud-toolbar">
        <input
          id="search-player"
          class="field"
          type="search"
          placeholder="Buscar jogador"
          aria-label="Buscar jogador"
        >

        <button
          type="button"
          id="new-player"
          class="btn btn-primary"
        >
          + Cadastrar jogador
        </button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Apelido</th>
              <th>Nome completo</th>
              <th>Status</th>
              <th>LINEs atuais</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            ${
              players.length
                ? players.map(player => {
                    const activeLines = members.filter(member =>
                      String(member.jogador_id) === String(player.id) &&
                      member.ativo === true
                    );

                    return `
                      <tr>
                        <td>${esc(player.apelido || '—')}</td>
                        <td>${esc(player.nome_completo || '—')}</td>
                        <td>${esc(player.status || '—')}</td>
                        <td>${activeLines.length}</td>
                        <td class="row-actions">
                          <button
                            type="button"
                            class="btn btn-small"
                            data-edit-player="${esc(player.id)}"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            class="btn btn-small btn-primary"
                            data-player-line="${esc(player.id)}"
                          >
                            Vincular à LINE
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')
                : `
                  <tr>
                    <td colspan="5" class="empty-cell">
                      Nenhum jogador cadastrado.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>

      <div id="player-form-slot"></div>
    `;

    content.querySelector('#new-player')
      .addEventListener('click', () => playerForm());

    content.querySelector('#search-player')
      .addEventListener('input', event => {
        const query = event.target.value.toLowerCase();

        content.querySelectorAll('tbody tr').forEach(row => {
          row.hidden = !row.textContent.toLowerCase().includes(query);
        });
      });

    content.querySelectorAll('[data-edit-player]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const player = players.find(
            item => String(item.id) === button.dataset.editPlayer
          );

          if (player) playerForm(player);
        });
      });

    content.querySelectorAll('[data-player-line]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const playerId = button.dataset.playerLine;

          const existing = members.find(member =>
            String(member.jogador_id) === String(playerId) &&
            member.ativo === true
          );

          selected = existing?.equipe_id
            ? String(existing.equipe_id)
            : '';

          tab = 'lines';
          render();

          const content = root.querySelector('#content');
          const chooseTeam = content?.querySelector('#choose-team');

          if (chooseTeam && selected) {
            chooseTeam.value = selected;
          }

          if (chooseTeam) {
            selected = chooseTeam.value;
          }

          render();

          const slot = root.querySelector('#member-form-slot');

          if (slot) {
            memberForm({}, playerId);
          }
        });
      });
  }

  function playerForm(player = {}) {
    editPlayer = player.id ?? null;

    const slot = root.querySelector('#player-form-slot');
    if (!slot) return;

    slot.innerHTML = `
      <form class="crud-form" id="player-form">
        <h2>${editPlayer ? 'Editar jogador' : 'Cadastrar jogador'}</h2>

        <div class="form-grid">
          <label>
            Nome completo *
            <input
              class="field"
              name="nome_completo"
              required
              value="${esc(player.nome_completo)}"
            >
          </label>

          <label>
            Apelido *
            <input
              class="field"
              name="apelido"
              required
              value="${esc(player.apelido)}"
            >
          </label>

          <label>
            Status
            <select class="field" name="status">
              <option
                value="ativo"
                ${
                  !player.status || player.status === 'ativo'
                    ? 'selected'
                    : ''
                }
              >
                Ativo
              </option>

              <option
                value="inativo"
                ${player.status === 'inativo' ? 'selected' : ''}
              >
                Inativo
              </option>
            </select>
          </label>
        </div>

        <p class="muted">
          O cadastro do jogador é independente da LINE.
          Depois de salvar, você poderá vinculá-lo a uma LINE.
        </p>

        <div class="form-actions">
          <button type="button" class="btn" id="cancel-player">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar jogador
          </button>
        </div>
      </form>
    `;

    const form = slot.querySelector('#player-form');

    slot.querySelector('#cancel-player')
      .addEventListener('click', () => {
        editPlayer = null;
        slot.innerHTML = '';
      });

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;

      button.disabled = true;

      try {
        const data = Object.fromEntries(
          new FormData(form).entries()
        );

        const result = editPlayer
          ? await db.from('jogadores')
              .update(data)
              .eq('id', editPlayer)
          : await db.from('jogadores').insert(data);

        if (result.error) {
          notice(
            'Erro ao salvar jogador: ' + result.error.message,
            'error'
          );
          return;
        }

        editPlayer = null;
        await load();
        notice('Jogador salvo com sucesso.', 'success');
      } catch (error) {
        console.error(error);
        notice('Erro inesperado ao salvar o jogador.', 'error');
      } finally {
        button.disabled = false;
      }
    });

    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // =====================================================
  // LINEs — a tabela equipes continua sendo usada no banco
  // =====================================================

  function renderLines(content) {
    const choices = teams.filter(team => team.status !== 'encerrada');

    if (!selected || !choices.some(
      team => String(team.id) === String(selected)
    )) {
      selected = choices[0]?.id ? String(choices[0].id) : '';
    }

    content.innerHTML = `
      <div class="crud-toolbar">
        <input
          id="search-line"
          class="field"
          type="search"
          placeholder="Buscar LINE"
          aria-label="Buscar LINE"
        >

        <button
          type="button"
          class="btn btn-primary"
          id="new-line"
        >
          + Nova LINE
        </button>
      </div>

      <div class="team-grid">
        ${
          teams.length
            ? teams.map(team => {
                const activeMembers = members.filter(member =>
                  String(member.equipe_id) === String(team.id) &&
                  member.ativo === true
                ).length;

                return `
                  <article class="team-card">
                    <span class="status-pill ${
                      team.status === 'ativa' ? 'is-active' : 'is-inactive'
                    }">
                      ${esc(team.status || 'ativa')}
                    </span>

                    <h3>${esc(team.nome)}</h3>

                    <p>
                      ${esc(gameName(team.jogo_id))}
                      ·
                      ${esc(team.categoria || 'Sem categoria')}
                    </p>

                    <div class="team-card-meta">
                      <span>Jogadores ativos</span>
                      <strong>${activeMembers}</strong>
                    </div>

                    <div class="form-actions">
                      <button
                        type="button"
                        class="btn btn-small"
                        data-edit-line="${esc(team.id)}"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        class="btn btn-primary btn-small"
                        data-manage-line="${esc(team.id)}"
                      >
                        Gerenciar LINE
                      </button>
                    </div>
                  </article>
                `;
              }).join('')
            : '<p>Nenhuma LINE cadastrada.</p>'
        }
      </div>

      <div id="line-form-slot"></div>
      <div id="line-members-slot"></div>
    `;

    content.querySelector('#new-line')
      .addEventListener('click', () => lineForm());

    content.querySelector('#search-line')
      .addEventListener('input', event => {
        const query = event.target.value.toLowerCase();

        content.querySelectorAll('.team-card').forEach(card => {
          card.hidden = !card.textContent.toLowerCase().includes(query);
        });
      });

    content.querySelectorAll('[data-edit-line]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const team = teams.find(
            item => String(item.id) === button.dataset.editLine
          );

          if (team) lineForm(team);
        });
      });

    content.querySelectorAll('[data-manage-line]')
      .forEach(button => {
        button.addEventListener('click', () => {
          selected = button.dataset.manageLine;
          renderLineMembers(content);
        });
      });

    if (selected && choices.some(
      team => String(team.id) === String(selected)
    )) {
      renderLineMembers(content);
    }
  }

  function lineForm(team = {}) {
    editTeam = team.id ?? null;

    const slot = root.querySelector('#line-form-slot');
    if (!slot) return;

    slot.innerHTML = `
      <form class="crud-form" id="line-form">
        <h2>${editTeam ? 'Editar LINE' : 'Cadastrar LINE'}</h2>

        <div class="form-grid">
          <label>
            Nome da LINE *
            <input
              class="field"
              name="nome"
              required
              value="${esc(team.nome)}"
            >
          </label>

          <label>
            Jogo
            <select class="field" name="jogo_id">
              <option value="">Selecione</option>

              ${games.map(game => `
                <option
                  value="${esc(game.id)}"
                  ${
                    String(team.jogo_id || '') === String(game.id)
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(game.nome || game.nome_jogo)}
                </option>
              `).join('')}
            </select>
          </label>

          <label>
            Categoria
            <input
              class="field"
              name="categoria"
              placeholder="Principal, Academy..."
              value="${esc(team.categoria)}"
            >
          </label>

          <label>
            Status
            <select class="field" name="status">
              <option value="ativa" ${
                !team.status || team.status === 'ativa' ? 'selected' : ''
              }>Ativa</option>

              <option value="inativa" ${
                team.status === 'inativa' ? 'selected' : ''
              }>Inativa</option>

              <option value="encerrada" ${
                team.status === 'encerrada' ? 'selected' : ''
              }>Encerrada</option>
            </select>
          </label>

          <label class="full-field">
            Descrição
            <textarea class="field" name="descricao">${esc(team.descricao)}</textarea>
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" id="cancel-line">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar LINE
          </button>
        </div>
      </form>
    `;

    const form = slot.querySelector('#line-form');

    slot.querySelector('#cancel-line')
      .addEventListener('click', () => {
        editTeam = null;
        slot.innerHTML = '';
      });

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;

      button.disabled = true;

      try {
        const data = Object.fromEntries(
          new FormData(form).entries()
        );

        data.jogo_id ||= null;
        data.atualizado_em = new Date().toISOString();

        const result = editTeam
          ? await db.from('equipes').update(data).eq('id', editTeam)
          : await db.from('equipes').insert({
              ...data,
              criado_em: new Date().toISOString()
            });

        if (result.error) {
          notice(
            'Erro ao salvar LINE: ' + result.error.message,
            'error'
          );
          return;
        }

        editTeam = null;
        await load();
        tab = 'lines';
        render();
        notice('LINE salva com sucesso.', 'success');
      } catch (error) {
        console.error(error);
        notice('Erro inesperado ao salvar a LINE.', 'error');
      } finally {
        button.disabled = false;
      }
    });

    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // =====================================================
  // VÍNCULO ENTRE JOGADORES E LINEs
  // =====================================================

  function renderLineMembers(content) {
    const team = teams.find(
      item => String(item.id) === String(selected)
    );

    if (!team) {
      notice('Selecione uma LINE válida.', 'error');
      return;
    }

    const rows = members.filter(
      member => String(member.equipe_id) === String(selected)
    );

    let slot = content.querySelector('#line-members-slot');

    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'line-members-slot';
      content.appendChild(slot);
    }

    slot.innerHTML = `
      <div class="crud-form">
        <h2>LINE: ${esc(team.nome)}</h2>

        <div class="crud-toolbar">
          <span>Elenco e histórico de participações</span>

          <button
            type="button"
            class="btn btn-primary"
            id="add-member"
          >
            + Vincular jogador
          </button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Função</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              ${
                rows.length
                  ? rows.map(member => `
                      <tr>
                        <td>${esc(playerName(member.jogador_id))}</td>
                        <td>${esc(member.funcao || '—')}</td>
                        <td>${esc(member.data_inicio || '—')}</td>
                        <td>${esc(member.data_fim || '—')}</td>
                        <td>${member.ativo ? 'Ativo' : 'Encerrado'}</td>
                        <td class="row-actions">
                          <button
                            type="button"
                            class="btn btn-small"
                            data-edit-member="${esc(member.id)}"
                          >
                            Editar
                          </button>

                          ${
                            member.ativo
                              ? `<button type="button" class="btn btn-small btn-danger" data-end="${esc(member.id)}">Encerrar</button>`
                              : `<button type="button" class="btn btn-small" data-reactivate="${esc(member.id)}">Reativar</button>`
                          }
                        </td>
                      </tr>
                    `).join('')
                  : `
                    <tr>
                      <td colspan="6" class="empty-cell">
                        Nenhum jogador vinculado a esta LINE.
                      </td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>

        <div id="member-form-slot"></div>
      </div>
    `;

    slot.querySelector('#add-member')
      .addEventListener('click', () => memberForm());

    slot.querySelectorAll('[data-edit-member]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const member = members.find(
            item => String(item.id) === button.dataset.editMember
          );

          if (member) memberForm(member);
        });
      });

    slot.querySelectorAll('[data-end]')
      .forEach(button => {
        button.addEventListener('click', () => {
          toggleMember(button.dataset.end, false);
        });
      });

    slot.querySelectorAll('[data-reactivate]')
      .forEach(button => {
        button.addEventListener('click', () => {
          toggleMember(button.dataset.reactivate, true);
        });
      });

    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function memberForm(member = {}, presetPlayerId = '') {
    editMember = member.id ?? null;

    const slot = root.querySelector('#member-form-slot');
    if (!slot) return;

    const startDate = member.data_inicio || today();

    slot.innerHTML = `
      <form class="crud-form" id="member-form">
        <h3>${editMember ? 'Editar participação' : 'Vincular jogador à LINE'}</h3>

        <div class="form-grid">
          <label>
            Jogador *
            <select class="field" name="jogador_id" required>
              <option value="">Selecione um jogador cadastrado</option>

              ${players.filter(player =>
                player.status === 'ativo' ||
                String(player.id) === String(member.jogador_id || presetPlayerId)
              ).map(player => `
                <option
                  value="${esc(player.id)}"
                  ${
                    String(player.id) === String(member.jogador_id || presetPlayerId)
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(player.apelido || player.nome_completo)}
                  — ${esc(player.nome_completo)}
                </option>
              `).join('')}
            </select>
          </label>

          <label>
            Função
            <input
              class="field"
              name="funcao"
              placeholder="IGL, suporte, entry, coach..."
              value="${esc(member.funcao)}"
            >
          </label>

          <label>
            Data de entrada *
            <input
              class="field"
              type="date"
              name="data_inicio"
              required
              value="${esc(startDate)}"
            >
          </label>

          <label>
            Data de saída
            <input
              class="field"
              type="date"
              name="data_fim"
              value="${esc(member.data_fim)}"
              min="${esc(startDate)}"
            >
          </label>

          <label>
            Status
            <select class="field" name="ativo">
              <option value="true" ${
                member.ativo !== false ? 'selected' : ''
              }>Ativo</option>

              <option value="false" ${
                member.ativo === false ? 'selected' : ''
              }>Encerrado</option>
            </select>
          </label>
        </div>

        <p class="muted">
          O jogador continua cadastrado mesmo se sair da LINE.
        </p>

        <div class="form-actions">
          <button type="button" class="btn" id="cancel-member">
            Cancelar
          </button>

          <button type="submit" class="btn btn-primary">
            Salvar vínculo
          </button>
        </div>
      </form>
    `;

    const form = slot.querySelector('#member-form');
    const startInput = form.elements.namedItem('data_inicio');
    const endInput = form.elements.namedItem('data_fim');

    function validateDates() {
      endInput.min = startInput.value;

      endInput.setCustomValidity(
        endInput.value && endInput.value < startInput.value
          ? 'A data de saída não pode ser anterior à data de entrada.'
          : ''
      );
    }

    startInput.addEventListener('change', validateDates);
    endInput.addEventListener('change', validateDates);

    slot.querySelector('#cancel-member')
      .addEventListener('click', () => {
        editMember = null;
        slot.innerHTML = '';
      });

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;

      validateDates();

      if (!form.reportValidity()) return;

      const data = Object.fromEntries(
        new FormData(form).entries()
      );

      data.equipe_id = selected;
      data.ativo = data.ativo === 'true';
      data.data_fim ||= null;

      if (data.ativo) data.data_fim = null;

      const duplicate = data.ativo && members.some(item =>
        item.ativo === true &&
        String(item.equipe_id) === String(selected) &&
        String(item.jogador_id) === String(data.jogador_id) &&
        String(item.id) !== String(editMember)
      );

      if (duplicate) {
        notice(
          'Este jogador já está ativo nesta LINE.',
          'error'
        );
        return;
      }

      button.disabled = true;

      try {
        const result = editMember
          ? await db.from('membros_equipe')
              .update(data)
              .eq('id', editMember)
          : await db.from('membros_equipe').insert(data);

        if (result.error) {
          notice(
            'Erro ao salvar vínculo: ' + result.error.message,
            'error'
          );
          return;
        }

        editMember = null;
        await load();

        tab = 'lines';
        render();

        const content = root.querySelector('#content');
        if (content) renderLineMembers(content);

        notice('Vínculo salvo com sucesso.', 'success');
      } catch (error) {
        console.error(error);
        notice('Erro inesperado ao salvar o vínculo.', 'error');
      } finally {
        button.disabled = false;
      }
    });

    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function toggleMember(id, active) {
    const confirmed = confirm(
      active
        ? 'Deseja reativar esta participação?'
        : 'Deseja encerrar esta participação?'
    );

    if (!confirmed) return;

    const member = members.find(
      item => String(item.id) === String(id)
    );

    if (!member) {
      notice('Participação não encontrada. Atualize a página.', 'error');
      return;
    }

    if (active && members.some(item =>
      item.ativo === true &&
      String(item.equipe_id) === String(member.equipe_id) &&
      String(item.jogador_id) === String(member.jogador_id) &&
      String(item.id) !== String(member.id)
    )) {
      notice(
        'Este jogador já possui uma participação ativa nesta LINE.',
        'error'
      );
      return;
    }

    if (!active && member.data_inicio && today() < member.data_inicio) {
      notice(
        'A data de encerramento não pode ser anterior à data de entrada.',
        'error'
      );
      return;
    }

    const data = active
      ? { ativo: true, data_fim: null }
      : { ativo: false, data_fim: today() };

    try {
      const { error } = await db
        .from('membros_equipe')
        .update(data)
        .eq('id', id);

      if (error) {
        notice('Erro ao atualizar participação: ' + error.message, 'error');
        return;
      }

      await load();

      tab = 'lines';
      render();

      const content = root.querySelector('#content');
      if (content) renderLineMembers(content);

      notice(
        active ? 'Participação reativada.' : 'Participação encerrada.',
        'success'
      );
    } catch (error) {
      console.error(error);
      notice('Erro inesperado ao atualizar a participação.', 'error');
    }
  }

  function init() {
    if (initialized) return;

    db = window.kaerbSupabase;

    if (!db) {
      showError(
        'O cliente Supabase não foi inicializado. Confira supabase-config.js e supabase-client.js.'
      );
      return;
    }

    initialized = true;
    load();
  }

  document.addEventListener('kaerb:ready', init);

  if (window.kaerbReady &&
      typeof window.kaerbReady.then === 'function') {
    window.kaerbReady
      .then(isReady => {
        if (isReady) init();
      })
      .catch(error => {
        console.error('Kaerb ERP — erro ao validar sessão:', error);
        showError('Não foi possível validar a sessão. Entre novamente.');
      });
  }
})();
