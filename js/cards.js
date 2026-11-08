(function (root) {
  const DC = (root.DC = root.DC || {});

  const SUITS = ['S', 'H', 'D', 'C'];
  const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const SUIT_NAME = { S: 'Espadas', H: 'Copas', D: 'Ouros', C: 'Paus' };
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  function rankLabel(rank) {
    return RANK_LABEL[rank] || String(rank);
  }

  // Cada deck usa um prefixo próprio para que os ids nunca colidam.
  function makeDeck(prefix) {
    const cards = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        cards.push({ id: `${prefix}${suit}${rank}`, suit, rank });
      }
    }
    return cards;
  }

  function hashSeed(seed) {
    const text = String(seed);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32: pequeno, rápido e reproduzível a partir de uma seed.
  function makeRng(seed) {
    let state = hashSeed(seed) || 1;
    const rng = {
      next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int(min, max) {
        return min + Math.floor(rng.next() * (max - min + 1));
      },
      chance(p) {
        return rng.next() < p;
      },
      pick(list) {
        return list[Math.floor(rng.next() * list.length)];
      },
      shuffle(list) {
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(rng.next() * (i + 1));
          [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
      },
    };
    return rng;
  }

  // Formação das cartas de um inimigo: `rows` é a lista de filas (ids), da FRENTE para trás. Cada carta de uma fila de
  // trás fica coberta pelas cartas da fila logo à frente que a tocam na horizontal (cada fila ocupa a largura toda,
  // dividida em partes iguais). Devolve { idDaCarta: [ids que a cobrem] } só com as cartas que têm alguma na frente.
  function coverOf(rows) {
    const cover = {};
    for (let r = 1; r < rows.length; r++) {
      const m = rows[r].length;
      const p = rows[r - 1].length;
      rows[r].forEach((id, j) => {
        const over = rows[r - 1].filter((_, i) => Math.min((j + 1) / m, (i + 1) / p) - Math.max(j / m, i / p) > 1e-9);
        if (over.length) cover[id] = over;
      });
    }
    return cover;
  }

  Object.assign(DC, { SUITS, SUIT_SYMBOL, SUIT_NAME, rankLabel, makeDeck, makeRng, coverOf });
})(typeof window !== 'undefined' ? window : globalThis);
