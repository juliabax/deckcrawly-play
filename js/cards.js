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

  Object.assign(DC, { SUITS, SUIT_SYMBOL, SUIT_NAME, rankLabel, makeDeck, makeRng });
})(typeof window !== 'undefined' ? window : globalThis);
