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

  // O zoom é um múltiplo do tamanho que faz a masmorra inteira caber na tela.
  const ZOOMS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const DEFAULT_ZOOM = 3; // índice em ZOOMS: 1.75x
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
      this.tensionOn = false;
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
      this.bind();
      const seed = new URLSearchParams(location.search).get('seed');
      this.newGame(seed);
    }

    resetOverlayState() {
      this.discard = new Set();
      this.picks = new Set();
    }

    newGame(seed) {
      this.game = new DC.Game({ seed: seed === null || seed === undefined ? undefined : seed });
      window.game = this.game;
      try {
        history.replaceState(null, '', `?seed=${encodeURIComponent(this.game.seed)}`);
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
      this.resetOverlayState();
      this.renderAll();
    }

    bind() {
      document.getElementById('btn-new').addEventListener('click', () => this.newGame());
      document.getElementById('btn-fog').addEventListener('click', () => this.toggleFog());
      document.getElementById('btn-fx').addEventListener('click', () => this.toggleFx());
      document.getElementById('btn-sound').addEventListener('click', () => this.toggleSound());
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
      document.getElementById('btn-center').addEventListener('click', () => this.centerCamera());
      this.bindPan();
      document.getElementById('btn-zoom-in').addEventListener('click', () => this.changeZoom(1));
      document.getElementById('btn-zoom-out').addEventListener('click', () => this.changeZoom(-1));
      document.getElementById('btn-help').addEventListener('click', () => {
        this.help = true;
        this.renderOverlay();
      });
      this.el.hand.addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        if (card) this.toggleCard(card.dataset.id);
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
      this.el.overlay.addEventListener('click', (e) => this.onOverlayClick(e));
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
      if (e.key === 'Escape') {
        if (this.help) {
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

    // Prévia do caminho até uma casa (no mouse vem do hover; no toque, do primeiro toque).
    showPath(x, y) {
      this.clearPath();
      const f = this.game.floor;
      if (!this.reachMap || !this.reachMap.has(y * f.w + x)) return;
      for (const p of DC.pathTo(f, this.reachMap, x, y)) this.tileEls[p.y * f.w + p.x].classList.add('path');
      this.tileEls[y * f.w + x].classList.add('path-end');
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
      for (const node of this.el.hand.querySelectorAll('.card.sel')) {
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
      if (this.busy || !this.game.canAct()) return;
      const at = this.sel.indexOf(id);
      if (at >= 0) this.sel.splice(at, 1);
      else this.sel.push(id);
      this.sound(at >= 0 ? 'deselect' : 'select');
      this.refreshSelection();
    }

    refreshSelection() {
      this.renderHand();
      this.renderPanel();
      this.updateHighlights();
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
        // de reposição espera os efeitos terminarem.
        this.fxExit = { rect };
        this.fxOrigin = { x, y };
        this.fxHold = res.exact || res.kind === 'chest' ? 750 : 350;
        this.sel = [];
        this.renderAll();
        this.openFx(res, rect);
        this.openSound(res);
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
      const f = this.game.floor;
      const x = Number(tile.dataset.x);
      const y = Number(tile.dataset.y);
      if (!this.reachMap.has(y * f.w + x)) return;
      for (const p of DC.pathTo(f, this.reachMap, x, y)) this.tileEls[p.y * f.w + p.x].classList.add('path');
    }

    clearPath() {
      for (const el of this.el.map.querySelectorAll('.path, .path-end')) el.classList.remove('path', 'path-end');
    }

    onOverlayClick(e) {
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
          const res = g.resolveRefill([...this.discard]);
          if (!res.ok) return this.toast(res.error);
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
        case 'restart-same':
          this.newGame(g.seed);
          break;
        case 'restart-new':
          this.newGame();
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
      this.renderMap();
      this.updateHighlights();
      // Depois de abrir porta ou baú, o modal espera as cartas chegarem.
      const hold = this.fxOn ? this.fxHold : 0;
      this.fxHold = 0;
      clearTimeout(this.overlayTimer);
      if (hold) this.overlayTimer = setTimeout(() => this.renderOverlay(), hold);
      else this.renderOverlay();
    }

    renderSide() {
      const g = this.game;
      this.el.floor.textContent = `Andar ${g.floorNo} / ${g.config.floors}`;
      this.el.seed.textContent = `seed ${g.seed}`;
      this.renderPiles();
      this.renderHand();
      this.renderPanel();
      this.renderLog();
      this.syncTension();
    }

    renderPiles() {
      const g = this.game;
      const top = g.discard[g.discard.length - 1];
      const pile = (name, count, stack) =>
        `<div class="pile"><div class="stack">${stack}</div><b>${count}</b>${name}</div>`;
      this.el.piles.innerHTML =
        pile('Seu deck (vida)', g.playerDeck.length, g.playerDeck.length ? '<div class="card back small"></div>' : '<div class="empty"></div>') +
        pile('Descarte', g.discard.length, top ? cardHTML(top, { small: true, extra: 'static' }) : '<div class="empty"></div>') +
        pile('Deck da dungeon', g.dungeonDeck.length, g.dungeonDeck.length ? '<div class="card back dungeon small"></div>' : '<div class="empty"></div>');

      // O contador "pula" quando muda. O do descarte espera a carta chegar.
      const counts = [g.playerDeck.length, g.discard.length, g.dungeonDeck.length];
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
    }

    // Quantas cartas o poder de ♥ (devolver) ou ♠ (comprar) mexeria agora.
    powerCount(card) {
      const g = this.game;
      if (card.suit === 'H') return Math.min(card.rank, g.discard.length);
      return Math.min(card.rank, g.config.handMax - (g.hand.length - 1), g.playerDeck.length);
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
        let badge = '';
        if (card.suit === 'D') badge = `anda ${card.rank * 2}`;
        else if (card.suit === 'C') {
          const copied = g.jokerTarget(card);
          badge = copied ? `copia ${copied.rank}` : `vale ${card.rank}`;
        }
        else if (card.suit === 'H') badge = `deck +${this.powerCount(card)}`;
        else if (card.suit === 'S') badge = `compra ${this.powerCount(card)}`;
        const next = htmlToEl(cardHTML(card, { selected, badge }));
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
      const deck = fx ? this.pileRect(0) : null;
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

    renderPanel() {
      const g = this.game;
      const panel = this.el.panel;
      if (g.status !== 'playing') {
        panel.innerHTML = '<h3>Fim de jogo</h3>';
        return;
      }
      const cards = g.handCards(this.sel) || [];
      if (!cards.length) {
        panel.innerHTML = `<h3>Sua vez</h3>
          <p>Selecione cartas da mão:</p>
          <p class="muted">• <b>1 carta</b> anda (${this.isTouch() ? 'toque numa casa dourada para ver o caminho e de novo para andar' : 'clique numa casa dourada'}) ou usa o poder do naipe.<br>
          • <b>Cartas somadas</b> abrem portas e baús ao seu lado.</p>`;
        return;
      }

      const sum = g.selectionSum(this.sel);
      let html = `<h3>Seleção · soma ${sum}</h3><div class="row">${cards.map(miniChip).join('')}</div>`;

      if (cards.length === 1) {
        const c = cards[0];
        const range = g.walkRange(c);
        let why = '';
        if (c.suit === 'D') why = ` (${c.rank} × 2 do ♦)`;
        else if (c.suit === 'C' && g.jokerTarget(c)) why = ` (coringa copia ${label(g.jokerTarget(c))})`;
        html += `<p><b>Andar:</b> até ${range} casa(s)${why}.</p>`;
        if (c.suit === 'H') {
          const n = this.powerCount(c);
          html += `<button class="btn" data-act="power" ${n ? '' : 'disabled'}>Usar ♥: devolver ${n} carta(s) do descarte ao deck</button>`;
        } else if (c.suit === 'S') {
          const n = this.powerCount(c);
          html += `<button class="btn" data-act="power" ${n ? '' : 'disabled'}>Usar ♠: comprar ${n} carta(s)</button>`;
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
            case 'floor':
              cls = `t-floor${alt}${treasure}`;
              break;
            case 'start':
              cls = 't-floor start';
              inner = '▲';
              title = 'Escada de entrada';
              break;
            case 'exit':
              cls = 't-floor exit';
              inner = '▼';
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
              inner = CHEST_SVG(c.open) + (c.open ? '' : miniHTML(c.cost));
              title = c.open ? 'Baú aberto' : `Baú: custo ${DC.rankLabel(c.cost.rank)}`;
              break;
            }
          }
          const delay = sweep ? ` style="animation-delay:${sweep}ms"` : '';
          html += `<div class="tile ${cls}${fresh ? ' reveal' : ''}" data-x="${x}" data-y="${y}"${title ? ` title="${title}"` : ''}${delay}>${inner}</div>`;
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
      const tx = axis(w, f.w * this.tile, x, this.view ? this.view.tx : null);
      const ty = axis(h, f.h * this.tile, y, this.view ? this.view.ty : null);
      this.camera = { tx, ty };
      wrap.classList.toggle('pannable', f.w * this.tile > w || f.h * this.tile > h);
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
      for (const el of this.tileEls) el.classList.remove('reach', 'path', 'path-end', 'open-ok', 'open-exact', 'open-no', 'open-hint');
      this.reachMap = null;
      if (g.status !== 'playing' || g.pending || this.busy) return;

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

    // ---------- janelas ----------

    renderOverlay() {
      const g = this.game;
      const root = this.el.overlay;
      let html = '';
      let kind = '';
      if (this.help) kind = 'help';
      else if (this.busy) kind = '';
      else if (g.status === 'won' || g.status === 'lost') kind = g.status;
      else if (g.pending) kind = g.pending.type;
      // Os efeitos de entrada tocam só quando a janela aparece, e não a cada clique dentro dela.
      this.overlayFresh = kind !== this.lastOverlay;
      this.lastOverlay = kind;

      if (kind === 'help') html = this.helpHTML();
      else if (kind === 'won') html = this.endHTML(true);
      else if (kind === 'lost') html = this.endHTML(false);
      else if (kind === 'refill') html = this.refillHTML();
      else if (kind === 'chest') html = this.chestHTML();

      root.hidden = !html;
      root.innerHTML = html;
      if (!html || !this.overlayFresh) return;
      root.querySelector('.modal').classList.add('enter');
      if (kind === 'chest') {
        this.chestFx();
        this.sound('chest');
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

    refillHTML() {
      const g = this.game;
      const out = [...this.discard].filter((id) => g.hand.some((c) => c.id === id));
      const keep = g.hand.length - out.length;
      const draws = Math.min(g.config.refillDraw, g.config.handMax - keep, g.playerDeck.length);
      const floorStart = g.pending.reason === 'floor';
      const title = floorStart ? `Andar ${g.floorNo}` : 'Porta aberta: sala nova!';
      return `<div class="modal">
        <h2>${title}</h2>
        <p>Marque as cartas que quer <b>descartar</b> (se quiser) e você compra <b>${g.config.refillDraw} ${g.config.refillDraw === 1 ? 'carta' : 'cartas'}</b>, sem passar do limite de ${g.config.handMax} na mão.</p>
        <div class="cardrow">${g.hand.length ? this.handRow('toggle-discard', this.discard) : '<p class="muted">Sua mão está vazia.</p>'}</div>
        <div class="summary">Descartando ${out.length} · comprando ${draws} · mão final ${keep + draws}/${g.config.handMax} · deck: ${g.playerDeck.length}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-refill">Repor mão</button></div>
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
        <div class="summary">Levando ${picks.length} · descartando ${out.length} · mão final ${finalHand}/${g.config.handMax}</div>
        <div class="actions"><button class="btn primary" data-ov="confirm-chest" ${valid ? '' : 'disabled'}>${picks.length ? `Levar ${picks.length} carta(s)` : 'Não levar nada'}</button></div>
      </div>`;
    }

    endHTML(won) {
      const g = this.game;
      return `<div class="modal ${won ? 'win' : 'lose'}">
        <h2>${won ? 'Você escapou da masmorra!' : 'Sem ações possíveis'}</h2>
        <p>${
          won
            ? `Os ${g.config.floors} andares ficaram para trás.`
            : `Você ficou sem cartas para fazer o próximo movimento no andar ${g.floorNo}.`
        }</p>
        <div class="summary">Deck: ${g.playerDeck.length} · mão: ${g.hand.length} · descarte: ${g.discard.length} · seed ${g.seed}</div>
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
        <h4>No iPad (toque)</h4>
        <p>Toque numa carta para escolher (toque de novo para soltar). Toque numa casa dourada para <b>ver o caminho</b> e toque <b>de novo na mesma casa</b> para andar, assim um toque errado não gasta a carta. Toque numa porta ou baú ao seu lado para abrir. <b>Arraste o mapa com o dedo</b> para olhar outras salas; o botão ◎ volta para o personagem.</p>
        <h4>Salas novas</h4>
        <p>Ao abrir a porta de uma sala nova (ou ao descer de andar) você pode descartar cartas e então compra ${this.game.config.refillDraw}, sem passar do limite de ${this.game.config.handMax} na mão. Se a porta foi aberta com soma exata, você ainda ganha mais uma carta de graça.</p>
        <h4>Atalhos</h4>
        <p>Teclas 1–5 selecionam cartas da mão; Esc limpa a seleção; F liga/desliga a névoa; E liga/desliga os efeitos; M liga/desliga o som; + e − aproximam e afastam o mapa; C centraliza no personagem.</p>
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
