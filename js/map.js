(function (root) {
  const DC = (root.DC = root.DC || {});

  // [linhas, colunas] das salas; a orientação é sorteada ao gerar (pode rodar).
  const ROOM_TEMPLATES = [
    [4, 6],
    [3, 8],
    [3, 6],
  ];
  const TREASURE_TEMPLATE = [3, 3];
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  // Duas salas precisam de pelo menos 1 casa de parede entre elas.
  function separated(a, b) {
    return (
      a.x + a.w + 1 <= b.x ||
      b.x + b.w + 1 <= a.x ||
      a.y + a.h + 1 <= b.y ||
      b.y + b.h + 1 <= a.y
    );
  }

  function overlap(a0, a1, b0, b1) {
    return { from: Math.max(a0, b0), to: Math.min(a1, b1) - 1 };
  }

  // Casas de parede onde uma porta poderia ligar as salas a e b (se forem vizinhas).
  function sharedGap(a, b) {
    const sides = [
      [a, b, 'v'],
      [b, a, 'v'],
      [a, b, 'h'],
      [b, a, 'h'],
    ];
    for (const [p, q, orient] of sides) {
      const cells = [];
      if (orient === 'v' && p.x + p.w + 1 === q.x) {
        const o = overlap(p.y, p.y + p.h, q.y, q.y + q.h);
        for (let y = o.from; y <= o.to; y++) cells.push({ x: p.x + p.w, y });
      } else if (orient === 'h' && p.y + p.h + 1 === q.y) {
        const o = overlap(p.x, p.x + p.w, q.x, q.x + q.w);
        for (let x = o.from; x <= o.to; x++) cells.push({ x, y: p.y + p.h });
      }
      if (cells.length) return { cells, orient };
    }
    return null;
  }

  function rotate(rng, [h, w]) {
    return rng.chance(0.5) ? { w, h } : { w: h, h: w };
  }

  // Coloca uma sala w×h encostada em um dos 4 lados do pai, com 1 casa de parede
  // no meio e pelo menos 1 casa de sobreposição para caber a porta.
  function placeAdjacent(rng, parent, side, w, h) {
    let x, y, door, orient;
    if (side === 0 || side === 1) {
      x = side === 0 ? parent.x + parent.w + 1 : parent.x - w - 1;
      y = rng.int(parent.y - h + 1, parent.y + parent.h - 1);
      const o = overlap(parent.y, parent.y + parent.h, y, y + h);
      door = { x: side === 0 ? parent.x + parent.w : parent.x - 1, y: rng.int(o.from, o.to) };
      orient = 'v';
    } else {
      y = side === 2 ? parent.y + parent.h + 1 : parent.y - h - 1;
      x = rng.int(parent.x - w + 1, parent.x + parent.w - 1);
      const o = overlap(parent.x, parent.x + parent.w, x, x + w);
      door = { x: rng.int(o.from, o.to), y: side === 2 ? parent.y + parent.h : parent.y - 1 };
      orient = 'h';
    }
    return { room: { x, y, w, h }, door, orient };
  }

  function roomDistances(count, links, from) {
    const dist = new Array(count).fill(Infinity);
    dist[from] = 0;
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const l of links) {
        const next = l.a === cur ? l.b : l.b === cur ? l.a : -1;
        if (next >= 0 && dist[next] === Infinity) {
          dist[next] = dist[cur] + 1;
          queue.push(next);
        }
      }
    }
    return dist;
  }

  function doorAdjacent(floor, x, y) {
    return DIRS.some(([dx, dy]) => {
      const c = cellAt(floor, x + dx, y + dy);
      return c && c.type === 'door';
    });
  }

  function cellAt(floor, x, y) {
    if (x < 0 || y < 0 || x >= floor.w || y >= floor.h) return null;
    return floor.grid[y][x];
  }

  // Escadas (entrada/saída) ficam num canto da sala, longe de portas, para
  // nunca atrapalharem a passagem.
  function pickCorner(rng, floor, room) {
    const corners = rng.shuffle([
      [room.x, room.y],
      [room.x + room.w - 1, room.y],
      [room.x, room.y + room.h - 1],
      [room.x + room.w - 1, room.y + room.h - 1],
    ]);
    const corner = corners.find(([x, y]) => !doorAdjacent(floor, x, y));
    if (corner) return corner;

    // Todos os cantos têm porta ao lado: usa qualquer casa livre da sala.
    const free = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (floor.grid[y][x].type === 'floor' && !doorAdjacent(floor, x, y)) free.push([x, y]);
      }
    }
    return free.length ? rng.pick(free) : corners[0];
  }

  function tryBuild(rng, cfg, drawCost) {
    const normalCount = rng.int(cfg.roomsMin, cfg.roomsMax);
    const rooms = [];
    const links = [];

    const firstSize = rotate(rng, rng.pick(ROOM_TEMPLATES));
    rooms.push({ id: 0, x: 0, y: 0, ...firstSize, kind: 'start' });

    let attempts = 0;
    while (rooms.length < normalCount && attempts++ < 600) {
      const parent = rng.pick(rooms);
      const size = rotate(rng, rng.pick(ROOM_TEMPLATES));
      const spot = placeAdjacent(rng, parent, rng.int(0, 3), size.w, size.h);
      if (!rooms.every((r) => separated(r, spot.room))) continue;
      const room = { id: rooms.length, ...spot.room, kind: 'normal' };
      rooms.push(room);
      links.push({ a: parent.id, b: room.id, ...spot.door, orient: spot.orient });
    }
    if (rooms.length < normalCount) return null;

    // Ligações extras entre salas vizinhas criam voltas no mapa.
    const extra = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const linked = links.some((l) => (l.a === i && l.b === j) || (l.a === j && l.b === i));
        const gap = linked ? null : sharedGap(rooms[i], rooms[j]);
        if (gap) extra.push({ a: i, b: j, gap });
      }
    }
    rng.shuffle(extra);
    for (const e of extra.slice(0, cfg.loops)) {
      const cell = rng.pick(e.gap.cells);
      links.push({ a: e.a, b: e.b, x: cell.x, y: cell.y, orient: e.gap.orient });
    }

    // A saída fica na sala mais distante da entrada.
    const dist = roomDistances(rooms.length, links, 0);
    const far = Math.max(...dist.slice(1));
    const exitRoom = rooms[rng.pick(dist.map((d, i) => (d === far && i > 0 ? i : -1)).filter((i) => i > 0))];
    exitRoom.kind = 'exit';

    // Sala do tesouro: sempre um beco sem saída ligado a uma única porta.
    let treasure = null;
    for (const parent of rng.shuffle(rooms.slice())) {
      for (const side of rng.shuffle([0, 1, 2, 3])) {
        for (let k = 0; k < 4 && !treasure; k++) {
          const spot = placeAdjacent(rng, parent, side, TREASURE_TEMPLATE[1], TREASURE_TEMPLATE[0]);
          if (!rooms.every((r) => separated(r, spot.room))) continue;
          treasure = { id: rooms.length, ...spot.room, kind: 'treasure' };
          rooms.push(treasure);
          links.push({ a: parent.id, b: treasure.id, ...spot.door, orient: spot.orient });
        }
        if (treasure) break;
      }
      if (treasure) break;
    }
    if (!treasure) return null;

    // Normaliza as coordenadas e monta a grade (com uma moldura de parede).
    const minX = Math.min(...rooms.map((r) => r.x)) - 1;
    const minY = Math.min(...rooms.map((r) => r.y)) - 1;
    const maxX = Math.max(...rooms.map((r) => r.x + r.w));
    const maxY = Math.max(...rooms.map((r) => r.y + r.h));
    for (const r of rooms) {
      r.x -= minX;
      r.y -= minY;
    }
    for (const l of links) {
      l.x -= minX;
      l.y -= minY;
    }

    const floor = {
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      grid: [],
      rooms,
      doors: [],
      chests: [],
      start: null,
      exit: null,
    };
    for (let y = 0; y < floor.h; y++) {
      floor.grid.push(Array.from({ length: floor.w }, () => ({ type: 'void', room: null, ref: null })));
    }
    for (const r of rooms) {
      for (let y = r.y - 1; y <= r.y + r.h; y++) {
        for (let x = r.x - 1; x <= r.x + r.w; x++) {
          const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
          const cell = floor.grid[y][x];
          if (inside) {
            cell.type = 'floor';
            cell.room = r.id;
          } else if (cell.type === 'void') {
            cell.type = 'wall';
          }
        }
      }
    }
    for (const l of links) {
      const door = { id: floor.doors.length, x: l.x, y: l.y, orient: l.orient, a: l.a, b: l.b, cost: null, open: false };
      floor.doors.push(door);
      floor.grid[l.y][l.x] = { type: 'door', room: null, ref: door.id };
    }

    // Baú: de preferência no meio da parede de cima, sem tampar a porta.
    const t = treasure;
    const chestSpots = [
      [t.x + 1, t.y],
      ...rng.shuffle([
        [t.x + 1, t.y + 2],
        [t.x, t.y + 1],
        [t.x + 2, t.y + 1],
      ]),
    ];
    const spot = chestSpots.find(([x, y]) => !doorAdjacent(floor, x, y));
    if (!spot) return null;
    const chest = { id: 0, x: spot[0], y: spot[1], cost: null, open: false };
    floor.chests.push(chest);
    floor.grid[chest.y][chest.x] = { type: 'chest', room: t.id, ref: chest.id };

    const [sx, sy] = pickCorner(rng, floor, rooms[0]);
    floor.grid[sy][sx].type = 'start';
    floor.start = { x: sx, y: sy };
    const [ex, ey] = pickCorner(rng, floor, exitRoom);
    floor.grid[ey][ex].type = 'exit';
    floor.exit = { x: ex, y: ey };

    for (const d of floor.doors) d.cost = drawCost();
    chest.cost = drawCost();
    return floor;
  }

  // Andar fixo do tutorial (sem seed): um retângulo horizontal com a sala de início à esquerda,
  // uma porta no meio e uma sala pequena com a escada de saída à direita. Grade 13 × 5.
  //
  //   #############
  //   #.......#..>#
  //   #.......D...#      D = porta, > = saída, @ = início
  //   #@......#...#
  //   #############
  function tutorialFloor(cost) {
    const w = 13;
    const h = 5;
    const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ type: 'wall', room: null, ref: null })));
    const rooms = [
      { id: 0, x: 1, y: 1, w: 7, h: 3, kind: 'start' },
      { id: 1, x: 9, y: 1, w: 3, h: 3, kind: 'exit' },
    ];
    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = { type: 'floor', room: r.id, ref: null };
      }
    }
    const door = { id: 0, x: 8, y: 2, orient: 'v', a: 0, b: 1, cost, open: false };
    grid[door.y][door.x] = { type: 'door', room: null, ref: door.id };
    const start = { x: 1, y: 3 };
    const exit = { x: 11, y: 1 };
    grid[start.y][start.x].type = 'start';
    grid[exit.y][exit.x].type = 'exit';
    return { w, h, grid, rooms, doors: [door], chests: [], enemies: [], start, exit };
  }

  // Segundo andar do treino: uma sala comprida, e um inimigo ao lado da escada (alcance 1). Chegar na escada
  // é entrar na zona dele, então só dá para passar lutando. `cards` são as cartas dele (as duas à vista).
  function tutorialFloor2(cards) {
    const w = 13;
    const h = 5;
    const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ type: 'wall', room: null, ref: null })));
    const rooms = [{ id: 0, x: 1, y: 1, w: 11, h: 3, kind: 'start' }];
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 11; x++) grid[y][x] = { type: 'floor', room: 0, ref: null };
    }
    const start = { x: 1, y: 2 };
    const exit = { x: 11, y: 2 };
    grid[start.y][start.x].type = 'start';
    grid[exit.y][exit.x].type = 'exit';
    const enemy = {
      id: 0,
      x: 10,
      y: 2,
      room: 0,
      range: 1,
      blocks: true,
      kind: 'skeleton1',
      cards,
      hidden: [],
      down: [],
      dead: false,
      scroll: false,
    };
    return { w, h, grid, rooms, doors: [], chests: [], enemies: [enemy], start, exit };
  }

  function generateFloor(rng, cfg, drawCost) {
    for (let i = 0; i < 200; i++) {
      const floor = tryBuild(rng, cfg, drawCost);
      if (floor) return floor;
    }
    throw new Error('Não foi possível gerar o andar');
  }

  // Inimigo vivo cuja zona de ataque inclui a casa. A zona é a distância em cruz até `range`,
  // mas só dentro da sala dele: não atravessa paredes para a sala ao lado.
  function inZone(enemy, cell, x, y) {
    if (!cell || (enemy.room !== undefined && cell.room !== enemy.room)) return false;
    return Math.abs(enemy.x - x) + Math.abs(enemy.y - y) <= enemy.range;
  }

  function enemyAt(floor, x, y) {
    if (!floor.enemies) return null;
    const cell = cellAt(floor, x, y);
    return floor.enemies.find((e) => !e.dead && inZone(e, cell, x, y)) || null;
  }

  // Casas da zona de ataque de um inimigo (as que existem no mapa e ficam na sala dele).
  function enemyZone(floor, enemy) {
    const cells = [];
    for (let dy = -enemy.range; dy <= enemy.range; dy++) {
      for (let dx = -enemy.range; dx <= enemy.range; dx++) {
        const x = enemy.x + dx;
        const y = enemy.y + dy;
        const cell = cellAt(floor, x, y);
        if (cell && inZone(enemy, cell, x, y)) cells.push({ x, y, cell });
      }
    }
    return cells;
  }

  // A zona do inimigo corta a sala? Verdadeiro quando a sala tem 2 ou mais casas de entrada
  // (casas encostadas numa porta) e, sem passar pela zona, não dá para ir de uma a outra.
  function blocksRoom(floor, room, enemy) {
    const zone = new Set(enemyZone(floor, enemy).map((z) => z.y * floor.w + z.x));
    const entrances = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (floor.grid[y][x].type === 'floor' && doorAdjacent(floor, x, y)) entrances.push({ x, y });
      }
    }
    if (entrances.length < 2) return false;
    const seen = new Set([entrances[0].y * floor.w + entrances[0].x]);
    const queue = [entrances[0]];
    while (queue.length) {
      const cur = queue.shift();
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = ny * floor.w + nx;
        const cell = cellAt(floor, nx, ny);
        if (!cell || cell.type !== 'floor' || cell.room !== room.id || seen.has(key) || zone.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    return !entrances.every((c) => seen.has(c.y * floor.w + c.x));
  }

  // Casas de uma sala onde um inimigo de alcance `range` pode ficar: a zona dele só pode
  // pegar casas livres que não sejam a casa logo depois de uma porta (nem portas, escadas ou
  // baú). Assim entrar numa sala é sempre livre.
  function enemyCandidates(floor, room, range) {
    const candidates = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (floor.grid[y][x].type !== 'floor') continue;
        const enemy = { x, y, room: room.id, range };
        const clear = enemyZone(floor, enemy).every(({ x: zx, y: zy, cell }) => cell.type === 'floor' && !doorAdjacent(floor, zx, zy));
        if (clear) candidates.push(enemy);
      }
    }
    return candidates;
  }

  // Escolhe onde ficam os inimigos: salas comuns (nunca a inicial, a da saída ou a do tesouro),
  // uma por inimigo. Uma parte deles (wide.chance) tem alcance maior (wide.range): quando a sala
  // permite, ficam num ponto que corta a passagem entre as portas, e aí só dá para atravessar
  // lutando (ou fugindo). Devolve [{ x, y, room, range, blocks }] (menos que `count` se faltar lugar).
  function placeEnemies(rng, floor, count, range, wide = null) {
    const spots = [];
    const rooms = rng.shuffle(floor.rooms.filter((r) => r.kind === 'normal'));
    for (const room of rooms) {
      if (spots.length >= count) break;
      let pick = null;
      if (wide && rng.next() < wide.chance) {
        const options = enemyCandidates(floor, room, wide.range).map((e) => ({ ...e, blocks: blocksRoom(floor, room, e) }));
        const blockers = options.filter((o) => o.blocks);
        const pool = blockers.length ? blockers : options;
        if (pool.length) pick = rng.pick(pool);
      }
      if (!pick) {
        const options = enemyCandidates(floor, room, range);
        if (options.length) pick = { ...rng.pick(options), blocks: false };
      }
      if (pick) spots.push(pick);
    }
    return spots;
  }

  // Onde ficam os inimigos pequenos (ratos): em qualquer sala menos a inicial, até 2 por sala, numa casa
  // livre cuja zona não pegue portas, escadas, baú nem a zona de outro inimigo (nem casas proibidas, como as
  // de pergaminhos e armadilhas), e que não tranque a sala. Devolve [{ x, y, room, range, blocks }].
  function placeSmall(rng, floor, count, range, forbidden = null) {
    const keyOf = (x, y) => y * floor.w + x;
    const zoneKeys = (e) => new Set(enemyZone(floor, e).map((z) => keyOf(z.x, z.y)));
    const used = (floor.enemies || []).filter((e) => !e.dead).map((e) => zoneKeys(e));
    const perRoom = new Map();
    const spots = [];
    const rooms = rng.shuffle(floor.rooms.filter((r) => r.kind !== 'start'));
    for (let pass = 0; pass < 2 && spots.length < count; pass++) {
      for (const room of rooms) {
        if (spots.length >= count) break;
        if ((perRoom.get(room.id) || 0) > pass) continue;
        const options = enemyCandidates(floor, room, range).filter((c) => {
          const keys = zoneKeys(c);
          if (forbidden && [...keys].some((k) => forbidden(k % floor.w, Math.floor(k / floor.w)))) return false;
          if (used.some((u) => [...keys].some((k) => u.has(k)))) return false;
          return !blocksRoom(floor, room, c);
        });
        if (!options.length) continue;
        const pick = rng.pick(options);
        spots.push({ ...pick, blocks: false });
        used.push(zoneKeys(pick));
        perRoom.set(room.id, (perRoom.get(room.id) || 0) + 1);
      }
    }
    return spots;
  }

  // Onde uma comida (ou uma armadilha) pode ficar no chão: numa sala comum ou na do tesouro (nunca a inicial
  // nem a da saída, para valer um desvio), numa casa livre fora das zonas dos inimigos e longe das portas.
  function placePickup(rng, floor, taken = null) {
    const rooms = floor.rooms.filter((r) => r.kind === 'normal' || r.kind === 'treasure');
    const spots = [];
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (floor.grid[y][x].type !== 'floor' || doorAdjacent(floor, x, y) || (taken && taken(x, y))) continue;
          if ((floor.enemies || []).some((e) => inZone(e, floor.grid[y][x], x, y))) continue;
          spots.push({ x, y });
        }
      }
    }
    return spots.length ? rng.pick(spots) : null;
  }

  function isWalkable(cell) {
    if (!cell) return false;
    if (cell.type === 'floor' || cell.type === 'start' || cell.type === 'exit') return true;
    return false;
  }

  // Busca em largura até maxSteps casas. A saída encerra o movimento (não dá
  // para atravessá-la) e portas fechadas e baús bloqueiam o caminho.
  function reach(floor, from, maxSteps) {
    const key = (x, y) => y * floor.w + x;
    const found = new Map();
    found.set(key(from.x, from.y), { x: from.x, y: from.y, dist: 0, prev: null });
    const queue = [found.get(key(from.x, from.y))];
    while (queue.length) {
      const cur = queue.shift();
      if (cur.dist >= maxSteps) continue;
      if (cur.dist > 0 && floor.grid[cur.y][cur.x].type === 'exit') continue;
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const cell = cellAt(floor, nx, ny);
        if (!cell || found.has(key(nx, ny))) continue;
        const passable = isWalkable(cell) || (cell.type === 'door' && floor.doors[cell.ref].open);
        if (!passable) continue;
        const node = { x: nx, y: ny, dist: cur.dist + 1, prev: key(cur.x, cur.y) };
        found.set(key(nx, ny), node);
        queue.push(node);
      }
    }
    return found;
  }

  function pathTo(floor, found, x, y) {
    const path = [];
    let node = found.get(y * floor.w + x);
    while (node) {
      path.unshift({ x: node.x, y: node.y });
      node = node.prev === null ? null : found.get(node.prev);
    }
    return path;
  }

  // Portas fechadas e baús fechados encostados na posição dada.
  function adjacentTargets(floor, pos) {
    const targets = [];
    for (const [dx, dy] of DIRS) {
      const x = pos.x + dx;
      const y = pos.y + dy;
      const cell = cellAt(floor, x, y);
      if (!cell) continue;
      if (cell.type === 'door' && !floor.doors[cell.ref].open) {
        targets.push({ kind: 'door', x, y, obj: floor.doors[cell.ref] });
      } else if (cell.type === 'chest' && !floor.chests[cell.ref].open) {
        targets.push({ kind: 'chest', x, y, obj: floor.chests[cell.ref] });
      }
    }
    return targets;
  }

  Object.assign(DC, { generateFloor, tutorialFloor, tutorialFloor2, cellAt, reach, pathTo, adjacentTargets, placeEnemies, placeSmall, placePickup, enemyAt, enemyZone, blocksRoom, DIRS });
})(typeof window !== 'undefined' ? window : globalThis);
