(function (root) {
  const DC = root.DC || (root.DC = {});

  // EXPERIMENTO (branch experimento-rogue): ideias tiradas do Rogue de 1980.
  //  - inimigos com habilidade (ferrugem, ninfa, gelo);
  //  - poções e pergaminhos de uso único, numa bolsa de 3 espaços;
  //  - itens misteriosos: a cor da poção e o título do pergaminho mudam de efeito a cada seed
  //    e só são descobertos usando.
  // Todos os textos ficam aqui, num lugar só.
  // (No branch experimento-baralho-finito a poção de cura saiu: o descarte nunca volta ao deck.)

  const ABILITIES = {
    rust: { name: 'Ferrugem', text: 'Suas cartas valem −1 neste combate.' },
    nymph: { name: 'Ninfa', text: 'Rouba a carta do seu inventário. Derrote-a para recuperar.' },
    ice: { name: 'Gelo', text: 'Congela uma carta da sua mão até você derrubar uma carta dele.' },
  };

  const ITEMS = {
    haste: { kind: 'potion', name: 'velocidade', text: 'Você fica rápido: os inimigos ficam parados por 8 turnos.', weight: 2 },
    poison: { kind: 'potion', name: 'veneno', text: 'As 2 cartas de cima do seu deck vão para o descarte.', weight: 2 },
    map: { kind: 'scroll', name: 'mapa mágico', text: 'Mostra o andar inteiro, sem névoa.', weight: 2 },
    // Pergaminhos de ±1: o mesmo efeito dos anéis de Precisão e do Ladrão, mas de uso único e sem gastar mana.
    // Não são misteriosos (`known`): você precisa saber o que fazem para escolher a carta. `weight` é a chance no sorteio.
    precision: { kind: 'scroll', name: 'Precisão', text: 'Uma carta da mão sobe ou desce 1 em combate (um 3 vira 2 ou 4). Não gasta mana.', use: 'fight', amount: 1, signed: true, known: true, weight: 2 },
    thief: { kind: 'scroll', name: 'Ladrão', text: 'Uma carta da mão sobe ou desce 1 ao pagar portas e baús (um 3 vira 2 ou 4). Não gasta mana.', use: 'pay', amount: 1, signed: true, known: true, weight: 1 },
  };

  // Aparências sorteadas por seed: a cor da poção e o título do pergaminho não dizem o efeito.
  const LOOKS = {
    potion: ['vermelha', 'azul', 'verde'],
    scroll: ['ZUNK', 'MELO'],
  };

  const ICON = { potion: '🧪', scroll: '📜' };

  // Anéis (experimento Baralho Finito): equipamento que fica no dedo (2 espaços) e modifica as cartas.
  // Passivos (`stat`/`amount`): valem enquanto estão no dedo, sem gastar nada. Ativos gastam MANA (♦) a cada uso:
  //  - de número (`use`/`amount`/`signed`): uma carta da mão escolhida sobe ou desce `amount` (a pessoa escolhe o
  //    sentido) ao pagar portas e baús ('pay', Ladrão) ou em combate ('fight', Precisão) até ser usada (uma carta
  //    recebe o ajuste uma vez só). Serve para fechar a soma exata. Com ♠ o ajuste entra depois do dobro, então o
  //    3♠ vira 5 ou 7 e os ímpares continuam ao alcance;
  //  - de naipe (`suit`): a carta escolhida vira daquele naipe até ser usada.
  // `weight` é a raridade no sorteio.
  const RINGS = {
    mage: { name: 'Anel do Mago', short: 'Mago', text: '+4 de mana máxima.', stat: 'mana', amount: 4, weight: 2, color: '#4da3ff' },
    thief: { name: 'Anel do Ladrão', short: 'Ladrão', text: 'Gasta mana: uma carta da mão sobe ou desce 1 ao pagar portas e baús (um 3 vira 2 ou 4).', use: 'pay', amount: 1, signed: true, weight: 2, color: '#e7b84a' },
    precision: { name: 'Anel de Precisão', short: 'Precisão', text: 'Gasta mana: uma carta da mão sobe ou desce 1 em combate (um 3 vira 2 ou 4).', use: 'fight', amount: 1, signed: true, weight: 2, color: '#d6403a' },
    hand: { name: 'Anel da Mão', short: 'Mão', text: '+1 carta na mão máxima.', stat: 'hand', amount: 1, weight: 1, color: '#6bd08a' },
    deck: { name: 'Anel do Deck', short: 'Deck', text: 'Ao abrir uma sala nova (ou descer de andar), compra 1 carta a mais.', stat: 'deck', amount: 1, weight: 1, color: '#b48cf2' },
    food: { name: 'Anel da Comida', short: 'Comida', text: 'Ao abrir uma porta com soma exata, 1 carta nova entra no seu deck.', stat: 'food', amount: 1, weight: 1, color: '#c97b3a' },
    suitS: { name: 'Anel de Espadas', short: '♠', suit: 'S', weight: 1, color: '#9aa7c7' },
    suitH: { name: 'Anel de Copas', short: '♥', suit: 'H', weight: 1, color: '#ff6b7e' },
    suitD: { name: 'Anel de Ouros', short: '♦', suit: 'D', weight: 1, color: '#ff9a52' },
    suitC: { name: 'Anel de Paus', short: '♣', suit: 'C', weight: 1, color: '#6fcf97' },
  };
  for (const ring of Object.values(RINGS)) {
    if (ring.suit) ring.text = `Gasta mana: escolha 1 carta da mão e ela vira ${{ S: '♠', H: '♥', D: '♦', C: '♣' }[ring.suit]} até ser usada.`;
  }

  // Nome que aparece para a pessoa: o verdadeiro se já descobriu (ou se o item não é misterioso), senão só a aparência.
  function itemName(game, key) {
    const def = ITEMS[key];
    const noun = def.kind === 'potion' ? 'Poção' : 'Pergaminho';
    if (game.identified.has(key)) return `${noun} de ${def.name}`;
    const look = game.looks[key];
    return def.kind === 'potion' ? `Poção ${look}` : `Pergaminho ${look}`;
  }

  // Cores da água dos poços das salas especiais: cada cor tem um efeito (mana, cartas novas no deck ou encher a mão),
  // sorteado por seed, e só se descobre bebendo.
  const WELL_LOOKS = ['azul', 'verde', 'dourada'];
  const WELL_EFFECTS = {
    mana: { name: 'mana', text: 'Enche a sua mana.' },
    deck: { name: 'cartas novas', text: 'Põe cartas novas no seu deck.' },
    hand: { name: 'mão cheia', text: 'Compra cartas até encher a sua mão.' },
  };

  DC.ROGUE = { ABILITIES, ITEMS, LOOKS, ICON, RINGS, WELL_LOOKS, WELL_EFFECTS, itemName };
})(typeof window !== 'undefined' ? window : globalThis);
