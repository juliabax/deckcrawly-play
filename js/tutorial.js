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
        id: 'intro',
        kind: 'intro',
        // Cenas da abertura: fundo escuro com um "farol" no foco, e o texto digitado por cima.
        // focus: 'player' (o personagem no mapa) ou 'hand' (a mão). Um clique passa para a próxima.
        scenes: [
          { focus: 'player', lines: ['Bem-vindo à masmorra.', 'Este é você.'] },
          { focus: 'hand', lines: ['Esta é a sua mão.', 'Se as cartas acabarem, você perde. Gaste com cuidado.'] },
        ],
      },
      {
        id: 'move',
        kind: 'coach',
        wait: 'move',
        // Assim que a pessoa escolhe uma carta, o foco volta no personagem e na carta e o texto digita.
        // Não bloqueia nada: é só andar por um dos quadrados marcados.
        auto: 900, // ao concluir, o próximo passo começa sozinho depois deste tempo (ms)
        spots: [
          {
            id: 'move-card',
            trigger: 'card', // aparece quando 1 carta é escolhida
            silent: true, // enquanto espera a ação, o cartão lateral fica só com progresso e "pular"
            focus: ['player', 'card'],
            lines: ['Você pode usar uma carta para se mover. Cada número da carta é uma casa no grid.', 'Escolha um dos quadrados marcados e ande.'],
          },
        ],
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
        // Foco na porta enquanto a pessoa ainda não chegou ao lado dela; a casa ao lado pulsa no mapa.
        // Ao chegar na casa ao lado, o foco passa para o número da porta e a mão: como pagar.
        spots: [
          {
            id: 'door-away',
            trigger: 'away', // ainda não está ao lado de uma porta fechada
            pulse: 'hand', // a mão pulsa até uma carta ser escolhida
            focus: ['door', 'hand'], // a mão também: a pessoa precisa saber que são as cartas que movem
            lines: ['Para explorar a masmorra, vai ser necessário abrir as portas.', 'Chegue até a casa adjacente usando uma carta para se mover.'],
          },
          {
            id: 'door-near',
            trigger: 'near', // ao lado de uma porta fechada
            pulse: 'hand',
            compact: true, // texto menor: são 3 frases e não podem cobrir a porta
            focus: ['door', 'hand'], // a porta inteira em volta: dá para ler o número dela
            lines: [
              'Para abrir, precisamos pagar um valor igual ou maior do que a carta da porta.',
              'Podemos usar uma carta só, ou somar duas ou mais.',
              'Use sua mão para abrir essa porta!',
            ],
          },
          {
            id: 'door-open',
            trigger: 'opened', // a porta acabou de abrir (e a janela das cartas da sala já foi fechada)
            focus: ['room'], // a sala nova, com a porta aberta junto
            advance: 4500, // depois do texto inteiro digitado, o próximo passo começa sozinho (ms)
            lines: ['Porta aberta!', 'Agora você pode passar por aqui livremente.'],
          },
        ],
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
        id: 'exit',
        kind: 'coach',
        wait: 'descend', // concluído quando a pessoa desce a escada para o andar 2
        auto: 300, // o próximo passo começa sozinho (depois da janela do andar novo fechar)
        // Foco na escada (que pulsa no mapa, com uma setinha) e na mão, que paga o movimento.
        spots: [
          {
            id: 'exit-stairs',
            trigger: 'any',
            pulse: 'hand', // a mão pulsa até uma carta ser escolhida
            compact: true, // a escada fica logo abaixo do texto: letra menor para não cobrir a setinha
            focus: ['exit', 'hand'],
            lines: ['Para escapar desse andar, vá até a escada.', 'Use uma carta de movimento com valor apropriado e clique na casa da escada.'],
          },
        ],
        title: 'A escada',
        body: {
          default: `Para escapar desse andar, vá até a <b>escada ▼</b>. Escolha uma carta de movimento com valor suficiente e clique na casa da escada.`,
        },
        done: { default: `<b>Andar 2!</b>` },
      },
      {
        id: 'hearts',
        kind: 'coach',
        wait: 'power',
        waitSuit: 'H', // só conta o poder de ♥
        auto: 1200,
        // RASCUNHO dos textos: a janela do andar já entregou ♥ e ♠. A mão está curta: copas compram cartas.
        spots: [
          {
            id: 'hearts-use',
            trigger: 'suit', // a carta escolhida é de ♥
            focus: ['card', 'power', 'deck'], // o deck também: é de lá que as cartas saem
            lines: ['Copas compram cartas do deck para a sua mão.', 'O número indica o máximo de cartas compradas: respeitando o limite de 7 cartas na mão.'],
          },
          {
            id: 'hearts-pick',
            trigger: 'any',
            pulse: 'hand',
            compact: true,
            focus: ['hand', 'deck'], // o número do deck é a vida
            lines: ['Atenção: carta usada não volta! O seu deck é a sua vida, e quando ele acaba, você perde.', 'Sua mão está curta: escolha a carta de copas ♥ para comprar mais cartas.'],
          },
        ],
        title: 'Copas ♥',
        body: { default: `<b>♥ Copas</b> compram cartas. Escolha a ♥ e use o botão <b>Poder</b>, ao lado esquerdo da mão.` },
        done: { default: `<b>Isso!</b> Você comprou cartas, e a ♥ foi para o descarte. Carta usada não volta ao deck.` },
      },
      {
        id: 'suits-others',
        kind: 'intro', // um clique avança
        scenes: [
          {
            focus: 'hand',
            lines: ['Ouros ♦ dobram o alcance ao andar. Um 4♦ anda 8 casas.', 'Paus ♣ são coringas: valem o próprio número ou copiam o de outra carta.'],
          },
        ],
      },
      {
        id: 'spades',
        kind: 'intro', // um clique avança
        scenes: [
          {
            focus: 'hand',
            lines: ['Espadas ♠ são as cartas de combate: valem o dobro quando você luta.', 'E uma só espada pode derrubar várias cartas do inimigo, se o valor dobrado cobrir todas.'],
          },
        ],
      },
      {
        id: 'fight',
        kind: 'coach',
        wait: 'win', // nunca é "concluído": chegar na escada vence o treino e abre a janela de fim
        // RASCUNHO dos textos. A escada tem um inimigo ao lado: entrar na zona vermelha abre o combate (janela com a dica).
        spots: [
          {
            id: 'fight-clear',
            trigger: 'cleared', // o inimigo caiu
            focus: ['exit'],
            lines: ['Inimigo derrotado!', 'Agora a escada está livre. Vá até ela.'],
          },
          {
            id: 'fight-away',
            trigger: 'any',
            pulse: 'hand',
            focus: ['enemy', 'hand'],
            lines: ['Um inimigo guarda a escada. A zona vermelha é o alcance dele.', 'Use uma carta para entrar nela e começar o combate.'],
          },
        ],
        title: 'Inimigo',
        body: { default: `Um <b>inimigo</b> guarda a escada. Entre na <b>zona vermelha</b> com uma carta de movimento para lutar.` },
        done: { default: `<b>Você venceu!</b>` },
      },
    ],

    // Passos que saíram do roteiro enquanto o treino é refeito passo a passo (chegar na escada encerra o
    // treino, então eles não têm onde entrar). Os textos ficam aqui para serem reaproveitados depois.
    parked: [
      {
        id: 'suits',
        kind: 'modal',
        title: 'Os 4 naipes',
        body: `<p>Uma carta sozinha também pode ativar o <b>poder do naipe</b> (o número é a intensidade):</p>
          <ul>
            <li><b>♥ Copas:</b> compra até N cartas (a mão vai até 7).</li>
            <li><b>♠ Espadas:</b> em combate vale o dobro e derruba várias cartas do inimigo.</li>
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
          <p>Ao abrir a porta de uma <b>sala nova</b> você pode <b>descartar cartas</b> e <b>comprar 1</b> (sem passar de 7 na mão). Acertar a soma exata dá mais 1 de bônus.</p>
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
        body: 'Seu deck é a sua <b>vida</b> e carta usada <b>não volta</b>. Gaste com cuidado: acertar a <b>soma exata</b> compra cartas e a <b>comida</b> (Maçã e Bife) acrescenta cartas novas ao deck.',
      },
    },

    // Dicas dentro das janelas (aparecem só na primeira vez de cada tipo).
    tips: {
      chest: 'Escolha até 2 das cartas reveladas para levar. As outras voltam para o deck.',
    },

    // Dica na tela de derrota, conforme o que levou a ela (ver lossHint).
    lossHints: {
      handOut: 'Lembre-se de usar cartas de copas ♥ para repor sua mão!',
      deckOut: 'Seu deck zerou! Carta usada não volta: gaste com cuidado e procure comida (Maçã e Bife) pela masmorra.',
      flee: 'Fugir custa uma carta. Com a mão curta, vale mais contornar a zona vermelha ou lutar pela soma exata.',
      combat: 'Em combate, use espadas ♠: elas valem o dobro e uma só pode derrubar várias cartas do inimigo. A soma exata compra 1 carta!',
      fallback: 'Cada passo custa uma carta. Planeje o caminho e gaste as cartas com cuidado.',
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
      if (step.waitSuit && data.suit !== step.waitSuit) return false; // ex.: só o poder de ♠ conta
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
      const body = !step.body ? '' : typeof step.body === 'string' ? step.body : step.body[step.variant ? step.variant(ctx) : 'default'];
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

    // Dica dentro de uma janela (baú). Vale até durante os passos guiados.
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
      this.reinforces = 0;
      this.ringsFound = 0;
      this.ringsWorn = 0;
      this.ringUses = 0;
      this.ringFoodCards = 0;
      this.steaks = 0;
      this.traps = { dart: 0, back: 0 };
      this.reinforceCards = 0;
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
        case 'ring':
          this.ringsFound++;
          if (data.equipped) this.ringsWorn++;
          break;
        case 'ring-food':
          this.ringFoodCards += data.cards || 0;
          break;
        case 'ring-use':
          this.ringUses++;
          break;
        case 'trap':
          if (this.traps[data.kind] !== undefined) this.traps[data.kind]++;
          break;
        case 'reinforce':
          this.reinforces++;
          if (data.gold) this.steaks++;
          this.reinforceCards += data.cards || 0;
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
    lines.push(game.tutorial ? 'Seed: nenhuma (andar fixo do tutorial)' : `Seed: ${game.seed} (repete a mesma masmorra com ?seed=${game.seed})`);
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
    lines.push(`Pergaminhos de Inventário: ${stats.scrolls} · cartas guardadas ${stats.stashes} vezes`);
    lines.push(`Anéis: ${stats.ringsFound} achados, ${stats.ringsWorn} vestidos · no dedo no fim: ${game.rings.filter(Boolean).map((r) => DC.ROGUE.RINGS[r.ring].name).join(', ') || 'nenhum'} · usos de anel de naipe: ${stats.ringUses} · cartas do Anel da Comida: ${stats.ringFoodCards}`);
    lines.push(`Armadilhas: ${stats.traps.dart} de dardo · ${stats.traps.back} de queda`);
    lines.push(`Comida: ${stats.reinforces} (${stats.reinforces - stats.steaks} maçãs, ${stats.steaks} bifes · ${stats.reinforceCards} cartas novas no deck)`);
    lines.push(`Deck no fim, por naipe: ${['S', 'H', 'D', 'C'].map((suit) => `${DC.SUIT_SYMBOL[suit]} ${game.playerDeck.filter((c) => c.suit === suit).length + game.hand.filter((c) => c.suit === suit).length}`).join(' · ')} (deck + mão)`);
    lines.push(`Salas novas (cartas ganhas): ${stats.refills}`);
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

  // A dica certa para a tela de derrota, olhando como a partida acabou.
  function lossHint(game) {
    const h = TEXT.lossHints;
    if (game.lostBy === 'flee') return h.flee;
    if (game.lostBy === 'combat') return h.combat;
    if (!game.playerDeck.length) return h.deckOut;
    return h.handOut;
  }

  DC.TUTORIAL_TEXT = TEXT;
  DC.lossHint = lossHint;
  DC.Tutorial = Tutorial;
  DC.Stats = Stats;
  DC.buildReport = buildReport;
  DC.tutorialSummary = tutorialSummary;
})(typeof window !== 'undefined' ? window : globalThis);
