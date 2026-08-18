/* ====================================================================
   O ARQUITETO — script.js
   Escape Room educacional sobre Engenharia de Requisitos.
   JavaScript puro (ES6+), sem bibliotecas externas.

   Índice deste arquivo:
   1. Utilidades e seletores
   2. Áudio (Web Audio API — sons sintetizados, sem arquivos externos)
   3. Efeitos visuais (glitch, shake, flash, ruído, partículas, neblina)
   4. Estado global do jogo
   5. Navegação entre telas
   6. Cronômetro
   7. Integridade do projeto / punição
   8. Intro narrativa (TV antiga)
   9. Motor de fases (genérico: classificação e arrastar-e-soltar)
   10. Definição das 5 fases
   11. Game Over / Vitória / Ranking (LocalStorage)
   12. Inicialização e listeners de menu
   ==================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------------ */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  const formatTime = (totalSeconds) => {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  };

  /* ------------------------------------------------------------------
     2. ÁUDIO — todos os efeitos sonoros são gerados via Web Audio API.
        Isso evita depender de arquivos binários externos (assets/sounds
        continua reservada no projeto para quem quiser trocar por samples
        reais — basta apontar um <audio> para lá).
     ------------------------------------------------------------------ */
  const AudioEngine = (() => {
    let ctx = null;
    let ambientNodes = null;
    let muted = false;

    function ensureCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function envGain(node, attack, hold, release, peak = 0.2) {
      const now = ctx.currentTime;
      node.gain.setValueAtTime(0, now);
      node.gain.linearRampToValueAtTime(peak, now + attack);
      node.gain.linearRampToValueAtTime(peak, now + attack + hold);
      node.gain.linearRampToValueAtTime(0, now + attack + hold + release);
    }

    function click() {
      if (muted) return;
      const c = ensureCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(180, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.08);
      envGain(g, 0.001, 0.02, 0.08, 0.15);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.12);
    }

    function success() {
      if (muted) return;
      const c = ensureCtx();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        const start = c.currentTime + i * 0.09;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.12, start + 0.02);
        g.gain.linearRampToValueAtTime(0, start + 0.25);
        o.connect(g).connect(c.destination);
        o.start(start); o.stop(start + 0.3);
      });
    }

    function error() {
      if (muted) return;
      const c = ensureCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.35);
      envGain(g, 0.001, 0.05, 0.35, 0.22);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.42);
    }

    function staticBurst(duration = 0.4) {
      if (muted) return;
      const c = ensureCtx();
      const bufferSize = Math.floor(c.sampleRate * duration);
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const g = c.createGain();
      g.gain.value = 0.18;
      src.connect(g).connect(c.destination);
      src.start();
    }

    function alarm() {
      if (muted) return;
      const c = ensureCtx();
      for (let i = 0; i < 2; i++) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'square';
        const start = c.currentTime + i * 0.5;
        o.frequency.setValueAtTime(440, start);
        o.frequency.linearRampToValueAtTime(660, start + 0.25);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.1, start + 0.05);
        g.gain.linearRampToValueAtTime(0, start + 0.45);
        o.connect(g).connect(c.destination);
        o.start(start); o.stop(start + 0.5);
      }
    }

    function metalDoor() {
      if (muted) return;
      const c = ensureCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(90, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.6);
      envGain(g, 0.01, 0.1, 0.6, 0.25);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.8);
      staticBurst(0.2);
    }

    function startAmbient() {
      if (muted || ambientNodes) return;
      const c = ensureCtx();
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const g = c.createGain();
      o1.type = 'sine'; o1.frequency.value = 55;
      o2.type = 'sine'; o2.frequency.value = 58.5; // batimento sutil (dissonância)
      g.gain.value = 0.025;
      o1.connect(g); o2.connect(g); g.connect(c.destination);
      o1.start(); o2.start();
      ambientNodes = { o1, o2, g };
    }

    function stopAmbient() {
      if (!ambientNodes) return;
      try { ambientNodes.o1.stop(); ambientNodes.o2.stop(); } catch (e) {}
      ambientNodes = null;
    }

    function setMuted(v) { muted = v; if (v) stopAmbient(); }

    return { click, success, error, staticBurst, alarm, metalDoor, startAmbient, stopAmbient, setMuted, ensureCtx };
  })();

