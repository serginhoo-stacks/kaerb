
(() => {
  'use strict';

  const root = document.getElementById('teams-root');
  if (!root) return;

  let db;
  let teams = [];
  let games = [];
  let players = [];
  let members = [];
  let tab = 'teams';
  let selected = '';
  let editTeam = null;
  let editMember = null;

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
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  function notice(message, type = 'info') {
    let element = root.querySelector('.notice');

    if (!element) {
      element = document.createElement('div');
      root.prepend(element);
    }

    element.className = `notice notice-${type}`;
    element.textContent = message;
  }

  async function load() {
    root.innerHTML = '<p class="crud-loading">Carregando equipes e LINE...</p>';

    const results = await Promise.all([
      db.from('equipes').select('*').order('nome'),
      db.from('jogos').select('*'),
      db.from('jogadores').select('*').order('nome_completo'),
      db.from('membros_equipe').select('*').order('data_inicio', { ascending: false })
    ]);

    const failed = results.find(result => result.error);

    if (failed) {
      root.innerHTML = `
        <p class="notice notice-error">
          Erro ao carregar: ${esc(failed.error.message)}.
          Verifique os nomes das tabelas e colunas no Supabase.
        </p>
        <button id="retry" class="btn">Tentar novamente</button>
      `;

      root.querySelector('#retry').onclick = load;
      return;
    }

    [teams, games, players, members] = results.map(result => result.data || []);
    render();
  }

  const gameName = id =>
    games.find(game => String(game.id) === String(id))?.nome ||
    games.find(game => String(game.id) === String(id))?.nome_jogo ||
    '—';

  const playerName = id => {
    const player = players.find(item => String(item.id) === String(id));
    return player ? (player.apelido || player.nome_completo) : 'Jogador';
  };

  function render() {
    root.innerHTML = `
      <div class="crud-tabs">
        <button class="crud-tab ${tab === 'teams' ? 'active' : ''}" data-tab="teams">
          Equipes
        </button>
        <button class="crud-tab ${tab === 'line' ? 'active' : ''}" data-tab="line">
          LINE / Escalações
        </button>
      </div>
      <div id="content"></div>
    `;

    root.querySelectorAll('[data-tab]').forEach(button => {
      button.onclick = () => {
        tab = button.dataset.tab;
        render();
      };
    });

    const content = root.querySelector('#content');

    if (tab === 'teams') {
      renderTeams(content);
    } else {
      renderLine(content);
    }
  }

  function renderTeams(content) {
    content.innerHTML = `
      <div class="crud-toolbar">
        <input id="search-team" class="field" placeholder="Buscar equipe">
        <button id="new-team" class="btn btn-primary">+ Nova equipe</button>
      </div>

      <div class="team-grid">
        ${
          teams.length
            ? teams.map(team => `
              <article class="team-card">
                <span class="status-pill ${team.status === 'ativa' ? 'is-active' : 'is-inactive'}">
                  ${esc(team.status || 'ativa')}
                </span>

                <h3>${esc(team.nome)}</h3>
                <p>${esc(gameName(team.jogo_id))} · ${esc(team.categoria || 'Sem categoria')}</p>

                <div class="team-card-meta">
                  <span>LINE ativa</span>
                  <strong>
                    ${members.filter(member =>
                      String(member.equipe_id) === String(team.id) &&
                      member.ativo
                    ).length} jogador(es)
                  </strong>
                </div>

                <div class="form-actions">
                  <button class="btn btn-small" data-edit="${esc(team.id)}">Editar</button>
                  <button class="btn btn-primary btn-small" data-line="${esc(team.id)}">
                    Gerenciar LINE
                  </button>
                </div>
              </article>
            `).join('')
            : '<p>Nenhuma equipe cadastrada.</p>'
        }
      </div>

      <div id="team-form-slot"></div>
    `;

    content.querySelector('#new-team').onclick = () => teamForm();

    content.querySelector('#search-team').oninput = event => {
      const query = event.target.value.toLowerCase();

      content.querySelectorAll('.team-card').forEach(card => {
        card.hidden = !card.textContent.toLowerCase().includes(query);
      });
    };

    content.querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = () => {
        teamForm(teams.find(team => String(team.id) === button.dataset.edit));
      };
    });

    content.querySelectorAll('[data-line]').forEach(button => {
      button.onclick = () => {
        selected = button.dataset.line;
        tab = 'line';
        render();
      };
    });
  }

  function teamForm(team = {}) {
    editTeam = team.id ?? null;

    const slot = root.querySelector('#team-form-slot');
    if (!slot) return;

    slot.innerHTML = `
      <form class="crud-form" id="team-form">
        <h2>${editTeam ? 'Editar equipe' : 'Nova equipe'}</h2>

        <div class="form-grid">
          <label>
            Nome da equipe *
            <input class="field" name="nome" required value="${esc(team.nome)}">
          </label>

          <label>
            Jogo
            <select class="field" name="jogo_id">
              <option value="">Selecione</option>
              ${games.map(game => `
                <option value="${esc(game.id)}"
                  ${String(team.jogo_id || '') === String(game.id) ? 'selected' : ''}>
                  ${esc(game.nome || game.nome_jogo)}
                </option>
              `).join('')}
            </select>
          </label>

          <label>
            Categoria
            <input class="field" name="categoria"
              placeholder="Principal, Academy..."
              value="${esc(team.categoria)}">
          </label>

          <label>
            Status
            <select class="field" name="status">
              <option value="ativa" ${(!team.status || team.status === 'ativa') ? 'selected' : ''}>
                Ativa
              </option>
              <option value="inativa" ${team.status === 'inativa' ? 'selected' : ''}>
                Inativa
              </option>
              <option value="encerrada" ${team.status === 'encerrada' ? 'selected' : ''}>
                Encerrada
              </option>
            </select>
          </label>

          <label class="full-field">
            Descrição
            <textarea class="field" name="descricao">${esc(team.descricao)}</textarea>
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" id="cancel-team">Cancelar</button>
          <button class="btn btn-primary" type="submit">Salvar equipe</button>
        </div>
      </form>
    `;

    slot.querySelector('#cancel-team').onclick = () => {
      editTeam = null;
      slot.innerHTML = '';
    };

    slot.querySelector('form').onsubmit = async event => {
      event.preventDefault();

      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;

      const data = Object.fromEntries(new FormData(form).entries());

      data.jogo_id ||= null;
      data.atualizado_em = new Date().toISOString();

      const result = editTeam
        ? await db.from('equipes').update(data).eq('id', editTeam)
        : await db.from('equipes').insert({
            ...data,
            criado_em: new Date().toISOString()
          });

      if (result.error) {
        notice('Erro ao salvar equipe: ' + result.error.message, 'error');
        button.disabled = false;
        return;
      }

      editTeam = null;
      await load();
      notice('Equipe salva.', 'success');
    };

    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderLine(content) {
    const choices = teams.filter(team => team.status !== 'encerrada');

    if (!selected || !choices.some(team => String(team.id) === String(selected))) {
      selected = choices[0]?.id || '';
    }

    const rows = members.filter(member =>
      String(member.equipe_id) === String(selected)
    );

    content.innerHTML = `
      <div class="crud-toolbar">
        <label>
          Equipe
          <select id="choose-team" class="field">
            ${choices.map(team => `
              <option value="${esc(team.id)}"
                ${String(team.id) === String(selected) ? 'selected' : ''}>
                ${esc(team.nome)}
              </option>
            `).join('')}
          </select>
        </label>

        <button class="btn btn-primary" id="add-member" ${selected ? '' : 'disabled'}>
          + Adicionar jogador à LINE
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
                      <button class="btn btn-small" data-edit-member="${esc(member.id)}">
                        Editar
                      </button>

                      ${
                        member.ativo
                          ? `<button class="btn btn-small btn-danger" data-end="${esc(member.id)}">Encerrar</button>`
                          : `<button class="btn btn-small" data-reactivate="${esc(member.id)}">Reativar</button>`
                      }
                    </td>
                  </tr>
                `).join('')
                : '<tr><td colspan="6" class="empty-cell">Nenhuma participação registrada nesta equipe.</td></tr>'
            }
          </tbody>
        </table>
      </div>

      <div id="member-form-slot"></div>
    `;

    content.querySelector('#choose-team').onchange = event => {
      selected = event.target.value;
      render();
    };

    content.querySelector('#add-member').onclick = () => memberForm();

    content.querySelectorAll('[data-edit-member]').forEach(button => {
      button.onclick = () => {
        memberForm(members.find(member => String(member.id) === button.dataset.editMember));
      };
    });

    content.querySelectorAll('[data-end]').forEach(button => {
      button.onclick = () => toggleMember(button.dataset.end, false);
    });

    content.querySelectorAll('[data-reactivate]').forEach(button => {
      button.onclick = () => toggleMember(button.dataset.reactivate, true);
    });
  }

  function memberForm(member = {}) {
    editMember = member.id ?? null;

    const slot = root.querySelector('#member-form-slot');
    if (!slot) return;

    const startDate = member.data_inicio || today();

    slot.innerHTML = `
      <form class="crud-form" id="member-form">
        <h2>${editMember ? 'Editar participação' : 'Adicionar à LINE'}</h2>

        <div class="form-grid">
          <label>
            Jogador ativo *
            <select class="field" name="jogador_id" required>
              <option value="">Selecione</option>
              ${players.filter(player =>
                player.status === 'ativo' ||
                String(player.id) === String(member.jogador_id)
              ).map(player => `
                <option value="${esc(player.id)}"
                  ${String(player.id) === String(member.jogador_id) ? 'selected' : ''}>
                  ${esc(player.apelido || player.nome_completo)} — ${esc(player.nome_completo)}
                </option>
              `).join('')}
            </select>
          </label>

          <label>
            Função
            <input class="field" name="funcao"
              placeholder="IGL, suporte, entry, coach..."
              value="${esc(member.funcao)}">
          </label>

          <label>
            Data de entrada *
            <input class="field" type="date" name="data_inicio"
              required value="${esc(startDate)}">
          </label>

          <label>
            Data de saída
            <input class="field" type="date" name="data_fim"
              value="${esc(member.data_fim)}"
              min="${esc(startDate)}"
              aria-describedby="data-fim-aviso">

            <span class="field-hint" id="data-fim-aviso">
              ⚠️ <strong>Atenção:</strong> a data de saída não pode ser anterior
              à data de entrada. Se o jogador ainda faz parte da LINE, deixe
              este campo vazio.
            </span>
          </label>

          <label>
            Status
            <select class="field" name="ativo">
              <option value="true" ${member.ativo !== false ? 'selected' : ''}>
                Ativo
              </option>
              <option value="false" ${member.ativo === false ? 'selected' : ''}>
                Encerrado
              </option>
            </select>
          </label>
        </div>

        <p class="muted">
          Encerrar uma participação mantém o registro para consulta histórica;
          não apaga o jogador.
        </p>

        <div class="form-actions">
          <button type="button" class="btn" id="cancel-member">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar participação</button>
        </div>
      </form>
    `;

    const form = slot.querySelector('#member-form');
    const startInput = form.elements.namedItem('data_inicio');
    const endInput = form.elements.namedItem('data_fim');

    // Mantém a data mínima de saída igual à data de entrada.
    startInput.addEventListener('change', () => {
      endInput.min = startInput.value;

      if (endInput.value && endInput.value < startInput.value) {
        endInput.setCustomValidity(
          'A data de saída não pode ser anterior à data de entrada.'
        );
      } else {
        endInput.setCustomValidity('');
      }
    });

    endInput.addEventListener('change', () => {
      if (endInput.value && endInput.value < startInput.value) {
        endInput.setCustomValidity(
          'A data de saída não pode ser anterior à data de entrada.'
        );
      } else {
        endInput.setCustomValidity('');
      }
    });

    slot.querySelector('#cancel-member').onclick = () => {
      editMember = null;
      slot.innerHTML = '';
    };

    form.onsubmit = async event => {
      event.preventDefault();

      const button = form.querySelector('[type="submit"]');
      const start = startInput.value;
      const end = endInput.value;

      // Validação antes de enviar ao Supabase.
      if (!start) {
        notice('Informe a data de entrada na equipe.', 'error');
        startInput.focus();
        return;
      }

      if (end && end < start) {
        notice(
          'A data de saída não pode ser anterior à data de entrada.',
          'error'
        );
        endInput.focus();
        return;
      }

      button.disabled = true;

      const data = Object.fromEntries(new FormData(form).entries());

      data.equipe_id = selected;
      data.ativo = data.ativo === 'true';
      data.data_fim ||= null;

      // Participação ativa não deve ter data de saída.
      if (data.ativo) {
        data.data_fim = null;
      }

      // Evita duas participações ativas do mesmo jogador na mesma equipe.
      if (
        data.ativo &&
        members.some(item =>
          item.ativo &&
          String(item.equipe_id) === String(selected) &&
          String(item.jogador_id) === String(data.jogador_id) &&
          String(item.id) !== String(editMember)
        )
      ) {
        notice(
          'Esse jogador já está ativo nesta LINE. Edite a participação existente.',
          'error'
        );
        button.disabled = false;
        return;
      }

      const result = editMember
        ? await db.from('membros_equipe').update(data).eq('id', editMember)
        : await db.from('membros_equipe').insert(data);

      if (result.error) {
        notice('Erro ao salvar participação: ' + result.error.message, 'error');
        button.disabled = false;
        return;
      }

      editMember = null;
      await load();
      tab = 'line';
      render();
      notice('LINE atualizada.', 'success');
    };

    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function toggleMember(id, active) {
    if (!confirm(active
      ? 'Reativar esta participação?'
      : 'Encerrar esta participação?')) {
      return;
    }

    const data = active
      ? { ativo: true, data_fim: null }
      : { ativo: false, data_fim: today() };

    // Confere a data de entrada antes de encerrar a participação.
    const member = members.find(item => String(item.id) === String(id));

    if (
      !active &&
      member?.data_inicio &&
      today() < member.data_inicio
    ) {
      notice(
        'Não é possível encerrar a participação com uma data anterior à entrada.',
        'error'
      );
      return;
    }

    const { error } = await db
      .from('membros_equipe')
      .update(data)
      .eq('id', id);

    if (error) {
      notice('Erro ao atualizar LINE: ' + error.message, 'error');
      return;
    }

    await load();
    tab = 'line';
    render();

    notice(
      active
        ? 'Participação reativada.'
        : 'Participação encerrada; histórico preservado.',
      'success'
    );
  }

  function init() {
    db = window.kaerbSupabase;

    if (!db) {
      root.innerHTML = `
        <p class="notice notice-error">
          Supabase não inicializado. Confira js/supabase-client.js.
        </p>
      `;
      return;
    }

    load();
  }

  document.addEventListener('kaerb:ready', init);

  if (window.kaerbSupabase) {
    init();
  }
})();
