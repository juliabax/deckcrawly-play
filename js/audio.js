(function (root) {
  const DC = root.DC || (root.DC = {});

  // Sons sintetizados na hora com a Web Audio API: não há arquivos de áudio.
  // Cada som é uma função (b, t, arg) que agenda notas e ruídos a partir do
  // instante t, usando o construtor b criado por makeBuilder.

  function makeBuilder(ctx, out) {
    let noiseBuf = null;
    const noiseBuffer = () => {
      if (!noiseBuf) {
        const len = Math.floor(ctx.sampleRate);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      return noiseBuf;
    };
    // Sobe até o pico e desce até quase zero (rampa exponencial nunca vai a 0 exato).
    // O piso de 0.001 (-60 dB) evita que a subida seja tão íngreme que o pico nunca apareça.
    const envelope = (g, t, attack, dur, peak) => {
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    };
    return {
      tone(t, { freq, to, dur = 0.12, type = 'sine', gain = 0.15, attack = 0.008 }) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
        envelope(g, t, attack, dur, gain);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.03);
      },
      noise(t, { dur = 0.1, type = 'bandpass', freq = 2000, to, q = 1, gain = 0.15, attack = 0.008 }) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer();
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(freq, t);
        if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = ctx.createGain();
        envelope(g, t, attack, dur, gain);
        src.connect(filter);
        filter.connect(g);
        g.connect(out);
        src.start(t, Math.random() * 0.4);
        src.stop(t + dur + 0.03);
      },
    };
  }

  // Volume geral + um limitador suave (curva tanh): sons baixos passam intactos e
  // vários sons ao mesmo tempo não estouram. (O compressor do navegador reduzia
  // demais os sons curtos, por isso não é usado.)
  function makeMaster(ctx) {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.5 * x) / 1.5;
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    master.connect(shaper);
    shaper.connect(ctx.destination);
    return master;
  }

  const SOUNDS = {
    // escolher / soltar uma carta da mão
    select: (b, t) => b.tone(t, { freq: 880, to: 660, dur: 0.05, type: 'triangle', gain: 0.12 }),
    deselect: (b, t) => b.tone(t, { freq: 520, to: 400, dur: 0.05, type: 'triangle', gain: 0.12 }),

    // carta comprada (um "fléc" de papel) e carta que vai para o descarte
    draw: (b, t) => {
      b.noise(t, { dur: 0.09, type: 'bandpass', freq: 3200, to: 1800, q: 0.8, gain: 0.26 });
      b.tone(t + 0.05, { freq: 420, to: 300, dur: 0.05, gain: 0.05 });
    },
    discard: (b, t) => {
      b.noise(t, { dur: 0.14, type: 'lowpass', freq: 1600, to: 400, gain: 0.24 });
      b.tone(t + 0.1, { freq: 170, to: 90, dur: 0.1, gain: 0.16 });
    },

    // abrir porta ou baú
    stamp: (b, t) => {
      b.tone(t, { freq: 150, to: 60, dur: 0.16, type: 'triangle', gain: 0.28 });
      b.noise(t, { dur: 0.06, type: 'lowpass', freq: 900, gain: 0.2 });
    },
    creak: (b, t) => b.noise(t, { dur: 0.35, type: 'bandpass', freq: 260, to: 520, q: 2, gain: 1 }),
    ding: (b, t) => {
      [880, 1320, 1760].forEach((freq, i) => b.tone(t + i * 0.02, { freq, dur: 0.7 - i * 0.15, gain: 0.13 / (i + 1) + 0.03 }));
    },
    chest: (b, t) => {
      [659, 784, 988, 1319, 1568].forEach((freq, i) => b.tone(t + i * 0.07, { freq, dur: 0.35, type: 'triangle', gain: 0.1 }));
      b.noise(t + 0.3, { dur: 0.5, type: 'highpass', freq: 6000, gain: 0.04 });
    },

    // jogada recusada
    error: (b, t) => {
      b.tone(t, { freq: 170, to: 120, dur: 0.16, type: 'square', gain: 0.1 });
      b.tone(t + 0.09, { freq: 140, to: 100, dur: 0.16, type: 'square', gain: 0.1 });
    },

    // andar: passinho (o tom varia um pouco) e o deslize do ♦
    step: (b, t) => b.noise(t, { dur: 0.05, type: 'bandpass', freq: 400 + Math.random() * 250, q: 0.7, gain: 0.4 }),
    swoosh: (b, t) => b.noise(t, { dur: 0.28, type: 'bandpass', freq: 500, to: 3000, q: 1, gain: 0.7 }),

    // poderes dos naipes
    heart: (b, t) => {
      [523, 659, 784].forEach((freq, i) => b.tone(t + i * 0.09, { freq, dur: 0.4, gain: 0.09 }));
    },
    blip: (b, t, i = 0) => b.tone(t, { freq: 600 + i * 45, to: 700 + i * 45, dur: 0.07, gain: 0.12 }),
    spade: (b, t) => {
      b.noise(t, { dur: 0.18, type: 'highpass', freq: 2500, to: 6000, gain: 0.12 });
      b.tone(t, { freq: 300, to: 900, dur: 0.15, type: 'sawtooth', gain: 0.03 });
    },
    joker: (b, t) => {
      [1568, 2093, 1760].forEach((freq, i) => b.tone(t + i * 0.05, { freq, dur: 0.3, type: 'triangle', gain: 0.09 }));
    },

    // momentos grandes
    stairs: (b, t) => {
      b.noise(t, { dur: 0.7, type: 'lowpass', freq: 1200, to: 150, gain: 0.18 });
      b.tone(t, { freq: 196, to: 98, dur: 0.7, type: 'triangle', gain: 0.1 });
    },
    win: (b, t) => {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => b.tone(t + i * 0.12, { freq, dur: 0.5, type: 'triangle', gain: 0.12 }));
      [523, 659, 784].forEach((freq) => b.tone(t + 0.65, { freq, dur: 1.2, gain: 0.07 }));
    },
    lose: (b, t) => {
      [392, 349, 311, 262].forEach((freq, i) => b.tone(t + i * 0.22, { freq, to: freq * 0.96, dur: 0.5, type: 'triangle', gain: 0.11 }));
    },
    heartbeat: (b, t) => {
      b.tone(t, { freq: 70, to: 45, dur: 0.14, gain: 0.3 });
      b.tone(t + 0.2, { freq: 62, to: 40, dur: 0.16, gain: 0.22 });
    },
  };

  class Sfx {
    constructor() {
      this.ctx = null;
      this.builder = null;
      this.enabled = this.load();
    }

    // O som fica ligado por padrão; a escolha é lembrada entre partidas.
    load() {
      try {
        return root.localStorage.getItem('deckcrawly.sound') !== '0';
      } catch (e) {
        return true;
      }
    }

    setEnabled(on) {
      this.enabled = on;
      try {
        root.localStorage.setItem('deckcrawly.sound', on ? '1' : '0');
      } catch (e) {
        /* sem armazenamento: vale só nesta sessão */
      }
    }

    // Navegadores só liberam áudio depois de um clique ou tecla do jogador.
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AudioCtx = root.AudioContext || root.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.builder = makeBuilder(this.ctx, makeMaster(this.ctx));
      // iOS/iPadOS só libera o áudio se algo for tocado dentro do gesto do jogador.
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const silent = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = silent;
      src.connect(this.ctx.destination);
      src.start(0);
    }

    play(name, delay = 0, arg) {
      const sound = SOUNDS[name];
      if (!this.enabled || !this.ctx || !sound) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      sound(this.builder, this.ctx.currentTime + delay + 0.005, arg);
    }
  }

  DC.SOUNDS = SOUNDS;
  DC.makeSoundBuilder = makeBuilder;
  DC.makeSoundMaster = makeMaster;
  DC.Sfx = Sfx;
})(typeof window !== 'undefined' ? window : globalThis);
