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
    S: 'Poder: compra até N cartas (N = número da carta).',
    H: 'Poder: devolve N cartas aleatórias do descarte ao deck.',
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
  const isHiddenCard = (enemy, card) => Boolean(enemy.hidden) && enemy.hidden.includes(card.id);
  const MINI_BACK = '<span class="mini back"></span>';
  const ENEMY_NAME = { skeleton1: 'Skelly', skeleton2: 'Esqueleto', vampire: 'Vampiro' };

  // O zoom é um múltiplo do tamanho que faz a masmorra inteira caber na tela.
  const ZOOMS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const DEFAULT_ZOOM = 3; // índice em ZOOMS: 1.75x
  const LOW_DECK = 5; // com tantas cartas ou menos, o deck do jogador pisca como aviso
  const PAN_GAP = 3; // folga escura (em casas) que dá para arrastar além da borda do mapa

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
        toast: $('toast'),
        floor: $('hud-floor'),
        seed: $('hud-seed'),
        fx: $('fx'),
        stash: $('stash'),
        power: $('power'),
      };
      this.sel = [];
      this.busy = false;
      this.help = false;
      this.resetOverlayState();
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
      this.el.stash.addEventListener('click', (e) => {
        const slot = e.target.closest('.stash-slot');
        if (slot) this.onSlotClick(slot);
      });
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
      const n = Number(e.key);
      if (n >= 1 && n <= 5 && this.game.hand[n - 1]) this.toggleCard(this.game.hand[n - 1].id);
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
        const raw = localStorage.getItem('deckcrawly.zoom');
        const saved = raw === null ? NaN : Number(raw);
        if (Number.isInteger(saved) && saved >= 0 && saved < ZOOMS.length) return saved;
      } catch (e) {
        /* sem armazenamento: usa o padrão */
      }
      return DEFAULT_ZOOM;
    }

    changeZoom(step) {
      const next = Math.max(0, Math.min(ZOOMS.length - 1, this.zoom + step));
      if (next === this.zoom) return;
      this.zoom = next;
      try {
        localStorage.setItem('deckcrawly.zoom', String(next));
      } catch (e) {
        /* sem armazenamento: vale só nesta sessão */
      }
      this.view = null;
      if (this.busy) return;
      this.renderMap(false);
      this.updateHighlights();
    }

    // Volta a câmera para o personagem depois de arrastar o mapa.
    centerCamera() {
      if (!this.view) return;
      this.view = null;
      this.placeCamera(this.game.player.x, this.game.player.y, true);
    }

    // Arrastar o mapa (em qualquer ponto da área escura ou sobre as casas) move a câmera.
    // Só vira arrasto depois de alguns pixels, para o clique de andar continuar funcionando.
    bindPan() {
      const wrap = this.el.mapWrap;
      let drag = null;
      wrap.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this.busy || e.target.closest('.zoom')) return;
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
      document.getElementById('zoom-level').textContent = `${Math.round(ZOOMS[this.zoom] * 100)}%`;
      document.getElementById('btn-zoom-out').disabled = this.zoom === 0;
      document.getElementById('btn-zoom-in').disabled = this.zoom === ZOOMS.length - 1;
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

    // Prévia do caminho até uma casa. Se ele passa pela zona de um inimigo, é cortado
    // na primeira casa da zona, que ganha a marca de combate (⚔).
    previewPath(x, y) {
      this.clearPath();
      const f = this.game.floor;
      if (!this.reachMap || !this.reachMap.has(y * f.w + x)) return null;
      const cut = this.game.cutPath(DC.pathTo(f, this.reachMap, x, y));
      for (const p of cut.path) this.tileEls[p.y * f.w + p.x].classList.add('path');
      const last = cut.path[cut.path.length - 1];
      if (cut.enemy) this.tileEls[last.y * f.w + last.x].classList.add('fight');
      return cut;
    }

    // No toque, o primeiro toque mostra o caminho (a casa final ganha um contorno).
    showPath(x, y) {
      const cut = this.previewPath(x, y);
      if (!cut) return;
      const last = cut.path[cut.path.length - 1];
      this.tileEls[last.y * this.game.floor.w + last.x].classList.add('path-end');
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
          this.floatText(res.drawn ? '+1 carta' : 'Soma exata!', c.x, c.y - rect.height * 0.3, 'gold');
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
      veil.innerHTML = `<b>Andar ${this.game.floorNo}</b><span>de ${this.game.config.floors}</span>`;
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

    // Ataca uma carta do inimigo com as cartas escolhidas.
    doAttack(enemyCardId, el) {
      if (this.busy || !this.game.canFight()) return;
      const g = this.game;
      const enemy = g.combatEnemy();
      const rect = el ? el.getBoundingClientRect() : null;
      const res = g.attack(this.sel, enemyCardId);
      if (!res.ok) return this.reject(res.error);
      this.sel = [];
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
          this.floatText(res.scroll ? 'Vitória! Pergaminho de Inventário' : res.reward ? 'Vitória! +1 carta' : 'Vitória!', c.x, c.y - at.height * 0.4, 'gold');
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
        this.refreshSelection();
      } else if (act.dataset.act === 'power') {
        const suit = this.game.hand.find((c) => c.id === this.sel[0]).suit;
        const res = this.game.usePower(this.sel[0]);
        if (!res.ok) return this.reject(res.error);
        this.track('power', { suit });
        this.sel = [];
        if (suit === 'S') this.fxDrawStep = 45;
        // O contador do deck só pula quando as cartas de ♥ chegam.
        if (suit === 'H') this.fxBumpDelay = [(260 + (Math.min(res.count, 8) - 1) * 80 + 460) / 1000, 0.26, 0];
        this.renderAll();
        if (suit === 'H') {
          this.heartFx(res.count);
          this.sound('heart', 0.25);
          for (let i = 0; i < Math.min(res.count, 8); i++) this.sound('blip', 0.26 + i * 0.08, i);
        } else if (suit === 'S') {
          this.spadeFx(res.count);
          this.sound('spade');
        }
      }
    }

    onMapClick(e) {
      const tile = e.target.closest('.tile');
      if (!tile || this.busy || this.dragging || !this.game.canAct()) return;
      const x = Number(tile.dataset.x);
      const y = Number(tile.dataset.y);
      const cell = this.game.floor.grid[y][x];

      if (cell.type === 'door' || cell.type === 'chest') {
        if (!this.sel.length) return this.toast('Selecione cartas da mão para pagar o custo.');
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
      // No toque, o primeiro toque numa casa alcançável mostra o caminho e o segundo anda:
      // um toque errado não gasta a carta.
      const key = y * this.game.floor.w + x;
      if (this.isTouch() && this.sel.length === 1 && this.reachMap && this.reachMap.has(key)) {
        if (this.tapTile !== key) {
          this.showPath(x, y);
          this.tapTile = key;
          return;
        }
      }
      this.tapTile = null;
      this.walkTo(x, y);
    }

    async walkTo(x, y) {
      if (this.sel.length !== 1) {
        return this.toast(this.sel.length ? 'Para andar, selecione apenas uma carta.' : 'Selecione uma carta para andar.');
      }
      const walked = this.game.hand.find((c) => c.id === this.sel[0]);
      const res = this.game.walk(this.sel[0], x, y);
      if (!res.ok) return this.reject(res.error);
      // ♦ dobra o alcance: o personagem desliza mais rápido, deixando riscos de velocidade.
      const fast = this.fxOn && walked.suit === 'D';
      const stepMs = fast ? 62 : 95;
      this.sel = [];
      this.busy = true;
      this.clearPath();
      this.renderSide();
      this.el.map.style.setProperty('--step', `${stepMs + 15}ms`);
      if (fast) {
        const t = centerOf(this.token.getBoundingClientRect());
        this.floatText('×2', t.x, t.y - 20, 'gold');
      }
      if (walked.suit === 'D') this.sound('swoosh');
      let prev = res.path[0];
      for (const step of res.path.slice(1)) {
        this.stepFx(prev, step, fast);
        this.sound('step');
        this.placeToken(step.x, step.y);
        prev = step;
        await sleep(stepMs);
      }
      await sleep(80);
      this.el.map.style.removeProperty('--step');
      this.track('move', { steps: res.path.length - 1, suit: walked.suit });
      if (res.combat) this.track('combat');
      if (res.descended && this.game.status === 'playing') this.track('descend');
      if (res.combat) {
        this.combatStartFx();
        await sleep(this.fxOn ? 500 : 0);
      }
      if (res.descended && this.game.status === 'playing') this.sound('stairs');
      if (res.descended && this.game.status === 'playing' && this.fxOn) {
        await this.floorVeil(() => {
          this.busy = false;
          this.renderAll();
        });
      } else {
        this.busy = false;
        this.renderAll();
      }
    }

    onMapHover(e) {
      if (this.isTouch()) return;
      this.clearPath();
      if (!this.reachMap || this.busy || this.dragging) return;
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
      // Poderes, coringa e "limpar seleção" dentro da janela de combate usam o mesmo código do painel.
      if (e.target.closest('[data-act], [data-joker]')) return this.onPanelClick(e);
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
          this.doAttack(id, btn);
          break;
        case 'hidden-card':
          this.toast('Essa carta está virada de costas: derrube a outra primeiro.');
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
      this.el.floor.textContent = `Andar ${g.floorNo} / ${g.config.floors}`;
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
        pile(lowDeck ? 'Deck acabando!' : 'Seu deck (vida)', g.playerDeck.length, g.playerDeck.length ? '<div class="card back small"></div>' : '<div class="empty"></div>') +
        pile('Descarte', g.discard.length, top ? cardHTML(top, { small: true, extra: 'static' }) : '<div class="empty"></div>') +
        pile('Cartas da dungeon', dungeonLeft, dungeonLeft ? '<div class="card back dungeon small"></div>' : '<div class="empty"></div>');

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

    // Quantas cartas o poder de ♥ (devolver) ou ♠ (comprar) mexeria agora.
    powerCount(card) {
      const g = this.game;
      if (card.suit === 'H') return Math.min(card.rank, g.discard.length);
      return Math.min(card.rank, g.config.handMax - (g.hand.length - 1), g.playerDeck.length);
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
      this.el.stash.innerHTML = `<div class="stash-label">Inventário ${g.slotsOpen ? `${g.stash.length}/${g.slotsOpen}` : 'bloqueado'}</div><div class="stash-row">${this.slotsInner()}</div>`;
      this.newSlot = -1;
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
        // Slot com carta: devolve para a mão.
        const res = g.unstashCard(el.dataset.id);
        if (!res.ok) return this.reject(res.error);
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
    // ♣ copia, ♥ devolve e ♠ compra, já limitados pelo descarte, pelo deck e pela mão).
    cardBadge(card) {
      const g = this.game;
      if (card.suit === 'D') return `anda ${card.rank * 2}`;
      if (card.suit === 'C') {
        const copied = g.jokerTarget(card);
        return copied ? `copia ${copied.rank}` : `vale ${card.rank}`;
      }
      if (card.suit === 'H') return `deck +${this.powerCount(card)}`;
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
        const next = htmlToEl(cardHTML(card, { selected, badge: this.cardBadge(card) }));
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
      for (let i = g.hand.length; i < g.config.handMax; i++) {
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
      const recent = this.game.logs.slice(-14).reverse();
      this.el.log.innerHTML = recent.map((l) => `<div class="${l.kind}">${l.text}</div>`).join('');
    }

    // Seleção atual: soma, cartas, poderes de ♥/♠ e a escolha do coringa. No combate não
    // mostra o texto de andar.
    selectionHTML(combat) {
      const g = this.game;
      const cards = g.handCards(this.sel) || [];
      const sum = g.selectionSum(this.sel);
      // Soma exata: bate com o custo de uma carta do inimigo (combate) ou de uma porta/baú ao lado.
      // É a melhor jogada (compra 1 carta), então o box inteiro ganha destaque.
      let exact = false;
      if (cards.length) {
        if (combat) {
          const enemy = g.combatEnemy();
          exact = Boolean(enemy) && enemy.cards.some((c) => !enemy.down.includes(c.id) && !isHiddenCard(enemy, c) && c.rank === sum);
        } else {
          exact = g.adjacentTargets().some((t) => t.obj.cost.rank === sum);
        }
      }
      const star = exact ? '<span class="exact-tag">★ soma exata · +1 carta</span>' : '';
      let html = `<h3>Seleção · soma ${sum}${star}</h3><div class="row">${cards.map(miniChip).join('')}</div>`;

      if (cards.length === 1) {
        const c = cards[0];
        if (!combat) {
          const range = g.walkRange(c);
          let why = '';
          if (c.suit === 'D') why = ` (${c.rank} × 2 do ♦)`;
          else if (c.suit === 'C' && g.jokerTarget(c)) why = ` (coringa copia ${label(g.jokerTarget(c))})`;
          html += `<p><b>Andar:</b> até ${range} casa(s)${why}.</p>`;
        }
      }

      for (const joker of cards.filter((c) => c.suit === 'C')) {
        const others = g.hand.filter((c) => c.id !== joker.id);
        if (!others.length) continue;
        const current = g.jokerTarget(joker);
        html += `<div class="row"><span>♣ vale:</span><button class="btn small ${current ? '' : 'on'}" data-joker="${joker.id}" data-target="">${joker.rank} (própria)</button><span>ou copia</span>${others
          .map(
            (o) =>
              `<button class="btn small ${current && current.id === o.id ? 'on' : ''}" data-joker="${joker.id}" data-target="${o.id}">${label(o)}</button>`,
          )
          .join('')}</div>`;
      }
      return { html, sum, cards, exact };
    }

    // Botão do poder (♥ e ♠) ao lado esquerdo da mão: aparece quando 1 carta dessas está escolhida.
    // O botão Poder (♥ e ♠): fica ao lado da mão e também dentro da janela de combate.
    powerHTML() {
      const g = this.game;
      const cards = g.status === 'playing' ? g.handCards(this.sel) || [] : [];
      const c = cards.length === 1 ? cards[0] : null;
      let body;
      if (c && (c.suit === 'H' || c.suit === 'S')) {
        const n = this.powerCount(c);
        const what = c.suit === 'H' ? `Devolver ${n} ao deck` : `Comprar ${n} carta${n === 1 ? '' : 's'}`;
        body = `<button class="btn power-btn ${c.suit === 'H' ? 'red' : ''}" data-act="power" ${n ? '' : 'disabled'} title="${what}">
          <b>${sym(c.suit)}</b><span>Usar poder</span><small>${n ? what : 'sem efeito agora'}</small></button>`;
      } else {
        body = '<div class="power-empty">Escolha uma carta ♥ ou ♠ para usar o poder</div>';
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
      if (!cards.length) {
        panel.innerHTML = `<h3>Sua vez</h3>
          <p>Selecione cartas da mão:</p>
          <p class="muted">• <b>1 carta</b> anda (${this.isTouch() ? 'toque numa casa dourada para ver o caminho e de novo para andar' : 'clique numa casa dourada'}) ou usa o poder do naipe.<br>
          • <b>Cartas somadas</b> abrem portas e baús ao seu lado.</p>`;
        return;
      }

      const { html: selHTML, sum, exact } = this.selectionHTML(false);
      panel.classList.toggle('exact', exact);
      let html = selHTML;

      const targets = g.adjacentTargets();
      if (!targets.length) {
        html += '<p class="muted">Fique ao lado de uma porta ou baú fechado para abri-lo.</p>';
      } else {
        for (const t of targets) {
          const cost = t.obj.cost.rank;
          const name = t.kind === 'door' ? 'Porta' : 'Baú';
          let status;
          if (sum === cost) status = '<span class="tag exact">soma exata · compra 1 carta</span>';
          else if (sum > cost) status = '<span class="tag ok">abre · sem compra</span>';
          else status = `<span class="tag no">faltam ${cost - sum}</span>`;
          html += `<p><b>${name}</b> custo ${miniInline(t.obj.cost)} ${status}<br><span class="muted">${this.isTouch() ? 'Toque' : 'Clique'} nela no mapa para abrir.</span></p>`;
        }
      }
      html += '<button class="btn" data-act="clear">Limpar seleção (Esc)</button>';
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
      const fit = Math.min((rect.width - 24) / f.w, (rect.height - 24) / f.h);
      this.tile = Number.isFinite(fit) && fit > 0 ? Math.max(20, Math.min(140, Math.floor(fit * ZOOMS[this.zoom]))) : 40;
      // Andar de treino: o mapa inteiro cabe sempre, ocupando no máximo metade da altura da área
      // (o resto, em cima, fica livre para os textos). O zoom escolhido não vale aqui.
      if (g.tutorial) this.tile = Math.max(24, Math.min(96, Math.floor(Math.min((rect.width - 48) / f.w, (rect.height * 0.5) / f.h))));
      this.el.mapWrap.classList.toggle('tutorial-map', g.tutorial);
      const art = this.artActive();
      // Com a arte, a casa é múltiplo de 8 px: a pixel art de 16 px fica nítida.
      if (art) this.tile = Math.max(24, Math.floor(this.tile / 8) * 8);

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
          const treasure = cell.room !== null && f.rooms[cell.room].kind === 'treasure' ? ' treasure' : '';
          let cls = 't-void';
          let inner = '';
          let title = '';
          switch (shown ? cell.type : 'void') {
            case 'wall':
              cls = 't-wall';
              break;
            case 'floor': {
              cls = `t-floor${alt}${treasure}`;
              const enemy = (f.enemies || []).find((e) => !e.dead && e.x === x && e.y === y);
              if (enemy) {
                const left = remainingEnemyCards(enemy);
                cls += ' t-enemy zone';
                const facedown = left.filter((c) => isHiddenCard(enemy, c)).length;
                inner =
                  (art ? `<i class="sprite enemy-sprite k-${enemy.kind}"></i>` : ENEMY_SVG) +
                  `<span class="enemy-cards${left.length > 2 ? ' many' : ''}">${left.map((c) => (isHiddenCard(enemy, c) ? MINI_BACK : miniHTML(c))).join('')}</span>`;
                title = `Inimigo (${left.length} carta${left.length === 1 ? '' : 's'}${facedown ? `, ${facedown} virada${facedown === 1 ? '' : 's'}` : ''}): entrar na zona vermelha começa um combate`;
              } else if (DC.enemyAt(f, x, y)) {
                cls += ' zone';
                title = 'Zona de ataque: entrar aqui começa um combate';
              }
              break;
            }
            case 'start':
              cls = 't-floor start';
              inner = art ? '' : '▲';
              title = 'Escada de entrada';
              break;
            case 'exit':
              cls = 't-floor exit';
              inner = art ? '' : '▼';
              title = 'Escada de saída';
              break;
            case 'door': {
              const d = f.doors[cell.ref];
              cls = `t-door ${d.orient}${d.open ? ' open' : ''}${justOpened(d.open)}`;
              inner = d.open ? '' : miniHTML(d.cost);
              title = d.open ? 'Porta aberta' : `Porta: custo ${DC.rankLabel(d.cost.rank)}`;
              break;
            }
            case 'chest': {
              const c = f.chests[cell.ref];
              cls = `t-floor t-chest${alt}${treasure}${justOpened(c.open)}`;
              inner = (art ? `<i class="sprite chest-sprite${c.open ? ' open' : ''}"></i>` : CHEST_SVG(c.open)) + (c.open ? '' : miniHTML(c.cost));
              title = c.open ? 'Baú aberto' : `Baú: custo ${DC.rankLabel(c.cost.rank)}`;
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
      // escura de 3 casas em volta, para a borda não ficar presa no canto da tela.
      const gap = PAN_GAP * this.tile;
      const axis = (size, total, pos, dragged) => {
        if (total <= size) return (size - total) / 2;
        if (dragged === null) return Math.min(0, Math.max(size - total, size / 2 - (pos + 0.5) * this.tile));
        return Math.min(gap, Math.max(size - total - gap, dragged));
      };
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      let tx = axis(w, f.w * this.tile, x, this.view ? this.view.tx : null);
      let ty = axis(h, f.h * this.tile, y, this.view ? this.view.ty : null);
      if (this.game.tutorial) {
        // Posição fixa: centralizado na horizontal e na parte de baixo da área, com folga em cima.
        tx = (w - f.w * this.tile) / 2;
        ty = Math.max(0, h - f.h * this.tile - h * 0.17);
        this.view = null;
      }
      this.camera = { tx, ty };
      wrap.classList.toggle('pannable', !this.game.tutorial && (f.w * this.tile > w || f.h * this.tile > h));
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

      if (this.sel.length === 1) {
        this.reachMap = g.reachFor(this.sel[0]);
        for (const [key, node] of this.reachMap) {
          if (node.dist > 0) this.tileEls[key].classList.add('reach');
        }
      }
      const sum = this.sel.length ? g.selectionSum(this.sel) : null;
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
      if (step.id === 'move') return c.selected ? null : 'hand';
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
      else if (kind === 'chest') html = this.chestHTML();
      else if (kind === 'combat') html = this.combatHTML();
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
            this.floatText('+1 carta', c.x, c.y - 90, 'gold');
            this.sound('ding', 0.4);
          }, 1250);
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
          const tag = extra ? 'Carta extra: soma exata!' : floorStart ? 'Novo andar' : 'Sala nova';
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
      else if (g.hand.length >= g.config.handMax) note = `Sua mão está cheia (${g.config.handMax}): nenhuma carta nova desta vez.`;
      else note = 'O seu deck acabou: não há cartas para ganhar.';
      return `<div class="modal reveal">
        <h2>${title}</h2>
        <p>${note}</p>
        <div class="reveal-row">${slots}</div>
        <div class="summary">Mão: ${g.hand.length} → ${g.hand.length + gain.length}/${g.config.handMax} · deck: ${g.playerDeck.length - gain.length}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-refill">${gain.length ? 'Pegar as cartas' : 'Continuar'}</button></div>
      </div>`;
    }

    // Combate: cartas do inimigo em cima (cada uma é como uma porta), sua mão embaixo.
    combatHTML() {
      const g = this.game;
      const enemy = g.combatEnemy();
      const { html: selHTML, sum, cards, exact } = this.selectionHTML(true);
      const flipped = this.revealIds;
      this.revealIds = [];
      const enemyRow = enemy.cards
        .map((c) => {
          if (isHiddenCard(enemy, c)) {
            return `<div class="card back dungeon enemy-card hidden" data-ov="hidden-card" data-id="${c.id}" title="Carta virada de costas"><span class="badge">virada</span></div>`;
          }
          const down = enemy.down.includes(c.id);
          let state = '';
          let badge = `custo ${c.rank}`;
          if (down) badge = 'derrotada';
          else if (cards.length) {
            state = sum === c.rank ? ' exact' : sum > c.rank ? ' ok' : ' no';
            badge = sum === c.rank ? 'soma exata · +1 carta' : sum > c.rank ? 'derruba' : `faltam ${c.rank - sum}`;
          }
          const html = cardHTML(c, { badge, extra: `enemy-card${down ? ' down' : ''}${state}${flipped.includes(c.id) ? ' flip' : ''}` });
          return down ? html : html.replace('class="card', 'data-ov="attack" class="card');
        })
        .join('');
      const handRow = g.hand
        .map((c) =>
          cardHTML(c, { selected: this.sel.includes(c.id), badge: this.cardBadge(c) }).replace('class="card', 'data-ov="combat-toggle" class="card'),
        )
        .join('');
      const last = g.hand.length === 1;
      const pick = cards.length === 1 ? cards[0] : null;
      const fleeLabel = pick
        ? `Fugir descartando ${label(pick)}${last ? ' (é a sua última carta: você perde)' : ''}`
        : 'Fugir (escolha 1 carta para descartar)';
      const hit = this.foeHit;
      this.foeHit = false;
      const stash = g.slotsOpen
        ? `<div class="combat-stash"><div class="stash-row modal-stash">${this.slotsInner()}</div><h4>Inventário ${g.stash.length}/${g.slotsOpen}</h4></div>`
        : '<div></div>';
      return `<div class="modal combat">
        <h2>⚔ Combate!</h2>
        <p class="combat-help">${this.isTouch() ? 'Toque' : 'Escolha'} cartas da mão cuja <b>soma</b> seja pelo menos o custo de <b>uma</b> carta do inimigo e ${this.isTouch() ? 'toque' : 'clique'} nela para derrubá-la. <b>Soma exata</b> compra 1 carta; derrotar todas as ${enemy.cards.length} compra 1 e vence.</p>
        <div class="combat-foe">
          <div class="foe-box">
            <div class="foe"><i class="sprite enemy-sprite k-${enemy.kind}${hit ? ' hit' : ''}"></i></div>
            <span class="foe-name">${ENEMY_NAME[enemy.kind] || 'Inimigo'}</span>
          </div>
          <div class="cardrow enemy-row">${enemyRow}</div>
        </div>
        <div class="combat-mine">
          <div class="combat-power power">${this.powerHTML()}</div>
          <div class="combat-hand">
            <div class="cardrow">${handRow || '<p class="muted">Sua mão está vazia.</p>'}</div>
            <h4>Sua mão</h4>
          </div>
          ${stash}
        </div>
        <div class="combat-sel${exact ? ' exact' : ''}">${cards.length ? selHTML : '<p class="muted">Escolha cartas da mão. Poderes de ♥ e ♠ funcionam aqui.</p>'}</div>
        <div class="actions">
          <button class="btn ${last && pick ? 'danger' : ''}" data-ov="flee" ${pick ? '' : 'disabled'}>${fleeLabel}</button>
          <button class="btn" data-act="clear" ${cards.length ? '' : 'disabled'}>Limpar seleção</button>
        </div>
      </div>`;
    }

    chestHTML() {
      const g = this.game;
      const options = g.pending.options;
      const picks = [...this.picks].filter((id) => options.some((c) => c.id === id));
      const out = [...this.discard].filter((id) => g.hand.some((c) => c.id === id));
      const finalHand = g.hand.length - out.length + picks.length;
      const valid = finalHand <= g.config.handMax;
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
        <h4>Sua mão ${finalHand > g.config.handMax ? '· está cheia: marque cartas para descartar' : '(marque para descartar, se quiser)'}</h4>
        <div class="cardrow">${g.hand.length ? this.handRow('toggle-discard', this.discard) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        ${this.stashModalHTML()}
        <div class="summary">Levando ${picks.length} · descartando ${out.length} · mão final ${finalHand}/${g.config.handMax}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-chest" ${valid ? '' : 'disabled'}>${picks.length ? `Levar ${picks.length} carta(s)` : 'Não levar nada'}</button></div>
      </div>`;
    }

    endHTML(won) {
      const g = this.game;
      if (g.tutorial) {
        return `<div class="modal ${won ? 'win' : 'lose'}">
          <h2>${won ? 'Treino concluído!' : 'Sem ações possíveis'}</h2>
          <p>${won ? 'Agora é a masmorra de verdade: 5 andares, inimigos e muito naipe.' : 'Acabaram as cartas do treino. Tente de novo, desta vez com mais calma.'}</p>
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
            ? `Os ${g.config.floors} andares ficaram para trás.`
            : `Você ficou sem cartas para fazer o próximo movimento no andar ${g.floorNo}.`
        }</p>
        <div class="summary">Deck: ${g.playerDeck.length} · mão: ${g.hand.length} · descarte: ${g.discard.length} · seed ${g.seed}</div>
        <div class="playtest">
          <h4>Playtest (opcional)</h4>
          ${DC.TUTORIAL_TEXT.questions
            .map((q) => `<label>${q.label}<input type="text" data-note="${q.id}" maxlength="200" autocomplete="off" value="${(this.notes[q.id] || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" /></label>`)
            .join('')}
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
        <p>Desça os 5 andares até a escada de saída (▼). Sua <b>vida é o deck + a mão</b>: se não restar nenhuma ação possível, você perde.</p>
        <h4>Cartas</h4>
        <ul>
          <li><b>Andar:</b> use 1 carta; o número é o alcance máximo em casas (A=1, J=11, Q=12, K=13). Só anda na vertical e horizontal. O que sobrar do movimento se perde.</li>
          <li><b>Abrir portas e baús:</b> fique ao lado, selecione cartas cuja soma seja pelo menos o custo. <b>Soma exata</b> compra 1 carta de graça; soma maior apenas abre.</li>
          <li><b>Baú:</b> mostra 5 cartas do seu deck, você leva até 2 e o resto volta ao deck.</li>
          <li>Toda carta usada vai para o <b>descarte</b>.</li>
        </ul>
        <h4>Poderes (o número da carta é a intensidade)</h4>
        <ul>
          <li><b>♥ Copas:</b> devolve N cartas aleatórias do descarte ao deck.</li>
          <li><b>♠ Espadas:</b> compra até N cartas (mão máxima de 5).</li>
          <li><b>♦ Ouros:</b> ao andar, o número vale em dobro.</li>
          <li><b>♣ Paus:</b> coringa. Vale o próprio número, mas você pode escolher copiar o rank de outra carta da mão.</li>
        </ul>
        <h4>Névoa</h4>
        <p>Você só enxerga a sala em que está e as salas cujas portas já abriu. Não dá para saber onde fica a escada de saída: é preciso gastar cartas explorando. O botão "Névoa" no topo (ou a tecla F) liga e desliga, útil para testar.</p>
        <h4>Zoom</h4>
        <p>Os botões + e − no canto do mapa (ou as teclas + e −) aproximam e afastam. Com zoom perto, o mapa acompanha o seu personagem; em 100% você vê a masmorra inteira. Para olhar outras salas, <b>arraste o mapa</b> (em qualquer ponto, inclusive na parte escura). O botão ◎ ao lado do zoom (ou a tecla C) volta para o personagem, e a câmera também volta sozinha quando ele anda.</p>
        <h4>Inimigos</h4>
        <p>Um inimigo parado guarda uma sala, com <b>2 cartas</b> (<b>3 nos andares mais fundos</b>, os de foice e de manto): cada uma é como o custo de uma porta, mas <b>uma delas começa virada de costas</b> e só aparece quando você derruba outra. Há uma <b>zona vermelha</b> ao redor: a maioria tem 1 casa de alcance, mas <b>uns 30% têm alcance 2</b> e podem trancar a sala, aí só dá para passar lutando (ou fugindo). Os inimigos gastam as cartas que sobram no deck da dungeon depois das portas e dos baús, então o contador "Cartas da dungeon" mostra o que ainda cobra algo (portas, baús e cartas de inimigos). Se o seu caminho entra na zona, o movimento é cortado e começa o <b>combate</b>: escolha cartas da mão cuja soma seja pelo menos o custo de uma carta dele e derrube-a (soma exata compra 1 carta); os poderes de ♥ e ♠ funcionam ali. Derrotando as 2 cartas você vence e compra 1 carta. Dá para <b>fugir</b> descartando 1 carta (você volta para fora da zona e as cartas já derrubadas continuam derrubadas), mas se for a sua última carta você perde.</p>
        <h4>Pergaminho de Inventário</h4>
        <p>Cada inimigo tem <b>30% de chance</b> de deixar um pergaminho <b>no lugar da carta de vitória</b>, e <b>30% dos baús</b> o guardam <b>no lugar das cartas</b>. Você já começa com <b>1 slot de brinde</b>, e cada pergaminho abre mais um (até 3 no total) ao lado da mão, onde você <b>guarda cartas</b> para usar depois. Para guardar, escolha 1 carta da mão e toque num slot livre (no baú, marque a carta e toque no slot: ela é guardada em vez de descartada). Toque na carta guardada para devolvê-la à mão. Guardar e devolver é grátis, a qualquer momento, até em combate, mas para <b>usar</b> a carta ela precisa estar na mão (o limite de 5 continua). Se a mão esvaziar mas houver cartas nos slots, você ainda não perdeu.</p>
        <h4>No iPad (toque)</h4>
        <p>Toque numa carta para escolher (toque de novo para soltar). Toque numa casa dourada para <b>ver o caminho</b> e toque <b>de novo na mesma casa</b> para andar, assim um toque errado não gasta a carta. Toque numa porta ou baú ao seu lado para abrir. <b>Arraste o mapa com o dedo</b> para olhar outras salas; o botão ◎ volta para o personagem.</p>
        <h4>Salas novas</h4>
        <p>Ao abrir a porta de uma sala nova (ou ao descer de andar) você ganha ${this.game.config.refillDraw} carta do seu deck, sem passar do limite de ${this.game.config.handMax} na mão: ela aparece de costas e vira. Se a porta foi aberta com soma exata, você ainda ganha mais uma carta de graça, que vira junto.</p>
        <h4>Atalhos</h4>
        <p>Teclas 1–5 selecionam cartas da mão; Esc limpa a seleção; F liga/desliga a névoa; E liga/desliga os efeitos; M liga/desliga o som; A alterna a arte de pixel art; + e − aproximam e afastam o mapa; C centraliza no personagem.</p>
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
