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
  // `hasBoss` controla se a Fase 5 (O Arquiteto, confronto final) entra
  // no fluxo de fases dessa dificuldade — só a Difícil libera o chefão.
  // A grade da Fase 4 (Senha em Lote) é sempre 3x3, em qualquer dificuldade
  // — ver BATCH_GRID_DIM mais abaixo.
  const DIFFICULTIES = {
    facil:     { label: 'FÁCIL',     minutes: 75, segments: 12, scoreMultiplier: 0.85, hasBoss: false },
    medio:     { label: 'MÉDIO',     minutes: 60, segments: 10, scoreMultiplier: 1.0,  hasBoss: false },
    dificil:   { label: 'DIFÍCIL',   minutes: 45, segments: 7,  scoreMultiplier: 1.25, hasBoss: true },
    // "Impossível" é o modo secreto: não roda o motor de fases nem o
    // cronômetro normal — em vez disso, beginGame() desvia pro minigame
    // de ritmo em tela cheia (ver GuitarHero mais abaixo). Os campos
    // minutes/segments/hasBoss ficam aqui só por consistência de forma,
    // mas não são usados nesse modo.
    impossivel:{ label: 'IMPOSSÍVEL', minutes: 0, segments: 1, scoreMultiplier: 1.0, hasBoss: false, isRhythmMode: true },
  };
  const DEFAULT_DIFFICULTY = 'medio';
  // Só é liberado depois de vencer uma partida na Difícil.
  const IMPOSSIBLE_UNLOCK_KEY = 'arquiteto_impossible_unlocked_v1';
  function isImpossibleUnlocked() {
    try { return localStorage.getItem(IMPOSSIBLE_UNLOCK_KEY) === '1'; } catch (e) { return false; }
  }
  function unlockImpossibleMode() {
    try { localStorage.setItem(IMPOSSIBLE_UNLOCK_KEY, '1'); } catch (e) {}
  }
  // Mostra/esconde a opção "Impossível" e a dica de bloqueio na tela de
  // seleção de dificuldade, conforme o flag salvo no localStorage.
  function refreshDifficultyOptions() {
    const unlocked = isImpossibleUnlocked();
    const btn = $('#diff-impossivel');
    const hint = $('#difficulty-locked-hint');
    if (btn) btn.hidden = !unlocked;
    if (hint) hint.hidden = unlocked;
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
  function renderSequentialQuestions(root, { questions, options, onAllDone, docProgress, layers }) {
    let idx = 0;

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

    function renderCard(q) {
      root.innerHTML = '';
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
      card.appendChild(text);
      card.appendChild(opts);
      root.appendChild(card);
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

    function handleAnswer(choice, btnEl, q) {
      if (choice === q.correct) {
        btnEl.classList.add('correct-flash');
        $$('.option-btn', root).forEach((b) => { b.disabled = true; });
        registerSuccess();

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

    const totalSeconds = questions.length * SECONDS_PER_QUESTION;
    renderCard(questions[idx]);
    startPhaseTimer(totalSeconds, timeUpOnCurrentQuestion);
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
  function renderBossHUD(container, playerHP, architectHP) {
    container.innerHTML = '';
    const hud = document.createElement('div');
    hud.className = 'boss-hud';
    hud.innerHTML = `
      <div class="boss-bar-row">
        <span class="boss-bar-label">O ARQUITETO</span>
        <div class="boss-bar"><div class="boss-bar-fill boss-bar-architect" style="width:${clamp(architectHP, 0, 100)}%"></div></div>
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

  function renderBossPhase(root, phase, onAllDone) {
    const boss = { playerHP: 100, architectHP: 100 };
    root.innerHTML = '';
    const hudWrap = document.createElement('div');
    hudWrap.className = 'boss-hud-wrap';
    const stageRoot = document.createElement('div');
    stageRoot.className = 'boss-stage-root';
    root.appendChild(hudWrap);
    root.appendChild(stageRoot);
    renderBossHUD(hudWrap, boss.playerHP, boss.architectHP);

    function damage(target, amount) {
      if (target === 'architect') boss.architectHP = clamp(boss.architectHP - amount, 0, 100);
      else boss.playerHP = clamp(boss.playerHP - amount, 0, 100);
      renderBossHUD(hudWrap, boss.playerHP, boss.architectHP);
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
        onResolve: (resolvedCount) => {
          $$('.boss-light', lightsRow).forEach((l, i) => l.classList.toggle('lit', i < resolvedCount));
        },
      }, finishBoss);
    }

    function finishBoss() {
      FX.whiteFlash(400);
      AudioEngine.metalDoor();
      setArchitectMessage(phase.stage3.doneMessage || phase.doneMessage);
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
    story.textContent = phase.story || phase.introMessage || '';
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
    if (State.difficulty === 'dificil') unlockImpossibleMode();

    $('#victory-sub').textContent = 'C.O.N.T.R.A. está morto. O Arquiteto continua de pé — e agora sabe que você está vindo.';
    $('#victory-eerie').textContent = 'O confronto real só existe em um lugar: o Modo Impossível.';
    $('#v-time').textContent = formatTime(State.timeLeft);
    $('#v-errors').textContent = String(State.mistakes);
    $('#v-integrity').textContent = `${State.integrity} / ${State.totalIntegritySegments}`;
    $('#v-precision').textContent = `${Math.round(precision * 100)}%`;
    $('#v-score').textContent = String(score);
    $('#v-name').value = loadSession()?.nickname || '';

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
      introMessage: 'Uma barreira. Bem-feita, aliás — alguém não queria que você chegasse até aqui. Classifique cada requisito: acerte e a camada é enfraquecida, erre e ela se estabiliza.',
      doneMessage: 'FIREWALL DESATIVADO. TODAS AS CAMADAS DE PROTEÇÃO FORAM REMOVIDAS. ACESSO AO C.O.N.T.R.A. LIBERADO.',
      options: ['Requisito Funcional', 'Requisito Não Funcional', 'Regra de Negócio'],
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

  // -------------------------------------------------------------------
  // JSONBin.io — mesma configuração usada pelo ranking global. O bin
  // guarda um único objeto JSON com duas listas: "scores" (ranking) e
  // "users" (contas de cadastro/login), então dá pra usar as duas
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
    // secreto Impossível e avisamos que é lá que ele vai acontecer.
    // Ver goToNextPhase() — depois desta cutscene o jogo vai direto
    // pra tela de vitória, sem passar por nenhuma "tela de fase final".
    unlockImpossibleMode();
    await new Promise((r) => setTimeout(r, 400));
    FX.glitchPulse($('.monitor-unit'));
    AudioEngine.staticBurst(0.45);
    await addLine('🔓 MODO IMPOSSÍVEL LIBERADO', 'line-secret line-reveal-title', 24, 400);
    await addLine('É lá que o confronto final contra O Arquiteto vai acontecer.', 'line-dim', 18, 350);
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
    // Vencer na Difícil libera o modo secreto "Impossível" na tela de
    // seleção de dificuldade (ver isImpossibleUnlocked/refreshDifficultyOptions).
    if (State.difficulty === 'dificil') unlockImpossibleMode();

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
    runVictoryMonologue(ending, acronymMode);
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
     11b. MODO IMPOSSÍVEL — GUITAR HERO EM TELA CHEIA
     Minigame de ritmo independente do motor de fases, sem servidor e
     sem nenhum arquivo de áudio. Este modo NÃO toca nenhum som/música:
     é só o desafio visual (notas caindo) cronometrado no relógio do
     navegador (performance.now()), sem depender de Web Audio.
     O ritmo do "chart" (quando cada nota cai) é calcado no andamento
     real e público da música "Loser" — 83 BPM, tom de Fá menor —
     que são dados factuais (tempo/tonalidade), não a gravação, a
     melodia ou a letra da música, que não são reproduzidas em nenhum
     momento. O padrão de notas em si (qual pista cada nota usa) é um
     motivo original, gerado algoritmicamente pra este jogo.
     ------------------------------------------------------------------ */
  const GuitarHero = (() => {
    const LANE_KEYS = ['d', 'f', 'j', 'k'];
    const LANE_COLORS = ['#3dff6e', '#ff3d5a', '#ffe23d', '#3dc8ff'];
    const HIT_WINDOW = 0.16;      // tolerância (s) pra contar como acerto
    const PERFECT_WINDOW = 0.065; // dentro disso conta como "perfeito"
    const TRAVEL_TIME = 1.55;     // segundos que a nota leva do topo até a linha de acerto
    const MISS_PENALTY = 12;
    const HIT_REGEN = 2;
    const BPM = 83; // andamento real e público da música-tema (dado factual, não protegido por direito autoral)

    let chart = null;
    let startAt = 0;       // performance.now() (em segundos) em que a partida começa de fato
    let rafId = null;
    let running = false;
    let ended = false;
    let score = 0;
    let combo = 0;
    let bestCombo = 0;
    let health = 100;
    let hits = 0;
    let keyHandler = null;

    // Motivo original composto pra este minigame (0-3 = pista; -1 = pausa).
    // O andamento (eighth = colcheia) segue o BPM real e público da faixa.
    function generateChart() {
      const eighth = 60 / BPM / 2;
      const phraseA = [0, -1, 1, 0, -1, 2, 1, -1, 3, -1, 2, 1, -1, 0, 1, -1];
      const phraseB = [1, -1, 2, 3, -1, 2, 1, -1, 0, -1, 1, 2, -1, 3, 2, -1];
      const notes = [];
      let t = 2.2; // contagem regressiva antes da 1ª nota
      const repeats = 12;
      for (let r = 0; r < repeats; r++) {
        const phrase = (r % 4 === 3) ? phraseB : phraseA;
        phrase.forEach((lane) => {
          if (lane >= 0) notes.push({ time: t, lane, hit: false, missed: false, el: null, spawned: false });
          t += eighth;
        });
      }
      return { notes, duration: t };
    }

    function now() { return performance.now() / 1000; }

    function el(sel) { return document.getElementById(sel); }

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
      div.style.left = `calc(${note.lane * 25}% + 3.5%)`;
      div.style.width = '18%';
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
      const elapsed = now() - startAt;
      let best = null;
      let bestDiff = Infinity;
      chart.notes.forEach((n) => {
        if (n.lane !== lane || n.hit || n.missed) return;
        const diff = elapsed - n.time;
        if (Math.abs(diff) <= HIT_WINDOW && Math.abs(diff) < bestDiff) { best = n; bestDiff = diff; }
      });
      if (!best) return; // "toque em vazio": sem punição, como na maioria dos jogos de ritmo
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
      health = clamp(health - MISS_PENALTY, 0, 100);
      showFeedback('FALHOU', 'fb-miss');
      if (note.el) { note.el.classList.add('gh-note-missed'); removeNoteEl(note, 300); }
      updateHud();
      if (health <= 0) endRun('fail');
    }

    function loop() {
      if (!running) return;
      const elapsed = now() - startAt;

      chart.notes.forEach((n) => {
        const spawnTime = n.time - TRAVEL_TIME;
        if (!n.spawned && !n.hit && !n.missed && elapsed >= spawnTime) spawnNoteEl(n);
        if (n.el && !n.hit && !n.missed) {
          const progress = clamp((elapsed - spawnTime) / TRAVEL_TIME, 0, 1.3);
          n.el.style.top = `${progress * 86}%`;
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

    function resetVisuals() {
      const layer = el('gh-notes-layer');
      if (layer) layer.innerHTML = '';
      score = 0; combo = 0; bestCombo = 0; health = 100; hits = 0; ended = false;
      updateHud();
    }

    function startPlay() {
      resetVisuals();
      el('gh-intro').hidden = true;
      el('gh-result').hidden = true;
      chart = generateChart();
      startAt = now() + 0.15;
      attachKeys();
      running = true;
      rafId = requestAnimationFrame(loop);
    }

    function endRun(cause) {
      if (ended) return;
      ended = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      detachKeys();

      const totalNotes = chart.notes.length;
      const accuracy = totalNotes ? Math.round((hits / totalNotes) * 100) : 0;
      const titleEl = el('gh-result-title');
      const subEl = el('gh-result-sub');
      if (cause === 'fail') {
        titleEl.textContent = 'VOCÊ FALHOU A MÚSICA';
        subEl.textContent = 'O modo Impossível não perdoa. Tente de novo.';
        try { AudioEngine.error(); FX.glitchPulse(); } catch (e) {}
      } else {
        titleEl.textContent = 'FAIXA CONCLUÍDA';
        subEl.textContent = 'Você sobreviveu ao ritmo inteiro. Nada mal.';
        try { AudioEngine.success(); } catch (e) {}
      }
      el('gh-result-score').textContent = String(score);
      el('gh-result-combo').textContent = `${bestCombo}x`;
      el('gh-result-acc').textContent = `${accuracy}%`;
      el('gh-result').hidden = false;
    }

    function stopAndCleanup() {
      running = false;
      ended = true;
      if (rafId) cancelAnimationFrame(rafId);
      detachKeys();
      const layer = el('gh-notes-layer');
      if (layer) layer.innerHTML = '';
    }

    function open() {
      resetVisuals();
      el('gh-result').hidden = true;
      el('gh-intro').hidden = false;
    }

    function bindUi() {
      el('gh-start-btn').addEventListener('click', () => { try { AudioEngine.click(); } catch (e) {} startPlay(); });
      el('gh-intro-back-btn').addEventListener('click', () => {
        stopAndCleanup();
        showScreen('screen-difficulty');
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
        // Modo secreto: nada de narrativa, nada de PC — vai direto pro
        // palco em tela cheia do minigame de ritmo. A troca de tela e a
        // abertura do minigame acontecem primeiro, sem depender de nada
        // que possa falhar (ex. efeitos visuais); o flash é só um extra.
        if (btn.dataset.difficulty === 'impossivel') {
          showScreen('screen-guitarhero');
          GuitarHero.open();
          try { AudioEngine.click(); FX.whiteFlash(180); } catch (e) {}
          return;
        }
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
