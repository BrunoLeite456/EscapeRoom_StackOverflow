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

    return {
      startNoiseLoop, stopNoiseLoop, startMonitorNoiseLoop, stopMonitorNoiseLoop,
      shake, glitchPulse, whiteFlash, blackout, setCorruptionLevel, spawnParticles,
    };
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
     9. MOTOR DE FASES — perguntas em sequência, com um cronômetro único
        por fase: 1 minuto para cada pergunta que a fase tiver (fase com
        5 perguntas = 5 minutos no total; o tempo não é resetado entre
        perguntas). A tela mostra só a pergunta atual e o cronômetro; as
        dicas ficam no caderninho da mesa (ver renderNotebookHints).
     ------------------------------------------------------------------ */
  const SECONDS_PER_QUESTION = 60;
  let qTimerId = null;
  let qTimeLeft = 0;

  function updateQTimerDisplay() {
    const text = formatTime(qTimeLeft);
    const critical = qTimeLeft <= 30;
    [$('#hud-qtimer'), $('#hud-qtimer-notebook')].forEach((el) => {
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('time-critical', critical);
    });
  }

  function stopQuestionTimer() {
    clearInterval(qTimerId);
  }

  function startPhaseTimer(totalSeconds, onExpire) {
    stopQuestionTimer();
    qTimeLeft = totalSeconds;
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
   * cada vez. O cronômetro é único para a fase inteira (1 min por
   * pergunta, somado) e continua contando entre uma pergunta e outra.
   * Usado por todas as fases — só muda o conteúdo de `questions` e
   * `options`.
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

    function timeUpOnCurrentQuestion() {
      const q = questions[idx];
      registerMistake();
      $$('.option-btn', root).forEach((b) => {
        b.disabled = true;
        if (b.textContent === q.correct) b.classList.add('correct-flash');
      });
      setTimeout(onAllDone, 1200); // acabou o tempo da fase inteira
    }

    function handleAnswer(choice, btnEl, q) {
      if (choice === q.correct) {
        btnEl.classList.add('correct-flash');
        $$('.option-btn', root).forEach((b) => { b.disabled = true; });
        registerSuccess();
        setTimeout(() => {
          idx += 1;
          if (idx >= questions.length) { stopQuestionTimer(); onAllDone(); }
          else renderCard(questions[idx]);
        }, 650);
      } else {
        btnEl.classList.add('wrong-flash');
        btnEl.disabled = true;
        registerMistake();
      }
    }

    const totalSeconds = questions.length * SECONDS_PER_QUESTION;
    renderCard(questions[idx]);
    startPhaseTimer(totalSeconds, timeUpOnCurrentQuestion);
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

    toggleNotebook(false);
    renderNotebookHints(phase.hints || []);
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
    // ---------------- FASE 1 — Sala do Cliente (fácil) ----------------
    {
      slug: 'sala_cliente',
      title: 'Sala do Cliente',
      introMessage: 'Comece pelo básico: isso é uma AÇÃO que o sistema faz, ou uma QUALIDADE de como ele funciona?',
      docName: 'Requisitos — Nível 1',
      doneMessage: 'A porta destrancou. Você aprendeu a diferença mais básica.',
      options: ['Requisito Funcional', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'O sistema deve permitir que o cliente acompanhe o status do pedido em tempo real.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve responder a qualquer ação do usuário em menos de 2 segundos.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir cadastrar um novo produto com nome, preço e estoque.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve suportar 1.000 usuários simultâneos sem travar.', correct: 'Requisito Não Funcional' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"O sistema deve permitir cadastrar um produto." — é uma AÇÃO que o sistema executa.' },
        { label: 'Requisito Não Funcional', example: '"O sistema deve suportar 1.000 usuários simultâneos." — é uma QUALIDADE (desempenho), não uma ação.' },
      ],
    },

    // ---------------- FASE 2 — Sala das Dúvidas ----------------
    {
      slug: 'sala_duvidas',
      title: 'Sala das Dúvidas',
      introMessage: 'Mais frases, o mesmo raciocínio: função do sistema ou qualidade do sistema?',
      docName: 'Requisitos — Nível 2',
      doneMessage: 'O cofre abriu. Você já não hesita mais tanto.',
      options: ['Requisito Funcional', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'O sistema deve emitir nota fiscal automaticamente após a confirmação do pagamento.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve estar disponível 99,9% do tempo, incluindo feriados.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o cliente cancele um pedido em até 10 minutos após a compra.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve criptografar os dados de cartão de crédito armazenados.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve gerar um relatório mensal de vendas em PDF.', correct: 'Requisito Funcional' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"Emitir nota fiscal automaticamente." — o sistema FAZ algo.' },
        { label: 'Requisito Não Funcional', example: '"Estar disponível 99,9% do tempo." — descreve um atributo de qualidade (confiabilidade).' },
      ],
    },

    // ---------------- FASE 3 — Sala das Armadilhas ----------------
    {
      slug: 'sala_armadilhas',
      title: 'Sala das Armadilhas',
      introMessage: 'Cuidado, essas frases foram escritas para confundir. Leia com calma.',
      docName: 'Requisitos — Nível 3',
      doneMessage: 'Você não caiu na armadilha. Poucos chegam até aqui sem errar.',
      options: ['Requisito Funcional', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'O sistema deve rejeitar senhas com menos de 8 caracteres no momento do cadastro.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve carregar a lista de produtos em até 3 segundos, mesmo com 10 mil itens cadastrados.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o administrador exporte todos os pedidos em CSV.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve ser compatível com os navegadores Chrome, Firefox e Edge.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve enviar um e-mail de confirmação após o cadastro do usuário.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve continuar funcionando mesmo com uma conexão de internet instável, reenviando dados perdidos automaticamente.', correct: 'Requisito Não Funcional' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"Rejeitar senhas com menos de 8 caracteres." — é uma regra que o sistema EXECUTA no cadastro.' },
        { label: 'Requisito Não Funcional', example: '"Ser compatível com Chrome, Firefox e Edge." — é sobre COMO o sistema roda, não sobre o que ele faz.' },
      ],
    },

    // ---------------- FASE 4 — Sala da Ambiguidade ----------------
    {
      slug: 'sala_ambiguidade',
      title: 'Sala da Ambiguidade',
      introMessage: 'Aqui quase tudo parece as duas coisas ao mesmo tempo. Foque no verbo principal da frase.',
      docName: 'Requisitos — Nível 4',
      doneMessage: 'O modelo está consistente. Você já pensa como engenheiro de requisitos.',
      options: ['Requisito Funcional', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'O sistema deve bloquear a conta após 3 tentativas de senha incorreta.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve garantir que nenhuma senha seja armazenada em texto puro.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o cliente avalie o produto com uma nota de 1 a 5.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve escalar automaticamente os servidores em picos de acesso, como Black Friday.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir agendar o envio de um pedido para uma data futura.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve ser fácil de usar mesmo por pessoas sem experiência com tecnologia.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve calcular automaticamente o frete com base no CEP informado.', correct: 'Requisito Funcional' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"Calcular o frete com base no CEP." — uma tarefa concreta, com entrada e saída.' },
        { label: 'Requisito Não Funcional', example: '"Ser fácil de usar." — uma característica desejada, sem uma ação específica.' },
      ],
    },

    // ---------------- FASE 5 — Sala Final: Auditoria ----------------
    {
      slug: 'sala_auditoria',
      title: 'Sala Final — Auditoria',
      introMessage: 'Última sala. As frases são quase gêmeas — a diferença está em um detalhe só.',
      docName: 'Requisitos — Nível 5 (Documento Final)',
      doneMessage: 'Sistema reconstruído. Você separou função de qualidade até no limite.',
      options: ['Requisito Funcional', 'Requisito Não Funcional'],
      questions: shuffle([
        { text: 'O sistema deve permitir a recuperação de senha por e-mail, limitada a 3 tentativas por hora.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve processar cada solicitação de recuperação de senha em menos de 5 segundos.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o gerente aprove ou recuse um pedido de reembolso.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve manter 100% de disponibilidade durante o horário comercial.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve registrar a data e a hora de cada aprovação de reembolso.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve suportar picos de até 20 mil acessos simultâneos durante promoções.', correct: 'Requisito Não Funcional' },
        { text: 'O sistema deve permitir que o cliente baixe a nota fiscal em PDF a qualquer momento.', correct: 'Requisito Funcional' },
        { text: 'O sistema deve continuar funcionando mesmo se um dos servidores falhar.', correct: 'Requisito Não Funcional' },
      ]),
      hints: [
        { label: 'Requisito Funcional', example: '"Registrar a data e hora de cada aprovação." — uma ação concreta que fica salva.' },
        { label: 'Requisito Não Funcional', example: '"Processar em menos de 5 segundos." — o mesmo processo, mas medindo desempenho, não a ação em si.' },
      ],
    },
  ];

  /* ------------------------------------------------------------------
     11. GAME OVER / VITÓRIA / RANKING
     ------------------------------------------------------------------ */
  const RANKING_KEY = 'arquiteto_ranking_v1';
  const SESSION_KEY = 'arquiteto_session_v1';
  const STATS_KEY = 'arquiteto_stats_v1';
  const USERS_KEY = 'arquiteto_users_v1'; // cache local de contas (cadastro/login)

  // -------------------------------------------------------------------
  // JSONBin.io — mesma configuração usada pelo ranking global. O bin
  // guarda um único objeto JSON com duas listas: "scores" (ranking) e
  // "users" (contas de cadastro/login), então dá pra usar as duas
  // funcionalidades com a mesma conta/chave. Veja README.md.
  // -------------------------------------------------------------------
  const JSONBIN_BIN_ID = '6a750f93f5f4af5e29f4f49a';
  const JSONBIN_ACCESS_KEY = '$2a$10$XUGY9XbamlOm141sEfO5re.57SsC85kRU4pHGOhsX8U5u8ZQnNq0e';
  const JSONBIN_CONFIGURED = JSONBIN_BIN_ID !== '6a750f93f5f4af5e29f4f49a' && JSONBIN_ACCESS_KEY !== '$2a$10$XUGY9XbamlOm141sEfO5re.57SsC85kRU4pHGOhsX8U5u8ZQnNq0e';
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
      return JSON.parse(localStorage.getItem(STATS_KEY)) || {
        gamesPlayed: 0, bestScore: 0, totalDocsRecovered: 0, totalCorrect: 0, totalAnswers: 0,
      };
    } catch (e) {
      return { gamesPlayed: 0, bestScore: 0, totalDocsRecovered: 0, totalCorrect: 0, totalAnswers: 0 };
    }
  }
  function saveStats(stats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
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

  function beginGame() {
    resetState(State.pendingDifficulty || DEFAULT_DIFFICULTY);
    showScreen('screen-game');
    renderHUD();
    FX.setCorruptionLevel(0);
    FX.startMonitorNoiseLoop();
    renderCurrentPhase();
    State.running = true;
    startTimer();
    AudioEngine.startAmbient();
  }

  function stopGameLoops() {
    stopTimer();
    stopQuestionTimer();
    AudioEngine.stopAmbient();
    FX.stopMonitorNoiseLoop();
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
    recordGameEnd({ won: false });
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

    recordGameEnd({ won: true, score });

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
    $('#v-name').value = loadSession()?.nickname || '';

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

  // -- Ranking global: busca e grava só a lista de pontuações no JSONBin,
  //    preservando as contas de usuário que estejam no mesmo bin. Se não
  //    estiver configurado (ou a rede falhar), cai pro ranking local.
  async function fetchGlobalRanking() {
    const record = await fetchBinRecord();
    if (!record) return null;
    return Array.isArray(record.scores) ? record.scores : [];
  }

  async function pushGlobalScore(entry) {
    if (!JSONBIN_CONFIGURED) return false;
    const record = (await fetchBinRecord()) || {};
    const scores = Array.isArray(record.scores) ? record.scores : [];
    const updated = [...scores, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_GLOBAL_ENTRIES);
    return writeBinRecord({ ...record, scores: updated });
  }

  let rankingCache = []; // última lista carregada (local ou global), pra filtrar sem refetch

  async function renderRankingScreen() {
    const tbody = $('#ranking-table-body');
    const noteEl = $('#ranking-source-note');
    tbody.innerHTML = '<tr><td colspan="6" class="ranking-empty">Carregando…</td></tr>';
    if (noteEl) noteEl.textContent = '';

    let list;
    let isGlobal = false;
    if (JSONBIN_CONFIGURED) {
      const global = await fetchGlobalRanking();
      if (global) { list = global; isGlobal = true; }
    }
    if (!list) list = loadRanking();

    rankingCache = [...list].sort((a, b) => b.score - a.score);
    if (noteEl) {
      noteEl.textContent = isGlobal
        ? 'ranking global — todo mundo que jogou aparece aqui'
        : 'ranking local deste navegador (ranking global não configurado)';
    }
    renderRankingTable();
  }

  // Aplica o filtro de dificuldade + pesquisa por nome sobre o cache já
  // carregado (RF06 tabela / RF07 filtro-pesquisa), sem precisar refetch.
  function renderRankingTable() {
    const tbody = $('#ranking-table-body');
    const search = ($('#ranking-search')?.value || '').trim().toLowerCase();
    const diffFilter = $('#ranking-filter-difficulty')?.value || 'all';

    const filtered = rankingCache.filter((entry) => {
      const matchesSearch = !search || entry.name.toLowerCase().includes(search);
      const matchesDiff = diffFilter === 'all' || entry.difficulty === diffFilter;
      return matchesSearch && matchesDiff;
    }).slice(0, 25);

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="ranking-empty">Nenhum registro encontrado.</td></tr>';
      return;
    }
    filtered.forEach((entry, i) => {
      const diffLabel = DIFFICULTIES[entry.difficulty] ? DIFFICULTIES[entry.difficulty].label : 'MÉDIO';
      const dateLabel = entry.date ? new Date(entry.date).toLocaleDateString('pt-BR') : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${entry.name}</td>
        <td>${diffLabel}</td>
        <td>${entry.score} pts</td>
        <td>${dateLabel}</td>
        <td><span class="status-pill">SOBREVIVEU</span></td>
      `;
      tbody.appendChild(tr);
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

      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;

      if (!result.ok) {
        errEl.textContent = result.reason;
        errEl.hidden = false;
        return;
      }

      errEl.hidden = true;
      saveSession({ nickname, loginAt: new Date().toISOString() });
      updateTerminalOperatorLabel();
      showScreen('screen-menu');
    });

    // -- Ranking: filtro/pesquisa (RF07) --
    $('#ranking-search').addEventListener('input', renderRankingTable);
    $('#ranking-filter-difficulty').addEventListener('change', renderRankingTable);

    $('#btn-play').addEventListener('click', () => {
      AudioEngine.ensureCtx();
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

    $('#btn-save-score').addEventListener('click', async () => {
      const nameInput = $('#v-name');
      const btn = $('#btn-save-score');
      const name = (nameInput.value.trim() || 'ANÔNIMO').slice(0, 16).toUpperCase();
      const { score } = computeScore();
      const entry = { name, score, difficulty: State.difficulty, date: new Date().toISOString() };

      // Salva local imediatamente (sempre funciona, mesmo offline)
      const list = loadRanking();
      list.push(entry);
      saveRanking(list);

      nameInput.disabled = true;
      btn.disabled = true;
      btn.textContent = 'SALVANDO…';

      const wentGlobal = await pushGlobalScore(entry);
      btn.textContent = wentGlobal ? 'PONTUAÇÃO SALVA NO RANKING GLOBAL ✓' : 'PONTUAÇÃO SALVA (LOCAL) ✓';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
