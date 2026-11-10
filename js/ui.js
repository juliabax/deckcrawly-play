(function () {
  const DC = window.DC;
  const VS = '︎'; // força o naipe como texto (e não emoji)
  const sym = (suit) => DC.SUIT_SYMBOL[suit] + VS;
  const isRed = (suit) => suit === 'H' || suit === 'D';
  const label = (card) => `${DC.rankLabel(card.rank)}${sym(card.suit)}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const htmlToEl = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  // Termina (ou é cancelada) uma animação sem deixar erro solto no console.
  const afterAnim = (anim, fn) => anim.finished.then(fn, fn);

  const SUIT_HINT = {
    S: 'Em combate vale o número ou o dobro: casa com os dois valores.',
    H: 'Poder: compra até N cartas (N = número da carta).',
    D: 'Ao andar, o número da carta vale em dobro.',
    C: 'Coringa: vale o próprio número, ou copia o rank de outra carta da mão se você escolher.',
  };

  const CHEST_SVG = (open) =>
    open
      ? `<svg class="chest" viewBox="0 0 32 32"><path d="M5 13 L8 3 L24 3 L27 13 Z" fill="#c9923a" stroke="#4a2f0d" stroke-width="2"/><rect x="4" y="13" width="24" height="14" rx="2" fill="#2a1a0a" stroke="#4a2f0d" stroke-width="2"/><path d="M8 18h16" stroke="#e7b84a" stroke-width="3" stroke-linecap="round"/></svg>`
      : `<svg class="chest" viewBox="0 0 32 32"><rect x="4" y="12" width="24" height="15" rx="2" fill="#b07a2a" stroke="#4a2f0d" stroke-width="2"/><path d="M4 14 Q16 0 28 14 Z" fill="#c9923a" stroke="#4a2f0d" stroke-width="2"/><rect x="14" y="14" width="4" height="7" fill="#e7b84a" stroke="#4a2f0d"/></svg>`;

  // Baú da janela de recompensa: a tampa sobe e a luz de dentro aparece.
  const CHEST_BIG_SVG = `<svg viewBox="0 0 96 64" aria-hidden="true">
    <ellipse class="glow" cx="48" cy="30" rx="34" ry="14" fill="#ffd76a" />
    <rect x="12" y="30" width="72" height="30" rx="4" fill="#b07a2a" stroke="#4a2f0d" stroke-width="3" />
    <rect x="12" y="38" width="72" height="5" fill="#8a5d1c" />
    <rect x="43" y="34" width="10" height="14" rx="2" fill="#e7b84a" stroke="#4a2f0d" stroke-width="2" />
    <g class="lid"><path d="M10 30 Q48 -6 86 30 Z" fill="#c9923a" stroke="#4a2f0d" stroke-width="3" stroke-linejoin="round" /><path d="M24 24 Q48 4 72 24" fill="none" stroke="#e7b84a" stroke-width="3" stroke-linecap="round" /></g>
  </svg>`;

  // Inimigo no mapa: carinha com chifres. As cartas que faltam derrubar ficam embaixo.
  const ENEMY_SVG = `<svg class="enemy" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 12 L4 2 L13 8 Z M25 12 L28 2 L19 8 Z" fill="#cfc8dc" stroke="#2a0f0f" stroke-width="1.5" stroke-linejoin="round" /><circle cx="16" cy="17" r="10" fill="#8a2f2f" stroke="#2a0f0f" stroke-width="2" /><circle cx="12.3" cy="15.5" r="2.3" fill="#ffd76a" /><circle cx="19.7" cy="15.5" r="2.3" fill="#ffd76a" /><path d="M10.5 21.5 L12.8 25 L15 21.5 L17 25 L19.2 21.5 L21.5 25" fill="none" stroke="#f6f0e4" stroke-width="1.6" stroke-linejoin="round" /></svg>`;

  // Ícone de pergaminho enrolado (slot bloqueado).
  const SCROLL_SVG = `<svg class="scroll-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h11a2 2 0 0 1 2 2V16a3 3 0 0 0 3 3H9a3 3 0 0 1-3-3V5a1.5 1.5 0 0 1 1-1.5z" fill="#e8dcc0" stroke="#6b4e22" stroke-width="1.3" stroke-linejoin="round" /><path d="M6 5a2 2 0 1 0-2 2h2M9 19a3 3 0 0 1-3-3" fill="none" stroke="#6b4e22" stroke-width="1.3" stroke-linecap="round" /><path d="M10 8h7M10 11h7M10 14h5" stroke="#a88a52" stroke-width="1.2" stroke-linecap="round" /></svg>`;

  // Comida do experimento Baralho Finito: Maçã (3 cartas novas) e Bife (5), desenhadas no mesmo estilo dos outros ícones.
  const APPLE_SVG = `<svg class="food-ico apple" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5c-2.2-1.7-6.2-1.3-7.3 2.3C3.5 13.6 6 20.4 9 20.8c1 .1 1.9-.5 3-.5s2 .6 3 .5c3-.4 5.5-7.200 4.300-11C18.200 6.200 14.200 5.800 12 7.500z" fill="#d6403a" stroke="#5e1a17" stroke-width="1.3" stroke-linejoin="round" /><path d="M12 7.500c0-2 .8-3.400 2.300-4.300" fill="none" stroke="#5b3a1e" stroke-width="1.5" stroke-linecap="round" /><path d="M13.200 4.800c1.500-1.300 3.500-1 4.100-.5-.4 1.600-2.300 2.400-4.100.5z" fill="#62b04f" stroke="#2f6b2a" stroke-width="1" stroke-linejoin="round" /><path d="M7.800 10.500c.3-1 1.100-1.700 2-1.800" fill="none" stroke="#f7a8a0" stroke-width="1.300" stroke-linecap="round" /></svg>`;
  const STEAK_SVG = `<svg class="food-ico steak" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.800 11.500C3.200 7.700 6.200 4.700 10.200 4.200c3.800-.5 7.800 1 9.400 4.300 1.400 3-.1 6.700-2.900 8.500-3.100 2-8.200 1.800-10.700-1.300-.9-1-1.600-2.300-2.200-4.200z" fill="#f4cfc4" stroke="#612620" stroke-width="1.300" stroke-linejoin="round" /><path d="M6.200 11.200c-.3-2.800 1.800-4.900 4.800-5.200 2.800-.3 5.700.8 6.900 3.200.9 2.200 0 4.800-2 6-2.400 1.400-6.200 1.200-7.900-.9-.9-.9-1.600-2-1.800-3.100z" fill="#b53c34" /><path d="M8.700 9.300l5.200 4.400M10.800 7.700l5.200 4.400" fill="none" stroke="#7c201c" stroke-width="1.200" stroke-linecap="round" /><circle cx="8.800" cy="14.200" r="1.500" fill="#f3e6cf" stroke="#86704a" stroke-width=".8" /></svg>`;
  const FOOD_SVG = { normal: APPLE_SVG, gold: STEAK_SVG };

  // Anel: aro dourado com uma pedra da cor do anel; os anéis de naipe levam o símbolo do naipe na pedra.
  function ringSVG(key) {
    const def = DC.ROGUE.RINGS[key];
    const glyph = def.suit ? `<text x="12" y="10.4" text-anchor="middle" font-size="7.5" font-weight="900" fill="#1b1424">${DC.SUIT_SYMBOL[def.suit]}</text>` : '';
    return `<svg class="ring-ico" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="15" rx="7.200" ry="6.200" fill="none" stroke="#7a5a1c" stroke-width="3.600" /><ellipse cx="12" cy="15" rx="7.200" ry="6.200" fill="none" stroke="#f1c75a" stroke-width="2.200" /><path d="M8.200 5.600 12 2.200l3.800 3.400L12 9.800z" fill="${def.color}" stroke="#2a2118" stroke-width="1" stroke-linejoin="round" />${glyph}<path d="M9.600 5.400 12 3.400" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round" /></svg>`;
  }

  // Número com sinal: +1 / −1.
  const signed = (n) => (n > 0 ? '+' : '−') + Math.abs(n);

  // Desenhos das salas especiais (mesmo estilo dos outros ícones): poço (a cor da água é a do poço), altar e estante.
  const WELL_WATER = { azul: '#4da3ff', verde: '#4fbf7a', dourada: '#e7b84a' };
  function fixtureSVG(fx) {
    const dim = fx.used ? ' used' : '';
    if (fx.kind === 'well') {
      const water = fx.used ? '#3a3f4f' : WELL_WATER[fx.look] || '#4da3ff';
      return `<svg class="fixture well${dim}" viewBox="0 0 32 32"><ellipse cx="16" cy="20" rx="12.500" ry="8" fill="#6b6f80" stroke="#2a2d3a" stroke-width="2"/><ellipse cx="16" cy="18.500" rx="9.500" ry="5.500" fill="${water}" stroke="#2a2d3a" stroke-width="1.500"/>${fx.used ? '' : '<path d="M10.500 17.500q2.800-2 5.500 0t5.500 0" stroke="#fff" stroke-opacity=".7" fill="none" stroke-width="1.300" stroke-linecap="round"/>'}</svg>`;
    }
    if (fx.kind === 'altar') {
      const flame = fx.used ? '' : '<path d="M16 3.500c3 4 5 5.500 5 8.500a5 5 0 0 1-10 0c0-3 2-4.500 5-8.500z" fill="#ff8a3d" stroke="#7a2e0c" stroke-width="1.300"/><path d="M16 9c1.500 2 2.300 2.800 2.300 4.300a2.300 2.300 0 0 1-4.600 0C13.700 11.800 14.500 11 16 9z" fill="#ffd76a"/>';
      return `<svg class="fixture altar${dim}" viewBox="0 0 32 32"><rect x="5.500" y="19" width="21" height="9" rx="2" fill="#8c8aa0" stroke="#2a2d3a" stroke-width="2"/><rect x="3" y="15" width="26" height="5.500" rx="2" fill="#a9a7bd" stroke="#2a2d3a" stroke-width="2"/>${flame}</svg>`;
    }
    if (fx.kind === 'crypt') {
      const glow = fx.used ? '' : '<circle cx="16" cy="9" r="4.500" fill="#b8f0d8" fill-opacity=".35"/>';
      return `<svg class="fixture crypt${dim}" viewBox="0 0 32 32">${glow}<path d="M9 28V12a7 7 0 0 1 14 0v16z" fill="#8c8aa0" stroke="#2a2d3a" stroke-width="2"/><rect x="5" y="26" width="22" height="3.500" rx="1" fill="#6b6f80" stroke="#2a2d3a" stroke-width="1.500"/><path d="M16 9v9M12.500 12.500h7" stroke="#2a2d3a" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
    if (fx.kind === 'table') {
      return `<svg class="fixture table${dim}" viewBox="0 0 32 32"><ellipse cx="16" cy="19" rx="14" ry="9" fill="#2f7a4d" stroke="#173d27" stroke-width="2"/><ellipse cx="16" cy="19" rx="10.500" ry="6" fill="none" stroke="#7fd09e" stroke-opacity=".5" stroke-width="1"/><g transform="rotate(-14 12 16)"><rect x="7.500" y="9" width="8" height="11" rx="1.200" fill="#f6efe0" stroke="#3a2f22" stroke-width="1.200"/><text x="11.500" y="17" text-anchor="middle" font-size="7" font-weight="900" fill="#b4352e">♥</text></g><g transform="rotate(12 21 16)"><rect x="17" y="10" width="8" height="11" rx="1.200" fill="#f6efe0" stroke="#3a2f22" stroke-width="1.200"/><text x="21" y="18" text-anchor="middle" font-size="7" font-weight="900" fill="#1f1f2b">♠</text></g></svg>`;
    }
    if (fx.kind === 'forge') {
      const spark = fx.used ? '' : '<path d="M22.500 4l1 2.800L26 8l-2.500 1.200-1 2.800-1-2.800L19 8l2.500-1.200z" fill="#ffd76a" stroke="#7a4a0c" stroke-width=".8"/><circle cx="12" cy="9" r="1.200" fill="#ff8a3d"/>';
      return `<svg class="fixture forge${dim}" viewBox="0 0 32 32">${spark}<path d="M5 14h18l4-3v6l-4-1H17v4l3 1v3H10v-3l3-1v-4H7z" fill="#7d8398" stroke="#262a38" stroke-width="2" stroke-linejoin="round"/><rect x="8" y="26" width="16" height="3" rx="1" fill="#5b4a3a" stroke="#262a38" stroke-width="1.500"/></svg>`;
    }
    const books = (y, colors) => colors.map((c, i) => `<rect x="${6.500 + i * 4.600}" y="${y}" width="3.800" height="8" rx=".8" fill="${c}" stroke="#2f1d0c" stroke-width=".9"/>`).join('');
    return `<svg class="fixture library${dim}" viewBox="0 0 32 32"><rect x="4" y="3.500" width="24" height="25" rx="2" fill="#6b4a2a" stroke="#2f1d0c" stroke-width="2"/><path d="M5 16h22" stroke="#2f1d0c" stroke-width="2"/>${books(7, ['#c0453c', '#e7b84a', '#4a7fc0', '#6fcf97', '#b48cf2'])}${books(19, ['#e7b84a', '#c0453c', '#6fcf97', '#4a7fc0', '#e8dcc0'])}</svg>`;
  }

  function miniHTML(card) {
    return `<span class="mini ${isRed(card.suit) ? 'red' : 'black'}"><b>${DC.rankLabel(card.rank)}</b><i>${sym(card.suit)}</i></span>`;
  }

  function cardHTML(card, o = {}) {
    const lbl = DC.rankLabel(card.rank);
    const s = sym(card.suit);
    const cls = ['card', isRed(card.suit) ? 'red' : 'black', card.suit === 'C' ? 'joker' : '', o.small ? 'small' : '', o.selected ? 'sel' : '', o.extra || '']
      .filter(Boolean)
      .join(' ');
    const badge = o.badge ? `<span class="badge">${o.badge}</span>` : '';
    return `<div class="${cls}" data-id="${card.id}" title="${lbl}${DC.SUIT_SYMBOL[card.suit]} — ${SUIT_HINT[card.suit]}">
      <div class="corner tl"><b>${lbl}</b><i>${s}</i></div>
      <div class="pip">${s}</div>
      <div class="corner br"><b>${lbl}</b><i>${s}</i></div>${badge}</div>`;
  }

  const remainingEnemyCards = (enemy) => enemy.cards.filter((c) => !enemy.down.includes(c.id));
  // Carta travada: ainda tem carta de pé na frente dela (fica virada de costas).
  const coversLeft = (enemy, card) => ((enemy.cover && enemy.cover[card.id]) || []).filter((id) => !enemy.down.includes(id)).length;
  const isHiddenCard = (enemy, card) => coversLeft(enemy, card) > 0;
  const MINI_BACK = '<span class="mini back"></span>';

  // Visual clássico (sem a pixel art): a escada de entrada parece vir de cima (luz e degraus que descem até você)
  // e a de saída é um buraco escuro com degraus que afundam. Com a arte, valem as peças de js/art.js.
  const STAIR_UP_SVG = `<svg class="stair up" viewBox="0 0 32 32" aria-hidden="true">
    <defs><linearGradient id="stair-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2" stop-opacity="0.95"/><stop offset="0.7" stop-color="#fff6c2" stop-opacity="0.12"/><stop offset="1" stop-color="#fff6c2" stop-opacity="0"/></linearGradient></defs>
    <rect width="32" height="32" fill="url(#stair-light)"/>
    <rect x="9" y="0" width="14" height="3" fill="#ffffff" opacity="0.9"/>
    <path d="M11 3h10l1 5H10z" fill="#efe6cc"/><path d="M10 8h12l1 1.6H9z" fill="#8b7d62"/>
    <path d="M9 9.6h14l1 5.4H8z" fill="#e2d6b8"/><path d="M8 15h16l1 1.6H7z" fill="#7d6f55"/>
    <path d="M7 16.6h18l1 5.4H6z" fill="#d4c7a8"/><path d="M6 22h20l1 1.6H5z" fill="#6f6249"/>
    <path d="M5 23.6h22l1 6.4H4z" fill="#c6b999"/>
  </svg>`;
  const STAIR_DOWN_SVG = `<svg class="stair down" viewBox="0 0 32 32" aria-hidden="true">
    <defs><linearGradient id="stair-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs>
    <path d="M4 3h24v5H4z" fill="#cfc3a8"/><path d="M4 8h24v1.6H4z" fill="#6f6249"/>
    <path d="M7 9.6h18v5H7z" fill="#a89c82"/><path d="M7 14.6h18v1.6H7z" fill="#5a4f3b"/>
    <path d="M10 16.2h12v5H10z" fill="#7d725c"/><path d="M10 21.2h12v1.6H10z" fill="#43392b"/>
    <path d="M12 22.8h8v5H12z" fill="#4f4637"/>
    <rect width="32" height="32" fill="url(#stair-dark)"/>
  </svg>`;
  const ENEMY_NAME = { skeleton1: 'Skelly', skeleton2: 'Esqueleto', vampire: 'Vampiro', rat: 'Rato' };
  // Rato (inimigo pequeno de 1 carta): desenhado em SVG nos dois visuais, até ganhar pixel art própria.
  const RAT_SVG = `<svg class="rat-ico" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 22c-3-.5-5-3-4-6.500 .4-1.400 2-1.600 2.300-.3" fill="none" stroke="#e8a3a3" stroke-width="2" stroke-linecap="round" /><ellipse cx="14.500" cy="21" rx="10" ry="6.500" fill="#8f8a98" stroke="#2a2430" stroke-width="1.500" /><path d="M21.500 15.500c3-1.300 7.500.7 8.500 4-.9 2.200-5 3.200-8.500 2z" fill="#a8a3b1" stroke="#2a2430" stroke-width="1.500" stroke-linejoin="round" /><circle cx="21" cy="14.500" r="3.400" fill="#e8a3a3" stroke="#2a2430" stroke-width="1.200" /><circle cx="26" cy="18.500" r="1.200" fill="#ffd76a" stroke="#2a2430" stroke-width=".5" /><circle cx="30" cy="20" r="1.100" fill="#f08a9a" /><path d="M27.500 21.500l-3.500 1.200M27.500 22.500l-3 2" stroke="#2a2430" stroke-width=".8" stroke-linecap="round" /><path d="M9 26.500l-1.500 2M14 27.500l-.5 2.500M19 27l.5 2.500" stroke="#2a2430" stroke-width="1.500" stroke-linecap="round" /></svg>`;

  // O zoom é um tamanho FIXO de casa, em pixels: 100% = 40 px, sempre, em qualquer andar, janela ou aparelho.
  // Todos os valores são múltiplos de 8, então a pixel art fica nítida e cada passo do zoom muda de verdade.
  const ZOOM_BASE = 40;
  const ZOOM_TILES = [24, 32, 40, 48, 64, 80, 120]; // 60%, 80%, 100%, 120%, 160%, 200%, 300%
  const DEFAULT_ZOOM = 2; // índice em ZOOM_TILES: 100%
  const LOW_DECK = 5; // com tantas cartas ou menos, o deck do jogador pisca como aviso
  const PAN_GAP = 10; // folga escura (em casas) que dá para arrastar além da borda do mapa

  class UI {
    constructor() {
      const $ = (id) => document.getElementById(id);
      this.el = {
        map: $('map'),
        mapWrap: $('map-wrap'),
        piles: $('piles'),
        panel: $('panel'),
        log: $('log'),
        hand: $('hand'),
        overlay: $('overlay'),
        combat: $('combat'),
        toast: $('toast'),
        floor: $('hud-floor'),
        turn: $('hud-turn'),
        hunger: $('hud-hunger'),
        seed: $('hud-seed'),
        fx: $('fx'),
        stash: $('stash'),
        gear: $('gear'),
        power: $('power'),
      };
      // Um index.html antigo em cache não tem a cena de combate: cria no lugar (o resto do jogo não depende disso).
      if (!this.el.combat) {
        this.el.combat = document.createElement('div');
        this.el.combat.id = 'combat';
        this.el.combat.className = 'cscene';
        this.el.combat.hidden = true;
        this.el.mapWrap.appendChild(this.el.combat);
      }
      this.sel = [];
      this.busy = false;
      this.help = false;
      this.resetOverlayState();
      this.runSplash();
      this.tile = 40;
      this.tileEls = [];
      this.reachMap = null;
      this.fog = this.loadFog();
      this.zoom = this.loadZoom();
      this.fxOn = this.loadFx();
      this.syncFxButton();
      this.tapTile = null; // casa com o caminho em prévia (toque): o segundo toque anda
      this.setTouch(this.detectTouch());
      this.sfx = new DC.Sfx();
      this.syncSoundButton();
      this.artAvailable = false; // as imagens existem e carregaram
      this.artOn = this.loadArt();
      DC.art.preload().then((ok) => {
        this.artAvailable = ok;
        this.syncArt();
      });
      this.tensionOn = false;
      this.lowDeckOn = false;
      this.foeHit = false;
      this.revealIds = []; // cartas do inimigo que acabaram de desvirar (animação)
      this.newSlot = -1; // slot que acabou de ser liberado por um pergaminho (animação)
      this.fxEnter = null; // de onde a carta que volta do slot "sai" (padrão: a pilha do deck)
      this.handReset = true; // a primeira mão é "dada" com animação, sem comparar com a anterior
      this.lastCounts = null;
      this.fxExit = null; // para onde as cartas gastas voam (padrão: o descarte)
      this.fxOrigin = null; // casa de onde a névoa se abre
      this.fxHold = 0; // atraso para o modal esperar os efeitos
      this.camera = { tx: 0, ty: 0 }; // onde o mapa está na tela agora
      this.view = null; // posição escolhida arrastando; null = seguir o personagem
      this.cameraKey = '';
      this.dragging = false;
      this.fxDrawStep = 0; // intervalo entre cartas compradas (♠ compra em rajada)
      this.fxBumpDelay = null; // atraso do "pulo" dos contadores das pilhas
      this.lastOverlay = '';
      this.overlayFresh = false;
      this.overlayTimer = null;
      this.prevOpen = new Set();
      this.prevShown = new Set();
      this.shownFloor = null;
      this.toastTimer = null;
      let storage = null;
      try {
        storage = window.localStorage;
      } catch (e) {
        /* sem armazenamento: o tutorial vale só nesta visita */
      }
      this.tutor = new DC.Tutorial(storage);
      this.stats = new DC.Stats();
      this.hint = null; // dica de cartão em exibição
      this.hintQueue = ''; // dica que um evento pediu (ex.: pergaminho)
      this.tipHTML = ''; // dica dentro da janela aberta
      this.notes = {}; // respostas das perguntas do fim da partida
      this.reportView = false; // janela com o texto do relatório (quando não dá para copiar sozinho)
      this.el.coach = $('coach');
      this.el.intro = $('intro');
      this.intro = { on: false, mode: '', scene: -1, timer: 0, typing: false, chars: [], key: null, spotId: '', scenes: [] };
      this.spotSeen = new Set(); // avisos de foco que já tocaram nesta rodada do tutorial
      this.el.notice = $('notice');
      this.bind();
      this.showNotice();
      // Na primeira visita (ou com ?tutorial) o jogo começa pelo andar fixo de treino; a masmorra
      // de verdade (com a seed do endereço, se houver) vem depois dele.
      const params = new URLSearchParams(location.search);
      this.nextSeed = params.get('seed');
      if (params.has('tutorial')) this.tutor.restart();
      this.newGame(this.tutor.active ? null : this.nextSeed, this.tutor.active);
    }

    resetOverlayState() {
      this.discard = new Set();
      this.picks = new Set();
      this.targets = new Set(); // cartas do inimigo marcadas para o ataque de um ♠
      this.libKey = null; // pergaminho escolhido na biblioteca
      this.cryptTake = new Set(); // cartas do cemitério marcadas na cripta
      this.forgeTarget = null; // oficina: carta a melhorar
      this.forgeBurn = null; // oficina: carta a queimar
    }

    // Cartas do inimigo que dá para tirar agora (de pé e abertas, sem carta na frente).
    foeTargets(enemy) {
      return enemy ? enemy.cards.filter((c) => !enemy.down.includes(c.id) && !isHiddenCard(enemy, c)) : [];
    }

    // Cartas abertas do inimigo que você marcou (some as que já caíram ou ainda estão travadas).
    markedTargets() {
      return this.foeTargets(this.game.combatEnemy()).filter((c) => this.targets.has(c.id));
    }

    // Um toque numa carta aberta do inimigo marca ou desmarca o alvo: dá para marcar várias.
    onFoeClick(id) {
      if (this.busy || !this.game.canFight()) return;
      if (this.targets.has(id)) this.targets.delete(id);
      else this.targets.add(id);
      this.sound(this.targets.has(id) ? 'select' : 'deselect');
      this.renderOverlay();
    }

    // Botão "Derrubar": soma exata das cartas escolhidas contra as cartas marcadas do inimigo.
    onFoeGo() {
      const ids = this.markedTargets().map((c) => c.id);
      if (!ids.length) return this.toast('Marque as cartas abertas do inimigo que você quer derrubar.');
      this.doAttack(ids, null);
    }

    // Botão "Trocar": 1 carta da mão por 1 carta aberta do inimigo de valor diferente; a diferença queima o seu deck.
    onFoeTrade() {
      const ids = this.markedTargets().map((c) => c.id);
      if (this.sel.length !== 1 || ids.length !== 1) return this.toast('Para trocar, escolha 1 carta da mão e 1 carta aberta do inimigo.');
      this.doTrade(this.sel[0], ids[0]);
    }

    newGame(seed, tutorial = false) {
      this.game = new DC.Game({ seed: seed === null || seed === undefined ? undefined : seed, tutorial });
      window.game = this.game;
      try {
        history.replaceState(null, '', tutorial ? location.pathname : `?seed=${encodeURIComponent(this.game.seed)}`);
      } catch (e) {
        /* abrindo como arquivo: sem problema */
      }
      this.sel = [];
      this.busy = false;
      this.help = false;
      this.graveView = false;
      this.handReset = true;
      this.lastCounts = null;
      this.fxExit = null;
      this.fxOrigin = null;
      this.fxHold = 0;
      this.fxDrawStep = 0;
      this.fxBumpDelay = null;
      this.view = null;
      this.cameraKey = '';
      this.prevOpen = new Set();
      this.stats = new DC.Stats();
      this.hint = null;
      this.hintQueue = '';
      this.tipHTML = '';
      this.notes = {};
      this.tutor.doneSteps.delete(this.tutor.index); // numa masmorra nova, o passo de ação recomeça
      this.hideIntro();
      this.spotSeen = new Set();
      this.resetOverlayState();
      this.renderAll();
    }

    // "Novo jogo": durante o treino leva para a masmorra de verdade (e encerra o tutorial).
    newGameFromButton() {
      if (this.game.tutorial && this.tutor.active) this.tutor.skip();
      this.newGame();
    }

    bind() {
      document.getElementById('btn-tour').addEventListener('click', () => this.startTour());
      document.getElementById('btn-report').addEventListener('click', () => this.copyReport());
      this.el.coach.addEventListener('click', (e) => this.onCoachClick(e));
      this.el.notice.addEventListener('click', (e) => {
        if (e.target.closest('[data-notice]')) this.el.notice.hidden = true;
      });
      document.getElementById('btn-new').addEventListener('click', () => this.newGameFromButton());
      document.getElementById('btn-fog').addEventListener('click', () => this.toggleFog());
      document.getElementById('btn-fx').addEventListener('click', () => this.toggleFx());
      document.getElementById('btn-sound').addEventListener('click', () => this.toggleSound());
      document.getElementById('btn-art').addEventListener('click', () => this.toggleArt());
      // O navegador só libera áudio depois de um clique ou tecla do jogador.
      for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
        document.addEventListener(type, () => this.sfx.unlock(), { capture: true });
      }
      document.addEventListener(
        'pointerdown',
        (e) => {
          if (e.pointerType === 'touch') this.setTouch(true);
          else if (e.pointerType === 'mouse') this.setTouch(false);
        },
        { capture: true },
      );
      window.addEventListener('resize', () => {
        if (this.intro.on && this.intro.scene >= 0) this.introPlace(this.introScenes()[this.intro.scene].focus, true);
      });
      this.el.piles.addEventListener('click', (e) => {
        if (!e.target.closest('[data-pile="grave"]') || this.busy || !this.game.discard.length) return;
        this.graveView = true;
        this.renderOverlay();
      });
      document.getElementById('btn-center').addEventListener('click', () => this.centerCamera());
      this.bindPan();
      document.getElementById('btn-zoom-in').addEventListener('click', () => this.changeZoom(1));
      document.getElementById('btn-zoom-out').addEventListener('click', () => this.changeZoom(-1));
      document.getElementById('btn-help').addEventListener('click', () => {
        this.help = true;
        this.track('help');
        this.renderOverlay();
      });
      this.el.hand.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) this.toggleCard(card.dataset.id);
      });
      // Inventário (embaixo, ao lado da mão) e bolsa com anéis (coluna da direita) usam os mesmos toques.
      for (const box of [this.el.stash, this.el.gear]) {
        box.addEventListener('click', (e) => {
          const bag = e.target.closest('[data-item]');
          if (bag) return this.useItemClick(bag.dataset.item, Number(bag.dataset.dir) || 0);
          const ringBtn = e.target.closest('[data-ring]');
          if (ringBtn) return this.onRingClick(Number(ringBtn.dataset.ring), Number(ringBtn.dataset.dir) || 0);
          const slot = e.target.closest('.stash-slot');
          if (slot) this.onSlotClick(slot);
        });
      }
      this.bindMenu();
      this.initDrag();
      this.el.hand.addEventListener('mousemove', (e) => this.tiltCard(e));
      this.el.hand.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.card');
        if (!card) return;
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      });
      this.el.map.addEventListener('click', (e) => this.onMapClick(e));
      this.el.map.addEventListener('mouseover', (e) => this.onMapHover(e));
      this.el.map.addEventListener('mouseleave', () => {
        if (!this.isTouch()) this.clearPath();
      });
      this.el.panel.addEventListener('click', (e) => this.onPanelClick(e));
      this.el.power.addEventListener('click', (e) => this.onPanelClick(e));
      this.el.overlay.addEventListener('click', (e) => this.onOverlayClick(e));
      // A cena de combate usa os mesmos botões das janelas (atacar, trocar, fugir, anéis, coringa).
      this.el.combat.addEventListener('click', (e) => this.onOverlayClick(e));
      this.el.overlay.addEventListener('input', (e) => {
        const note = e.target.closest('[data-note]');
        if (note) this.notes[note.dataset.note] = note.value;
      });
      document.addEventListener('keydown', (e) => this.onKey(e));
      // Reencaixa o mapa sempre que a área disponível mudar de tamanho.
      let lastSize = '';
      new ResizeObserver(() => {
        const r = this.el.mapWrap.getBoundingClientRect();
        const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
        if (size === lastSize || this.busy) return;
        lastSize = size;
        this.renderMap();
        this.updateHighlights();
      }).observe(this.el.mapWrap);
    }

    // ---------- entrada ----------

    onKey(e) {
      const typing = e.target && e.target.closest && e.target.closest('input, textarea');
      if (typing && e.key !== 'Escape') return; // digitando nas perguntas: nada de atalhos
      if (this.intro.on && this.intro.mode === 'intro') {
        // Na abertura do tutorial, só avançar (ou pular) vale.
        if (e.key === 'Escape') this.introFinish();
        else if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          this.introAdvance();
        }
        return;
      }
      if (this.lastOverlay === 'tutorial' && !this.el.overlay.hidden) return; // a janela do tutorial só usa os botões
      if (e.key === 'Escape') {
        if (this.reportView) {
          this.reportView = false;
          this.renderOverlay();
        } else if (this.help) {
          this.help = false;
          this.renderOverlay();
        } else if (this.sel.length) {
          this.sel = [];
          this.refreshSelection();
        }
        return;
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) return this.toggleFog();
      if ((e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey && !e.altKey) return this.toggleFx();
      if ((e.key === 'a' || e.key === 'A') && !e.metaKey && !e.ctrlKey && !e.altKey) return this.toggleArt();
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) return this.toggleSound();
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) return this.centerCamera();
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '+' || e.key === '=') return this.changeZoom(1);
        if (e.key === '-' || e.key === '_') return this.changeZoom(-1);
      }
      const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (dir && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        return this.stepDir(dir[0], dir[1]);
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5 && this.game.hand[n - 1]) this.toggleCard(this.game.hand[n - 1].id);
    }

    // ---------- arrastar cartas ----------
    //
    // Arrastar a carta da mão para um slot do inventário guarda; arrastar a guardada para a mão (ou para cima de uma
    // carta, que troca de lugar com ela) devolve; arrastar uma carta para outra posição reorganiza a mão ou o inventário.
    // Tudo com eventos de ponteiro, então vale igual para mouse e dedo. Um toque ou clique sem arrastar segue como antes.
    initDrag() {
      const THRESHOLD = 8;
      let cand = null;
      const cardOf = (c) => this.game.hand.find((x) => x.id === c.id) || this.game.stash.find((x) => x.id === c.id);
      const targetAt = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const slot = el.closest('#stash .stash-slot');
        if (slot) return { kind: 'slot', el: slot };
        const card = el.closest('#hand .card');
        if (card) return { kind: 'handcard', el: card };
        if (el.closest('#hand')) return { kind: 'hand', el: this.el.hand };
        return null;
      };
      const clearMarks = () => {
        for (const n of document.querySelectorAll('.drop-target')) n.classList.remove('drop-target');
      };
      const end = () => {
        if (cand && cand.ghost) cand.ghost.remove();
        if (cand && cand.src) cand.src.classList.remove('drag-src');
        document.documentElement.classList.remove('dragging-card');
        clearMarks();
        cand = null;
      };
      document.addEventListener('pointerdown', (e) => {
        if ((e.pointerType === 'mouse' && e.button !== 0) || this.busy || !this.game.canStore()) return;
        const slot = e.target.closest('#stash .stash-slot.filled');
        const card = slot ? null : e.target.closest('#hand .card');
        const src = slot || card;
        if (!src || !src.dataset.id) return;
        cand = { src, id: src.dataset.id, from: slot ? 'stash' : 'hand', x: e.clientX, y: e.clientY, pointerId: e.pointerId, started: false, ghost: null };
      });
      document.addEventListener('pointermove', (e) => {
        if (!cand || e.pointerId !== cand.pointerId) return;
        if (!cand.started) {
          if (Math.hypot(e.clientX - cand.x, e.clientY - cand.y) < THRESHOLD) return;
          const card = cardOf(cand);
          if (!card) return end();
          cand.started = true;
          const ghost = htmlToEl(cardHTML(card, { extra: 'static' }));
          ghost.classList.add('drag-ghost');
          document.body.appendChild(ghost);
          cand.ghost = ghost;
          cand.src.classList.add('drag-src');
          document.documentElement.classList.add('dragging-card');
          if (this.hideTilt) this.hideTilt();
        }
        e.preventDefault();
        const g = cand.ghost;
        g.style.left = `${e.clientX}px`;
        g.style.top = `${e.clientY}px`;
        clearMarks();
        const t = targetAt(e.clientX, e.clientY);
        if (t && t.el !== cand.src) t.el.classList.add('drop-target');
      }, { passive: false });
      const finish = (e) => {
        if (!cand || e.pointerId !== cand.pointerId) return;
        const c = cand;
        const target = c.started && e.type === 'pointerup' ? targetAt(e.clientX, e.clientY) : null;
        const rect = c.src.getBoundingClientRect();
        end();
        if (!c.started) return;
        // O toque/clique que vem logo depois de soltar não pode virar "escolher a carta".
        this.justDragged = true;
        setTimeout(() => (this.justDragged = false), 60);
        if (target) this.dropCard(c, target, rect);
      };
      document.addEventListener('pointerup', finish);
      document.addEventListener('pointercancel', finish);
      document.addEventListener('click', (e) => {
        if (!this.justDragged) return;
        e.stopPropagation();
        e.preventDefault();
        this.justDragged = false;
      }, true);
    }

    // Solta a carta `c` (de onde veio e o id) em cima do alvo.
    dropCard(c, target, rect) {
      const g = this.game;
      const hand = g.hand;
      const idxOfCard = (el) => hand.findIndex((x) => x.id === el.dataset.id);
      if ((c.from === 'stash' || target.kind === 'slot') && g.pending && g.pending.type === 'refill') return this.toast('Pegue as cartas primeiro.');
      if (c.from === 'hand') {
        if (target.kind === 'handcard') {
          const res = g.moveHandCard(c.id, idxOfCard(target.el));
          if (!res.ok) return this.reject(res.error);
          if (res.moved) this.sound('draw');
          return this.renderAll();
        }
        if (target.kind === 'hand') {
          g.moveHandCard(c.id, hand.length - 1);
          return this.renderAll();
        }
        const slot = target.el;
        if (slot.classList.contains('locked')) return this.toast('Slot bloqueado: derrote inimigos ou abra baús para achar um Pergaminho de Inventário.');
        if (slot.dataset.id) {
          const res = g.swapStash(c.id, slot.dataset.id);
          if (!res.ok) return this.reject(res.error);
        } else {
          const res = g.stashCard(c.id);
          if (!res.ok) return this.reject(res.error);
          this.track('stash');
          this.fxExit = { rect: slot.getBoundingClientRect() };
        }
        this.sel = this.sel.filter((id) => id !== c.id);
        this.discard.delete(c.id);
        this.sound('stash');
        return this.renderAll();
      }
      // Veio do inventário.
      if (target.kind === 'slot') {
        const slot = target.el;
        if (slot.classList.contains('locked')) return;
        const to = slot.dataset.id ? g.stash.findIndex((x) => x.id === slot.dataset.id) : g.stash.length - 1;
        const res = g.moveStash(c.id, to);
        if (!res.ok) return this.reject(res.error);
        if (res.moved) this.sound('draw');
        return this.renderAll();
      }
      const full = hand.length >= g.handLimit();
      if (target.kind === 'handcard') {
        const at = idxOfCard(target.el);
        const res = full ? g.swapStash(target.el.dataset.id, c.id) : g.unstashCard(c.id);
        if (!res.ok) return this.reject(res.error);
        if (!full) g.moveHandCard(c.id, at);
        this.sel = this.sel.filter((id) => id !== (full ? target.el.dataset.id : null));
        this.fxEnter = rect;
        this.sound('draw');
        return this.renderAll();
      }
      if (full) return this.toast('Mão cheia: solte em cima de uma carta da mão para trocar de lugar com ela.');
      const res = g.unstashCard(c.id);
      if (!res.ok) return this.reject(res.error);
      this.fxEnter = rect;
      this.sound('draw');
      this.renderAll();
    }

    // Tela de entrada (logo sobre fundo azul): só na primeira vez, por 3 segundos; um toque fecha antes.
    // Enquanto ela está na tela, a abertura do tutorial espera (senão o texto digitaria escondido).
    runSplash() {
      const html = document.documentElement;
      const el = document.getElementById('splash');
      this.splashOn = html.classList.contains('show-splash');
      if (!this.splashOn || !el) return;
      try {
        localStorage.setItem('deckcrawly.splash', '1'); // já viu: a próxima abertura vai direto ao jogo
      } catch (e) {
        /* tudo bem */
      }
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(this.splashTimer);
        el.classList.add('leaving');
        setTimeout(() => {
          html.classList.remove('show-splash');
          this.splashOn = false;
          if (this.syncIntro) this.syncIntro();
        }, 600);
      };
      this.splashTimer = setTimeout(close, 3000);
      el.addEventListener('pointerdown', close);
    }

    // Menu sanduíche: o que é de teste e de opções fica escondido aqui (canto de cima, à direita).
    bindMenu() {
      const btn = document.getElementById('btn-menu');
      const menu = document.getElementById('menu');
      const set = (open) => {
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
      };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        set(menu.hidden);
      });
      menu.addEventListener('click', (e) => {
        if (e.target.closest('[data-menu-close]')) set(false);
      });
      document.addEventListener('click', (e) => {
        if (!menu.hidden && !e.target.closest('.menu-wrap')) set(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.hidden) set(false);
      });
    }

    // A névoa fica ligada por padrão; a escolha é lembrada entre partidas.
    loadFog() {
      try {
        return localStorage.getItem('deckcrawly.fog') !== '0';
      } catch (e) {
        return true;
      }
    }

    toggleFog() {
      this.fog = !this.fog;
      try {
        localStorage.setItem('deckcrawly.fog', this.fog ? '1' : '0');
      } catch (e) {
        /* sem armazenamento: vale só nesta sessão */
      }
      this.renderMap(false);
      this.updateHighlights();
    }

    // O zoom começa mais perto que a masmorra inteira; a escolha é lembrada.
    loadZoom() {
      try {
        const raw = localStorage.getItem('deckcrawly.zoom2'); // chave nova: o zoom antigo era relativo ao tamanho da tela
        const saved = raw === null ? NaN : Number(raw);
        if (Number.isInteger(saved) && saved >= 0 && saved < ZOOM_TILES.length) return saved;
      } catch (e) {
        /* sem armazenamento: usa o padrão */
      }
      return DEFAULT_ZOOM;
    }

    changeZoom(step) {
      const next = Math.max(0, Math.min(ZOOM_TILES.length - 1, this.zoom + step));
      if (next === this.zoom) return;
      this.zoom = next;
      try {
        localStorage.setItem('deckcrawly.zoom2', String(next));
      } catch (e) {
        /* sem armazenamento: vale só nesta sessão */
      }
      this.view = null;
      this.syncZoomButtons();
      if (this.busy) return; // o mapa é redesenhado ao fim do movimento, já no zoom novo
      this.renderMap(false);
      this.updateHighlights();
    }

    // Volta a câmera para o personagem depois de arrastar o mapa.
    centerCamera() {
      if (!this.view) return;
      this.view = null;
      this.recenter = true;
      this.placeCamera(this.game.player.x, this.game.player.y, true);
    }

    // Arrastar o mapa (em qualquer ponto da área escura ou sobre as casas) move a câmera.
    // Só vira arrasto depois de alguns pixels, para o clique de andar continuar funcionando.
    bindPan() {
      const wrap = this.el.mapWrap;
      let drag = null;
      wrap.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this.busy || e.target.closest('.zoom, .cscene')) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: this.camera.tx, ty: this.camera.ty, active: false };
      });
      wrap.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.active) {
          if (Math.hypot(dx, dy) < 6 || !wrap.classList.contains('pannable')) return;
          drag.active = true;
          this.dragging = true;
          try {
            wrap.setPointerCapture(e.pointerId);
          } catch (err) {
            /* ponteiro já encerrado: o arrasto segue sem captura */
          }
          wrap.classList.add('panning');
          this.clearPath();
        }
        this.view = { tx: drag.tx + dx, ty: drag.ty + dy };
        this.placeCamera(this.game.player.x, this.game.player.y, false);
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.active) {
          wrap.classList.remove('panning');
          // O "click" que vem logo depois de soltar não deve andar nem abrir nada.
          setTimeout(() => {
            this.dragging = false;
          }, 0);
        }
        drag = null;
      };
      wrap.addEventListener('pointerup', end);
      wrap.addEventListener('pointercancel', end);
    }

    syncZoomButtons() {
      document.getElementById('zoom-level').textContent = `${Math.round((ZOOM_TILES[this.zoom] / ZOOM_BASE) * 100)}%`;
      document.getElementById('btn-zoom-out').disabled = this.zoom === 0;
      document.getElementById('btn-zoom-in').disabled = this.zoom === ZOOM_TILES.length - 1;
    }

    syncFogButton() {
      const btn = document.getElementById('btn-fog');
      btn.textContent = `Névoa: ${this.fog ? 'ligada' : 'desligada'}`;
      btn.setAttribute('aria-pressed', String(this.fog));
    }

    // ---------- efeitos ----------

    // Ligados por padrão, a não ser que o sistema peça menos movimento.
    loadFx() {
      try {
        const raw = localStorage.getItem('deckcrawly.fx');
        if (raw === '1' || raw === '0') return raw === '1';
      } catch (e) {
        /* sem armazenamento: usa o padrão */
      }
      return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    toggleFx() {
      this.fxOn = !this.fxOn;
      try {
        localStorage.setItem('deckcrawly.fx', this.fxOn ? '1' : '0');
      } catch (e) {
        /* sem armazenamento: vale só nesta sessão */
      }
      this.syncFxButton();
    }

    syncFxButton() {
      const btn = document.getElementById('btn-fx');
      btn.textContent = `Efeitos: ${this.fxOn ? 'ligados' : 'desligados'}`;
      btn.setAttribute('aria-pressed', String(this.fxOn));
      document.body.classList.toggle('no-fx', !this.fxOn);
    }

    // ---------- arte (pixel art opcional) ----------

    loadArt() {
      try {
        return localStorage.getItem('deckcrawly.art') !== '0';
      } catch (e) {
        return true;
      }
    }

    artActive() {
      return this.artAvailable && this.artOn;
    }

    toggleArt() {
      if (!this.artAvailable) return this.toast('A arte de pixel art não está disponível nesta versão.');
      this.artOn = !this.artOn;
      try {
        localStorage.setItem('deckcrawly.art', this.artOn ? '1' : '0');
      } catch (e) {
        /* sem armazenamento: vale só nesta sessão */
      }
      this.syncArt();
    }

    // Liga a classe `art` no <html> (o CSS troca o desenho todo) e redesenha o mapa.
    syncArt() {
      const btn = document.getElementById('btn-art');
      btn.hidden = !this.artAvailable;
      btn.textContent = `Arte: ${this.artOn ? 'pixel' : 'clássica'}`;
      btn.setAttribute('aria-pressed', String(this.artOn));
      document.documentElement.classList.toggle('art', this.artActive());
      if (!this.game) return;
      this.renderMap(false);
      this.updateHighlights();
      if (this.game.inCombat()) this.renderOverlay();
    }

    // ---------- toque ----------

    // Em tablets (iPad) não há "passar o mouse": o hover vira toque. Ligamos o modo
    // toque ao detectar um aparelho sem mouse e a cada gesto de dedo (e desligamos
    // quando o último gesto foi de mouse).
    detectTouch() {
      const fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      return (navigator.maxTouchPoints || 0) > 0 && !fine;
    }

    setTouch(on) {
      document.documentElement.classList.toggle('touch', on);
    }

    isTouch() {
      return document.documentElement.classList.contains('touch');
    }

    // Prévia do caminho até uma casa (com o mouse). Se a casa é de um inimigo, o último passo é o ataque (⚔).
    previewPath(x, y) {
      this.clearPath();
      const g = this.game;
      const f = g.floor;
      const cell = f.grid[y][x];
      let target = { x, y };
      if (['door', 'chest', 'fixture'].includes(cell.type)) target = this.sideOf(x, y);
      const path = target ? g.pathFor(target.x, target.y) : null;
      if (!path) return null;
      for (const p of path) this.tileEls[p.y * f.w + p.x].classList.add('path');
      const last = path[path.length - 1];
      if (DC.enemyHere(f, last.x, last.y)) this.tileEls[last.y * f.w + last.x].classList.add('fight');
      else this.tileEls[last.y * f.w + last.x].classList.add('path-end');
      return path;
    }

    // A casa livre mais perto de você que encosta numa porta ou baú (para andar até ela).
    sideOf(x, y) {
      const g = this.game;
      let best = null;
      for (const [dx, dy] of DC.DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const cell = DC.cellAt(g.floor, nx, ny);
        if (!cell || !['floor', 'start'].includes(cell.type)) continue;
        if (nx === g.player.x && ny === g.player.y) return { x: nx, y: ny };
        const path = g.pathFor(nx, ny);
        if (path && (!best || path.length < best.len)) best = { x: nx, y: ny, len: path.length };
      }
      return best;
    }

    // ---------- som ----------

    sound(name, delay = 0, arg) {
      this.sfx.play(name, delay, arg);
    }

    toggleSound() {
      this.sfx.unlock();
      this.sfx.setEnabled(!this.sfx.enabled);
      this.syncSoundButton();
      this.sound('select');
    }

    syncSoundButton() {
      const btn = document.getElementById('btn-sound');
      btn.textContent = `Som: ${this.sfx.enabled ? 'ligado' : 'desligado'}`;
      btn.setAttribute('aria-pressed', String(this.sfx.enabled));
    }

    // Jogada recusada: balança as cartas, toca o "não" e mostra o motivo.
    reject(message) {
      this.track('reject', { message });
      this.shakeSelection();
      this.sound('error');
      this.toast(message);
    }

    // Som de abrir porta ou baú: a batida chega junto com as cartas na porta.
    openSound(res) {
      this.sound('stamp', 0.24);
      if (res.kind === 'door') this.sound('creak', 0.3);
      if (res.exact) this.sound('ding', 0.3);
    }

    // Retângulo da carta de cima de uma pilha (0 = deck, 1 = descarte, 2 = dungeon).
    pileRect(i) {
      const stack = this.el.piles.querySelectorAll('.stack')[i];
      const top = stack && stack.firstElementChild;
      return top ? top.getBoundingClientRect() : null;
    }

    // Cópia da carta solta na camada de efeitos, para voar por cima de tudo.
    ghostOf(node, rect) {
      const ghost = node.cloneNode(true);
      ghost.removeAttribute('data-id');
      ghost.removeAttribute('title');
      ghost.classList.remove('sel');
      ghost.classList.add('ghost');
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const c = centerOf(rect);
      Object.assign(ghost.style, { left: `${c.x - w / 2}px`, top: `${c.y - h / 2}px`, width: `${w}px`, height: `${h}px` });
      this.el.fx.appendChild(ghost);
      return ghost;
    }

    // Carta gasta: vai até a porta (carimbo) ou até a pilha de descarte.
    flyOut(node, from, exit, order) {
      const to = exit ? exit.rect : this.pileRect(1);
      if (!to || !from) return;
      const ghost = this.ghostOf(node, from);
      const a = centerOf(from);
      const b = centerOf(to);
      const door = Boolean(exit);
      const scale = door ? 0.5 : Math.max(0.2, to.width / ghost.offsetWidth);
      const anim = ghost.animate(
        [
          { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${scale}) rotate(${door ? 0 : 14}deg)`, opacity: door ? 0.2 : 0.95 },
        ],
        { duration: door ? 260 : 320, delay: order * 50, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both' },
      );
      afterAnim(anim, () => ghost.remove());
    }

    // Carta comprada: sai da pilha do deck e pousa na mão.
    flyIn(node, from, delay) {
      const to = node.getBoundingClientRect();
      const a = centerOf(from);
      const b = centerOf(to);
      const scale = Math.max(0.2, from.width / node.offsetWidth);
      const anim = node.animate(
        [{ translate: `${a.x - b.x}px ${a.y - b.y}px`, scale, rotate: '-18deg', transformOrigin: '50% 50%' }],
        { duration: 380, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
      );
      afterAnim(anim, () => node.animate([{ scale: 1.07 }, { scale: 1 }], { duration: 160, easing: 'ease-out' }));
    }

    // Carta que só mudou de lugar na mão (alguém saiu): desliza em vez de pular.
    slide(node, was) {
      const now = node.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      node.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }

    // Inclina a carta sob o mouse, como se tivesse volume.
    tiltCard(e) {
      if (!this.fxOn || this.isTouch()) return;
      const card = e.target.closest('.card');
      if (!card || card.classList.contains('sel')) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(px * 16).toFixed(1)}deg`);
      card.style.setProperty('--rx', `${(-py * 16).toFixed(1)}deg`);
    }

    // Jogada recusada: as cartas escolhidas balançam.
    shakeSelection() {
      if (!this.fxOn) return;
      for (const node of document.querySelectorAll('#hand .card.sel, #overlay .card.sel')) {
        node.animate(
          [{ translate: '0 0' }, { translate: '-7px 0' }, { translate: '7px 0' }, { translate: '-4px 0' }, { translate: '3px 0' }, { translate: '0 0' }],
          { duration: 320, easing: 'ease-out' },
        );
      }
    }

    // Faíscas que saem de um ponto da tela.
    burst(cx, cy, { count = 14, color = '#ffd76a', spread = 52, size = 7, glyph = '' } = {}) {
      if (!this.fxOn) return;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('i');
        p.className = glyph ? 'spark glyph' : 'spark';
        Object.assign(p.style, { left: `${cx}px`, top: `${cy}px`, width: `${size}px`, height: `${size}px`, background: glyph ? 'none' : color, color });
        if (glyph) {
          p.textContent = glyph;
          p.style.fontSize = `${size * 2.2}px`;
        }
        this.el.fx.appendChild(p);
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
        const d = spread * (0.55 + Math.random() * 0.75);
        const anim = p.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 8}px)) scale(0.2)`, opacity: 0 },
          ],
          { duration: 480 + Math.random() * 260, easing: 'cubic-bezier(.1,.7,.3,1)' },
        );
        afterAnim(anim, () => p.remove());
      }
    }

    // Anel de luz que se expande.
    ring(cx, cy, color = '#ffd76a') {
      if (!this.fxOn) return;
      const r = document.createElement('i');
      r.className = 'ring';
      Object.assign(r.style, { left: `${cx}px`, top: `${cy}px`, borderColor: color });
      this.el.fx.appendChild(r);
      const anim = r.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.9 },
          { transform: 'translate(-50%, -50%) scale(2.6)', opacity: 0 },
        ],
        { duration: 520, easing: 'ease-out' },
      );
      afterAnim(anim, () => r.remove());
    }

    // Texto que sobe e some ("+1 carta").
    floatText(text, cx, cy, cls = '') {
      if (!this.fxOn) return;
      const t = document.createElement('div');
      t.className = `floater ${cls}`;
      t.textContent = text;
      Object.assign(t.style, { left: `${cx}px`, top: `${cy}px` });
      this.el.fx.appendChild(t);
      const anim = t.animate(
        [
          { transform: 'translate(-50%, 0) scale(0.7)', opacity: 0 },
          { transform: 'translate(-50%, -16px) scale(1.1)', opacity: 1, offset: 0.2 },
          { transform: 'translate(-50%, -44px) scale(1)', opacity: 0 },
        ],
        { duration: 1000, easing: 'ease-out' },
      );
      afterAnim(anim, () => t.remove());
    }

    // O que acontece quando a carta chega na porta ou no baú.
    openFx(res, rect) {
      if (!this.fxOn) return;
      const c = centerOf(rect);
      setTimeout(() => {
        if (res.exact) {
          this.ring(c.x, c.y);
          this.burst(c.x, c.y, { count: 18 });
          this.floatText(res.flush ? 'Mesmo naipe!' : res.drawn ? '+1 carta' : 'Soma exata!', c.x, c.y - rect.height * 0.3, 'gold');
        } else {
          this.burst(c.x, c.y, { count: 7, color: '#c9c2d6', spread: 30, size: 5 });
          this.floatText('sem compra', c.x, c.y - rect.height * 0.3, 'muted');
        }
        if (res.kind === 'chest') this.burst(c.x, c.y, { count: 12, color: '#e7b84a', spread: 64 });
        if (res.scroll) {
          this.burst(c.x, c.y, { count: 20, color: '#f6e7b4', spread: 80 });
          this.floatText('Pergaminho de Inventário!', c.x, c.y - rect.height * 0.7, 'gold');
        }
      }, 240);
    }

    // Poeira e brilho nas casas por onde o personagem passa.
    stepFx(prev, next, fast = false) {
      if (!this.fxOn || !prev) return;
      const f = this.game.floor;
      if (fast && next) {
        const ang = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
        const mx = (prev.x + next.x) / 2 + 0.5;
        const my = (prev.y + next.y) / 2 + 0.5;
        for (const off of [-0.2, 0.2]) {
          const streak = document.createElement('i');
          streak.className = 'streak';
          const px = -(next.y - prev.y) * off;
          const py = (next.x - prev.x) * off;
          Object.assign(streak.style, { left: `${(mx + px) * this.tile}px`, top: `${(my + py) * this.tile}px`, rotate: `${ang}deg` });
          this.el.map.appendChild(streak);
          const anim = streak.animate(
            [
              { transform: 'translate(-50%, -50%) scaleX(1)', opacity: 0.9 },
              { transform: 'translate(-50%, -50%) scaleX(0.25)', opacity: 0 },
            ],
            { duration: 340, easing: 'ease-out' },
          );
          afterAnim(anim, () => streak.remove());
        }
      }
      const dust = document.createElement('i');
      dust.className = 'dust';
      Object.assign(dust.style, { left: `${(prev.x + 0.5) * this.tile}px`, top: `${(prev.y + 0.78) * this.tile}px` });
      this.el.map.appendChild(dust);
      const anim = dust.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0.6 },
          { transform: 'translate(-50%, -95%) scale(1.5)', opacity: 0 },
        ],
        { duration: 460, easing: 'ease-out' },
      );
      afterAnim(anim, () => dust.remove());

      const tile = this.tileEls[prev.y * f.w + prev.x];
      if (tile) {
        tile.classList.remove('trail');
        void tile.offsetWidth;
        tile.classList.add('trail');
        setTimeout(() => tile.classList.remove('trail'), 750);
      }
      const ball = this.token && this.token.firstElementChild;
      if (ball) {
        ball.animate(
          [
            { transform: 'translateY(0) scale(1, 1)' },
            { transform: 'translateY(-16%) scale(0.92, 1.1)', offset: 0.45 },
            { transform: 'translateY(0) scale(1.14, 0.86)', offset: 0.85 },
            { transform: 'translateY(0) scale(1, 1)' },
          ],
          { duration: 110, easing: 'ease-out' },
        );
      }
    }

    // ---------- efeitos dos naipes e dos momentos grandes ----------

    // ♥: cartas do descarte voam de volta ao deck, deixando corações no rastro.
    heartFx(count) {
      const from = this.pileRect(1);
      const to = this.pileRect(0);
      if (!this.fxOn || !from || !to) return;
      const a = centerOf(from);
      const b = centerOf(to);
      const n = Math.min(count, 8);
      const first = 260; // a carta de ♥ gasta chega ao descarte antes
      for (let i = 0; i < n; i++) {
        const delay = first + i * 80;
        const ghost = document.createElement('div');
        ghost.className = 'card back small ghost';
        Object.assign(ghost.style, { left: `${a.x - 20}px`, top: `${a.y - 28}px`, width: '40px', height: '56px' });
        ghost.style.setProperty('--cw', '40px');
        this.el.fx.appendChild(ghost);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const bow = (i % 2 ? 1 : -1) * (30 + i * 4);
        const anim = ghost.animate(
          [
            { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0 },
            { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1, offset: 0.12 },
            { transform: `translate(${dx / 2 + bow}px, ${dy / 2 - 36}px) rotate(${bow}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, opacity: 0.9 },
          ],
          { duration: 460, delay, easing: 'ease-in-out', fill: 'backwards' },
        );
        setTimeout(() => this.burst(a.x, a.y, { count: 3, color: '#ff6b81', glyph: '♥', size: 6, spread: 26 }), delay);
        afterAnim(anim, () => ghost.remove());
      }
      setTimeout(() => {
        this.burst(b.x, b.y, { count: 7, color: '#ff6b81', glyph: '♥', size: 7, spread: 36 });
        this.floatText(`deck +${count}`, b.x, b.y - 24, 'heart');
      }, first + (n - 1) * 80 + 440);
    }

    // ♠: a compra vem em rajada, mais rápida que a compra normal.
    spadeFx(count) {
      const deck = this.pileRect(0);
      if (!this.fxOn || !deck) return;
      const c = centerOf(deck);
      this.burst(c.x, c.y, { count: 8, color: '#d5d9ff', spread: 34, size: 5 });
      this.floatText(`+${count} ${count === 1 ? 'carta' : 'cartas'}`, c.x, c.y - 26, 'spade');
    }

    // ♣: brilho de coringa; a carta copiada também pulsa.
    jokerFx(jokerId, targetId) {
      if (!this.fxOn) return;
      const find = (id) => id && this.el.hand.querySelector(`[data-id="${id}"]`);
      const joker = find(jokerId);
      if (!joker) return;
      const c = centerOf(joker.getBoundingClientRect());
      this.burst(c.x, c.y, { count: targetId ? 12 : 6, color: '#7be0a0', spread: 44, size: 6 });
      joker.animate([{ scale: 1.14 }, { scale: 1 }], { duration: 240, easing: 'ease-out' });
      const target = find(targetId);
      if (target) {
        const t = centerOf(target.getBoundingClientRect());
        this.ring(t.x, t.y, '#7be0a0');
        target.animate([{ scale: 1.1 }, { scale: 1 }], { duration: 240, easing: 'ease-out' });
      }
    }

    // Descer a escada: a tela escurece, mostra o andar e clareia no novo mapa.
    async floorVeil(render) {
      const veil = document.createElement('div');
      veil.className = 'veil';
      veil.innerHTML = this.game.floor.boss ? '<b>O Chefão</b><span>sem volta</span>' : `<b>Andar ${this.game.floorNo}</b><span>de ${this.game.config.floors}</span>`;
      this.el.fx.appendChild(veil);
      const wait = (anim) => anim.finished.catch(() => {});
      await wait(veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'forwards' }));
      render();
      await sleep(420);
      await wait(veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 440, fill: 'forwards' }));
      veil.remove();
    }

    // Vitória: chuva de cartas coloridas. Derrota: cartas viradas se espalham e caem.
    rain(won) {
      if (!this.fxOn) return;
      const suits = ['♠', '♥', '♦', '♣'];
      const n = won ? 42 : 18;
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div');
        c.className = won ? 'confetti' : 'confetti back';
        if (won) {
          const suit = suits[i % 4];
          c.textContent = suit;
          c.classList.add(suit === '♥' || suit === '♦' ? 'red' : 'black');
        }
        Object.assign(c.style, { left: `${won ? Math.random() * 100 : 38 + Math.random() * 24}vw`, top: won ? '-10vh' : '42vh' });
        this.el.fx.appendChild(c);
        const drift = (Math.random() - 0.5) * (won ? 26 : 70);
        const fall = won ? 118 : 70;
        const anim = c.animate(
          [
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${drift}vw, ${fall}vh) rotate(${(Math.random() - 0.5) * 900}deg)`, opacity: won ? 1 : 0 },
          ],
          {
            duration: won ? 2300 + Math.random() * 1500 : 1500 + Math.random() * 900,
            delay: Math.random() * (won ? 1000 : 300),
            easing: won ? 'cubic-bezier(.3,.1,.6,1)' : 'ease-in',
            fill: 'backwards',
          },
        );
        afterAnim(anim, () => c.remove());
      }
    }

    // Baú aberto: faíscas saem da tampa.
    chestFx() {
      if (!this.fxOn) return;
      setTimeout(() => {
        const el = this.el.overlay.querySelector('.chest-big');
        if (!el) return;
        const c = centerOf(el.getBoundingClientRect());
        this.ring(c.x, c.y - 8);
        this.burst(c.x, c.y - 8, { count: 16, spread: 70 });
      }, 260);
    }

    // Ataca uma ou mais cartas do inimigo com as cartas escolhidas.
    doAttack(enemyCardIds, el) {
      if (this.busy || !this.game.canFight()) return;
      const g = this.game;
      const enemy = g.combatEnemy();
      const first = el || this.el.combat.querySelector('.enemy-card.target') || this.el.combat.querySelector('.enemy-card[data-ov="attack"]');
      const rect = first ? first.getBoundingClientRect() : null;
      const res = g.attack(this.sel, enemyCardIds);
      if (!res.ok) return this.reject(res.error);
      this.sel = [];
      this.targets = new Set();
      this.track('attack', { exact: res.exact, victory: res.victory });
      if (res.scroll) this.track('scroll');
      this.sound('hit');
      if (res.exact) this.sound('ding', 0.12);
      this.foeHit = !res.victory; // o inimigo se encolhe ao levar o golpe
      if (res.scroll) this.newSlot = g.slotsOpen - 1;
      if (res.revealed.length && !res.victory) {
        this.revealIds = res.revealed; // a carta de costas desvira
        this.sound('draw', 0.25);
      }
      this.renderAll();
      if (res.victory) {
        const tile = this.tileEls[enemy.y * g.floor.w + enemy.x];
        const at = tile ? tile.getBoundingClientRect() : rect;
        this.sound('victory', 0.2);
        if (at) {
          const c = centerOf(at);
          this.ring(c.x, c.y);
          this.burst(c.x, c.y, { count: 22, spread: 70 });
          this.floatText(res.scroll ? 'Vitória! Pergaminho de Inventário' : res.reinforce ? `Vitória! ${DC.FOOD[res.reinforce].name}` : res.reward ? 'Vitória! +1 carta' : 'Vitória!', c.x, c.y - at.height * 0.4, 'gold');
          if (res.scroll) {
            this.burst(c.x, c.y, { count: 20, color: '#f6e7b4', spread: 90 });
            this.sound('scroll', 0.5);
          }
        }
      } else if (rect) {
        const c = centerOf(rect);
        this.burst(c.x, c.y, { count: res.exact ? 16 : 8, color: res.exact ? '#ffd76a' : '#ff8095', spread: 46 });
        if (res.exact && res.drawn) this.floatText('+1 carta', c.x, c.y - rect.height * 0.35, 'gold');
      }
    }

    // Troca (preso): 1 carta da mão por 1 carta aberta do inimigo; a diferença vira dano no deck.
    doTrade(cardId, enemyCardId) {
      if (this.busy || !this.game.canFight()) return;
      const g = this.game;
      const enemy = g.combatEnemy();
      const first = this.el.combat.querySelector('.enemy-card.target');
      const rect = first ? first.getBoundingClientRect() : null;
      const res = g.trade(cardId, enemyCardId);
      if (!res.ok) return this.reject(res.error);
      this.sel = [];
      this.targets = new Set();
      this.track('attack', { exact: res.exact, victory: res.victory });
      if (res.scroll) this.track('scroll');
      this.sound('hit');
      if (res.damage) this.sound('error', 0.12);
      this.foeHit = !res.victory;
      if (res.scroll) this.newSlot = g.slotsOpen - 1;
      if (res.revealed.length && !res.victory) {
        this.revealIds = res.revealed;
        this.sound('draw', 0.25);
      }
      this.renderAll();
      if (res.damage) this.toast(`Troca: ${res.damage} de dano. Seu deck queimou ${res.burned.map(label).join(', ') || 'nada'}.`);
      if (res.victory) {
        const tile = this.tileEls[enemy.y * g.floor.w + enemy.x];
        const at = tile ? tile.getBoundingClientRect() : rect;
        this.sound('victory', 0.2);
        if (at) {
          const c = centerOf(at);
          this.ring(c.x, c.y);
          this.burst(c.x, c.y, { count: 22, spread: 70 });
          this.floatText(res.scroll ? 'Vitória! Pergaminho de Inventário' : res.reinforce ? `Vitória! ${DC.FOOD[res.reinforce].name}` : res.reward ? 'Vitória! +1 carta' : 'Vitória!', c.x, c.y - at.height * 0.4, 'gold');
        }
      } else if (rect && res.damage) {
        const c = centerOf(rect);
        this.burst(c.x, c.y, { count: 10, color: '#ff6b6b', spread: 50 });
        this.floatText(`−${res.damage} do deck`, c.x, c.y - rect.height * 0.35, 'bad');
      }
    }

    // Foge descartando a carta escolhida.
    doFlee() {
      if (this.busy || !this.game.canFight()) return;
      if (this.sel.length !== 1) return this.toast('Escolha 1 carta da mão para descartar e fugir.');
      const res = this.game.flee(this.sel[0]);
      if (!res.ok) return this.reject(res.error);
      this.sel = [];
      this.track('flee');
      this.sound('flee');
      this.renderAll();
    }

    // Efeito de quando o combate começa (o movimento foi cortado na zona).
    combatStartFx() {
      this.sound('combat');
      if (!this.fxOn || !this.token) return;
      const c = centerOf(this.token.getBoundingClientRect());
      this.ring(c.x, c.y, '#ff6b6b');
      this.burst(c.x, c.y, { count: 12, color: '#ff6b6b', spread: 54 });
      this.floatText('⚔ Combate!', c.x, c.y - 28, 'bad');
    }

    // Poucas cartas na mão: a borda da tela pulsa em vermelho.
    syncTension() {
      const g = this.game;
      const low = g.status === 'playing' && g.hand.length <= 2;
      document.body.classList.toggle('tension', low);
      document.body.classList.toggle('tension-high', low && g.hand.length <= 1);
      // Uma batida de coração só na hora em que a tensão começa.
      if (low && !this.tensionOn) this.sound('heartbeat');
      this.tensionOn = low;
    }

    toggleCard(id) {
      if (this.busy || !(this.game.canAct() || this.game.canFight())) return;
      if (this.game.pending && this.game.pending.frozen === id) return this.toast('Essa carta está congelada até você derrubar uma carta do inimigo.');
      const at = this.sel.indexOf(id);
      if (at >= 0) this.sel.splice(at, 1);
      else this.sel.push(id);
      this.sound(at >= 0 ? 'deselect' : 'select');
      this.refreshSelection();
    }

    refreshSelection() {
      this.renderHand();
      this.renderPanel();
      this.renderCoach();
      this.updateHighlights();
      if (this.game.inCombat()) this.renderOverlay();
      this.syncIntro();
    }

    onPanelClick(e) {
      const joker = e.target.closest('[data-joker]');
      if (joker) {
        this.game.setJoker(joker.dataset.joker, joker.dataset.target);
        this.refreshSelection();
        this.jokerFx(joker.dataset.joker, joker.dataset.target);
        this.sound('joker');
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act || this.busy) return;
      if (act.dataset.act === 'clear') {
        this.sel = [];
        this.targets = new Set();
        this.refreshSelection();
      } else if (act.dataset.act === 'power') {
        const suit = this.game.hand.find((c) => c.id === this.sel[0]).suit;
        const res = this.game.usePower(this.sel[0]);
        if (!res.ok) return this.reject(res.error);
        this.track('power', { suit });
        this.sel = [];
        if (suit === 'H') this.fxDrawStep = 45;
        this.renderAll();
        if (suit === 'H') {
          this.spadeFx(res.count); // compra em rajada
          this.sound('spade');
        }
        if (suit === 'D') {
          this.sound('ding');
          this.toastOk(`+${res.count} de mana (${res.mana}/${this.game.manaMax()})`);
          const orb = this.el.piles.querySelector('.mana-pile');
          if (orb && this.fxOn) {
            const c = centerOf(orb.getBoundingClientRect());
            this.ring(c.x, c.y, '#ff9a52');
            this.floatText(`+${res.count} mana`, c.x, c.y - 24, 'gold');
          }
        }
      }
    }

    onMapClick(e) {
      const tile = e.target.closest('.tile');
      if (!tile || this.busy || this.dragging || !this.game.canAct()) return;
      const x = Number(tile.dataset.x);
      const y = Number(tile.dataset.y);
      const cell = this.game.floor.grid[y][x];

      if (cell.type === 'fixture' && this.game.adjacentFixtures().some((t) => t.x === x && t.y === y)) return this.useFixtureClick(x, y, tile);
      const adjacent = this.game.adjacentTargets().some((t) => t.x === x && t.y === y);
      if ((cell.type === 'door' || cell.type === 'chest') && adjacent) {
        const freeChest = cell.type === 'chest' && this.game.floor.chests[cell.ref].free;
        if (!this.sel.length && !freeChest) return this.toast('Selecione cartas da mão para pagar o custo.');
        const rect = tile.getBoundingClientRect();
        const res = this.game.open(x, y, this.sel);
        if (!res.ok) return this.reject(res.error);
        // As cartas voam até a porta, a névoa se abre a partir dela e o modal
        // das cartas da sala nova espera os efeitos terminarem.
        this.fxExit = { rect };
        this.fxOrigin = { x, y };
        this.fxHold = res.exact || res.kind === 'chest' ? 750 : 350;
        this.sel = [];
        this.track('open', { kind: res.kind, exact: res.exact });
        if (res.ringCards && res.ringCards.length) {
          this.track('ring-food', { cards: res.ringCards.length });
          this.toastOk(`Anel da Comida: ${res.ringCards.map(label).join(', ')} entra no seu deck.`);
          if (this.fxOn) this.floatText(`+${res.ringCards.length} carta nova no deck`, rect.left + rect.width / 2, rect.top - 10, 'gold');
        }
        if (res.scroll) {
          this.track('scroll');
          this.newSlot = this.game.slotsOpen - 1;
        }
        this.renderAll();
        this.openFx(res, rect);
        this.openSound(res);
        if (res.scroll) this.sound('scroll', 0.4);
        return;
      }
      this.tapTile = null;
      this.walkTo(x, y);
    }

    // Andar é de graça: toque numa casa (ou num inimigo, porta ou baú) e o personagem vai passo a passo até lá,
    // parando se algo mudar no caminho.
    async walkTo(x, y) {
      const g = this.game;
      const cell = g.floor.grid[y][x];
      let target = { x, y };
      if (['door', 'chest', 'fixture'].includes(cell.type)) {
        target = this.sideOf(x, y);
        if (!target) return this.toast('Não dá para chegar perto dali.');
        if (target.x === g.player.x && target.y === g.player.y) return;
      }
      const path = g.pathFor(target.x, target.y);
      if (!path) return this.toast('Não dá para chegar lá.');
      await this.walkPath(path);
      if (cell.type === 'fixture' && g.canAct() && g.adjacentFixtures().some((t) => t.x === x && t.y === y)) {
        this.toast(g.floor.fixtures[cell.ref].kind === 'well' ? 'Toque no poço para beber.' : 'Toque nele para usar (de graça: ele só pede cartas se você quiser).');
      } else if ((cell.type === 'door' || cell.type === 'chest') && g.canAct() && g.adjacentTargets().some((t) => t.x === x && t.y === y)) {
        this.toast(cell.type === 'chest' && g.floor.chests[cell.ref].free ? 'Toque no baú para abrir de graça.' : 'Escolha cartas da mão e toque na porta para pagar.');
      }
    }

    // Um passo na direção (teclas de seta).
    stepDir(dx, dy) {
      const g = this.game;
      if (this.busy || !g.canAct()) return;
      this.walkPath([{ x: g.player.x, y: g.player.y }, { x: g.player.x + dx, y: g.player.y + dy }]);
    }

    // Anda o caminho passo a passo: cada passo é um turno (os inimigos agem depois dele).
    async walkPath(path) {
      const g = this.game;
      const stepMs = 95;
      this.sel = [];
      this.busy = true;
      this.clearPath();
      this.renderSide();
      this.el.map.style.setProperty('--step', `${stepMs + 15}ms`);
      const total = { steps: 0, combat: false, trap: null, descended: false, woke: [], picked: [] };
      let prev = path[0];
      let last = null;
      for (const cell of path.slice(1)) {
        const res = g.step(cell.x, cell.y);
        if (!res.ok) {
          if (!total.steps) this.reject(res.error);
          break;
        }
        last = res;
        total.combat = total.combat || res.combat;
        total.trap = total.trap || res.trap;
        total.descended = total.descended || res.descended;
        total.woke.push(...res.woke);
        total.picked.push(...res.picked);
        if (res.secretFound !== undefined) total.secret = true;
        if (res.moved) {
          total.steps++;
          // Se há inimigos em movimento, o mapa é redesenhado, mas o personagem continua deslizando.
          if (g.floor === res.floorBefore && (res.woke.length || res.combat || g.floor.enemies.some((e) => !e.dead && e.awake))) {
            const oldToken = this.token.style.transform;
            const oldMap = this.el.map.style.transform;
            this.renderMap(false);
            this.token.style.transition = 'none';
            this.el.map.style.transition = 'none';
            this.token.style.transform = oldToken;
            this.el.map.style.transform = oldMap;
            void this.token.offsetWidth;
            this.token.style.transition = '';
            this.el.map.style.transition = '';
          }
          this.stepFx(prev, cell, false);
          this.sound('step');
          this.placeToken(cell.x, cell.y);
          prev = cell;
          await sleep(stepMs);
        }
        if (res.woke.length) await this.wokeFx(res.woke);
        if (g.stopWalking(res)) break;
      }
      await sleep(80);
      this.el.map.style.removeProperty('--step');
      if (total.steps) this.track('move', { steps: total.steps });
      if (total.woke.length) this.track('wake', { count: total.woke.length });
      if (total.combat) this.track('combat');
      if (total.trap) this.track('trap', { kind: total.trap.kind });
      if (total.descended && g.status === 'playing') this.track('descend');
      if (total.combat) {
        this.combatStartFx();
        await sleep(this.fxOn ? 500 : 0);
      }
      if (total.trap) {
        // Armadilha: o dardo sacode a tela e some com cartas do deck; a outra derruba para o andar de cima.
        const trap = total.trap;
        this.sound(trap.kind === 'dart' ? 'hit' : 'lose');
        this.toast(trap.kind === 'dart' ? `Armadilha de dardo! ${trap.burned} carta(s) do deck foram para o cemitério.` : `Armadilha! Você caiu para o andar ${g.floorNo}.`);
        if (this.fxOn) {
          const t = centerOf(this.token.getBoundingClientRect());
          this.ring(t.x, t.y, '#ff6b6b');
          this.burst(t.x, t.y, { count: 18, color: '#ff6b6b', spread: 70 });
          this.floatText(trap.kind === 'dart' ? `Dardo! −${trap.burned} do deck` : 'Armadilha!', t.x, t.y - 34, 'bad');
          document.body.classList.add('shake');
          setTimeout(() => document.body.classList.remove('shake'), 450);
          await sleep(600);
        }
        if (trap.floorChanged && this.fxOn) {
          await this.floorVeil(() => {
            this.busy = false;
            this.renderAll();
          });
          return;
        }
      }
      if (total.secret) {
        this.sound('creak', 0.3);
        this.toastOk('Você nota uma porta escondida na parede!');
        this.track('secret');
      }
      if (total.descended && g.status === 'playing') this.sound('stairs');
      if (total.descended && g.status === 'playing' && this.fxOn) {
        await this.floorVeil(() => {
          this.busy = false;
          this.renderAll();
        });
      } else {
        this.busy = false;
        this.renderAll();
      }
    }

    // Um inimigo acordou: um "!" sobe da cabeça dele.
    async wokeFx(ids) {
      const g = this.game;
      this.sound('combat');
      if (!this.fxOn) return;
      for (const id of ids) {
        const e = g.floor.enemies.find((o) => o.id === id);
        const tile = e && this.tileEls[e.y * g.floor.w + e.x];
        if (!tile) continue;
        const c = centerOf(tile.getBoundingClientRect());
        this.floatText('!', c.x, c.y - 14, 'bad');
      }
      await sleep(260);
    }

    onMapHover(e) {
      if (this.isTouch()) return;
      this.clearPath();
      if (this.busy || this.dragging || !this.game.canAct()) return;
      const tile = e.target.closest('.tile');
      if (!tile) return;
      this.previewPath(Number(tile.dataset.x), Number(tile.dataset.y));
    }

    clearPath() {
      for (const el of this.el.map.querySelectorAll('.path, .path-end, .fight')) el.classList.remove('path', 'path-end', 'fight');
    }

    onOverlayClick(e) {
      const slot = e.target.closest('.stash-slot');
      if (slot) return this.onSlotClick(slot);
      // Poderes, coringa e "limpar seleção" dentro de uma janela ou da cena de combate usam o mesmo código do painel.
      if (e.target.closest('[data-act], [data-joker]')) return this.onPanelClick(e);
      const ringBtn = e.target.closest('[data-ring]');
      if (ringBtn) return this.onRingClick(Number(ringBtn.dataset.ring), Number(ringBtn.dataset.dir) || 0);
      const scrollBtn = e.target.closest('[data-item]');
      if (scrollBtn) return this.useItemClick(scrollBtn.dataset.item, Number(scrollBtn.dataset.dir) || 0);
      const btn = e.target.closest('[data-ov]');
      if (!btn) {
        if (this.help && e.target === this.el.overlay) {
          this.help = false;
          this.renderOverlay();
        }
        return;
      }
      const g = this.game;
      const id = btn.dataset.id;
      switch (btn.dataset.ov) {
        case 'close-help':
          this.help = false;
          this.renderOverlay();
          break;
        case 'combat-toggle':
          this.toggleCard(id);
          break;
        case 'attack':
          this.onFoeClick(id);
          break;
        case 'attack-go':
          this.onFoeGo();
          break;
        case 'trade-go':
          this.onFoeTrade();
          break;
        case 'hidden-card':
          this.toast('Essa carta está travada: tire primeiro as cartas que estão na frente dela.');
          break;
        case 'flee':
          this.doFlee();
          break;
        case 'toggle-discard':
          if (this.discard.has(id)) this.discard.delete(id);
          else this.discard.add(id);
          this.renderOverlay();
          break;
        case 'toggle-pick':
          if (this.picks.has(id)) this.picks.delete(id);
          else if (this.picks.size < g.config.chestPicks) this.picks.add(id);
          this.renderOverlay();
          break;
        case 'confirm-refill': {
          const res = g.resolveRefill();
          if (!res.ok) return this.toast(res.error);
          this.track('refill');
          this.resetOverlayState();
          this.renderAll();
          break;
        }
        case 'confirm-reinforce': {
          const cards = g.pending.cards;
          const gold = g.pending.gold;
          const res = g.resolveReinforce();
          if (!res.ok) return this.toast(res.error);
          this.track('reinforce', { cards: cards.length, gold });
          this.sound('ding');
          this.fxBumpDelay = [0.1, 0.26, 0];
          this.resetOverlayState();
          this.renderAll();
          this.toastOk(`Seu deck ganhou ${cards.map(label).join(', ')}.`);
          break;
        }
        case 'ring-wear': {
          const key = g.pending.ring;
          const res = g.resolveRing(Number(btn.dataset.slot));
          if (!res.ok) return this.toast(res.error);
          this.track('ring', { ring: key, equipped: true });
          this.sound('ding');
          this.resetOverlayState();
          this.renderAll();
          break;
        }
        case 'ring-leave': {
          const key = g.pending.ring;
          g.resolveRing(null);
          this.track('ring', { ring: key, equipped: false });
          this.resetOverlayState();
          this.renderAll();
          break;
        }
        case 'altar-pick':
          this.discard = this.discard.has(id) ? new Set() : new Set([id]);
          this.renderOverlay();
          break;
        case 'altar-go': {
          const cardId = [...this.discard].find((cid) => g.hand.some((c) => c.id === cid));
          const res = g.resolveAltar(cardId);
          if (!res.ok) return this.toast(res.error);
          this.track('special', { kind: 'altar', prize: res.prize });
          this.sound('ding');
          this.resetOverlayState();
          this.renderAll();
          const what = { item: 'um item', ring: 'um anel', both: 'um anel e um item' }[res.prize];
          this.toastOk(`Você sacrifica ${label(res.card)} e ganha ${what}.`);
          break;
        }
        case 'library-offer':
          this.libKey = this.libKey === btn.dataset.key ? null : btn.dataset.key;
          this.renderOverlay();
          break;
        case 'library-go': {
          const res = g.resolveLibrary(this.libKey, [...this.discard]);
          if (!res.ok) return this.toast(res.error);
          this.track('special', { kind: 'library', key: res.key });
          this.sound('scroll', 0.4);
          this.resetOverlayState();
          this.renderAll();
          this.toastOk(`Você leva ${this.offerInfo(res.key).title}.`);
          break;
        }
        case 'crypt-pay': {
          const need = g.config.cryptCost;
          if (this.discard.has(id)) this.discard.delete(id);
          else if (this.discard.size < need) this.discard.add(id);
          else if (need === 1) this.discard = new Set([id]);
          this.renderOverlay();
          break;
        }
        case 'crypt-grave': {
          const want = Math.min(g.config.cryptTake, g.discard.length);
          if (this.cryptTake.has(id)) this.cryptTake.delete(id);
          else if (this.cryptTake.size < want) this.cryptTake.add(id);
          else return this.toast(`Só dá para trazer ${want} carta${want === 1 ? '' : 's'}: desmarque uma antes.`);
          this.renderOverlay();
          break;
        }
        case 'crypt-go': {
          const res = g.resolveCrypt([...this.cryptTake], [...this.discard].filter((cid) => g.hand.some((c) => c.id === cid)));
          if (!res.ok) return this.toast(res.error);
          this.track('special', { kind: 'crypt', cards: res.cards.length });
          this.sound('ding');
          this.resetOverlayState();
          this.renderAll();
          this.toastOk(`A cripta devolve ao deck: ${res.cards.map(label).join(', ')}.`);
          break;
        }
        case 'table-pick':
          this.discard = this.discard.has(id) ? new Set() : new Set([id]);
          this.renderOverlay();
          break;
        case 'table-go': {
          const cardId = [...this.discard].find((cid) => g.hand.some((c) => c.id === cid));
          const res = g.resolveTable(cardId);
          if (!res.ok) return this.toast(res.error);
          this.track('special', { kind: 'table', outcome: res.outcome, rank: res.bet.rank });
          this.sound(res.outcome === 'lose' ? 'creak' : 'ding', res.outcome === 'lose' ? 0.3 : undefined);
          this.resetOverlayState();
          this.renderAll();
          const text = {
            win: `Você ganha! ${label(res.bet)} contra ${label(res.house)} da casa: ${res.cards.length} cartas novas entram no deck.`,
            tie: `Empate: ${label(res.bet)} contra ${label(res.house)} da casa. Sua carta volta para a mão.`,
            lose: `Você perde: ${label(res.bet)} contra ${label(res.house)} da casa. A aposta vai para o cemitério.`,
          }[res.outcome];
          if (res.outcome === 'lose') this.toast(text);
          else this.toastOk(text);
          break;
        }
        case 'forge-target':
          this.forgeTarget = this.forgeTarget === id ? null : id;
          if (this.forgeBurn === id) this.forgeBurn = null;
          this.renderOverlay();
          break;
        case 'forge-burn':
          this.forgeBurn = this.forgeBurn === id ? null : id;
          if (this.forgeTarget === id) this.forgeTarget = null;
          this.renderOverlay();
          break;
        case 'forge-go': {
          const res = g.resolveForge(this.forgeTarget, this.forgeBurn ? [this.forgeBurn] : [], btn.dataset.mode);
          if (!res.ok) return this.toast(res.error);
          this.track('special', { kind: 'forge', mode: res.mode });
          this.sound('ding');
          this.resetOverlayState();
          this.renderAll();
          this.toastOk(`A oficina transforma ${label(res.before)} em ${label(res.card)}.`);
          break;
        }
        case 'special-close':
          g.closeSpecial();
          this.resetOverlayState();
          this.renderAll();
          break;
        case 'close-grave':
          this.graveView = false;
          this.renderOverlay();
          break;
        case 'confirm-chest': {
          const res = g.resolveChest([...this.picks], [...this.discard]);
          if (!res.ok) return this.toast(res.error);
          this.resetOverlayState();
          this.renderAll();
          break;
        }
        case 'tour-next':
          this.tutor.next();
          this.tourChanged();
          break;
        case 'tour-prev':
          this.tutor.prev();
          this.tourChanged();
          break;
        case 'tour-skip':
          this.tutor.skip();
          this.tourChanged();
          break;
        case 'copy-report':
          this.copyReport();
          break;
        case 'send-report':
          this.sendReport();
          break;
        case 'close-report':
          this.reportView = false;
          this.renderOverlay();
          break;
        case 'restart-same':
          this.newGame(g.seed);
          break;
        case 'restart-new':
          this.newGame();
          break;
        case 'tour-retry':
          this.newGame(null, true);
          break;
        case 'tour-play':
          this.tutor.finish('done');
          this.newGame(this.nextSeed);
          break;
      }
    }

    toast(text) {
      const t = this.el.toast;
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
    }

    // ---------- desenho ----------

    renderAll() {
      this.sel = this.sel.filter((id) => this.game.hand.some((c) => c.id === id));
      // A lateral e a mão primeiro: elas definem a altura que sobra para o mapa.
      this.renderSide();
      this.checkHints();
      this.renderCoach();
      this.renderMap();
      this.updateHighlights();
      // Depois de abrir porta ou baú, o modal espera as cartas chegarem.
      const hold = this.fxOn ? this.fxHold : 0;
      this.fxHold = 0;
      clearTimeout(this.overlayTimer);
      if (hold) this.overlayTimer = setTimeout(() => this.renderOverlay(), hold);
      else this.renderOverlay();
      this.syncIntro();
    }

    renderSide() {
      const g = this.game;
      this.el.floor.textContent = g.floor.boss ? 'Chefão' : `Andar ${g.floorNo} / ${g.config.floors}`;
      this.el.turn.textContent = `Turno ${g.turn}`;
      if (g.starved > (this.lastStarved || 0) && !g.tutorial) {
        this.toast('Fome! Uma carta do deck queimou.');
        this.sound('hit');
      }
      this.lastStarved = g.starved;
      if (this.el.hunger) {
        const every = g.config.hungerEvery;
        const left = every ? every - g.hunger : 0;
        this.el.hunger.hidden = g.tutorial || !every;
        this.el.hunger.textContent = `Fome em ${left}`;
        this.el.hunger.classList.toggle('hungry', left <= g.config.hungerWarn);
        this.el.hunger.title = `A cada ${every} turnos você perde 1 carta de fome (a do topo do deck). Faltam ${left} turnos.`;
      }
      this.el.seed.textContent = g.tutorial ? 'treino' : `seed ${g.seed}`;
      this.renderPiles();
      this.renderHand();
      this.renderStash();
      this.renderPanel();
      this.renderLog();
      this.syncTension();
    }

    renderPiles() {
      const g = this.game;
      const top = g.discard[g.discard.length - 1];
      const pile = (name, count, stack) =>
        `<div class="pile"><div class="stack">${stack}</div><b>${count}</b>${name}</div>`;
      const lowDeck = g.status === 'playing' && g.playerDeck.length <= LOW_DECK;
      // O deck da dungeon é gasto em portas, baús e inimigos: o contador mostra o que ainda cobra algo.
      const dungeonLeft = g.dungeonRemaining();
      this.el.piles.innerHTML =
        pile(lowDeck ? 'Deck acabando!' : 'Seu deck (vida)', g.playerDeck.length, g.playerDeck.length ? '<div class="card back small"></div>' : '<div class="empty"></div>').replace('class="pile"', 'class="pile" title="O seu deck é a sua vida: carta usada não volta, e sem cartas para agir você perde."') +
        pile('Cemitério', g.discard.length, top ? cardHTML(top, { small: true, extra: 'static' }) : '<div class="empty"></div>').replace('class="pile"', 'class="pile grave-pile" data-pile="grave" title="Cartas usadas: não voltam ao deck. Toque para ver."') +
        pile('Cartas da dungeon', dungeonLeft, dungeonLeft ? '<div class="card back dungeon small"></div>' : '<div class="empty"></div>').replace('class="pile"', 'class="pile" title="Quanto a masmorra ainda cobra: as cartas de portas, baús e inimigos que ainda estão de pé."') +
        this.manaHTML();

      // O contador "pula" quando muda. O do descarte espera a carta chegar.
      const counts = [g.playerDeck.length, g.discard.length, dungeonLeft];
      const delays = this.fxBumpDelay || [0, 0.26, 0];
      this.fxBumpDelay = null;
      if (this.fxOn && this.lastCounts) {
        counts.forEach((n, i) => {
          if (n === this.lastCounts[i]) return;
          const pileEl = this.el.piles.children[i];
          pileEl.classList.add('bump');
          pileEl.style.setProperty('--bd', `${delays[i]}s`);
        });
      }
      this.lastCounts = counts;
      this.el.piles.children[0].classList.toggle('low', lowDeck);
      // Uma batida de coração só na hora em que o deck fica perigosamente baixo.
      if (lowDeck && !this.lowDeckOn) this.sound('heartbeat');
      this.lowDeckOn = lowDeck;
    }

    // Como usar os anéis ativos (Ladrão, Precisão e de naipe): escolher 1 carta e tocar no anel, gastando mana.
    ringHintHTML() {
      const g = this.game;
      const cost = g.config.ringUseMana;
      const active = g.rings.filter((r) => r && (DC.ROGUE.RINGS[r.ring].suit || DC.ROGUE.RINGS[r.ring].use));
      if (!active.length) return '';
      const one = this.sel.length === 1;
      const names = active.map((r) => DC.ROGUE.RINGS[r.ring].short).join(', ');
      if (g.mana < cost) return `<p class="muted"><b>Anel (${names}):</b> custa ${cost} de mana e você tem ${g.mana}. Escolha um ♦ e use o botão Poder para ganhar mana.</p>`;
      if (!one) return `<p class="muted"><b>Anel (${names}):</b> escolha <b>1 carta</b> e toque no anel (linha "Anéis", ao lado da mão; nos de ±1, em −1 ou +1). Custa ${cost} de mana; você tem ${g.mana}.</p>`;
      return `<p><b>Anel (${names}):</b> toque nele (linha "Anéis") para usar na carta escolhida. Custa ${cost} de mana; você tem ${g.mana}.</p>`;
    }

    // Estoque de mana: se enche descartando ♦ (poder) e se gasta nos anéis.
    manaHTML() {
      const g = this.game;
      const max = g.manaMax();
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < g.mana ? 'on' : ''}"></i>`).join('');
      return `<div class="pile mana-pile" title="Mana: descarte um ♦ (poder) para ganhar mana igual ao número dele. Os anéis gastam ${g.config.ringUseMana} de mana por uso."><div class="mana-orb">♦</div><b>${g.mana}/${max}</b>Mana<div class="mana-pips">${pips}</div></div>`;
    }

    // Quantas cartas o poder de ♥ (comprar) compraria agora, limitado pela mão e pelo deck.
    powerCount(card) {
      const g = this.game;
      return Math.min(card.rank, g.handLimit() - (g.hand.length - 1), g.playerDeck.length);
    }

    // ---------- inventário (slots do Pergaminho de Inventário) ----------

    // Os slots: bloqueados (ainda sem pergaminho), livres (+) ou com uma carta guardada.
    slotsInner() {
      const g = this.game;
      let html = '';
      for (let i = 0; i < g.config.maxSlots; i++) {
        const fresh = i === this.newSlot ? ' fresh' : '';
        if (i < g.stash.length) {
          const card = g.stash[i];
          html += `<div class="stash-slot filled${fresh}" data-slot="${i}" data-id="${card.id}" title="${label(card)} guardada: toque para devolver à mão">${cardHTML(card, { small: true, extra: 'static' })}</div>`;
        } else if (i < g.slotsOpen) {
          html += `<div class="stash-slot open${fresh}" data-slot="${i}" title="Slot livre: escolha 1 carta da mão e toque aqui para guardá-la"><b>+</b></div>`;
        } else {
          html += `<div class="stash-slot locked" data-slot="${i}" title="Bloqueado: ache um Pergaminho de Inventário (inimigos e baús)">${SCROLL_SVG}</div>`;
        }
      }
      return html;
    }

    renderStash() {
      const g = this.game;
      const gear = this.bagHTML();
      this.el.stash.innerHTML = `<div class="stash-group"><div class="stash-label">Inventário ${g.slotsOpen ? `${g.stash.length}/${g.slotsOpen}` : 'bloqueado'}</div><div class="stash-row">${this.slotsInner()}</div></div>`;
      this.el.gear.innerHTML = gear;
      this.el.gear.hidden = !gear;
      this.newSlot = -1;
    }

    // ---------- salas especiais: poço, altar e biblioteca ----------

    fixtureTitle(fx) {
      const g = this.game;
      if (fx.kind === 'well') {
        if (fx.used) return `Poço seco (a água era ${fx.look})`;
        return g.wellKnown.has(fx.look)
          ? `Poço de água ${fx.look}: ${DC.ROGUE.WELL_EFFECTS[g.wellEffects[fx.look]].text} Toque para beber (de graça).`
          : `Poço de água ${fx.look}: ninguém sabe o que ele faz. Toque para beber e descobrir (de graça).`;
      }
      if (fx.kind === 'altar') return fx.used ? 'Altar apagado' : 'Altar: sacrifique 1 carta da mão e ganhe um prêmio (quanto maior o valor, melhor)';
      if (fx.kind === 'crypt') return fx.used ? 'Cripta vazia' : `Cripta: pague ${g.config.cryptCost} carta e traga ${g.config.cryptTake} de volta do cemitério para o deck`;
      if (fx.kind === 'table') return fx.used ? 'Mesa vazia' : 'Mesa de jogo: aposte 1 carta contra a da casa (maior ganha cartas novas, menor perde a aposta)';
      if (fx.kind === 'forge') return fx.used ? 'Oficina apagada' : (g.config.forgeCost ? `Oficina: queime ${g.config.forgeCost} carta para dar +1 de valor, ou outro naipe, a outra` : 'Oficina: dê +1 de valor, ou outro naipe, a uma carta da mão');
      return fx.used ? 'Estante vazia' : `Estante de pergaminhos: pague ${g.config.libraryCost} carta e leve 1 entre 3`;
    }

    // Texto do que um pergaminho da biblioteca é.
    offerInfo(key) {
      if (key === 'slot') return { title: 'Pergaminho de Inventário', text: 'Abre mais 1 espaço para guardar cartas.' };
      const def = DC.ROGUE.ITEMS[key];
      return { title: `Pergaminho de ${def.name}`, text: def.text };
    }

    fixtureHintHTML() {
      const near = this.game.adjacentFixtures();
      if (!near.length) return '';
      const names = { well: 'Poço', altar: 'Altar', library: 'Estante', crypt: 'Cripta', table: 'Mesa de jogo', forge: 'Oficina' };
      return near.map(({ obj }) => `<p><b>${names[obj.kind]}</b> ao lado: ${this.isTouch() ? 'toque' : 'clique'} nele.${obj.kind === 'well' ? ' Beber é de graça.' : ''}</p>`).join('');
    }

    useFixtureClick(x, y, tile) {
      const g = this.game;
      const res = g.useFixture(x, y);
      if (!res.ok) return this.reject(res.error);
      this.sel = [];
      this.resetOverlayState();
      this.track('special', { kind: res.kind });
      if (res.kind !== 'well') {
        this.sound('creak', 0.3);
        return this.renderAll();
      }
      const text = {
        mana: res.wasted ? 'a mana já estava cheia: o efeito se perdeu' : `a mana enche (+${res.count})`,
        deck: `${res.count} cartas novas entram no seu deck`,
        hand: res.wasted ? 'sua mão já estava cheia: o efeito se perdeu' : `a mão se enche (+${res.count} carta${res.count === 1 ? '' : 's'})`,
      }[res.effect];
      this.sound('ding');
      if (this.fxOn) {
        const c = centerOf(tile.getBoundingClientRect());
        this.ring(c.x, c.y, WELL_WATER[res.look]);
        this.burst(c.x, c.y, { count: 16, color: WELL_WATER[res.look], spread: 60 });
      }
      this.renderAll();
      this.toastOk(`Poço de água ${res.look}: ${text}.`);
    }

    // Altar: escolha a carta da mão a sacrificar; o valor dela decide o prêmio.
    altarHTML() {
      const g = this.game;
      const cfg = g.config;
      const ids = [...this.discard].filter((id) => g.hand.some((c) => c.id === id)).slice(-1);
      const card = ids.length ? g.hand.find((c) => c.id === ids[0]) : null;
      const prize = card ? g.altarPrize(card.rank) : null;
      const names = { item: 'um item (poção ou pergaminho)', ring: 'um anel', both: 'um anel e um item' };
      const bagFull = Boolean(prize) && prize !== 'ring' && g.items.length >= cfg.maxItems;
      return `<div class="modal special-modal">
        <div class="special-big">${fixtureSVG({ kind: 'altar', used: false })}</div>
        <h2>Altar</h2>
        <p>Sacrifique <b>1 carta da mão</b> em troca de um prêmio. Quanto maior o valor, melhor: de A a ${cfg.altarRingFrom - 1} um <b>item</b>, de ${cfg.altarRingFrom} a 10 um <b>anel</b>, e J, Q ou K um <b>anel e um item</b>.</p>
        <h4>Sua mão (toque na carta a sacrificar)</h4>
        <div class="cardrow">${g.hand.length ? this.handRow('altar-pick', new Set(ids)) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        <div class="summary">${card ? `Sacrificar ${label(card)}: ${names[prize]}${bagFull ? ' · sua bolsa está cheia, use um item antes' : ''}` : 'Escolha uma carta da mão.'}</div>
        <div class="actions"><button class="btn primary" data-ov="altar-go" ${card && !bagFull ? '' : 'disabled'}>Sacrificar</button><button class="btn" data-ov="special-close">Deixar o altar</button></div>
      </div>`;
    }

    // Biblioteca: escolha 1 dos 3 pergaminhos e as cartas que pagam por ele.
    libraryHTML() {
      const g = this.game;
      const cfg = g.config;
      const fx = g.floor.fixtures[g.pending.fixtureId];
      const need = cfg.libraryCost;
      const chosen = [...this.discard].filter((id) => g.hand.some((c) => c.id === id));
      const blocked = (key) => (key === 'slot' ? g.slotsOpen >= cfg.maxSlots : g.items.length >= cfg.maxItems);
      const offers = fx.offers
        .map((key) => {
          const info = this.offerInfo(key);
          const full = blocked(key);
          return `<button class="btn offer${this.libKey === key ? ' primary' : ''}" data-ov="library-offer" data-key="${key}" ${full ? 'disabled' : ''}><b>${info.title}</b><small>${full ? (key === 'slot' ? 'seus slots já estão no máximo' : 'sua bolsa está cheia') : info.text}</small></button>`;
        })
        .join('');
      const ready = Boolean(this.libKey) && !blocked(this.libKey) && chosen.length === need;
      return `<div class="modal special-modal">
        <div class="special-big">${fixtureSVG({ kind: 'library', used: false })}</div>
        <h2>Biblioteca</h2>
        <p>Pague <b>${need} carta${need === 1 ? '' : 's'}</b> da mão e leve <b>1</b> destes pergaminhos (todos têm o nome à mostra).</p>
        <div class="offers">${offers}</div>
        <h4>Sua mão (marque ${need} para pagar)</h4>
        <div class="cardrow">${g.hand.length ? this.handRow('toggle-discard', this.discard) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        <div class="summary">Pagando ${chosen.length}/${need} · ${this.libKey ? `levando ${this.offerInfo(this.libKey).title}` : 'escolha um pergaminho'}</div>
        <div class="actions"><button class="btn primary" data-ov="library-go" ${ready ? '' : 'disabled'}>Levar o pergaminho</button><button class="btn" data-ov="special-close">Deixar a estante</button></div>
      </div>`;
    }

    // Cripta: pague 1 carta da mão e escolha cartas do cemitério para voltarem ao deck.
    cryptHTML() {
      const g = this.game;
      const cfg = g.config;
      const need = cfg.cryptCost;
      const want = Math.min(cfg.cryptTake, g.discard.length);
      const paid = [...this.discard].filter((id) => g.hand.some((c) => c.id === id));
      const order = { S: 0, H: 1, D: 2, C: 3 };
      const sorted = g.discard.slice().sort((a, b) => order[a.suit] - order[b.suit] || a.rank - b.rank);
      const pick = (c) => cardHTML(c, { small: true, selected: this.cryptTake.has(c.id), extra: '' }).replace('class="card', 'data-ov="crypt-grave" class="card');
      const groups = ['S', 'H', 'D', 'C']
        .map((suit) => {
          const list = sorted.filter((c) => c.suit === suit);
          return list.length ? `<div class="grave-suit"><h4>${sym(suit)} ${DC.SUIT_NAME[suit]} · ${list.length}</h4><div class="grave-row">${list.map(pick).join('')}</div></div>` : '';
        })
        .join('');
      const ready = want > 0 && this.cryptTake.size === want && paid.length === need;
      return `<div class="modal special-modal">
        <div class="special-big">${fixtureSVG({ kind: 'crypt', used: false })}</div>
        <h2>Cripta</h2>
        <p>Pague <b>${need} carta${need === 1 ? '' : 's'}</b> da mão e traga de volta <b>${cfg.cryptTake}</b> do cemitério: elas entram no seu deck em posições aleatórias.</p>
        <h4>Do cemitério (marque ${want || cfg.cryptTake})</h4>
        ${g.discard.length ? groups : '<p class="muted">O cemitério está vazio: volte aqui depois de gastar algumas cartas.</p>'}
        <h4>Sua mão (marque ${need} para pagar)</h4>
        <div class="cardrow">${g.hand.length ? this.handRow('crypt-pay', this.discard) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        <div class="summary">Trazendo ${this.cryptTake.size}/${want} · pagando ${paid.length}/${need}</div>
        <div class="actions"><button class="btn primary" data-ov="crypt-go" ${ready ? '' : 'disabled'}>Trazer de volta</button><button class="btn" data-ov="special-close">Deixar a cripta</button></div>
      </div>`;
    }

    // Mesa de jogo: aposte 1 carta; a carta da casa só aparece depois.
    tableHTML() {
      const g = this.game;
      const cfg = g.config;
      const ids = [...this.discard].filter((id) => g.hand.some((c) => c.id === id)).slice(-1);
      const card = ids.length ? g.hand.find((c) => c.id === ids[0]) : null;
      return `<div class="modal special-modal">
        <div class="special-big">${fixtureSVG({ kind: 'table', used: false })}</div>
        <h2>Mesa de jogo</h2>
        <p>Aposte <b>1 carta da mão</b> contra uma carta da casa, que só aparece depois. Se a sua for <b>maior</b>, ela volta e entram <b>${cfg.tableWinCards} cartas novas</b> no deck. Se for <b>igual</b>, ela volta. Se for <b>menor</b>, você a perde. Valores: A é o menor e K o maior.</p>
        <h4>Sua mão (toque na carta a apostar)</h4>
        <div class="cardrow">${g.hand.length ? this.handRow('table-pick', new Set(ids)) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        <div class="summary">${card ? `Apostar ${label(card)}: ${Math.round(((card.rank - 1) / 13) * 100)}% de ganhar, ${Math.round(100 / 13)}% de empatar, ${Math.round(((13 - card.rank) / 13) * 100)}% de perder` : 'Escolha uma carta da mão.'}</div>
        <div class="actions"><button class="btn primary" data-ov="table-go" ${card ? '' : 'disabled'}>Apostar</button><button class="btn" data-ov="special-close">Deixar a mesa</button></div>
      </div>`;
    }

    // Oficina: escolha a carta a melhorar, a que queima e a melhoria.
    forgeHTML() {
      const g = this.game;
      const cfg = g.config;
      const target = g.hand.find((c) => c.id === this.forgeTarget) || null;
      const burn = g.hand.find((c) => c.id === this.forgeBurn) || null;
      const row = (attr, chosenId) => g.hand.map((c) => cardHTML(c, { selected: c.id === chosenId, extra: '' }).replace('class="card', `data-ov="${attr}" class="card`)).join('');
      const needBurn = cfg.forgeCost > 0;
      const ready = Boolean(target && (burn || !needBurn));
      const upOk = ready && target.rank < 13;
      const suitBtn = (suit) => `<button class="btn" data-ov="forge-go" data-mode="${suit}" ${ready && target.suit !== suit ? '' : 'disabled'}>${sym(suit)}</button>`;
      const preview = target ? `${label(target)} pode virar ${target.rank < 13 ? label({ suit: target.suit, rank: target.rank + 1 }) : 'nada (K não sobe)'} ou mudar de naipe.` : 'Escolha a carta a melhorar.';
      return `<div class="modal special-modal">
        <div class="special-big">${fixtureSVG({ kind: 'forge', used: false })}</div>
        <h2>Oficina</h2>
        <p>${needBurn ? `Queime <b>${cfg.forgeCost} carta</b> da mão para melhorar <b>outra</b>` : 'Melhore <b>1 carta</b> da mão'} para sempre: <b>+1 no valor</b> (um 3 vira 4) ou <b>outro naipe</b>.</p>
        <h4>${needBurn ? '1. ' : ''}Carta a melhorar</h4>
        <div class="cardrow">${g.hand.length ? row('forge-target', this.forgeTarget) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        ${needBurn ? `<h4>2. Carta a queimar</h4>
        <div class="cardrow">${g.hand.length ? row('forge-burn', this.forgeBurn) : ''}</div>` : ''}
        <div class="summary">${preview}${needBurn && target && !burn ? ' Agora escolha a carta a queimar.' : ''}</div>
        <div class="actions"><button class="btn primary" data-ov="forge-go" data-mode="up" ${upOk ? '' : 'disabled'}>+1 no valor</button>${['S', 'H', 'D', 'C'].map(suitBtn).join('')}<button class="btn" data-ov="special-close">Deixar a oficina</button></div>
      </div>`;
    }

    // Bolsa de poções e pergaminhos (experimento Rogue): toque para usar. O efeito só é descoberto usando.
    bagHTML() {
      const g = this.game;
      if (g.tutorial) return '';
      const R = DC.ROGUE;
      let chips = '';
      for (let i = 0; i < g.config.maxItems; i++) {
        const item = g.items[i];
        if (!item) {
          chips += '<div class="bag-slot" title="Espaço livre da bolsa"></div>';
          continue;
        }
        const def = R.ITEMS[item.item];
        const known = g.identified.has(item.item);
        if (def.signed) {
          // Pergaminhos de ±1: dois botões (−1 e +1) para a carta escolhida; usa e some, sem gastar mana.
          const how = `${R.itemName(g, item.item)}: ${def.text} Escolha 1 carta da mão e toque em −1 ou +1.`;
          chips += `<div class="bag-slot item ${def.kind} known ring-pm" title="${how}"><i>${R.ICON[def.kind]}</i><span>${def.name}</span><span class="pm"><button type="button" data-item="${item.id}" data-dir="-1">−1</button><button type="button" data-item="${item.id}" data-dir="1">+1</button></span></div>`;
          continue;
        }
        const short = known ? def.name : g.looks[item.item];
        const tip = `${R.itemName(g, item.item)}: ${known ? def.text : 'efeito desconhecido, descubra usando'}. Toque para usar.`;
        chips += `<button class="bag-slot item ${def.kind}${known ? ' known' : ''}" data-item="${item.id}" title="${tip}"><i>${R.ICON[def.kind]}</i><span>${short}</span></button>`;
      }
      return `<div class="gear-group"><div class="stash-label">Bolsa ${g.items.length}/${g.config.maxItems}</div><div class="bag-row">${chips}</div></div><div class="gear-group">${this.ringsHTML()}</div>`;
    }

    // Anéis no dedo: toque num anel de naipe com 1 carta escolhida para usá-lo (1 vez por andar).
    ringsHTML() {
      const g = this.game;
      const R = DC.ROGUE.RINGS;
      const cost = g.config.ringUseMana;
      const worn = g.rings.filter(Boolean).length;
      const chips = g.rings
        .map((ring, i) => {
          if (!ring) return '<div class="bag-slot" title="Espaço de anel livre"></div>';
          const def = R[ring.ring];
          const active = Boolean(def.suit || def.use);
          const broke = active && g.mana < cost;
          const tip = `${def.name}: ${def.text}${active ? ` Custa ${cost} de mana. Escolha 1 carta e toque no anel.` : ''}`;
          const state = active ? `${cost} mana` : 'no dedo';
          if (def.signed) {
            // Anéis de ±1: dois botões, um para subir e outro para descer a carta escolhida.
            const off = broke ? ' disabled' : '';
            return `<div class="bag-slot item ring-slot suit ring-pm${broke ? ' spent' : ''}" title="${tip.replace('toque no anel', 'toque em −1 ou +1')}">${ringSVG(ring.ring)}<span>${def.short}</span><small>${state}</small><span class="pm"><button type="button" data-ring="${i}" data-dir="-1"${off}>−1</button><button type="button" data-ring="${i}" data-dir="1"${off}>+1</button></span></div>`;
          }
          return `<button class="bag-slot item ring-slot${broke ? ' spent' : ''}${active ? ' suit' : ''}" data-ring="${i}" title="${tip}">${ringSVG(ring.ring)}<span>${def.short}</span><small>${state}</small></button>`;
        })
        .join('');
      return `<div class="stash-label">Anéis ${worn}/${g.rings.length}</div><div class="bag-row">${chips}</div>`;
    }

    // Pergaminhos de Precisão na cena de combate: um par −1/+1 por pergaminho (o Ladrão só vale nas portas).
    combatScrollsHTML() {
      const g = this.game;
      return g.items
        .filter((it) => DC.ROGUE.ITEMS[it.item].signed && DC.ROGUE.ITEMS[it.item].use === 'fight')
        .map((it) => {
          const def = DC.ROGUE.ITEMS[it.item];
          return ['−1', '+1'].map((t, k) => `<button class="btn ring-btn scroll-btn" data-item="${it.id}" data-dir="${k ? 1 : -1}" title="${def.text}">📜 ${def.name} ${t} (uso único)</button>`).join('');
        })
        .join('');
    }

    // Botões de anel na cena de combate. Os de ±1 (Precisão) têm um botão para cada sentido.
    combatRingHTML(ring, i) {
      const g = this.game;
      const def = ring && DC.ROGUE.RINGS[ring.ring];
      // Anel de portas e baús (Ladrão) não serve no combate: fica só na linha "Anéis".
      if (!def || (!def.suit && !def.use) || def.use === 'pay') return '';
      const cost = g.config.ringUseMana;
      const off = g.mana >= cost ? '' : 'disabled';
      const tip = `${def.text} Custa ${cost} de mana.`;
      if (def.signed) {
        return ['−1', '+1'].map((t, k) => `<button class="btn ring-btn" data-ring="${i}" data-dir="${k ? 1 : -1}" ${off} title="${tip}">${def.short} ${t} (${cost} mana)</button>`).join('');
      }
      return `<button class="btn ring-btn" data-ring="${i}" ${off} title="${tip}">${def.short} ${def.name} (${cost} mana)</button>`;
    }

    onRingClick(slot, dir = 0) {
      const g = this.game;
      if (this.busy) return;
      const ring = g.rings[slot];
      if (!ring) return;
      const def = DC.ROGUE.RINGS[ring.ring];
      if (def.signed && !dir) return this.toast(`${def.name}: escolha 1 carta e toque em −1 ou +1.`);
      if (!def.suit && !def.use) return this.toast(`${def.name}: ${def.text} (vale enquanto está no dedo)`);
      if (!g.canAct() && !g.canFight()) return this.toast('Não dá para usar o anel agora.');
      if (g.mana < g.config.ringUseMana) return this.toast(`${def.name} custa ${g.config.ringUseMana} de mana e você tem ${g.mana}. Descarte um ♦ para ganhar mana.`);
      if (this.sel.length !== 1) return this.toast(`Escolha 1 carta da mão e toque no ${def.name}.`);
      const id = this.sel[0];
      const res = g.useRing(slot, id, dir);
      if (!res.ok) return this.reject(res.error);
      this.track('ring-use', { ring: ring.ring });
      this.sound('joker');
      this.renderAll();
      const el = this.el.overlay.querySelector(`.card[data-id="${id}"]`) || this.el.hand.querySelector(`.card[data-id="${id}"]`);
      if (el && this.fxOn) {
        const c = centerOf(el.getBoundingClientRect());
        this.ring(c.x, c.y, def.color);
        this.burst(c.x, c.y, { count: 14, color: def.color, spread: 60, glyph: def.suit ? DC.SUIT_SYMBOL[def.suit] : dir < 0 ? '−' : '+' });
      }
      this.toastOk(def.suit ? `${label(res.card)}: o anel mudou o naipe (−${g.config.ringUseMana} de mana).` : `${label(res.card)}: ${signed(res.card.boost[def.use])} ${def.use === 'pay' ? 'ao pagar' : 'em combate'} (−${g.config.ringUseMana} de mana).`);
    }

    useItemClick(id, dir = 0) {
      const g = this.game;
      const item = g.items.find((i) => i.id === id);
      const def = item && DC.ROGUE.ITEMS[item.item];
      if (def && def.signed) {
        // Pergaminho de ±1: precisa de 1 carta escolhida e do sentido; também vale dentro do combate.
        if (this.busy || (!g.canAct() && !g.canFight())) return this.toast('Não dá para usar itens agora.');
        if (this.sel.length !== 1) return this.toast(`Escolha 1 carta da mão e toque em −1 ou +1 no Pergaminho de ${def.name}.`);
        const cardId = this.sel[0];
        const out = g.useItem(id, cardId, dir);
        if (!out.ok) return this.reject(out.error);
        this.track('scroll-use', { scroll: item.item });
        this.sound('joker');
        this.renderAll();
        const el = this.el.overlay.querySelector(`.card[data-id="${cardId}"]`) || this.el.hand.querySelector(`.card[data-id="${cardId}"]`);
        if (el && this.fxOn) {
          const c = centerOf(el.getBoundingClientRect());
          this.ring(c.x, c.y, '#e8dcc0');
          this.burst(c.x, c.y, { count: 14, color: '#e8dcc0', spread: 60, glyph: dir < 0 ? '−' : '+' });
        }
        return this.toastOk(`${label(out.card)}: ${signed(out.card.boost[def.use])} ${def.use === 'pay' ? 'ao pagar' : 'em combate'} (pergaminho usado).`);
      }
      if (this.busy || !g.canAct()) return this.toast('Não dá para usar itens agora.');
      const res = g.useItem(id);
      if (!res.ok) return this.reject(res.error);
      this.sound('ding', 0.12);
      this.toastOk(`${res.discovered ? 'Você descobriu: ' : ''}${res.name}. ${res.text}`);
      this.sel = [];
      this.renderAll();
    }

    // Os slots também aparecem dentro das janelas (baú e combate), onde a mão fica coberta.
    stashModalHTML() {
      const g = this.game;
      if (!g.slotsOpen) return '';
      return `<h4>Inventário ${g.stash.length}/${g.slotsOpen} · guardar em vez de descartar</h4><div class="stash-row modal-stash">${this.slotsInner()}</div>`;
    }

    // Qual carta da mão vai para um slot livre: a marcada para descartar (baú) ou
    // a única carta escolhida.
    slotCandidate() {
      const g = this.game;
      if (g.pending && g.pending.type === 'chest') {
        return [...this.discard].find((id) => g.hand.some((c) => c.id === id)) || null;
      }
      return this.sel.length === 1 ? this.sel[0] : null;
    }

    onSlotClick(el) {
      const g = this.game;
      if (this.busy || !g.canStore()) return;
      if (g.pending && g.pending.type === 'refill') return this.toast('Pegue as cartas primeiro.');
      const rect = el.getBoundingClientRect();
      if (el.dataset.id) {
        // Slot com carta: devolve para a mão. Com a mão cheia, a carta marcada troca de lugar com ela.
        const swap = this.slotCandidate();
        if (g.hand.length >= g.handLimit() && !swap) return this.toast('Mão cheia: marque 1 carta da mão e toque na guardada para trocar de lugar.');
        const res = g.unstashCard(el.dataset.id, swap);
        if (!res.ok) return this.reject(res.error);
        if (res.swapped) {
          this.sel = this.sel.filter((id) => id !== res.swapped.id);
          this.discard.delete(res.swapped.id);
          this.track('stash');
        }
        this.fxEnter = rect;
        this.sound('draw');
        this.renderAll();
        return;
      }
      if (el.classList.contains('locked')) {
        return this.toast('Slot bloqueado: derrote inimigos ou abra baús para achar um Pergaminho de Inventário.');
      }
      const id = this.slotCandidate();
      if (!id) {
        const modal = g.pending && g.pending.type === 'chest';
        return this.toast(modal ? 'Marque 1 carta da mão e toque no slot: ela é guardada em vez de descartada.' : 'Escolha 1 carta da mão e toque no slot para guardá-la.');
      }
      const res = g.stashCard(id);
      if (!res.ok) return this.reject(res.error);
      this.discard.delete(id);
      this.fxExit = { rect };
      this.track('stash');
      this.sound('stash');
      this.renderAll();
    }

    // Texto do emblema de uma carta da mão: o que ela faz de verdade (♦ dobra ao andar,
    // ♣ copia, ♥ compra e ♠ dobra no combate; a compra já é limitada pelo deck e pela mão).
    cardBadge(card) {
      let text = this.cardBadgeText(card);
      // Ferrugem: o número da carta não vale mais o que está escrito nela. Mostra o valor de verdade.
      if (this.game.rusted() && card.suit === 'H') text += ` · vale ${this.game.cardValue(card)} (ferrugem)`;
      const boost = card.boost && (card.boost.pay || card.boost.fight);
      return boost ? `${text} · ${signed(boost)} ajuste` : text;
    }

    cardBadgeText(card) {
      const g = this.game;
      if (card.suit === 'D') return `mana +${g.cardValue(card)}`;
      if (card.suit === 'C') {
        const copied = g.jokerTarget(card);
        return copied ? `copia ${g.cardValue(card)}` : `vale ${g.cardValue(card)}`;
      }
      if (card.suit === 'S') return g.inCombat() ? `vale ${g.cardValue(card)} ou ${g.attackValue(card)}` : `combate ×2`;
      return `compra ${this.powerCount(card)}`;
    }

    // A mão reaproveita os elementos das cartas que continuam nela (assim as
    // transições de seleção funcionam) e compara antes/depois para animar quem
    // saiu, quem entrou e quem só mudou de lugar.
    renderHand() {
      const g = this.game;
      const hand = this.el.hand;
      const fx = this.fxOn;
      const old = new Map([...hand.querySelectorAll('.card')].map((n) => [n.dataset.id, n]));
      if (this.handReset) {
        for (const n of old.values()) n.remove();
        old.clear();
        this.handReset = false;
      }
      const before = new Map();
      if (fx) for (const [id, n] of old) before.set(id, n.getBoundingClientRect());

      const want = new Set(g.hand.map((c) => c.id));
      const exit = this.fxExit;
      this.fxExit = null;
      let leaving = 0;
      for (const [id, n] of old) {
        if (want.has(id)) continue;
        if (fx) this.flyOut(n, before.get(id), exit, leaving);
        // Ao abrir porta o som da batida vem de openSound; aqui só o descarte.
        if (!exit) this.sound('discard', (fx ? 0.2 : 0) + leaving * 0.05);
        leaving++;
        n.remove();
        old.delete(id);
      }

      const nodes = g.hand.map((card, i) => {
        const selected = this.sel.includes(card.id);
        // Mostra sempre o que a carta faz de verdade: ♦ dobra ao andar, ♣ copia,
        // ♥ devolve e ♠ compra (já limitado pelo descarte, pelo deck e pela mão).
        // Em combate, uma carta congelada (Gelo) fica marcada na mão até você derrubar uma carta do inimigo.
        const frozen = g.pending && g.pending.frozen === card.id;
        const next = htmlToEl(cardHTML(card, { selected, badge: frozen ? '❄ congelada' : this.cardBadge(card), extra: frozen ? 'frozen' : '' }));
        let node = old.get(card.id);
        if (node) {
          node.className = next.className;
          node.innerHTML = next.innerHTML;
          node.title = next.title;
        } else node = next;
        node.style.setProperty('--i', i);
        node.style.setProperty('--n', g.hand.length);
        return node;
      });

      hand.querySelectorAll('.slot').forEach((s) => s.remove());
      nodes.forEach((node, i) => {
        if (hand.children[i] !== node) hand.insertBefore(node, hand.children[i] || null);
      });
      for (let i = g.hand.length; i < g.handLimit(); i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        hand.appendChild(slot);
      }

      const step = this.fxDrawStep;
      this.fxDrawStep = 0;
      const source = this.fxEnter;
      this.fxEnter = null;
      const deck = fx ? source || this.pileRect(0) : null;
      let drawn = 0;
      for (const node of nodes) {
        const was = before.get(node.dataset.id);
        if (was) {
          this.slide(node, was);
        } else if (!old.has(node.dataset.id)) {
          const delay = drawn++ * (step || 90);
          this.sound('draw', delay / 1000 + (fx ? 0.05 : 0));
          if (deck) this.flyIn(node, deck, delay);
        }
      }
    }

    renderLog() {
      const recent = this.game.logs.slice(-6).reverse();
      this.el.log.innerHTML = recent.map((l) => `<div class="${l.kind}">${l.text}</div>`).join('');
    }

    // Seleção atual: soma, cartas, poderes de ♥/♠ e a escolha do coringa. No combate não
    // mostra o texto de andar.
    selectionHTML(combat) {
      const g = this.game;
      const cards = g.handCards(this.sel) || [];
      // No combate o ♠ vale o dobro; nas portas e no andar, só o número.
      const sum = combat ? g.attackSum(this.sel) : g.payTotal(this.sel);
      // Cada ♠ vale o número OU o dobro: `sums` são todas as somas possíveis (a maior é `sum`).
      const sums = combat ? g.attackSums(this.sel) : [sum];
      const ringPlus = cards.reduce((n, c) => n + g.boostOf(c, combat ? 'fight' : 'pay'), 0);
      // Soma exata: bate com o custo de uma porta/baú ao lado ou, em combate, com a soma das cartas abertas do inimigo
      // que você marcou. É a jogada boa, então o box inteiro ganha destaque.
      let exact = false;
      if (cards.length) {
        if (combat) {
          const marked = this.markedTargets();
          exact = marked.length > 0 && sums.includes(marked.reduce((n, c) => n + c.rank, 0));
        } else {
          exact = g.adjacentTargets().some((t) => t.obj.cost.rank === sum);
        }
      }
      // Fora de combate, 2 ou mais cartas do mesmo naipe numa soma exata dão o bônus maior.
      const flush = exact && !combat && cards.length >= 2 && cards.every((c) => c.suit === cards[0].suit);
      const star = exact ? (combat ? `<span class="exact-tag">★ soma exata${g.config.matchDraw ? ` · +${g.config.matchDraw} carta` : ''}</span>` : `<span class="exact-tag">★ soma exata${flush ? ` · mesmo naipe · +${g.config.flushBonus} cartas` : ` · +${g.config.exactBonus} carta`}</span>`) : '';
      let html = `<h3>Seleção · soma ${sum}${sums.length > 1 ? ` <small>(ou ${sums.slice(0, -1).join(', ')})</small>` : ''}${ringPlus ? ` <small>(${signed(ringPlus)} de ajuste)</small>` : ''}${star}</h3><div class="row">${cards.map(miniChip).join('')}</div>`;
      if (combat && cards.some((c) => c.suit === 'S')) {
        html += `<p class="muted">♠ vale o número <b>ou o dobro</b> em combate (${cards
          .filter((c) => c.suit === 'S')
          .map((c) => `${g.cardValue(c)} ou ${g.attackValue(c)}`)
          .join(', ')}): casa com os dois valores.</p>`;
      }

      return { html, sum, sums, cards, exact };
    }

    // O poder do ♣ (coringa): vale o próprio número ou copia outra carta da mão. As escolhas ficam na caixa do Poder.
    jokerHTML(cards) {
      const g = this.game;
      let html = '';
      for (const joker of cards.filter((c) => c.suit === 'C')) {
        const others = g.hand.filter((c) => c.id !== joker.id);
        if (!others.length) continue;
        const current = g.jokerTarget(joker);
        html += `<div class="joker-choice"><span>${label(joker)} vale:</span><div class="joker-btns"><button class="btn small ${current ? '' : 'on'}" data-joker="${joker.id}" data-target="">${joker.rank} (própria)</button></div><span>ou copia:</span><div class="joker-btns">${others
          .map((o) => `<button class="btn small ${current && current.id === o.id ? 'on' : ''}" data-joker="${joker.id}" data-target="${o.id}">${label(o)}</button>`)
          .join('')}</div></div>`;
      }
      return html;
    }

    // Botão do poder (só ♥ compra cartas): fica ao lado da mão (também vale em combate).
    powerHTML() {
      const g = this.game;
      const cards = g.status === 'playing' ? g.handCards(this.sel) || [] : [];
      const c = cards.length === 1 ? cards[0] : null;
      let body;
      if (c && c.suit === 'H') {
        const n = this.powerCount(c);
        const what = `Comprar ${n} carta${n === 1 ? '' : 's'}`;
        body = `<button class="btn power-btn red" data-act="power" ${n ? '' : 'disabled'} title="${what}">
          <b>${sym(c.suit)}</b><span>Usar poder</span><small>${n ? what : 'sem efeito agora'}</small></button>`;
      } else if (c && c.suit === 'D') {
        const full = g.mana >= g.manaMax();
        const gain = Math.min(g.cardValue(c), g.manaMax() - g.mana);
        const what = full ? 'Mana cheia' : `Ganhar ${gain} de mana (${g.mana} → ${g.mana + gain})`;
        body = `<button class="btn power-btn gold" data-act="power" ${full ? 'disabled' : ''} title="${what}">
          <b>${sym(c.suit)}</b><span>Virar mana</span><small>${what}</small></button>`;
      } else if (cards.some((x) => x.suit === 'C') && this.jokerHTML(cards)) {
        body = `<div class="power-joker">${this.jokerHTML(cards)}</div>`;
      } else {
        body = '<div class="power-empty">Escolha uma carta ♥ para comprar, ♦ para ganhar mana ou ♣ para copiar outra</div>';
      }
      return `<div class="power-label">Poder</div>${body}`;
    }

    renderPower() {
      this.el.power.innerHTML = this.powerHTML();
    }

    renderPanel() {
      const g = this.game;
      const panel = this.el.panel;
      this.renderPower();
      if (g.status !== 'playing') {
        panel.innerHTML = '<h3>Fim de jogo</h3>';
        return;
      }
      const cards = g.handCards(this.sel) || [];
      panel.classList.remove('exact');
      // Em combate a cena mostra a seleção, as somas e as jogadas: o painel não repete.
      if (g.inCombat()) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
      }
      panel.hidden = false;
      if (!cards.length) {
        // Parado, sem nada marcado: o painel só aparece se há algo a dizer (o resto é o cabeçalho e o histórico).
        const hints = `${g.adjacentTargets().some((t) => t.kind === 'chest' && t.obj.free) ? `<p><b>Baú destrancado</b> ao lado: ${this.isTouch() ? 'toque' : 'clique'} nele (de graça).</p>` : ''}${this.fixtureHintHTML()}${this.ringHintHTML()}`;
        panel.innerHTML = hints;
        panel.hidden = !hints;
        return;
      }

      const { html: selHTML, sum, exact } = this.selectionHTML(false);
      panel.classList.toggle('exact', exact);
      let html = selHTML;

      const targets = g.adjacentTargets();
      if (!targets.length) {
        html += '<p class="muted">Fique ao lado de uma porta ou baú.</p>';
      } else {
        for (const t of targets) {
          const cost = t.obj.cost.rank;
          const name = t.kind === 'door' ? 'Porta' : 'Baú';
          let status;
          if (t.kind === 'chest' && t.obj.free) {
            html += `<p><b>Baú destrancado</b> <span class="tag exact">abre de graça</span></p>`;
            continue;
          }
          if (sum === cost) {
            const same = cards.length >= 2 && cards.every((c) => c.suit === cards[0].suit);
            status = `<span class="tag exact">soma exata · ${same ? `mesmo naipe: compra ${g.config.flushBonus} cartas` : `compra ${g.config.exactBonus} carta`}</span>`;
          } else if (sum > cost) status = '<span class="tag ok">abre · sem compra</span>';
          else status = `<span class="tag no">faltam ${cost - sum}</span>`;
          html += `<p><b>${name}</b> custo ${miniInline(t.obj.cost)} ${status}</p>`;
        }
      }
      html += this.fixtureHintHTML();
      html += this.ringHintHTML();
      html += '<button class="btn" data-act="clear">Limpar (Esc)</button>';
      panel.innerHTML = html;
    }

    renderMap(animate = true) {
      const g = this.game;
      const f = g.floor;
      this.syncFogButton();
      this.syncZoomButtons();
      const shownKeys = new Set();
      const openKeys = new Set();
      const origin = this.fxOrigin; // a névoa se abre a partir da porta que acabou de abrir
      this.fxOrigin = null;
      const rect = this.el.mapWrap.getBoundingClientRect();
      this.tile = ZOOM_TILES[this.zoom];
      // Andar de treino: o mapa inteiro cabe sempre, ocupando no máximo metade da altura da área
      // (o resto, em cima, fica livre para os textos). O zoom escolhido não vale aqui.
      if (g.tutorial) this.tile = Math.max(24, Math.min(96, Math.floor(Math.min((rect.width - 48) / f.w, (rect.height * 0.5) / f.h))));
      this.el.mapWrap.classList.toggle('tutorial-map', g.tutorial);
      const art = this.artActive();

      const map = this.el.map;
      map.style.setProperty('--tile', `${this.tile}px`);
      map.style.gridTemplateColumns = `repeat(${f.w}, ${this.tile}px)`;
      map.style.gridTemplateRows = `repeat(${f.h}, ${this.tile}px)`;

      let html = '';
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const cell = f.grid[y][x];
          const key = y * f.w + x;
          const shown = !this.fog || g.isCellShown(x, y);
          if (shown) shownKeys.add(key);
          const fresh = shown && cell.type !== 'void' && animate && this.shownFloor === f && !this.prevShown.has(key);
          const sweep = fresh && origin && this.fxOn ? Math.min(Math.abs(x - origin.x) + Math.abs(y - origin.y), 30) * 22 : 0;
          const justOpened = (open) => {
            if (open) openKeys.add(key);
            return open && animate && this.shownFloor === f && !this.prevOpen.has(key) ? ' just-opened' : '';
          };
          const alt = (x + y) % 2 ? ' alt' : '';
          const treasure = cell.room !== null && f.rooms[cell.room].kind === 'treasure' ? ' treasure' : cell.room !== null && ['well', 'altar', 'library', 'crypt', 'table', 'forge', 'secret'].includes(f.rooms[cell.room].kind) ? ' sp-room' : '';
          let cls = 't-void';
          let inner = '';
          let title = '';
          const enemyOn = shown ? (f.enemies || []).find((e) => !e.dead && e.x === x && e.y === y) : null;
          const enemyMarkup = (enemy) => {
            const left = remainingEnemyCards(enemy);
            const facedown = left.filter((c) => isHiddenCard(enemy, c)).length;
            const state = !enemy.awake ? 'Dormindo: ficar na sala dele pode acordá-lo' : enemy.lost ? 'Procurando você: perdeu você de vista e vai desistir se não te achar' : 'Acordado: vem atrás de você';
            return {
              cls: enemy.awake ? ` t-enemy awake${enemy.lost ? ' searching' : ''}` : ' t-enemy zone sleeping',
              inner:
                (enemy.kind === 'rat' ? RAT_SVG : art ? `<i class="sprite enemy-sprite k-${enemy.kind}${enemy.boss ? ' boss' : ''}"></i>` : ENEMY_SVG) +
                // O Chefão tem 10 cartas: no mapa só as ABERTAS aparecem, grandes e bem separadas, por cima dele; o resto vira
                // um selo "🔒 N" (as viradas ficam para a cena de combate).
                (enemy.boss
                  ? `<span class="enemy-cards boss-open">${left.filter((c) => !isHiddenCard(enemy, c)).map(miniHTML).join('')}${facedown ? `<span class="boss-locked" title="Cartas viradas: abrem quando as da frente caem">🔒 ${facedown}</span>` : ''}</span>`
                  : `<span class="enemy-cards${left.length > 2 ? ' many' : ''}">${left.map((c) => (isHiddenCard(enemy, c) ? MINI_BACK : miniHTML(c))).join('')}</span>`) +
                (!enemy.awake ? '<span class="zzz">z</span>' : `<span class="alert">${enemy.lost ? '?' : '!'}</span>`),
              title: `${state} (${left.length} carta${left.length === 1 ? '' : 's'}${facedown ? `, ${facedown} virada${facedown === 1 ? '' : 's'}` : ''}). Toque nele para atacar`,
            };
          };
          switch (shown ? cell.type : 'void') {
            case 'wall':
              cls = 't-wall';
              break;
            case 'floor': {
              cls = `t-floor${alt}${treasure}`;
              if (enemyOn) {
                const m = enemyMarkup(enemyOn);
                cls += m.cls;
                inner = m.inner;
                title = m.title;
              } else if ((f.enemies || []).some((e) => DC.inWakeZone(e, cell, x, y))) {
                cls += ' zone';
                title = 'Sala de um inimigo dormindo: entrar aqui pode acordá-lo';
              }
              {
                const trap = (f.traps || []).find((t) => t.sprung && t.x === x && t.y === y);
                if (trap) {
                  cls += ` t-trap ${trap.kind}`;
                  inner += `<span class="trap-mark">${trap.kind === 'dart' ? '✖' : '⤒'}</span>`;
                  title = trap.kind === 'dart' ? 'Armadilha de dardo (já disparada)' : 'Alçapão para o andar de cima (já disparado)';
                }
                const pickup = (f.pickups || []).find((p) => !p.taken && p.x === x && p.y === y);
                if (pickup) {
                  cls += ` t-pickup${pickup.gold ? ' gold' : ''}`;
                  inner += FOOD_SVG[pickup.gold ? 'gold' : 'normal'];
                  title = `${DC.FOOD[pickup.gold ? 'gold' : 'normal'].name}: passe por aqui para comer e ganhar cartas novas`;
                }
              }
              break;
            }
            case 'start':
              cls = 't-floor start';
              inner = art ? '' : STAIR_UP_SVG; // com a arte, a peça da escada já vem no fundo da casa
              title = 'Escada de entrada (você desceu por aqui)';
              if (enemyOn) {
                const m = enemyMarkup(enemyOn);
                cls += m.cls;
                inner += m.inner;
                title = m.title;
              }
              break;
            case 'exit':
              cls = 't-floor exit';
              inner = art ? '' : STAIR_DOWN_SVG;
              title = 'Escada de saída (desce para o próximo andar)';
              break;
            case 'door': {
              const d = f.doors[cell.ref];
              cls = `t-door ${d.orient}${d.open ? ' open' : ''}${justOpened(d.open)}`;
              inner = d.open ? '' : miniHTML(d.cost);
              title = d.open ? 'Porta aberta' : `Porta: custo ${DC.rankLabel(d.cost.rank)}`;
              if (enemyOn) {
                const m = enemyMarkup(enemyOn);
                cls += m.cls;
                inner += m.inner;
                title = m.title;
              }
              break;
            }
            case 'fixture': {
              const fx = f.fixtures[cell.ref];
              cls = `t-floor t-fixture${alt}${treasure}${fx.used ? ' used' : ''}`;
              inner = fixtureSVG(fx);
              title = this.fixtureTitle(fx);
              break;
            }
            case 'chest': {
              const c = f.chests[cell.ref];
              cls = `t-floor t-chest${alt}${treasure}${justOpened(c.open)}`;
              inner = (art ? `<i class="sprite chest-sprite${c.open ? ' open' : ''}"></i>` : CHEST_SVG(c.open)) + (c.open ? '' : c.free ? '<span class="free-tag">grátis</span>' : miniHTML(c.cost));
              title = c.open ? 'Baú aberto' : c.secret ? 'Baú da sala secreta: abre de graça e guarda um anel e um Bife' : c.free ? 'Baú destrancado: abre de graça, sem gastar cartas' : `Baú: custo ${DC.rankLabel(c.cost.rank)} (guarda um prêmio bom: um Bife ou um anel, às vezes)`;
              break;
            }
          }
          const styles = [];
          if (sweep) styles.push(`animation-delay:${sweep}ms`);
          const sprite = art && shown ? DC.art.tileSprite(f, x, y) : null;
          if (sprite) {
            cls += ' spr';
            styles.push(DC.art.style(sprite));
          }
          const style = styles.length ? ` style="${styles.join(';')}"` : '';
          html += `<div class="tile ${cls}${fresh ? ' reveal' : ''}" data-x="${x}" data-y="${y}"${title ? ` title="${title}"` : ''}${style}>${inner}</div>`;
        }
      }
      html += '<div class="token" id="token"><i class="ball"></i></div>';
      map.innerHTML = html;
      this.prevShown = shownKeys;
      this.prevOpen = openKeys;
      this.shownFloor = f;
      this.tileEls = Array.from(map.querySelectorAll('.tile'));
      this.token = document.getElementById('token');
      this.placeToken(g.player.x, g.player.y, false);
    }

    placeToken(x, y, animate = true) {
      const t = this.token;
      if (!animate) t.style.transition = 'none';
      t.style.transform = `translate(${x * this.tile}px, ${y * this.tile}px)`;
      if (!animate) {
        void t.offsetWidth;
        t.style.transition = '';
      }
      this.placeCamera(x, y, animate);
    }

    // Centraliza o mapa quando ele cabe; senão, segue o personagem sem sair das bordas.
    // Se o jogador arrastou o mapa (this.view), a câmera fica onde ele deixou até o
    // personagem andar, a escada ser descida ou o zoom mudar.
    placeCamera(x, y, animate = true) {
      const f = this.game.floor;
      const wrap = this.el.mapWrap;
      const map = this.el.map;
      const key = `${this.game.floorNo}:${x},${y}`;
      if (key !== this.cameraKey) {
        this.cameraKey = key;
        this.view = null;
      }
      // Seguindo o personagem, o mapa não sai das bordas. Arrastando, sobra uma folga
      // escura de 10 casas em volta, para a borda não ficar presa no canto da tela.
      // A folga cobre ao menos metade da área, para qualquer ponto do mapa poder chegar ao centro da tela.
      // Vale também nos dois eixos quando o mapa cabe na área (antes ele ficava preso, sem arrastar).
      // Sem arrastar, a câmera tem uma ZONA MORTA: o mapa fica parado enquanto o personagem anda no miolo da tela
      // e só desliza (o mínimo) quando ele chega perto da borda. Antes ela o centralizava a cada passo, e a
      // masmorra "mudava de lugar" sozinha. Andar de andar, mudar o zoom ou o botão de centralizar recentralizam.
      const prevCam = this.camera;
      const keep = !this.recenter && prevCam && prevCam.floor === this.game.floorNo && prevCam.tile === this.tile;
      this.recenter = false;
      const axis = (size, total, pos, dragged, prev) => {
        const gap = Math.max(PAN_GAP * this.tile, size / 2);
        if (dragged !== null) return Math.min(Math.max(size - total, 0) + gap, Math.max(Math.min(size - total, 0) - gap, dragged));
        if (total <= size) return (size - total) / 2;
        const clamp = (v) => Math.min(0, Math.max(size - total, v));
        const centered = clamp(size / 2 - (pos + 0.5) * this.tile);
        if (prev === null) return centered;
        const p = (pos + 0.5) * this.tile + prev;
        if (p < 0 || p > size) return centered;
        const margin = Math.min(size * 0.4, Math.max(2 * this.tile, size * 0.28));
        if (p < margin) return clamp(prev + (margin - p));
        if (p > size - margin) return clamp(prev - (p - (size - margin)));
        return clamp(prev);
      };
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      let tx = axis(w, f.w * this.tile, x, this.view ? this.view.tx : null, keep ? prevCam.tx : null);
      let ty = axis(h, f.h * this.tile, y, this.view ? this.view.ty : null, keep ? prevCam.ty : null);
      if (this.game.tutorial) {
        // Posição fixa: centralizado na horizontal e na parte de baixo da área, com folga em cima.
        tx = (w - f.w * this.tile) / 2;
        ty = Math.max(0, h - f.h * this.tile - h * 0.17);
        this.view = null;
      }
      this.camera = { tx, ty, floor: this.game.floorNo, tile: this.tile };
      wrap.classList.toggle('pannable', !this.game.tutorial);
      document.getElementById('btn-center').disabled = !this.view;
      if (!animate) map.style.transition = 'none';
      map.style.transform = `translate(${tx}px, ${ty}px)`;
      if (!animate) {
        void map.offsetWidth;
        map.style.transition = '';
      }
    }

    updateHighlights() {
      this.tapTile = null;
      const g = this.game;
      const f = g.floor;
      for (const el of this.tileEls) {
        el.classList.remove('reach', 'path', 'path-end', 'fight', 'open-ok', 'open-exact', 'open-no', 'open-hint', 'tut-target');
        if (el.classList.contains('tut-here')) {
          el.classList.remove('tut-here');
          const arrow = el.querySelector('.tut-arrow');
          if (arrow) arrow.remove();
        }
      }
      this.reachMap = null;
      if (g.status !== 'playing' || g.pending || this.busy) return;
      this.tourHighlights();

      for (const t of g.adjacentFixtures()) this.tileEls[t.y * f.w + t.x].classList.add('open-hint');
      const sum = this.sel.length ? g.payTotal(this.sel) : null;
      for (const t of g.adjacentTargets()) {
        const el = this.tileEls[t.y * f.w + t.x];
        if (sum === null) el.classList.add('open-hint');
        else el.classList.add(sum === t.obj.cost.rank ? 'open-exact' : sum > t.obj.cost.rank ? 'open-ok' : 'open-no');
      }
    }

    // ---------- foco do tutorial: luz suave no alvo + texto digitado ----------
    //
    // Dois modos usam a mesma camada (#intro):
    //  - "intro": a abertura. Cobre a tela, e um clique passa para a próxima cena.
    //  - "spot": um aviso curto durante o passo (ex.: depois de escolher a carta). Não bloqueia
    //    nada: a pessoa continua jogando por baixo, e ele some quando a situação muda.

    introWant() {
      const g = this.game;
      const step = this.tutor.step;
      if (this.splashOn) return null; // a tela de entrada vem primeiro
      if (!step || g.status !== 'playing' || g.pending || this.help || this.reportView || this.busy) return null;
      if (step.kind === 'intro') return 'intro';
      if (this.currentSpot()) return 'spot';
      return null;
    }

    // O aviso de foco que vale agora: o primeiro do passo cujo gatilho está ativo.
    // 'card' = 1 carta escolhida; 'away' = longe das portas fechadas; 'near' = ao lado de uma.
    // 'opened' = a porta do passo já foi aberta (é o único aviso que vale com o passo concluído).
    currentSpot() {
      const step = this.tutor.step;
      if (!step || !step.spots) return null;
      const done = this.tutor.isDone();
      const near = this.game.adjacentTargets().length > 0;
      const picked = this.sel.length === 1 ? this.game.hand.find((c) => c.id === this.sel[0]) : null;
      const on = {
        card: this.sel.length === 1,
        suit: Boolean(picked) && picked.suit === step.waitSuit, // a carta escolhida é do naipe do passo
        away: !near,
        near,
        any: true,
        cleared: this.game.floor.enemies.length > 0 && this.game.floor.enemies.every((e) => e.dead),
        opened: this.tutor.doneKind === 'door',
      };
      return step.spots.find((sp) => (sp.trigger === 'opened') === done && on[sp.trigger]) || null;
    }

    syncIntro() {
      const want = this.introWant();
      if (!want) {
        if (this.intro.on) this.hideIntro();
        return;
      }
      const spot = want === 'spot' ? this.currentSpot() : null;
      if (this.intro.mode !== want || (spot && this.intro.spotId !== spot.id)) {
        if (this.intro.on) this.hideIntro();
        this.showIntro(want);
      } else if (spot && ['card', 'suit'].includes(spot.trigger) && this.intro.key !== this.sel[0]) {
        // Escolheu outra carta: o foco acompanha.
        this.intro.key = this.sel[0];
        this.introPlace(this.introScenes()[0].focus, false);
      }
    }

    showIntro(mode) {
      const el = this.el.intro;
      this.intro.on = true;
      this.intro.mode = mode;
      this.intro.scene = -1;
      this.intro.key = this.sel[0];
      const spot = mode === 'spot' ? this.currentSpot() : null;
      this.intro.spotId = spot ? spot.id : '';
      this.intro.scenes = spot ? [spot] : this.tutor.step.scenes || [];
      el.classList.toggle('free', mode === 'spot');
      el.innerHTML = `<div class="intro-dim"></div>
        <div class="intro-text" aria-live="polite"></div>
        ${mode === 'intro' ? '<button class="link intro-skip" type="button">Pular tutorial</button>' : ''}`;
      el.hidden = false;
      el.onclick =
        mode === 'intro'
          ? (e) => {
              if (e.target.closest('.intro-skip')) this.introSkip();
              else this.introAdvance();
            }
          : null;
      if (mode === 'intro') {
        this.sel = [];
        this.refreshSelection();
      }
      // A abertura espera as cartas terminarem de ser distribuídas e a câmera assentar.
      // A abertura espera as cartas serem distribuídas; as outras cenas entram logo.
      const wait = mode === 'spot' || this.tutor.index > 0 ? 150 : this.fxOn ? 1600 : 350;
      this.intro.timer = setTimeout(() => this.introScene(0), wait);
    }

    hideIntro() {
      const el = this.el.intro;
      clearTimeout(this.intro.timer);
      this.intro.on = false;
      this.intro.mode = '';
      this.intro.typing = false;
      this.intro.scene = -1;
      if (el) {
        el.hidden = true;
        el.innerHTML = '';
        el.classList.remove('free');
      }
    }

    introScenes() {
      return this.intro.scenes || [];
    }

    // Monta uma cena: o foco vai até o alvo e o texto entra digitando.
    introScene(i) {
      const scenes = this.introScenes();
      const scene = scenes[i];
      if (!scene || !this.intro.on) return;
      const el = this.el.intro;
      const intro = this.intro.mode === 'intro';
      this.intro.scene = i;
      clearTimeout(this.intro.timer);
      const textEl = el.querySelector('.intro-text');
      // Cada letra é um <span> escondido: o texto já ocupa o lugar final e nada pula enquanto digita.
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      // Um "caractere" por letra visível: emojis como ❤️ (2 códigos) não podem ser partidos ao meio.
      const glyphs = (w) => (window.Intl && Intl.Segmenter ? Array.from(new Intl.Segmenter().segment(w), (x) => x.segment) : Array.from(w));
      textEl.innerHTML =
        scene.lines
          .map((line) => {
            const words = line.split(' ').map((w) => `<span class="w">${glyphs(w).map((ch) => `<span class="c">${esc(ch)}</span>`).join('')}</span>`);
            return `<p>${words.join(' ')}</p>`;
          })
          .join('') + (intro ? '<div class="intro-go">clique para continuar</div>' : '');
      this.intro.chars = Array.from(textEl.querySelectorAll('.c'));
      textEl.classList.remove('in');
      this.introPlace(scene.focus, i === 0);
      void textEl.offsetWidth;
      textEl.classList.add('in'); // o balão sobe e aparece
      // Quem já viu o aviso e volta a ele (escolheu a carta de novo) lê de uma vez.
      textEl.classList.toggle('compact', Boolean(scene.compact));
      const again = !intro && this.spotSeen.has(this.intro.spotId);
      if (!intro) this.spotSeen.add(this.intro.spotId);
      const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || again) return this.introReveal();
      this.intro.typing = true;
      let n = 0;
      const tick = () => {
        if (!this.intro.on || this.intro.scene !== i) return;
        const c = this.intro.chars[n++];
        if (c) c.classList.add('on');
        if (c && c.textContent.trim()) this.sound('type'); // tec, tec, tec (máquina de escrever)
        if (n >= this.intro.chars.length) return this.introReveal();
        const ch = c ? c.textContent : '';
        this.intro.timer = setTimeout(tick, '.!?'.includes(ch) ? 380 : ',:;'.includes(ch) ? 190 : 38);
      };
      this.intro.timer = setTimeout(tick, 420);
    }

    // Mostra o texto inteiro (fim da digitação ou clique para acelerar).
    introReveal() {
      clearTimeout(this.intro.timer);
      for (const c of this.intro.chars) c.classList.add('on');
      this.intro.typing = false;
      const go = this.el.intro.querySelector('.intro-go');
      if (go) go.classList.add('show');
      // Aviso com "advance": com o texto todo na tela, o próximo passo começa sozinho depois de um tempo.
      const spot = this.intro.mode === 'spot' ? this.introScenes()[this.intro.scene] : null;
      if (spot && spot.advance) {
        const step = this.tutor.step;
        this.intro.timer = setTimeout(() => {
          if (!this.intro.on || this.tutor.step !== step || this.busy || this.game.pending) return;
          this.tutor.next();
          this.tourChanged();
        }, spot.advance);
      }
    }

    // Leva o foco (clarão) e o balão de texto até o(s) alvo(s): 'player', 'hand' ou 'card' (a carta escolhida).
    introPlace(focus, instant = false) {
      const el = this.el.intro;
      if (!el || el.hidden) return;
      const dim = el.querySelector('.intro-dim');
      const text = el.querySelector('.intro-text');
      if (!dim || !text) return;
      const list = [].concat(focus);
      const vh = window.innerHeight;
      const spot = (kind) => {
        let r;
        let rx;
        let ry;
        if (kind === 'hand') {
          r = this.el.hand.getBoundingClientRect();
          rx = r.width * 0.5 * 1.45 + 40;
          ry = r.height * 0.5 * 1.9 + 50;
        } else if (kind === 'card') {
          r = (this.el.hand.querySelector('.card.sel') || this.el.hand).getBoundingClientRect();
          rx = r.width * 0.5 * 2.3 + 40;
          ry = r.height * 0.5 * 2.3 + 40;
        } else if (kind === 'cost') {
          // O número da porta (a cartinha pendurada nela).
          const f = this.game.floor;
          const door = f.doors.find((d) => !d.open && this.game.adjacentTargets().some((t) => t.x === d.x && t.y === d.y)) || f.doors.find((d) => !d.open);
          const tile = door ? this.tileEls[door.y * f.w + door.x] : this.el.map;
          r = (tile.querySelector('.mini') || tile).getBoundingClientRect();
          rx = ry = Math.max(150, r.width * 3.5);
        } else if (kind === 'room') {
          // A sala nova (a última visitada) junto com a porta que leva até ela.
          const f = this.game.floor;
          const ahead = [...this.game.visited].pop();
          const door = f.doors.find((d) => d.open && (d.a === ahead || d.b === ahead));
          let l = Infinity;
          let t = Infinity;
          let rt = -Infinity;
          let b = -Infinity;
          const add = (x, y) => {
            const q = this.tileEls[y * f.w + x].getBoundingClientRect();
            l = Math.min(l, q.left);
            t = Math.min(t, q.top);
            rt = Math.max(rt, q.right);
            b = Math.max(b, q.bottom);
          };
          for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.grid[y][x].room === ahead) add(x, y);
          if (door) add(door.x, door.y);
          r = { left: l, top: t, width: rt - l, height: b - t };
          // O buraco só fica totalmente limpo até ~40% do raio: o dobro do meio-lado deixa a sala inteira nítida.
          rx = r.width + 50;
          ry = r.height + 50;
        } else if (kind === 'pickup') {
          // A comida no chão (a primeira que ainda não foi pega).
          const f = this.game.floor;
          const p = (f.pickups || []).find((q) => !q.taken);
          r = (p ? this.tileEls[p.y * f.w + p.x] : this.el.map).getBoundingClientRect();
          rx = ry = Math.max(220, r.width * 5);
        } else if (kind === 'deck') {
          // O deck do jogador (a pilha com o número): é a vida dele.
          r = this.el.piles.children[0].getBoundingClientRect();
          rx = ry = Math.max(150, r.width * 1.8);
        } else if (kind === 'power') {
          // O botão Poder (ao lado esquerdo da mão).
          r = (this.el.power.querySelector('button') || this.el.power).getBoundingClientRect();
          rx = ry = Math.max(120, r.width * 1.6);
        } else if (kind === 'enemy') {
          // O inimigo vivo (ou a escada, se ele já caiu): a zona vermelha fica dentro do foco.
          const f = this.game.floor;
          const foe = f.enemies.find((e) => !e.dead);
          r = this.tileEls[(foe || f.exit).y * f.w + (foe || f.exit).x].getBoundingClientRect();
          rx = ry = Math.max(240, r.width * 6);
        } else if (kind === 'exit') {
          // A escada de saída.
          const f = this.game.floor;
          r = this.tileEls[f.exit.y * f.w + f.exit.x].getBoundingClientRect();
          rx = ry = Math.max(240, r.width * 6);
        } else if (kind === 'door') {
          const f = this.game.floor;
          const door = f.doors.find((d) => !d.open && this.game.isCellShown(d.x, d.y));
          r = (door ? this.tileEls[door.y * f.w + door.x] : this.el.map).getBoundingClientRect();
          rx = ry = Math.max(260, r.width * 6.5);
        } else {
          r = (this.token || this.el.map).getBoundingClientRect();
          rx = ry = Math.max(280, Math.max(r.width, r.height) * 5);
        }
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, rx, ry, top: r.top };
      };
      const a = spot(list[0]);
      const b = list[1] ? spot(list[1]) : a; // sem segundo alvo, o segundo buraco cai em cima do primeiro
      const c = list[2] ? spot(list[2]) : b; // idem para o terceiro
      if (instant) dim.style.transition = 'none';
      for (const [name, v] of Object.entries({ fx: a.x, fy: a.y, rx: a.rx, ry: a.ry, gx: b.x, gy: b.y, sx: b.rx, sy: b.ry, hx: c.x, hy: c.y, tx: c.rx, ty: c.ry })) dim.style.setProperty(`--${name}`, `${v}px`);
      if (instant) {
        void dim.offsetWidth;
        dim.style.transition = '';
      }
      // O texto fica em cima do mapa, ou logo acima da mão quando o foco é só a mão.
      const wrap = this.el.mapWrap.getBoundingClientRect();
      text.style.top = text.style.bottom = '';
      if (list.length === 1 && list[0] === 'hand') text.style.bottom = `${Math.round(vh - a.top + 28)}px`;
      else text.style.top = `${Math.round(Math.max(wrap.top, 8) + 16)}px`;
      el.dataset.focus = list.join('+');
    }

    // Um clique: se ainda está digitando, mostra o texto todo; senão vai para a próxima cena.
    introAdvance() {
      if (!this.intro.on || this.intro.mode !== 'intro' || this.intro.scene < 0) return;
      if (this.intro.typing) return this.introReveal();
      if (this.intro.scene + 1 < this.introScenes().length) this.introScene(this.intro.scene + 1);
      else this.introFinish();
    }

    introFinish() {
      if (!this.intro.on) return;
      this.hideIntro();
      this.tutor.next();
      this.sound('ding', 0.1);
      this.tourChanged();
    }

    introSkip() {
      this.hideIntro();
      this.tutor.skip();
      this.tourChanged();
    }

    // ---------- tutorial, dicas e relatório ----------

    // Registra o que a pessoa fez: números do relatório, passos do tutorial e dicas.
    track(event, data = {}) {
      this.stats.note(event, data);
      // A pessoa foi andar antes do aviso "seguir sozinho" acabar: o passo seguinte já vale.
      const before = this.tutor.step;
      if (event === 'move' && before && this.tutor.isDone() && (before.spots || []).some((sp) => sp.advance) && this.tutor.next()) {
        this.hideIntro();
        this.tourChanged();
      }
      if (this.tutor.note(event, data)) {
        this.sound('ding', event === 'open' ? 0.55 : 0.1);
        // Passos com "auto" seguem sozinhos depois de um instante (deu tempo de ver o resultado).
        const step = this.tutor.step;
        if (step && step.auto) {
          clearTimeout(this.autoTimer);
          // Se há uma janela aberta (ex.: as cartas do andar novo), espera ela fechar e tenta de novo.
          const go = () => {
            if (this.tutor.step !== step || !this.tutor.canNext) return;
            if (this.busy || this.game.pending) this.autoTimer = setTimeout(go, 400);
            else {
              this.tutor.next();
              this.tourChanged();
            }
          };
          this.autoTimer = setTimeout(go, step.auto);
        }
      }
      if (event === 'scroll') this.hintQueue = 'scroll';
      // Uma dica de cartão some quando a pessoa age: a situação já mudou.
      if (event !== 'reject' && event !== 'help' && event !== 'stash') this.hint = null;
    }

    coachCtx() {
      return { selected: this.sel.length > 0, adjacent: this.game.adjacentTargets().length > 0 };
    }

    // O que o passo atual quer que a pessoa olhe: a mão, as portas, ou a porta ao lado.
    tourFocus() {
      const step = this.tutor.step;
      if (!step || step.kind !== 'coach' || this.tutor.isDone() || this.game.status !== 'playing') return null;
      const c = this.coachCtx();
      if (step.id === 'move') return null;
      if (step.id === 'door') return !c.adjacent ? 'doors' : c.selected ? 'target' : 'hand';
      if (step.id === 'exit') return 'stairs';
      return null;
    }

    // Destaque pulsando na mão e nas portas, conforme o passo.
    tourHighlights() {
      const g = this.game;
      const f = g.floor;
      const focus = this.tourFocus();
      if (focus === 'doors') {
        // A casa ao lado de cada porta fechada que já dá para ver pulsa, com uma setinha em cima.
        for (const d of f.doors) {
          if (d.open || !g.isCellShown(d.x, d.y)) continue;
          for (const [dx, dy] of DC.DIRS) {
            const x = d.x + dx;
            const y = d.y + dy;
            const cell = DC.cellAt(f, x, y);
            if (!cell || !['floor', 'start'].includes(cell.type) || !g.isCellShown(x, y)) continue;
            const el = this.tileEls[y * f.w + x];
            el.classList.add('tut-target', 'tut-here');
            if (!el.querySelector('.tut-arrow')) el.insertAdjacentHTML('beforeend', '<i class="tut-arrow" aria-hidden="true">▼</i>');
          }
        }
      } else if (focus === 'stairs') {
        // A escada pulsa com uma setinha em cima (só depois de a sala dela aparecer).
        const x = f.exit.x;
        const y = f.exit.y;
        if (g.isCellShown(x, y)) {
          const el = this.tileEls[y * f.w + x];
          el.classList.add('tut-target', 'tut-here');
          if (!el.querySelector('.tut-arrow')) el.insertAdjacentHTML('beforeend', '<i class="tut-arrow" aria-hidden="true">▼</i>');
        }
      } else if (focus === 'target') {
        for (const t of g.adjacentTargets()) this.tileEls[t.y * f.w + t.x].classList.add('tut-target');
      }
    }

    // Dicas de cartão: olha a situação do jogo e mostra a primeira que ainda não foi vista.
    checkHints() {
      const g = this.game;
      const t = this.tutor;
      if (this.hint || t.step || this.busy || this.help || g.status !== 'playing' || g.pending) return;
      const queued = this.hintQueue;
      this.hintQueue = '';
      const targets = g.adjacentTargets();
      const tests = [
        ['scroll', queued === 'scroll'],
        ['zone', g.floor.enemies.some((e) => !e.dead && g.isCellShown(e.x, e.y))],
        ['door', targets.length > 0],
        ['lowdeck', g.playerDeck.length <= LOW_DECK],
        ['start', this.stats.moves === 0 && g.floorNo === 1],
      ];
      for (const [id, on] of tests) {
        if (!on) continue;
        const hint = t.offer(id);
        if (hint) {
          this.hint = hint;
          return;
        }
      }
    }

    stepDots() {
      return this.tutor.steps.map((s, i) => `<i class="${i === this.tutor.index ? 'on' : i < this.tutor.index ? 'past' : ''}"></i>`).join('');
    }

    renderCoach() {
      const el = this.el.coach;
      const t = this.tutor;
      const step = t.step;
      let html = '';
      let cls = 'coach';
      if (step && step.kind === 'coach' && this.game.status === 'playing') {
        const tx = t.text(this.coachCtx());
        const wait = !tx.done;
        cls += wait ? ' wait' : ' done';
        if (step.spots && ((wait && step.spots.some((sp) => sp.silent)) || this.introWant() === 'spot')) {
          // O passo fala por foco e texto digitado: o cartão só guarda o progresso, o "pular" e,
          // com o passo concluído, o "Próximo".
          cls += ' mini';
          html = `<div class="coach-head"><span>Tutorial · passo ${t.index + 1} de ${t.steps.length}</span><span class="dots">${this.stepDots()}</span></div>
            <div class="coach-actions"><button class="link" data-coach="skip">Pular tutorial</button>${
              wait ? '' : `<button class="btn small primary" data-coach="next">${tx.next} →</button>`
            }</div>`;
        } else html = `<div class="coach-head"><span>Tutorial · passo ${t.index + 1} de ${t.steps.length}</span><span class="dots">${this.stepDots()}</span></div>
          <h3>${tx.title}</h3>
          <p>${tx.done ? `<span class="check">✓</span> ${tx.doneBody}` : tx.body}</p>
          ${wait ? '<p class="coach-wait muted">Avança quando você fizer a ação.</p>' : ''}
          <div class="coach-actions">
            <button class="link" data-coach="skip">Pular tutorial</button>
            <button class="btn small" data-coach="prev" ${t.canPrev ? '' : 'disabled'}>←</button>
            <button class="btn small primary" data-coach="next" ${t.canNext ? '' : 'disabled'}>${tx.next} →</button>
          </div>`;
      } else if (this.hint && !step && this.game.status === 'playing') {
        cls += ' hint';
        html = `<div class="coach-head"><span>Dica</span></div>
          <h3>${this.hint.title}</h3>
          <p>${this.hint.body}</p>
          <div class="coach-actions">
            <button class="link" data-coach="hints-off">Desligar dicas</button>
            <button class="btn small primary" data-coach="got-it">Entendi</button>
          </div>`;
      }
      el.className = cls;
      el.hidden = !html;
      el.innerHTML = html;
      // A mão pulsa quando o passo pede uma carta; no aviso das portas, enquanto nenhuma foi escolhida.
      const askCard = this.introWant() === 'spot' && this.currentSpot().pulse === 'hand' && this.sel.length === 0;
      this.el.hand.classList.toggle('tut-pulse', this.tourFocus() === 'hand' || askCard);
    }

    onCoachClick(e) {
      const btn = e.target.closest('[data-coach]');
      if (!btn || btn.disabled) return;
      switch (btn.dataset.coach) {
        case 'next':
          this.tutor.next();
          break;
        case 'prev':
          this.tutor.prev();
          break;
        case 'skip':
          this.tutor.skip();
          break;
        case 'got-it':
          this.hint = null;
          break;
        case 'hints-off':
          this.hint = null;
          this.tutor.setHints(false);
          this.toast('Dicas desligadas. O botão Como jogar liga de novo.');
          break;
      }
      this.tourChanged();
    }

    // O tutorial mudou de passo (ou acabou): redesenha o cartão, a janela e os destaques.
    tourChanged() {
      // O tutorial acabou (ou foi pulado) no andar de treino: segue para a masmorra de verdade.
      if (this.game.tutorial && !this.tutor.active) {
        this.newGame(this.nextSeed);
        return;
      }
      this.renderCoach();
      this.renderOverlay();
      this.updateHighlights();
      this.checkHints();
      this.renderCoach();
      this.syncIntro();
    }

    startTour() {
      const g = this.game;
      const midGame = !g.tutorial && g.status === 'playing' && (this.stats.moves > 0 || g.floorNo > 1);
      if (midGame && !window.confirm('Isso começa o treino e abandona a partida atual. Continuar?')) return;
      this.tutor.restart();
      if (!g.tutorial) this.nextSeed = null;
      this.newGame(null, true);
    }

    // Aviso para telas pequenas: o layout foi pensado para computador e tablet.
    showNotice() {
      const n = this.el.notice;
      if (window.innerWidth >= 700) return;
      n.innerHTML = `<span>${DC.TUTORIAL_TEXT.notice}</span><button class="btn small" data-notice>Ok</button>`;
      n.hidden = false;
    }

    reportHTML() {
      const text = this.reportText().replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<div class="modal report">
        <h2>Relatório da partida</h2>
        <p>Não consegui copiar sozinho. Selecione o texto abaixo (já está selecionado), copie com Ctrl+C ou Cmd+C e cole numa conversa.</p>
        <textarea readonly rows="14">${text}</textarea>
        <div class="actions"><button class="btn primary" data-ov="close-report">Fechar</button></div>
      </div>`;
    }

    tutorialHTML() {
      const t = this.tutor;
      const tx = t.text();
      return `<div class="modal tutorial">
        <div class="coach-head"><span>Tutorial · passo ${t.index + 1} de ${t.steps.length}</span><span class="dots">${this.stepDots()}</span></div>
        <h2>${tx.title}</h2>
        ${tx.body}
        <div class="actions">
          <button class="link" data-ov="tour-skip">Pular tutorial</button>
          ${t.canPrev ? '<button class="btn" data-ov="tour-prev">← Anterior</button>' : ''}
          <button class="btn primary" data-ov="tour-next">${tx.next}</button>
        </div>
      </div>`;
    }

    // Copia o relatório da partida para a área de transferência.
    async copyReport() {
      const text = this.reportText();
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        // Sem permissão (ex.: abrindo como arquivo): cai no método antigo.
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
          ok = document.execCommand('copy');
        } catch (err) {
          ok = false;
        }
        area.remove();
      }
      if (ok) return this.toastOk('Relatório copiado! Cole numa conversa para enviar.');
      // Sem permissão para copiar: mostra o texto para a pessoa selecionar e copiar na mão.
      this.reportView = true;
      this.renderOverlay();
    }

    // Abre a página de nova issue do GitHub com o relatório preenchido (a pessoa só confirma). Se o navegador
    // bloquear a janela, cai na cópia para a área de transferência.
    sendReport() {
      const win = window.open(DC.issueURL(this.game, this.reportText()), '_blank');
      if (win) win.opener = null;
      else this.copyReport();
    }

    reportText() {
      return DC.buildReport(this.game, this.stats, {
        screen: `${window.innerWidth}x${window.innerHeight}`,
        touch: this.isTouch(),
        tutorial: DC.tutorialSummary(this.tutor),
        notes: DC.TUTORIAL_TEXT.questions.map((q) => ({ label: q.label, answer: this.notes[q.id] || '' })),
      });
    }

    toastOk(text) {
      this.toast(text);
      this.el.toast.classList.add('ok');
      clearTimeout(this.toastOkTimer);
      this.toastOkTimer = setTimeout(() => this.el.toast.classList.remove('ok'), 2600);
    }

    // ---------- janelas ----------

    renderOverlay() {
      const g = this.game;
      const root = this.el.overlay;
      let html = '';
      let kind = '';
      if (this.help) kind = 'help';
      else if (this.reportView) kind = 'report';
      else if (this.busy) kind = '';
      else if (g.status === 'won' || g.status === 'lost') kind = g.status;
      else if (this.graveView) kind = 'grave';
      else if (g.pending) kind = g.pending.type;
      else if (this.tutor.step && this.tutor.step.kind === 'modal') kind = 'tutorial';
      // Os efeitos de entrada tocam só quando a janela aparece, e não a cada clique dentro dela.
      this.overlayFresh = kind !== this.lastOverlay;
      this.lastOverlay = kind;
      // A dica da janela (combate, baú) vale uma vez e fica enquanto ela estiver aberta.
      if (this.overlayFresh) {
        const tipKind = kind === 'chest';
        this.tipHTML = tipKind ? this.tutor.tip(kind) : '';
      }

      if (kind === 'report') html = this.reportHTML();
      else if (kind === 'tutorial') html = this.tutorialHTML();
      else if (kind === 'help') html = this.helpHTML();
      else if (kind === 'won') html = this.endHTML(true);
      else if (kind === 'lost') html = this.endHTML(false);
      else if (kind === 'refill') html = this.refillHTML();
      else if (kind === 'reinforce') html = this.reinforceHTML();
      else if (kind === 'ring') html = this.ringHTML();
      else if (kind === 'grave') html = this.graveHTML();
      else if (kind === 'chest') html = this.chestHTML();
      else if (kind === 'altar') html = this.altarHTML();
      else if (kind === 'library') html = this.libraryHTML();
      else if (kind === 'crypt') html = this.cryptHTML();
      else if (kind === 'table') html = this.tableHTML();
      else if (kind === 'forge') html = this.forgeHTML();
      // O combate é uma cena no palco (não uma janela): ela se atualiza aqui e o overlay fica livre para ajuda e relatório.
      this.renderCombat();
      if (html && this.tipHTML) html = html.replace('</h2>', `</h2><div class="tip"><b>Dica:</b> ${this.tipHTML}</div>`);

      root.hidden = !html;
      root.innerHTML = html;
      if (kind === 'report') root.querySelector('textarea').select();
      if (!html || !this.overlayFresh) return;
      root.querySelector('.modal').classList.add('enter');
      if (kind === 'chest') {
        this.chestFx();
        this.sound('chest');
      } else if (kind === 'refill') {
        // Um som para cada carta que vira.
        if (this.fxOn) root.querySelectorAll('.reveal-slot').forEach((_, i) => setTimeout(() => this.sound('draw', 0.2 + i * 0.05), 700 + i * 650 + 300));
        // A carta extra da soma exata é um bônus: quando termina de virar, brilha, solta faíscas e toca um "ding".
        const bonus = root.querySelector('.reveal-slot.extra');
        if (bonus && this.fxOn) {
          setTimeout(() => {
            const card = bonus.querySelector('.front');
            if (!card || this.lastOverlay !== 'refill') return;
            const c = centerOf(card.getBoundingClientRect());
            this.ring(c.x, c.y);
            this.burst(c.x, c.y, { count: 22, spread: 95, color: '#ffd76a' });
            this.floatText(this.game.pending && this.game.pending.flush ? 'Mesmo naipe!' : '+1 carta', c.x, c.y - 90, 'gold');
            this.sound('ding', 0.4);
          }, 1250);
        }
      } else if (kind === 'ring') {
        this.sound('ding');
        const c = centerOf(root.querySelector('.modal').getBoundingClientRect());
        if (this.fxOn) {
          this.ring(c.x, c.y - 70, '#f1c75a');
          this.burst(c.x, c.y - 70, { count: 22, spread: 100, color: '#f1c75a' });
        }
      } else if (kind === 'reinforce') {
        this.sound('scroll');
        if (this.fxOn) root.querySelectorAll('.reveal-slot').forEach((_, i) => setTimeout(() => this.sound('draw', 0.2 + i * 0.05), 900 + i * 600 + 300));
        const c = centerOf(root.querySelector('.modal').getBoundingClientRect());
        if (this.fxOn) {
          this.ring(c.x, c.y - 60, '#f6e7b4');
          this.burst(c.x, c.y - 60, { count: 26, spread: 120, color: '#f6e7b4' });
        }
      } else if (kind === 'won' || kind === 'lost') {
        this.rain(kind === 'won');
        this.sound(kind === 'won' ? 'win' : 'lose');
      }
    }

    handRow(attr, chosen) {
      return this.game.hand
        .map((c) => cardHTML(c, { selected: chosen.has(c.id), extra: '' }).replace('class="card', `data-ov="${attr}" class="card`))
        .join('');
    }

    // Cartas ganhas ao abrir uma porta que dá numa sala nova (ou ao descer de andar): aparecem de costas
    // e viram uma a uma. Se a soma foi exata, a carta de graça vem junto e vira primeiro. Sem escolhas:
    // o jogo já sabe quais são (o topo do deck) e só passam para a mão ao tocar no botão.
    refillHTML() {
      const g = this.game;
      const gain = g.refillPreview();
      const floorStart = g.pending.reason === 'floor';
      const title = floorStart ? `Andar ${g.floorNo}` : 'Porta aberta: sala nova!';
      const anim = this.overlayFresh && this.fxOn;
      const slots = gain
        .map(({ card, extra }, i) => {
          const tag = extra ? (g.pending.flush ? 'Soma exata, mesmo naipe!' : 'Carta extra: soma exata!') : floorStart ? 'Novo andar' : 'Sala nova';
          return `<div class="reveal-slot${extra ? ' extra' : ''}" style="--k:${i}">
            ${extra ? '<span class="reveal-badge">+1 BÔNUS</span>' : ''}
            <div class="flip${anim ? ' anim' : ''}">
              <div class="card back"></div>
              ${cardHTML(card, { extra: 'front' })}
            </div>
            <span class="reveal-tag">${tag}</span>
          </div>`;
        })
        .join('');
      let note;
      if (gain.length) note = gain.length === 1 ? 'Você ganha <b>1 carta</b>.' : `Você ganha <b>${gain.length} cartas</b>.`;
      else if (g.hand.length >= g.handLimit()) note = `Sua mão está cheia (${g.handLimit()}): nenhuma carta nova desta vez.`;
      else note = 'O seu deck acabou: não há cartas para ganhar.';
      return `<div class="modal reveal">
        <h2>${title}</h2>
        <p>${note}</p>
        <div class="reveal-row">${slots}</div>
        <div class="summary">Mão: ${g.hand.length} → ${g.hand.length + gain.length}/${g.handLimit()} · deck: ${g.playerDeck.length - gain.length}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-refill">${gain.length ? 'Pegar as cartas' : 'Continuar'}</button></div>
      </div>`;
    }

    // Comida (Maçã ou Bife): as cartas NOVAS aparecem de costas e viram uma a uma. Ao confirmar, elas vão
    // para posições aleatórias do deck (a pessoa precisa lembrar o que entrou).
    reinforceHTML() {
      const g = this.game;
      const { cards, gold, source } = g.pending;
      const anim = this.overlayFresh && this.fxOn;
      const where = { chão: 'achado no chão', inimigo: 'prêmio do inimigo', baú: 'bônus do baú' }[source] || '';
      const slots = cards
        .map(
          (card, i) => `<div class="reveal-slot reinforce-slot${gold ? ' extra' : ''}" style="--k:${i + 1}">
            <div class="flip${anim ? ' anim' : ''}">
              <div class="card back"></div>
              ${cardHTML(card, { extra: 'front' })}
            </div>
            <span class="reveal-tag">Carta nova</span>
          </div>`,
        )
        .join('');
      return `<div class="modal reveal reinforce${gold ? ' gold' : ''}">
        <div class="reinforce-ico" aria-hidden="true">${FOOD_SVG[g.pending.kind]}</div>
        <h2>${gold ? 'Um Bife!' : 'Uma Maçã!'}</h2>
        <p>${where ? `<span class="muted">${where}</span><br>` : ''}Você come ${DC.FOOD[g.pending.kind].a}: estas <b>${cards.length} cartas novas</b> serão embaralhadas no seu deck, <b>em posições aleatórias</b>. Elas não vêm do cemitério: são cartas a mais, e podem repetir as que você já tem.</p>
        <div class="reveal-row">${slots}</div>
        <div class="summary">Deck: ${g.playerDeck.length} → ${g.playerDeck.length + cards.length}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-reinforce">Guardar no deck</button></div>
      </div>`;
    }

    // Anel achado: escolha o espaço para vesti-lo (trocando o que estiver lá) ou deixe para trás.
    ringHTML() {
      const g = this.game;
      const R = DC.ROGUE.RINGS;
      const key = g.pending.ring;
      const def = R[key];
      const where = { inimigo: 'prêmio do inimigo', baú: 'achado no baú' }[g.pending.source] || '';
      const slots = g.rings
        .map((ring, i) => {
          const cur = ring ? `${R[ring.ring].name} (será trocado)` : 'espaço livre';
          return `<button class="btn ${ring ? '' : 'primary'}" data-ov="ring-wear" data-slot="${i}">Vestir no espaço ${i + 1}<small>${cur}</small></button>`;
        })
        .join('');
      return `<div class="modal ring-modal">
        <div class="ring-big" aria-hidden="true">${ringSVG(key)}</div>
        <h2>${def.name}!</h2>
        <p>${where ? `<span class="muted">${where}</span><br>` : ''}${def.text}<br><span class="muted">${def.suit ? 'Anel de naipe: 1 uso por andar, recarrega ao descer.' : 'Vale enquanto estiver no dedo.'} Você tem ${g.rings.length} espaços de anel.</span></p>
        <div class="actions ring-actions">${slots}<button class="btn" data-ov="ring-leave">Deixar para trás</button></div>
      </div>`;
    }

    // O cemitério: tudo o que já foi gasto e não volta mais, agrupado por naipe (dá para contar o que resta).
    graveHTML() {
      const g = this.game;
      const order = { S: 0, H: 1, D: 2, C: 3 };
      const sorted = g.discard.slice().sort((a, b) => order[a.suit] - order[b.suit] || a.rank - b.rank);
      const groups = ['S', 'H', 'D', 'C']
        .map((suit) => {
          const list = sorted.filter((c) => c.suit === suit);
          return `<div class="grave-suit"><h4>${sym(suit)} ${DC.SUIT_NAME[suit]} · ${list.length}</h4><div class="grave-row">${list.map((c) => cardHTML(c, { small: true, extra: 'static' })).join('') || '<span class="muted">nenhuma</span>'}</div></div>`;
        })
        .join('');
      return `<div class="modal grave">
        <h2>Cemitério · ${g.discard.length} carta${g.discard.length === 1 ? '' : 's'}</h2>
        <p class="muted">Carta usada não volta ao deck. Com isso dá para saber o que ainda pode estar nele (e lembrar o que a comida acrescentou).</p>
        ${g.discard.length ? groups : '<p class="muted">Ainda não há cartas gastas.</p>'}
        <div class="actions"><button class="btn primary" data-ov="close-grave">Fechar</button></div>
      </div>`;
    }

    // ---------- combate: uma cena no palco ----------
    //
    // O combate não é mais uma janela. O mapa fica escurecido atrás e o inimigo aparece em zoom no palco, com as cartas
    // dele embaixo (a fila da frente aberta, as de trás viradas e cobertas pelas da frente). A sua mão, o Poder e o
    // Inventário seguem embaixo e as pilhas e o histórico na coluna da direita: você marca cartas lá e cá, e a soma dos
    // dois lados aparece no meio. À esquerda ficam os ajustes de ±1 (anéis e pergaminhos) e à direita as jogadas
    // (derrubar, trocar 1 por 1 e fugir). Marque cartas dos dois lados: soma igual derruba; senão, troca 1 por 1.
    renderCombat() {
      const g = this.game;
      const box = this.el.combat;
      const enemy = g.combatEnemy();
      document.body.classList.toggle('in-combat', Boolean(enemy));
      this.el.mapWrap.classList.toggle('in-combat', Boolean(enemy));
      if (!enemy) {
        if (!box.hidden) {
          box.hidden = true;
          box.innerHTML = '';
        }
        this.combatKey = null;
        return;
      }
      // O esqueleto (nome e desenho do inimigo) é montado uma vez por combate: assim o desenho não recomeça a cada toque.
      const key = `${g.floorNo}:${enemy.id}:${this.artActive() ? 'art' : 'classico'}`;
      if (key !== this.combatKey || box.hidden || !box.firstElementChild) {
        this.combatKey = key;
        box.innerHTML = this.combatSkeleton(enemy);
        box.hidden = false;
        box.classList.remove('enter');
        void box.offsetWidth;
        box.classList.add('enter');
        // a entrada (zoom no inimigo) toca uma vez; depois a classe sai para não atrapalhar o golpe
        clearTimeout(this.enterTimer);
        this.enterTimer = setTimeout(() => box.classList.remove('enter'), 700);
      }
      const p = this.combatParts(enemy);
      box.style.setProperty('--n', p.widest);
      box.style.setProperty('--eh', p.height);
      box.style.setProperty('--eb', p.budget);
      box.classList.toggle('exact', p.exact);
      const part = (name) => box.querySelector(`[data-part="${name}"]`);
      part('adjust').innerHTML = p.adjust;
      part('actions').innerHTML = p.actions;
      part('ability').innerHTML = p.ability;
      part('cards').innerHTML = p.cards;
      part('cards').classList.toggle('dense', p.dense);
      part('sumfoe').innerHTML = p.sumFoe;
      part('sumfoe').className = `cs-sum foe${p.marked ? ' on' : ''}${p.exact ? ' exact' : ''}`;
      part('summine').innerHTML = p.sumMine;
      part('summine').className = `cs-sum mine${p.picked ? ' on' : ''}${p.exact ? ' exact' : ''}`;
      part('status').innerHTML = p.status;
      // O golpe: o inimigo se encolhe (e treme) uma vez, e depois volta a respirar.
      if (this.foeHit) {
        this.foeHit = false;
        for (const n of box.querySelectorAll('.cs-foe, .cs-foe .enemy-sprite')) {
          n.classList.remove('hit');
          void n.offsetWidth;
          n.classList.add('hit');
          // (o fim da animação de um filho também sobe até aqui: só vale o do próprio elemento)
          const done = (e) => {
            if (e.target !== n) return;
            n.classList.remove('hit');
            n.removeEventListener('animationend', done);
          };
          n.addEventListener('animationend', done);
        }
      }
    }

    combatSkeleton(enemy) {
      const name = enemy.boss ? 'Chefão' : ENEMY_NAME[enemy.kind] || 'Inimigo';
      const figure = enemy.kind === 'rat' ? RAT_SVG : this.artActive() ? `<i class="sprite enemy-sprite k-${enemy.kind}${enemy.boss ? ' boss' : ''}"></i>` : ENEMY_SVG;
      return `<div class="cs-side cs-left" data-part="adjust"></div>
        <div class="cs-center">
          <div class="cs-plate"><span class="cs-name">${name}</span><span data-part="ability"></span></div>
          <div class="cs-foe k-${enemy.kind}${enemy.boss ? ' boss' : ''}">${figure}</div>
          <div class="cs-sum foe" data-part="sumfoe"></div>
          <div class="cs-cards enemy-board" data-part="cards"></div>
          <div class="cs-sum mine" data-part="summine"></div>
          <p class="cs-status" data-part="status"></p>
        </div>
        <div class="cs-side cs-right" data-part="actions"></div>`;
    }

    // Tudo o que muda a cada toque na cena: cartas do inimigo, as duas somas, o texto de ajuda e os botões.
    combatParts(enemy) {
      const g = this.game;
      const { sum, sums, cards, exact } = this.selectionHTML(true);
      const flipped = this.revealIds;
      this.revealIds = [];
      // Só dá para marcar o que continua aberto.
      const open = this.foeTargets(enemy);
      this.targets = new Set([...this.targets].filter((id) => open.some((c) => c.id === id)));
      const marked = this.markedTargets();
      const markedCost = marked.reduce((n, c) => n + c.rank, 0);
      const byId = new Map(enemy.cards.map((c) => [c.id, c]));
      const rows = enemy.rows && enemy.rows.length ? enemy.rows : [enemy.cards.map((c) => c.id)];
      const slot = (c) => {
        let html;
        if (enemy.down.includes(c.id)) {
          html = cardHTML(c, { badge: 'derrotada', extra: 'enemy-card down' });
        } else if (isHiddenCard(enemy, c)) {
          const n = coversLeft(enemy, c);
          html = `<div class="card back dungeon enemy-card locked" data-ov="hidden-card" data-id="${c.id}" title="Carta travada: sai da frente dela primeiro"><span class="badge lock">🔒 ${n} na frente</span></div>`;
        } else {
          const state = this.targets.has(c.id) ? ` target${exact ? ' exact' : ''}` : '';
          html = cardHTML(c, { extra: `enemy-card${state}${flipped.includes(c.id) ? ' flip' : ''}` }).replace('class="card', 'data-ov="attack" class="card');
        }
        return `<div class="board-slot">${html}</div>`;
      };
      // A fila da frente fica por último (embaixo, em cima das de trás).
      const board = [...rows]
        .reverse()
        .map((ids, k) => `<div class="board-row ${k === rows.length - 1 ? 'front' : 'back'}">${ids.map((id) => slot(byId.get(id))).join('')}</div>`)
        .join('');
      // Altura do conjunto, em larguras de carta: serve para a carta caber na cena (a fila de trás aparece só em parte).
      const height = rows.length === 1 ? 1.4 : rows.length === 2 ? 2.35 : 1.9 + 0.35 * (rows.length - 2);

      const last = g.hand.length === 1;
      const pick = cards.length === 1 ? cards[0] : null;
      // Troca: 1 carta da mão por 1 carta aberta de valor diferente; a diferença queima cartas do deck.
      const canTrade = cards.length === 1 && marked.length === 1 && !exact;
      const damage = canTrade ? g.tradeCost(this.sel, marked[0].rank) : 0;
      let status;
      if (!cards.length && !marked.length) status = g.tutorial ? 'Dica do treino: as duas cartas dele somam 5 + 3 = 8, e o ♠4 vale o dobro (8). Marque o ♠4 e as duas cartas dele.' : `${this.isTouch() ? 'Toque' : 'Escolha'} cartas da <b>sua mão</b> e cartas <b>abertas</b> do inimigo: se as <b>somas forem iguais</b>, as dele caem (♠ vale o número ou o dobro).`;
      else if (!marked.length) status = 'Agora toque nas cartas <b>abertas</b> do inimigo que você quer derrubar.';
      else if (!cards.length) status = `Marcado: ${markedCost} do inimigo. Escolha cartas da sua mão que somem ${markedCost}.`;
      else if (exact) status = `★ <b>${markedCost} = ${markedCost}</b>: soma exata! Toque em Derrubar.`;
      else if (canTrade) status = `Não bate (${sum} × ${markedCost}). Preso? <b>Trocar</b> custa <b>${damage}</b> de dano: ${damage} carta${damage === 1 ? '' : 's'} do seu deck queima${damage === 1 ? '' : 'm'}.`;
      else status = `Não bate: a sua soma é ${sum}${sums.length > 1 ? ` (ou ${sums.slice(0, -1).join(', ')})` : ''} e a dele ${markedCost}.`;

      // À esquerda: anéis de ±1 e de naipe e pergaminhos de Precisão, que mexem na carta escolhida da mão.
      const adj = g.rings.map((r, i) => this.combatRingHTML(r, i)).join('') + this.combatScrollsHTML();
      const trade = canTrade ? `${label(cards[0])} por ${label(marked[0])}` : 'uma carta de cada lado';
      const flee = pick ? `descarta ${label(pick)}${last ? ' (a sua última: você perde)' : ''}` : 'descarta 1 carta da mão';
      const attack = exact ? `${marked.length} carta${marked.length === 1 ? '' : 's'} · ${markedCost}` : 'precisa de soma exata';
      return {
        cards: board,
        dense: rows.length > 2,
        widest: Math.max(...rows.map((r) => r.length)),
        height,
        // quanto da altura da cena (em %) as cartas dele podem ocupar: mais filas, mais altura
        budget: rows.length === 1 ? 30 : rows.length === 2 ? 36 : 40,
        exact,
        marked: marked.length > 0,
        picked: cards.length > 0,
        sumFoe: `<small>Inimigo</small><b>${marked.length ? markedCost : '–'}</b>`,
        sumMine: `<small>Você</small><b>${cards.length ? sum : '–'}</b>${cards.length && sums.length > 1 ? `<em>ou ${sums.slice(0, -1).join(', ')}</em>` : ''}${exact ? '<i>★</i>' : ''}`,
        status,
        ability: this.abilityHTML(enemy),
        adjust: adj ? `<div class="cs-box"><h4>Ajustar a carta escolhida</h4><div class="cs-adj">${adj}</div></div>` : '',
        actions: `<button class="btn primary cs-btn" data-ov="attack-go" ${exact ? '' : 'disabled'}><b>Derrubar</b><small>${attack}</small></button>
          <button class="btn cs-btn${canTrade ? ' danger' : ''}" data-ov="trade-go" ${canTrade ? '' : 'disabled'} title="Preso? Troque 1 carta da mão por 1 carta aberta do inimigo de valor diferente: a diferença queima cartas do seu deck."><b>${canTrade ? `Trocar · dano ${damage}` : 'Trocar 1 por 1'}</b><small>${trade}</small></button>
          ${enemy.boss ? '' : `<button class="btn cs-btn${last && pick ? ' danger' : ''}" data-ov="flee" ${pick ? '' : 'disabled'}><b>Fugir</b><small>${flee}</small></button>`}
          <button class="btn link cs-clear" data-act="clear" ${cards.length || marked.length ? '' : 'disabled'}>Limpar seleção</button>`,
      };
    }

    // Habilidade do inimigo (experimento Rogue), com o que ela já fez neste combate.
    abilityHTML(enemy) {
      if (!enemy.ability) return '';
      const a = DC.ROGUE.ABILITIES[enemy.ability];
      let extra = '';
      if (enemy.ability === 'nymph') extra = enemy.loot ? ` Roubou ${label(enemy.loot)}.` : ' Você não tinha carta guardada.';
      return `<span class="foe-ability" title="${a.text}"><b>${a.name}</b> ${a.text}${extra}</span>`;
    }

    chestHTML() {
      const g = this.game;
      const options = g.pending.options;
      const picks = [...this.picks].filter((id) => options.some((c) => c.id === id));
      const out = [...this.discard].filter((id) => g.hand.some((c) => c.id === id));
      const finalHand = g.hand.length - out.length + picks.length;
      const valid = finalHand <= g.handLimit();
      const deal = this.overlayFresh ? ' deal' : '';
      const optionRow = options
        .map((c, k) =>
          cardHTML(c, { selected: this.picks.has(c.id) }).replace('class="card', `style="--k:${k}" data-ov="toggle-pick" class="card`),
        )
        .join('');
      return `<div class="modal">
        <div class="chest-big${this.overlayFresh ? ' anim' : ''}">${CHEST_BIG_SVG}</div>
        <h2>Baú aberto!</h2>
        <p>O baú revela ${options.length} cartas do seu deck. Escolha até ${g.config.chestPicks} para levar para a mão; as outras voltam ao deck.</p>
        <div class="cardrow${deal}">${optionRow || '<p class="muted">Seu deck está vazio.</p>'}</div>
        <h4>Sua mão ${finalHand > g.handLimit() ? '· está cheia: marque cartas para descartar' : '(marque para descartar, se quiser)'}</h4>
        <div class="cardrow">${g.hand.length ? this.handRow('toggle-discard', this.discard) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        ${this.stashModalHTML()}
        <div class="summary">Levando ${picks.length} · descartando ${out.length} · mão final ${finalHand}/${g.handLimit()}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-chest" ${valid ? '' : 'disabled'}>${picks.length ? `Levar ${picks.length} carta(s)` : 'Não levar nada'}</button></div>
      </div>`;
    }

    // Dica da derrota (depende de como acabou); some com "Desligar dicas".
    lossTipHTML() {
      if (!this.tutor.saved.hints) return '';
      return `<div class="tip"><b>Dica:</b> ${DC.lossHint(this.game)}</div>`;
    }

    endHTML(won) {
      const g = this.game;
      if (g.tutorial) {
        return `<div class="modal ${won ? 'win' : 'lose'}">
          <h2>${won ? 'Treino concluído!' : 'Sem ações possíveis'}</h2>
          <p>${won ? `Agora é a masmorra de verdade: ${DC.CONFIG.floors} andares e, no fim, um <b>Chefão</b>.` : 'Acabaram as cartas do treino. Tente de novo, desta vez com mais calma.'}</p>
          ${won ? `<ul class="tour-next">
            <li><b>Fome:</b> a cada 30 turnos uma carta queima. Ache <b>comida</b> (Maçã 3, Bife 5) no chão, em baús e com inimigos.</li>
            <li><b>Soma exata</b> em portas compra cartas; em combate é o que derruba o inimigo.</li>
            <li><b>Baús</b> pagam como portas e guardam comida e anéis. Alguns são de graça.</li>
            <li><b>Salas especiais</b> (poço, altar, biblioteca...) ficam em becos: cada uma tem uma regra. Dá para tentar ou deixar.</li>
            <li>Uma parede suspeita pode esconder uma <b>sala secreta</b>: passe perto dela.</li>
          </ul>
          <p class="muted">Tudo isso fica em <b>Regras</b> quando precisar.</p>` : ''}
          ${won ? '' : this.lossTipHTML()}
          <div class="actions">
            <button class="btn ${won ? '' : 'primary'}" data-ov="tour-retry">Refazer o treino</button>
            ${won ? '<button class="btn primary" data-ov="tour-play">Jogar de verdade</button>' : ''}
          </div>
        </div>`;
      }
      return `<div class="modal ${won ? 'win' : 'lose'}">
        <h2>${won ? 'Você escapou da masmorra!' : 'Sem ações possíveis'}</h2>
        <p>${
          won
            ? (g.hasBoss() ? `Os ${g.config.floors} andares e o Chefão ficaram para trás.` : `Os ${g.config.floors} andares ficaram para trás.`)
            : `Você ficou sem cartas para fazer o próximo movimento no andar ${g.floorNo}.`
        }</p>
        ${won ? '' : this.lossTipHTML()}
        <div class="summary">Deck: ${g.playerDeck.length} · mão: ${g.hand.length} · cemitério: ${g.discard.length} · seed ${g.seed}</div>
        <div class="playtest">
          <h4>Playtest (opcional)</h4>
          ${DC.TUTORIAL_TEXT.questions
            .map((q) => `<label>${q.label}<input type="text" data-note="${q.id}" maxlength="200" autocomplete="off" value="${(this.notes[q.id] || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" /></label>`)
            .join('')}
          <button class="btn primary" data-ov="send-report" title="Abre o GitHub com o relatório já preenchido: é só tocar em Submit new issue">Enviar relatório (abre o GitHub)</button>
          <button class="btn" data-ov="copy-report">Copiar relatório</button>
        </div>
        <div class="actions">
          <button class="btn" data-ov="restart-same">Mesma masmorra</button>
          <button class="btn primary" data-ov="restart-new">Nova masmorra</button>
        </div>
      </div>`;
    }

    helpHTML() {
      return `<div class="modal">
        <h2>Como jogar</h2>
        <p>Desça os ${this.game.config.floors} andares até a escada de saída (▼): depois do último, a sala do <b>Chefão</b> (10 cartas em filas, sem fuga) é o final. Derrube todas as cartas dele para vencer. Sua <b>vida é o deck + a mão</b>: se não restar nenhuma ação possível, você perde.</p>
        <h4>Cartas</h4>
        <ul>
          <li><b>Andar é de graça</b>, por turnos (como no Rogue): toque numa casa e o personagem vai passo a passo (ou use as setas do teclado). Só anda na vertical e horizontal. <b>Cada passo é um turno</b>, e abrir uma porta ou um baú também passa um turno. Depois do seu turno os inimigos agem.</li>
          <li><b>Fome</b> (o relógio contra enrolar): a cada <b>30 turnos</b> a carta do topo do deck <b>queima</b> e vai para o cemitério (sem deck, a menor da mão). O contador "Fome em N" fica no topo e pisca quando faltam 5. Comer <b>não zera</b> o relógio: explore com pressa, sem enrolar.</li>
          <li><b>Abrir portas e baús:</b> fique ao lado, selecione cartas cuja soma seja pelo menos o custo. <b>Soma exata</b> compra ${this.game.config.exactBonus} carta de graça; se a soma exata for paga com <b>2 ou mais cartas do mesmo naipe</b>, compra ${this.game.config.flushBonus}. Soma maior apenas abre.</li>
          <li><b>Baú:</b> mostra 5 cartas do seu deck, você leva até 2 e o resto volta ao deck. Todo baú guarda um prêmio. O que <b>custa cartas</b> é o grande: um <b>anel</b> (metade das vezes) ou, senão, um <b>Bife</b> garantido. O <b>destrancado</b> (marcado "grátis") abre sem gastar cartas e dá uma <b>Maçã</b> (em um a cada quatro, um anel).
          <li>Toda carta usada vai para o <b>cemitério</b> (o descarte) e <b>nunca volta</b> ao deck. Toque na pilha para ver o que já foi.</li>
          <li><b>Comida</b> (<b>Maçã</b> acrescenta <b>3 cartas novas</b> ao deck e <b>Bife</b>, 5), achada no chão, com inimigos e em baús: você come e as cartas entram em posições aleatórias. São sorteadas como se saíssem de um baralho completo, então o seu deck pode ficar com mais de um naipe, ou com cartas repetidas.</li>
        </ul>
        <h4>Poderes (o número da carta é a intensidade)</h4>
        <ul>
          <li><b>♥ Copas:</b> compra até N cartas (mão máxima de ${this.game.config.handMax}).</li>
          <li><b>♠ Espadas:</b> em combate vale o <b>número ou o dobro</b> (casa com os dois valores). Fora do combate vale só o número.</li>
          <li><b>♦ Ouros:</b> mana. Descarte um ♦ pelo poder e ganhe mana igual ao número dele (até o teto de ${this.game.config.manaMax}). A mana fica guardada e é gasta nos anéis.</li>
          <li><b>♣ Paus:</b> coringa. Vale o próprio número, mas você pode escolher copiar o rank de outra carta da mão.</li>
        </ul>
        <h4>Anéis e mana</h4>
        <p>Os anéis ficam no dedo (<b>2 espaços</b>). Vêm de <b>baús</b> (metade deles guarda um, e o do <b>andar 1</b> sempre guarda) e de <b>inimigos</b> (os mais difíceis deixam mais). Ao achar um, você escolhe em que espaço vesti-lo, trocando o que estiver lá, ou deixa para trás. <b>Passivos</b> (valem sozinhos): <b>Mão</b> +1 na mão máxima, <b>Deck</b> +1 carta ao abrir sala nova, <b>Comida</b> porta aberta com soma exata põe 1 carta nova no deck, <b>Mago</b> +4 de mana máxima. <b>Ativos</b> (gastam ${this.game.config.ringUseMana} de mana por uso: escolha 1 carta da mão e toque no anel): <b>Ladrão</b> a carta sobe ou desce 1 ao pagar portas e baús, <b>Precisão</b> a carta sobe ou desce 1 em combate (só aquela carta, uma vez; com ♠ o ajuste entra depois do dobro), e os <b>anéis de naipe</b> (♠ ♥ ♦ ♣) viram a carta daquele naipe até ser usada.</p>
        <h4>Névoa</h4>
        <p>Você só enxerga a sala em que está e as salas cujas portas já abriu. Não dá para saber onde fica a escada de saída: é preciso gastar cartas explorando. O botão "Névoa" no topo (ou a tecla F) liga e desliga, útil para testar.</p>
        <h4>Zoom</h4>
        <p>Os botões + e − no canto do mapa (ou as teclas + e −) aproximam e afastam. O zoom tem tamanhos fixos (100% = casas de 40 px, sempre igual), de 60% a 300%. Quando o mapa passa da tela, ele acompanha o seu personagem. Para olhar outras salas, <b>arraste o mapa</b> (em qualquer ponto, inclusive na parte escura). O botão ◎ ao lado do zoom (ou a tecla C) volta para o personagem, e a câmera também volta sozinha quando ele anda.</p>
        <h4>Inimigos</h4>
        <p>Os inimigos <b>começam dormindo</b>. Enquanto você está <b>dentro da sala</b> de um (avermelhada, de qualquer distância), ele pode <b>acordar</b> a cada turno: 2 em 3 para os grandes e 1 em 3 para os ratos, ou seja, quase sempre acordam. Da porta você ainda só espia. Acordado, ele <b>anda uma casa por turno atrás de você</b>, <b>até em outras salas</b> (passa por portas que você já abriu, mas não abre as fechadas), e quando encosta começa o <b>combate</b>. Ele te segue enquanto <b>te vê</b> (uns 9 casas, sem parede no meio; da porta ele só vê em linha reta). Se você sai da vista, ele vai até o último lugar onde te viu (<b>?</b>) e, depois de uns 3 turnos sem te achar, <b>desiste e volta a dormir</b>. Descer a escada também escapa. Você também pode atacar um que dorme, tocando nele. Há <b>ratos</b>: inimigos pequenos de <b>1 carta fácil de casar</b> (8 a Q), que rendem menos (às vezes uma Maçã). Os grandes têm <b>2 cartas</b> (<b>3 nos andares mais fundos e 4 no último</b>). Com 3 ou mais, elas ficam numa <b>formação</b>: uma fila da <b>frente, aberta</b>, e outra <b>atrás, travada</b> (virada de costas), coberta pelas da frente que a tocam. Uma carta travada só vira quando <b>todas</b> as que a cobrem caem. No combate, marque <b>cartas da sua mão</b> e <b>cartas abertas</b> dele: se as <b>somas forem exatamente iguais</b>, as cartas dele caem (qualquer quantidade dos dois lados; ♠ vale o número ou o dobro). Derrubando todas você vence e compra 1 carta; o poder de ♥ funciona ali. <b>Preso, sem soma que bata?</b> Dá para <b>trocar</b> 1 carta da mão por 1 carta aberta dele de valor diferente: a <b>diferença</b> vira <b>dano</b> e essa quantidade de cartas do topo do seu deck queima (se o deck acabar, queima da mão). Por isso sobrar só carta alta no fim sai caro. Dá para <b>fugir</b> descartando 1 carta: o inimigo fica parado por 3 turnos, dando tempo de sair da vista dele (as cartas já derrubadas continuam derrubadas), mas se for a sua última carta você perde.</p>
        <h4>Salas especiais e secretas</h4>
        <p>Do <b>andar 2</b> em diante, cada andar tem um <b>beco sem saída extra</b> (a porta custa cartas, como as outras) com um <b>poço</b>, um <b>altar</b>, uma <b>biblioteca</b>, uma <b>cripta</b>, uma <b>mesa de jogo</b> ou uma <b>oficina</b>, e a ordem muda a cada partida. O <b>poço</b> é de graça, mas só se descobre o que faz bebendo (a cor da água decide: <b>enche a mana</b>, põe <b>cartas novas no deck</b> ou <b>enche a mão</b>), e seca depois. No <b>altar</b> você sacrifica 1 carta da mão: o valor dela decide o prêmio. Na <b>biblioteca</b> você paga ${this.game.config.libraryCost} carta e leva 1 entre 3 pergaminhos. Na <b>cripta</b> você paga ${this.game.config.cryptCost} carta e escolhe ${this.game.config.cryptTake} do <b>cemitério</b> para voltarem ao deck. Na <b>mesa de jogo</b> você aposta 1 carta da mão contra uma da casa: se a sua for maior, volta e ganha ${this.game.config.tableWinCards} cartas novas no deck; se for igual, volta; se for menor, você a perde. Na <b>oficina</b> você ${this.game.config.forgeCost ? `queima ${this.game.config.forgeCost} carta para dar a outra` : 'dá a uma carta da mão'} <b>+1 de valor</b> ou <b>outro naipe</b>, para sempre. Alguns andares têm também uma <b>sala secreta</b>: a porta parece parede e você a descobre <b>passando perto dela</b>, a até ${this.game.config.secretFindRadius} casas, na mesma sala (${Math.round(this.game.config.secretFindChance * 100)}% de chance por turno). Dentro há um baú que abre de graça e guarda um anel e um Bife.</p>
        <h4>Pergaminhos de Precisão e do Ladrão</h4>
        <p>Têm o mesmo efeito dos anéis de mesmo nome, mas são <b>de uso único e não gastam mana</b>: escolha 1 carta da mão e toque em <b>−1</b> ou <b>+1</b> no pergaminho da bolsa (o de <b>Precisão</b> também aparece na cena de combate). A carta sobe ou desce 1 (o Ás não desce e o Rei não sobe) e o pergaminho some. Saem de baús e de inimigos, no mesmo sorteio das poções e do mapa, e têm nome claro (não são misteriosos).</p>
        <h4>Pergaminho de Inventário</h4>
        <p>Cada inimigo tem <b>30% de chance</b> de deixar um pergaminho <b>no lugar da carta de vitória</b>, e <b>30% dos baús</b> o guardam <b>no lugar das cartas</b>. Você já começa com <b>1 slot de brinde</b>, e cada pergaminho abre mais um (até 3 no total) ao lado da mão, onde você <b>guarda cartas</b> para usar depois. Para guardar, escolha 1 carta da mão e toque num slot livre (no baú, marque a carta e toque no slot: ela é guardada em vez de descartada). Toque na carta guardada para devolvê-la à mão. Guardar e devolver é grátis, a qualquer momento, até em combate, mas para <b>usar</b> a carta ela precisa estar na mão (o limite de 7 continua). Se a mão esvaziar mas houver cartas nos slots, você ainda não perdeu.</p>
        <h4>No iPad (toque)</h4>
        <p>Toque numa carta para escolher (toque de novo para soltar). Toque numa casa para <b>andar até lá</b> (andar é de graça). Toque numa porta ou baú ao seu lado para abrir; se estiver longe, o personagem vai até ao lado dela. <b>Arraste o mapa com o dedo</b> para olhar outras salas; o botão ◎ volta para o personagem.</p>
        <h4>Salas novas</h4>
        <p>Ao <b>descer de andar</b> você ganha ${this.game.config.refillDraw} carta do seu deck, sem passar do limite de ${this.game.config.handMax} na mão: ela aparece de costas e vira. Abrir a porta de uma sala nova <b>não dá carta por si só</b>: só ganha cartas quem abre com <b>soma exata</b> (${this.game.config.exactBonus}, ou ${this.game.config.flushBonus} com 2 ou mais cartas do mesmo naipe), que viram numa janelinha antes de entrar na sala.</p>
        <h4>Atalhos</h4>
        <p>Setas andam um passo; teclas 1–5 selecionam cartas da mão; Esc limpa a seleção; F liga/desliga a névoa; E liga/desliga os efeitos; M liga/desliga o som; A alterna a arte de pixel art; + e − aproximam e afastam o mapa; C centraliza no personagem.</p>
        ${this.artAvailable ? '<p class="muted">Arte do mapa, dos inimigos e do herói: pixel art de <b>Pixel_Poem</b> (pixel-poem.itch.io).</p>' : ''}
        <div class="actions"><button class="btn primary" data-ov="close-help">Entendi</button></div>
      </div>`;
    }
  }

  function miniChip(card) {
    return miniInline(card);
  }

  function miniInline(card) {
    return `<span class="tag" style="color:${isRed(card.suit) ? '#ff8a8a' : '#f0e9dc'}">${label(card)}</span>`;
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
  });
})();
