(function (root) {
  const DC = (root.DC = root.DC || {});

  const DEFAULT_CONFIG = {
    floors: 5,
    handMax: 5,
    chestOptions: 5,
    chestPicks: 2,
    refillDraw: 1, // cartas compradas ao DESCER de andar (sempre respeitando handMax). Abrir a porta de uma sala nova não dá carta por si só
    exactBonus: 1, // cartas de graça ao abrir uma porta ou baú com soma exata
    flushBonus: 2, // ... e quando a soma exata é paga com 2 ou mais cartas do mesmo naipe
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
    enemyHidden: 1, // cartas viradas de costas num inimigo que tem carta virada (aparecem quando você derruba outra)
    enemyHiddenChance: 0.25, // chance de um inimigo ter carta virada: rara, para o ♠ ter 2 cartas à vista para atacar de uma vez
    // Pergaminho de Inventário: cada um abre 1 slot ao lado da mão, onde se guardam cartas.
    maxSlots: 3,
    startSlots: 1, // slots de inventário já liberados no começo (de brinde)
    maxItems: 3, // espaços da bolsa de poções e pergaminhos (experimento Rogue)
    itemDropChance: 0.35, // chance de um inimigo derrotado deixar um item
    abilityChance: [0.2, 0.5], // chance de um inimigo ter habilidade: no andar 1 e do andar 2 em diante
    scrollChance: 0.3, // chance de um inimigo (no lugar da carta de vitória) ou de um baú (no lugar das cartas) dar um pergaminho
    // Experimento Baralho Finito: carta gasta não volta. A comida (Maçã e Bife) acrescenta cartas NOVAS
    // (sorteadas como se saíssem de um baralho completo) em posições aleatórias do deck.
    reinforceCards: 3, // cartas da Maçã
    reinforceGoldCards: 5, // cartas do Bife
    reinforceEnemyBase: 0.1, // chance de um inimigo deixar o pergaminho: este valor mais perPoint × soma das cartas dele
    reinforceEnemyPerPoint: 0.015,
    reinforceGoldEnemy: 0.25, // chance de ser dourado, para inimigos de 3 cartas ou mais
    reinforceFloorChance: [0.8, 0.8, 0.7, 0.5, 0.4], // pergaminho no chão: chance por andar (o último valor vale para os seguintes)
    reinforceGoldFloor: 0.15,
    // Armadilhas escondidas: só aparecem quando você pisa. Cada uma dispara uma vez.
    trapsPerFloor: [1, 1, 2, 2, 2], // por andar (o último valor vale para os seguintes)
    trapBackShare: 0.4, // fração das armadilhas que mandam de volta ao andar anterior (as outras são de dardo)
    trapDartCards: 2, // cartas do deck que o dardo queima
    // Ratos: inimigos pequenos de 1 carta baixa, a mais que o deck da dungeon (que agora pode passar de 52 cartas).
    ratsMin: 2, // por andar
    ratsMax: 3,
    ratRankMax: 5, // a carta do rato vai de 1 a este valor
    ratFoodChance: 0.25, // chance de um rato derrotado deixar uma Maçã (os outros inimigos dependem das cartas deles)
    itemDropChanceSmall: 0.15, // chance de um rato deixar uma poção ou pergaminho da bolsa
    // Anéis: equipamento com 2 espaços; vêm de baús e de inimigos (mais difíceis, mais chance).
    ringSlots: 2,
    // Baús: o que custa cartas é o prêmio grande (anel ou Bife garantido); o grátis dá menos (Maçã garantida,
    // anel mais raro). `chestFreeChance` é a fração de baús destrancados, que abrem sem gastar cartas.
    chestFreeChance: 0.4,
    ringChestPaid: 0.5,
    ringChestFree: 0.25,
    ringEnemyBase: 0.04,
    ringEnemyPerPoint: 0.006,
    // Experimento Turnos (como no Rogue): andar é de graça, cada passo é um turno e os inimigos agem depois dele.
    wakeChance: 0.67, // chance de um inimigo grande acordar quando você termina um turno na zona dele (no Rogue, 2/3)
    wakeChanceSmall: 0.33, // a de um rato (dorme mais fundo)
    sightRange: 9, // até onde um inimigo acordado enxerga você (em casas, em linha reta, sem parede no meio)
    loseTrack: 3, // turnos sem te ver até ele desistir e voltar a dormir onde está
    fleeStun: 3, // turnos que o inimigo fica parado depois que você foge dele
    hasteTurns: 8, // Poção de velocidade: turnos em que os inimigos ficam parados
    // ♦ é mana: descartar um ♦ pelo poder dá mana igual ao número dele (até o teto). Os anéis gastam mana.
    manaMax: 10,
    ringUseMana: 2,
  };

  // Mão e custo da porta do andar de treino (ids do deck: p = jogador, d = dungeon).
  const TUTORIAL_HAND = ['pS5', 'pD4', 'pH3', 'pC6', 'pS2'];
  const TUTORIAL_DOOR = 'dC7';
  // Andar 2 do treino: a mão, as cartas que saem do deck (na ordem), o descarte e o inimigo da escada.
  // Ao descer, o jogo ganha ♥3 e ♠4 (a janela do andar), usa o ♥ para comprar ♠6, ♦2 e ♣8, e só então luta:
  // o ♠4 vale 8 em combate, exatamente os dois inimigos (5 + 3).
  const TUTORIAL2_HAND = ['pD4', 'pC3'];
  const TUTORIAL2_TOP = ['pH3', 'pS4', 'pS6', 'pD2', 'pC8'];
  const TUTORIAL2_DISCARD = ['pH5', 'pD7', 'pC9', 'pH8'];
  const TUTORIAL2_ENEMY = ['dS5', 'dH3']; // as duas à vista: dá para derrubar as duas de uma vez com um ♠

  const fail = (error) => ({ ok: false, error });

  // A comida que acrescenta cartas novas ao deck (experimento Baralho Finito): a comum e a dourada.
  const FOOD = {
    normal: { name: 'Maçã', a: 'uma Maçã' },
    gold: { name: 'Bife', a: 'um Bife' },
  };

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
      this.hasteTurns = 0; // Poção de velocidade: quantos turnos os inimigos ainda ficam parados
      this.looks = {};
      for (const kind of Object.keys(DC.ROGUE.LOOKS)) {
        const keys = Object.keys(DC.ROGUE.ITEMS).filter((k) => DC.ROGUE.ITEMS[k].kind === kind);
        const looks = this.itemRng.shuffle(DC.ROGUE.LOOKS[kind].slice());
        keys.forEach((k, i) => (this.looks[k] = looks[i % looks.length]));
      }

      // Experimento Baralho Finito: pergaminhos que dão cartas novas ao deck. Sorteio à parte (não muda a masmorra).
      this.reinforceRng = DC.makeRng(`${this.seed}:reinforce`);
      this.cardCount = 0; // cartas novas criadas por pergaminhos (ids únicos: o deck pode ter duplicatas)
      this.owed = []; // pergaminhos achados que esperam a janela atual fechar
      this.reinforced = 0; // total de cartas ganhas por pergaminhos (para o relatório)
      this.trapRng = DC.makeRng(`${this.seed}:traps`);
      this.hiddenRng = DC.makeRng(`${this.seed}:hidden`); // quais inimigos têm carta virada
      this.ringRng = DC.makeRng(`${this.seed}:rings`); // quais baús e inimigos deixam anel, e qual
      this.ratRng = DC.makeRng(`${this.seed}:rats`); // ratos: quantos, onde e que carta
      this.ratCount = 0;
      this.chestRng = DC.makeRng(`${this.seed}:chests`); // quais baús são destrancados (grátis)
      this.ringCount = 0;
      // Para onde as cartas vão (só para o relatório): andar, portas e baús, combate, fuga, poder do ♥, armadilhas.
      this.spent = { open: 0, attack: 0, flee: 0, power: 0, trap: 0, spadeAttack: 0, spadeOther: 0 };
      this.rings = Array(this.config.ringSlots).fill(null); // anéis no dedo: { id, ring }
      // Turnos e mana (experimento Turnos): cada passo e cada porta aberta é 1 turno.
      this.turn = 0;
      this.steps = 0; // passos dados (só para o relatório)
      this.turnsByFloor = {};
      this.mana = 0;
      this.manaGained = 0;
      this.manaSpent = 0;
      this.manaWasted = 0;
      this.wakeRng = DC.makeRng(`${this.seed}:wake`); // quem acorda a cada turno
      this.seenRooms = {}; // salas visitadas de cada andar (ao voltar de uma armadilha, o mapa continua aberto)
      this.arrived = new Set(); // andares já alcançados (só a primeira chegada dá cartas)

      this.status = 'playing'; // playing | won | lost
      this.pending = null; // { type: 'refill' | 'chest' | 'combat' | 'reinforce', ... }
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
      while (drawn < count && this.hand.length < this.handLimit() && this.playerDeck.length) {
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
      this.planReinforcements();
      this.planTraps();
      this.planChests();
      this.planRings();
      this.planRats();
      // Todo inimigo começa dormindo e parado (acorda quando você chega perto, como no Rogue).
      for (const floor of this.floors) {
        for (const enemy of floor.enemies) {
          enemy.awake = false;
          enemy.stun = 0;
          enemy.lost = 0;
        }
      }
    }

    // Acrescenta os ratos (inimigos pequenos de 1 carta) depois de tudo, com sorteio à parte: a masmorra de cada
    // seed continua igual, só ganha ratos. A carta do rato não sai do deck da dungeon.
    planRats() {
      const cfg = this.config;
      const rng = this.ratRng;
      for (const floor of this.floors) {
        const forbidden = (x, y) => (floor.pickups || []).some((p) => p.x === x && p.y === y) || (floor.traps || []).some((t) => t.x === x && t.y === y);
        const spots = DC.placeSmall(rng, floor, rng.int(cfg.ratsMin, cfg.ratsMax), cfg.enemyRange, forbidden);
        for (const spot of spots) {
          const suit = rng.pick(DC.SUITS);
          const rank = rng.int(1, cfg.ratRankMax);
          const food = rng.next() < cfg.ratFoodChance ? 'normal' : null;
          floor.enemies.push({
            id: floor.enemies.length,
            ...spot,
            kind: 'rat',
            small: true,
            cards: [{ id: `r${++this.ratCount}${suit}${rank}`, suit, rank }],
            hidden: [],
            down: [],
            dead: false,
            ability: null,
            scroll: false,
            ring: null,
            reinforce: food,
          });
        }
      }
    }

    // Sorteia (pela seed, num sorteio à parte) quais baús são destrancados: abrem de graça, sem gastar cartas
    // (a carta de custo continua saindo do deck da dungeon, então a conta do deck não muda).
    planChests() {
      for (const floor of this.floors) {
        for (const chest of floor.chests) chest.free = this.chestRng.next() < this.config.chestFreeChance;
      }
    }

    // Sorteia (pela seed, num sorteio à parte) quais baús e inimigos deixam um anel, e qual (anéis comuns saem
    // mais; o do Guerreiro, o da Mão e o do Deck são mais raros).
    planRings() {
      const cfg = this.config;
      const rng = this.ringRng;
      const rings = DC.ROGUE.RINGS;
      const keys = Object.keys(rings);
      const total = keys.reduce((n, k) => n + rings[k].weight, 0);
      const pick = () => {
        let roll = rng.next() * total;
        for (const k of keys) {
          roll -= rings[k].weight;
          if (roll < 0) return k;
        }
        return keys[keys.length - 1];
      };
      for (const floor of this.floors) {
        for (const enemy of floor.enemies) {
          const points = enemy.cards.reduce((sum, c) => sum + c.rank, 0);
          enemy.ring = rng.next() < cfg.ringEnemyBase + cfg.ringEnemyPerPoint * points ? pick() : null;
        }
        // Todo baú dá algo: o anel (mais chance se custa cartas) ou, se não for anel, comida garantida:
        // o Bife (5 cartas) no baú que custa cartas e a Maçã (3) no destrancado.
        for (const chest of floor.chests) {
          chest.ring = rng.next() < (chest.free ? cfg.ringChestFree : cfg.ringChestPaid) ? pick() : null;
          chest.reinforce = chest.ring ? null : chest.free ? 'normal' : 'gold';
        }
      }
    }

    // Sorteia (pela seed, num sorteio à parte) as armadilhas escondidas de cada andar.
    planTraps() {
      const cfg = this.config;
      const rng = this.trapRng;
      this.floors.forEach((floor, i) => {
        floor.traps = [];
        const count = cfg.trapsPerFloor[Math.min(i, cfg.trapsPerFloor.length - 1)];
        const taken = new Set((floor.pickups || []).map((p) => `${p.x},${p.y}`));
        for (let n = 0; n < count; n++) {
          const spot = DC.placePickup(rng, floor, (x, y) => taken.has(`${x},${y}`));
          if (!spot) break;
          taken.add(`${spot.x},${spot.y}`);
          // No andar 1 não há andar anterior: só dardo.
          const back = i > 0 && rng.next() < cfg.trapBackShare;
          floor.traps.push({ x: spot.x, y: spot.y, kind: back ? 'back' : 'dart', sprung: false });
        }
      });
    }

    // Sorteia (pela seed, num sorteio à parte) onde fica a comida (Maçã e Bife): com alguns inimigos
    // (quanto mais difíceis, mais chance), em alguns baús e caídos no chão de algumas salas.
    planReinforcements() {
      const cfg = this.config;
      const rng = this.reinforceRng;
      const kind = (goldChance) => (rng.next() < goldChance ? 'gold' : 'normal');
      this.floors.forEach((floor, i) => {
        for (const enemy of floor.enemies) {
          const points = enemy.cards.reduce((sum, c) => sum + c.rank, 0);
          const chance = Math.min(0.9, cfg.reinforceEnemyBase + cfg.reinforceEnemyPerPoint * points);
          enemy.reinforce = rng.next() < chance ? kind(enemy.cards.length >= cfg.enemyDeepCards ? cfg.reinforceGoldEnemy : 0) : null;
        }
        const odds = cfg.reinforceFloorChance;
        floor.pickups = [];
        if (rng.next() < odds[Math.min(i, odds.length - 1)]) {
          const spot = DC.placePickup(rng, floor);
          if (spot) floor.pickups.push({ ...spot, gold: rng.next() < cfg.reinforceGoldFloor, taken: false });
        }
      });
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
        n += f.doors.filter((d) => !d.open).length + f.chests.filter((c) => !c.open && !c.free).length;
        for (const e of f.enemies) if (!e.dead) n += e.cards.length - e.down.length;
      }
      return n;
    }

    // Ids das cartas do inimigo que começam viradas de costas (sempre sobra ao menos uma à vista).
    // Só alguns inimigos têm carta virada (enemyHiddenChance). A escolha da carta continua saindo do
    // sorteio principal e a decisão de esconder vem de um sorteio à parte: a masmorra não muda.
    hiddenCards(cards) {
      const count = Math.min(this.config.enemyHidden, cards.length - 1);
      if (count <= 0) return [];
      const ids = this.rng.shuffle(cards.slice()).slice(0, count).map((c) => c.id);
      return this.hiddenRng.next() < this.config.enemyHiddenChance ? ids : [];
    }

    startFloor(n) {
      this.floorNo = n;
      this.floor = this.floors[n - 1];
      this.player = { x: this.floor.start.x, y: this.floor.start.y };
      const first = !this.arrived.has(n);
      this.arrived.add(n);
      this.visited = this.seenRooms[n] || new Set([this.floor.grid[this.player.y][this.player.x].room]);
      this.seenRooms[n] = this.visited;
      if (!first) {
        // Voltou a um andar que já conhecia (uma armadilha mandou para trás): não ganha cartas de novo.
        this.log(`Você desce de novo para o andar ${n}.`);
      } else if (n > 1) {
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

    // Em combate, ♠ vale o dobro (depois da Ferrugem tirar 1). Fora dele vale só o número.
    attackValue(card) {
      const value = this.cardValue(card);
      return card.suit === 'S' ? value * 2 : value;
    }

    // A soma de uma jogada de combate inclui o bônus do Anel do Guerreiro. Com ♠ é a soma MAIOR (todos dobrados):
    // é a que derruba mais, mas o ♠ também pode valer só o número (veja attackSums).
    attackSum(ids) {
      const cards = this.handCards(ids);
      return cards && cards.length ? cards.reduce((sum, c) => sum + this.attackValue(c) + this.boostOf(c, 'fight'), 0) : 0;
    }

    // Todas as somas possíveis de uma jogada de combate, da menor para a maior: cada ♠ vale o número OU o dobro
    // (a vantagem do naipe: dá para casar com o valor original ou com o dobrado). Sem ♠ há uma soma só.
    attackSums(ids) {
      const cards = this.handCards(ids);
      if (!cards || !cards.length) return [0];
      let sums = new Set([0]);
      for (const c of cards) {
        const value = this.cardValue(c);
        const options = c.suit === 'S' ? [value, value * 2] : [value];
        const next = new Set();
        for (const s of sums) for (const o of options) next.add(s + o + this.boostOf(c, 'fight'));
        sums = next;
      }
      return [...sums].sort((a, b) => a - b);
    }

    // A soma para pagar portas e baús inclui o +2 que um Anel da Chave pôs em cada carta.
    payTotal(ids) {
      const cards = this.handCards(ids);
      return cards && cards.length ? cards.reduce((sum, c) => sum + this.cardValue(c) + this.boostOf(c, 'pay'), 0) : 0;
    }

    // Bônus que um anel pôs numa carta específica ('pay' vale ao pagar, 'fight' vale em combate).
    boostOf(card, kind) {
      return (card.boost && card.boost[kind]) || 0;
    }

    // ---------- mana (♦) ----------

    manaMax() {
      return this.config.manaMax + this.ringBonus('mana');
    }

    gainMana(amount) {
      const gained = Math.min(amount, this.manaMax() - this.mana);
      this.mana += gained;
      this.manaGained += gained;
      this.manaWasted += amount - gained;
      return gained;
    }

    spendMana(amount) {
      this.mana -= amount;
      this.manaSpent += amount;
    }

    // ---------- anéis ----------

    // Soma dos bônus (walk, pay, fight, hand, deck) dos anéis no dedo.
    ringBonus(stat) {
      return this.rings.reduce((n, r) => {
        const def = r && DC.ROGUE.RINGS[r.ring];
        return n + (def && def.stat === stat ? def.amount : 0);
      }, 0);
    }

    handLimit() {
      return this.config.handMax + this.ringBonus('hand');
    }

    // Usar um anel gasta mana (config.ringUseMana). Anel de naipe: a carta escolhida vira daquele naipe até ser usada.
    // Anel de número (Chave, Guerreiro): a carta escolhida ganha +2 (ao pagar portas e baús, ou em combate) até ser usada;
    // uma carta só recebe esse bônus uma vez. Os outros anéis valem sozinhos, sem gastar nada.
    useRing(slot, cardId) {
      if (!this.canAct() && !this.canFight()) return fail('Não dá para usar o anel agora.');
      const ring = this.rings[slot];
      const def = ring && DC.ROGUE.RINGS[ring.ring];
      if (!def || (!def.suit && !def.use)) return fail('Esse anel não precisa ser usado: ele vale enquanto está no dedo.');
      const cost = this.config.ringUseMana;
      if (this.mana < cost) return fail(`Falta mana: o anel custa ${cost} e você tem ${this.mana}. Descarte um ♦ para ganhar mana.`);
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return fail('Escolha 1 carta da mão para o anel.');
      if (def.suit) {
        if (card.suit === def.suit) return fail(`Essa carta já é de ${DC.SUIT_SYMBOL[def.suit]}.`);
        const old = DC.SUIT_SYMBOL[card.suit];
        card.suit = def.suit;
        delete this.jokerCopy[card.id];
        this.log(`${def.name}: ${DC.rankLabel(card.rank)}${old} vira ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[def.suit]}.`, 'good');
      } else {
        if (this.boostOf(card, def.use)) return fail('Essa carta já recebeu o bônus desse anel.');
        card.boost = Object.assign({}, card.boost, { [def.use]: def.amount });
        this.log(`${def.name}: ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]} ganha +${def.amount} ${def.use === 'pay' ? 'ao pagar portas e baús' : 'em combate'}.`, 'good');
      }
      this.spendMana(cost);
      this.afterAction();
      return { ok: true, card };
    }

    // Um anel achado: a pessoa escolhe em que espaço vesti-lo (trocando o que estiver lá) ou deixa para trás.
    resolveRing(slot) {
      if (!this.pending || this.pending.type !== 'ring') return fail('Nenhum anel para vestir.');
      const def = DC.ROGUE.RINGS[this.pending.ring];
      let replaced = null;
      if (slot === null || slot === undefined) {
        this.log(`Você deixa ${def.name} para trás.`);
      } else {
        if (!Number.isInteger(slot) || slot < 0 || slot >= this.rings.length) return fail('Esse espaço de anel não existe.');
        replaced = this.rings[slot];
        this.rings[slot] = { id: `a${++this.ringCount}`, ring: this.pending.ring };
        this.log(`Você veste ${def.name}.${replaced ? ` ${DC.ROGUE.RINGS[replaced.ring].name} fica para trás.` : ''}`, 'good');
      }
      this.pending = null;
      this.afterAction();
      return { ok: true, replaced };
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
      if (this.hand.length >= this.handLimit()) return fail('Sua mão está cheia: libere um espaço antes de pegar a carta guardada.');
      this.stash = this.stash.filter((c) => c !== card);
      this.hand.push(card);
      return { ok: true };
    }

    afterAction() {
      this.pruneJokers();
      this.startReinforce();
      if (this.status !== 'playing' || (this.pending && this.pending.type !== 'combat')) return;
      // Mão vazia (ou só com a carta congelada) mas ainda há cartas no deck: compra 1 de graça, para a derrota não vir
      // de uma mão zerada com o deck ainda cheio.
      if (!this.hasAnyAction() && this.playerDeck.length) {
        const drawn = this.draw(1);
        if (drawn) this.log('Sua mão acabou: você compra 1 carta do deck.', 'good');
      }
      // Sem cartas dá para continuar só se não está em combate e a escada de saída está ao alcance (sem portas fechadas).
      if (!this.hasAnyAction() && (this.inCombat() || !this.exitReachable())) {
        this.status = 'lost';
        // Como acabou, para a dica da tela de derrota: em combate, fugindo com a última carta ou simplesmente sem cartas.
        this.lostBy = this.pending && this.pending.type === 'combat' ? 'combat' : this.fled ? 'flee' : 'empty';
        this.log('Sem cartas para fazer qualquer ação. Fim de jogo.', 'bad');
      }
    }

    // A escada de saída pode ser alcançada andando, sem abrir porta nem baú nem atravessar inimigo?
    exitReachable() {
      const f = this.floor;
      const found = DC.reach(f, this.player, Infinity, (x, y) => Boolean(DC.enemyHere(f, x, y)));
      return found.has(f.exit.y * f.w + f.exit.x);
    }

    // ---------- andar (por turnos, como no Rogue) ----------
    //
    // Andar é de graça: cada passo (uma casa, na vertical ou na horizontal) é um turno, e depois dele os inimigos
    // agem. Abrir uma porta ou um baú também passa um turno. Os inimigos começam dormindo; terminar um turno na
    // zona de um deles pode acordá-lo (config.wakeChance), e um inimigo acordado anda uma casa por turno atrás de
    // você, dentro da sala dele. Quando ele encosta em você, começa o combate.

    // Caminho (lista de casas, a primeira é onde você está) até x,y, desviando dos inimigos. Se a casa final é de um
    // inimigo, o último passo é o ataque a ele.
    pathFor(x, y) {
      const f = this.floor;
      const target = DC.enemyHere(f, x, y);
      const blocked = (bx, by) => {
        const e = DC.enemyHere(f, bx, by);
        return Boolean(e) && e !== target;
      };
      const found = DC.reach(f, this.player, Infinity, blocked);
      const node = found.get(y * f.w + x);
      if (!node || node.dist < 1) return null;
      return DC.pathTo(f, found, x, y);
    }

    // Há um inimigo acordado que está te vendo agora? Aí andar vira passo a passo.
    chasers() {
      return this.floor.enemies.filter((e) => !e.dead && e.awake && !e.lost);
    }

    // Um passo ou um ataque: x,y é uma casa ao lado. Devolve o que aconteceu neste turno.
    step(x, y) {
      if (!this.canAct()) return fail('Não dá para andar agora.');
      const f = this.floor;
      const from = { x: this.player.x, y: this.player.y };
      if (Math.abs(x - from.x) + Math.abs(y - from.y) !== 1) return fail('Só dá para andar uma casa por vez.');
      const floorBefore = f;
      const foe = DC.enemyHere(f, x, y);
      if (foe) {
        // Andar contra um inimigo (dormindo ou não) é atacá-lo.
        this.engage(foe);
        this.afterAction();
        return { ok: true, moved: false, from, to: from, floorBefore, picked: [], trap: null, descended: false, combat: true, woke: [], enemyId: foe.id };
      }
      const cell = DC.cellAt(f, x, y);
      const walkable = cell && (['floor', 'start', 'exit'].includes(cell.type) || (cell.type === 'door' && f.doors[cell.ref].open));
      if (!walkable) return fail('Tem uma parede ou algo fechado aí.');

      this.player = { x, y };
      const result = { ok: true, moved: true, from, to: { x, y }, floorBefore, picked: this.collectPickups([from, { x, y }]), trap: null, descended: false, combat: false, woke: [], moved_enemies: [] };
      this.steps++;

      const trap = (f.traps || []).find((t) => !t.sprung && t.x === x && t.y === y);
      if (trap) result.trap = this.springTrap(trap);

      if (!result.trap || !result.trap.floorChanged) {
        if (cell.type === 'exit') {
          result.descended = true;
          if (this.floorNo >= this.config.floors) {
            this.status = 'won';
            this.log('Você escapou da masmorra!', 'good');
          } else {
            this.startFloor(this.floorNo + 1);
          }
        } else {
          this.passTurn(result);
        }
      }
      this.afterAction();
      return result;
    }

    // Passa um turno: os inimigos dormindo na zona podem acordar, os acordados andam atrás de você e, se encostam,
    // o combate começa. Não faz nada enquanto uma janela está aberta.
    passTurn(result = {}) {
      this.turn++;
      this.turnsByFloor[this.floorNo] = (this.turnsByFloor[this.floorNo] || 0) + 1;
      if (this.status !== 'playing' || this.pending) return result;
      const f = this.floor;
      const hero = this.player;
      const heroCell = DC.cellAt(f, hero.x, hero.y);
      result.woke = result.woke || [];
      result.moved_enemies = result.moved_enemies || [];

      for (const e of f.enemies) {
        if (!DC.inWakeZone(e, heroCell, hero.x, hero.y)) continue;
        const chance = e.wake !== undefined ? e.wake : e.small ? this.config.wakeChanceSmall : this.config.wakeChance;
        if (this.wakeRng.next() < chance) {
          e.awake = true;
          e.lost = 0;
          e.lastSeen = { x: hero.x, y: hero.y };
          result.woke.push(e.id);
          this.log(e.small ? 'Um rato acorda e corre atrás de você!' : 'Um inimigo acorda e vem atrás de você!', 'bad');
        }
      }

      if (this.hasteTurns > 0) {
        this.hasteTurns--;
        return result;
      }
      result.lost = result.lost || [];
      for (const e of f.enemies) {
        if (e.dead || !e.awake || result.woke.includes(e.id)) continue;
        if (e.stun > 0) {
          e.stun--;
          continue;
        }
        const dist = () => Math.abs(e.x - hero.x) + Math.abs(e.y - hero.y);
        // Vendo você, ele guarda onde você está; sem ver, vai até o último lugar onde viu e, se não te achar em
        // `loseTrack` turnos, desiste e volta a dormir ali mesmo.
        if (DC.canSee(f, e.x, e.y, hero.x, hero.y, this.config.sightRange)) {
          e.lastSeen = { x: hero.x, y: hero.y };
          e.lost = 0;
        } else if (++e.lost > this.config.loseTrack) {
          e.awake = false;
          e.lost = 0;
          e.lastSeen = null;
          result.lost.push(e.id);
          this.log('Um inimigo perde você de vista e volta a dormir.', 'good');
          continue;
        }
        if (dist() > 1) {
          const goal = e.lastSeen || hero;
          const next = e.x === goal.x && e.y === goal.y ? null : DC.chaseStep(f, e, goal, hero);
          if (next) {
            e.x = next.x;
            e.y = next.y;
            const cell = DC.cellAt(f, next.x, next.y);
            if (cell.type !== 'door') e.room = cell.room;
            result.moved_enemies.push(e.id);
          }
        }
        if (dist() === 1) {
          this.engage(e);
          result.combat = true;
          result.enemyId = e.id;
          break;
        }
      }
      return result;
    }

    // Começa o combate com um inimigo (que, lutando, já está acordado).
    engage(enemy) {
      enemy.awake = true;
      enemy.lost = 0;
      this.pending = { type: 'combat', enemyId: enemy.id };
      this.log('Combate! O inimigo está em cima de você.', 'bad');
      this.startCombatEffects(enemy);
    }

    // A caminhada automática deve parar? Quando algo muda: combate, armadilha, comida achada, descida, um inimigo
    // acordando ou perseguindo você, ou uma janela aberta.
    stopWalking(result) {
      return Boolean(result.combat || result.trap || result.descended || (result.picked && result.picked.length) || (result.woke && result.woke.length) || this.pending || this.status !== 'playing' || this.chasers().length);
    }

    // Anda até x,y passo a passo, parando quando algo muda (para os testes e atalhos; a tela anima cada passo).
    walkTo(x, y) {
      const path = this.pathFor(x, y);
      if (!path) return fail('Sem caminho até lá.');
      const out = { ok: true, steps: 0, path: [path[0]], floorBefore: this.floor, picked: [], trap: null, descended: false, combat: false, woke: [] };
      for (const cell of path.slice(1)) {
        const r = this.step(cell.x, cell.y);
        if (!r.ok) {
          if (!out.steps && !out.combat) return r;
          break;
        }
        if (r.moved) {
          out.steps++;
          out.path.push(cell);
        }
        out.picked.push(...r.picked);
        out.woke.push(...r.woke);
        out.trap = out.trap || r.trap;
        out.descended = out.descended || r.descended;
        out.combat = out.combat || r.combat;
        if (this.stopWalking(r)) break;
      }
      return out;
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
      // Baú destrancado (grátis): abre sem gastar cartas.
      const free = target.kind === 'chest' && Boolean(target.obj.free);
      const cards = free ? [] : this.handCards(cardIds);
      if (!free && (!cards || !cards.length)) return fail('Escolha cartas da mão.');

      const cost = target.obj.cost.rank;
      const sum = free ? 0 : this.payTotal(cardIds);
      if (!free && sum < cost) return fail(`Faltam ${cost - sum} para abrir (custo ${cost}).`);

      const exact = !free && sum === cost;
      // Soma exata paga com 2 ou mais cartas do mesmo naipe: bônus maior.
      const flush = exact && cards.length >= 2 && cards.every((c) => c.suit === cards[0].suit);
      const bonusCards = exact ? (flush ? this.config.flushBonus : this.config.exactBonus) : 0;
      this.hand = this.hand.filter((c) => !cards.includes(c));
      this.discard.push(...cards);
      this.spent.open += cards.length;
      this.spent.spadeOther += cards.filter((c) => c.suit === 'S').length;
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
      if (free) {
        this.log('O baú estava destrancado: abre de graça.', 'good');
      } else if (exact) {
        const head = flush ? `Soma exata com o mesmo naipe! Abre ${label}` : `Soma exata! Abre ${label}`;
        if (newRoom) {
          bonus = bonusCards;
          this.log(`${head} e ganha ${bonusCards === 1 ? 'uma carta' : `${bonusCards} cartas`} de graça.`, 'good');
        } else {
          drawn = this.draw(bonusCards);
          this.log(`${head}${drawn ? ` e compra ${drawn === 1 ? 'uma carta' : `${drawn} cartas`} de graça` : ''}.`, 'good');
        }
      } else {
        this.log(`Abre ${label} gastando ${sum} (custo ${cost}), sem compra de volta.`);
      }
      // Anel da Comida: uma porta aberta com soma exata põe 1 carta nova no deck.
      let ringCards = [];
      if (exact && target.kind === 'door' && this.ringBonus('food') > 0) {
        ringCards = this.newCards(this.ringBonus('food'));
        this.shuffleIntoDeck(ringCards);
        this.reinforced += ringCards.length;
        this.log(`${DC.ROGUE.RINGS.food.name}: ${ringCards.map((c) => `${DC.rankLabel(c.rank)}${DC.SUIT_SYMBOL[c.suit]}`).join(', ')} entra no seu deck.`, 'good');
      }
      // A porta de uma sala nova não dá carta por si só: a janela só abre se há bônus (soma exata) ou o Anel do Deck.
      if (newRoom && bonus + this.ringBonus('deck') > 0) {
        this.pending = { type: 'refill', reason: 'door', bonus, draws: 0, flush };
        this.log('Sala nova à frente! Você ganha cartas.', 'good');
      } else if (newRoom) {
        this.log('Sala nova à frente.');
      }

      let scroll = false;
      if (target.kind === 'chest' && target.obj.reinforce) this.owe(target.obj.reinforce, 'baú');
      if (target.kind === 'chest' && target.obj.ring) this.oweRing(target.obj.ring, 'baú');
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
      const turn = this.passTurn({});
      this.afterAction();
      return { ok: true, exact, flush, bonusCards, drawn, kind: target.kind, scroll, ringCards, combat: Boolean(turn.combat), woke: turn.woke || [] };
    }

    resolveChest(pickIds, discardIds) {
      if (!this.pending || this.pending.type !== 'chest') return fail('Nenhum baú aberto.');
      const options = this.pending.options;
      const picks = pickIds.map((id) => options.find((c) => c.id === id));
      if (picks.some((c) => !c) || new Set(pickIds).size !== pickIds.length) return fail('Escolha inválida.');
      if (picks.length > this.config.chestPicks) return fail(`Escolha no máximo ${this.config.chestPicks}.`);
      const discards = this.handCards(discardIds);
      if (!discards) return fail('Descarte inválido.');
      if (this.hand.length - discards.length + picks.length > this.handLimit()) {
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
        if (!this.playerDeck.length) return fail('O deck está vazio.');
        this.hand = this.hand.filter((c) => c !== card);
        this.discard.push(card);
        this.spent.power++;
        const drawn = this.draw(card.rank);
        this.log(`${symbol}: compra ${drawn} carta(s).`, 'good');
        this.afterAction();
        return { ok: true, count: drawn };
      }

      if (card.suit === 'D') {
        if (this.mana >= this.manaMax()) return fail('Sua mana já está cheia.');
        this.hand = this.hand.filter((c) => c !== card);
        this.discard.push(card);
        this.spent.power++;
        const value = this.cardValue(card);
        const gained = this.gainMana(value);
        this.log(`${symbol}: vira ${gained} de mana${gained < value ? ` (o teto é ${this.manaMax()}, sobraram ${value - gained})` : ''}.`, 'good');
        this.afterAction();
        return { ok: true, count: gained, mana: this.mana };
      }

      return fail('Esse naipe não tem um poder para ativar à parte.');
    }

    // ---------- combate ----------

    // Gasta cartas da mão para derrotar cartas do inimigo. Sem ♠, a soma precisa ser pelo menos o custo
    // de UMA carta, à escolha. Com ♠ na seleção (que vale o dobro em combate) dá para derrubar VÁRIAS
    // cartas de uma vez, desde que a soma cubra o custo de todas. Soma exata compra 1 carta;
    // derrotar a última carta é a vitória, que compra mais 1 e tira o inimigo do mapa.
    attack(cardIds, enemyCardIds) {
      if (!this.canFight()) return fail('Não há combate agora.');
      const enemy = this.combatEnemy();
      const ids = Array.isArray(enemyCardIds) ? enemyCardIds : [enemyCardIds];
      if (!ids.length || new Set(ids).size !== ids.length) return fail('Escolha uma carta do inimigo que ainda esteja de pé.');
      const targets = ids.map((id) => enemy.cards.find((c) => c.id === id && !enemy.down.includes(c.id)));
      if (targets.some((t) => !t)) return fail('Escolha uma carta do inimigo que ainda esteja de pé.');
      if (targets.some((t) => enemy.hidden && enemy.hidden.includes(t.id))) return fail('Essa carta está virada de costas: derrube a outra primeiro.');
      const cards = this.handCards(cardIds);
      if (!cards || !cards.length) return fail('Escolha cartas da mão.');
      if (this.pending.frozen && cards.some((c) => c.id === this.pending.frozen)) return fail('Essa carta está congelada até você derrubar uma carta do inimigo.');
      if (targets.length > 1 && !cards.some((c) => c.suit === 'S')) return fail('Só com uma carta de ♠ dá para derrubar mais de uma carta do inimigo de uma vez.');

      const cost = targets.reduce((total, t) => total + t.rank, 0);
      const sums = this.attackSums(cardIds);
      const best = sums[sums.length - 1];
      if (best < cost) return fail(`Faltam ${cost - best} para derrotar ${targets.length > 1 ? 'essas cartas' : 'essa carta'} (custo ${cost}).`);

      // ♠ vale o número ou o dobro: se alguma combinação dá a soma exata, é ela (e compra 1 carta).
      const exact = sums.includes(cost);
      const sum = exact ? cost : best;
      this.hand = this.hand.filter((c) => !cards.includes(c));
      this.discard.push(...cards);
      this.spent.attack += cards.length;
      this.spent.spadeAttack += cards.filter((c) => c.suit === 'S').length;
      for (const t of targets) enemy.down.push(t.id);
      const names = targets.map((t) => DC.rankLabel(t.rank)).join(' e ');

      // Gelo: derrubar uma carta do inimigo descongela a carta da mão.
      if (this.pending.frozen) {
        const thawed = this.hand.find((c) => c.id === this.pending.frozen);
        this.pending.frozen = null;
        if (thawed) this.log(`A carta ${DC.rankLabel(thawed.rank)}${DC.SUIT_SYMBOL[thawed.suit]} descongela!`, 'good');
      }

      let drawn = 0;
      if (exact) {
        drawn = this.draw(1);
        this.log(`Soma exata! Derruba ${targets.length > 1 ? 'as cartas' : 'a carta'} ${names}${drawn ? ' e compra uma carta de graça' : ''}.`, 'good');
      } else {
        this.log(`Derruba ${targets.length > 1 ? 'as cartas' : 'a carta'} ${names} gastando ${sum}, sem compra de volta.`);
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
        if (!this.tutorial && this.itemRng.next() < (enemy.small ? this.config.itemDropChanceSmall : this.config.itemDropChance)) this.dropItem();
        // Às vezes o inimigo deixa um Pergaminho de Inventário no lugar da carta de recompensa.
        if (enemy.scroll && this.grantScroll()) {
          scroll = true;
          this.log('Inimigo derrotado! Ele deixa um Pergaminho de Inventário.', 'good');
        } else {
          reward = this.draw(1);
          this.log(`Inimigo derrotado!${reward ? ' Você compra uma carta pela vitória.' : ''}`, 'good');
        }
        if (enemy.reinforce) this.owe(enemy.reinforce, 'inimigo');
        if (enemy.ring) this.oweRing(enemy.ring, 'inimigo');
      }
      this.afterAction();
      return { ok: true, exact, drawn, victory, reward, scroll, revealed, enemyId: enemy.id, cardId: targets[0].id, cardIds: targets.map((t) => t.id), reinforce: victory ? enemy.reinforce || false : false };
    }

    // Foge do combate descartando 1 carta da mão (a escolhida). Você fica onde está, e o inimigo ficar parado por
    // alguns turnos (config.fleeStun): dá tempo de se afastar. As cartas dele já derrotadas continuam derrotadas.
    // Se era a última carta da mão e não há como seguir, o jogo termina.
    flee(cardId) {
      if (!this.canFight()) return fail('Não há combate agora.');
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return fail('Escolha a carta que você descarta para fugir.');
      const enemy = this.combatEnemy();
      this.hand = this.hand.filter((c) => c !== card);
      this.discard.push(card);
      this.spent.flee++;
      if (card.suit === 'S') this.spent.spadeOther++;
      enemy.awake = true;
      enemy.lost = 0;
      enemy.lastSeen = { x: this.player.x, y: this.player.y };
      enemy.stun = this.config.fleeStun;
      this.pending = null;
      this.log(`Você foge descartando ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]}. O inimigo fica parado por ${enemy.stun} turnos.`);
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
      else if (this.hand.length < this.handLimit()) this.hand.push(card);
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
        case 'haste':
          this.hasteTurns = this.config.hasteTurns;
          text = `Você fica rápido: os inimigos ficam parados pelos próximos ${this.config.hasteTurns} turnos.`;
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
              if ((x === this.player.x && y === this.player.y) || this.nearEnemy(this.floor, x, y)) continue;
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

    // Tem um inimigo vivo nesta casa ou numa casa ao lado? (teleporte e queda não deixam você aparecer assim)
    nearEnemy(floor, x, y) {
      return (floor.enemies || []).some((e) => !e.dead && Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
    }

    // ---------- armadilhas (experimento Baralho Finito) ----------

    // Dispara uma armadilha: dardo queima cartas do topo do deck (vão para o cemitério) e a outra manda
    // para um ponto afastado da escada, no andar de cima.
    springTrap(trap) {
      trap.sprung = true;
      if (trap.kind === 'dart') {
        const burned = this.playerDeck.splice(Math.max(0, this.playerDeck.length - this.config.trapDartCards), this.config.trapDartCards);
        this.discard.push(...burned);
        this.spent.trap += burned.length;
        this.log(`Armadilha! Um dardo acerta o seu deck: ${burned.length} carta(s) do topo vão para o cemitério.`, 'bad');
        return { kind: 'dart', burned: burned.length, floorChanged: false };
      }
      const to = this.floorNo - 1;
      const floor = this.floors[to - 1];
      this.log(`Armadilha! O chão cede e você cai para o andar ${to}.`, 'bad');
      this.floorNo = to;
      this.floor = floor;
      this.visited = this.seenRooms[to];
      // Cai num ponto de uma sala já visitada, no terço mais longe da escada (precisa andar de volta).
      const spots = [];
      for (let y = 0; y < floor.h; y++) {
        for (let x = 0; x < floor.w; x++) {
          if (floor.grid[y][x].type !== 'floor' || !this.visited.has(floor.grid[y][x].room) || this.nearEnemy(floor, x, y)) continue;
          spots.push({ x, y, d: Math.abs(x - floor.exit.x) + Math.abs(y - floor.exit.y) });
        }
      }
      spots.sort((a, b) => b.d - a.d);
      const far = spots.slice(0, Math.max(1, Math.ceil(spots.length / 3)));
      const at = far[this.trapRng.int(0, far.length - 1)] || { x: floor.start.x, y: floor.start.y };
      this.player = { x: at.x, y: at.y };
      return { kind: 'back', burned: 0, floorChanged: true };
    }

    // ---------- Comida: Maçã e Bife (experimento Baralho Finito) ----------

    // Recolhe a comida caída nas casas do caminho andado (menos a casa de onde a pessoa saiu).
    collectPickups(path) {
      const picked = [];
      const pickups = this.floor.pickups || [];
      for (let i = 1; i < path.length; i++) {
        const pickup = pickups.find((p) => !p.taken && p.x === path[i].x && p.y === path[i].y);
        if (!pickup) continue;
        pickup.taken = true;
        picked.push(pickup);
        const kind = pickup.gold ? 'gold' : 'normal';
        this.log(`Você acha ${FOOD[kind].a} no chão!`, 'good');
        this.owe(kind, 'chão');
      }
      return picked;
    }

    // Uma comida foi achada: a janela dela abre assim que nenhuma outra estiver aberta.
    owe(kind, source) {
      if (this.tutorial) return;
      this.owed.push({ kind, source });
    }

    // Um anel foi achado: a janela dele abre na vez (depois das outras).
    oweRing(ring, source) {
      if (this.tutorial) return;
      this.owed.push({ ring, source });
    }

    // Sorteia as cartas novas, como se cada uma saísse de um baralho completo (naipe e número ao acaso:
    // pode repetir o que o deck já tem). Cada uma ganha um id próprio.
    newCards(count) {
      const cards = [];
      for (let i = 0; i < count; i++) {
        const suit = this.reinforceRng.pick(DC.SUITS);
        const rank = this.reinforceRng.int(1, 13);
        cards.push({ id: `n${++this.cardCount}${suit}${rank}`, suit, rank, fresh: true });
      }
      return cards;
    }

    // Abre a janela do próximo pergaminho que estiver esperando.
    startReinforce() {
      if (this.status !== 'playing' || this.pending || !this.owed.length) return;
      const next = this.owed.shift();
      if (next.ring) {
        this.pending = { type: 'ring', ring: next.ring, source: next.source };
        this.log(`Você achou ${DC.ROGUE.RINGS[next.ring].name}!`, 'good');
        return;
      }
      const { kind, source } = next;
      const gold = kind === 'gold';
      const cards = this.newCards(gold ? this.config.reinforceGoldCards : this.config.reinforceCards);
      this.pending = { type: 'reinforce', kind, gold, source, cards };
      this.log(`Você come ${FOOD[kind].a}: ${cards.length} cartas novas para o seu deck!`, 'good');
    }

    // Põe cartas novas no deck, cada uma numa posição aleatória (o fim da lista é o topo).
    shuffleIntoDeck(cards) {
      for (const card of cards) {
        const at = this.reinforceRng.int(0, this.playerDeck.length);
        this.playerDeck.splice(at, 0, card);
      }
    }

    // Termina a janela da comida: as cartas novas entram no deck.
    resolveReinforce() {
      if (!this.pending || this.pending.type !== 'reinforce') return fail('Nenhum pergaminho aberto.');
      const { cards } = this.pending;
      this.shuffleIntoDeck(cards);
      this.reinforced += cards.length;
      this.pending = null;
      this.log(`Seu deck ganhou: ${cards.map((c) => `${DC.rankLabel(c.rank)}${DC.SUIT_SYMBOL[c.suit]}`).join(', ')}.`, 'good');
      this.afterAction();
      return { ok: true, cards };
    }

    // ---------- cartas da sala nova ----------

    // As cartas que a janela da sala nova vai dar, na ordem em que saem do deck: primeiro a de graça
    // da soma exata (se houver), depois a da sala. Sem descartar nada, só entra o que cabe na mão.
    // Não mexe em nada: serve para a janela mostrar as cartas antes de elas irem para a mão.
    refillPreview() {
      if (!this.pending || this.pending.type !== 'refill') return [];
      const bonus = this.pending.bonus || 0;
      const room = this.pending.draws === undefined ? this.config.refillDraw : this.pending.draws;
      const count = Math.min(bonus + room + this.ringBonus('deck'), this.handLimit() - this.hand.length, this.playerDeck.length);
      const cards = [];
      for (let i = 0; i < count; i++) {
        cards.push({ card: this.playerDeck[this.playerDeck.length - 1 - i], extra: i < bonus });
      }
      return cards;
    }

    resolveRefill() {
      if (!this.pending || this.pending.type !== 'refill') return fail('Nada para comprar.');
      const room = this.pending.draws === undefined ? this.config.refillDraw : this.pending.draws;
      const drawn = this.draw((this.pending.bonus || 0) + room + this.ringBonus('deck'));
      this.pending = null;
      this.log(`Você compra ${drawn} carta(s).`);
      this.afterAction();
      return { ok: true, drawn };
    }
  }

  DC.FOOD = FOOD;
  DC.CONFIG = DEFAULT_CONFIG;
  DC.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