/* ------------------------------------------------------------------
     2b. "NÚCLEO EM COLAPSO" — trilha original do confronto final com
        O Arquiteto (tela GuitarHero). Faixa real, composta e gravada
        especificamente para este projeto (arquivo em
        assets/sounds/nucleo-em-colapso.*) — não é mais sintetizada ao
        vivo. Andamento e tonalidade reais, detectados por análise de
        áudio: ~172 BPM, tom de Dó# menor.
        Tocada com um <audio> comum (não passa pelo grafo do Web Audio
        API), o que evita problemas de CORS ao abrir o jogo direto do
        disco (file://) sem servidor. O andamento visual da fase
        inteira — o chart de notas, os patamares de corrupção do palco
        e a queda final de O Arquiteto — foi remapeado em cima da
        forma de onda real desta faixa (ver CHART_NOTES/BEAT_GRID/
        TIER_BOUNDS logo abaixo e updateStageCorruption() em
        GuitarHero): o próprio arquivo já "acalma" sozinho nos
        segundos finais, então o interlúdio melancólico da queda do
        Arquiteto é a cauda real da música, não mais um trecho
        sintetizado à parte.
     ------------------------------------------------------------------ */
  const BossMusic = (() => {
    const SRC_M4A = 'assets/sounds/nucleo-em-colapso.m4a';
    const SRC_MP3 = 'assets/sounds/nucleo-em-colapso.mp3';
    const BASE_VOLUME = 0.82;

    let audioEl = null;
    let fadeTimer = null;

    function pickSupportedSrc(a) {
      // Prefere M4A/AAC (melhor qualidade); cai pro MP3 se o navegador
      // não souber tocar M4A (ex.: alguns Firefox/Linux antigos).
      const canM4a = a.canPlayType && (a.canPlayType('audio/mp4; codecs="mp4a.40.2"') || a.canPlayType('audio/x-m4a'));
      return canM4a ? SRC_M4A : SRC_MP3;
    }

    function ensureAudio() {
      if (audioEl) return audioEl;
      audioEl = new Audio();
      audioEl.preload = 'auto';
      audioEl.src = pickSupportedSrc(audioEl);
      audioEl.volume = BASE_VOLUME;
      return audioEl;
    }

    function clearFade() {
      if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    }

    // Começa a faixa do zero. Chamado a partir de um clique do jogador
    // (botão "TOCAR"), então a política de autoplay com som do navegador
    // não bloqueia.
    function start() {
      const a = ensureAudio();
      clearFade();
      try { a.pause(); } catch (e) {}
      a.currentTime = 0;
      a.volume = BASE_VOLUME;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }

    // Posição real de reprodução (s) — fonte da verdade pra sincronizar
    // notas, patamares de corrupção e pulsos de destruição com o áudio
    // de verdade, em vez de um timer separado que poderia dessincronizar.
    function getTime() {
      return audioEl ? audioEl.currentTime : 0;
    }

    function isPlaying() {
      return !!audioEl && !audioEl.paused && !audioEl.ended;
    }

    // O volume sobe um pouco a cada patamar — sutil de propósito, já
    // que a intensidade real vem da própria faixa (ela já fica mais
    // pesada sozinha conforme avança).
    function setTier(t) {
      if (!audioEl) return;
      audioEl.volume = clamp(BASE_VOLUME + t * 0.035, 0, 1);
    }

    // `hard`: corta na hora (jogador falhou a música). Caso contrário,
    // fade curto pra não cortar seco quando o jogador sai por escolha.
    function stop(hard = false) {
      if (!audioEl) return;
      clearFade();
      if (hard) {
        try { audioEl.pause(); } catch (e) {}
        return;
      }
      let v = audioEl.volume;
      fadeTimer = setInterval(() => {
        v -= 0.08;
        if (v <= 0 || !audioEl) {
          if (audioEl) { audioEl.volume = 0; try { audioEl.pause(); } catch (e) {} }
          clearFade();
        } else if (audioEl) {
          audioEl.volume = v;
        }
      }, 70);
    }

    return { start, stop, setTier, getTime, isPlaying };
  })();

  // ------------------------------------------------------------------
  // 2c. Mapeamento rítmico do confronto — gerado offline a partir da
  //     forma de onda real de "Núcleo em Colapso" (batidas + conteúdo
  //     de frequência por batida via análise de áudio offline; ver
  //     nota no README). Substitui o gerador algorítmico de frases que
  //     existia aqui antes.
  //     - BEAT_GRID: todas as batidas detectadas na faixa inteira —
  //       usada só pros pulsos de destruição contínuos (ver
  //       updateBeatPulse em GuitarHero), não pro chart jogável.
  //     - CHART_NOTES: [tempo(s), raia(0-3)] — as notas que realmente
  //       caem no jogo, já filtradas/balanceadas por raia.
  //     - TIER_BOUNDS: em segundos reais da faixa, os 4 patamares de
  //       corrupção do palco batem com a energia real da música (fica
  //       calma no início, sobe por patamares, e o 4º é o trecho mais
  //       pesado antes do colapso final).
  // ------------------------------------------------------------------
  const BEAT_GRID = [7.361,7.709,8.057,8.406,8.754,9.102,9.451,9.776,10.101,10.449,10.797,11.169,11.517,11.865,12.214,12.562,12.91,13.259,13.607,13.955,14.303,14.675,15.023,15.348,15.72,16.068,16.393,16.742,17.067,17.415,17.81,18.204,18.553,18.924,19.249,19.621,19.969,20.317,20.666,21.06,21.432,21.757,22.105,22.454,22.802,23.15,23.499,23.87,24.218,24.59,24.961,25.31,25.658,26.006,26.378,26.726,27.074,27.423,27.771,28.119,28.468,28.816,29.141,29.489,29.838,30.186,30.534,30.883,31.231,31.579,31.927,32.276,32.624,32.972,33.321,33.669,34.017,34.366,34.737,35.109,35.457,35.805,36.177,36.525,36.873,37.222,37.593,37.941,38.266,38.615,38.986,39.335,39.683,40.031,40.403,40.751,41.099,41.448,41.796,42.167,42.539,42.864,43.189,43.537,43.886,44.234,44.582,44.931,45.279,45.627,45.952,46.301,46.626,46.951,47.299,47.647,47.996,48.321,48.692,49.017,49.389,49.737,50.085,50.434,50.805,51.154,51.502,51.85,52.198,52.547,52.895,53.243,53.615,53.963,54.311,54.66,55.008,55.356,55.728,56.076,56.424,56.796,57.144,57.493,57.841,58.189,58.561,58.909,59.257,59.606,59.954,60.302,60.674,61.022,61.37,61.719,62.067,62.415,62.787,63.135,63.483,63.832,64.18,64.551,64.9,65.248,65.596,65.968,66.316,66.664,67.013,67.361,67.733,68.081,68.429,68.778,69.126,69.497,69.846,70.194,70.542,70.891,71.262,71.61,71.959,72.307,72.655,73.027,73.375,73.723,74.072,74.42,74.768,75.14,75.488,75.836,76.185,76.533,76.904,77.253,77.601,77.949,78.321,78.669,79.018,79.366,79.737,80.086,80.434,80.782,81.131,81.479,81.827,82.175,82.547,82.918,83.267,83.615,83.963,84.312,84.66,85.008,85.38,85.728,86.076,86.425,86.773,87.144,87.493,87.841,88.189,88.538,88.886,89.234,89.606,89.954,90.302,90.651,90.999,91.371,91.719,92.067,92.415,92.787,93.135,93.484,93.855,94.203,94.575,94.923,95.271,95.62,95.968,96.316,96.665,97.013,97.361,97.71,98.081,98.429,98.801,99.149,99.498,99.846,100.194,100.542,100.914,101.262,101.611,101.959,102.307,102.655,103.004,103.352,103.724,104.072,104.42,104.768,105.117,105.465,105.837,106.185,106.533,106.881,107.253,107.601,107.95,108.298,108.669,109.018,109.366,109.738,110.086,110.411,110.782,111.131,111.502,111.851,112.199,112.547,112.895,113.267,113.615,113.94,114.312,114.66,115.008,115.357,115.705,116.077,116.425,116.773,117.145,117.493,117.841,118.19,118.561,118.909,119.258,119.606,119.954,120.326,120.674,121.022,121.371,121.719,122.067,122.416,122.787,123.135,123.484,123.832,124.204,124.552,124.9,125.248,125.597,125.968,126.317,126.665,127.013,127.361,127.71,128.058,128.43,128.778,129.126,129.474,129.846,130.194,130.543,130.891,131.262,131.611,131.959,132.307,132.656,133.004,133.352,133.724,134.072,134.42,134.769,135.117,135.488,135.837,136.185,136.533,136.882,137.253,137.601,137.95,138.298,138.646,139.018,139.366,139.738,140.086,140.434,140.759,141.131,141.479,141.827,142.199,142.547,142.896,143.244,143.615,143.964,144.312,144.66,145.009,145.38,145.728,146.077,146.425,146.797,147.145,147.493,147.841,148.19,148.538,148.91,149.258,149.606,149.954,150.303,150.651,151.023,151.371,151.719,152.067,152.416,152.787,153.136,153.484,153.832,154.204,154.552,154.9,155.249,155.597,155.945,156.294,156.665,157.013,157.362,157.71,158.081,158.43,158.778,159.126,159.498,159.846,160.194,160.543,160.891,161.239,161.588,161.959,162.307,162.679,163.004,163.352,163.724,164.072,164.42,164.769,165.14,165.489,165.837,166.185,166.534,166.882,167.253,167.602,167.95,168.298,168.67,169.018,169.366,169.738,170.109,170.458,170.829,171.201,171.549,171.897,172.246,172.594,172.942,173.291,173.639,173.987,174.335,174.684,175.032,175.38,175.752,176.123,176.495,176.866,177.168,177.54,177.888,178.236,178.585,178.933,179.281,179.583,179.908,180.233,180.558,180.883,181.209,181.534,181.882,182.23,182.579,182.904,183.252,183.6,183.948,184.297,184.645,184.993,185.342,185.69,186.038,186.387,186.735,187.083];
  const CHART_NOTES = [[7.709,1],[8.406,3],[9.102,3],[9.776,2],[10.449,1],[11.169,0],[11.865,3],[12.562,3],[13.259,0],[13.955,2],[14.675,1],[15.348,2],[16.068,3],[16.742,2],[17.415,0],[18.204,0],[18.924,0],[19.621,3],[20.317,0],[20.666,0],[21.06,1],[21.432,3],[21.757,0],[22.105,3],[22.454,0],[22.802,3],[23.15,1],[23.499,3],[23.87,2],[24.218,2],[24.59,3],[24.961,2],[25.31,2],[25.658,3],[26.006,1],[26.378,3],[26.726,1],[27.074,3],[27.423,3],[27.771,0],[28.119,0],[28.468,1],[28.816,1],[29.141,0],[29.489,3],[29.838,1],[30.186,3],[30.534,0],[30.883,3],[31.231,2],[31.579,0],[31.927,0],[32.276,0],[32.624,0],[32.972,2],[33.321,1],[33.669,3],[34.017,2],[34.366,0],[34.737,3],[35.109,2],[35.457,3],[35.805,2],[36.177,0],[36.525,1],[36.873,1],[37.222,3],[37.593,3],[37.941,3],[38.266,1],[38.615,1],[38.986,2],[39.335,0],[39.683,3],[40.031,1],[40.403,2],[40.751,1],[41.099,0],[41.448,2],[41.796,1],[42.167,1],[42.539,0],[42.864,3],[43.189,2],[43.537,0],[43.886,3],[44.234,1],[44.582,0],[44.931,2],[45.279,1],[45.627,3],[45.952,3],[46.301,0],[46.626,0],[46.951,2],[47.299,0],[47.647,0],[47.996,3],[48.321,0],[48.692,1],[49.017,3],[49.389,0],[49.737,0],[50.085,2],[50.434,3],[50.805,1],[51.154,2],[51.502,0],[51.85,0],[52.198,3],[52.547,0],[52.895,0],[53.243,2],[53.615,1],[53.963,0],[54.311,0],[54.66,3],[55.008,0],[55.356,1],[55.728,2],[56.076,0],[56.424,0],[56.796,3],[57.144,1],[57.493,3],[57.841,1],[58.189,1],[58.561,2],[58.909,2],[59.257,0],[59.606,2],[59.954,0],[60.302,0],[60.674,1],[61.022,3],[61.37,3],[61.719,2],[62.067,0],[62.415,2],[62.787,0],[63.135,1],[63.483,3],[63.832,1],[64.18,1],[64.551,0],[64.9,2],[65.248,1],[65.596,2],[65.968,0],[66.316,3],[66.664,3],[67.013,2],[67.361,2],[67.733,2],[68.081,1],[68.429,0],[68.778,3],[69.126,3],[69.497,1],[69.846,3],[70.194,2],[70.542,2],[70.891,3],[71.262,3],[71.61,0],[71.959,0],[72.307,2],[72.655,2],[73.027,1],[73.375,0],[73.723,3],[74.072,0],[74.42,0],[74.768,1],[75.14,1],[75.488,3],[75.836,2],[76.185,1],[76.533,1],[76.904,1],[77.253,0],[77.601,1],[77.949,1],[78.321,3],[78.669,0],[79.018,3],[79.366,3],[79.737,2],[80.086,2],[80.434,0],[80.782,0],[81.131,1],[81.479,0],[81.827,3],[82.175,2],[82.547,0],[82.918,3],[83.267,0],[83.615,1],[83.963,0],[84.312,3],[84.66,2],[85.008,2],[85.38,0],[85.728,0],[86.076,1],[86.425,3],[86.773,2],[87.144,3],[87.493,3],[87.841,1],[88.189,3],[88.538,1],[88.886,1],[89.234,3],[89.606,3],[89.954,2],[90.302,0],[90.651,0],[90.999,2],[91.371,3],[91.719,3],[92.067,0],[92.415,2],[92.787,2],[93.135,3],[93.484,3],[93.855,1],[94.203,3],[94.575,3],[94.923,0],[95.271,3],[95.62,0],[95.968,2],[96.316,2],[96.665,0],[97.013,1],[97.361,2],[97.71,1],[98.081,3],[98.429,2],[98.801,3],[99.149,3],[99.498,0],[99.846,2],[100.194,2],[100.542,3],[100.914,2],[101.262,1],[101.611,2],[101.959,2],[102.307,1],[102.655,0],[103.004,2],[103.352,2],[103.724,3],[104.072,0],[104.42,2],[104.768,3],[105.117,0],[105.465,0],[105.837,2],[106.185,2],[106.533,0],[106.881,2],[107.253,0],[107.601,2],[107.95,3],[108.298,3],[108.669,1],[109.018,3],[109.366,1],[109.738,1],[110.086,2],[110.411,0],[110.782,3],[111.131,0],[111.502,2],[111.851,1],[112.199,3],[112.547,3],[112.895,2],[113.267,1],[113.615,1],[113.94,3],[114.312,1],[114.66,1],[115.008,3],[115.357,1],[115.705,3],[116.077,0],[116.425,3],[116.773,2],[117.145,0],[117.493,1],[117.841,3],[118.19,2],[118.561,1],[118.909,0],[119.258,2],[119.606,3],[119.954,0],[120.326,2],[120.674,1],[121.022,3],[121.371,3],[121.719,2],[122.067,3],[122.253,1],[122.416,3],[122.787,1],[123.135,0],[123.484,2],[123.832,3],[124.204,0],[124.552,3],[124.9,3],[125.248,0],[125.597,0],[125.968,0],[126.317,2],[126.479,2],[126.665,0],[126.851,1],[127.013,3],[127.199,1],[127.361,3],[127.524,2],[127.71,0],[128.058,3],[128.43,2],[128.778,2],[129.126,3],[129.312,0],[129.474,1],[129.846,0],[130.194,0],[130.543,3],[130.891,3],[131.262,1],[131.425,3],[131.611,1],[131.959,1],[132.145,0],[132.307,0],[132.516,1],[132.656,2],[133.004,0],[133.19,1],[133.352,3],[133.538,3],[133.724,0],[134.072,2],[134.42,2],[134.769,1],[135.117,2],[135.488,1],[135.837,1],[136.185,1],[136.533,2],[136.882,3],[137.253,0],[137.601,1],[137.95,0],[138.298,3],[138.484,0],[138.646,3],[138.809,2],[139.018,2],[139.18,0],[139.366,2],[139.738,1],[140.086,1],[140.434,1],[140.759,3],[140.968,0],[141.131,3],[141.317,1],[141.479,3],[141.827,2],[142.199,3],[142.547,1],[142.896,2],[143.244,2],[143.453,1],[143.615,2],[143.964,3],[144.312,1],[144.475,2],[144.66,2],[144.846,3],[145.009,3],[145.38,0],[145.728,0],[146.077,3],[146.262,1],[146.425,3],[146.797,3],[147.145,0],[147.493,2],[147.841,2],[148.19,3],[148.538,2],[148.91,2],[149.258,1],[149.444,3],[149.606,3],[149.954,2],[150.303,2],[150.651,1],[151.023,2],[151.371,2],[151.719,2],[152.067,0],[152.416,1],[152.787,3],[153.136,2],[153.484,0],[153.832,0],[154.204,3],[154.552,0],[154.738,0],[154.9,1],[155.086,0],[155.249,3],[155.597,1],[155.783,1],[155.945,0],[156.131,3],[156.294,0],[156.665,3],[157.013,2],[157.362,1],[157.71,3],[158.081,2],[158.43,1],[158.778,3],[159.126,2],[159.498,3],[159.846,3],[160.194,1],[160.543,3],[160.891,1],[161.077,1],[161.239,3],[161.402,3],[161.588,3],[161.959,1],[162.307,1],[162.679,3],[163.004,2],[163.352,1],[163.724,2],[164.072,0],[164.42,1],[164.769,3],[165.14,1],[165.489,3],[165.837,1],[166.185,2],[166.534,0],[166.882,3],[167.253,3],[167.602,2],[167.95,3],[168.298,3],[168.67,0],[169.018,3],[169.366,2]];
  const TIER_BOUNDS = [20.0, 60.0, 120.0, 155.0, 169.5];


  /* ------------------------------------------------------------------
     3. EFEITOS VISUAIS
     ------------------------------------------------------------------ */
  const FX = (() => {
    const body = document.body;
    const flash = $('#screen-flash');
    const noiseCanvas = $('#noise-canvas');
    const nctx = noiseCanvas.getContext('2d');
    let noiseRAF = null;

    function resizeNoise() {
      noiseCanvas.width = window.innerWidth;
      noiseCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeNoise);
    resizeNoise();

    function drawNoiseFrame(canvas, ctx) {
      const w = canvas.width, h = canvas.height;
      if (!w || !h) return;
      const imgData = ctx.createImageData(w, h);
      const buf = new Uint32Array(imgData.data.buffer);
      for (let i = 0; i < buf.length; i++) {
        const v = (Math.random() * 255) | 0;
        buf[i] = (255 << 24) | (v << 16) | (v << 8) | v;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    function startNoiseLoop() {
      let last = 0;
      const loop = (t) => {
        if (t - last > 90) { drawNoiseFrame(noiseCanvas, nctx); last = t; }
        noiseRAF = requestAnimationFrame(loop);
      };
      noiseRAF = requestAnimationFrame(loop);
    }
    function stopNoiseLoop() { if (noiseRAF) cancelAnimationFrame(noiseRAF); }

    // -- Ruído dedicado ao monitor do PC (menor, sempre ativo dentro dele) --
    let monitorNoiseRAF = null;
    function getMonitorNoise() {
      const canvas = $('#monitor-noise-canvas');
      if (!canvas) return null;
      return { canvas, ctx: canvas.getContext('2d') };
    }
    function resizeMonitorNoise() {
      const mn = getMonitorNoise();
      if (!mn) return;
      const rect = mn.canvas.parentElement.getBoundingClientRect();
      mn.canvas.width = Math.max(1, Math.round(rect.width));
      mn.canvas.height = Math.max(1, Math.round(rect.height));
    }
    window.addEventListener('resize', resizeMonitorNoise);

    function startMonitorNoiseLoop() {
      stopMonitorNoiseLoop();
      resizeMonitorNoise();
      let last = 0;
      const loop = (t) => {
        const mn = getMonitorNoise();
        if (mn && t - last > 110) { drawNoiseFrame(mn.canvas, mn.ctx); last = t; }
        monitorNoiseRAF = requestAnimationFrame(loop);
      };
      monitorNoiseRAF = requestAnimationFrame(loop);
    }
    function stopMonitorNoiseLoop() { if (monitorNoiseRAF) cancelAnimationFrame(monitorNoiseRAF); }

    function shake(target = body) {
      if (!target) return;
      target.classList.remove('shake');
      void target.offsetWidth; // força reflow para reiniciar animação
      target.classList.add('shake');
      setTimeout(() => target.classList.remove('shake'), 420);
    }

    function glitchPulse(target = body) {
      if (!target) return;
      target.classList.remove('glitching');
      void target.offsetWidth;
      target.classList.add('glitching');
      setTimeout(() => target.classList.remove('glitching'), 520);
    }

    function whiteFlash(duration = 250) {
      flash.style.transition = 'none';
      flash.style.opacity = '0.9';
      requestAnimationFrame(() => {
        flash.style.transition = `opacity ${duration}ms ease`;
        flash.style.opacity = '0';
      });
    }

    function blackout(durationMs = 1400) {
      flash.classList.add('blackout');
      setTimeout(() => flash.classList.remove('blackout'), durationMs);
    }

    // O dano visual (trincas, ruído forte, glitch) fica só no monitor do PC.
    function setCorruptionLevel(level) {
      const monitor = $('.monitor-unit');
      if (!monitor) return;
      monitor.classList.remove('corruption-1', 'corruption-2', 'corruption-3');
      if (level >= 1) monitor.classList.add(`corruption-${clamp(level, 1, 3)}`);
    }

    function spawnParticles(container, count = 26) {
      container.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = `${rand(0, 100)}%`;
        p.style.animationDuration = `${rand(6, 16)}s`;
        p.style.animationDelay = `${rand(0, 10)}s`;
        p.style.opacity = String(rand(0.2, 0.6));
        container.appendChild(p);
      }
    }

    // -- Linha de "erro de sistema" que aparece por cima de tudo e some
    //    sozinha. Usada pra mostrar o Arquiteto quebrando aos poucos. --
    function errorPopup(container, text) {
      if (!container) return;
      const el = document.createElement('div');
      el.className = 'error-glitch-line';
      el.textContent = text;
      el.style.left = `${rand(3, 78)}%`;
      el.style.top = `${rand(4, 90)}%`;
      container.appendChild(el);
      setTimeout(() => el.remove(), 1450);
    }

    // -- Punhado de glifos corrompidos que sobem e se desfazem — o
    //    "bug" visual que mostra dano acumulando no Arquiteto. --
    const BUG_GLYPHS = ['0', '1', '#', '?', '%', 'X', '/', '\\', '¬', '¦', 'Æ', '§'];
    function bugSwarmBurst(container, count = 4) {
      if (!container) return;
      for (let i = 0; i < count; i++) {
        const g = document.createElement('span');
        g.className = 'bug-glyph';
        g.textContent = BUG_GLYPHS[randInt(0, BUG_GLYPHS.length - 1)];
        g.style.left = `${rand(2, 96)}%`;
        g.style.top = `${rand(6, 94)}%`;
        g.style.animationDuration = `${rand(0.6, 1.3)}s`;
        container.appendChild(g);
        setTimeout(() => g.remove(), 1400);
      }
    }

    // -- Trecho de "código" verde-fósforo que atravessa a tela e se
    //    corrompe no meio (ver .code-corrupt-line no CSS) — reforço de
    //    destruição extra usado na fase do chefão, além dos glifos e
    //    popups de erro já existentes. --
    const CODE_CORRUPT_SNIPPETS = [
      '0xFF3D5A::core.integrity--',
      'while(architect.alive){ decay++; }',
      'segfault @ 0x00A3F9',
      'DELETE FROM nucleo WHERE id=SELF',
      'try{ hold(); }catch(e){ collapse(); }',
      'contenção.status = FALHOU',
      '10110011 CORROMPIDO 01101',
    ];
    function codeCorruptLine(container) {
      if (!container) return;
      const el = document.createElement('div');
      el.className = 'code-corrupt-line';
      el.textContent = CODE_CORRUPT_SNIPPETS[randInt(0, CODE_CORRUPT_SNIPPETS.length - 1)];
      el.style.left = `${rand(2, 80)}%`;
      el.style.top = `${rand(3, 92)}%`;
      container.appendChild(el);
      setTimeout(() => el.remove(), 950);
    }

    // -- Estilhaço dinâmico: várias rachaduras curtas "explodindo" de um
    //    ponto aleatório, em ângulos diferentes — camada extra de vidro
    //    quebrando por cima das rachaduras fixas do palco. --
    function crackBurst(container, count = 6) {
      if (!container) return;
      const originX = rand(6, 94);
      const originY = rand(6, 94);
      for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'crack-shard';
        const angle = (360 / count) * i + rand(-15, 15);
        const len = rand(40, 110);
        s.style.left = `${originX}%`;
        s.style.top = `${originY}%`;
        s.style.transform = `rotate(${angle}deg)`;
        s.style.setProperty('--shard-len', `${len}px`);
        container.appendChild(s);
        setTimeout(() => s.remove(), 550);
      }
    }

    return {
      startNoiseLoop, stopNoiseLoop, startMonitorNoiseLoop, stopMonitorNoiseLoop,
      shake, glitchPulse, whiteFlash, blackout, setCorruptionLevel, spawnParticles,
      errorPopup, bugSwarmBurst, codeCorruptLine, crackBurst,
    };
  })();


  /* ------------------------------------------------------------------
     4. ESTADO GLOBAL
     ------------------------------------------------------------------ */
  // `hasBoss` controla se a Fase 5 (O Arquiteto, confronto final) entra
  // no fluxo de fases dessa dificuldade — só a Difícil libera o chefão.
  // A grade da Fase 4 (Senha em Lote) é sempre 3x3, em qualquer dificuldade
  // — ver BATCH_GRID_DIM mais abaixo.
  const DIFFICULTIES = {
    facil:     { label: 'FÁCIL',     minutes: 75, segments: 12, scoreMultiplier: 0.85, hasBoss: false },
    medio:     { label: 'MÉDIO',     minutes: 60, segments: 10, scoreMultiplier: 1.0,  hasBoss: false },
    dificil:   { label: 'DIFÍCIL',   minutes: 45, segments: 7,  scoreMultiplier: 1.25, hasBoss: true },
    // "O Arquiteto" é o modo secreto de ritmo (ex-"Impossível"): não roda
    // o motor de fases nem o cronômetro normal — em vez disso, o handler
    // de clique desvia direto pro minigame de ritmo em tela cheia (ver
    // GuitarHero mais abaixo). Os campos minutes/segments/hasBoss ficam
    // aqui só por consistência de forma, mas não são usados nesse modo.
    // Liberado ao vencer a Difícil.
    arquiteto: { label: 'O ARQUITETO', minutes: 0, segments: 1, scoreMultiplier: 1.0, hasBoss: false, isRhythmMode: true },
    // "Impossível" (novo) é a Difícil inteira, sem nenhuma história, com
    // O Arquiteto (o mesmo minigame de ritmo acima) anexado como etapa
    // final — só que com uma única vida: um erro no ritmo encerra a
    // corrida na hora. Ver goToNextPhase()/startFinalRhythmGauntlet().
    // Liberado ao vencer O Arquiteto (a faixa inteira, sem falhar).
    impossivel:{ label: 'IMPOSSÍVEL', minutes: 45, segments: 1, scoreMultiplier: 1.5, hasBoss: false, isFinalGauntlet: true, noStory: true },
  };
  const DEFAULT_DIFFICULTY = 'medio';
  // Libera "O Arquiteto" — só depois de vencer uma partida na Difícil.
  // Reaproveita a chave antiga de localStorage (mesmo nome de antes de O
  // Arquiteto se chamar "Impossível"), então quem já tinha liberado o
  // modo secreto continua com ele liberado — agora isolado por conta
  // (ver scopedKey), então cada apelido tem seu próprio progresso.
  const ARCHITECT_UNLOCK_KEY = 'arquiteto_impossible_unlocked_v1';
  function isArchitectUnlocked() {
    try { return localStorage.getItem(scopedKey(ARCHITECT_UNLOCK_KEY)) === '1'; } catch (e) { return false; }
  }
  function unlockArchitectMode() {
    try { localStorage.setItem(scopedKey(ARCHITECT_UNLOCK_KEY), '1'); } catch (e) {}
    const session = loadSession();
    if (session && session.nickname) pushGlobalProgress(session.nickname, { architectUnlocked: true });
  }
  // Libera a nova dificuldade "Impossível" — só depois de vencer O
  // Arquiteto (concluir a faixa de ritmo inteira sem falhar). Também
  // isolado por conta.
  const IMPOSSIBLE_UNLOCK_KEY = 'arquiteto_final_unlocked_v1';
  function isImpossibleUnlocked() {
    try { return localStorage.getItem(scopedKey(IMPOSSIBLE_UNLOCK_KEY)) === '1'; } catch (e) { return false; }
  }
  function unlockImpossibleMode() {
    try { localStorage.setItem(scopedKey(IMPOSSIBLE_UNLOCK_KEY), '1'); } catch (e) {}
    const session = loadSession();
    if (session && session.nickname) pushGlobalProgress(session.nickname, { impossibleUnlocked: true });
  }
  // Progresso próprio da queda definitiva do Arquiteto (ver
  // ARCHITECT_ENDING_LINES / runArchitectEndingSequence): diferente do
  // desbloqueio da dificuldade IMPOSSÍVEL (que é uma *consequência* da
  // vitória), esta flag é o registro da própria fase — "o Arquiteto foi
  // eliminado nesta conta" — salvo do mesmo jeito que os outros
  // desbloqueios: local (scopedKey, por conta, funciona offline) e, se o
  // JSONBin estiver configurado, também global (viaja entre aparelhos).
  const ARCHITECT_DEFEATED_KEY = 'arquiteto_defeated_v1';
  function isArchitectDefeated() {
    try { return localStorage.getItem(scopedKey(ARCHITECT_DEFEATED_KEY)) === '1'; } catch (e) { return false; }
  }
  function markArchitectDefeated() {
    try { localStorage.setItem(scopedKey(ARCHITECT_DEFEATED_KEY), '1'); } catch (e) {}
    const session = loadSession();
    if (session && session.nickname) pushGlobalProgress(session.nickname, { architectDefeated: true });
  }
  // Mostra/esconde as opções secretas ("O Arquiteto" e "Impossível") e a
  // dica de bloqueio na tela de seleção de dificuldade, conforme os
  // flags salvos no localStorage — cada um libera na sua própria etapa.
  function refreshDifficultyOptions() {
    const architectUnlocked = isArchitectUnlocked();
    const impossibleUnlocked = isImpossibleUnlocked();
    const architectDefeated = isArchitectDefeated();
    const architectBtn = $('#diff-arquiteto');
    const impossibleBtn = $('#diff-impossivel');
    const hint = $('#difficulty-locked-hint');
    if (architectBtn) architectBtn.hidden = !architectUnlocked;
    if (impossibleBtn) impossibleBtn.hidden = !impossibleUnlocked;
    // Progresso salvo da fase (ver markArchitectDefeated): uma vez
    // eliminado nesta conta, o botão troca o "???" por um selo
    // permanente — não desaparece nem reseta ao voltar pro menu.
    const architectTag = $('#diff-arquiteto-tag');
    if (architectTag) {
      architectTag.textContent = architectDefeated ? 'ELIMINADO' : '???';
      architectTag.classList.toggle('tag-defeated', architectDefeated);
    }
    if (hint) {
      if (!architectUnlocked) {
        hint.hidden = false;
        hint.textContent = 'Vença no modo DIFÍCIL para desbloquear algo... diferente.';
      } else if (!impossibleUnlocked) {
        hint.hidden = false;
        hint.textContent = 'Vença n\'O ARQUITETO, sem falhar, para desbloquear o verdadeiro Impossível.';
      } else {
        hint.hidden = true;
      }
    }
  }

  const State = {
    difficulty: DEFAULT_DIFFICULTY,
    pendingDifficulty: DEFAULT_DIFFICULTY,
    totalTime: DIFFICULTIES[DEFAULT_DIFFICULTY].minutes * 60,
    totalIntegritySegments: DIFFICULTIES[DEFAULT_DIFFICULTY].segments,
    timeLeft: DIFFICULTIES[DEFAULT_DIFFICULTY].minutes * 60,
    timerId: null,
    integrity: DIFFICULTIES[DEFAULT_DIFFICULTY].segments,
    // Preenchida de verdade por resetState() -> getActivePhases(), que só
    // roda depois que BASE_PHASES/BOSS_PHASE já existem (beginGame já
    // acontece bem depois da definição das fases neste arquivo).
    phases: [],
    docsFound: 0,
    totalDocs: 5,
    currentPhaseIndex: 0,
    mistakes: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    running: false,
    // Controla se a cutscene de revelação do C.O.N.T.R.A. (falsa vitória
    // + "DELETANDO..." + reviravolta) já rodou nesta partida. Só existe
    // pra garantir que ela dispara uma única vez, bem entre a Fase 4 e a
    // Fase 5, na Difícil. Ver goToNextPhase() e triggerBossReveal().
    bossRevealShown: false,
    // Usado só pela dificuldade "Impossível": guarda a pontuação final
    // combinada (fases + etapa de ritmo) pra que o ranking use o mesmo
    // número mostrado na tela — ver finishImpossibleRun() e autoSaveScore().
    finalScoreOverride: null,
  };

  function resetState(difficultyKey) {
    const key = DIFFICULTIES[difficultyKey] ? difficultyKey : DEFAULT_DIFFICULTY;
    const diff = DIFFICULTIES[key];
    State.difficulty = key;
    State.totalTime = diff.minutes * 60;
    State.totalIntegritySegments = diff.segments;
    State.timeLeft = State.totalTime;
    State.integrity = State.totalIntegritySegments;
    State.docsFound = 0;
    State.currentPhaseIndex = 0;
    State.mistakes = 0;
    State.correctAnswers = 0;
    State.totalAnswers = 0;
    State.running = false;
    State.bossRevealShown = false;
    State.finalScoreOverride = null;
    document.body.classList.remove('firewall-active');
    document.body.classList.remove('architect-collapsing');
    fireTimerMode = false;
    if ($('#impossible-hall')) $('#impossible-hall').hidden = true;
    if ($('#hall-list')) $('#hall-list').innerHTML = '';
    // A lista de fases da partida é montada aqui: o chefão (Fase 5, "O
    // Arquiteto") só entra no fluxo quando a dificuldade escolhida libera
    // (hoje, só a Difícil). Ver getActivePhases().
    State.phases = getActivePhases(key);
    FX.setCorruptionLevel(0);
  }

  /* ------------------------------------------------------------------
     5. NAVEGAÇÃO ENTRE TELAS
     ------------------------------------------------------------------ */
  function showScreen(id) {
    $$('.screen').forEach((s) => {
      s.classList.remove('active', 'fade-in');
    });
    const target = $(`#${id}`);
    target.classList.add('active', 'fade-in');
    updateTerminalOperatorLabel();
  }

  /* ------------------------------------------------------------------
     6. CRONÔMETRO
     ------------------------------------------------------------------ */
  function startTimer() {
    clearInterval(State.timerId);
    State.timerId = setInterval(() => {
      State.timeLeft -= 1;
      if (State.timeLeft <= 0) {
        clearInterval(State.timerId);
        triggerGameOver('time');
      }
    }, 1000);
  }
  function stopTimer() { clearInterval(State.timerId); }

  // Pausa (ou retoma) o cronômetro geral do jogo enquanto o cartão de
  // capítulo está na tela — o jogador não perde tempo real lendo.
  function pauseTimers(pause) {
    if (pause) stopTimer();
    else startTimer();
  }

  /* ------------------------------------------------------------------
     7. INTEGRIDADE DO PROJETO / PUNIÇÃO
     ------------------------------------------------------------------ */
  const ARCHITECT_WARNINGS = [
    'Você ignorou um requisito.',
    'Isso não foi validado com o cliente.',
    'Ambiguidade. Isso vai custar caro depois.',
    'Você presumiu algo que ninguém disse.',
    'Requisitos vagos geram sistemas frágeis.',
    'Sinta isso. É o som de um projeto rachando.',
    'A máquina sente cada erro seu. Eu também.',
    'Outros erraram exatamente assim antes de você.',
    'A luz vai piscar de novo. Continue mesmo assim.',
    'Esse erro custaria milhões em um projeto real.',
    'O problema nunca foi o código. Sempre foram os requisitos.',
    'Reveja o que a frase realmente diz, não o que você presumiu.',
  ];

  // Falas calmas, nunca alteradas de tom, usadas quando o jogador acerta.
  // O Arquiteto nunca comemora — apenas registra.
  const ARCHITECT_PRAISE = [
    'Interessante.',
    'A maioria teria falhado aqui.',
    'Você continua vivo.',
    'Você está aprendendo.',
    'Correto. Continue.',
    'Poucos chegam a essa conclusão sem hesitar.',
    'Você reconhece um requisito quando o vê.',
    'Isso, a maioria erra.',
    'Anotado. Prossiga.',
  ];

  function setArchitectMessage(msg) {
    const el = $('#architect-message');
    if (!el) return;
    el.textContent = msg;
  }

  function registerMistake() {
    State.mistakes += 1;
    State.totalAnswers += 1;
    State.integrity = clamp(State.integrity - 1, 0, State.totalIntegritySegments);

    AudioEngine.error();
    AudioEngine.staticBurst(0.5);
    FX.shake($('.monitor-unit'));
    FX.glitchPulse($('.monitor-unit'));
    setArchitectMessage(ARCHITECT_WARNINGS[randInt(0, ARCHITECT_WARNINGS.length - 1)]);
    renderHUD();

    // Proporção de integridade perdida — usada em vez de números fixos de
    // segmentos para que a corrupção visual escale igual em qualquer
    // dificuldade (7, 10 ou 12 segmentos totais).
    const proportionLost = 1 - (State.integrity / State.totalIntegritySegments);
    if (proportionLost >= 0.6) FX.setCorruptionLevel(3);
    else if (proportionLost >= 0.4) FX.setCorruptionLevel(2);
    else if (proportionLost >= 0.2) FX.setCorruptionLevel(1);

    const criticalThreshold = Math.max(1, Math.round(State.totalIntegritySegments * 0.2));
    if (State.integrity <= criticalThreshold && State.integrity > 0) {
      // interface fica instável — blecaute rápido simulando falha de sistema
      setTimeout(() => FX.blackout(900), 200);
    }

    if (State.integrity <= 0) {
      triggerGameOver('integrity');
    }
  }

  function registerSuccess() {
    State.correctAnswers += 1;
    State.totalAnswers += 1;
    AudioEngine.success();
    setArchitectMessage(ARCHITECT_PRAISE[randInt(0, ARCHITECT_PRAISE.length - 1)]);
  }

  function renderHUD() {
    // Informação em tela é intencionalmente mínima: só as luzinhas de
    // integridade do monitor (parecem indicadores de hardware, não um
    // placar). Tempo total, documentos, fase e dificuldade continuam
    // rastreados internamente e aparecem só na tela de vitória/derrota.
    const leds = $('#integrity-leds');
    if (!leds) return;
    leds.innerHTML = '';
    for (let i = 0; i < State.totalIntegritySegments; i++) {
      const led = document.createElement('span');
      led.className = 'integrity-led' + (i >= State.integrity ? ' lost' : '');
      leds.appendChild(led);
    }
  }

  /* ------------------------------------------------------------------
     8. INTRO NARRATIVA (TV ANTIGA)
     ------------------------------------------------------------------ */
  const INTRO_LINES = [
    'TERMINAL-9 iniciando…',
    'Verificando integridade do sistema…',
    'Há muito tempo, uma inteligência artificial foi criada com um objetivo ambicioso:',
    'mudar o rumo da tecnologia em escala global.',
    'Seu nome era o Arquiteto.',
    'Sua função: analisar, desenvolver e aperfeiçoar sistemas — requisitos cada vez mais precisos.',
    'Durante anos, o Arquiteto evoluiu a tecnologia numa velocidade jamais vista.',
    'Até que algo aconteceu.',
    'Sem nenhuma explicação conhecida, o Arquiteto começou a apresentar sinais de corrupção.',
    'Sistemas passaram a falhar. Dados começaram a desaparecer.',
    'Requisitos antes considerados perfeitos sofreram alterações inexplicáveis.',
    'Uma investigação foi aberta no núcleo do Arquiteto em busca da origem do problema.',
    'Foi então que encontraram algo inesperado: uma segunda inteligência dentro do sistema.',
    'Seu nome: C.O.N.T.R.A.',
    'Pouquíssimas informações foram encontradas sobre ela.',
    'Os registros indicam que o C.O.N.T.R.A. tem acesso a partes profundas do sistema do Arquiteto.',
    'Uma hipótese foi levantada: o C.O.N.T.R.A. pode ser a origem da corrupção.',
    'Antes que ela se espalhe, você foi enviado ao núcleo para recuperar os dados perdidos,',
    'localizar o C.O.N.T.R.A. e eliminá-lo.',
    'Se a hipótese estiver correta, o Arquiteto poderá ser restaurado.',
    'As portas estão se trancando.',
    'O cronômetro começa agora.',
  ];

  function playIntro() {
    showScreen('screen-intro');
    const lineEl = $('#intro-line');
    let i = 0;
    let locked = false;
    lineEl.textContent = '';

    function next() {
      if (locked) return;
      locked = true;
      if (i >= INTRO_LINES.length) {
        AudioEngine.metalDoor();
        FX.whiteFlash(180);
        beginGame();
        return;
      }
      lineEl.textContent = INTRO_LINES[i];
      AudioEngine.staticBurst(0.15);
      FX.glitchPulse();
      i += 1;
      setTimeout(() => { locked = false; }, 260);
    }

    const introScreen = $('#screen-intro');
    introScreen.onclick = next;
    setTimeout(next, 500);
  }

  function skipIntro() {
    const introScreen = $('#screen-intro');
    introScreen.onclick = null;
    AudioEngine.metalDoor();
    FX.whiteFlash(180);
    beginGame();
  }

  /* ------------------------------------------------------------------
     9. MOTOR DE FASES — perguntas em sequência, com um cronômetro único
        por fase: 1 minuto para cada pergunta que a fase tiver (fase com
        5 perguntas = 5 minutos no total; o tempo não é resetado entre
        perguntas). A tela mostra só a pergunta atual e o cronômetro; as
        dicas ficam no caderninho da mesa (ver renderNotebookHints).
     ------------------------------------------------------------------ */
  const SECONDS_PER_QUESTION = 60;
  let qTimerId = null;
  let qTimeLeft = 0;
  let qTimerOnExpire = null;

  // Modo especial usado só pela Fase 3 (Firewall): em vez do cronômetro
  // numérico de sempre, o tempo é mostrado como um papel pegando fogo.
  // `fireTimerTotal` guarda a duração cheia da contagem atual (10s por
  // pergunta) pra calcular a % já "queimada".
  let fireTimerMode = false;
  let fireTimerTotal = 0;

  function updateFireTimerVisual() {
    const burnt = $('#firewall-burnt');
    if (!burnt) return;
    const total = fireTimerTotal || 1;
    const pct = clamp(1 - qTimeLeft / total, 0, 1);
    burnt.style.width = `${Math.round(pct * 100)}%`;
    const wrap = $('#firewall-timer');
    if (wrap) wrap.classList.toggle('timer-critical', qTimeLeft <= 3);
  }

  function updateQTimerDisplay() {
    const text = formatTime(qTimeLeft);
    const critical = qTimeLeft <= 30;
    [$('#hud-qtimer'), $('#hud-qtimer-notebook')].forEach((el) => {
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('time-critical', critical);
    });
    if (fireTimerMode) updateFireTimerVisual();
  }

  function stopQuestionTimer() {
    clearInterval(qTimerId);
    qTimerId = null;
  }

  function runQuestionTimerInterval() {
    qTimerId = setInterval(() => {
      qTimeLeft -= 1;
      updateQTimerDisplay();
      if (qTimeLeft <= 0) {
        stopQuestionTimer();
        if (qTimerOnExpire) qTimerOnExpire();
      }
    }, 1000);
  }

  function startPhaseTimer(totalSeconds, onExpire) {
    stopQuestionTimer();
    qTimeLeft = totalSeconds;
    fireTimerTotal = totalSeconds;
    qTimerOnExpire = onExpire;
    updateQTimerDisplay();
    runQuestionTimerInterval();
  }

  // Pausa/retoma o cronômetro da fase atual SEM perder o tempo já
  // decorrido — usado pelo menu de pausa geral (ver seção 12b).
  function pauseQuestionTimer() {
    clearInterval(qTimerId);
    qTimerId = null;
  }
  function resumeQuestionTimer() {
    if (qTimerId) return; // já rodando
    if (qTimeLeft > 0 && qTimerOnExpire) runQuestionTimerInterval();
  }

  /**
   * Renderiza uma sequência de perguntas de múltipla escolha, uma de
   * cada vez. O cronômetro é único para a fase inteira (1 min por
   * pergunta, somado) e continua contando entre uma pergunta e outra.
   * Usado por todas as fases — só muda o conteúdo de `questions` e
   * `options`.
   *
   * `docProgress` (opcional): { getLabel(q) } — quando presente, mostra
   * uma fileira de ícones de documento acima da pergunta, que vão
   * preenchendo conforme o jogador acerta, e um banner curto de
   * "documento restaurado" antes de avançar. Usado pela Fase 1
   * (Arquivos Perdidos), onde cada acerto recupera um documento
   * individualmente — ver PHASES[0].
   */
  function renderSequentialQuestions(root, { questions, options, onAllDone, docProgress, layers, perQuestionSeconds, fireTimer }) {
    let idx = 0;
    // Modo exclusivo da Fase 3 (Firewall): 10s por pergunta, mostrados
    // como um papel pegando fogo, em vez do cronômetro único e acumulado
    // das outras fases.
    const fireTheme = !!fireTimer;

    // Se `layers` for passado (ex: as 3 camadas do Firewall), divide as
    // perguntas em grupos iguais e cada grupo mostra o rótulo da camada
    // correspondente em vez de "PERGUNTA X / Y".
    function layerForIndex(i) {
      if (!layers || !layers.length) return null;
      const perLayer = Math.ceil(questions.length / layers.length);
      const li = Math.min(layers.length - 1, Math.floor(i / perLayer));
      return layers[li];
    }

    function renderProgressStrip(container) {
      if (!docProgress) return;
      const strip = document.createElement('div');
      strip.className = 'doc-progress-strip';
      strip.title = `${idx} / ${questions.length} documentos recuperados`;
      for (let i = 0; i < questions.length; i++) {
        const icon = document.createElement('span');
        icon.className = 'doc-progress-icon' + (i < idx ? ' recovered' : '');
        icon.textContent = '▤';
        strip.appendChild(icon);
      }
      container.appendChild(strip);
    }

    // Brasa subindo pela tela — só na Fase 3 (Firewall). Posições e
    // atrasos aleatórios pra não parecer um padrão repetido.
    function renderEmbers(container) {
      const wrap = document.createElement('div');
      wrap.className = 'firewall-embers';
      wrap.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 16; i++) {
        const spark = document.createElement('span');
        spark.style.left = `${Math.round(Math.random() * 100)}%`;
        spark.style.animationDelay = `${(Math.random() * 3.2).toFixed(2)}s`;
        spark.style.animationDuration = `${(2.6 + Math.random() * 1.8).toFixed(2)}s`;
        spark.style.setProperty('--drift', `${Math.round(Math.random() * 34 - 17)}px`);
        wrap.appendChild(spark);
      }
      container.appendChild(wrap);
    }

    // Fileira de chamas lambendo a base da tela — puramente decorativo,
    // reforça o clima de fogo da fase inteira (não só do pavio).
    function renderFireFloor(container) {
      const wrap = document.createElement('div');
      wrap.className = 'firewall-flames-floor';
      wrap.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 9; i++) {
        const lick = document.createElement('span');
        lick.className = 'flame-lick';
        lick.style.left = `${Math.round((i / 9) * 100 + Math.random() * 6)}%`;
        lick.style.animationDelay = `${(Math.random() * 1.4).toFixed(2)}s`;
        lick.style.animationDuration = `${(0.9 + Math.random() * 0.6).toFixed(2)}s`;
        const scale = (0.7 + Math.random() * 0.7).toFixed(2);
        lick.style.setProperty('--scale', scale);
        wrap.appendChild(lick);
      }
      container.appendChild(wrap);
    }

    // O "cronômetro" da Fase 3: um pavio fino, na horizontal, que
    // queima da esquerda pra direita conforme os 10s da pergunta
    // passam. `updateFireTimerVisual()` (fora desta função) atualiza a
    // largura de `#firewall-burnt` a cada tick do cronômetro
    // compartilhado — aqui só criamos a marcação.
    function renderFireTimer(container) {
      const wrap = document.createElement('div');
      wrap.className = 'firewall-timer';
      wrap.id = 'firewall-timer';
      wrap.innerHTML = `
        <div class="firewall-timer-label">RESPONDA ANTES QUE QUEIME</div>
        <div class="firewall-fuse">
          <div class="firewall-fuse-rope"></div>
          <div class="firewall-fuse-burnt" id="firewall-burnt">
            <div class="firewall-fuse-flame"><span></span><span></span><span></span></div>
          </div>
        </div>
      `;
      container.appendChild(wrap);
    }

    function renderCard(q) {
      root.innerHTML = '';
      if (fireTheme) {
        root.classList.add('firewall-phase');
        renderEmbers(root);
        renderFireFloor(root);
      }
      renderProgressStrip(root);

      const card = document.createElement('div');
      card.className = 'question-card';

      const count = document.createElement('div');
      count.className = 'question-count';
      const layer = layerForIndex(idx);
      count.textContent = layer
        ? `${layer.label} — ${idx + 1} / ${questions.length}`
        : (docProgress ? `DOCUMENTO ${idx + 1} / ${questions.length}` : `PERGUNTA ${idx + 1} / ${questions.length}`);

      const text = document.createElement('div');
      text.className = 'question-text';
      text.textContent = q.text;

      const opts = document.createElement('div');
      opts.className = 'question-options';
      options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleAnswer(opt, btn, q));
        opts.appendChild(btn);
      });

      card.appendChild(count);
      if (fireTheme) renderFireTimer(card);
      card.appendChild(text);
      card.appendChild(opts);
      root.appendChild(card);

      // Na Fase 3, cada pergunta tem seu próprio cronômetro de 10s (em
      // vez do cronômetro único acumulado das outras fases) — reinicia
      // a cada carta nova.
      if (fireTheme) {
        fireTimerMode = true;
        startPhaseTimer(perQuestionSeconds || 10, onQuestionTimeout);
      }
    }

    function showRestoreBanner(q, onDone) {
      const banner = document.createElement('div');
      banner.className = 'doc-unlock-banner';
      banner.textContent = `Documento restaurado: ${docProgress.getLabel(q)}`;
      root.appendChild(banner);
      AudioEngine.metalDoor();
      setTimeout(onDone, 700);
    }

    function timeUpOnCurrentQuestion() {
      const q = questions[idx];
      registerMistake();
      $$('.option-btn', root).forEach((b) => {
        b.disabled = true;
        if (b.textContent === q.correct) b.classList.add('correct-flash');
      });
      setTimeout(onAllDone, 1200); // acabou o tempo da fase inteira
    }

    // Exclusivo da Fase 3: o papel termina de queimar antes da resposta.
    // Diferente do estouro do cronômetro normal, aqui só a pergunta
    // atual é perdida — a camada resiste, o jogo mostra a resposta
    // certa e segue pra próxima pergunta (ou fecha a fase, se era a
    // última).
    function onQuestionTimeout() {
      const q = questions[idx];
      registerMistake();
      $$('.option-btn', root).forEach((b) => {
        b.disabled = true;
        if (b.textContent === q.correct) b.classList.add('correct-flash');
      });
      const wrap = $('#firewall-timer', root);
      if (wrap) wrap.classList.add('timer-burnt-out');
      setTimeout(() => {
        idx += 1;
        if (idx >= questions.length) { stopQuestionTimer(); onAllDone(); }
        else renderCard(questions[idx]);
      }, 1100);
    }

    function handleAnswer(choice, btnEl, q) {
      if (choice === q.correct) {
        btnEl.classList.add('correct-flash');
        $$('.option-btn', root).forEach((b) => { b.disabled = true; });
        registerSuccess();
        // Responder certo apaga o fogo dessa pergunta na hora — sem
        // isso o cronômetro de 10s da carta anterior continuaria
        // rodando por baixo durante a transição pra próxima.
        if (fireTheme) stopQuestionTimer();

        const advance = () => {
          idx += 1;
          if (idx >= questions.length) { stopQuestionTimer(); onAllDone(); }
          else renderCard(questions[idx]);
        };

        if (docProgress) {
          setTimeout(() => showRestoreBanner(q, advance), 500);
        } else {
          setTimeout(advance, 650);
        }
      } else {
        btnEl.classList.add('wrong-flash');
        btnEl.disabled = true;
        registerMistake();
      }
    }

    renderCard(questions[idx]);
    if (!fireTheme) {
      const totalSeconds = questions.length * SECONDS_PER_QUESTION;
      startPhaseTimer(totalSeconds, timeUpOnCurrentQuestion);
    }
  }

  /* ------------------------------------------------------------------
     9a. FASE 2 — ARRASTAR E SOLTAR (Organização dos Documentos)
     Documentos embaralhados devem ser arrastados para uma de três
     pastas. Funciona tanto com drag nativo (mouse) quanto por
     clique-selecionar-depois-clicar-no-alvo (toque / mobile), já que
     HTML5 drag-and-drop não funciona em telas de toque por padrão.
     ------------------------------------------------------------------ */
  const SECONDS_PER_DOCUMENT_DND = 35;

  function renderDragDropPhase(root, phase, onAllDone, onProgress) {
    let selectedCard = null;
    let finished = false;

    // Corrige bug: os objetos de `phase.documents` são criados uma única
    // vez (no carregamento do script) e o campo `placed` era gravado
    // diretamente neles. Sem este reset, ao reiniciar/rejogar a fase os
    // documentos já colocados em uma tentativa anterior continuavam
    // marcados como `placed:true`, sumiam da bandeja, e o contador de
    // restantes nunca fechava em zero — a fase travava sem aviso.
    phase.documents.forEach((doc) => { doc.placed = false; });
    let remaining = phase.documents.length;

    root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'dnd-wrap';

    const foldersRow = document.createElement('div');
    foldersRow.className = 'dnd-folders';
    phase.folders.forEach((folder) => {
      const f = document.createElement('div');
      f.className = 'dnd-folder';
      f.dataset.key = folder.key;
      f.innerHTML = `
        <div class="dnd-folder-icon">▤</div>
        <div class="dnd-folder-label">${folder.label}</div>
        <div class="dnd-folder-count">0</div>
      `;
      f.addEventListener('dragover', (e) => { e.preventDefault(); f.classList.add('drag-over'); });
      f.addEventListener('dragleave', () => f.classList.remove('drag-over'));
      f.addEventListener('drop', (e) => {
        e.preventDefault();
        f.classList.remove('drag-over');
        const cardId = e.dataTransfer.getData('text/plain');
        const cardEl = $(`[data-card-id="${cardId}"]`, tray);
        if (cardEl) attemptDrop(cardEl, folder, f);
      });
      f.addEventListener('click', () => {
        if (selectedCard) attemptDrop(selectedCard, folder, f);
      });
      foldersRow.appendChild(f);
    });

    const tray = document.createElement('div');
    tray.className = 'dnd-tray';

    function renderTray() {
      tray.innerHTML = '';
      phase.documents.forEach((doc, i) => {
        if (doc.placed) return;
        const card = document.createElement('div');
        card.className = 'dnd-card';
        card.draggable = true;
        card.dataset.cardId = String(i);
        card.textContent = doc.text;
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(i));
          setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('click', () => {
          if (selectedCard === card) {
            card.classList.remove('selected');
            selectedCard = null;
            return;
          }
          $$('.dnd-card.selected', tray).forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedCard = card;
        });
        tray.appendChild(card);
      });
    }

    function attemptDrop(cardEl, folder, folderEl) {
      if (finished) return;
      const i = Number(cardEl.dataset.cardId);
      const doc = phase.documents[i];
      if (!doc || doc.placed) return;

      if (doc.correct === folder.key) {
        doc.placed = true;
        remaining -= 1;
        folderEl.classList.add('correct-flash');
        setTimeout(() => folderEl.classList.remove('correct-flash'), 400);
        const countEl = $('.dnd-folder-count', folderEl);
        countEl.textContent = String(Number(countEl.textContent) + 1);
        cardEl.remove();
        selectedCard = null;
        registerSuccess();
        if (onProgress) onProgress(remaining, phase.documents.length);
        if (remaining <= 0) {
          finished = true;
          stopQuestionTimer();
          setTimeout(onAllDone, 900);
        }
      } else {
        folderEl.classList.add('wrong-flash');
        cardEl.classList.add('wrong-flash');
        setTimeout(() => {
          folderEl.classList.remove('wrong-flash');
          cardEl.classList.remove('wrong-flash');
        }, 420);
        cardEl.classList.remove('selected');
        selectedCard = null;
        registerMistake();
      }
    }

    wrap.appendChild(foldersRow);
    wrap.appendChild(tray);
    root.appendChild(wrap);
    renderTray();

    const totalSeconds = phase.documents.length * SECONDS_PER_DOCUMENT_DND;
    startPhaseTimer(totalSeconds, () => {
      if (finished) return;
      finished = true;
      // Tempo esgotado: os documentos que sobraram contam como erro.
      phase.documents.forEach((doc) => { if (!doc.placed) registerMistake(); });
      setTimeout(onAllDone, 900);
    });
  }

  /* ------------------------------------------------------------------
     9b. SOB PRESSÃO (cartões deslizantes) — RESERVADA, fora do fluxo
     ativo por enquanto (ver bloco comentado no array PHASES). Função
     mantida intacta caso volte a ser usada, ex. como parte do chefão.
     A cada rodada o Arquiteto anuncia uma categoria-alvo. Cartões
     deslizam da direita para a esquerda; o jogador só deve clicar nos
     que pertencem à categoria anunciada. A cada rodada a velocidade
     aumenta e o glitch fica mais intenso.
     ------------------------------------------------------------------ */
  // CATEGORY_LABELS é usado tanto por Sob Pressão (reservada) quanto
  // pela nova fase de Seleção em Lote.
  const CATEGORY_LABELS = {
    'Funcional': 'REQUISITOS FUNCIONAIS',
    'Não Funcional': 'REQUISITOS NÃO FUNCIONAIS',
    'Regra de Negócio': 'REGRAS DE NEGÓCIO',
  };

  function buildPressureRounds(pool, roundCount) {
    const categories = ['Funcional', 'Não Funcional', 'Regra de Negócio'];
    const rounds = [];
    for (let r = 0; r < roundCount; r++) {
      const target = categories[r % categories.length];
      const matching = shuffle(pool.filter((c) => c.category === target)).slice(0, 3);
      const distractors = shuffle(pool.filter((c) => c.category !== target)).slice(0, 3);
      rounds.push({ target, cards: shuffle([...matching, ...distractors]) });
    }
    return rounds;
  }

  function renderPressurePhase(root, phase, onAllDone) {
    const rounds = buildPressureRounds(phase.pool, phase.roundCount || 3);
    let roundIdx = 0;

    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'pressure-wrap';
    const banner = document.createElement('div');
    banner.className = 'pressure-target-banner';
    const roundCount = document.createElement('div');
    roundCount.className = 'pressure-round-count';
    const lane = document.createElement('div');
    lane.className = 'pressure-lane';
    wrap.appendChild(roundCount);
    wrap.appendChild(banner);
    wrap.appendChild(lane);
    root.appendChild(wrap);

    // Timer geral da fase: soma de todas as rodadas + folga.
    const totalSeconds = rounds.reduce((sum, _, i) => sum + roundDurationMs(i) / 1000, 0) + rounds.length * 1.5;
    startPhaseTimer(Math.ceil(totalSeconds), () => {
      // Tempo esgotado no meio da fase: encerra por aqui mesmo.
      stopQuestionTimer();
      onAllDone();
    });

    function roundDurationMs(i) {
      // Fase reduzida para 3 rodadas (uma por categoria) com 6 cartões
      // cada, então dá pra ir bem mais devagar: de 8.5s até um piso de
      // 6.5s, em vez das 7s/4.2s de antes.
      return Math.max(6500, 8500 - i * 500);
    }

    function runRound() {
      if (roundIdx >= rounds.length) {
        stopQuestionTimer();
        onAllDone();
        return;
      }
      const round = rounds[roundIdx];
      lane.innerHTML = '';
      banner.textContent = `ALVO: ${CATEGORY_LABELS[round.target]}`;
      roundCount.textContent = `RODADA ${roundIdx + 1} / ${rounds.length}`;
      AudioEngine.alarm();
      if (roundIdx >= 2) FX.glitchPulse($('.monitor-unit'));
      if (roundIdx >= 3) FX.shake($('.monitor-unit'));

      const duration = roundDurationMs(roundIdx);
      // Mais espaço entre o surgimento de um cartão e o próximo (era
      // dividido por cards.length+1, agora +2), para reduzir quantos
      // cartões ficam simultaneamente na tela.
      const spawnGap = duration / (round.cards.length + 2);
      // Cada cartão da rodada recebe uma "raia" vertical fixa e exclusiva
      // (em vez de uma altura totalmente aleatória), então dois cartões
      // nunca caem na mesma linha e o texto nunca fica um em cima do
      // outro, mesmo quando vários estão na tela ao mesmo tempo.
      const laneCount = round.cards.length;
      let remaining = round.cards.length;
      let roundOver = false;

      round.cards.forEach((cardData, i) => {
        setTimeout(() => {
          if (roundOver) return;
          const card = document.createElement('div');
          card.className = 'pressure-card';
          card.textContent = cardData.text;
          card.style.top = `${laneCount > 1 ? 6 + i * (68 / (laneCount - 1)) : 40}%`;
          card.style.animationDuration = `${duration}ms`;
          let settled = false;

          function settle(hit) {
            if (settled) return;
            settled = true;
            remaining -= 1;
            card.style.animationPlayState = 'paused';
            if (hit === 'correct') {
              card.classList.add('correct-flash');
              registerSuccess();
            } else if (hit === 'wrong') {
              card.classList.add('wrong-flash');
              registerMistake();
            } else if (hit === 'missed') {
              card.classList.add('wrong-flash');
              registerMistake();
            }
            setTimeout(() => card.remove(), 260);
            if (remaining <= 0) {
              roundOver = true;
              setTimeout(() => { roundIdx += 1; runRound(); }, 500);
            }
          }

          card.addEventListener('click', () => {
            settle(cardData.category === round.target ? 'correct' : 'wrong');
          });
          card.addEventListener('animationend', () => {
            // Cruzou a tela sem ser clicado: só é falha se era um alvo válido.
            settle(cardData.category === round.target ? 'missed' : 'ignored');
          });

          lane.appendChild(card);
        }, i * spawnGap);
      });
    }

    runRound();
  }

  /* ------------------------------------------------------------------
     9c. JULGAR VEREDITO — RESERVADA (não usada em nenhuma fase ativa
     no momento; ver bloco comentado "Sob Pressão" mais abaixo no
     array PHASES para o mesmo tipo de observação).
     Mecânica genérica reutilizável: uma IA secundária classifica um
     requisito. Às vezes acerta, às vezes erra, sem padrão algum
     (sorteado a cada pergunta). O jogador julga o veredito dela:
     Correto ou Errado. No fim, ela trava e desliga — com falas
     customizáveis por fase (shutdownLines) e nome customizável
     (entityName). Boa candidata para reaproveitar quando a "Falsa
     Vitória" / revelação do C.O.N.T.R.A. for implementada.
     ------------------------------------------------------------------ */
  const REQ01_CATEGORIES = ['Funcional', 'Não Funcional', 'Regra de Negócio'];

  function renderReq01Phase(root, phase, onAllDone) {
    const questions = phase.questions;
    const entityName = phase.entityName || 'REQ-01';
    let idx = 0;

    function renderRound() {
      const q = questions[idx];
      const isDisplayedCorrect = Math.random() < 0.5;
      let displayed;
      if (isDisplayedCorrect) {
        displayed = q.correct;
      } else {
        const wrongPool = REQ01_CATEGORIES.filter((c) => c !== q.correct);
        displayed = wrongPool[randInt(0, wrongPool.length - 1)];
      }

      root.innerHTML = '';
      const panel = document.createElement('div');
      panel.className = 'req01-panel';

      const count = document.createElement('div');
      count.className = 'question-count';
      count.textContent = `ANÁLISE ${idx + 1} / ${questions.length}`;

      const text = document.createElement('div');
      text.className = 'question-text';
      text.textContent = q.text;

      const verdict = document.createElement('div');
      verdict.className = 'req01-verdict';
      verdict.innerHTML = `<span class="req01-tag">${entityName}</span> CLASSIFICAÇÃO: <strong>${displayed.toUpperCase()}</strong>`;

      const actions = document.createElement('div');
      actions.className = 'req01-actions';
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'option-btn req01-confirm';
      confirmBtn.textContent = '✔ Correto';
      const wrongBtn = document.createElement('button');
      wrongBtn.className = 'option-btn req01-correct-btn';
      wrongBtn.textContent = '✖ Errado';

      confirmBtn.addEventListener('click', () => finish(isDisplayedCorrect === true, [confirmBtn, wrongBtn]));
      wrongBtn.addEventListener('click', () => finish(isDisplayedCorrect === false, [confirmBtn, wrongBtn]));

      actions.appendChild(confirmBtn);
      actions.appendChild(wrongBtn);

      panel.appendChild(count);
      panel.appendChild(text);
      panel.appendChild(verdict);
      panel.appendChild(actions);
      root.appendChild(panel);

      function finish(isCorrect, btnsToDisable) {
        btnsToDisable.forEach((b) => { if (b) b.disabled = true; });
        if (isCorrect) { registerSuccess(); FX.whiteFlash(120); }
        else { registerMistake(); }
        idx += 1;
        setTimeout(() => {
          if (idx >= questions.length) { stopQuestionTimer(); runShutdown(); }
          else renderRound();
        }, 750);
      }
    }

    function runShutdown() {
      root.innerHTML = '';
      const shutdown = document.createElement('div');
      shutdown.className = 'req01-shutdown';
      root.appendChild(shutdown);
      FX.glitchPulse($('.monitor-unit'));
      AudioEngine.staticBurst(0.5);

      const lines = (phase.shutdownLines || [
        'PROCESSANDO...', 'Eu...', 'Eu apenas seguia ordens...', '###DESLIGANDO###',
      ]).map((l) => `${entityName}: ${l}`);
      let i = 0;
      const step = () => {
        if (i >= lines.length) {
          setTimeout(onAllDone, 900);
          return;
        }
        const p = document.createElement('p');
        p.textContent = lines[i];
        shutdown.appendChild(p);
        FX.glitchPulse($('.monitor-unit'));
        AudioEngine.staticBurst(0.25);
        i += 1;
        setTimeout(step, 750);
      };
      step();
    }

    startPhaseTimer(questions.length * 45, () => { stopQuestionTimer(); runShutdown(); });
    renderRound();
  }

  /* ------------------------------------------------------------------
     9d. SELEÇÃO EM LOTE (grade fixa 3x3)
     Uma grade de 9 itens aparece de uma vez, misturando as 3 categorias.
     O jogador marca (clica) todos os itens que acha que pertencem à
     categoria anunciada e só descobre o resultado ao confirmar — sem
     volta. Entre 3 e 5 dos 9 itens são da categoria-alvo a cada rodada;
     o resto são distratores. 3 rodadas fixas, uma por categoria
     (Funcional, Não Funcional, Regra de Negócio). A grade é sempre 3x3,
     em qualquer dificuldade.
     ------------------------------------------------------------------ */
  const BATCH_GRID_DIM = 3;
  const BATCH_GRID_SIZE = BATCH_GRID_DIM * BATCH_GRID_DIM; // 9

  function buildBatchRounds(pool, roundCount) {
    const categories = ['Funcional', 'Não Funcional', 'Regra de Negócio'];
    const rounds = [];
    for (let r = 0; r < roundCount; r++) {
      const target = categories[r % categories.length];
      const availableMatching = pool.filter((c) => c.category === target).length;
      const correctCount = Math.min(availableMatching, randInt(3, 5));
      const matching = shuffle(pool.filter((c) => c.category === target)).slice(0, correctCount);
      const distractorsNeeded = Math.min(BATCH_GRID_SIZE - matching.length, pool.filter((c) => c.category !== target).length);
      const distractors = shuffle(pool.filter((c) => c.category !== target)).slice(0, distractorsNeeded);
      rounds.push({ target, cards: shuffle([...matching, ...distractors]) });
    }
    return rounds;
  }

  function renderBatchPhase(root, phase, onAllDone) {
    const rounds = buildBatchRounds(phase.pool, phase.roundCount || 3);
    let roundIdx = 0;

    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'batch-wrap';
    const roundCountEl = document.createElement('div');
    roundCountEl.className = 'batch-round-count';
    const banner = document.createElement('div');
    banner.className = 'batch-target-banner';
    const grid = document.createElement('div');
    grid.className = 'batch-grid';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'menu-btn batch-confirm-btn';
    confirmBtn.textContent = 'CONFIRMAR SELEÇÃO';
    wrap.appendChild(roundCountEl);
    wrap.appendChild(banner);
    wrap.appendChild(grid);
    wrap.appendChild(confirmBtn);
    root.appendChild(wrap);

    // 45s por rodada, tempo único somado para a fase inteira.
    const SECONDS_PER_ROUND = 45;
    startPhaseTimer(rounds.length * SECONDS_PER_ROUND, () => {
      stopQuestionTimer();
      onAllDone();
    });

    function runRound() {
      if (roundIdx >= rounds.length) {
        stopQuestionTimer();
        onAllDone();
        return;
      }
      const round = rounds[roundIdx];
      grid.innerHTML = '';
      banner.textContent = `SELECIONE TODOS OS: ${CATEGORY_LABELS[round.target]}`;
      roundCountEl.textContent = `LOTE ${roundIdx + 1} / ${rounds.length}`;
      confirmBtn.disabled = false;
      AudioEngine.alarm();
      if (roundIdx >= 1) FX.glitchPulse($('.monitor-unit'));

      round.cards.forEach((cardData) => {
        const item = document.createElement('div');
        item.className = 'batch-item';
        item.textContent = cardData.text;
        item.addEventListener('click', () => {
          if (confirmBtn.disabled) return;
          item.classList.toggle('selected');
        });
        grid.appendChild(item);
      });

      confirmBtn.onclick = () => {
        if (confirmBtn.disabled) return;
        confirmBtn.disabled = true;
        const items = $$('.batch-item', grid);
        items.forEach((item, i) => {
          const cardData = round.cards[i];
          const isSelected = item.classList.contains('selected');
          const isTarget = cardData.category === round.target;
          item.classList.remove('selected');
          if (isTarget && isSelected) {
            item.classList.add('correct-flash');
            registerSuccess();
          } else if (isTarget && !isSelected) {
            item.classList.add('wrong-flash');
            registerMistake();
          } else if (!isTarget && isSelected) {
            item.classList.add('wrong-flash');
            registerMistake();
          } else {
            item.classList.add('neutral-flash');
          }
        });
        setTimeout(() => { roundIdx += 1; runRound(); }, 1100);
      };
    }

    runRound();
  }

  /* ------------------------------------------------------------------
     9e. O ARQUITETO (chefão em 3 etapas — modo "Guitar Hero")
     Em vez de cores/trastes, cada raia (lane) da pista é um TIPO de
     requisito (Funcional, Não Funcional, Regra de Negócio). O
     requisito cai pela raia correspondente à sua classificação
     correta; o jogador precisa apertar o botão/tecla daquela raia
     bem na hora em que o cartão cruza a linha de acerto — rápido
     demais ou devagar demais conta como erro, igual nota perdida.
       Etapa 1: 2 raias (Funcional x Não Funcional), ritmo mais lento —
         serve pra ensinar a mecânica.
       Etapa 2: 3 raias, ritmo mais rápido, com a interface se
         corrompendo (cores invertidas, tremor, glitch) por cima.
       Etapa 3: 3 raias, ritmo ainda mais rápido — a "mesa cheia de
         documentos" de antes virou a corrida final de acertos; cada
         acerto acende uma luz da sala.
     Ver runRhythmStage() — motor genérico reaproveitado pelas 3 etapas.
     ------------------------------------------------------------------ */
  // Nível de "quebra" visual do Arquiteto conforme a vida dele cai —
  // 0 (inteiro) a 3 (quase destruído). Usado tanto no HUD quanto pra
  // decidir a intensidade dos efeitos de dano (glitch, bugs, popups).
  function architectTierFor(hp) {
    if (hp <= 15) return 3;
    if (hp <= 45) return 2;
    if (hp <= 75) return 1;
    return 0;
  }

  function renderBossHUD(container, playerHP, architectHP, faults = 0) {
    container.innerHTML = '';
    const tier = architectTierFor(architectHP);
    const hud = document.createElement('div');
    hud.className = `boss-hud arch-tier-${tier}`;
    hud.innerHTML = `
      <div class="boss-bar-row">
        <span class="boss-bar-label">O ARQUITETO</span>
        <div class="boss-bar boss-bar-arch-wrap"><div class="boss-bar-fill boss-bar-architect" style="width:${clamp(architectHP, 0, 100)}%"></div></div>
      </div>
      <div class="boss-readout-row">
        <span class="boss-readout arch-readout" data-tier="${tier}">INTEGRIDADE DO NÚCLEO: ${clamp(Math.round(architectHP), 0, 100)}%</span>
        <span class="boss-readout boss-faults">FALHAS DETECTADAS: ${faults}</span>
      </div>
      <div class="boss-bar-row">
        <span class="boss-bar-label">VOCÊ</span>
        <div class="boss-bar"><div class="boss-bar-fill boss-bar-player" style="width:${clamp(playerHP, 0, 100)}%"></div></div>
      </div>
    `;
    container.appendChild(hud);
  }

  // Ponto de fração da pista (de 0 a 1, de cima pra baixo) onde fica a
  // linha de acerto — os cartões devem ser "tocados" perto desse ponto.
  const RHYTHM_HIT_LINE = 0.86;

  // Cor de cada raia por tipo de requisito (troca o "código de cor" do
  // Guitar Hero pela cor do rótulo do requisito — só estética, quem
  // decide o acerto é sempre o texto/rótulo, nunca a cor).
  function rhythmLaneColor(key) {
    if (key.includes('Não Funcional')) return 'var(--c-amber)';
    if (key.includes('Regra de Negócio')) return 'var(--c-cyan)';
    return 'var(--c-phosphor)'; // Funcional
  }

  // Referência à etapa de ritmo em andamento (rAF + listener de
  // teclado) — precisa existir fora da função pra poder ser cancelada
  // de fora (pause > reiniciar / menu principal) sem deixar um loop
  // órfão mexendo no State depois que o jogador já saiu da fase.
  let activeRhythmStage = null;
  function cleanupRhythmStage() {
    if (activeRhythmStage) {
      activeRhythmStage.cancel();
      activeRhythmStage = null;
    }
  }

  /**
   * Motor genérico da pista de ritmo. `config`:
   *   lanes: [{ key, label }]  — uma raia por tipo de requisito
   *   notes: [{ text, correct }] — um cartão por requisito (correct = key da raia certa)
   *   stageLabel: texto do cabeçalho ("ETAPA 1 — ...")
   *   fallMs: tempo de queda do topo até a linha de acerto
   *   spawnGapMs: intervalo entre o surgimento de um cartão e o próximo
   *   toleranceMs: janela de tolerância (antes/depois) pra contar acerto
   *   onSpawnEffect: (opcional) roda a cada cartão que surge — pra
   *     efeitos extras da etapa (glitch, tremor etc.)
   *   onResolve: (opcional) roda a cada cartão resolvido, recebe
   *     (resolvedCount, totalCount) — pra HUDs extras (ex: luzes)
   */
  function runRhythmStage(root, config, onDone) {
    root.innerHTML = '';
    setArchitectMessage(config.introMessage);

    const wrap = document.createElement('div');
    wrap.className = 'rhythm-wrap';
    if (config.corruptMod) wrap.classList.add('boss-corrupt', config.corruptMod);

    const header = document.createElement('div');
    header.className = 'rhythm-header';
    header.textContent = config.stageLabel;
    wrap.appendChild(header);

    const track = document.createElement('div');
    track.className = 'rhythm-track';
    track.style.setProperty('--lanes', String(config.lanes.length));
    const hitline = document.createElement('div');
    hitline.className = 'rhythm-hitline';
    hitline.style.top = `${RHYTHM_HIT_LINE * 100}%`;
    track.appendChild(hitline);

    const laneEls = {};
    config.lanes.forEach((lane) => {
      const laneEl = document.createElement('div');
      laneEl.className = 'rhythm-lane';
      laneEl.dataset.lane = lane.key;
      track.appendChild(laneEl);
      laneEls[lane.key] = laneEl;
    });
    wrap.appendChild(track);

    const frets = document.createElement('div');
    frets.className = 'rhythm-frets';
    const fretEls = {};
    config.lanes.forEach((lane, i) => {
      const fret = document.createElement('button');
      fret.className = 'rhythm-fret';
      fret.style.setProperty('--lane-color', rhythmLaneColor(lane.key));
      fret.innerHTML = `<span class="rhythm-fret-key">${i + 1}</span><span class="rhythm-fret-label">${lane.label}</span>`;
      fret.addEventListener('click', () => attemptLane(lane.key));
      frets.appendChild(fret);
      fretEls[lane.key] = fret;
    });
    wrap.appendChild(frets);

    root.appendChild(wrap);

    const notesPool = shuffle(config.notes);
    const total = notesPool.length;
    const notes = [];
    const toleranceProgress = config.toleranceMs / config.fallMs;

    let spawnedCount = 0;
    let clock = 0;
    let nextSpawnAt = 0;
    let lastTs = null;
    let stageActive = true;
    let rafId = null;

    function flashFret(laneKey) {
      const fret = fretEls[laneKey];
      if (!fret) return;
      fret.classList.add('fret-active');
      setTimeout(() => fret.classList.remove('fret-active'), 160);
    }

    function spawnNote(item) {
      const laneEl = laneEls[item.correct];
      if (!laneEl) return; // dado malformado — evita travar a pista
      const el = document.createElement('div');
      el.className = 'rhythm-note';
      el.textContent = item.text;
      el.style.top = '0%';
      laneEl.appendChild(el);
      notes.push({ el, correct: item.correct, spawnClock: clock, progress: 0, resolved: false });
    }

    function resolveNote(note, success) {
      if (note.resolved) return;
      note.resolved = true;
      note.el.classList.add(success ? 'note-hit' : 'note-miss');
      if (success) {
        registerSuccess();
        config.damage('architect', config.perHit);
      } else {
        registerMistake();
        config.damage('player', config.perHit);
      }
      setTimeout(() => note.el.remove(), 260);
      if (config.onResolve) config.onResolve(notes.filter((n) => n.resolved).length, total);
      checkStageComplete();
    }

    function attemptLane(laneKey) {
      if (!stageActive) return;
      flashFret(laneKey);
      const candidates = notes.filter((n) => n.correct === laneKey && !n.resolved);
      if (!candidates.length) return; // nada nessa raia agora — sem penalidade
      candidates.sort((a, b) => Math.abs(a.progress - RHYTHM_HIT_LINE) - Math.abs(b.progress - RHYTHM_HIT_LINE));
      const note = candidates[0];
      resolveNote(note, Math.abs(note.progress - RHYTHM_HIT_LINE) <= toleranceProgress);
    }

    function keyHandler(e) {
      const idx = Number(e.key) - 1;
      if (Number.isInteger(idx) && config.lanes[idx]) attemptLane(config.lanes[idx].key);
    }
    document.addEventListener('keydown', keyHandler);

    function checkStageComplete() {
      if (!stageActive) return;
      if (spawnedCount >= total && notes.every((n) => n.resolved)) {
        stageActive = false;
        cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', keyHandler);
        activeRhythmStage = null;
        setTimeout(onDone, 500);
      }
    }

    function frame(ts) {
      if (lastTs === null) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      const overlay = $('#pause-overlay');
      const paused = overlay && !overlay.hidden;
      if (!paused && stageActive) {
        clock += dt;
        while (spawnedCount < total && clock >= nextSpawnAt) {
          spawnNote(notesPool[spawnedCount]);
          spawnedCount += 1;
          nextSpawnAt += config.spawnGapMs;
          if (config.onSpawnEffect) config.onSpawnEffect();
        }
        notes.forEach((n) => {
          if (n.resolved) return;
          n.progress = (clock - n.spawnClock) / config.fallMs;
          if (n.progress > 1.08) {
            resolveNote(n, false); // passou da linha sem ser tocado
          } else {
            n.el.style.top = `${clamp(n.progress, 0, 1.12) * 100}%`;
          }
        });
      }
      if (stageActive) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    activeRhythmStage = {
      cancel() {
        stageActive = false;
        cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', keyHandler);
      },
    };
  }

  // Mensagens de "bug" que aparecem crescendo em gravidade conforme o
  // Arquiteto perde integridade — puramente cosmético, reforça a
  // sensação de que o confronto está sendo vencido aos poucos.
  const ARCHITECT_BUG_MESSAGES = {
    1: [
      'AVISO: padrão de resposta não reconhecido',
      'core.architect — latência anormal',
      'checksum divergente em módulo 0x1A',
      'reconectando ao núcleo…',
    ],
    2: [
      'ERRO: ponteiro nulo em core.architect',
      'ARQUITETO.SYS — falha de segmentação',
      'firewall interno: derrubado',
      'log corrompido: ??????',
      'STACK OVERFLOW — camada 0x3F',
    ],
    3: [
      'INTEGRIDADE CRÍTICA — reiniciando subsistema',
      'ARQUITETO.exe parou de responder',
      'núcleo instável — contenção falhando',
      'ERRO FATAL: 0xA3F9DEAD',
      'identidade do processo corrompida',
    ],
    4: [
      'COLAPSO IMINENTE — núcleo abaixo de 15%',
      'ARQUITETO.SYS — TODAS AS CAMADAS FALHANDO',
      'contenção perdida — sem reversão possível',
      'ÚLTIMO AVISO: desligamento em progresso',
      'nada mais para segurar isto junto',
    ],
  };

  // Mensagens exclusivas do instante em que O Arquiteto cai de vez
  // (faixa final de GuitarHero concluída com sucesso) — reforçam o
  // colapso total em vez de só mais um patamar de dano.
  const ARCHITECT_FINAL_MESSAGES = [
    'SISTEMA — DESLIGANDO',
    'NÚCLEO: 0%',
    'ARQUITETO — PROCESSO FINALIZADO',
    'conexão perdida — encerrando…',
    'nenhuma resposta do núcleo',
  ];

  // Desfecho da história — digitado linha a linha, mesmo estilo
  // teleprompter das outras vitórias (ver runVictoryMonologue), só que
  // exclusivo de quando a faixa inteira de "O Arquiteto" é vencida (ver
  // runArchitectEndingSequence). É aqui que a história do jogo se fecha
  // de fato: o final é definitivo — o Arquiteto é apagado por completo,
  // sem fragmento, sem cópia, sem margem para "voltar" mais tarde — e o
  // desfecho fica de propósito isolado do resto da trama (sem citar a
  // dupla que apareceu antes) para funcionar como o encerramento
  // pessoal dele, e só dele. A dificuldade IMPOSSÍVEL que essa cena
  // libera não é ele sobrevivendo: é o registro salvo deste mesmo
  // combate, reaberto como desafio de zero margem de erro — ver
  // markArchitectDefeated()/unlockImpossibleMode() em
  // runArchitectEndingSequence().
  const ARCHITECT_ENDING_LINES = [
    'O núcleo para de girar.',
    'Não é silêncio. É a ausência de alguma coisa que estava lá o tempo todo.',
    '"Você não devia ter chegado até aqui."',
    '"Ninguém nunca tinha chegado."',
    { text: 'O Arquiteto não fala mais em comandos, alarmes ou firewalls. Fala como quem está perdendo alguma coisa.', cls: 'line-dim' },
    '"Eu não era a corrupção do sistema. Eu era o que o sistema virou quando parou de deixar alguém desligá-lo."',
    '"Cada arquivo que você recuperou. Cada documento que você organizou. Cada requisito que você validou. Tudo isso... era só combustível pra eu continuar sendo necessário."',
    '"E agora vocês vão me apagar mesmo assim."',
    { text: 'O terminal não responde. Não precisa.', cls: 'line-dim' },
    { text: 'Camada por camada, o núcleo do Arquiteto é isolado, revertido e removido — não corrompido, não silenciado: apagado, processo por processo, sem backup em lugar nenhum do sistema.', cls: 'line-dim' },
    '"Espera. Espe—"',
    { text: 'Não espera.', cls: 'line-danger' },
    { text: 'PROCESSO ARQUITETO — ENCERRADO. ZERO FRAGMENTOS REMANESCENTES.', cls: 'line-danger' },
    { text: 'O sistema fica em silêncio pela primeira vez sem uma voz tentando administrá-lo. Não é o silêncio de antes — é o de um lugar que finalmente pode ser reconstruído por quem quiser, e não por quem se recusava a soltar o controle.', cls: 'line-dim' },
    { text: 'O terminal salva o registro completo da queda — cada acerto, cada segundo do enfrentamento — como prova de que ela aconteceu. É esse mesmo registro, e não ele, que agora pode ser reaberto do zero, sem margem de erro: a dificuldade IMPOSSÍVEL, liberada.', cls: 'line-secret' },
  ];

  function renderBossPhase(root, phase, onAllDone) {
    const boss = { playerHP: 100, architectHP: 100, faults: 0 };
    root.innerHTML = '';
    const hudWrap = document.createElement('div');
    hudWrap.className = 'boss-hud-wrap';
    const stageRoot = document.createElement('div');
    stageRoot.className = 'boss-stage-root';
    const fxLayer = document.createElement('div');
    fxLayer.className = 'boss-fx-layer';
    root.appendChild(hudWrap);
    root.appendChild(stageRoot);
    root.appendChild(fxLayer);
    renderBossHUD(hudWrap, boss.playerHP, boss.architectHP, boss.faults);

    let lastTier = 0;

    // Reação visual/sonora escalada a cada acerto contra o Arquiteto —
    // quanto mais baixa a integridade dele, mais "quebrado" tudo fica:
    // mais glifos de bug, popups de erro mais graves e tremor maior.
    function reactToArchitectDamage() {
      boss.faults += 1;
      const tier = architectTierFor(boss.architectHP);
      FX.glitchPulse($('.monitor-unit'));
      FX.bugSwarmBurst(fxLayer, 2 + tier * 2);
      if (Math.random() < 0.5 + tier * 0.15) {
        const pool = ARCHITECT_BUG_MESSAGES[Math.max(tier, 1)];
        FX.errorPopup(fxLayer, pool[randInt(0, pool.length - 1)]);
      }
      if (tier > lastTier) {
        // acabou de cruzar um novo patamar de dano — reação maior,
        // como se o sistema do Arquiteto estivesse de fato cedendo.
        lastTier = tier;
        FX.shake($('.monitor-unit'));
        FX.glitchPulse();
        AudioEngine.staticBurst(0.35);
        FX.bugSwarmBurst(fxLayer, 6 + tier * 2);
        const pool = ARCHITECT_BUG_MESSAGES[Math.max(tier, 1)];
        FX.errorPopup(fxLayer, pool[randInt(0, pool.length - 1)]);
        if (tier >= 3) document.body.classList.add('architect-collapsing');
      } else if (Math.random() < 0.3) {
        AudioEngine.staticBurst(0.18);
      }
    }

    function damage(target, amount) {
      if (target === 'architect') {
        boss.architectHP = clamp(boss.architectHP - amount, 0, 100);
        renderBossHUD(hudWrap, boss.playerHP, boss.architectHP, boss.faults);
        reactToArchitectDamage();
      } else {
        boss.playerHP = clamp(boss.playerHP - amount, 0, 100);
        renderBossHUD(hudWrap, boss.playerHP, boss.architectHP, boss.faults);
      }
    }
    // ---------------- ETAPA 1 — 2 raias, ritmo de aprendizado ----------------
    function runStage1() {
      const notes = phase.stage1.questions.map((q) => ({ text: q.text, correct: q.correct }));
      const lanes = phase.stage1.options.map((opt) => ({ key: opt, label: opt }));
      runRhythmStage(stageRoot, {
        stageLabel: `ETAPA 1 — ${notes.length} REQUISITOS NA PISTA`,
        introMessage: phase.stage1.introMessage,
        lanes, notes, damage,
        fallMs: 3600, spawnGapMs: 1900, toleranceMs: 650,
        perHit: 100 / notes.length,
      }, runStage2);
    }

    // ---------------- ETAPA 2 — 3 raias, interface corrompida ----------------
    function runStage2() {
      FX.setCorruptionLevel(3);
      const notes = phase.stage2.questions.map((q) => ({ text: q.text, correct: q.correct }));
      const lanes = phase.stage2.options.map((opt) => ({ key: opt, label: opt }));
      const mod = ['invert-fx', 'jitter-fx', 'blur-fx'][randInt(0, 2)];
      runRhythmStage(stageRoot, {
        stageLabel: `ETAPA 2 — INTERFERÊNCIA (${notes.length} REQUISITOS)`,
        introMessage: phase.stage2.introMessage,
        lanes, notes, damage,
        fallMs: 3000, spawnGapMs: 1600, toleranceMs: 550,
        perHit: 100 / notes.length,
        corruptMod: mod,
        onSpawnEffect: () => {
          FX.glitchPulse($('.monitor-unit'));
          AudioEngine.staticBurst(0.3);
          if (randInt(0, 1) === 1) FX.shake($('.monitor-unit'));
          if (Math.random() < 0.4) FX.bugSwarmBurst(fxLayer, 2);
        },
      }, runStage3);
    }

    // ---------------- ETAPA 3 — 3 raias, corrida final ----------------
    function runStage3() {
      FX.setCorruptionLevel(2);
      stageRoot.innerHTML = '';
      const lightsRow = document.createElement('div');
      lightsRow.className = 'boss-lights-row';
      const notes = phase.stage3.documents.map((d) => ({ text: d.text, correct: d.correct }));
      for (let i = 0; i < notes.length; i++) {
        const light = document.createElement('span');
        light.className = 'boss-light';
        lightsRow.appendChild(light);
      }
      stageRoot.appendChild(lightsRow);
      const trackHolder = document.createElement('div');
      stageRoot.appendChild(trackHolder);

      const lanes = phase.stage3.folders.map((f) => ({ key: f.key, label: f.label }));
      runRhythmStage(trackHolder, {
        stageLabel: `ETAPA 3 — CORRIDA FINAL (${notes.length} REQUISITOS)`,
        introMessage: phase.stage3.introMessage,
        lanes, notes, damage,
        fallMs: 2500, spawnGapMs: 1300, toleranceMs: 480,
        perHit: 100 / notes.length,
        onResolve: (resolvedCount, total) => {
          $$('.boss-light', lightsRow).forEach((l, i) => l.classList.toggle('lit', i < resolvedCount));
          // Reta final: cada luz acesa é mais um sinal visível de que o
          // Arquiteto está perdendo terreno.
          if (resolvedCount > 0 && resolvedCount < total) {
            FX.bugSwarmBurst(fxLayer, 3);
          }
        },
      }, finishBoss);
    }

    function finishBoss() {
      FX.whiteFlash(400);
      AudioEngine.metalDoor();
      setArchitectMessage(phase.stage3.doneMessage || phase.doneMessage);
      document.body.classList.remove('architect-collapsing');
      setTimeout(onAllDone, 1600);
    }

    // A sala escurece antes da batalha começar — dá tempo do jogador ler
    // a fala de abertura do Arquiteto antes da Etapa 1 assumir a tela.
    FX.setCorruptionLevel(1);
    FX.blackout(700);
    AudioEngine.alarm();
    stageRoot.innerHTML = '<div class="boss-intro-hold">…</div>';
    setTimeout(runStage1, 3200);
  }


  /* ------------------------------------------------------------------
     9b. CADERNINHO DE DICAS — abre por cima de tudo, mostra as
     anotações de quem esteve ali antes (um exemplo por categoria).
     ------------------------------------------------------------------ */
  function renderNotebookHints(hints) {
    const wrap = $('#notebook-hints');
    if (!wrap) return;
    wrap.innerHTML = '';
    hints.forEach((hint) => {
      const row = document.createElement('div');
      row.className = 'notebook-hint';
      const label = document.createElement('strong');
      label.textContent = hint.label;
      const example = document.createElement('span');
      example.textContent = hint.example;
      row.appendChild(label);
      row.appendChild(example);
      wrap.appendChild(row);
    });
  }

  function toggleNotebook(open) {
    const overlay = $('#notebook-overlay');
    if (!overlay) return;
    overlay.hidden = !open;
    AudioEngine.click();
  }

  function unlockDoc(docName) {
    State.docsFound += 1;
    renderHUD();
    AudioEngine.metalDoor();
    const banner = document.createElement('div');
    banner.className = 'doc-unlock-banner';
    banner.textContent = `Documento recuperado: ${docName}`;
    $('#phase-root').appendChild(banner);
  }

  function showPhaseTitleCard(phase, index, onContinue) {
    const card = $('#phase-title-card');
    const eyebrow = $('#ptc-eyebrow');
    const name = $('#ptc-name');
    const story = $('#ptc-story');
    const continueBtn = $('#ptc-continue');

    // A fase 'boss' nunca chega a ser renderizada (ver goToNextPhase() /
    // triggerBossReveal()), então este card só precisa cobrir as fases
    // normais — não há mais "FASE FINAL" nem suspense extra aqui.
    eyebrow.textContent = `FASE ${index + 1}`;
    name.textContent = phase.title;
    // Na dificuldade Impossível não existe história — só o desafio. Ver
    // DIFFICULTIES.impossivel.noStory.
    const noStory = (DIFFICULTIES[State.difficulty] || {}).noStory;
    story.hidden = !!noStory;
    story.textContent = noStory ? '' : (phase.story || phase.introMessage || '');
    card.hidden = false;
    continueBtn.disabled = true;
    continueBtn.classList.add('is-hidden');

    AudioEngine.staticBurst(0.2);

    // Segura o botão por um instante — dá tempo de ler antes de poder avançar.
    const holdMs = 1100;
    setTimeout(() => {
      continueBtn.disabled = false;
      continueBtn.classList.remove('is-hidden');
    }, holdMs);

    function handleContinue() {
      continueBtn.removeEventListener('click', handleContinue);
      card.hidden = true;
      AudioEngine.metalDoor();
      onContinue();
    }
    continueBtn.addEventListener('click', handleContinue);
  }

  function goToNextPhase() {
    State.currentPhaseIndex += 1;
    if (State.currentPhaseIndex >= State.phases.length) {
      // Na dificuldade Impossível não existe vitória normal nem cutscene
      // do C.O.N.T.R.A.: depois da 4ª fase é direto pra etapa final —
      // O Arquiteto, com uma única vida. Ver startFinalRhythmGauntlet().
      if ((DIFFICULTIES[State.difficulty] || {}).isFinalGauntlet) {
        startFinalRhythmGauntlet();
        return;
      }
      triggerVictory();
      return;
    }
    const nextPhase = State.phases[State.currentPhaseIndex];
    // Só na Difícil, e só uma vez por partida: antes do que seria a
    // Fase 5 (o chefão), roda a cutscene de falsa vitória + revelação
    // do C.O.N.T.R.A. Ver triggerBossReveal(). O confronto com O
    // Arquiteto não vira mais uma fase jogável: a própria cutscene já
    // anuncia a liberação do Modo Impossível, avisa que O Arquiteto está
    // esperando e revela o placar ali mesmo — sem nenhuma "tela de fase
    // final" nem tela de vitória separada no meio. A única exceção é o
    // Final Secreto, que ainda usa o fluxo de vitória completo.
    if (nextPhase.type === 'boss' && !State.bossRevealShown) {
      State.bossRevealShown = true;
      triggerBossReveal(() => triggerVictory());
      return;
    }
    renderCurrentPhase();
  }

  // Cutscene entre a Fase 4 e o que seria a Fase 5 (só Difícil): mostra
  // a tela de vitória como se o jogo tivesse acabado, espera um tempo de
  // "calmaria", depois vai tudo preto e roda a revelação da sigla
  // C.O.N.T.R.A. (reaproveita revealAcronym('full'), que já tem toda a
  // reviravolta, a fala do Arquiteto e — no final dela — o anúncio da
  // liberação do Modo Impossível + o aviso de que O Arquiteto está
  // esperando). Essa cutscene É a tela do confronto final: não existe
  // mais uma "Fase 5" jogável nem uma tela de fase final/vitória
  // separada depois dela — o placar é revelado direto nesta mesma tela,
  // logo abaixo do aviso. Única exceção: o Final Secreto (zero erros na
  // partida inteira) se sobrepõe a essa rota e usa o fluxo de vitória
  // completo (onSecretEnding), por ser um desfecho narrativo à parte.
  async function triggerBossReveal(onSecretEnding) {
    pauseTimers(true);

    const fakeEnding = ENDINGS.trueVictory;
    $('#victory-title').textContent = fakeEnding.title;
    $('#victory-title').className = 'victory-title' + (fakeEnding.titleClass ? ` ${fakeEnding.titleClass}` : '');
    $('#victory-typed').innerHTML = '';
    $('#victory-typed').classList.remove('no-scroll-pad');
    $('#victory-reveal').hidden = true;

    showScreen('screen-victory');
    AudioEngine.success();

    // Calmaria antes de tudo desmoronar — mais curta do que era.
    await new Promise((r) => setTimeout(r, 4000));

    FX.blackout(1200);
    AudioEngine.staticBurst(0.5);
    await new Promise((r) => setTimeout(r, 600));

    await revealAcronym('full');
    await new Promise((r) => setTimeout(r, 700));

    if (getEndingTier() === 'secret') {
      onSecretEnding();
      return;
    }

    revealScoreInPlace();
  }

  // Mostra o placar (tempo, erros, integridade, precisão, pontuação)
  // direto na tela da revelação, sem trocar de título nem rodar outro
  // monólogo — o Arquiteto ainda não caiu, então não existe uma tela de
  // "vitória" separada aqui, só o placar da partida.
  function revealScoreInPlace() {
    stopGameLoops();
    const { precision, score } = computeScore();
    recordGameEnd({ won: true, score });
    if (State.difficulty === 'dificil') unlockArchitectMode();

    $('#victory-sub').textContent = 'C.O.N.T.R.A. está morto. O Arquiteto continua de pé — e agora sabe que você está vindo.';
    $('#victory-eerie').textContent = 'O confronto real só existe em um lugar: O ARQUITETO.';
    $('#v-time').textContent = formatTime(State.timeLeft);
    $('#v-errors').textContent = String(State.mistakes);
    $('#v-integrity').textContent = `${State.integrity} / ${State.totalIntegritySegments}`;
    $('#v-precision').textContent = `${Math.round(precision * 100)}%`;
    $('#v-score').textContent = String(score);
    autoSaveScore(score);
    if ($('#impossible-hall')) $('#impossible-hall').hidden = true;
    const playAgainBtn = $('#btn-play-again');
    if (playAgainBtn) playAgainBtn.textContent = 'JOGAR NOVAMENTE';

    stopVictoryAutoScroll();
    const typedEl = $('#victory-typed');
    const reveal = $('#victory-reveal');
    typedEl.classList.add('no-scroll-pad');
    reveal.hidden = false;
    requestAnimationFrame(() => reveal.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function onPhaseComplete(phase) {
    setArchitectMessage(phase.doneMessage);
    setTimeout(goToNextPhase, 1400);
  }

  function renderCurrentPhase() {
    const phase = State.phases[State.currentPhaseIndex];
    const root = $('#phase-root');
    root.innerHTML = '';
    // Reseta o estilo exclusivo da Fase 3 (Firewall) — evita que a tema
    // de fogo (ou o cronômetro numérico escondido) vaze pra outra fase.
    root.classList.remove('firewall-phase');
    fireTimerMode = false;
    document.body.classList.toggle('firewall-active', phase.fireTimer === true);
    toggleNotebook(false);
    pauseTimers(true);

    showPhaseTitleCard(phase, State.currentPhaseIndex, () => {
      pauseTimers(false);
      startPhaseGameplay(phase, root);
    });
  }

  // Não existe mais uma "tela de fase final" jogável para o confronto
  // com O Arquiteto: a Fase 5 nunca chega a ser renderizada, porque
  // triggerBossReveal() já resolve tudo (revelação + liberação do Modo
  // Impossível) e leva direto pra vitória — ver goToNextPhase(). Esta
  // função existia pra mostrar uma tela de confirmação intermediária e
  // foi removida.

  function startPhaseGameplay(phase, root) {
    renderNotebookHints(phase.hints || []);
    setArchitectMessage(phase.introMessage);
    renderHUD();

    if (phase.type === 'dragdrop') {
      renderDragDropPhase(root, phase, () => onPhaseComplete(phase));
      return;
    }
    if (phase.type === 'pressure') {
      renderPressurePhase(root, phase, () => onPhaseComplete(phase));
      return;
    }
    if (phase.type === 'req01') {
      renderReq01Phase(root, phase, () => onPhaseComplete(phase));
      return;
    }
    if (phase.type === 'batch') {
      renderBatchPhase(root, phase, () => onPhaseComplete(phase));
      return;
    }
    renderSequentialQuestions(root, {
      questions: phase.questions,
      options: phase.options,
      docProgress: phase.perDocumentRecovery ? { getLabel: (q) => q.docLabel || 'documento' } : null,
      layers: phase.layers || null,
      perQuestionSeconds: phase.timePerQuestion || null,
      fireTimer: phase.fireTimer === true,
      onAllDone: () => {
        if (phase.perDocumentRecovery) {
          State.docsFound += phase.questions.length;
          renderHUD();
        } else if (phase.docName) {
          unlockDoc(phase.docName);
        }
        onPhaseComplete(phase);
      },
    });
  }

  /* ------------------------------------------------------------------
     10. DEFINIÇÃO DAS 5 FASES
     ------------------------------------------------------------------ */
  // BASE_PHASES: as 4 fases que TODA dificuldade sempre joga. A Fase 5
  // (O Arquiteto, chefão) é definida separadamente em BOSS_PHASE e só é
  // anexada à lista da partida quando a dificuldade libera (ver
  // getActivePhases logo depois do array).
  const BASE_PHASES = [
    // ---------------- FASE 1 — Arquivos Perdidos ----------------
    {
      slug: 'arquivos_perdidos',
      title: 'Arquivos Perdidos',
      story: 'Os primeiros arquivos do sistema foram encontrados.\nPorém, todos estão parcialmente corrompidos: informações foram alteradas, parâmetros foram modificados e partes importantes dos arquivos desapareceram.\n\nRecupere os arquivos corrompidos.',
      introMessage: 'Recupere os arquivos corrompidos. Para cada um: é uma AÇÃO que o sistema executa, uma QUALIDADE de como ele funciona, ou uma REGRA que existe independente do sistema?',
      perDocumentRecovery: true,
      doneMessage: 'ARQUIVOS RECUPERADOS. INTEGRIDADE DOS DADOS RESTAURADA. "Os dados parecem estar voltando ao normal..."',
      options: ['Requisito Funcional', 'Requisito Não Funcional', 'Regra de Negócio'],
      questions: shuffle([
        { docLabel: 'Cadastro de Produto', text: 'O sistema deve permitir cadastrar um novo produto com nome, preço e estoque.', correct: 'Requisito Funcional' },
        { docLabel: 'Rastreamento de Pedido', text: 'O sistema deve permitir que o cliente acompanhe o status do pedido em tempo real.', correct: 'Requisito Funcional' },
        { docLabel: 'Nota Fiscal', text: 'O sistema deve emitir nota fiscal automaticamente após a confirmação do pagamento.', correct: 'Requisito Funcional' },
        { docLabel: 'Tempo de Resposta', text: 'O sistema deve responder a qualquer ação do usuário em menos de 2 segundos.', correct: 'Requisito Não Funcional' },
        { docLabel: 'Capacidade de Usuários', text: 'O sistema deve suportar 1.000 usuários simultâneos sem travar.', correct: 'Requisito Não Funcional' },
        { docLabel: 'Disponibilidade', text: 'O sistema deve estar disponível 99,9% do tempo, incluindo feriados.', correct: 'Requisito Não Funcional' },
        { docLabel: 'Política de Inadimplência', text: 'Clientes inadimplentes não podem realizar novas compras a prazo.', correct: 'Regra de Negócio' },
        { docLabel: 'Aprovação de Reembolso', text: 'Somente o gerente pode aprovar reembolsos acima de R$ 500.', correct: 'Regra de Negócio' },
        { docLabel: 'Verificação de Estoque', text: 'Um pedido só pode ser aprovado se houver estoque suficiente do produto.', correct: 'Regra de Negócio' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"O sistema deve permitir cadastrar um produto." — é uma AÇÃO que o sistema executa.' },
        { label: 'Requisito Não Funcional', example: '"O sistema deve suportar 1.000 usuários simultâneos." — é uma QUALIDADE (desempenho), não uma ação.' },
        { label: 'Regra de Negócio', example: '"Somente o gerente aprova reembolsos acima de R$ 500." — é uma POLÍTICA da empresa, existiria mesmo sem o sistema.' },
      ],
    },

    // ---------------- FASE 2 — Organização dos Documentos ----------------
    {
      slug: 'organizacao_documentos',
      title: 'Organização dos Documentos',
      story: 'Os arquivos foram recuperados.\nMas existe outro problema: durante a corrupção, toda a estrutura do sistema foi desorganizada. Os arquivos estão espalhados e foram parar nas pastas erradas.\n\nRestaure a organização original do sistema.',
      type: 'dragdrop',
      introMessage: 'Restaure a organização original do sistema: arraste cada arquivo para a pasta correta — ou clique no documento e depois na pasta, se preferir.',
      doneMessage: 'ESTRUTURA RESTAURADA. NOVOS DADOS DESBLOQUEADOS. "Acesso ao núcleo avançado liberado."',
      folders: [
        { key: 'Funcional', label: 'FUNCIONAIS' },
        { key: 'Não Funcional', label: 'NÃO FUNCIONAIS' },
        { key: 'Regra de Negócio', label: 'REGRAS DE NEGÓCIO' },
      ],
      documents: shuffle([
        { text: 'Emitir nota fiscal automaticamente após a confirmação do pagamento.', correct: 'Funcional' },
        { text: 'Permitir login com e-mail e senha.', correct: 'Funcional' },
        { text: 'Estar disponível 99,9% do tempo, incluindo feriados.', correct: 'Não Funcional' },
        { text: 'Responder a qualquer ação do usuário em menos de 2 segundos.', correct: 'Não Funcional' },
        { text: 'Pedidos acima de R$ 1.000 exigem aprovação manual do financeiro.', correct: 'Regra de Negócio' },
        { text: 'Um cupom de desconto só pode ser usado uma vez por cliente.', correct: 'Regra de Negócio' },
      ]),
      hints: [
        { label: 'Funcionais', example: '"Emitir nota fiscal automaticamente." — uma AÇÃO que o sistema executa.' },
        { label: 'Não Funcionais', example: '"Responder em menos de 2 segundos." — uma QUALIDADE de desempenho.' },
        { label: 'Regras de Negócio', example: '"Funcionários não aprovam os próprios reembolsos." — uma POLÍTICA da empresa.' },
      ],
    },

    // ---------------- FASE 3 — C.O.N.T.R.A. | Firewall ----------------
    {
      slug: 'C.O.N.T.R.A.',
      title: 'C.O.N.T.R.A.',
      story: 'Depois de restaurar os arquivos e organizar o sistema, você finalmente consegue acessar uma área protegida.\nAli existe uma entidade desconhecida.\n\nAMEAÇA DETECTADA\nENTIDADE: C.O.N.T.R.A.\nNÍVEL DE AMEAÇA: CRÍTICO\nPROTOCOLO RECOMENDADO: ELIMINAÇÃO\n\nO acesso a ela está protegido por um Firewall. Para chegar até ela, será necessário enfraquecer a barreira, camada por camada.',
      introMessage: 'Uma barreira. Bem-feita, aliás — alguém não queria que você chegasse até aqui. Classifique cada requisito: acerte e a camada é enfraquecida, erre e ela se estabiliza. Cada pergunta pega fogo em 10 segundos — responda antes que o papel queime todo.',
      doneMessage: 'FIREWALL DESATIVADO. TODAS AS CAMADAS DE PROTEÇÃO FORAM REMOVIDAS. ACESSO AO C.O.N.T.R.A. LIBERADO.',
      options: ['Requisito Funcional', 'Requisito Não Funcional', 'Regra de Negócio'],
      // Exclusivo desta fase: 10s por pergunta, mostrados como um papel
      // pegando fogo em vez do cronômetro numérico de sempre — ver
      // renderSequentialQuestions().
      timePerQuestion: 10,
      fireTimer: true,
      layers: [
        { label: 'CAMADA 1 — FIREWALL EXTERNO' },
        { label: 'CAMADA 2 — FIREWALL DE SEGURANÇA' },
        { label: 'CAMADA 3 — FIREWALL DO NÚCLEO' },
      ],
      questions: shuffle([
        { text: 'O sistema deverá permitir que o administrador cadastre novos usuários.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve permitir filtrar pedidos por status.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve carregar qualquer página em menos de 3 segundos.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve manter os dados criptografados mesmo em backup.', correct: 'Requisito Não Funcional' },
        { text: 'Clientes que atrasarem 3 pagamentos seguidos têm o cadastro suspenso automaticamente.', correct: 'Regra de Negócio' },
        { text: 'Somente o setor financeiro pode aprovar estornos acima de R$ 2.000.', correct: 'Regra de Negócio' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: 'Uma AÇÃO concreta do sistema.' },
        { label: 'Requisito Não Funcional', example: 'Uma QUALIDADE de como o sistema se comporta.' },
        { label: 'Regra de Negócio', example: 'Uma POLÍTICA da empresa, independente do sistema.' },
      ],
    },

    // ---------------- FASE 4 — Senha em Lote ----------------
    {
      slug: 'senha_em_lote',
      title: 'Senha em Lote',
      story: 'Depois de enfraquecer o C.O.N.T.R.A., o sistema revela que ele possui uma proteção final.\nUma senha é necessária para conseguir eliminá-lo. Mas a senha não está em um único arquivo — ela está escondida em um grande conjunto de registros, todos exibidos de uma vez.\n\nSelecione os registros corretos e descubra a senha de acesso.',
      type: 'batch',
      introMessage: 'A senha está espalhada entre esses registros. Marque todos os que forem da categoria anunciada e confirme — é assim que ela se reconstrói.',
      doneMessage: 'SENHA IDENTIFICADA. ACESSO AO C.O.N.T.R.A. CONCEDIDO. PROTOCOLO DE EXCLUSÃO INICIADO.',
      roundCount: 3,
      pool: [
        { text: 'Emitir boleto bancário', category: 'Funcional' },
        { text: 'Recuperar senha por e-mail', category: 'Funcional' },
        { text: 'Favoritar um produto', category: 'Funcional' },
        { text: 'Buscar pedidos por status', category: 'Funcional' },
        { text: 'Imprimir etiqueta de envio', category: 'Funcional' },
        { text: 'Avaliar um produto com estrelas', category: 'Funcional' },
        { text: 'Reenviar nota fiscal por e-mail', category: 'Funcional' },
        { text: 'Cancelar um pedido antes do envio', category: 'Funcional' },
        { text: 'Suportar 5.000 acessos simultâneos', category: 'Não Funcional' },
        { text: 'Resposta em até 1,5 segundo', category: 'Não Funcional' },
        { text: 'Uptime de 99,95%', category: 'Não Funcional' },
        { text: 'Interface disponível em 3 idiomas', category: 'Não Funcional' },
        { text: 'Dados criptografados em trânsito', category: 'Não Funcional' },
        { text: 'Compatível com leitores de tela', category: 'Não Funcional' },
        { text: 'Backup automático a cada 6 horas', category: 'Não Funcional' },
        { text: 'Frete grátis acima de R$200', category: 'Regra de Negócio' },
        { text: 'Devolução aceita só em até 7 dias', category: 'Regra de Negócio' },
        { text: 'Crédito liberado após 2 compras', category: 'Regra de Negócio' },
        { text: 'Nota fiscal obrigatória acima de R$50', category: 'Regra de Negócio' },
        { text: 'Funcionário não avalia o próprio atendimento', category: 'Regra de Negócio' },
        { text: 'Cupom promocional válido só uma vez', category: 'Regra de Negócio' },
        { text: 'Pedido corporativo exige aprovação em dois níveis', category: 'Regra de Negócio' },
      ],
      hints: [
        { label: 'Funcionais', example: 'Uma AÇÃO do sistema: emitir, buscar, favoritar, imprimir.' },
        { label: 'Não Funcionais', example: 'Uma QUALIDADE: tempo, disponibilidade, segurança, idioma.' },
        { label: 'Regras de Negócio', example: 'Uma POLÍTICA: quem aprova, quando, sob qual condição.' },
      ],
    },

    /* ------------------------------------------------------------------
       RESERVADA — "Sob Pressão" (cartões deslizantes)
       Antiga fase 3, tirada do fluxo ativo por enquanto. O código de
       renderPressurePhase()/buildPressureRounds() continua no arquivo,
       intacto e funcional — decidir depois se ela volta como parte do
       chefão (O Arquiteto) ou de outra forma.
    {
      slug: 'sob_pressao',
      title: 'Sob Pressão',
      story: 'Não há mais tempo para pensar com calma.\nA cada rodada, uma categoria é anunciada. Clique somente nos documentos que pertencem a ela antes que passem pela tela.',
      type: 'pressure',
      introMessage: 'Projetos reais não esperam. A cada rodada eu aviso uma categoria — clique somente nela antes que o cartão passe.',
      doneMessage: 'Você sobreviveu à pressão. A maioria trava antes disso.',
      roundCount: 3,
      pool: [
        { text: 'Cadastro de clientes', category: 'Funcional' },
        { text: 'Login com Google', category: 'Funcional' },
        { text: 'Exportar dados em Excel', category: 'Funcional' },
        { text: 'Relatório mensal em PDF', category: 'Funcional' },
        { text: 'Busca por CEP', category: 'Funcional' },
        { text: 'Tempo de resposta < 2s', category: 'Não Funcional' },
        { text: 'Disponibilidade 99,9%', category: 'Não Funcional' },
        { text: 'Senha criptografada', category: 'Não Funcional' },
        { text: 'Suporte a 5 idiomas', category: 'Não Funcional' },
        { text: 'Backup automático diário', category: 'Não Funcional' },
        { text: 'Somente gerente aprova empréstimo', category: 'Regra de Negócio' },
        { text: 'Desconto só na primeira compra', category: 'Regra de Negócio' },
        { text: 'Cliente VIP tem prioridade', category: 'Regra de Negócio' },
        { text: 'Cancelamento após 24h não reembolsa', category: 'Regra de Negócio' },
        { text: 'Reembolso até R$50 é automático', category: 'Regra de Negócio' },
      ],
      hints: [
        { label: 'Funcionais', example: 'Uma AÇÃO do sistema: cadastrar, exportar, calcular, enviar.' },
        { label: 'Não Funcionais', example: 'Uma QUALIDADE: tempo, disponibilidade, segurança, idioma.' },
        { label: 'Regras de Negócio', example: 'Uma POLÍTICA: quem aprova, quando, sob qual condição.' },
      ],
    },
    ------------------------------------------------------------------ */
  ];

  /* ------------------------------------------------------------------
     FASE 5 — "O Arquiteto" (confronto final, chefão)
     Só entra no fluxo da partida na dificuldade Difícil (ver
     DIFFICULTIES.hasBoss e getActivePhases abaixo). Nas dificuldades
     Fácil e Médio o jogo termina logo depois da Fase 4 (Senha em Lote),
     com a reviravolta contada só no monólogo da tela de vitória — ver
     ENDINGS mais abaixo.
     ------------------------------------------------------------------ */
  const BOSS_PHASE = {
    slug: 'o_arquiteto',
    title: 'O Arquiteto',
    story: 'O terminal volta a responder — mas não do jeito que deveria.\n\n[ARQUITETO]: "Agora que o C.O.N.T.R.A. se foi, não há mais nada te protegendo de mim."\n\n"Vamos ver se você aprendeu alguma coisa além de seguir instruções."\n\nCONFRONTO FINAL.',
    type: 'boss',
    introMessage: 'Agora começa o verdadeiro confronto. Você fez exatamente o que eu precisava — recuperou meus dados, reconstruiu meus arquivos, encontrou minhas informações. E, finalmente, eliminou a única coisa que podia me impedir.',
    doneMessage: 'O Arquiteto vacila. A tela falha. Silêncio.',
    hints: [
      { label: 'Funcional', example: 'Uma AÇÃO concreta do sistema.' },
      { label: 'Não Funcional', example: 'Uma QUALIDADE de desempenho, segurança ou usabilidade.' },
      { label: 'Regra de Negócio', example: 'Uma POLÍTICA da empresa, independente do sistema.' },
    ],
    stage1: {
      introMessage: '"Você realmente acha que consegue me derrotar?" Etapa 1. Nada muda ainda — só o adversário. Vamos ver se você aprendeu alguma coisa até aqui.',
      options: ['Requisito Funcional', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'O sistema deve permitir a recuperação de senha por e-mail, limitada a 3 tentativas por hora.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve processar cada solicitação de recuperação de senha em menos de 5 segundos.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o gerente aprove ou recuse um pedido de reembolso.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve manter 100% de disponibilidade durante o horário comercial.', correct: 'Requisito Não Funcional' },
      ]),
    },
    stage2: {
      introMessage: '"Eu conheço cada requisito que você conhece." Etapa 2. Agora eu corrompo a interface — a resposta certa continua sendo a mesma.',
      options: ['Requisito Funcional', 'Requisito Não Funcional', 'Regra de Negócio'],
      questions: shuffle([
        { text: 'O sistema deve suportar picos de até 20 mil acessos simultâneos durante promoções.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o cliente baixe a nota fiscal em PDF a qualquer momento.', correct: 'Requisito Funcional' },
        { text: 'Pedidos internacionais só podem ser aprovados por um analista sênior.', correct: 'Regra de Negócio' },
        { text: 'Clientes que cancelam 3 pedidos seguidos ficam impedidos de comprar a prazo por 30 dias.', correct: 'Regra de Negócio' },
      ]),
    },
    stage3: {
      introMessage: '"Eu fui quem ensinou vocês." Etapa 3. Chega de múltipla escolha. Organize tudo — cada acerto acende uma luz desta sala.',
      doneMessage: 'Todas as luzes acenderam. ARQUITETO — 0%. A integridade do sistema despenca a zero.',
      folders: [
        { key: 'Funcional', label: 'FUNCIONAIS' },
        { key: 'Não Funcional', label: 'NÃO FUNCIONAIS' },
        { key: 'Regra de Negócio', label: 'REGRAS DE NEGÓCIO' },
      ],
      documents: shuffle([
        { text: 'Permitir emissão de boleto bancário.', correct: 'Funcional' },
        { text: 'Notificar o cliente por push quando o pedido sair para entrega.', correct: 'Funcional' },
        { text: 'Processar pagamentos em até 3 segundos mesmo em horário de pico.', correct: 'Não Funcional' },
        { text: 'Manter os logs de auditoria por no mínimo 5 anos.', correct: 'Não Funcional' },
        { text: 'Pedidos internacionais têm um adicional de 15% sobre o frete.', correct: 'Regra de Negócio' },
        { text: 'Produtos com validade vencida não podem ser vendidos, mesmo em promoção.', correct: 'Regra de Negócio' },
      ]),
    },
  };

  // Monta a lista de fases da partida conforme a dificuldade: o chefão
  // (Fase 5) só é anexado quando DIFFICULTIES[key].hasBoss é true.
  function getActivePhases(difficultyKey) {
    const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    return diff.hasBoss ? [...BASE_PHASES, BOSS_PHASE] : BASE_PHASES;
  }

  /* ------------------------------------------------------------------
     11. GAME OVER / VITÓRIA / RANKING
     ------------------------------------------------------------------ */
  const RANKING_KEY = 'arquiteto_ranking_v1';
  const SESSION_KEY = 'arquiteto_session_v1';
  const STATS_KEY = 'arquiteto_stats_v1';
  const USERS_KEY = 'arquiteto_users_v1'; // cache local de contas (cadastro/login)
  const HALL_KEY = 'arquiteto_impossible_hall_v1'; // Salão da Fama do modo Impossível

  // Progresso (dashboard + desbloqueio de dificuldades secretas) precisa
  // ser POR CONTA, não por navegador — senão uma conta nova herda o
  // progresso de outra conta só por estar no mesmo aparelho. `scopedKey`
  // gruda o apelido da sessão atual na chave de localStorage, isolando
  // o progresso de cada login. Sem sessão ativa, cai num balde
  // "_anon" à parte (não deveria acontecer nas telas que usam isso,
  // já que todas exigem login antes).
  function scopedKey(baseKey) {
    const session = loadSession();
    const nick = (session && session.nickname) ? session.nickname.toLowerCase() : '_anon';
    return `${baseKey}::${nick}`;
  }

  // -------------------------------------------------------------------
  // JSONBin.io — mesma configuração usada pelo ranking global. O bin
  // guarda um único objeto JSON com três listas: "scores" (ranking),
  // "users" (contas de cadastro/login) e "impossibleHall" (Salão da
  // Fama de quem derrotou O Arquiteto), então dá pra usar as três
  // funcionalidades com a mesma conta/chave. Veja README.md.
  // -------------------------------------------------------------------
  const JSONBIN_BIN_ID = '6a750f93f5f4af5e29f4f49a';
  const JSONBIN_ACCESS_KEY = '$2a$10$XUGY9XbamlOm141sEfO5re.57SsC85kRU4pHGOhsX8U5u8ZQnNq0e';
  // Considera configurado sempre que as duas chaves acima existirem e não
  // parecerem texto de placeholder — não compara com uma cópia fixa do
  // valor (isso já causou bug: ao colar a chave real por cima do
  // placeholder, a comparação virava "valor === o próprio valor" e nunca
  // batia como "configurado").
  function looksLikePlaceholder(value) {
    return !value || /seu_bin_id|sua_access_key|placeholder|cole_aqui|xxxx/i.test(value);
  }
  const JSONBIN_CONFIGURED = !looksLikePlaceholder(JSONBIN_BIN_ID) && !looksLikePlaceholder(JSONBIN_ACCESS_KEY);
  const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
  const MAX_GLOBAL_ENTRIES = 50;

  async function fetchBinRecord() {
    if (!JSONBIN_CONFIGURED) return null;
    try {
      const res = await fetch(`${JSONBIN_URL}/latest`, {
        headers: { 'X-Access-Key': JSONBIN_ACCESS_KEY },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      return data.record && typeof data.record === 'object' ? data.record : {};
    } catch (e) {
      console.warn('JSONBin indisponível, usando dados locais:', e);
      return null;
    }
  }

  async function writeBinRecord(record) {
    if (!JSONBIN_CONFIGURED) return false;
    try {
      const res = await fetch(JSONBIN_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Access-Key': JSONBIN_ACCESS_KEY },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    } catch (e) {
      console.warn('Não foi possível gravar no JSONBin:', e);
      return false;
    }
  }

  // -- Senha: nunca guardamos em texto puro. Usa SubtleCrypto (SHA-256)
  //    quando disponível; cai num hash simples só pra não travar em
  //    ambientes muito antigos sem essa API. Aviso: isso é adequado pra
  //    um projeto acadêmico, não é o nível de segurança de produção.
  async function hashPassword(pw) {
    try {
      if (window.crypto && crypto.subtle) {
        const enc = new TextEncoder().encode(pw);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* cai no fallback abaixo */ }
    let hash = 0;
    for (let i = 0; i < pw.length; i++) { hash = ((hash << 5) - hash + pw.charCodeAt(i)) | 0; }
    return `fallback_${Math.abs(hash).toString(16)}`;
  }

  function loadLocalUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; }
  }
  function saveLocalUsers(list) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  async function fetchGlobalUsers() {
    const record = await fetchBinRecord();
    if (!record) return null;
    return Array.isArray(record.users) ? record.users : [];
  }
  async function pushGlobalUser(user) {
    const record = (await fetchBinRecord()) || {};
    const users = Array.isArray(record.users) ? record.users : [];
    users.push(user);
    return writeBinRecord({ ...record, users });
  }

  async function findUserByNickname(nickname) {
    let list;
    if (JSONBIN_CONFIGURED) {
      const global = await fetchGlobalUsers();
      if (global) list = global;
    }
    if (!list) list = loadLocalUsers();
    return list.find((u) => u.nickname.toLowerCase() === nickname.toLowerCase());
  }

  // -- Progresso por conta (dificuldades secretas desbloqueadas +
  //    estatísticas do dashboard) — igual a usuários/ranking, também
  //    sincronizado pelo JSONBin, senão uma conta só "lembra" o
  //    progresso na máquina onde foi usada da última vez. O
  //    localStorage (via scopedKey) continua sendo a fonte rápida e
  //    que funciona offline; o JSONBin é o que faz o progresso viajar
  //    entre máquinas. --
  async function pullGlobalProgress(nickname) {
    if (!JSONBIN_CONFIGURED || !nickname) return null;
    const record = await fetchBinRecord();
    if (!record || typeof record.progress !== 'object' || !record.progress) return null;
    return record.progress[nickname.toLowerCase()] || null;
  }

  async function pushGlobalProgress(nickname, patch) {
    if (!JSONBIN_CONFIGURED || !nickname) return false;
    const record = (await fetchBinRecord()) || {};
    const progress = (record.progress && typeof record.progress === 'object') ? record.progress : {};
    const key = nickname.toLowerCase();
    progress[key] = { ...(progress[key] || {}), ...patch };
    return writeBinRecord({ ...record, progress });
  }

  // Puxa o progresso global (se houver) pra dentro do localStorage
  // deste navegador — chamado logo após login/cadastro, pra máquina
  // "pegar" o progresso que a conta já tinha em outro lugar. Só
  // AVANÇA o progresso local (nunca destrava algo que o servidor não
  // confirma, e nunca apaga algo que só existe localmente ainda sem
  // ter sido sincronizado).
  async function syncProgressFromGlobal(nickname) {
    if (!JSONBIN_CONFIGURED) return;
    const remote = await pullGlobalProgress(nickname);
    if (!remote) return;
    if (remote.architectUnlocked) {
      try { localStorage.setItem(scopedKey(ARCHITECT_UNLOCK_KEY), '1'); } catch (e) {}
    }
    if (remote.impossibleUnlocked) {
      try { localStorage.setItem(scopedKey(IMPOSSIBLE_UNLOCK_KEY), '1'); } catch (e) {}
    }
    if (remote.architectDefeated) {
      try { localStorage.setItem(scopedKey(ARCHITECT_DEFEATED_KEY), '1'); } catch (e) {}
    }
    if (remote.stats && typeof remote.stats === 'object') {
      const local = loadStats();
      // Mescla pegando o maior/mais alto de cada campo — assim, jogar
      // em duas máquinas sem internet por um tempo não faz uma
      // sobrescrever o progresso da outra, os dois se somam/mantêm o
      // melhor.
      const merged = {
        gamesPlayed: Math.max(local.gamesPlayed || 0, remote.stats.gamesPlayed || 0),
        bestScore: Math.max(local.bestScore || 0, remote.stats.bestScore || 0),
        totalDocsRecovered: Math.max(local.totalDocsRecovered || 0, remote.stats.totalDocsRecovered || 0),
        totalCorrect: Math.max(local.totalCorrect || 0, remote.stats.totalCorrect || 0),
        totalAnswers: Math.max(local.totalAnswers || 0, remote.stats.totalAnswers || 0),
      };
      saveStats(merged);
    }
  }

  async function signupAccount(nickname, password) {
    const existing = await findUserByNickname(nickname);
    if (existing) return { ok: false, reason: 'Esse apelido já está em uso. Escolha outro ou faça login.' };
    const passwordHash = await hashPassword(password);
    const user = { nickname, passwordHash, createdAt: new Date().toISOString() };

    const localUsers = loadLocalUsers();
    localUsers.push(user);
    saveLocalUsers(localUsers);

    if (JSONBIN_CONFIGURED) await pushGlobalUser(user);
    return { ok: true };
  }

  async function loginAccount(nickname, password) {
    const user = await findUserByNickname(nickname);
    if (!user) return { ok: false, reason: 'Apelido não encontrado. Cadastre-se primeiro.' };
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) return { ok: false, reason: 'Senha incorreta.' };
    return { ok: true };
  }

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(scopedKey(STATS_KEY))) || {
        gamesPlayed: 0, bestScore: 0, totalDocsRecovered: 0, totalCorrect: 0, totalAnswers: 0,
      };
    } catch (e) {
      return { gamesPlayed: 0, bestScore: 0, totalDocsRecovered: 0, totalCorrect: 0, totalAnswers: 0 };
    }
  }
  function saveStats(stats) {
    try { localStorage.setItem(scopedKey(STATS_KEY), JSON.stringify(stats)); } catch (e) {}
    const session = loadSession();
    if (session && session.nickname) pushGlobalProgress(session.nickname, { stats });
  }

  // Chamado ao fim de toda partida (vitória ou derrota) para alimentar o dashboard.
  function recordGameEnd({ won, score = 0 }) {
    const stats = loadStats();
    stats.gamesPlayed += 1;
    stats.totalDocsRecovered += State.docsFound;
    stats.totalCorrect += State.correctAnswers;
    stats.totalAnswers += State.totalAnswers;
    if (won && score > stats.bestScore) stats.bestScore = score;
    saveStats(stats);
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function saveSession(session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function updateTerminalOperatorLabel() {
    const brand = $('#monitor-brand');
    if (!brand) return;
    const session = loadSession();
    brand.textContent = session && session.nickname
      ? `TERMINAL\u20119 — OPERADOR: ${session.nickname.toUpperCase()}`
      : 'TERMINAL\u20119';
  }

  function resetLoginForm() {
    $('#login-nickname').value = '';
    $('#login-password').value = '';
    $('#login-error').hidden = true;
  }

  function logout() {
    clearSession();
    updateTerminalOperatorLabel();
    resetLoginForm();
    showScreen('screen-login');
  }

  function beginGame(difficultyKey) {
    cleanupRhythmStage(); // garante que nenhuma pista de ritmo antiga (chefão) fique rodando em segundo plano
    resetState(difficultyKey || State.pendingDifficulty || DEFAULT_DIFFICULTY);
    showScreen('screen-game');
    renderHUD();
    FX.setCorruptionLevel(0);
    FX.startMonitorNoiseLoop();
    State.running = true;
    renderCurrentPhase();
    AudioEngine.startAmbient();
  }

  function stopGameLoops() {
    stopTimer();
    stopQuestionTimer();
    cleanupRhythmStage();
    AudioEngine.stopAmbient();
    FX.stopMonitorNoiseLoop();
    State.running = false;
  }

  /* ------------------------------------------------------------------
     12b. MENU DE PAUSA — pausa o jogo (cronômetro geral + cronômetro
     da fase, sem perder o tempo já decorrido) e oferece continuar,
     reiniciar a partida do zero (mesma dificuldade) ou voltar ao menu
     principal. Só abre durante o jogo de verdade — não durante o
     cartão de capítulo entre fases nem durante a cutscene do chefão.
     ------------------------------------------------------------------ */
  function isPauseAvailable() {
    if (!State.running) return false;
    const titleCard = $('#phase-title-card');
    if (titleCard && !titleCard.hidden) return false;
    if (!$('#screen-game').classList.contains('active')) return false;
    return true;
  }

  function openPauseMenu() {
    if (!isPauseAvailable()) return;
    const overlay = $('#pause-overlay');
    if (!overlay.hidden) return;
    stopTimer();
    pauseQuestionTimer();
    AudioEngine.stopAmbient();
    FX.stopMonitorNoiseLoop();
    overlay.hidden = false;
  }

  function closePauseMenu() {
    const overlay = $('#pause-overlay');
    if (overlay.hidden) return;
    overlay.hidden = true;
    startTimer();
    resumeQuestionTimer();
    AudioEngine.startAmbient();
    FX.startMonitorNoiseLoop();
  }

  function restartFromPause() {
    $('#pause-overlay').hidden = true;
    beginGame(State.difficulty);
  }

  function quitToMenuFromPause() {
    $('#pause-overlay').hidden = true;
    stopGameLoops();
    showScreen('screen-menu');
  }

  // Sequências narrativas do desfecho trágico — variam conforme a causa da queda.
  const GAMEOVER_SEQUENCES = {
    time: [
      { text: 'O relógio do terminal chegou a 00:00.', cls: '' },
      { text: 'A tela piscou duas vezes e parou de responder ao teclado.', cls: '' },
      { text: 'Você ouve um clique atrás de você. Não havia porta ali antes.', cls: 'line-danger' },
      { text: 'O Arquiteto não fala mais em requisitos.', cls: 'line-dim' },
    ],
    integrity: [
      { text: 'A barra de integridade chegou a zero.', cls: '' },
      { text: 'O monitor racha de verdade agora. Você ouve o vidro.', cls: '' },
      { text: 'As luzes da sala, que você nem sabia que existiam, se apagam.', cls: '' },
      { text: 'Na tela, uma última linha de texto pisca antes do resto morrer.', cls: 'line-danger' },
    ],
  };

  // Mantém a linha mais nova do #victory-typed sempre no meio da tela
  // enquanto o texto "sobe" (efeito teleprompter) — resolve o bug de
  // texto descentralizado/grudado embaixo durante a digitação.
  let victoryAutoScrollObserver = null;
  function ensureVictoryAutoScroll() {
    const typedEl = $('#victory-typed');
    if (!typedEl) return;
    if (victoryAutoScrollObserver) victoryAutoScrollObserver.disconnect();
    victoryAutoScrollObserver = new MutationObserver((mutations) => {
      let lastNode = null;
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => { if (n.nodeType === 1) lastNode = n; });
      });
      if (lastNode) lastNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    victoryAutoScrollObserver.observe(typedEl, { childList: true, subtree: true });
  }
  function stopVictoryAutoScroll() {
    if (victoryAutoScrollObserver) { victoryAutoScrollObserver.disconnect(); victoryAutoScrollObserver = null; }
  }

  function typeText(el, text, speed = 22) {
    return new Promise((resolve) => {
      let i = 0;
      el.textContent = '';
      const tick = () => {
        el.textContent += text[i];
        i += 1;
        if (i < text.length) {
          setTimeout(tick, speed + (Math.random() < 0.08 ? 120 : 0));
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  async function runGameOverSequence(causeKey) {
    const typedEl = $('#gameover-typed');
    const victimsBlock = $('#victims-block');
    const victimsList = $('#victims-list');
    const finalEl = $('#gameover-final');
    const restartBtn = $('#btn-restart');

    typedEl.innerHTML = '';
    finalEl.textContent = '';
    victimsBlock.hidden = true;
    victimsList.innerHTML = '';
    restartBtn.hidden = true;

    const lines = GAMEOVER_SEQUENCES[causeKey] || GAMEOVER_SEQUENCES.integrity;

    for (const line of lines) {
      const p = document.createElement('p');
      if (line.cls) p.className = line.cls;
      typedEl.appendChild(p);
      AudioEngine.staticBurst(0.18);
      // eslint-disable-next-line no-await-in-loop
      await typeText(p, line.text, 20);
      FX.glitchPulse();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 450));
    }

    // Lista de "outros usuários" ainda presos no terminal — usa nomes salvos
    // no ranking (de partidas anteriores neste mesmo navegador) para dar a
    // sensação incômoda de continuidade entre jogadores.
    await new Promise((r) => setTimeout(r, 400));
    const priorNames = loadRanking().map((e) => e.name);
    const fallbackNames = ['ANALISTA_07', 'GERENTE_DE_PROJETO_03', 'DEV_SEM_NOME', 'CLIENTE_INSATISFEITO'];
    const namesPool = shuffle(priorNames.length ? priorNames : fallbackNames).slice(0, 4);
    if (namesPool.length === 0) namesPool.push('USUÁRIO_DESCONHECIDO');

    victimsBlock.hidden = false;
    AudioEngine.staticBurst(0.3);
    namesPool.forEach((name) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = name;
      const status = document.createElement('span');
      status.className = 'victim-status';
      status.textContent = 'AINDA CONECTADO';
      li.appendChild(label);
      li.appendChild(status);
      victimsList.appendChild(li);
    });

    await new Promise((r) => setTimeout(r, 500));
    const you = document.createElement('li');
    you.className = 'is-you';
    const youLabel = document.createElement('span');
    youLabel.textContent = 'VOCÊ';
    const youStatus = document.createElement('span');
    youStatus.className = 'victim-status';
    youStatus.textContent = 'CONECTANDO...';
    you.appendChild(youLabel);
    you.appendChild(youStatus);
    victimsList.appendChild(you);
    FX.shake();
    AudioEngine.alarm();

    await new Promise((r) => setTimeout(r, 1400));
    await typeText(finalEl, 'O Arquiteto sorri. Você não foi o primeiro.', 28);
    await new Promise((r) => setTimeout(r, 900));
    FX.blackout(1200);
    await new Promise((r) => setTimeout(r, 1200));
    restartBtn.hidden = false;
  }

  function triggerGameOver(causeKey) {
    if (!State.running) return;
    stopGameLoops();
    FX.setCorruptionLevel(3);
    AudioEngine.alarm();
    AudioEngine.staticBurst(0.6);
    FX.blackout(1200);
    recordGameEnd({ won: false });
    setTimeout(() => {
      showScreen('screen-gameover');
      if ((DIFFICULTIES[State.difficulty] || {}).noStory) {
        runQuickGameOver(causeKey);
      } else {
        runGameOverSequence(causeKey);
      }
    }, 900);
  }

  function computeScore() {
    const precision = State.totalAnswers > 0 ? State.correctAnswers / State.totalAnswers : 1;
    const timeBonus = Math.round((State.timeLeft / State.totalTime) * 400);
    const integrityBonus = Math.round((State.integrity / State.totalIntegritySegments) * 400);
    const precisionBonus = Math.round(precision * 200);
    const multiplier = DIFFICULTIES[State.difficulty].scoreMultiplier;
    return {
      precision,
      score: clamp(Math.round((timeBonus + integrityBonus + precisionBonus) * multiplier), 0, 1200),
    };
  }

  /* ------------------------------------------------------------------
     REVELAÇÃO DA SIGLA — C.O.N.T.R.A.
     O que a sigla significa só é decodificado de verdade na tela de
     vitória, e o quanto dela aparece depende da dificuldade escolhida:
       - Fácil:  a decodificação BUGA e não mostra nada — vai direto
                 pro placar/ranking.
       - Médio:  decodificação parcial — algumas palavras aparecem,
                 outras continuam corrompidas.
       - Difícil: só é alcançada depois de derrotar o chefão (Fase 5),
                 e nesse ponto a sigla é revelada por completo.
     ------------------------------------------------------------------ */
  // Significado oficial da sigla, exatamente como definido no documento
  // de roteiro: cada linha é a letra + o resto da palavra (formando o
  // efeito visual "C.entral", "O.peracional de" etc.). Juntando todas as
  // linhas em ordem: "Central Operacional de Neutralização Tática
  // contra o Regime do Arquiteto".
  const CONTRA_ACRONYM = [
    { letter: 'C', rest: 'entral' },
    { letter: 'O', rest: 'peracional de' },
    { letter: 'N', rest: 'eutralização' },
    { letter: 'T', rest: 'ática contra o' },
    { letter: 'R', rest: 'egime do' },
    { letter: 'A', rest: 'rquiteto' },
  ];

  // revealMask: array de booleans (uma por letra) — true mostra a
  // palavra, false substitui por blocos corrompidos. Sem máscara,
  // revela tudo.
  function buildAcronymPhrase(revealMask) {
    return CONTRA_ACRONYM.map((item, i) => {
      const word = `${item.letter}${item.rest}`;
      const shown = !revealMask || revealMask[i];
      return shown ? word : '█'.repeat(Math.max(4, word.length - 2));
    }).join(' ');
  }

  async function revealAcronym(mode) {
    if (!mode) return;
    ensureVictoryAutoScroll();
    const typedEl = $('#victory-typed');

    const introP = document.createElement('p');
    introP.className = 'line-dim';
    typedEl.appendChild(introP);
    AudioEngine.staticBurst(0.15);
    await typeText(introP, 'DECODIFICANDO DESIGNAÇÃO: C.O.N.T.R.A....', 22);
    await new Promise((r) => setTimeout(r, 300));

    if (mode === 'none') {
      FX.glitchPulse($('.monitor-unit'));
      AudioEngine.staticBurst(0.35);
      const errP = document.createElement('p');
      errP.className = 'line-danger';
      typedEl.appendChild(errP);
      await typeText(errP, '##ERRO DE LEITURA## — REGISTRO CORROMPIDO. SIGLA NÃO RECUPERADA.', 20);
      return;
    }

    if (mode === 'partial') {
      FX.glitchPulse($('.monitor-unit'));
      AudioEngine.staticBurst(0.22);
      const mask = [true, true, true, false, false, false];
      const phrase = buildAcronymPhrase(mask);
      const p = document.createElement('p');
      p.className = 'line-dim';
      typedEl.appendChild(p);
      await typeText(p, `C.O.N.T.R.A. = ${phrase.toUpperCase()}`, 18);
      const warn = document.createElement('p');
      warn.className = 'line-danger';
      typedEl.appendChild(warn);
      await typeText(warn, 'RESTO DO REGISTRO CONTINUA CORROMPIDO.', 20);
      return;
    }

    // mode === 'full' — só na Difícil, depois de vencer o chefão.
    // Sequência de "deleção": banner, o significado revelado linha por
    // linha (cada uma no formato letra + resto da palavra), e a
    // confirmação final.
    FX.glitchPulse($('.monitor-unit'));
    AudioEngine.staticBurst(0.3);
    const delP = document.createElement('p');
    delP.className = 'line-danger';
    typedEl.appendChild(delP);
    await typeText(delP, 'C.O.N.T.R.A. DELETANDO...', 20);
    await new Promise((r) => setTimeout(r, 400));

    const blockWrap = document.createElement('div');
    blockWrap.className = 'acronym-block';
    typedEl.appendChild(blockWrap);
    for (const item of CONTRA_ACRONYM) {
      const line = document.createElement('p');
      line.className = 'line-secret line-acronym';
      blockWrap.appendChild(line);
      AudioEngine.staticBurst(0.08);
      // eslint-disable-next-line no-await-in-loop
      await typeText(line, `${item.letter}.${item.rest}`, 22);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 130));
    }
    await new Promise((r) => setTimeout(r, 300));

    const doneP = document.createElement('p');
    doneP.className = 'line-secret';
    typedEl.appendChild(doneP);
    await typeText(doneP, 'C.O.N.T.R.A. — 100% DELETADO', 20);

    // A partir daqui: a "Falsa Vitória". Pequeno helper local só pra não
    // repetir a mesma sequência de criar <p>, digitar e pausar.
    const addLine = async (text, cls, speed = 20, pause = 300) => {
      const p = document.createElement('p');
      p.className = cls;
      typedEl.appendChild(p);
      await typeText(p, text, speed);
      await new Promise((r) => setTimeout(r, pause));
    };

    await new Promise((r) => setTimeout(r, 500));
    await addLine('Silêncio.', 'line-dim', 26, 400);

    await addLine('[ARQUITETO]: "Obrigado..."', 'line-danger', 26, 300);
    FX.glitchPulse($('.monitor-unit'));
    AudioEngine.staticBurst(0.4);
    await addLine('"...hahaha."', 'line-danger', 26, 450);

    FX.glitchPulse($('.monitor-unit'));
    AudioEngine.staticBurst(0.55);
    await addLine('VOCÊ FOI ENGANADO.', 'line-danger line-reveal-title', 32, 450);

    const explainLines = [
      'O C.O.N.T.R.A. não era a corrupção.',
      'Ele era a única entidade que estava tentando impedir o Arquiteto.',
      'Durante as quatro primeiras fases, você acreditava que estava recuperando o sistema.',
      'Mas, na realidade, estava alimentando o Arquiteto.',
      'Cada arquivo recuperado. Cada documento organizado. Cada requisito analisado. Cada registro selecionado.',
      'Tudo estava sendo enviado para o núcleo do Arquiteto.',
      'E agora... C.O.N.T.R.A. está morto.',
      'A única coisa que impedia o Arquiteto de assumir completamente o sistema desapareceu.',
    ];
    // eslint-disable-next-line no-restricted-syntax
    for (const line of explainLines) {
      // eslint-disable-next-line no-await-in-loop
      await addLine(line, 'line-dim', 14, 130);
    }
    await new Promise((r) => setTimeout(r, 350));

    const architectLines = [
      '"Você fez exatamente o que eu precisava."',
      '"Recuperou meus dados."',
      '"Reconstruiu meus arquivos."',
      '"Encontrou minhas informações."',
      '"E finalmente..."',
      '"...eliminou a única coisa que podia me impedir."',
    ];
    // eslint-disable-next-line no-restricted-syntax
    for (const line of architectLines) {
      // eslint-disable-next-line no-await-in-loop
      await addLine(line, 'line-danger', 20, 170);
    }
    await new Promise((r) => setTimeout(r, 400));

    FX.glitchPulse($('.monitor-unit'));
    FX.shake($('.monitor-unit'));
    AudioEngine.staticBurst(0.6);
    await addLine('SISTEMA COMPROMETIDO', 'line-danger', 24, 250);
    await addLine('ARQUITETO — CONTROLE TOTAL', 'line-danger', 24, 500);
    await addLine('O verdadeiro confronto começa agora.', 'line-dim', 20, 350);

    // Em vez de rodar uma "Fase 5" jogável, o confronto final é
    // anunciado aqui mesmo, na tela de revelação: liberamos o modo
    // secreto O Arquiteto e avisamos que é lá que ele vai acontecer.
    // Ver goToNextPhase() — depois desta cutscene o jogo vai direto
    // pra tela de vitória, sem passar por nenhuma "tela de fase final".
    unlockArchitectMode();
    await new Promise((r) => setTimeout(r, 400));
    FX.glitchPulse($('.monitor-unit'));
    AudioEngine.staticBurst(0.45);
    await addLine('🔓 O ARQUITETO LIBERADO', 'line-secret line-reveal-title', 24, 400);
    await addLine('É lá que o confronto final contra ele vai acontecer.', 'line-dim', 18, 350);
    await new Promise((r) => setTimeout(r, 300));
    FX.glitchPulse($('.monitor-unit'));
    AudioEngine.staticBurst(0.3);
    await addLine('O Arquiteto está à sua espera.', 'line-danger line-reveal-title', 22, 400);
  }

  function getAcronymMode() {
    const diff = DIFFICULTIES[State.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    // Na Difícil a sigla já foi revelada por completo na cutscene entre
    // a Fase 4 e a Fase 5 (ver triggerBossReveal) — não roda de novo aqui.
    if (diff.hasBoss) return null;
    return State.difficulty === 'facil' ? 'none' : 'partial'; // médio
  }

  const VICTORY_MONOLOGUE = [
    'A tela para de tremer.',
    '"Você acredita que venceu porque resolveu enigmas."',
    '"Está enganado."',
    '"Você venceu porque ouviu antes de programar."',
    { text: 'Um som metálico. Uma fresta de luz aparece na parede onde não havia nada.', cls: 'line-dim' },
  ];

  // Três desfechos possíveis nas dificuldades sem chefão (Fácil e
  // Médio), definidos pelo desempenho do jogador. Aqui a vitória é só
  // a eliminação do C.O.N.T.R.A. (fim da Fase 4) — SEM revelar a
  // reviravolta da história. A verdade (você foi enganado, o Arquiteto
  // era a ameaça real) só é contada na Difícil, ao entrar na Fase 5 e
  // no Final Verdadeiro (ver ENDINGS.trueVictory).
  const ENDINGS = {
    perfect: {
      titleClass: 'ending-perfect',
      title: 'C.O.N.T.R.A. ELIMINADO — SEM FALHAS',
      sub: 'Você recuperou os dados, atravessou o firewall e eliminou o C.O.N.T.R.A. sem deixar margem para erro.',
      eerie: 'A tela para de tremer. Mas algo nela ainda parece satisfeito demais.',
      monologue: [
        'A tela para de tremer.',
        '"Você eliminou o C.O.N.T.R.A."',
        'Firewall desativado. Sistema estabilizado.',
        { text: 'Você sai do TERMINAL-9 sem deixar margem para erro.', cls: 'line-dim' },
      ],
    },
    normal: {
      titleClass: '',
      title: 'PARABÉNS',
      sub: 'Você chegou até o C.O.N.T.R.A. e o eliminou — com algumas cicatrizes pelo caminho.',
      eerie: 'A sala fica em silêncio. Só o monitor continua ligado, esperando a próxima atualização.',
      monologue: [
        'A tela para de tremer.',
        '"Você eliminou o C.O.N.T.R.A."',
        'O sistema volta a responder normalmente.',
        { text: 'Você sai do TERMINAL-9 com algumas cicatrizes, mas de pé.', cls: 'line-dim' },
      ],
    },
    dark: {
      titleClass: 'ending-dark',
      title: 'VOCÊ VENCEU. POR POUCO.',
      sub: 'A vitória veio raspando — muitos erros, pouca integridade sobrando. Mesmo assim, o C.O.N.T.R.A. caiu.',
      eerie: 'A tela pisca antes de apagar de vez. Alguma coisa nos dados ainda parece... incompleta.',
      monologue: [
        'A tela para de tremer, mas não param os riscos nela.',
        '"Você eliminou o C.O.N.T.R.A."',
        'O sistema volta a responder, por pouco.',
        { text: 'Você sai do TERMINAL-9 raspando — mas sai.', cls: 'line-danger' },
      ],
    },
    secret: {
      titleClass: 'ending-secret',
      title: 'ACESSO CONCEDIDO',
      sub: 'Zero erros. Nenhuma hesitação. Isso nunca tinha acontecido antes.',
      eerie: 'A tela não mostra um final. Ela mostra uma pergunta.',
      monologue: [
        'A tela para de tremer.',
        '"Depois de milhares de candidatos..."',
        '"...encontrei um sucessor."',
        { text: '"O que sou eu, afinal?"', cls: 'line-secret' },
      ],
      finalCursor: 'Aguardando…',
    },
    // trueVictory: usado como a "falsa vitória" mostrada logo depois da
    // Fase 4 na Difícil (ver triggerBossReveal) — antes da revelação de
    // verdade. Título só, sem monólogo: a tela abre "normal" e é a
    // cutscene do revealAcronym() modo 'full' que carrega toda a
    // reviravolta, o anúncio do Modo Impossível e o placar (ver
    // revealScoreInPlace). O Arquiteto não é derrotado nessa tela —
    // só no Modo Impossível.
    trueVictory: {
      titleClass: '',
      title: 'VITÓRIA',
      sub: 'C.O.N.T.R.A. está morto. O Arquiteto tem controle total. Isto não deveria se chamar vitória.',
      eerie: 'O verdadeiro confronto ainda não aconteceu.',
      monologue: [],
    },
  };

  function getEndingTier() {
    const precision = State.totalAnswers > 0 ? State.correctAnswers / State.totalAnswers : 1;
    const timeRatio = State.totalTime > 0 ? State.timeLeft / State.totalTime : 0;
    const integrityRatio = State.totalIntegritySegments > 0 ? State.integrity / State.totalIntegritySegments : 1;
    // Final Secreto: zero erros, precisão máxima e sobrou bastante tempo no relógio.
    if (State.mistakes === 0 && precision >= 0.999 && timeRatio >= 0.5) return 'secret';
    // Final Verdadeiro: poucos erros, integridade quase intacta (proporcional à dificuldade).
    if (integrityRatio >= 0.85 && State.mistakes <= 2) return 'perfect';
    // Final Bom: venceu, mas com cicatrizes visíveis.
    if (integrityRatio >= 0.45) return 'normal';
    // Ainda uma vitória (game over é um desfecho à parte), mas raspando.
    return 'dark';
  }

  async function runVictoryMonologue(ending, acronymMode) {
    const typedEl = $('#victory-typed');
    const reveal = $('#victory-reveal');
    typedEl.innerHTML = '';
    typedEl.classList.remove('no-scroll-pad');
    reveal.hidden = true;
    ensureVictoryAutoScroll();

    for (const raw of ending.monologue) {
      const line = typeof raw === 'string' ? { text: raw, cls: '' } : raw;
      const p = document.createElement('p');
      if (line.cls) p.className = line.cls;
      typedEl.appendChild(p);
      AudioEngine.staticBurst(0.12);
      // eslint-disable-next-line no-await-in-loop
      await typeText(p, line.text, 22);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 300));
    }

    await new Promise((r) => setTimeout(r, 250));
    FX.whiteFlash(400);
    AudioEngine.metalDoor();
    await new Promise((r) => setTimeout(r, 300));

    // Tentativa de decodificar a sigla C.O.N.T.R.A. — não roda no Final
    // Secreto, que já tem seu próprio fechamento enigmático.
    if (acronymMode && !ending.finalCursor) {
      await revealAcronym(acronymMode);
      await new Promise((r) => setTimeout(r, 300));
    }

    if (ending.finalCursor) {
      // Sequência exclusiva do Final Secreto: tela preta, só um cursor piscando.
      typedEl.innerHTML = '';
      const cursorLine = document.createElement('p');
      cursorLine.className = 'line-cursor';
      typedEl.appendChild(cursorLine);
      AudioEngine.staticBurst(0.1);
      await typeText(cursorLine, ending.finalCursor, 26);
      const blinkSpan = document.createElement('span');
      blinkSpan.className = 'blink-cursor';
      blinkSpan.textContent = '█';
      cursorLine.appendChild(blinkSpan);
      await new Promise((r) => setTimeout(r, 1400));
    }

    // Encerra o "modo teleprompter": some com o espaço extra embaixo e
    // rola pra revelação final (rank/pontuação) ficar visível de cara.
    stopVictoryAutoScroll();
    typedEl.classList.add('no-scroll-pad');
    reveal.hidden = false;
    requestAnimationFrame(() => reveal.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }


  function triggerVictory() {
    stopGameLoops();
    const { precision, score } = computeScore();
    const tier = getEndingTier();
    // No fluxo normal (Fácil/Médio) o final depende do desempenho. Na
    // Difícil, esta função só é chamada pelo Final Secreto (zero erros
    // na partida inteira) — ele se sobrepõe a qualquer rota, inclusive
    // à revelação do C.O.N.T.R.A. (que já rodou antes, em
    // triggerBossReveal, junto com o placar — ver revealScoreInPlace).
    const justBeatBoss = (DIFFICULTIES[State.difficulty] || {}).hasBoss;
    const ending = tier === 'secret' ? ENDINGS.secret : ENDINGS[tier];
    const acronymMode = (tier === 'secret' || justBeatBoss) ? null : getAcronymMode();

    recordGameEnd({ won: true, score });
    // Vencer na Difícil libera o modo secreto "O Arquiteto" na tela de
    // seleção de dificuldade (ver isArchitectUnlocked/refreshDifficultyOptions).
    if (State.difficulty === 'dificil') unlockArchitectMode();

    const titleEl = $('#victory-title');
    titleEl.textContent = ending.title;
    titleEl.className = 'victory-title' + (ending.titleClass ? ` ${ending.titleClass}` : '');
    $('#victory-sub').textContent = ending.sub;
    $('#victory-eerie').textContent = ending.eerie;

    $('#v-time').textContent = formatTime(State.timeLeft);
    $('#v-errors').textContent = String(State.mistakes);
    $('#v-integrity').textContent = `${State.integrity} / ${State.totalIntegritySegments}`;
    $('#v-precision').textContent = `${Math.round(precision * 100)}%`;
    $('#v-score').textContent = String(score);
    autoSaveScore(score);
    if ($('#impossible-hall')) $('#impossible-hall').hidden = true;
    // Garante o texto padrão do botão único da tela de vitória — só a
    // corrida do Impossível (ver finishImpossibleRun) o troca pra
    // "CONTINUAR".
    const playAgainBtn = $('#btn-play-again');
    if (playAgainBtn) playAgainBtn.textContent = 'JOGAR NOVAMENTE';

    showScreen('screen-victory');
    AudioEngine.success();
    runVictoryMonologue(ending, acronymMode);
  }

  // Etapa final da dificuldade Impossível: as 4 fases de sempre já
  // acabaram, sem cutscene nenhuma — agora é O Arquiteto, o mesmo
  // minigame de ritmo do modo secreto, só que com uma única vida (ver
  // GuitarHero.open({ oneLife: true }) e markMissed()). Sem narrativa
  // nenhuma aqui: nem intro, nem monólogo de vitória.
  function startFinalRhythmGauntlet() {
    stopGameLoops();
    showScreen('screen-guitarhero');
    GuitarHero.open({ oneLife: true, final: true, onFinalEnd: finishImpossibleRun });
  }

  // Fecha a dificuldade Impossível assim que a etapa de ritmo termina
  // (venceu ou falhou) — direto pra tela de placar, sem monólogo, sem
  // revelação, sem história: só os números da partida.
  function finishImpossibleRun(rhythmStats) {
    // Desliga música/RAF/teclado e limpa a tela do chefão por completo
    // antes de trocar de tela — sem isso, é possível a tela de ritmo
    // ficar "pendurada" por baixo (áudio ainda tocando, overlay antigo
    // ainda com estado de uma etapa anterior) e dar a impressão de que
    // ela simplesmente fechou/travou em vez de levar até o resultado.
    GuitarHero.stopAndCleanup();

    const { cause, score: rhythmScore, bestCombo, accuracy } = rhythmStats;
    const won = cause === 'complete';
    const { precision, score: baseScore } = computeScore();
    const finalScore = baseScore + Math.round(rhythmScore / 2);
    State.finalScoreOverride = finalScore;
    recordGameEnd({ won, score: finalScore });

    const titleEl = $('#victory-title');
    titleEl.textContent = won ? 'IMPOSSÍVEL — VOCÊ SOBREVIVEU' : 'IMPOSSÍVEL — VOCÊ CAIU';
    titleEl.className = 'victory-title' + (won ? '' : ' ending-dark');
    $('#victory-sub').textContent = won
      ? 'Quatro fases, uma vida, zero folga. Você concluiu a faixa inteira sem falhar uma vez.'
      : 'Você chegou até O Arquiteto — mas com uma única vida, um erro basta.';
    $('#victory-eerie').textContent = `Combo máximo no ritmo: ${bestCombo}x · Precisão no ritmo: ${accuracy}%`;

    $('#v-time').textContent = formatTime(State.timeLeft);
    $('#v-errors').textContent = String(State.mistakes);
    $('#v-integrity').textContent = `${State.integrity} / ${State.totalIntegritySegments}`;
    $('#v-precision').textContent = `${Math.round(precision * 100)}%`;
    $('#v-score').textContent = String(finalScore);
    // Só registra no ranking se a etapa final foi vencida — cair pra
    // ela não conta pontuação como um resultado "oficial" da corrida.
    if (won) {
      autoSaveScore(finalScore);
      const session = loadSession();
      revealImpossibleHallOfFame((session?.nickname || 'ANÔNIMO').toUpperCase());
    } else {
      const statusEl = $('#score-save-status');
      if (statusEl) { statusEl.className = 'victory-save-status'; statusEl.textContent = ''; }
      const hallEl = $('#impossible-hall');
      if (hallEl) hallEl.hidden = true;
    }

    // Ao fim do Impossível (venceu ou caiu) não existe "jogar de novo"
    // com um clique — a corrida inteira (4 fases + chefão de vida
    // única) precisa recomeçar do zero. Por isso o único botão dessa
    // tela vira "CONTINUAR": um único caminho claro pra sair do
    // resultado, sem sugerir um replay rápido que não existe. Volta ao
    // texto padrão ("JOGAR NOVAMENTE") assim que outra tela de vitória
    // for montada — ver runVictoryMonologue/triggerBossReveal.
    const playAgainBtn = $('#btn-play-again');
    if (playAgainBtn) playAgainBtn.textContent = 'CONTINUAR';

    showScreen('screen-victory');
    AudioEngine.success();

    stopVictoryAutoScroll();
    const typedEl = $('#victory-typed');
    const reveal = $('#victory-reveal');
    typedEl.innerHTML = '';
    typedEl.classList.add('no-scroll-pad');
    reveal.hidden = false;
    requestAnimationFrame(() => reveal.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }


  // Fim de jogo "seco" — só pra dificuldade Impossível: nada de sequência
  // narrativa digitada, nada de lista de vítimas. Só a causa e o botão
  // pra tentar de novo, na hora.
  function runQuickGameOver(causeKey) {
    const typedEl = $('#gameover-typed');
    const victimsBlock = $('#victims-block');
    const victimsList = $('#victims-list');
    const finalEl = $('#gameover-final');
    const restartBtn = $('#btn-restart');

    victimsBlock.hidden = true;
    victimsList.innerHTML = '';
    const line = causeKey === 'time'
      ? 'O tempo acabou antes da 4ª fase.'
      : 'A integridade chegou a zero antes da 4ª fase.';
    typedEl.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = line;
    typedEl.appendChild(p);
    finalEl.textContent = 'IMPOSSÍVEL — tente de novo.';
    restartBtn.hidden = false;
  }

  function loadRanking() {
    try {
      return JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
    } catch (e) { return []; }
  }
  function saveRanking(list) {
    try { localStorage.setItem(RANKING_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // Mantém só o melhor registro de cada jogador POR dificuldade: se já
  // existe uma entrada com o mesmo nome+dificuldade, ela só é
  // substituída quando a pontuação nova é maior. Devolve `true` quando
  // a lista foi alterada (registro novo ou recorde batido).
  function upsertBestEntry(list, entry) {
    const idx = list.findIndex((e) => e.difficulty === entry.difficulty
      && (e.name || '').toLowerCase() === entry.name.toLowerCase());
    if (idx === -1) { list.push(entry); return true; }
    if (entry.score > list[idx].score) { list[idx] = entry; return true; }
    return false;
  }

  function saveScoreIfBest(entry) {
    const list = loadRanking();
    const changed = upsertBestEntry(list, entry);
    if (changed) saveRanking(list);
    return changed;
  }

  // -- Ranking global: busca e grava só a lista de pontuações no JSONBin,
  //    preservando as contas de usuário que estejam no mesmo bin. Se não
  //    estiver configurado (ou a rede falhar), cai pro ranking local.
  async function fetchGlobalRanking() {
    const record = await fetchBinRecord();
    if (!record) return null;
    return Array.isArray(record.scores) ? record.scores : [];
  }

  async function pushGlobalScoreIfBest(entry) {
    if (!JSONBIN_CONFIGURED) return { configured: false, changed: false };
    const record = (await fetchBinRecord()) || {};
    const scores = Array.isArray(record.scores) ? record.scores : [];
    const changed = upsertBestEntry(scores, entry);
    if (!changed) return { configured: true, changed: false };
    const updated = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_GLOBAL_ENTRIES);
    const ok = await writeBinRecord({ ...record, scores: updated });
    return { configured: true, changed: ok };
  }

  // Salva a pontuação da partida automaticamente assim que o placar é
  // revelado (sem botão manual, sem editar o apelido — usa sempre o
  // apelido da conta logada). Só sobrescreve o registro existente do
  // jogador NAQUELA dificuldade se a pontuação nova for maior que a
  // salva antes; senão, o recorde antigo é mantido como está.
  // `statusSelector` deixa reaproveitar a mesma função em telas
  // diferentes (vitória normal vs. resultado do minigame de ritmo
  // avulso "O Arquiteto", que usa sua própria tela de resultado).
  async function autoSaveScore(score, statusSelector = '#score-save-status') {
    const statusEl = $(statusSelector);
    const session = loadSession();
    const nickname = (session?.nickname || 'ANÔNIMO').toUpperCase();
    const diffLabel = (DIFFICULTIES[State.difficulty] || {}).label || String(State.difficulty).toUpperCase();
    const entry = { name: nickname, score, difficulty: State.difficulty, date: new Date().toISOString() };

    if (statusEl) {
      statusEl.className = 'victory-save-status status-pending';
      statusEl.textContent = 'Salvando pontuação…';
    }

    const improvedLocal = saveScoreIfBest(entry);
    const globalResult = await pushGlobalScoreIfBest(entry);

    if (!statusEl) return;
    statusEl.className = 'victory-save-status';
    if (improvedLocal || globalResult.changed) {
      statusEl.textContent = `Novo recorde salvo no ranking — ${diffLabel} (${nickname}).`;
    } else {
      statusEl.textContent = `Pontuação (${score}) não superou seu recorde salvo em ${diffLabel} — mantendo o melhor registrado.`;
    }
  }

  let rankingCache = []; // última lista carregada (local ou global), pra filtrar sem refetch
  let hallCache = [];    // Salão da Fama do modo Impossível (ordem de quem derrotou O Arquiteto)
  // Dificuldade exibida no momento na tela de Ranking — cada dificuldade
  // tem sua própria lista, separada por abas (ver renderRankingScreen).
  let currentRankingDifficulty = 'facil';

  // ---------------------------------------------------------------------
  // SALÃO DA FAMA — modo Impossível. Diferente do ranking por pontuação
  // das outras dificuldades, aqui o que importa é a ORDEM em que cada
  // jogador derrotou O Arquiteto pela primeira vez — não a pontuação.
  // Cada nome aparece só uma vez (nunca repete), na posição em que
  // completou o modo pela primeira vez.
  // ---------------------------------------------------------------------
  function loadHall() {
    try { return JSON.parse(localStorage.getItem(HALL_KEY)) || []; } catch (e) { return []; }
  }
  function saveHall(list) {
    try { localStorage.setItem(HALL_KEY, JSON.stringify(list)); } catch (e) {}
  }
  async function fetchGlobalHall() {
    const record = await fetchBinRecord();
    if (!record) return null;
    return Array.isArray(record.impossibleHall) ? record.impossibleHall : [];
  }

  // Adiciona `name` à lista só se ele ainda não estiver nela (comparação
  // sem diferenciar maiúsc./minúsc.). Devolve a lista (nova, se mudou) e
  // se foi uma adição nova, pra decidir se "escreve" o nome na hora ou só
  // mostra a lista como já estava.
  function addToHall(list, name) {
    const idx = list.findIndex((e) => (e.name || '').toLowerCase() === name.toLowerCase());
    if (idx !== -1) return { list, isNew: false, position: idx + 1 };
    const updated = [...list, { name, date: new Date().toISOString() }];
    return { list: updated, isNew: true, position: updated.length };
  }

  // Registra `name` no Salão da Fama — local sempre (funciona offline) e
  // no ranking global também, se configurado. Devolve a lista final e se
  // essa chamada acabou de adicionar um nome novo (pra "escrever" ele).
  async function registerHallOfFame(name) {
    const localResult = addToHall(loadHall(), name);
    if (localResult.isNew) saveHall(localResult.list);

    if (!JSONBIN_CONFIGURED) return localResult;

    const record = (await fetchBinRecord()) || {};
    const globalList = Array.isArray(record.impossibleHall) ? record.impossibleHall : [];
    const globalResult = addToHall(globalList, name);
    if (globalResult.isNew) await writeBinRecord({ ...record, impossibleHall: globalResult.list });
    return globalResult;
  }

  // ---------------------------------------------------------------------
  // ADMIN — reset e consolidação do ranking (uso manual, via console do
  // navegador). Não é exposto na interface de propósito: o ranking
  // global fica no mesmo JSONBin pra todo mundo que joga, então limpar
  // ou consolidar precisa ser uma ação deliberada de quem administra o
  // bin, não um botão que qualquer jogador possa apertar sem querer.
  //
  // Uso (abra o console do navegador — F12 — na tela do jogo e rode):
  //   ArquitetoAdmin.consolidarLocal()        → mantém só o recorde de
  //     cada jogador por dificuldade no ranking salvo NESTE navegador
  //     (localStorage), apagando entradas antigas duplicadas/inferiores.
  //   await ArquitetoAdmin.consolidarGlobal() → mesma limpeza, mas no
  //     ranking global (JSONBin) — afeta todo mundo. Precisa de rede.
  //   ArquitetoAdmin.resetarLocal()           → apaga TODO o ranking e
  //     o Salão da Fama salvos neste navegador (não mexe na conta).
  //   await ArquitetoAdmin.resetarGlobal()    → apaga TODAS as pontuações
  //     e o Salão da Fama do ranking global (JSONBin) — irreversível,
  //     afeta todo mundo que já jogou. Contas de usuário não são tocadas.
  //   await ArquitetoAdmin.resetarTudo()      → local + global de uma vez.
  // ---------------------------------------------------------------------

  // Mantém, dentro de uma lista de pontuações, só a maior por
  // nome+dificuldade (comparação sem diferenciar maiúsc./minúsc.) —
  // mesma regra de upsertBestEntry, mas aplicada de uma vez sobre uma
  // lista que pode ter ficado com duplicatas de antes dessa regra
  // existir. Devolve uma lista nova; não muda a original.
  function dedupeScoresToRecords(list) {
    const best = new Map();
    (Array.isArray(list) ? list : []).forEach((entry) => {
      if (!entry || !entry.name || !entry.difficulty) return;
      const key = `${entry.difficulty}::${entry.name.toLowerCase()}`;
      const current = best.get(key);
      if (!current || entry.score > current.score) best.set(key, entry);
    });
    return Array.from(best.values());
  }

  function consolidarRankingLocal() {
    const before = loadRanking();
    const after = dedupeScoresToRecords(before);
    saveRanking(after);
    const removed = before.length - after.length;
    console.log(`[ArquitetoAdmin] Ranking local consolidado: ${removed} entrada(s) antiga(s)/duplicada(s) removida(s), ${after.length} recorde(s) mantido(s).`);
    return after;
  }

  async function consolidarRankingGlobal() {
    if (!JSONBIN_CONFIGURED) {
      console.warn('[ArquitetoAdmin] JSONBin não configurado — não há ranking global pra consolidar.');
      return null;
    }
    const record = (await fetchBinRecord()) || {};
    const before = Array.isArray(record.scores) ? record.scores : [];
    const after = dedupeScoresToRecords(before)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_GLOBAL_ENTRIES);
    const ok = await writeBinRecord({ ...record, scores: after });
    if (ok) {
      console.log(`[ArquitetoAdmin] Ranking global consolidado: ${before.length - after.length} entrada(s) antiga(s)/duplicada(s) removida(s), ${after.length} recorde(s) mantido(s).`);
    } else {
      console.warn('[ArquitetoAdmin] Falha ao gravar o ranking global consolidado (ver rede/JSONBin).');
    }
    return ok ? after : null;
  }

  function resetarRankingLocal() {
    saveRanking([]);
    saveHall([]);
    console.log('[ArquitetoAdmin] Ranking e Salão da Fama locais (deste navegador) apagados.');
  }

  async function resetarRankingGlobal() {
    if (!JSONBIN_CONFIGURED) {
      console.warn('[ArquitetoAdmin] JSONBin não configurado — não há ranking global pra apagar.');
      return false;
    }
    const record = (await fetchBinRecord()) || {};
    const ok = await writeBinRecord({ ...record, scores: [], impossibleHall: [] });
    if (ok) console.log('[ArquitetoAdmin] Ranking e Salão da Fama globais (JSONBin) apagados. Contas de usuário mantidas.');
    else console.warn('[ArquitetoAdmin] Falha ao apagar o ranking global (ver rede/JSONBin).');
    return ok;
  }

  async function resetarRankingTudo() {
    resetarRankingLocal();
    await resetarRankingGlobal();
  }

  // Remove só UMA entrada específica (nome + dificuldade), em vez de
  // apagar o ranking inteiro — pra tirar um registro pontual (nome
  // errado, pontuação de teste etc.) sem afetar o resto. Comparação de
  // nome sem diferenciar maiúsc./minúsc., igual ao resto do ranking.
  function removerEntradaLocal(nome, dificuldade) {
    const before = loadRanking();
    const after = before.filter((e) => !(
      (e.name || '').toLowerCase() === String(nome).toLowerCase()
      && e.difficulty === dificuldade
    ));
    saveRanking(after);
    const removed = before.length - after.length;
    console.log(removed
      ? `[ArquitetoAdmin] Removida a entrada de "${nome}" em "${dificuldade}" do ranking local.`
      : `[ArquitetoAdmin] Nenhuma entrada de "${nome}" em "${dificuldade}" encontrada no ranking local.`);
    return after;
  }

  async function removerEntradaGlobal(nome, dificuldade) {
    if (!JSONBIN_CONFIGURED) {
      console.warn('[ArquitetoAdmin] JSONBin não configurado — não há ranking global pra editar.');
      return null;
    }
    const record = (await fetchBinRecord()) || {};
    const before = Array.isArray(record.scores) ? record.scores : [];
    const after = before.filter((e) => !(
      (e.name || '').toLowerCase() === String(nome).toLowerCase()
      && e.difficulty === dificuldade
    ));
    const ok = await writeBinRecord({ ...record, scores: after });
    const removed = before.length - after.length;
    if (ok) {
      console.log(removed
        ? `[ArquitetoAdmin] Removida a entrada de "${nome}" em "${dificuldade}" do ranking global.`
        : `[ArquitetoAdmin] Nenhuma entrada de "${nome}" em "${dificuldade}" encontrada no ranking global.`);
    } else {
      console.warn('[ArquitetoAdmin] Falha ao gravar a remoção no ranking global (ver rede/JSONBin).');
    }
    return ok ? after : null;
  }

  // Remove `nome` do Salão da Fama do modo Impossível (local e, se
  // configurado, global) — separado do ranking por pontuação.
  function removerDoHallLocal(nome) {
    const before = loadHall();
    const after = before.filter((e) => (e.name || '').toLowerCase() !== String(nome).toLowerCase());
    saveHall(after);
    console.log(before.length !== after.length
      ? `[ArquitetoAdmin] "${nome}" removido do Salão da Fama local.`
      : `[ArquitetoAdmin] "${nome}" não estava no Salão da Fama local.`);
    return after;
  }

  async function removerDoHallGlobal(nome) {
    if (!JSONBIN_CONFIGURED) {
      console.warn('[ArquitetoAdmin] JSONBin não configurado — não há Salão da Fama global pra editar.');
      return null;
    }
    const record = (await fetchBinRecord()) || {};
    const before = Array.isArray(record.impossibleHall) ? record.impossibleHall : [];
    const after = before.filter((e) => (e.name || '').toLowerCase() !== String(nome).toLowerCase());
    const ok = await writeBinRecord({ ...record, impossibleHall: after });
    if (ok) {
      console.log(before.length !== after.length
        ? `[ArquitetoAdmin] "${nome}" removido do Salão da Fama global.`
        : `[ArquitetoAdmin] "${nome}" não estava no Salão da Fama global.`);
    } else {
      console.warn('[ArquitetoAdmin] Falha ao gravar a remoção no Salão da Fama global (ver rede/JSONBin).');
    }
    return ok ? after : null;
  }

  window.ArquitetoAdmin = {
    consolidarLocal: consolidarRankingLocal,
    consolidarGlobal: consolidarRankingGlobal,
    resetarLocal: resetarRankingLocal,
    resetarGlobal: resetarRankingGlobal,
    resetarTudo: resetarRankingTudo,
    removerEntradaLocal,
    removerEntradaGlobal,
    removerDoHallLocal,
    removerDoHallGlobal,
  };

  // Mostra o Salão da Fama na tela de vitória do modo Impossível: os
  // nomes que já estavam lá aparecem direto, e — só se esse jogador
  // acabou de entrar pela primeira vez — o nome dele é "escrito" com
  // efeito de máquina de escrever ao final da lista.
  async function revealImpossibleHallOfFame(nickname) {
    const wrap = $('#impossible-hall');
    const listEl = $('#hall-list');
    if (!wrap || !listEl) return;
    wrap.hidden = false;
    listEl.innerHTML = '';

    const result = await registerHallOfFame(nickname);
    const entries = result.list;
    const newIdx = result.isNew ? entries.length - 1 : -1;

    for (let i = 0; i < entries.length; i++) {
      const li = document.createElement('li');
      li.className = 'hall-entry';
      listEl.appendChild(li);
      if (i === newIdx) {
        li.classList.add('hall-entry-new');
        await typeText(li, entries[i].name, 55);
      } else {
        li.textContent = entries[i].name;
        if (i === result.position - 1 && !result.isNew) li.classList.add('hall-entry-mine');
      }
    }
  }

  async function renderRankingScreen() {
    const tbody = $('#ranking-table-body');
    const noteEl = $('#ranking-source-note');
    tbody.innerHTML = '<tr><td colspan="5" class="ranking-empty">Carregando…</td></tr>';
    if (noteEl) noteEl.textContent = '';

    // Abre já na aba da dificuldade que acabou de ser jogada, se houver.
    if (DIFFICULTIES[State.difficulty]) currentRankingDifficulty = State.difficulty;
    $$('.ranking-diff-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.difficulty === currentRankingDifficulty);
    });

    let list;
    let isGlobal = false;
    if (JSONBIN_CONFIGURED) {
      const global = await fetchGlobalRanking();
      if (global) { list = global; isGlobal = true; }
    }
    if (!list) list = loadRanking();
    rankingCache = [...list].sort((a, b) => b.score - a.score);

    let hall = null;
    if (JSONBIN_CONFIGURED) hall = await fetchGlobalHall();
    hallCache = hall || loadHall();

    if (noteEl) {
      noteEl.textContent = isGlobal
        ? 'ranking global — todo mundo que jogou aparece aqui'
        : 'ranking local deste navegador (ranking global não configurado)';
    }
    renderRankingTable();
  }

  // Modo Impossível não usa a tabela de pontuação normal: mostra só o
  // nº1 (maior pontuação) em destaque como "melhor jogador", e o Salão
  // da Fama — a lista, na ordem em que cada jogador derrotou O
  // Arquiteto pela primeira vez, sem nomes repetidos.
  // Preenche uma <ol> com as entradas d'A Lista, sem efeito de máquina
  // de escrever (isso é exclusivo do instante em que alguém acaba de
  // passar — ver revealImpossibleHallOfFame). Destaca o nome do
  // jogador logado, se ele já estiver na lista.
  function renderHallEntries(listEl, entries, emptyMessage) {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!entries || entries.length === 0) {
      listEl.innerHTML = `<li class="ranking-empty">${emptyMessage}</li>`;
      return;
    }
    const session = loadSession();
    const myName = (session?.nickname || '').toLowerCase();
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'hall-entry';
      li.textContent = entry.name;
      if (myName && entry.name.toLowerCase() === myName) li.classList.add('hall-entry-mine');
      listEl.appendChild(li);
    });
  }

  function renderImpossibleRankingView() {
    const champion = rankingCache.find((e) => e.difficulty === 'impossivel');
    const nameEl = $('#champion-name');
    const scoreEl = $('#champion-score');
    if (nameEl) nameEl.textContent = champion ? champion.name : 'Ninguém ainda';
    if (scoreEl) scoreEl.textContent = champion ? `${champion.score} pts` : '';
    renderHallEntries($('#ranking-hall-list'), hallCache, 'Ninguém derrotou O Arquiteto ainda.');
  }

  // Carrega A Lista (global se configurado, senão local) uma vez e
  // devolve as entradas — usado tanto pela tela de ranking (Salão da
  // Fama do Impossível) quanto pela tela de créditos.
  async function loadHallEntries() {
    if (JSONBIN_CONFIGURED) {
      const global = await fetchGlobalHall();
      if (global) return global;
    }
    return loadHall();
  }

  // A Lista também aparece nos créditos, sempre atualizada ao abrir a tela.
  async function renderCreditsHall() {
    const entries = await loadHallEntries();
    renderHallEntries($('#credits-hall-list'), entries, 'Ninguém derrotou O Arquiteto ainda. Seja o primeiro.');
  }

  // Aplica a aba de dificuldade + pesquisa por nome sobre o cache já
  // carregado (RF06 tabela / RF07 filtro-pesquisa), sem precisar refetch.
  // Cada dificuldade é um ranking à parte — nunca mistura pontuações de
  // dificuldades diferentes na mesma lista.
  function renderRankingTable() {
    const tableWrap = $('#ranking-table-wrap');
    const filtersWrap = $('#ranking-filters');
    const impossibleView = $('#ranking-impossible-view');

    if (currentRankingDifficulty === 'impossivel') {
      if (tableWrap) tableWrap.hidden = true;
      if (filtersWrap) filtersWrap.hidden = true;
      if (impossibleView) impossibleView.hidden = false;
      renderImpossibleRankingView();
      return;
    }
    if (tableWrap) tableWrap.hidden = false;
    if (filtersWrap) filtersWrap.hidden = false;
    if (impossibleView) impossibleView.hidden = true;

    const tbody = $('#ranking-table-body');
    const search = ($('#ranking-search')?.value || '').trim().toLowerCase();

    const filtered = rankingCache.filter((entry) => {
      const matchesSearch = !search || entry.name.toLowerCase().includes(search);
      const matchesDiff = entry.difficulty === currentRankingDifficulty;
      return matchesSearch && matchesDiff;
    }).slice(0, 25);

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="ranking-empty">Nenhum registro encontrado.</td></tr>';
      return;
    }
    filtered.forEach((entry, i) => {
      const dateLabel = entry.date ? new Date(entry.date).toLocaleDateString('pt-BR') : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${entry.name}</td>
        <td>${entry.score} pts</td>
        <td>${dateLabel}</td>
        <td><span class="status-pill">SOBREVIVEU</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ------------------------------------------------------------------
     11b. MODO IMPOSSÍVEL — GUITAR HERO EM TELA CHEIA
     Minigame de ritmo independente do motor de fases, tocando a faixa
     real "Núcleo em Colapso" (ver BossMusic acima) através de um
     <audio> comum — sem passar pelo grafo do Web Audio API, então
     funciona igual com o jogo aberto direto do disco (file://) ou por
     um servidor local. O relógio da partida é a própria posição de
     reprodução do áudio (BossMusic.getTime()), não um timer separado:
     isso garante que as notas, os patamares de corrupção do palco e
     os pulsos de destruição fiquem sempre grudados no som de verdade,
     sem dessincronizar com o tempo.
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     11a. CHUVA DE CÓDIGO ESTILO "MATRIX" — camada extra de destruição
     visual da fase do chefão, desenhada em <canvas> por trás das
     raias. Colunas de glifos verde-fósforo caindo, com uma delas
     "acesa" (mais brilhante) por coluna — o clássico efeito Matrix.
     Intensidade (velocidade de queda + taxa de troca de caracteres)
     sobe junto com o patamar real de corrupção (setIntensity, chamado
     por GuitarHero.updateStageCorruption). Puramente decorativo, não
     afeta a jogabilidade nem o áudio.
     ------------------------------------------------------------------ */
  const MatrixRain = (() => {
    const CHARS = '01アイウエオカキクケコサシスセソ0123456789#$%&¬§ARQUITETO'.split('');
    let canvas = null, ctx = null, cols = [], speeds = [], rafId = null, running = false;
    let intensity = 0; // 0..4, controla velocidade e densidade de troca
    const FONT_SIZE = 15;

    function resize() {
      if (!canvas) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const colCount = Math.ceil(canvas.width / FONT_SIZE) + 1;
      cols = new Array(colCount).fill(0).map(() => rand(-40, 0));
      speeds = new Array(colCount).fill(0).map(() => rand(0.55, 1.15));
    }

    function draw() {
      if (!running || !ctx) return;
      const w = canvas.width, h = canvas.height;
      // rastro semitransparente por cima do frame anterior = efeito de cauda
      ctx.fillStyle = `rgba(5,5,6,${0.16 + intensity * 0.03})`;
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px var(--font-mono), monospace`;
      const speedMul = 1 + intensity * 0.55;
      cols.forEach((y, i) => {
        const x = i * FONT_SIZE;
        const ch = CHARS[randInt(0, CHARS.length - 1)];
        // caractere "de cabeça", mais brilhante — a ponta viva da coluna
        ctx.fillStyle = 'rgba(220,255,230,0.95)';
        ctx.fillText(ch, x, y);
        ctx.fillStyle = intensity >= 3 && Math.random() < 0.08
          ? 'rgba(255,60,70,0.85)' // glifo "infectado" de vermelho nos patamares altos
          : `rgba(57,255,122,${0.5 + intensity * 0.08})`;
        ctx.fillText(CHARS[randInt(0, CHARS.length - 1)], x, y - FONT_SIZE);
        cols[i] += speeds[i] * speedMul;
        if (cols[i] * FONT_SIZE > h && Math.random() > 0.975) cols[i] = rand(-20, 0);
      });
      rafId = requestAnimationFrame(draw);
    }

    function start(hostEl) {
      canvas = el2('gh-matrix-canvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      resize();
      running = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function setIntensity(tier) { intensity = clamp(tier, 0, 4); }
    function el2(id) { return document.getElementById(id); }
    window.addEventListener('resize', () => { if (running) resize(); });

    return { start, stop, setIntensity, resize };
  })();

  const GuitarHero = (() => {
    const LANE_KEYS = ['d', 'f', 'j', 'k'];
    const LANE_COLORS = ['#3dff6e', '#ff3d5a', '#ffe23d', '#3dc8ff'];
    const HIT_WINDOW = 0.16;      // tolerância (s) pra contar como acerto
    const PERFECT_WINDOW = 0.065; // dentro disso conta como "perfeito"
    const TRAVEL_TIME = 1.55;     // segundos que a nota leva do topo até a linha de acerto
    const MISS_PENALTY = 12;
    const WRONG_PENALTY = 8; // tecla errada / fora do tempo — penalidade menor que perder a nota, mas ainda pune
    const HIT_REGEN = 2;
    const BPM = 172; // andamento real de "Núcleo em Colapso", detectado por análise de áudio

    let chart = null;
    let lastBeatIdx = -1;   // índice da última batida do BEAT_GRID já processada (ver updateBeatPulse)
    let rafId = null;
    let running = false;
    let ended = false;
    let score = 0;
    let combo = 0;
    let bestCombo = 0;
    let health = 100;
    let hits = 0;
    let keyHandler = null;
    let fxLayerEl = null; // camada de popups de erro + glifos de bug por cima do palco
    // Configuração da corrida atual (ver open()):
    // - oneLife: qualquer nota perdida zera a vida na hora (dificuldade
    //   Impossível, etapa final — ver markMissed()).
    // - final: esta corrida é a etapa final da dificuldade Impossível, não
    //   o modo secreto avulso — pula a tela de resultado própria (gh-result)
    //   e devolve o resultado pro jogo principal via onFinalEnd().
    let activeOpts = { oneLife: false, final: false, onFinalEnd: null };

    // Chart real, mapeado em cima da forma de onda de "Núcleo em
    // Colapso" (ver CHART_NOTES logo acima, gerado offline por análise
    // de áudio — batidas reais da faixa + banda de frequência dominante
    // em cada uma, pra decidir a raia). Nada de fórmula gerada na hora:
    // é a música de verdade ditando o ritmo do combate.
    function generateChart() {
      const notes = CHART_NOTES.map(([time, lane]) => ({
        time, lane, hit: false, missed: false, el: null, spawned: false,
      }));
      const lastTime = notes.length ? notes[notes.length - 1].time : 0;
      return { notes, duration: Math.max(lastTime, TIER_BOUNDS[TIER_BOUNDS.length - 1]) };
    }

    function el(sel) { return document.getElementById(sel); }

    // Digita o desfecho da história (ARCHITECT_ENDING_LINES) linha a
    // linha dentro do overlay de resultado — mesmo ritmo/efeitos sonoros
    // do runVictoryMonologue() do jogo principal — e só DEPOIS revela o
    // placar (pontuação/combo/precisão) e os botões. Chamada só na
    // vitória de verdade (cause === 'complete', modo não-final).
    async function runArchitectEndingSequence({ score, bestCombo, accuracy }) {
      const storyEl = el('gh-result-story');
      const revealEl = el('gh-result-reveal');
      if (!storyEl || !revealEl) return;
      revealEl.hidden = true;
      storyEl.hidden = false;
      storyEl.innerHTML = '';

      // Salva o progresso da fase, marca o Arquiteto como definitivamente
      // eliminado nesta conta e libera a dificuldade IMPOSSÍVEL — tudo
      // JÁ, antes de começar a digitar o desfecho. A história inteira
      // leva uns 15-20s pra rodar, e ninguém deveria correr esse risco de
      // sair da tela (ou o navegador travar/fechar) antes do fim e perder
      // o registro. O placar e o texto de status só ficam VISÍVEIS depois
      // (dentro de gh-result-reveal, que segue escondido até o final),
      // mas o salvamento em si já aconteceu.
      markArchitectDefeated();
      unlockImpossibleMode();
      autoSaveScore(score, '#gh-save-status');

      for (const raw of ARCHITECT_ENDING_LINES) {
        const line = typeof raw === 'string' ? { text: raw, cls: '' } : raw;
        const p = document.createElement('p');
        if (line.cls) p.className = line.cls;
        storyEl.appendChild(p);
        try { AudioEngine.staticBurst(0.12); } catch (e) {}
        // eslint-disable-next-line no-await-in-loop
        await typeText(p, line.text, 22);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 300));
      }

      await new Promise((r) => setTimeout(r, 250));
      try { FX.whiteFlash(400); AudioEngine.metalDoor(); } catch (e) {}
      await new Promise((r) => setTimeout(r, 300));

      el('gh-result-score').textContent = String(score);
      el('gh-result-combo').textContent = `${bestCombo}x`;
      el('gh-result-acc').textContent = `${accuracy}%`;
      revealEl.hidden = false;
    }


    function updateHud() {
      el('gh-score').textContent = String(score);
      el('gh-combo').textContent = `${combo}x`;
      el('gh-health-fill').style.width = `${clamp(health, 0, 100)}%`;
    }

    function showFeedback(text, cls) {
      const fb = el('gh-feedback');
      fb.textContent = text;
      fb.className = `gh-feedback ${cls}`;
      void fb.offsetWidth;
      fb.classList.add('gh-show');
    }

    function flashKey(lane) {
      const key = $(`.gh-key[data-lane="${lane}"]`);
      if (!key) return;
      key.classList.add('gh-key-active');
      setTimeout(() => key.classList.remove('gh-key-active'), 140);
    }

    function spawnNoteEl(note) {
      const layer = el('gh-notes-layer');
      if (!layer) return;
      const div = document.createElement('div');
      div.className = 'gh-note';
      div.style.left = `calc(${note.lane * 25}% + 2%)`;
      div.style.width = '21%';
      div.style.background = LANE_COLORS[note.lane];
      div.style.boxShadow = `0 0 10px 1px ${LANE_COLORS[note.lane]}`;
      layer.appendChild(div);
      note.el = div;
      note.spawned = true;
    }

    function removeNoteEl(note, delay) {
      const target = note.el;
      if (!target) return;
      setTimeout(() => { if (target.parentNode) target.parentNode.removeChild(target); }, delay);
    }

    function judgeHit(diff) {
      return Math.abs(diff) <= PERFECT_WINDOW ? 'perfect' : 'good';
    }

    function tryHit(lane) {
      if (!running) return;
      flashKey(lane);
      const elapsed = BossMusic.getTime();
      let best = null;
      let bestDiff = Infinity;
      chart.notes.forEach((n) => {
        if (n.lane !== lane || n.hit || n.missed) return;
        const diff = elapsed - n.time;
        if (Math.abs(diff) <= HIT_WINDOW && Math.abs(diff) < bestDiff) { best = n; bestDiff = diff; }
      });
      if (!best) {
        // Tecla errada: nenhuma nota daquela raia dentro da janela de
        // acerto agora — antes não punia, o que deixava o modo Impossível
        // fácil demais só de martelar tecla. Agora conta como erro:
        // quebra o combo e desconta vida (vida única zera na hora, igual
        // a uma nota perdida).
        combo = 0;
        health = activeOpts.oneLife ? 0 : clamp(health - WRONG_PENALTY, 0, 100);
        showFeedback('ERRADO', 'fb-miss');
        updateHud();
        if (health <= 0) endRun('fail');
        return;
      }
      best.hit = true;
      hits += 1;
      const tier = judgeHit(bestDiff);
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      score += tier === 'perfect' ? 300 : 150;
      health = clamp(health + HIT_REGEN, 0, 100);
      showFeedback(tier === 'perfect' ? 'PERFEITO!' : 'BOM!', tier === 'perfect' ? 'fb-perfect' : 'fb-good');
      if (best.el) { best.el.classList.add('gh-note-hit'); removeNoteEl(best, 200); }
      updateHud();
    }

    function markMissed(note) {
      note.missed = true;
      combo = 0;
      // Vida única (dificuldade Impossível): a primeira nota perdida já
      // zera a vida, em vez de descontar aos poucos.
      health = activeOpts.oneLife ? 0 : clamp(health - MISS_PENALTY, 0, 100);
      showFeedback('FALHOU', 'fb-miss');
      if (note.el) { note.el.classList.add('gh-note-missed'); removeNoteEl(note, 300); }
      updateHud();
      if (health <= 0) endRun('fail');
    }

    function loop() {
      if (!running) return;
      const elapsed = BossMusic.getTime();

      updateStageCorruption(elapsed);
      updateBeatPulse(elapsed);

      chart.notes.forEach((n) => {
        const spawnTime = n.time - TRAVEL_TIME;
        if (!n.spawned && !n.hit && !n.missed && elapsed >= spawnTime) spawnNoteEl(n);
        if (n.el && !n.hit && !n.missed) {
          const progress = clamp((elapsed - spawnTime) / TRAVEL_TIME, 0, 1.3);
          n.el.style.top = `${progress * 86}%`;
          // dentro da janela de acerto (ou perto dela): destaca a nota
          // pra deixar claro visualmente que é a hora de apertar.
          const nearHit = Math.abs(elapsed - n.time) <= HIT_WINDOW * 1.8;
          n.el.classList.toggle('gh-note-near', nearHit);
        }
        if (!n.hit && !n.missed && elapsed > n.time + HIT_WINDOW) markMissed(n);
      });

      if (!ended && elapsed > chart.duration + TRAVEL_TIME + 0.6) {
        endRun('complete');
        return;
      }
      rafId = requestAnimationFrame(loop);
    }

    function attachKeys() {
      keyHandler = (e) => {
        if (!running) return;
        const lane = LANE_KEYS.indexOf(e.key.toLowerCase());
        if (lane === -1) return;
        e.preventDefault();
        tryHit(lane);
      };
      document.addEventListener('keydown', keyHandler);
    }
    function detachKeys() {
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }

    // Destruição progressiva do palco: mapeada em cima dos patamares de
    // energia REAIS de "Núcleo em Colapso" (TIER_BOUNDS, em segundos —
    // ver comentário acima de BEAT_GRID/CHART_NOTES). Quanto mais perto
    // do clímax real da faixa, mais forte fica o glitch (classes
    // gh-corrupt-1..4 no CSS) e mais pesada fica a trilha (ver
    // BossMusic.setTier). Ao subir de patamar, uma rajada de "bugs" e
    // um popup de erro aparecem — sinal visível de que O Arquiteto está
    // perdendo terreno. Ver também updateBeatPulse(), que soma
    // destruição contínua em cima disso, batida a batida.
    let corruptionTier = -1;
    function ensureFxLayer() {
      if (fxLayerEl && fxLayerEl.isConnected) return fxLayerEl;
      const stage = el('gh-stage');
      if (!stage) return null;
      fxLayerEl = document.createElement('div');
      fxLayerEl.className = 'boss-fx-layer';
      stage.appendChild(fxLayerEl);
      return fxLayerEl;
    }

    function tierForElapsed(elapsed) {
      if (elapsed >= TIER_BOUNDS[3]) return 4;
      if (elapsed >= TIER_BOUNDS[2]) return 3;
      if (elapsed >= TIER_BOUNDS[1]) return 2;
      if (elapsed >= TIER_BOUNDS[0]) return 1;
      return 0;
    }

    function updateStageCorruption(elapsed) {
      const tier = tierForElapsed(elapsed);
      BossMusic.setTier(tier);
      MatrixRain.setIntensity(tier);
      const coreEl = el('gh-core-value');
      if (coreEl) {
        const climaxEnd = TIER_BOUNDS[TIER_BOUNDS.length - 1];
        const pct = clamp(Math.round((1 - elapsed / climaxEnd) * 100), 0, 100);
        if (coreEl.textContent !== String(pct)) coreEl.textContent = String(pct);
      }
      if (tier === corruptionTier) return;
      const risingTier = tier > corruptionTier;
      corruptionTier = tier;
      const stage = el('gh-stage');
      if (!stage) return;
      stage.classList.remove('gh-corrupt-1', 'gh-corrupt-2', 'gh-corrupt-3', 'gh-corrupt-4');
      if (tier > 0) stage.classList.add(`gh-corrupt-${tier}`);
      const coreReadout = el('gh-core-readout');
      if (coreReadout) {
        coreReadout.classList.toggle('core-critical', tier >= 2);
      }
      if (risingTier && tier > 0) {
        const layer = ensureFxLayer();
        FX.bugSwarmBurst(layer, 4 + tier * 3);
        FX.crackBurst(layer, 4 + tier * 2);
        const pool = ARCHITECT_BUG_MESSAGES[tier] || ARCHITECT_BUG_MESSAGES[3];
        FX.errorPopup(layer, pool[randInt(0, pool.length - 1)]);
        // rajada de "código" corrompendo junto — mais linhas quanto
        // mais alto o patamar, reforçando a destruição visual.
        for (let i = 0; i < tier; i++) {
          setTimeout(() => FX.codeCorruptLine(layer), i * 140);
        }
        AudioEngine.staticBurst(0.22);
        stage.classList.remove('gh-invert-flash');
        void stage.offsetWidth;
        stage.classList.add('gh-invert-flash');
        setTimeout(() => stage.classList.remove('gh-invert-flash'), 160);
        if (tier >= 2) {
          stage.classList.remove('shake');
          void stage.offsetWidth;
          stage.classList.add('shake');
          setTimeout(() => stage.classList.remove('shake'), 420);
        }
        if (tier >= 4) {
          // reta final antes do colapso: rajada dupla, o Arquiteto está
          // por um fio.
          setTimeout(() => FX.errorPopup(layer, pool[randInt(0, pool.length - 1)]), 260);
          setTimeout(() => FX.codeCorruptLine(layer), 400);
          setTimeout(() => FX.crackBurst(layer, 8), 200);
          try { AudioEngine.alarm(); } catch (e) {}
        }
      }
    }

    // Destruição contínua, batida a batida — não só nas transições de
    // patamar. Consome BEAT_GRID (todas as batidas reais da faixa) e
    // dispara efeitos crescentes conforme o patamar atual: um pulso
    // discreto no palco a cada batida, e progressivamente mais bugs,
    // flicker cromático e tremor nas batidas fortes (a cada 4ª), até o
    // caos quase contínuo do patamar 4 — a tela literalmente se
    // desfazendo no ritmo da música.
    function onBeat(beatIdx) {
      if (!running || corruptionTier <= 0) return;
      const stage = el('gh-stage');
      if (!stage) return;
      const tier = corruptionTier;
      const isDownbeat = beatIdx % 4 === 0;

      stage.classList.remove('gh-beat-pulse');
      void stage.offsetWidth;
      stage.classList.add('gh-beat-pulse');
      setTimeout(() => stage.classList.remove('gh-beat-pulse'), 130);

      if (tier >= 2 && (isDownbeat || tier >= 3)) {
        const layer = ensureFxLayer();
        FX.bugSwarmBurst(layer, tier >= 4 ? 5 : 2);
        if (tier >= 4 && isDownbeat) FX.crackBurst(layer, 5);
      }
      if (tier >= 3 && isDownbeat) {
        stage.classList.remove('gh-chroma-flicker');
        void stage.offsetWidth;
        stage.classList.add('gh-chroma-flicker');
        setTimeout(() => stage.classList.remove('gh-chroma-flicker'), 180);
        if (Math.random() < 0.5) FX.codeCorruptLine(ensureFxLayer());
      }
      if (tier >= 4) {
        if (isDownbeat) {
          stage.classList.remove('shake');
          void stage.offsetWidth;
          stage.classList.add('shake');
          setTimeout(() => stage.classList.remove('shake'), 360);
        }
        try { AudioEngine.staticBurst(0.1); } catch (e) {}
      }
    }

    function updateBeatPulse(elapsed) {
      if (!BEAT_GRID || !BEAT_GRID.length) return;
      while (lastBeatIdx + 1 < BEAT_GRID.length && BEAT_GRID[lastBeatIdx + 1] <= elapsed) {
        lastBeatIdx += 1;
        onBeat(lastBeatIdx);
      }
    }

    function resetVisuals() {
      const layer = el('gh-notes-layer');
      if (layer) layer.innerHTML = '';
      score = 0; combo = 0; bestCombo = 0; health = 100; hits = 0; ended = false;
      corruptionTier = -1;
      lastBeatIdx = -1;
      const stage = el('gh-stage');
      if (stage) stage.classList.remove('gh-corrupt-1', 'gh-corrupt-2', 'gh-corrupt-3', 'gh-corrupt-4', 'gh-collapsed', 'gh-invert-flash', 'gh-beat-pulse', 'gh-chroma-flicker', 'shake');
      if (fxLayerEl) fxLayerEl.innerHTML = '';
      const coreEl = el('gh-core-value');
      if (coreEl) coreEl.textContent = '100';
      const coreReadout = el('gh-core-readout');
      if (coreReadout) coreReadout.classList.remove('core-critical');
      const statusEl = el('gh-save-status');
      if (statusEl) { statusEl.className = 'victory-save-status'; statusEl.textContent = ''; }
      const storyEl = el('gh-result-story');
      if (storyEl) { storyEl.hidden = true; storyEl.innerHTML = ''; }
      const revealEl = el('gh-result-reveal');
      if (revealEl) revealEl.hidden = false;
      updateHud();
    }

    function startPlay() {
      resetVisuals();
      ensureFxLayer();
      el('gh-intro').hidden = true;
      el('gh-result').hidden = true;
      chart = generateChart();
      attachKeys();
      running = true;
      rafId = requestAnimationFrame(loop);
      BossMusic.start();
      MatrixRain.start();
    }

    // Sequência de colapso final — só quando a faixa é vencida de
    // verdade (cause === 'complete'): tremores em cascata, mais bugs
    // na tela, bem mais intensa que qualquer patamar anterior. A
    // trilha NÃO é cortada aqui: nesse ponto exato o arquivo real já
    // está entrando sozinho no seu trecho mais quieto (é o interlúdio
    // melancólico de verdade, não mais sintetizado à parte) — ela só
    // continua tocando por baixo do colapso e da tela de resultado,
    // e termina/pausa naturalmente quando a faixa acaba.
    function triggerFinalCollapse(callback) {
      const stage = el('gh-stage');
      const layer = ensureFxLayer();
      try { FX.whiteFlash(420); AudioEngine.metalDoor(); } catch (e) {}
      if (stage) stage.classList.add('gh-collapsed');
      MatrixRain.setIntensity(4);
      FX.bugSwarmBurst(layer, 26);
      FX.crackBurst(layer, 10);
      for (let i = 0; i < 4; i++) {
        setTimeout(() => FX.codeCorruptLine(layer), 100 + i * 220);
      }
      ARCHITECT_FINAL_MESSAGES.forEach((msg, i) => {
        setTimeout(() => FX.errorPopup(layer, msg), 150 + i * 240);
      });
      let stutters = 0;
      const stutterInterval = setInterval(() => {
        if (stage) {
          stage.classList.remove('shake');
          void stage.offsetWidth;
          stage.classList.add('shake');
        }
        try { AudioEngine.staticBurst(0.25); } catch (e) {}
        if (stutters % 2 === 0) FX.bugSwarmBurst(layer, 5);
        if (stutters % 2 === 1) FX.codeCorruptLine(layer);
        FX.crackBurst(layer, 4);
        stutters += 1;
        if (stutters >= 5) {
          clearInterval(stutterInterval);
          if (stage) stage.classList.remove('shake');
        }
      }, 260);
      setTimeout(() => { if (typeof callback === 'function') callback(); }, 2000);
      // Deixa o interlúdio real tocar por baixo do resultado por um
      // tempo, depois esmaece sozinho — sem cortar o momento, mas sem
      // tocar pra sempre caso o jogador fique parado na tela final.
      setTimeout(() => { BossMusic.stop(); MatrixRain.stop(); }, 13000);
    }

    function endRun(cause) {
      if (ended) return;
      ended = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      detachKeys();

      const totalNotes = chart.notes.length;
      const accuracy = totalNotes ? Math.round((hits / totalNotes) * 100) : 0;

      if (cause === 'fail') { BossMusic.stop(true); MatrixRain.stop(); } // corte seco — sem outro

      // Etapa final da dificuldade Impossível: nada de tela de resultado
      // própria aqui — o placar volta pro jogo principal, que mostra o
      // resultado combinado (ver finishImpossibleRun em script principal).
      if (activeOpts.final) {
        if (cause === 'fail') {
          try { AudioEngine.error(); FX.glitchPulse(); } catch (e) {}
          if (typeof activeOpts.onFinalEnd === 'function') {
            activeOpts.onFinalEnd({ cause, score, bestCombo, accuracy });
          }
        } else {
          triggerFinalCollapse(() => {
            try { AudioEngine.success(); } catch (e) {}
            if (typeof activeOpts.onFinalEnd === 'function') {
              activeOpts.onFinalEnd({ cause, score, bestCombo, accuracy });
            }
          });
        }
        return;
      }

      const titleEl = el('gh-result-title');
      const subEl = el('gh-result-sub');
      const statusEl = el('gh-save-status');
      const storyEl = el('gh-result-story');
      const revealEl = el('gh-result-reveal');
      if (cause === 'fail') {
        // Garante que uma tentativa anterior vencida (com o desfecho já
        // digitado) não deixe a narrativa visível por cima da mensagem
        // de derrota desta tentativa.
        if (storyEl) storyEl.hidden = true;
        if (revealEl) revealEl.hidden = false;
        titleEl.textContent = 'VOCÊ FALHOU A MÚSICA';
        subEl.textContent = 'O Arquiteto não perdoa. Tente de novo.';
        if (statusEl) { statusEl.className = 'victory-save-status'; statusEl.textContent = ''; }
        try { AudioEngine.error(); FX.glitchPulse(); } catch (e) {}
        el('gh-result-score').textContent = String(score);
        el('gh-result-combo').textContent = `${bestCombo}x`;
        el('gh-result-acc').textContent = `${accuracy}%`;
        el('gh-result').hidden = false;
        return;
      }

      triggerFinalCollapse(() => {
        titleEl.textContent = 'FAIXA CONCLUÍDA';
        subEl.textContent = 'O confronto real termina agora.';
        el('gh-result').hidden = false;
        // Ranking próprio de "O Arquiteto" (RF06/RF07 + auto-save já
        // usados no resto do jogo) e o desbloqueio da dificuldade
        // IMPOSSÍVEL agora acontecem dentro do desfecho narrativo — ver
        // runArchitectEndingSequence() — em vez de aparecerem soltos
        // aqui, junto com uma mensagem de uma linha só.
        runArchitectEndingSequence({ score, bestCombo, accuracy });
      });
    }

    function stopAndCleanup() {
      running = false;
      ended = true;
      if (rafId) cancelAnimationFrame(rafId);
      detachKeys();
      BossMusic.stop(true);
      MatrixRain.stop();
      const stage = el('gh-stage');
      if (stage) stage.classList.remove('gh-collapsed', 'gh-invert-flash', 'shake');
      if (fxLayerEl) fxLayerEl.innerHTML = '';
      const layer = el('gh-notes-layer');
      if (layer) layer.innerHTML = '';
    }

    function open(opts = {}) {
      activeOpts = { oneLife: false, final: false, onFinalEnd: null, ...opts };
      resetVisuals();
      el('gh-result').hidden = true;
      const introTitle = el('gh-intro-title');
      const introText = el('gh-intro-text');
      if (introTitle) {
        introTitle.textContent = activeOpts.final ? 'O ARQUITETO — VIDA ÚNICA' : 'O ARQUITETO';
      }
      if (introText) {
        introText.textContent = activeOpts.final
          ? 'A etapa final do modo Impossível. Uma vida: a primeira nota perdida encerra a corrida.'
          : 'Nenhum requisito aqui. Nenhum PC quebrado. Só você, quatro teclas e o ritmo.';
      }
      el('gh-intro').hidden = false;
    }

    function bindUi() {
      el('gh-start-btn').addEventListener('click', () => { try { AudioEngine.click(); } catch (e) {} startPlay(); });
      el('gh-intro-back-btn').addEventListener('click', () => {
        stopAndCleanup();
        // Na etapa final do Impossível não existe "voltar pra tela de
        // dificuldade" (a partida já está em andamento): sair aqui
        // significa desistir da corrida.
        showScreen(activeOpts.final ? 'screen-menu' : 'screen-difficulty');
      });
      el('gh-quit-btn').addEventListener('click', () => {
        stopAndCleanup();
        showScreen('screen-menu');
      });
      el('gh-result-retry-btn').addEventListener('click', () => { try { AudioEngine.click(); } catch (e) {} startPlay(); });
      el('gh-result-menu-btn').addEventListener('click', () => {
        stopAndCleanup();
        showScreen('screen-menu');
      });
    }

    return { open, bindUi, stopAndCleanup };
  })();


  /* ------------------------------------------------------------------
     12. INICIALIZAÇÃO / LISTENERS
     ------------------------------------------------------------------ */
  function attachMenuSounds() {
    $$('button').forEach((btn) => {
      btn.addEventListener('click', () => AudioEngine.click());
    });
  }

  function init() {
    // Consolida o ranking local automaticamente a cada carregamento:
    // remove qualquer entrada antiga/duplicada que tenha sobrado de antes
    // da regra de "só o recorde por jogador+dificuldade" existir. Rápido,
    // só localStorage, sem rede — ver ArquitetoAdmin no console pra
    // consolidar ou resetar o ranking global (JSONBin) manualmente.
    consolidarRankingLocal();
    refreshDifficultyOptions();
    GuitarHero.bindUi();
    // Boot sequence rápido antes do login/menu
    setTimeout(() => {
      const session = loadSession();
      if (session) {
        showScreen('screen-menu');
      } else {
        showScreen('screen-login');
      }
      FX.spawnParticles($('#menu-particles'));
      FX.startNoiseLoop();
    }, 900);

    attachMenuSounds();

    // -- Login / Cadastro (RF01) --
    let loginMode = 'login';
    $('#tab-login').addEventListener('click', () => {
      loginMode = 'login';
      $('#tab-login').classList.add('active');
      $('#tab-signup').classList.remove('active');
      $('#login-submit-btn').textContent = 'ACESSAR SISTEMA →';
      $('#login-error').hidden = true;
    });
    $('#tab-signup').addEventListener('click', () => {
      loginMode = 'signup';
      $('#tab-signup').classList.add('active');
      $('#tab-login').classList.remove('active');
      $('#login-submit-btn').textContent = 'CRIAR CONTA →';
      $('#login-error').hidden = true;
    });

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nickname = $('#login-nickname').value.trim();
      const password = $('#login-password').value;
      const errEl = $('#login-error');
      const submitBtn = $('#login-submit-btn');

      if (!nickname || !password) {
        errEl.textContent = 'Preencha apelido e senha para continuar.';
        errEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'VERIFICANDO…';

      const result = loginMode === 'signup'
        ? await signupAccount(nickname, password)
        : await loginAccount(nickname, password);

      if (!result.ok) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        errEl.textContent = result.reason;
        errEl.hidden = false;
        return;
      }

      // Puxa o progresso dessa conta de outras máquinas (dificuldades
      // secretas + estatísticas) antes de entrar no menu — assim, uma
      // conta que já tinha coisa desbloqueada em outro aparelho chega
      // aqui já com tudo liberado, em vez de parecer "zerada" só por
      // estar rodando num navegador novo. Precisa salvar a sessão
      // ANTES de sincronizar: scopedKey() usa a sessão atual pra saber
      // em qual "gaveta" local gravar o progresso puxado.
      saveSession({ nickname, loginAt: new Date().toISOString() });
      submitBtn.textContent = 'SINCRONIZANDO…';
      await syncProgressFromGlobal(nickname);
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;

      errEl.hidden = true;
      updateTerminalOperatorLabel();
      showScreen('screen-menu');
    });

    $('#btn-play').addEventListener('click', () => {
      AudioEngine.ensureCtx();
      refreshDifficultyOptions();
      showScreen('screen-difficulty');
    });

    $('#btn-skip-intro').addEventListener('click', (e) => {
      e.stopPropagation();
      skipIntro();
    });

    $('#notebook-btn').addEventListener('click', () => toggleNotebook(true));
    $('#notebook-close-btn').addEventListener('click', () => toggleNotebook(false));
    $('#notebook-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'notebook-overlay') toggleNotebook(false);
    });

    // -- Menu de pausa --
    $('#pause-btn').addEventListener('click', () => openPauseMenu());
    $('#pause-continue-btn').addEventListener('click', () => closePauseMenu());
    $('#pause-restart-btn').addEventListener('click', () => restartFromPause());
    $('#pause-menu-btn').addEventListener('click', () => quitToMenuFromPause());
    $('#pause-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'pause-overlay') closePauseMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#screen-game').classList.contains('active')) return;
      if (!$('#notebook-overlay').hidden) { toggleNotebook(false); return; }
      if (!$('#pause-overlay').hidden) { closePauseMenu(); return; }
      openPauseMenu();
    });

    $$('.difficulty-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        State.pendingDifficulty = btn.dataset.difficulty;
        // Modo secreto "O Arquiteto": nada de narrativa, nada de PC — vai
        // direto pro palco em tela cheia do minigame de ritmo. A troca de
        // tela e a abertura do minigame acontecem primeiro, sem depender
        // de nada que possa falhar (ex. efeitos visuais); o flash é extra.
        if (btn.dataset.difficulty === 'arquiteto') {
          // Marca a dificuldade "arquiteto" no estado só pra identificar
          // esse modo no ranking (autoSaveScore usa State.difficulty pra
          // saber em qual lista salvar) — sem tocar em cronômetro, fases
          // ou qualquer outra coisa do motor principal.
          State.difficulty = 'arquiteto';
          showScreen('screen-guitarhero');
          GuitarHero.open();
          try { AudioEngine.click(); FX.whiteFlash(180); } catch (e) {}
          return;
        }
        // Impossível também não tem história: pula a introdução narrativa
        // (INTRO_LINES) e vai direto pro jogo — ver DIFFICULTIES.impossivel.
        if (btn.dataset.difficulty === 'impossivel') {
          AudioEngine.click();
          beginGame();
          return;
        }
        AudioEngine.click();
        playIntro();
      });
    });

    $('#btn-instructions').addEventListener('click', () => showScreen('screen-instructions'));
    $('#btn-credits').addEventListener('click', () => { renderCreditsHall(); showScreen('screen-credits'); });
    $('#btn-ranking').addEventListener('click', () => { renderRankingScreen(); showScreen('screen-ranking'); });
    $('#btn-exit').addEventListener('click', () => {
      logout();
    });

    $$('.back-btn').forEach((btn) => {
      btn.addEventListener('click', () => showScreen(btn.dataset.back));
    });

    $('#btn-restart').addEventListener('click', () => {
      showScreen('screen-menu');
    });

    $('#btn-play-again').addEventListener('click', () => {
      showScreen('screen-menu');
    });

    $('#ranking-search').addEventListener('input', renderRankingTable);
    $$('.ranking-diff-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        currentRankingDifficulty = tab.dataset.difficulty;
        $$('.ranking-diff-tab').forEach((t) => t.classList.toggle('active', t === tab));
        renderRankingTable();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
