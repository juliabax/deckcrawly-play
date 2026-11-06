(function (root) {
  const DC = root.DC || (root.DC = {});

  // EXPERIMENTO (branch experimento-rogue): ideias tiradas do Rogue de 1980.
  //  - inimigos com habilidade (ferrugem, ninfa, gelo);
  //  - poções e pergaminhos de uso único, numa bolsa de 3 espaços;
  //  - itens misteriosos: a cor da poção e o título do pergaminho mudam de efeito a cada seed
  //    e só são descobertos usando.
  // Todos os textos ficam aqui, num lugar só.

  const ABILITIES = {
    rust: { name: 'Ferrugem', text: 'Suas cartas valem −1 neste combate.' },
    nymph: { name: 'Ninfa', text: 'Rouba a carta do seu inventário. Derrote-a para recuperar.' },
    ice: { name: 'Gelo', text: 'Congela uma carta da sua mão até você derrubar uma carta dele.' },
  };

  const ITEMS = {
    heal: { kind: 'potion', name: 'cura', text: 'Devolve 3 cartas do descarte para o deck.' },
    haste: { kind: 'potion', name: 'velocidade', text: 'O seu próximo movimento não gasta carta.' },
    poison: { kind: 'potion', name: 'veneno', text: 'As 2 cartas de cima do seu deck vão para o descarte.' },
    map: { kind: 'scroll', name: 'mapa mágico', text: 'Mostra o andar inteiro, sem névoa.' },
    teleport: { kind: 'scroll', name: 'teleporte', text: 'Leva você para um ponto sorteado de uma sala já visitada.' },
  };

  // Aparências sorteadas por seed: a cor da poção e o título do pergaminho não dizem o efeito.
  const LOOKS = {
    potion: ['vermelha', 'azul', 'verde'],
    scroll: ['ZUNK', 'MELO'],
  };

  const ICON = { potion: '🧪', scroll: '📜' };

  // Nome que aparece para a pessoa: o verdadeiro se já descobriu, senão só a aparência.
  function itemName(game, key) {
    const def = ITEMS[key];
    const noun = def.kind === 'potion' ? 'Poção' : 'Pergaminho';
    if (game.identified.has(key)) return `${noun} de ${def.name}`;
    const look = game.looks[key];
    return def.kind === 'potion' ? `Poção ${look}` : `Pergaminho ${look}`;
  }

  DC.ROGUE = { ABILITIES, ITEMS, LOOKS, ICON, itemName };
})(typeof window !== 'undefined' ? window : globalThis);
