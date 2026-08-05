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

    function drawNoiseFrame() {
      const w = noiseCanvas.width, h = noiseCanvas.height;
      const imgData = nctx.createImageData(w, h);
      const buf = new Uint32Array(imgData.data.buffer);
      for (let i = 0; i < buf.length; i++) {
        const v = (Math.random() * 255) | 0;
        buf[i] = (255 << 24) | (v << 16) | (v << 8) | v;
      }
      nctx.putImageData(imgData, 0, 0);
    }

    function startNoiseLoop() {
      let last = 0;
      const loop = (t) => {
        if (t - last > 90) { drawNoiseFrame(); last = t; }
        noiseRAF = requestAnimationFrame(loop);
      };
      noiseRAF = requestAnimationFrame(loop);
    }
    function stopNoiseLoop() { if (noiseRAF) cancelAnimationFrame(noiseRAF); }

    function shake() {
      body.classList.remove('shake');
      void body.offsetWidth; // força reflow para reiniciar animação
      body.classList.add('shake');
      setTimeout(() => body.classList.remove('shake'), 420);
    }

    function glitchPulse() {
      body.classList.remove('glitching');
      void body.offsetWidth;
      body.classList.add('glitching');
      setTimeout(() => body.classList.remove('glitching'), 520);
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

    function setCorruptionLevel(level) {
      body.classList.remove('corruption-1', 'corruption-2', 'corruption-3');
      if (level >= 1) body.classList.add(`corruption-${clamp(level, 1, 3)}`);
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

    return { startNoiseLoop, stopNoiseLoop, shake, glitchPulse, whiteFlash, blackout, setCorruptionLevel, spawnParticles };
  })();

  /* ------------------------------------------------------------------
     4. ESTADO GLOBAL
     ------------------------------------------------------------------ */
  const DIFFICULTIES = {
    facil:   { label: 'FÁCIL',   minutes: 75, segments: 12, scoreMultiplier: 0.85 },
    medio:   { label: 'MÉDIO',   minutes: 60, segments: 10, scoreMultiplier: 1.0 },
    dificil: { label: 'DIFÍCIL', minutes: 45, segments: 7,  scoreMultiplier: 1.25 },
  };
  const DEFAULT_DIFFICULTY = 'medio';

  const State = {
    difficulty: DEFAULT_DIFFICULTY,
    pendingDifficulty: DEFAULT_DIFFICULTY,
    totalTime: DIFFICULTIES[DEFAULT_DIFFICULTY].minutes * 60,
    totalIntegritySegments: DIFFICULTIES[DEFAULT_DIFFICULTY].segments,
    timeLeft: DIFFICULTIES[DEFAULT_DIFFICULTY].minutes * 60,
    timerId: null,
    integrity: DIFFICULTIES[DEFAULT_DIFFICULTY].segments,
    docsFound: 0,
    totalDocs: 5,
    currentPhaseIndex: 0,
    mistakes: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    running: false,
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
    FX.shake();
    FX.glitchPulse();
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
    'Você acorda no chão. Frio. Escuro.',
    'A sala não tem janelas. Não tem porta visível.',
    'O único objeto aqui é um computador velho, ligado a um monitor rachado.',
    'Ele acende sozinho.',
    'Uma voz sai dos alto-falantes gastos.',
    'Eu sou o Arquiteto.',
    'Este terminal guarda os restos de um sistema que fracassou.',
    'Centenas de projetos morreram exatamente como este.',
    'Não por falta de código. Por falta de requisitos.',
    'Você vai reconstruir esse sistema, peça por peça, aqui, comigo.',
    'Tem 60 minutos no relógio deste terminal.',
    'Cada erro que você cometer vai corromper mais esta máquina...',
    '...e esta sala.',
    'Quando a integridade chegar a zero, o terminal desliga.',
    'E ninguém mais vai me ouvir dizer o que acontece depois disso.',
    'Sente-se. Preste atenção. Ouça antes de programar.',
    'O teclado é seu. A escolha, também.',
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
     9. MOTOR DE FASES — uma pergunta por vez, 5 minutos para responder.
        A tela mostra só a pergunta atual e o cronômetro; as dicas ficam
        nos post-its colados ao redor do PC (ver renderPostits).
     ------------------------------------------------------------------ */
  const QUESTION_SECONDS = 5 * 60;
  let qTimerId = null;
  let qTimeLeft = QUESTION_SECONDS;

  function updateQTimerDisplay() {
    const el = $('#hud-qtimer');
    if (!el) return;
    el.textContent = formatTime(qTimeLeft);
    el.classList.toggle('time-critical', qTimeLeft <= 30);
  }

  function stopQuestionTimer() {
    clearInterval(qTimerId);
  }

  function startQuestionTimer(onExpire) {
    stopQuestionTimer();
    qTimeLeft = QUESTION_SECONDS;
    updateQTimerDisplay();
    qTimerId = setInterval(() => {
      qTimeLeft -= 1;
      updateQTimerDisplay();
      if (qTimeLeft <= 0) {
        stopQuestionTimer();
        onExpire();
      }
    }, 1000);
  }

  /**
   * Renderiza uma sequência de perguntas de múltipla escolha, uma de
   * cada vez, cada uma com até 5 minutos para ser respondida. Usado por
   * todas as 5 fases — só muda o conteúdo de `questions` e `options`.
   */
  function renderSequentialQuestions(root, { questions, options, onAllDone }) {
    let idx = 0;

    function renderCard(q) {
      root.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'question-card';

      const count = document.createElement('div');
      count.className = 'question-count';
      count.textContent = `PERGUNTA ${idx + 1} / ${questions.length}`;

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
      card.appendChild(text);
      card.appendChild(opts);
      root.appendChild(card);
    }

    function revealAndAdvance(q) {
      $$('.option-btn', root).forEach((b) => {
        b.disabled = true;
        if (b.textContent === q.correct) b.classList.add('correct-flash');
      });
      setTimeout(() => { idx += 1; showCurrent(); }, 1200);
    }

    function handleAnswer(choice, btnEl, q) {
      if (choice === q.correct) {
        stopQuestionTimer();
        btnEl.classList.add('correct-flash');
        $$('.option-btn', root).forEach((b) => { b.disabled = true; });
        registerSuccess();
        setTimeout(() => { idx += 1; showCurrent(); }, 650);
      } else {
        btnEl.classList.add('wrong-flash');
        btnEl.disabled = true;
        registerMistake();
      }
    }

    function showCurrent() {
      if (idx >= questions.length) { stopQuestionTimer(); onAllDone(); return; }
      const q = questions[idx];
      renderCard(q);
      startQuestionTimer(() => {
        registerMistake();
        revealAndAdvance(q);
      });
    }

    showCurrent();
  }

  /* ------------------------------------------------------------------
     9b. POST-ITS DE DICA — colados na cena, um exemplo por categoria.
     ------------------------------------------------------------------ */
  const POSTIT_COLORS = ['#f4e07a', '#f7b8c4', '#a8e6cf', '#ffd6a5', '#c9c2f5', '#ffe08a'];
  const POSTIT_SPOTS = [
    { top: '4%',  left: '2%',  transform: 'rotate(-6deg)' },
    { top: '6%',  right: '3%', transform: 'rotate(5deg)' },
    { top: '42%', left: '1%',  transform: 'rotate(-4deg)' },
    { top: '44%', right: '1%', transform: 'rotate(4deg)' },
    { bottom: '10%', left: '4%',  transform: 'rotate(-3deg)' },
    { bottom: '12%', right: '3%', transform: 'rotate(6deg)' },
  ];

  function renderPostits(hints) {
    const layer = $('#postit-layer');
    if (!layer) return;
    layer.innerHTML = '';
    hints.forEach((hint, i) => {
      const spot = POSTIT_SPOTS[i % POSTIT_SPOTS.length];
      const note = document.createElement('div');
      note.className = 'postit';
      note.style.setProperty('--postit-color', POSTIT_COLORS[i % POSTIT_COLORS.length]);
      Object.entries(spot).forEach(([prop, val]) => { note.style[prop] = val; });

      const label = document.createElement('span');
      label.className = 'postit-label';
      label.textContent = hint.label;
      const example = document.createElement('span');
      example.textContent = hint.example;

      note.appendChild(label);
      note.appendChild(example);
      note.addEventListener('click', () => AudioEngine.click());
      layer.appendChild(note);
    });
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

  function goToNextPhase() {
    State.currentPhaseIndex += 1;
    if (State.currentPhaseIndex >= PHASES.length) {
      triggerVictory();
    } else {
      renderCurrentPhase();
    }
  }

  function renderCurrentPhase() {
    const phase = PHASES[State.currentPhaseIndex];
    const root = $('#phase-root');
    root.innerHTML = '';

    renderPostits(phase.hints || []);
    setArchitectMessage(phase.introMessage);
    renderHUD();

    renderSequentialQuestions(root, {
      questions: phase.questions,
      options: phase.options,
      onAllDone: () => {
        unlockDoc(phase.docName);
        setArchitectMessage(phase.doneMessage);
        setTimeout(goToNextPhase, 1400);
      },
    });
  }

  /* ------------------------------------------------------------------
     10. DEFINIÇÃO DAS 5 FASES
     ------------------------------------------------------------------ */
  const PHASES = [
    // ---------------- FASE 1 — Sala do Cliente ----------------
    {
      slug: 'sala_cliente',
      title: 'Sala do Cliente',
      introMessage: 'Comece revirando o que restou da sala do cliente. Isso É ou NÃO É um requisito funcional?',
      docName: 'Requisitos Funcionais',
      doneMessage: 'A porta destrancou. Você aprendeu a separar fato de opinião.',
      options: ['É requisito funcional', 'Não é requisito funcional'],
      questions: shuffle([
        { text: 'O sistema deve permitir ao cliente acompanhar o status do pedido em tempo real.', correct: 'É requisito funcional' },
        { text: 'O sistema deve permitir cancelar um pedido em até 10 minutos após a compra.', correct: 'É requisito funcional' },
        { text: 'O sistema deve emitir nota fiscal automaticamente após a confirmação do pagamento.', correct: 'É requisito funcional' },
        { text: 'A cor da interface deve ser verde porque combina com a marca.', correct: 'Não é requisito funcional' },
        { text: 'O prazo do projeto é curto e a equipe está sob pressão.', correct: 'Não é requisito funcional' },
      ]),
      hints: [
        { label: 'É requisito funcional', example: '"O sistema deve emitir nota fiscal automaticamente após o pagamento."' },
        { label: 'Não é requisito', example: '"Eu acho que verde combina mais com a marca." — isso é opinião.' },
      ],
    },

    // ---------------- FASE 2 — Sala das Mentiras ----------------
    {
      slug: 'sala_mentiras',
      title: 'Sala das Mentiras',
      introMessage: 'Cuidado: nesta sala, cada frase tenta te enganar.',
      docName: 'Requisitos Não Funcionais',
      doneMessage: 'O cofre abriu. Nem tudo que o cliente diz é requisito — e isso é ouro.',
      options: ['Requisito Funcional', 'Requisito Não Funcional', 'Opinião', 'Desejo do Cliente', 'Irrelevante'],
      questions: shuffle([
        { text: 'O sistema deve suportar 5.000 usuários simultâneos sem queda de desempenho.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir cadastrar um novo produto com nome, preço e estoque.', correct: 'Requisito Funcional' },
        { text: 'Eu acho que o sistema deveria ser mais bonito.', correct: 'Opinião' },
        { text: 'Seria incrível se o sistema também lavasse a louça.', correct: 'Desejo do Cliente' },
        { text: 'O escritório do cliente fica no terceiro andar.', correct: 'Irrelevante' },
        { text: 'O sistema deve responder a qualquer requisição em menos de 2 segundos.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir emitir relatório mensal de vendas em PDF.', correct: 'Requisito Funcional' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"Cadastrar um novo produto com nome, preço e estoque."' },
        { label: 'Requisito Não Funcional', example: '"Suportar 5.000 usuários simultâneos sem queda de desempenho."' },
        { label: 'Opinião', example: '"Eu acho que o sistema deveria ser mais bonito."' },
        { label: 'Desejo do Cliente', example: '"Seria incrível se o sistema também lavasse a louça."' },
        { label: 'Irrelevante', example: '"O escritório do cliente fica no terceiro andar."' },
      ],
    },

    // ---------------- FASE 3 — Casos de Uso ----------------
    {
      slug: 'casos_uso',
      title: 'Casos de Uso',
      introMessage: 'Monte o diagrama. Qual ator faz esta ação?',
      docName: 'Casos de Uso',
      doneMessage: 'Você recebeu uma chave. O sistema começa a fazer sentido.',
      options: ['CLIENTE', 'USUÁRIO', 'ADMINISTRADOR', 'GERENTE'],
      questions: shuffle([
        { text: 'Comprar produto', correct: 'CLIENTE' },
        { text: 'Cadastrar conta', correct: 'USUÁRIO' },
        { text: 'Excluir registro do sistema', correct: 'ADMINISTRADOR' },
        { text: 'Emitir relatório de vendas', correct: 'GERENTE' },
      ]),
      hints: [
        { label: 'Cliente', example: 'Ex.: buscar um produto no catálogo.' },
        { label: 'Usuário', example: 'Ex.: alterar a própria senha.' },
        { label: 'Administrador', example: 'Ex.: remover um usuário do sistema.' },
        { label: 'Gerente', example: 'Ex.: consultar relatório de vendas.' },
      ],
    },

    // ---------------- FASE 4 — Banco de Dados ----------------
    {
      slug: 'banco_dados',
      title: 'Banco de Dados',
      introMessage: 'O banco está incompleto. A qual entidade este elemento pertence?',
      docName: 'Modelo Entidade-Relacionamento',
      doneMessage: 'O modelo de dados está consistente. Poucos chegam até aqui.',
      options: ['CLIENTE', 'PEDIDO', 'PRODUTO'],
      questions: shuffle([
        { text: 'PK: id_cliente', correct: 'CLIENTE' },
        { text: 'FK: id_cliente (quem fez o pedido)', correct: 'PEDIDO' },
        { text: 'PK: id_pedido', correct: 'PEDIDO' },
        { text: 'PK: id_produto', correct: 'PRODUTO' },
        { text: 'Cardinalidade 1:N — Cliente faz Pedido', correct: 'CLIENTE' },
        { text: 'Cardinalidade N:N — Pedido contém Produto', correct: 'PRODUTO' },
      ]),
      hints: [
        { label: 'PK (chave primária)', example: 'id_cliente identifica um cliente de forma única.' },
        { label: 'FK (chave estrangeira)', example: 'id_cliente dentro de Pedido aponta para quem comprou.' },
        { label: 'Cardinalidade', example: '1:N — um Cliente pode fazer vários Pedidos.' },
      ],
    },

    // ---------------- FASE 5 — Mudança de Escopo ----------------
    {
      slug: 'mudanca_escopo',
      title: 'Mudança de Escopo',
      introMessage: 'O cliente mudou de ideia de novo. Isso também é engenharia de requisitos.',
      docName: 'Fluxo do Sistema Atualizado',
      doneMessage: 'Sistema reconstruído. Requisitos mudam — projetos maduros absorvem isso.',
      options: ['Requisito Novo', 'Alteração de Requisito Existente', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'Agora o sistema também precisa aceitar pagamento via PIX.', correct: 'Requisito Novo' },
        { text: 'O cancelamento de pedido, que era em 10 minutos, agora deve ser em até 30 minutos.', correct: 'Alteração de Requisito Existente' },
        { text: 'O sistema precisa funcionar offline e sincronizar depois.', correct: 'Requisito Não Funcional' },
        { text: 'Agora precisa existir login com conta Google.', correct: 'Requisito Novo' },
        { text: 'O relatório de vendas, que era mensal, agora deve poder ser gerado semanalmente.', correct: 'Alteração de Requisito Existente' },
      ]),
      hints: [
        { label: 'Requisito Novo', example: '"Agora precisa existir login com conta Google."' },
        { label: 'Alteração de Requisito', example: '"O prazo, que era 10 min, passou para 30 min."' },
        { label: 'Requisito Não Funcional', example: '"O sistema precisa funcionar offline e sincronizar depois."' },
      ],
    },
  ];

  /* ------------------------------------------------------------------
     11. GAME OVER / VITÓRIA / RANKING
     ------------------------------------------------------------------ */
  const RANKING_KEY = 'arquiteto_ranking_v1';

  function beginGame() {
    resetState(State.pendingDifficulty || DEFAULT_DIFFICULTY);
    showScreen('screen-game');
    renderHUD();
    renderCurrentPhase();
    State.running = true;
    startTimer();
    AudioEngine.startAmbient();
  }

  function stopGameLoops() {
    stopTimer();
    AudioEngine.stopAmbient();
    State.running = false;
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
    setTimeout(() => {
      showScreen('screen-gameover');
      runGameOverSequence(causeKey);
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

  const VICTORY_MONOLOGUE = [
    'A tela para de tremer.',
    '"Você acredita que venceu porque resolveu enigmas."',
    '"Está enganado."',
    '"Você venceu porque ouviu antes de programar."',
    { text: 'Um som metálico. Uma fresta de luz aparece na parede onde não havia nada.', cls: 'line-dim' },
  ];

  // Três desfechos possíveis, definidos pelo desempenho do jogador —
  // quanto mais erros e menos integridade sobrar, mais sombrio o final.
  const ENDINGS = {
    perfect: {
      titleClass: 'ending-perfect',
      title: 'VOCÊ SAIU. DE VERDADE.',
      sub: 'Você reconstruiu o sistema sem deixar rastro de erro. Isso é raro aqui dentro.',
      eerie: 'Você sai e não olha para trás. Ainda bem — o monitor continua aceso, mesmo com a sala vazia.',
      monologue: [
        'A tela para de tremer.',
        '"Você acredita que venceu porque resolveu enigmas."',
        '"Está enganado."',
        '"Você venceu porque ouviu antes de programar."',
        { text: 'Nenhum ruído. Nenhuma estática. Só a porta, aberta, em silêncio.', cls: 'line-dim' },
      ],
    },
    normal: {
      titleClass: '',
      title: 'PARABÉNS',
      sub: 'Você concluiu o Escape Room de Engenharia de Requisitos.',
      eerie: 'A porta se abre. Ao longe, você ainda ouve o zumbido do monitor ligado — sozinho, no escuro, esperando o próximo.',
      monologue: [
        'A tela para de tremer.',
        '"Você acredita que venceu porque resolveu enigmas."',
        '"Está enganado."',
        '"Você venceu porque ouviu antes de programar."',
        { text: 'Um som metálico. Uma fresta de luz aparece na parede onde não havia nada.', cls: 'line-dim' },
      ],
    },
    dark: {
      titleClass: 'ending-dark',
      title: 'VOCÊ SAIU. MAS NÃO INTEIRO.',
      sub: 'Você concluiu o sistema, mas deixou pedaços dele — e talvez de você — para trás.',
      eerie: 'Você sai andando torto. No reflexo do monitor apagando, por um instante, jura ver outra pessoa sentada na sua cadeira.',
      monologue: [
        'A tela para de tremer, mas não param os riscos nela.',
        '"Você acredita que venceu porque resolveu enigmas."',
        '"Está enganado."',
        '"Você venceu... apesar de quase não ouvir."',
        { text: 'A fresta na parede se abre bem devagar — como se hesitasse em te deixar ir.', cls: 'line-danger' },
      ],
    },
  };

  function getEndingTier() {
    if (State.integrity >= 9 && State.mistakes <= 1) return 'perfect';
    if (State.integrity >= 5) return 'normal';
    return 'dark';
  }

  async function runVictoryMonologue(ending) {
    const typedEl = $('#victory-typed');
    const reveal = $('#victory-reveal');
    typedEl.innerHTML = '';
    reveal.hidden = true;

    for (const raw of ending.monologue) {
      const line = typeof raw === 'string' ? { text: raw, cls: '' } : raw;
      const p = document.createElement('p');
      if (line.cls) p.className = line.cls;
      typedEl.appendChild(p);
      AudioEngine.staticBurst(0.12);
      // eslint-disable-next-line no-await-in-loop
      await typeText(p, line.text, 24);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 500));
    }

    await new Promise((r) => setTimeout(r, 400));
    FX.whiteFlash(500);
    AudioEngine.metalDoor();
    await new Promise((r) => setTimeout(r, 500));
    reveal.hidden = false;
  }

  function triggerVictory() {
    stopGameLoops();
    const { precision, score } = computeScore();
    const tier = getEndingTier();
    const ending = ENDINGS[tier];

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
    $('#v-name').value = '';

    showScreen('screen-victory');
    AudioEngine.success();
    runVictoryMonologue(ending);
  }

  function loadRanking() {
    try {
      return JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
    } catch (e) { return []; }
  }
  function saveRanking(list) {
    try { localStorage.setItem(RANKING_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function renderRankingScreen() {
    const list = loadRanking().sort((a, b) => b.score - a.score).slice(0, 10);
    const el = $('#ranking-list');
    el.innerHTML = '';
    if (list.length === 0) {
      el.innerHTML = '<li class="ranking-empty">Nenhum registro encontrado. Seja o primeiro a sair vivo.</li>';
      return;
    }
    list.forEach((entry) => {
      const li = document.createElement('li');
      const diffLabel = DIFFICULTIES[entry.difficulty] ? DIFFICULTIES[entry.difficulty].label : 'MÉDIO';
      li.innerHTML = `<span>${entry.name} <span class="difficulty-tag">${diffLabel}</span></span><span>${entry.score} pts</span>`;
      el.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------
     12. INICIALIZAÇÃO / LISTENERS
     ------------------------------------------------------------------ */
  function attachMenuSounds() {
    $$('button').forEach((btn) => {
      btn.addEventListener('click', () => AudioEngine.click());
    });
  }

  function init() {
    // Boot sequence rápido antes do menu
    setTimeout(() => {
      showScreen('screen-menu');
      FX.spawnParticles($('#menu-particles'));
      FX.startNoiseLoop();
    }, 900);

    attachMenuSounds();

    $('#btn-play').addEventListener('click', () => {
      AudioEngine.ensureCtx();
      showScreen('screen-difficulty');
    });

    $('#btn-skip-intro').addEventListener('click', (e) => {
      e.stopPropagation();
      skipIntro();
    });

    $$('.difficulty-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        State.pendingDifficulty = btn.dataset.difficulty;
        AudioEngine.click();
        playIntro();
      });
    });

    $('#btn-instructions').addEventListener('click', () => showScreen('screen-instructions'));
    $('#btn-credits').addEventListener('click', () => showScreen('screen-credits'));
    $('#btn-ranking').addEventListener('click', () => { renderRankingScreen(); showScreen('screen-ranking'); });
    $('#btn-exit').addEventListener('click', () => {
      setArchitectMessage && null;
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#7d7f88;">Conexão encerrada.</div>';
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

    $('#btn-save-score').addEventListener('click', () => {
      const nameInput = $('#v-name');
      const name = (nameInput.value.trim() || 'ANÔNIMO').slice(0, 16).toUpperCase();
      const { score } = computeScore();
      const list = loadRanking();
      list.push({ name, score, difficulty: State.difficulty, date: new Date().toISOString() });
      saveRanking(list);
      nameInput.disabled = true;
      $('#btn-save-score').textContent = 'PONTUAÇÃO SALVA ✓';
      $('#btn-save-score').disabled = true;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
