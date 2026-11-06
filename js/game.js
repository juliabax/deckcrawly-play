(function (root) {
  const DC = (root.DC = root.DC || {});

  const DEFAULT_CONFIG = {
    floors: 5,
    handMax: 5,
    chestOptions: 5,
    chestPicks: 2,
    refillDraw: 1, // cartas compradas ao entrar numa sala nova (sempre respeitando handMax)
    roomsMin: 4,
    roomsMax: 6,
    loops: 1,
    // Inimigos: gastam as cartas que sobram no deck da dungeon depois das portas e dos baús.
    enemyCards: 2, // cartas de um inimigo comum (cada uma funciona como o custo de uma porta)
    enemyDeepCards: 3, // cartas de um inimigo dos andares mais fundos
    enemyDeepFloor: 4, // a partir deste andar aparecem os de enemyDeepCards
    enemyMaxPerFloor: 3, // no máximo tantos inimigos por andar
    enemyShare: 1, // fração das sobras do deck da dungeon que vira inimigos (1 = todas)
    enemyRamp: 9, // mistura das cartas entre os andares: 0 = os andares de cima só pegam as mais baixas; quanto maior, mais misturado
    enemyRange: 1, // zona de ataque: casas em cruz ao redor dele
    enemyWideChance: 0.3, // chance de um inimigo ter o alcance maior (enemyWideRange) e tentar trancar a sala
    enemyWideRange: 2,
    enemyHidden: 1, // cartas do inimigo viradas de costas (aparecem quando você derruba outra)
    // Pergaminho de Inventário: cada um abre 1 slot ao lado da mão, onde se guardam cartas.
    maxSlots: 3,
    startSlots: 1, // slots de inventário já liberados no começo (de brinde)
    maxItems: 3, // espaços da bolsa de poções e pergaminhos (experimento Rogue)
    itemDropChance: 0.35, // chance de um inimigo derrotado deixar um item
    abilityChance: [0.2, 0.5], // chance de um inimigo ter habilidade: no andar 1 e do andar 2 em diante
    scrollChance: 0.3, // chance de um inimigo (no lugar da carta de vitória) ou de um baú (no lugar das cartas) dar um pergaminho
  };

  // Mão e custo da porta do andar de treino (ids do deck: p = jogador, d = dungeon).
  const TUTORIAL_HAND = ['pS5', 'pD4', 'pH3', 'pC6', 'pS2'];
  const TUTORIAL_DOOR = 'dC7';
  // Andar 2 do treino: a mão, as cartas que saem do deck (na ordem), o descarte e o inimigo da escada.
  // Ao descer, o jogo ganha ♠3 e ♥2 (a janela do andar), usa o ♠ para comprar ♥9 e ♠5, e só então luta.
  const TUTORIAL2_HAND = ['pD4', 'pC3'];
  const TUTORIAL2_TOP = ['pS3', 'pH2', 'pH9', 'pS5'];
  const TUTORIAL2_DISCARD = ['pS6', 'pD7', 'pC8', 'pH5'];
  const TUTORIAL2_ENEMY = ['dS5', 'dH3']; // a última começa virada de costas

  const fail = (error) => ({ ok: false, error });

  class Game {
    constructor(opts = {}) {
      this.tutorial = Boolean(opts.tutorial); // andar fixo de treino, sem seed
      this.config = Object.assign({}, DEFAULT_CONFIG, opts.config, this.tutorial ? { floors: 2 } : null);
      this.seed = this.tutorial ? 0 : opts.seed !== undefined && opts.seed !== null ? opts.seed : Math.floor(Math.random() * 1e9);
      this.rng = DC.makeRng(this.seed);

      // Dois decks separados: o do jogador (vida + mão) e o da dungeon.
      this.playerDeck = this.rng.shuffle(DC.makeDeck('p'));
      this.dungeonDeck = this.rng.shuffle(DC.makeDeck('d'));
      this.hand = [];
      this.discard = [];
      this.slotsOpen = Math.min(this.config.startSlots, this.config.maxSlots); // slots liberados: o de brinde mais os dos pergaminhos (até maxSlots)
      this.stash = []; // cartas guardadas nos slots
      this.jokerCopy = {};

      // Experimento Rogue: bolsa de itens de uso único, com aparência sorteada por seed e só descoberta ao usar.
      this.itemRng = DC.makeRng(`${this.seed}:rogue`); // sorteio à parte: não muda a masmorra de quem não usa
      this.items = [];
      this.itemCount = 0;
      this.identified = new Set();
      this.mapped = new Set(); // andares revelados por um pergaminho de mapa
      this.freeMove = false; // poção de velocidade: o próximo movimento não gasta carta
      this.looks = {};
      for (const kind of Object.keys(DC.ROGUE.LOOKS)) {
        const keys = Object.keys(DC.ROGUE.ITEMS).filter((k) => DC.ROGUE.ITEMS[k].kind === kind);
        const looks = this.itemRng.shuffle(DC.ROGUE.LOOKS[kind].slice());
        keys.forEach((k, i) => (this.looks[k] = looks[i % looks.length]));
      }

      this.status = 'playing'; // playing | won | lost
      this.pending = null; // { type: 'refill' | 'chest' | 'combat', ... }
      this.logs = [];
      this.floorNo = 0;
      this.floors = []; // todos os andares, gerados no começo do jogo
      this.floor = null;
      this.player = null;
      this.visited = new Set();

      if (this.tutorial) {
        this.arrangeTutorial();
      } else {
        this.draw(this.config.handMax);
        this.generateDungeon();
      }
      this.log(`Você compra ${this.hand.length} cartas para começar.`);
      this.startFloor(1);
    }

    // Tutorial: mão combinada, o andar fixo e uma porta que custa 7 (dá para pagar com 3+4 ou 5+2).
    arrangeTutorial() {
      const take = (deck, id) => deck.splice(deck.findIndex((c) => c.id === id), 1)[0];
      for (const id of TUTORIAL_HAND) this.hand.push(take(this.playerDeck, id));
      const cost = take(this.dungeonDeck, TUTORIAL_DOOR);
      const foe = TUTORIAL2_ENEMY.map((id) => take(this.dungeonDeck, id));
      this.floors = [DC.tutorialFloor(cost), DC.tutorialFloor2(foe)];
    }

    // Ao descer para o andar 2 do treino, a mão, o deck e o descarte voltam ao combinado (não importa
    // como a pessoa jogou o andar 1): mão curta, descarte com o que o ♥ devolver e as cartas certas no topo.
    arrangeTutorialFloor2() {
      const all = [...this.hand, ...this.playerDeck, ...this.discard, ...this.stash];
      this.stash = [];
      this.jokerCopy = {};
      const take = (id) => all.splice(all.findIndex((c) => c.id === id), 1)[0];
      this.hand = TUTORIAL2_HAND.map(take);
      const top = TUTORIAL2_TOP.map(take);
      this.discard = TUTORIAL2_DISCARD.map(take);
      this.playerDeck = [...all, ...top.reverse()]; // o fim da lista é o topo do deck
    }

    log(text, kind = 'info') {
      this.logs.push({ text, kind });
    }

    // ---------- decks ----------

    draw(count) {
      let drawn = 0;
      while (drawn < count && this.hand.length < this.config.handMax && this.playerDeck.length) {
        this.hand.push(this.playerDeck.pop());
        drawn++;
      }
      return drawn;
    }

    dungeonDraw() {
      if (!this.dungeonDeck.length) {
        this.dungeonDeck = this.rng.shuffle(DC.makeDeck('d'));
        this.log('O deck da dungeon acabou e foi reembaralhado.');
      }
      return this.dungeonDeck.pop();
    }

    // Gera a masmorra inteira no começo: primeiro as portas e os baús de todos os andares (que
    // pagam seus custos com cartas do deck da dungeon) e depois, com o que sobrou do deck,
    // os inimigos. Assim a dungeon sempre cobra, no total, o valor de um deck completo.
    generateDungeon() {
      this.floors = [];
      for (let n = 1; n <= this.config.floors; n++) {
        this.floors.push(DC.generateFloor(this.rng, this.config, () => this.dungeonDraw()));
      }
      this.planEnemies();
      this.planScrolls();
    }

    // Sorteia (pela seed) quais inimigos e baús guardam um Pergaminho de Inventário.
    planScrolls() {
      for (const floor of this.floors) {
        for (const enemy of floor.enemies) enemy.scroll = this.rng.next() < this.config.scrollChance;
        for (const chest of floor.chests) chest.scroll = this.rng.next() < this.config.scrollChance;
      }
    }

    // Entrega um pergaminho (mais um slot). Falso se os slots já estão no máximo: aí quem
    // o guardava dá a recompensa normal.
    grantScroll() {
      if (this.slotsOpen >= this.config.maxSlots) return false;
      this.slotsOpen++;
      this.log(`Pergaminho de Inventário! Você ganha um slot (${this.slotsOpen}/${this.config.maxSlots}).`, 'good');
      return true;
    }

    // Distribui as sobras do deck da dungeon em inimigos. As cartas mais baixas vão para os
    // andares de cima e as mais altas para os de baixo (a dificuldade sobe sozinha); os
    // andares mais fundos têm os inimigos de 3 cartas e recebem inimigos primeiro.
    planEnemies() {
      const cfg = this.config;
      const wide = { range: cfg.enemyWideRange, chance: cfg.enemyWideChance };
      const spots = this.floors.map((f) => DC.placeEnemies(this.rng, f, cfg.enemyMaxPerFloor, cfg.enemyRange, wide));
      const sizeAt = (floorNo) => (floorNo >= cfg.enemyDeepFloor ? cfg.enemyDeepCards : cfg.enemyCards);

      const budget = Math.floor(this.dungeonDeck.length * cfg.enemyShare);
      // Cada carta ganha uma folga aleatória no ordenamento (enemyRamp): a dificuldade sobe com o
      // andar, mas sem os extremos de só ases e 2 em cima e só reis embaixo.
      const pool = this.rng
        .shuffle(this.dungeonDeck.slice())
        .slice(0, budget)
        .map((card) => ({ card, key: card.rank + (this.rng.next() * 2 - 1) * cfg.enemyRamp }))
        .sort((a, b) => a.key - b.key)
        .map((item) => item.card);

      // Quantos inimigos, e de quantas cartas, em cada andar: rodadas do andar mais fundo ao mais raso.
      const sizes = this.floors.map(() => []);
      let left = pool.length;
      const round = (size) => {
        let placed = false;
        for (let i = this.floors.length - 1; i >= 0; i--) {
          const cards = size(i + 1);
          if (sizes[i].length < spots[i].length && left >= cards) {
            sizes[i].push(cards);
            left -= cards;
            placed = true;
          }
        }
        return placed;
      };
      while (round(sizeAt)) {
        /* repete até não caber mais */
      }
      while (round(() => cfg.enemyCards)) {
        /* sobras pequenas viram inimigos de 2 cartas onde ainda houver lugar */
      }

      const used = new Set();
      this.floors.forEach((floor, i) => {
        floor.enemies = sizes[i].map((size, id) => {
          const cards = pool.splice(0, size);
          cards.forEach((c) => used.add(c.id));
          return {
            id,
            ...spots[i][id],
            kind: size >= cfg.enemyDeepCards ? ['skeleton2', 'vampire'][(i + id) % 2] : 'skeleton1', // só aparência
            cards,
            hidden: this.hiddenCards(cards),
            down: [],
            dead: false,
          };
        });
      });
      this.dungeonDeck = this.dungeonDeck.filter((c) => !used.has(c.id));

      // Experimento Rogue: alguns inimigos têm uma habilidade (sorteio à parte, pela seed).
      const rng = DC.makeRng(`${this.seed}:abilities`);
      const kinds = Object.keys(DC.ROGUE.ABILITIES);
      this.floors.forEach((floor, i) => {
        for (const enemy of floor.enemies) {
          const chance = cfg.abilityChance[Math.min(i, cfg.abilityChance.length - 1)];
          enemy.ability = rng.next() < chance ? rng.pick(kinds) : null;
        }
      });
    }

    // Cartas da dungeon que ainda cobram algo: portas e baús fechados e cartas de inimigos de pé.
    dungeonRemaining() {
      let n = 0;
      for (const f of this.floors) {
        n += f.doors.filter((d) => !d.open).length + f.chests.filter((c) => !c.open).length;
        for (const e of f.enemies) if (!e.dead) n += e.cards.length - e.down.length;
      }
      return n;
    }

    // Ids das cartas do inimigo que começam viradas de costas (sempre sobra ao menos uma à vista).
    hiddenCards(cards) {
      const count = Math.min(this.config.enemyHidden, cards.length - 1);
      if (count <= 0) return [];
      return this.rng.shuffle(cards.slice()).slice(0, count).map((c) => c.id);
    }

    startFloor(n) {
      this.floorNo = n;
      this.floor = this.floors[n - 1];
      this.player = { x: this.floor.start.x, y: this.floor.start.y };
      this.visited = new Set([this.floor.grid[this.player.y][this.player.x].room]);
      if (n > 1) {
        // No treino, o andar 2 dá 2 cartas (♠ e ♥) para a pessoa aprender os poderes.
        if (this.tutorial) this.arrangeTutorialFloor2();
        this.pending = { type: 'refill', reason: 'floor', bonus: 0, draws: this.tutorial ? 2 : this.config.refillDraw };
        this.log(`Você desce para o andar ${n}.`, 'good');
      } else {
        this.log('Você entra na masmorra. Ache a escada de saída!', 'good');
      }
    }

    // ---------- valores das cartas ----------

    // Coringa (♣): vale o próprio número, a não ser que o jogador escolha copiar
    // o rank de outra carta da mão.
    jokerTarget(card) {
      const targetId = this.jokerCopy[card.id];
      if (!targetId || targetId === card.id) return null;
      return this.hand.find((c) => c.id === targetId) || null;
    }

    // targetId vazio volta o coringa para o próprio número.
    setJoker(jokerId, targetId) {
      if (targetId) this.jokerCopy[jokerId] = targetId;
      else delete this.jokerCopy[jokerId];
    }

    // Esquece escolhas cujo coringa ou carta copiada já saiu da mão.
    pruneJokers() {
      for (const [jokerId, targetId] of Object.entries(this.jokerCopy)) {
        const inHand = (id) => this.hand.some((c) => c.id === id);
        if (!inHand(jokerId) || !inHand(targetId)) delete this.jokerCopy[jokerId];
      }
    }

    cardValue(card) {
      let value = card.rank;
      if (card.suit === 'C') {
        const target = this.jokerTarget(card);
        if (target) value = target.rank;
      }
      return this.rusted() ? Math.max(1, value - 1) : value;
    }

    // Combatendo um inimigo de Ferrugem, todas as cartas valem −1.
    rusted() {
      const enemy = this.pending && this.pending.type === 'combat' ? this.combatEnemy() : null;
      return Boolean(enemy) && enemy.ability === 'rust';
    }

    // ♦ dobra o número ao andar.
    walkRange(card) {
      const value = this.cardValue(card);
      return card.suit === 'D' ? value * 2 : value;
    }

    handCards(ids) {
      const cards = [];
      for (const id of ids) {
        const card = this.hand.find((c) => c.id === id);
        if (!card || cards.includes(card)) return null;
        cards.push(card);
      }
      return cards;
    }

    selectionSum(ids) {
      const cards = this.handCards(ids);
      return cards ? cards.reduce((sum, c) => sum + this.cardValue(c), 0) : 0;
    }

    // ---------- estado do jogo ----------

    canAct() {
      return this.status === 'playing' && !this.pending;
    }

    inCombat() {
      return this.status === 'playing' && Boolean(this.pending) && this.pending.type === 'combat';
    }

    // Em combate dá para escolher cartas, usar poderes, atacar e fugir.
    canFight() {
      return this.inCombat();
    }

    combatEnemy() {
      if (!this.inCombat()) return null;
      return this.floor.enemies.find((e) => e.id === this.pending.enemyId) || null;
    }

    // Com a mão vazia mas cartas nos slots ainda dá para agir: é só tirar uma carta do slot.
    // Uma carta congelada (Gelo) não conta: se só sobrou ela, não há o que fazer no combate.
    hasAnyAction() {
      const frozen = this.pending && this.pending.type === 'combat' ? this.pending.frozen : null;
      return this.hand.some((c) => c.id !== frozen) || this.stash.length > 0;
    }

    // ---------- inventário (slots do pergaminho) ----------

    // Guardar e tirar cartas é grátis e vale a qualquer momento (até em combate e nas janelas).
    canStore() {
      return this.status === 'playing';
    }

    stashCard(cardId) {
      if (!this.canStore()) return fail('Não dá para guardar cartas agora.');
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return fail('Essa carta não está na mão.');
      if (this.slotsOpen === 0) return fail('Você ainda não tem slots: ache um Pergaminho de Inventário.');
      if (this.stash.length >= this.slotsOpen) return fail('Todos os seus slots estão ocupados.');
      this.hand = this.hand.filter((c) => c !== card);
      this.stash.push(card);
      this.afterAction();
      return { ok: true };
    }

    // Uma carta guardada só é usada depois de voltar para a mão (o limite da mão continua valendo).
    unstashCard(cardId) {
      if (!this.canStore()) return fail('Não dá para pegar cartas agora.');
      const card = this.stash.find((c) => c.id === cardId);
      if (!card) return fail('Essa carta não está guardada.');
      if (this.hand.length >= this.config.handMax) return fail('Sua mão está cheia: libere um espaço antes de pegar a carta guardada.');
      this.stash = this.stash.filter((c) => c !== card);
      this.hand.push(card);
      return { ok: true };
    }

    afterAction() {
      this.pruneJokers();
      if (this.status !== 'playing' || (this.pending && this.pending.type !== 'combat')) return;
      if (!this.hasAnyAction()) {
        this.status = 'lost';
        // Como acabou, para a dica da tela de derrota: em combate, fugindo com a última carta ou simplesmente sem cartas.
        this.lostBy = this.pending && this.pending.type === 'combat' ? 'combat' : this.fled ? 'flee' : 'empty';
        this.log('Sem cartas para fazer qualquer ação. Fim de jogo.', 'bad');
      }
    }

    // ---------- andar ----------

    reachFor(cardId) {
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return null;
      return DC.reach(this.floor, this.player, this.walkRange(card));
    }

    // Corta o caminho no primeiro passo dentro da zona de ataque de um inimigo vivo.
    // Devolve o caminho que será andado e o inimigo que interrompe (ou null).
    cutPath(path) {
      for (let i = 1; i < path.length; i++) {
        const enemy = DC.enemyAt(this.floor, path[i].x, path[i].y);
        if (enemy) return { path: path.slice(0, i + 1), enemy };
      }
      return { path, enemy: null };
    }

    walk(cardId, x, y) {
      if (!this.canAct()) return fail('Não dá para andar agora.');
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return fail('Essa carta não está na mão.');
      const range = this.walkRange(card);
      if (range < 1) return fail('Essa carta não permite andar.');
      const found = DC.reach(this.floor, this.player, range);
      const node = found.get(y * this.floor.w + x);
      if (!node || node.dist < 1) return fail('Fora de alcance.');

      const { path, enemy } = this.cutPath(DC.pathTo(this.floor, found, x, y));
      const end = path[path.length - 1];
      const floorBefore = this.floor;
      if (this.freeMove) {
        // Poção de velocidade: a carta continua na mão.
        this.freeMove = false;
        this.log('Poção de velocidade: esse movimento não gastou carta.', 'good');
      } else {
        this.hand = this.hand.filter((c) => c !== card);
        this.discard.push(card);
      }
      this.player = { x: end.x, y: end.y };

      this.log(`Anda ${path.length - 1} casa(s) usando ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]}.`);

      if (enemy) {
        this.pending = { type: 'combat', enemyId: enemy.id, from: { x: path[path.length - 2].x, y: path[path.length - 2].y } };
        this.log('Um inimigo! O movimento é cortado e o combate começa.', 'bad');
        this.startCombatEffects(enemy);
        this.afterAction();
        return { ok: true, path, floorBefore, descended: false, combat: true };
      }

      let descended = false;
      if (this.floor.grid[y][x].type === 'exit') {
        descended = true;
        if (this.floorNo >= this.config.floors) {
          this.status = 'won';
          this.log('Você escapou da masmorra!', 'good');
        } else {
          this.startFloor(this.floorNo + 1);
        }
      }
      this.afterAction();
      return { ok: true, path, floorBefore, descended, combat: false };
    }

    // ---------- névoa ----------

    // Você só enxerga a sala em que está e as salas cuja porta já abriu. As
    // portas e paredes que cercam essas salas também aparecem; o que está
    // atrás de uma porta fechada continua escondido.
    isCellShown(x, y) {
      const f = this.floor;
      const cell = DC.cellAt(f, x, y);
      if (!cell || cell.type === 'void') return false;
      if (this.mapped.has(this.floorNo)) return true; // pergaminho de mapa
      const seen = (id) => id !== null && this.visited.has(id);

      if (cell.type === 'door') {
        const door = f.doors[cell.ref];
        return seen(door.a) || seen(door.b);
      }
      if (cell.type !== 'wall') return seen(cell.room);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const near = DC.cellAt(f, x + dx, y + dy);
          if (near && near.type !== 'wall' && near.type !== 'door' && near.type !== 'void' && seen(near.room)) return true;
        }
      }
      return false;
    }

    // ---------- abrir portas e baús ----------

    adjacentTargets() {
      return DC.adjacentTargets(this.floor, this.player);
    }

    open(x, y, cardIds) {
      if (!this.canAct()) return fail('Não dá para abrir agora.');
      const target = this.adjacentTargets().find((t) => t.x === x && t.y === y);
      if (!target) return fail('Fique ao lado de uma porta ou baú fechado.');
      const cards = this.handCards(cardIds);
      if (!cards || !cards.length) return fail('Escolha cartas da mão.');

      const cost = target.obj.cost.rank;
      const sum = cards.reduce((total, c) => total + this.cardValue(c), 0);
      if (sum < cost) return fail(`Faltam ${cost - sum} para abrir (custo ${cost}).`);

      const exact = sum === cost;
      this.hand = this.hand.filter((c) => !cards.includes(c));
      this.discard.push(...cards);
      target.obj.open = true;

      // A compra da sala nova acontece logo depois de abrir a porta que dá numa sala ainda não
      // visitada, antes mesmo de você entrar nela.
      let newRoom = false;
      if (target.kind === 'door') {
        const here = this.floor.grid[this.player.y][this.player.x].room;
        const ahead = target.obj.a === here ? target.obj.b : target.obj.a;
        if (!this.visited.has(ahead)) {
          this.visited.add(ahead);
          newRoom = true;
        }
      }

      const label = target.kind === 'door' ? 'a porta' : 'o baú';
      let drawn = 0;
      let bonus = 0; // carta de graça da soma exata que fica para a janela da sala nova
      if (exact) {
        if (newRoom) {
          bonus = 1;
          this.log(`Soma exata! Abre ${label} e ganha uma carta de graça.`, 'good');
        } else {
          drawn = this.draw(1);
          this.log(`Soma exata! Abre ${label}${drawn ? ' e compra uma carta de graça' : ''}.`, 'good');
        }
      } else {
        this.log(`Abre ${label} gastando ${sum} (custo ${cost}), sem compra de volta.`);
      }
      if (newRoom) {
        this.pending = { type: 'refill', reason: 'door', bonus };
        this.log('Sala nova à frente! Você ganha cartas.', 'good');
      }

      let scroll = false;
      if (target.kind === 'chest' && !this.tutorial) this.dropItem();
      if (target.kind === 'chest') {
        if (target.obj.scroll && this.grantScroll()) {
          scroll = true; // o baú guarda um pergaminho no lugar das cartas
        } else {
          const pool = this.playerDeck.slice();
          this.rng.shuffle(pool);
          this.pending = { type: 'chest', options: pool.slice(0, this.config.chestOptions) };
          this.log('O baú mostra algumas cartas do seu deck. Escolha até 2.', 'good');
        }
      }
      this.afterAction();
      return { ok: true, exact, drawn, kind: target.kind, scroll };
    }

    resolveChest(pickIds, discardIds) {
      if (!this.pending || this.pending.type !== 'chest') return fail('Nenhum baú aberto.');
      const options = this.pending.options;
      const picks = pickIds.map((id) => options.find((c) => c.id === id));
      if (picks.some((c) => !c) || new Set(pickIds).size !== pickIds.length) return fail('Escolha inválida.');
      if (picks.length > this.config.chestPicks) return fail(`Escolha no máximo ${this.config.chestPicks}.`);
      const discards = this.handCards(discardIds);
      if (!discards) return fail('Descarte inválido.');
      if (this.hand.length - discards.length + picks.length > this.config.handMax) {
        return fail('Mão cheia: descarte cartas para pegar as do baú.');
      }

      this.hand = this.hand.filter((c) => !discards.includes(c));
      this.discard.push(...discards);
      this.playerDeck = this.playerDeck.filter((c) => !picks.includes(c));
      this.hand.push(...picks);
      this.pending = null;
      this.log(
        picks.length ? `Pega ${picks.length} carta(s) do baú; as outras voltam ao deck.` : 'Você deixa as cartas do baú no deck.',
      );
      this.afterAction();
      return { ok: true };
    }

    // ---------- poderes dos naipes ----------

    usePower(cardId) {
      if (!this.canAct() && !this.canFight()) return fail('Não dá para usar poderes agora.');
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return fail('Essa carta não está na mão.');
      const symbol = `${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]}`;

      if (card.suit === 'H') {
        if (!this.discard.length) return fail('O descarte está vazio.');
        const count = Math.min(card.rank, this.discard.length);
        const returned = this.rng.shuffle(this.discard.slice()).slice(0, count);
        this.discard = this.discard.filter((c) => !returned.includes(c));
        this.playerDeck.push(...returned);
        this.rng.shuffle(this.playerDeck);
        this.hand = this.hand.filter((c) => c !== card);
        this.discard.push(card);
        this.log(`${symbol}: ${count} carta(s) do descarte voltam ao deck.`, 'good');
        this.afterAction();
        return { ok: true, count };
      }

      if (card.suit === 'S') {
        if (!this.playerDeck.length) return fail('O deck está vazio.');
        this.hand = this.hand.filter((c) => c !== card);
        this.discard.push(card);
        const drawn = this.draw(card.rank);
        this.log(`${symbol}: compra ${drawn} carta(s).`, 'good');
        this.afterAction();
        return { ok: true, count: drawn };
      }

      return fail('Esse naipe não tem um poder para ativar à parte.');
    }

    // ---------- combate ----------

    // Gasta cartas da mão (soma pelo menos o custo) para derrotar UMA carta do inimigo,
    // à escolha. Soma exata compra 1 carta; derrotar a última carta é a vitória, que
    // compra mais 1 carta e tira o inimigo do mapa.
    attack(cardIds, enemyCardId) {
      if (!this.canFight()) return fail('Não há combate agora.');
      const enemy = this.combatEnemy();
      const target = enemy.cards.find((c) => c.id === enemyCardId && !enemy.down.includes(c.id));
      if (!target) return fail('Escolha uma carta do inimigo que ainda esteja de pé.');
      if (enemy.hidden && enemy.hidden.includes(target.id)) return fail('Essa carta está virada de costas: derrube a outra primeiro.');
      const cards = this.handCards(cardIds);
      if (!cards || !cards.length) return fail('Escolha cartas da mão.');
      if (this.pending.frozen && cards.some((c) => c.id === this.pending.frozen)) return fail('Essa carta está congelada até você derrubar uma carta do inimigo.');

      const cost = target.rank;
      const sum = cards.reduce((total, c) => total + this.cardValue(c), 0);
      if (sum < cost) return fail(`Faltam ${cost - sum} para derrotar essa carta (custo ${cost}).`);

      const exact = sum === cost;
      this.hand = this.hand.filter((c) => !cards.includes(c));
      this.discard.push(...cards);
      enemy.down.push(target.id);

      // Gelo: derrubar uma carta do inimigo descongela a carta da mão.
      if (this.pending.frozen) {
        const thawed = this.hand.find((c) => c.id === this.pending.frozen);
        this.pending.frozen = null;
        if (thawed) this.log(`A carta ${DC.rankLabel(thawed.rank)}${DC.SUIT_SYMBOL[thawed.suit]} descongela!`, 'good');
      }

      let drawn = 0;
      if (exact) {
        drawn = this.draw(1);
        this.log(`Soma exata! Derruba a carta ${DC.rankLabel(cost)}${drawn ? ' e compra uma carta de graça' : ''}.`, 'good');
      } else {
        this.log(`Derruba a carta ${DC.rankLabel(cost)} gastando ${sum}, sem compra de volta.`);
      }

      // Derrubar uma carta desvira as que estavam de costas.
      const revealed = enemy.hidden ? enemy.hidden.filter((id) => !enemy.down.includes(id)) : [];
      if (enemy.hidden) enemy.hidden = [];
      if (revealed.length) this.log('A carta virada do inimigo é revelada!');

      let victory = false;
      let reward = 0;
      let scroll = false;
      if (enemy.down.length === enemy.cards.length) {
        victory = true;
        enemy.dead = true;
        this.pending = null;
        this.returnLoot(enemy);
        if (!this.tutorial && this.itemRng.next() < this.config.itemDropChance) this.dropItem();
        // Às vezes o inimigo deixa um Pergaminho de Inventário no lugar da carta de recompensa.
        if (enemy.scroll && this.grantScroll()) {
          scroll = true;
          this.log('Inimigo derrotado! Ele deixa um Pergaminho de Inventário.', 'good');
        } else {
          reward = this.draw(1);
          this.log(`Inimigo derrotado!${reward ? ' Você compra uma carta pela vitória.' : ''}`, 'good');
        }
      }
      this.afterAction();
      return { ok: true, exact, drawn, victory, reward, scroll, revealed, enemyId: enemy.id, cardId: target.id };
    }

    // Foge do combate descartando 1 carta da mão (a escolhida). Volta para a casa de
    // onde veio; o inimigo continua lá, com as cartas já derrotadas ainda derrotadas.
    // Se era a última carta da mão, o jogo termina (sem cartas, sem ações).
    flee(cardId) {
      if (!this.canFight()) return fail('Não há combate agora.');
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return fail('Escolha a carta que você descarta para fugir.');
      this.hand = this.hand.filter((c) => c !== card);
      this.discard.push(card);
      this.player = { x: this.pending.from.x, y: this.pending.from.y };
      this.pending = null;
      this.log(`Você foge descartando ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]}.`);
      this.fled = true;
      this.afterAction();
      this.fled = false;
      return { ok: true, lost: this.status === 'lost' };
    }

    // ---------- experimento Rogue: habilidades dos inimigos e itens ----------

    // Efeitos que acontecem quando o combate começa.
    startCombatEffects(enemy) {
      const A = DC.ROGUE.ABILITIES;
      if (enemy.ability === 'nymph' && !enemy.loot && this.stash.length) {
        enemy.loot = this.stash.shift();
        this.log(`${A.nymph.name}: rouba a carta guardada ${DC.rankLabel(enemy.loot.rank)}${DC.SUIT_SYMBOL[enemy.loot.suit]}! Derrote-a para recuperar.`, 'bad');
      } else if (enemy.ability === 'ice' && this.hand.length > 1) {
        const card = this.itemRng.pick(this.hand);
        this.pending.frozen = card.id;
        this.log(`${A.ice.name}: ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]} fica congelada até você derrubar uma carta do inimigo.`, 'bad');
      } else if (enemy.ability === 'rust') {
        this.log(`${A.rust.name}: suas cartas valem −1 neste combate.`, 'bad');
      }
    }

    // A carta roubada pela ninfa volta (para o inventário, se couber).
    returnLoot(enemy) {
      const card = enemy.loot;
      if (!card) return;
      enemy.loot = null;
      if (this.stash.length < this.slotsOpen) this.stash.push(card);
      else if (this.hand.length < this.config.handMax) this.hand.push(card);
      else this.discard.push(card);
      this.log(`Você recupera ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]}.`, 'good');
    }

    // Sorteia um item (poção ou pergaminho) para a bolsa.
    dropItem() {
      const keys = Object.keys(DC.ROGUE.ITEMS);
      const key = this.itemRng.pick(keys);
      if (this.items.length >= this.config.maxItems) {
        this.log('Você achou um item, mas a bolsa está cheia.', 'bad');
        return null;
      }
      const item = { id: `i${++this.itemCount}`, item: key };
      this.items.push(item);
      this.log(`Você achou: ${DC.ROGUE.itemName(this, key)}.`, 'good');
      return item;
    }

    // Usa um item da bolsa (fora de combate e das janelas). Usar descobre o efeito de todos do mesmo tipo.
    useItem(itemId) {
      if (!this.canAct()) return fail('Não dá para usar itens agora.');
      const item = this.items.find((i) => i.id === itemId);
      if (!item) return fail('Esse item não está na bolsa.');
      const key = item.item;
      const first = !this.identified.has(key);
      let text;
      switch (key) {
        case 'heal': {
          const count = Math.min(3, this.discard.length);
          const returned = this.itemRng.shuffle(this.discard.slice()).slice(0, count);
          this.discard = this.discard.filter((c) => !returned.includes(c));
          this.playerDeck.push(...returned);
          this.rng.shuffle(this.playerDeck);
          text = `${count} carta(s) do descarte voltam ao deck.`;
          break;
        }
        case 'haste':
          this.freeMove = true;
          text = 'O seu próximo movimento não gasta carta.';
          break;
        case 'poison': {
          const lost = this.playerDeck.splice(Math.max(0, this.playerDeck.length - 2), 2);
          this.discard.push(...lost);
          text = `Era veneno! ${lost.length} carta(s) do deck foram para o descarte.`;
          break;
        }
        case 'map':
          this.mapped.add(this.floorNo);
          text = 'O andar inteiro aparece no mapa.';
          break;
        case 'teleport': {
          const cells = [];
          for (let y = 0; y < this.floor.h; y++) {
            for (let x = 0; x < this.floor.w; x++) {
              const cell = this.floor.grid[y][x];
              if (!['floor', 'start'].includes(cell.type) || !this.visited.has(cell.room)) continue;
              if ((x === this.player.x && y === this.player.y) || DC.enemyAt(this.floor, x, y)) continue;
              cells.push({ x, y });
            }
          }
          if (!cells.length) return fail('Não há para onde se teleportar.');
          this.player = this.itemRng.pick(cells);
          text = 'Você aparece em outro ponto de uma sala já visitada.';
          break;
        }
        default:
          return fail('Item desconhecido.');
      }
      this.items = this.items.filter((i) => i !== item);
      const name = DC.ROGUE.itemName(this, key);
      this.identified.add(key);
      this.log(`${first ? 'Você descobre: ' : ''}${DC.ROGUE.itemName(this, key)}. ${text}`, 'good');
      this.afterAction();
      return { ok: true, key, text, discovered: first, name };
    }

    // ---------- cartas da sala nova ----------

    // As cartas que a janela da sala nova vai dar, na ordem em que saem do deck: primeiro a de graça
    // da soma exata (se houver), depois a da sala. Sem descartar nada, só entra o que cabe na mão.
    // Não mexe em nada: serve para a janela mostrar as cartas antes de elas irem para a mão.
    refillPreview() {
      if (!this.pending || this.pending.type !== 'refill') return [];
      const bonus = this.pending.bonus || 0;
      const room = this.pending.draws === undefined ? this.config.refillDraw : this.pending.draws;
      const count = Math.min(bonus + room, this.config.handMax - this.hand.length, this.playerDeck.length);
      const cards = [];
      for (let i = 0; i < count; i++) {
        cards.push({ card: this.playerDeck[this.playerDeck.length - 1 - i], extra: i < bonus });
      }
      return cards;
    }

    resolveRefill() {
      if (!this.pending || this.pending.type !== 'refill') return fail('Nada para comprar.');
      const room = this.pending.draws === undefined ? this.config.refillDraw : this.pending.draws;
      const drawn = this.draw((this.pending.bonus || 0) + room);
      this.pending = null;
      this.log(`Você compra ${drawn} carta(s).`);
      this.afterAction();
      return { ok: true, drawn };
    }
  }

  DC.CONFIG = DEFAULT_CONFIG;
  DC.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
