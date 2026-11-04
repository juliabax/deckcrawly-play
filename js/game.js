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
  };

  const fail = (error) => ({ ok: false, error });

  class Game {
    constructor(opts = {}) {
      this.config = Object.assign({}, DEFAULT_CONFIG, opts.config);
      this.seed = opts.seed !== undefined && opts.seed !== null ? opts.seed : Math.floor(Math.random() * 1e9);
      this.rng = DC.makeRng(this.seed);

      // Dois decks separados: o do jogador (vida + mão) e o da dungeon.
      this.playerDeck = this.rng.shuffle(DC.makeDeck('p'));
      this.dungeonDeck = this.rng.shuffle(DC.makeDeck('d'));
      this.hand = [];
      this.discard = [];
      this.jokerCopy = {};

      this.status = 'playing'; // playing | won | lost
      this.pending = null; // { type: 'refill' | 'chest', ... }
      this.logs = [];
      this.floorNo = 0;
      this.floor = null;
      this.player = null;
      this.visited = new Set();

      this.draw(this.config.handMax);
      this.log(`Você compra ${this.hand.length} cartas para começar.`);
      this.startFloor(1);
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

    startFloor(n) {
      this.floorNo = n;
      this.floor = DC.generateFloor(this.rng, this.config, () => this.dungeonDraw());
      this.player = { x: this.floor.start.x, y: this.floor.start.y };
      this.visited = new Set([this.floor.grid[this.player.y][this.player.x].room]);
      if (n > 1) {
        this.pending = { type: 'refill', reason: 'floor' };
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
      if (card.suit !== 'C') return card.rank;
      const target = this.jokerTarget(card);
      return target ? target.rank : card.rank;
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

    hasAnyAction() {
      return this.hand.length > 0;
    }

    afterAction() {
      this.pruneJokers();
      if (this.status !== 'playing' || this.pending) return;
      if (!this.hasAnyAction()) {
        this.status = 'lost';
        this.log('Sem cartas para fazer qualquer ação. Fim de jogo.', 'bad');
      }
    }

    // ---------- andar ----------

    reachFor(cardId) {
      const card = this.hand.find((c) => c.id === cardId);
      if (!card) return null;
      return DC.reach(this.floor, this.player, this.walkRange(card));
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

      const path = DC.pathTo(this.floor, found, x, y);
      const floorBefore = this.floor;
      this.hand = this.hand.filter((c) => c !== card);
      this.discard.push(card);
      this.player = { x, y };

      this.log(`Anda ${node.dist} casa(s) usando ${DC.rankLabel(card.rank)}${DC.SUIT_SYMBOL[card.suit]}.`);

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
      return { ok: true, path, floorBefore, descended };
    }

    // ---------- névoa ----------

    // Você só enxerga a sala em que está e as salas cuja porta já abriu. As
    // portas e paredes que cercam essas salas também aparecem; o que está
    // atrás de uma porta fechada continua escondido.
    isCellShown(x, y) {
      const f = this.floor;
      const cell = DC.cellAt(f, x, y);
      if (!cell || cell.type === 'void') return false;
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

      const label = target.kind === 'door' ? 'a porta' : 'o baú';
      let drawn = 0;
      if (exact) {
        drawn = this.draw(1);
        this.log(`Soma exata! Abre ${label}${drawn ? ' e compra uma carta de graça' : ''}.`, 'good');
      } else {
        this.log(`Abre ${label} gastando ${sum} (custo ${cost}), sem compra de volta.`);
      }

      // A reposição da mão acontece logo depois de abrir a porta que dá numa
      // sala nova, antes mesmo de você entrar nela.
      if (target.kind === 'door') {
        const here = this.floor.grid[this.player.y][this.player.x].room;
        const ahead = target.obj.a === here ? target.obj.b : target.obj.a;
        if (!this.visited.has(ahead)) {
          this.visited.add(ahead);
          this.pending = { type: 'refill', reason: 'door' };
          this.log('Sala nova à frente! Você pode repor a mão.', 'good');
        }
      }

      if (target.kind === 'chest') {
        const pool = this.playerDeck.slice();
        this.rng.shuffle(pool);
        this.pending = { type: 'chest', options: pool.slice(0, this.config.chestOptions) };
        this.log('O baú mostra algumas cartas do seu deck. Escolha até 2.', 'good');
      }
      this.afterAction();
      return { ok: true, exact, drawn, kind: target.kind };
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
      if (!this.canAct()) return fail('Não dá para usar poderes agora.');
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

    // ---------- reposição da mão ----------

    resolveRefill(discardIds) {
      if (!this.pending || this.pending.type !== 'refill') return fail('Nada para repor.');
      const discards = this.handCards(discardIds);
      if (!discards) return fail('Descarte inválido.');
      this.hand = this.hand.filter((c) => !discards.includes(c));
      this.discard.push(...discards);
      const drawn = this.draw(this.config.refillDraw);
      this.pending = null;
      this.log(`Descarta ${discards.length} e compra ${drawn} carta(s).`);
      this.afterAction();
      return { ok: true, discarded: discards.length, drawn };
    }
  }

  DC.CONFIG = DEFAULT_CONFIG;
  DC.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
