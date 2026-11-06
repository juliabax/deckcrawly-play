(function (root) {
  const DC = root.DC || (root.DC = {});

  // ---------------------------------------------------------------------------
  // Todos os textos do tutorial ficam aqui, num lugar só, para dar para editar sem
  // mexer na interface. Os textos aceitam HTML simples (<b>, <p>, <i>).
  // ---------------------------------------------------------------------------

  const TEXT = {
    // Passos guiados. "modal" ocupa a tela; "coach" fica ao lado e deixa jogar.
    // Passos com "wait" só liberam o "Próximo" depois que a pessoa faz a ação de verdade.
    steps: [
      {
        id: 'goal',
        kind: 'modal',
        title: 'Bem-vindo à masmorra!',
        body: `<p>Desça os <b>5 andares</b> até a escada de saída <b>▼</b>. As cartas são tudo o que você tem: servem para <b>andar</b>, <b>abrir portas</b> e usar <b>poderes</b>.</p>
          <p>Sua <b>vida é o deck + a mão</b>. Cada carta gasta é um pedacinho de vida, e sem nenhuma ação possível você perde.</p>
          <p class="muted">Vamos jogar de verdade: eu explico enquanto você faz. Leva uns 2 minutos.</p>`,
        next: 'Começar',
      },
      {
        id: 'move',
        kind: 'coach',
        wait: 'move',
        title: 'Andar',
        variant: (c) => (c.selected ? 'picked' : 'idle'),
        body: {
          idle: `Cada carta da sua mão é um <b>movimento</b>. Escolha <b>1 carta</b> lá embaixo.<br><span class="muted">O número é o alcance máximo em casas (A=1 … J=11, Q=12, K=13), só na vertical e na horizontal.</span>`,
          picked: `Agora clique numa <b>casa dourada</b> do mapa para andar até lá.<br><span class="muted">Dá para ir menos longe do que o número da carta, mas o que sobrar se perde.</span>`,
        },
        done: { default: `<b>Isso!</b> A carta usada foi para o <b>descarte</b>. Cada passo custa uma carta, então pense onde vale a pena gastar.` },
      },
      {
        id: 'door',
        kind: 'coach',
        wait: 'open',
        title: 'Portas',
        variant: (c) => (c.adjacent ? (c.selected ? 'pay' : 'pick') : 'approach'),
        body: {
          approach: `Chegou a hora de abrir uma <b>porta</b>. Ande até ficar <b>ao lado</b> de uma (o cartãozinho pendurado mostra o custo).<br><span class="muted">As portas piscam no mapa.</span>`,
          pick: `Você está ao lado de uma porta. Escolha cartas da mão cuja <b>soma</b> seja <b>pelo menos o custo</b> dela.`,
          pay: `Agora clique na <b>porta</b> para pagar com as cartas escolhidas.<br><span class="muted">Soma <b>exata</b> compra +1 carta de graça. Soma maior só abre.</span>`,
        },
        done: {
          door: `<b>Porta aberta!</b> As cartas gastas foram para o descarte. Se a soma foi exata você ganhou +1 carta de bônus.`,
          chest: `<b>Baú aberto!</b> Funciona como uma porta: você paga o custo com a soma das cartas.`,
        },
      },
      {
        id: 'suits',
        kind: 'modal',
        title: 'Os 4 naipes',
        body: `<p>Uma carta sozinha também pode ativar o <b>poder do naipe</b> (o número é a intensidade):</p>
          <ul>
            <li><b>♥ Copas:</b> devolve N cartas do descarte para o deck (mais vida!).</li>
            <li><b>♠ Espadas:</b> compra até N cartas (a mão vai até 5).</li>
            <li><b>♦ Ouros:</b> ao andar, o número vale em <b>dobro</b>.</li>
            <li><b>♣ Paus:</b> <b>coringa</b>. Vale o próprio número ou copia o de outra carta da mão.</li>
          </ul>
          <p class="muted">Escolha a carta e use o botão <b>Poder</b> que aparece ao lado esquerdo da mão.</p>`,
        next: 'Próximo',
      },
      {
        id: 'fog',
        kind: 'modal',
        title: 'Salas novas e névoa',
        body: `<p>Você só enxerga as salas que já abriu. A escada <b>▼</b> está escondida: é preciso explorar, mas cada carta gasta é vida.</p>
          <p>Ao abrir a porta de uma <b>sala nova</b> você pode <b>descartar cartas</b> e <b>comprar 1</b> (sem passar de 5 na mão). Acertar a soma exata dá mais 1 de bônus.</p>
          <p>Ao lado da mão você tem <b>1 slot de inventário</b> de brinde: escolha 1 carta e clique no slot para <b>guardá-la</b> em vez de gastá-la (clique nela para pegar de volta).</p>
          <p>Dentro das salas pode haver <b>inimigos</b> (zona vermelha) e <b>baús</b>. A gente te avisa na hora. Boa sorte!</p>
          <p class="muted">Dá para rever tudo pelo botão <b>Como jogar</b>, e as regras completas ficam em <b>Regras</b>.</p>`,
        next: 'Jogar!',
      },
    ],

    // Dicas de uma vez só: aparecem num cartão ao lado quando a situação acontece.
    hints: {
      start: { title: 'Sua vez', body: 'Escolha <b>1 carta</b> da mão e clique numa <b>casa dourada</b> para andar.' },
      door: {
        title: 'Uma porta!',
        body: 'Escolha cartas da mão cuja <b>soma</b> seja pelo menos o custo da porta e clique nela. Soma <b>exata</b> compra +1 carta.',
      },
      zone: {
        title: 'Zona vermelha',
        body: 'Um <b>inimigo</b> guarda esta sala. Se o seu caminho entrar na zona vermelha, o movimento é cortado e começa um <b>combate</b>. Dá para contornar, mas algumas zonas trancam a sala inteira.',
      },
      scroll: {
        title: 'Pergaminho de Inventário',
        body: 'Você abriu mais um <b>slot</b> ao lado da mão para <b>guardar cartas</b> sem descartá-las. Escolha 1 carta e clique num slot livre; clique na carta guardada para pegar de volta.',
      },
      lowdeck: {
        title: 'Deck acabando',
        body: 'Seu deck é a sua <b>vida</b>. Gaste cartas com cuidado: <b>♥</b> devolve cartas do descarte e acertar a <b>soma exata</b> compra cartas.',
      },
    },

    // Dicas dentro das janelas (aparecem só na primeira vez de cada tipo).
    tips: {
      refill: 'Descartar é opcional, mas com a mão cheia (5) é preciso descartar para comprar. Descarte só o que não ajuda: cartas descartadas só voltam com <b>♥</b>.',
      combat: 'Derrube as cartas do inimigo usando cartas da mão cuja soma seja pelo menos o custo. Uma carta está <b>virada de costas</b> e só aparece depois. <b>Fugir custa 1 carta</b> (e se for a última, você perde).',
      chest: 'Escolha até 2 das cartas reveladas para levar. As outras voltam para o deck.',
    },

    notice: 'O Deck Crawly é melhor no <b>computador ou tablet</b>. Em telas pequenas as cartas ficam apertadas.',

    // Perguntas opcionais no fim da partida (as respostas vão junto no relatório).
    questions: [
      { id: 'confuso', label: 'O que foi confuso?' },
      { id: 'divertido', label: 'Qual foi o melhor momento?' },
      { id: 'desistir', label: 'Em que ponto quase desistiu (ou ficou entediado)?' },
    ],
  };

  const KEY = 'deckcrawly.tutorial';
  const STEPS = TEXT.steps;

  // ---------------------------------------------------------------------------
  // Máquina de passos do tutorial. Sem nada de interface: a UI avisa o que o
  // jogador fez (note) e desenha o que a máquina manda.
  // ---------------------------------------------------------------------------

  class Tutorial {
    // storage: algo com getItem/setItem (localStorage); opcional.
    constructor(storage) {
      this.storage = storage || null;
      this.saved = this.load();
      this.active = !this.saved.guided; // primeira visita: começa o tutorial guiado
      this.index = 0;
      this.doneSteps = new Set();
      this.doneKind = null; // o que foi aberto no passo da porta: 'door' ou 'chest'
    }

    load() {
      const fresh = { guided: '', hints: true, seen: {} };
      if (!this.storage) return fresh;
      try {
        const raw = JSON.parse(this.storage.getItem(KEY) || 'null');
        if (raw && typeof raw === 'object') return { ...fresh, ...raw, seen: { ...(raw.seen || {}) } };
      } catch (e) {
        /* sem armazenamento ou dado quebrado: começa do zero */
      }
      return fresh;
    }

    save() {
      if (!this.storage) return;
      try {
        this.storage.setItem(KEY, JSON.stringify(this.saved));
      } catch (e) {
        /* vale só nesta sessão */
      }
    }

    // ----- passos guiados -----

    get steps() {
      return STEPS;
    }

    get step() {
      return this.active ? STEPS[this.index] : null;
    }

    isDone(index = this.index) {
      const step = STEPS[index];
      return Boolean(step) && (!step.wait || this.doneSteps.has(index));
    }

    get canNext() {
      return this.active && this.isDone();
    }

    get canPrev() {
      return this.active && this.index > 0;
    }

    get isLast() {
      return this.index === STEPS.length - 1;
    }

    // A pessoa fez algo no jogo. Devolve true se isso concluiu o passo atual.
    note(event, data = {}) {
      const step = this.step;
      if (!step || step.wait !== event || this.doneSteps.has(this.index)) return false;
      this.doneSteps.add(this.index);
      if (event === 'open') this.doneKind = data.kind === 'chest' ? 'chest' : 'door';
      return true;
    }

    next() {
      if (!this.canNext) return false;
      if (this.isLast) this.finish('done');
      else this.index++;
      return true;
    }

    prev() {
      if (!this.canPrev) return false;
      this.index--;
      return true;
    }

    skip() {
      if (!this.active) return false;
      this.finish('skipped');
      return true;
    }

    finish(how) {
      this.active = false;
      this.saved.guided = how;
      // O que o tutorial já ensinou não precisa virar dica de novo.
      if (how === 'done') for (const id of ['start', 'door']) this.saved.seen[id] = true;
      this.save();
    }

    // Botão "Como jogar": recomeça os passos e libera as dicas de novo.
    restart() {
      this.active = true;
      this.index = 0;
      this.doneSteps = new Set();
      this.doneKind = null;
      this.saved.hints = true;
      this.saved.seen = {};
      this.save();
    }

    // Texto do passo atual, escolhendo a variação pelo estado do jogo ({selected, adjacent}).
    text(ctx = {}) {
      const step = this.step;
      if (!step) return null;
      const body = typeof step.body === 'string' ? step.body : step.body[step.variant ? step.variant(ctx) : 'default'];
      const done = this.isDone() && step.wait;
      const doneBody = done ? step.done[this.doneKind] || step.done.default : '';
      return { id: step.id, title: step.title, body, done: Boolean(done), doneBody, kind: step.kind, next: step.next || 'Próximo' };
    }

    // ----- dicas -----

    get hintsOn() {
      return this.saved.hints;
    }

    setHints(on) {
      this.saved.hints = Boolean(on);
      this.save();
    }

    seen(id) {
      return Boolean(this.saved.seen[id]);
    }

    // Dica de cartão (de uma vez só). Fica calada durante os passos guiados.
    offer(id) {
      const hint = TEXT.hints[id];
      if (!hint || this.active || !this.saved.hints || this.saved.seen[id]) return null;
      this.saved.seen[id] = true;
      this.save();
      return { id, ...hint };
    }

    // Dica dentro de uma janela (reposição, combate, baú). Vale até durante os passos guiados.
    tip(id) {
      const text = TEXT.tips[id];
      if (!text || !this.saved.hints || this.saved.seen['tip-' + id]) return '';
      this.saved.seen['tip-' + id] = true;
      this.save();
      return text;
    }
  }

  // ---------------------------------------------------------------------------
  // Números da partida para o relatório de playtest.
  // ---------------------------------------------------------------------------

  class Stats {
    constructor(now = Date.now()) {
      this.startedAt = now;
      this.moves = 0;
      this.stepsWalked = 0;
      this.doors = 0;
      this.chests = 0;
      this.exact = 0;
      this.refills = 0;
      this.combats = 0;
      this.attacks = 0;
      this.victories = 0;
      this.flees = 0;
      this.stashes = 0;
      this.scrolls = 0;
      this.helps = 0;
      this.powers = { H: 0, S: 0, D: 0, C: 0 };
      this.rejects = 0;
      this.rejectMessages = {};
    }

    note(event, data = {}) {
      switch (event) {
        case 'move':
          this.moves++;
          this.stepsWalked += data.steps || 0;
          if (data.suit === 'D') this.powers.D++; // andar com ♦ é o poder do ♦
          break;
        case 'open':
          if (data.kind === 'chest') this.chests++;
          else this.doors++;
          if (data.exact) this.exact++;
          break;
        case 'refill':
          this.refills++;
          break;
        case 'power':
          if (this.powers[data.suit] !== undefined) this.powers[data.suit]++;
          break;
        case 'combat':
          this.combats++;
          break;
        case 'attack':
          this.attacks++;
          if (data.exact) this.exact++;
          if (data.victory) this.victories++;
          break;
        case 'flee':
          this.flees++;
          break;
        case 'stash':
          this.stashes++;
          break;
        case 'scroll':
          this.scrolls++;
          break;
        case 'help':
          this.helps++;
          break;
        case 'reject':
          this.rejects++;
          if (data.message) this.rejectMessages[data.message] = (this.rejectMessages[data.message] || 0) + 1;
          break;
      }
    }
  }

  const RESULT = { won: 'VENCEU (escapou da masmorra)', lost: 'PERDEU (sem ações possíveis)', playing: 'em andamento' };

  function duration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
  }

  // Texto pronto para colar numa conversa. env: { now, screen, touch, tutorial, notes }.
  function buildReport(game, stats, env = {}) {
    const now = env.now === undefined ? Date.now() : env.now;
    const p = stats.powers;
    const lines = [];
    lines.push('DECK CRAWLY — relatório de playtest');
    lines.push(`Seed: ${game.seed} (repete a mesma masmorra com ?seed=${game.seed})`);
    lines.push(`Resultado: ${RESULT[game.status] || game.status}`);
    lines.push(`Andar: ${game.floorNo} de ${game.config.floors}`);
    lines.push(`Tempo: ${duration(now - stats.startedAt)}`);
    lines.push(
      `Cartas no fim: deck ${game.playerDeck.length} · mão ${game.hand.length} · guardadas ${game.stash.length} · descarte ${game.discard.length}`,
    );
    lines.push(
      `Cartas gastas: ${game.discard.length} no descarte (${stats.moves} movimentos de ${stats.stepsWalked} casas, ${stats.doors} portas, ${stats.chests} baús)`,
    );
    lines.push(`Somas exatas: ${stats.exact}`);
    lines.push(`Combates: ${stats.combats} (${stats.victories} vitórias, ${stats.flees} fugas, ${stats.attacks} ataques)`);
    lines.push(`Poderes: ♥ ${p.H} · ♠ ${p.S} · ♦ ${p.D} · ♣ ${p.C}`);
    lines.push(`Pergaminhos: ${stats.scrolls} · cartas guardadas ${stats.stashes} vezes`);
    lines.push(`Reposições de mão: ${stats.refills}`);
    lines.push(`Abriu as Regras: ${stats.helps} vezes`);
    const msgs = Object.entries(stats.rejectMessages).sort((a, b) => b[1] - a[1]);
    lines.push(`Jogadas recusadas: ${stats.rejects}`);
    for (const [msg, n] of msgs.slice(0, 5)) lines.push(`  - ${n}× ${msg}`);
    if (env.tutorial) lines.push(`Tutorial: ${env.tutorial}`);
    if (env.screen) lines.push(`Tela: ${env.screen}${env.touch ? ' (toque)' : ''}`);
    const notes = (env.notes || []).filter((n) => n && n.answer && n.answer.trim());
    if (notes.length) {
      lines.push('');
      lines.push('Respostas:');
      for (const n of notes) lines.push(`- ${n.label} ${n.answer.trim()}`);
    }
    return lines.join('\n');
  }

  // Resumo de como foi o tutorial, para o relatório.
  function tutorialSummary(tutor) {
    if (tutor.active) return `em andamento (passo ${tutor.index + 1} de ${STEPS.length}: ${STEPS[tutor.index].id})`;
    if (tutor.saved.guided === 'skipped') return 'pulado';
    if (tutor.saved.guided === 'done') return 'concluído';
    return 'não iniciado';
  }

  DC.TUTORIAL_TEXT = TEXT;
  DC.Tutorial = Tutorial;
  DC.Stats = Stats;
  DC.buildReport = buildReport;
  DC.tutorialSummary = tutorialSummary;
})(typeof window !== 'undefined' ? window : globalThis);
