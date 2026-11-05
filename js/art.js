(function (root) {
  const DC = root.DC || (root.DC = {});

  // Arte de pixel art opcional (Pixel_Poem, veja assets/CREDITS.md). Este módulo só escolhe
  // QUAL peça desenhar em cada casa; o desenho em si é feito pelo CSS (classe `art` no
  // <html>, ligada pelo ui.js só depois de as imagens carregarem). Sem as imagens o jogo
  // continua com o visual clássico.

  const BASE = 'assets/pixel/';

  const FILES = {
    // Cópia da folha com o fundo transparente (scripts/tileset_alpha.py), para empilhar peças.
    tiles: `${BASE}Dungeon_Tileset_v2_alpha.png`, // 10 x 10 peças de 16 px
    props: `${BASE}Dungeon_item_props_v2.png`,
    chest: `${BASE}chest_1.png`, // 4 quadros de 16 px
    hero: `${BASE}Dungeon_Character.png`, // 7 x 4 peças de 16 px
    skeleton1: `${BASE}enemies-skeleton1_idle.png`, // quadros de 32 px
    skeleton2: `${BASE}enemies-skeleton2_idle.png`,
    vampire: `${BASE}enemies-vampire_idle.png`,
    skeleton1_hit: `${BASE}enemies-skeleton1_take_damage.png`,
    skeleton2_hit: `${BASE}enemies-skeleton2_take_damage.png`,
    vampire_hit: `${BASE}enemies-vampire_take_damage.png`,
  };

  const ENEMY_KINDS = ['skeleton1', 'skeleton2', 'vampire'];

  // Coordenadas [coluna, linha] das peças na folha Dungeon_Tileset_v2.png.
  const TILE = {
    floor: [[6, 0], [7, 0], [6, 1], [7, 1]],
    wallTop: [[1, 0], [2, 0], [3, 0], [4, 0]], // parede de cima de uma sala (frente de tijolos)
    wallTopBanner: [[0, 5], [1, 5], [2, 5], [3, 5]],
    wallTopTorch: [[0, 8], [1, 8], [2, 8]],
    wallTopWindow: [5, 5],
    wallBottom: [[1, 4], [2, 4], [3, 4], [4, 4]],
    wallLeft: [[0, 1], [0, 2], [0, 3]], // parede à esquerda da sala (a sala fica à direita)
    wallRight: [[5, 1], [5, 2], [5, 3]],
    corner: { nw: [0, 0], ne: [5, 0], sw: [0, 4], se: [5, 4] },
    stairsUp: [5, 8],
    stairsDown: [4, 8],
  };

  // Folha de props (Dungeon_item_props_v2.png): folha de porta de madeira com faixa de metal.
  const PROP = {
    door: [5, 3],
  };

  // Tamanho de cada folha, em peças de 16 px.
  const SHEET_SIZE = { tiles: [10, 10], props: [12, 5] };

  // Mistura estável de duas coordenadas (o mesmo mapa sempre sai com a mesma decoração).
  const hash = (x, y) => (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  const pick = (list, h) => list[h % list.length];

  const isOpen = (cell) => Boolean(cell) && (cell.type === 'floor' || cell.type === 'start' || cell.type === 'exit' || cell.type === 'chest');

  // Camadas de peças de uma casa de parede (a primeira camada fica por cima).
  // Uma casa pode servir a salas dos dois lados (a parede entre salas tem 1 casa só) e
  // fica numa quina ou junção, então é montada por camadas, olhando as 8 casas ao redor:
  //   - faixa lateral para cada sala ao leste/oeste (as duas, se houver sala dos dois lados);
  //   - peça de quina quando só há sala na diagonal (pode haver mais de uma na junção);
  //   - base: frente de tijolos se há sala ao sul, ou parede de baixo se há sala ao norte.
  // Devolve [] quando a parede não encosta em nenhuma sala (fica escura, como o vazio).
  function wallLayers(floor, x, y) {
    const at = (dx, dy) => isOpen(DC.cellAt(floor, x + dx, y + dy));
    const [n, s, e, w] = [at(0, -1), at(0, 1), at(1, 0), at(-1, 0)];
    const [ne, nw, se, sw] = [at(1, -1), at(-1, -1), at(1, 1), at(-1, 1)];
    const h = hash(x, y);
    const layers = [];
    const add = ([c, r]) => layers.push({ sheet: 'tiles', c, r });
    if (e) add(pick(TILE.wallLeft, h >>> 2)); // a faixa fica na borda direita da casa
    if (w) add(pick(TILE.wallRight, h >>> 5)); // a faixa fica na borda esquerda
    if (!s && !e && se) add(TILE.corner.nw);
    if (!s && !w && sw) add(TILE.corner.ne);
    if (!n && !e && ne) add(TILE.corner.sw);
    if (!n && !w && nw) add(TILE.corner.se);
    if (s) {
      const decor = (h >>> 4) % 11;
      if (decor === 0) add(pick(TILE.wallTopBanner, h >>> 8));
      else if (decor === 1) add(pick(TILE.wallTopTorch, h >>> 8));
      else if (decor === 2) add(TILE.wallTopWindow);
      else add(pick(TILE.wallTop, h));
    } else if (n) {
      add(pick(TILE.wallBottom, h));
    }
    return layers;
  }

  function floorSprite(x, y) {
    return pick(TILE.floor, hash(x, y) >>> 3);
  }

  const one = (sheet, [c, r]) => [{ sheet, c, r }];

  // Camadas de fundo de qualquer casa do mapa: lista de { sheet, c, r } (a primeira fica por
  // cima), ou null quando a casa não tem peça.
  function tileSprite(floor, x, y) {
    const cell = DC.cellAt(floor, x, y);
    if (!cell) return null;
    switch (cell.type) {
      case 'wall': {
        const layers = wallLayers(floor, x, y);
        return layers.length ? layers : null;
      }
      case 'floor':
      case 'chest':
        return one('tiles', floorSprite(x, y));
      case 'start':
        return one('tiles', TILE.stairsUp);
      case 'exit':
        return one('tiles', TILE.stairsDown);
      case 'door':
        return floor.doors[cell.ref].open ? one('tiles', floorSprite(x, y)) : one('props', PROP.door);
      default:
        return null;
    }
  }

  // Estilo CSS (em linha) que empilha as camadas de uma casa, em múltiplos da variável --tile.
  function style(layers) {
    const image = layers.map((l) => `url(${FILES[l.sheet]})`).join(',');
    const size = layers.map((l) => `calc(var(--tile) * ${SHEET_SIZE[l.sheet][0]}) calc(var(--tile) * ${SHEET_SIZE[l.sheet][1]})`).join(',');
    const pos = layers.map((l) => `calc(var(--tile) * ${-l.c}) calc(var(--tile) * ${-l.r})`).join(',');
    return `background-image:${image};background-size:${size};background-position:${pos}`;
  }

  // Carrega todas as imagens; resolve true só se todas existirem.
  function preload() {
    if (typeof Image === 'undefined') return Promise.resolve(false);
    return Promise.all(
      Object.values(FILES).map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
          }),
      ),
    ).then((all) => all.every(Boolean));
  }

  DC.art = { FILES, TILE, PROP, SHEET_SIZE, ENEMY_KINDS, tileSprite, wallLayers, floorSprite, style, preload };
})(typeof window !== 'undefined' ? window : globalThis);
