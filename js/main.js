import { ANIMALS } from './animals.js';
import { Scene, loadImages, animalSvg } from './scene.js';
import * as sound from './sound.js';
import { loadSettings, saveSettings, initGear, initPanel } from './settings.js';
import { AdultVoice } from './speech-adult.js';
import { ChildVoice, ChildMic, NOISE, MIN_LOUDNESS } from './speech-child.js';
import { initChildPanel, initKidBubble } from './child-ui.js';
import { initModes } from './modes.js';
import { loadFamilyPhotos, addPhotos, clearPhotos } from './family.js';

const KEY_GAP_MS = 1500;        // пробел и стрелки листают зверей не чаще раза в 1,5 с
const HOLD_MS = 300;            // пробел держат дольше — это как кнопка «Малыш»
const RELEASE_GRACE_MS = 400;   // после отпускания ещё чуть-чуть слушаем: малыш мог договаривать
const MIN_HOLD_FRAMES = 10;     // короче ~0,25 с — случайное нажатие
const RETRAIN_EVERY = 5;        // после стольких новых примеров модель тихо доучивается
const MAX_AUTO_NOISE = 60;      // фон из «до нажатия» копим до стольких записей

const $ = (id) => document.getElementById(id);
const settings = loadSettings();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function applySettings() {
  sound.setVolume(settings.volume);
  document.body.classList.toggle('calm', settings.calm || reducedMotion.matches);
  $('heard').hidden = !settings.showHeard;
}

function enterFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
}

async function init() {
  applySettings();
  reducedMotion.addEventListener('change', applySettings);
  // Фото семьи, добавленные на этом телефоне, превращают карточку в слайдшоу.
  const familyIds = ANIMALS.filter((a) => a.family).map((a) => a.id);
  const familyPhotos = await loadFamilyPhotos(familyIds);
  for (const [id, blobs] of Object.entries(familyPhotos)) {
    ANIMALS.find((a) => a.id === id).photos = blobs.map((b) => URL.createObjectURL(b));
  }

  const [videos] = await Promise.all([
    fetch('assets/videos/videos.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    loadImages(),
    sound.preload(ANIMALS),
  ]);

  const scene = new Scene({
    grid: $('grid'),
    stage: $('stage'),
    stageTile: $('stage-tile'),
    back: $('back'),
    kruzhok: $('kruzhok'),
    videos,
    videoEnabled: () => settings.video,
    autoReturn: () => settings.autoReturn,
    isQuiet: sound.isQuiet,
    onShow: (animal) => sound.play(animal),
    onHide: () => sound.stop(),
  });

  const panel = initPanel($('settings'), settings, {
    onChange: () => {
      applySettings();
      refreshRings();
    },
    onTest: () => sound.play(ANIMALS[scene.index >= 0 ? scene.index : 0]),
    onFullscreen: enterFullscreen,
  });
  initGear($('gear'), () => panel.open());

  // Открываемся на той странице, где остановились в прошлый раз.
  scene.setPage(settings.page || 0, 1, false);
  // Звуки грузятся не все сразу, а для карточек открытой страницы — заранее и тихо.
  const prefetchPage = () => sound.prefetch(scene.visible().map((i) => ANIMALS[i]));
  scene.onPage = (k) => {
    settings.page = k;
    saveSettings(settings);
    prefetchPage();
  };
  setTimeout(prefetchPage, 1500);

  // Настройки → «Фото семьи»: добавить из галереи телефона или убрать.
  function renderFamily() {
    const box = $('family-photos');
    box.replaceChildren(...familyIds.map((id) => {
      const a = ANIMALS.find((x) => x.id === id);
      const row = document.createElement('div');
      row.className = 'row family-row';
      row.innerHTML = '<span></span><input type="file" accept="image/*" multiple hidden><button type="button" class="add">Добавить фото</button><button type="button" class="del">Убрать</button>';
      const n = familyPhotos[id]?.length || 0;
      row.querySelector('span').textContent = `${a.name}${n ? ` — фото: ${n}` : ''}`;
      const input = row.querySelector('input');
      row.querySelector('.add').addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        if (!input.files.length) return;
        row.querySelector('span').textContent = `${a.name} — сохраняю…`;
        await addPhotos(id, [...input.files]);
        location.reload();
      });
      const del = row.querySelector('.del');
      del.hidden = !n;
      del.addEventListener('click', async () => {
        await clearPhotos(id);
        location.reload();
      });
      return row;
    }));
  }
  renderFamily();

  const modes = initModes({ scene });

  // Зверь, услышанный во время смены картинок, показывается чуть позже.
  // Во сне и в «Ку-ку» голосом зверей не открываем.
  // Один и тот же зверь, услышанный сразу обоими «ушами» (взрослым и малыша), показывается один раз.
  let lastVoice = { i: -1, t: 0 };
  const goWhenFree = (i, tries = 10) => {
    if (modes.mode === 'sleep' || modes.mode === 'peek') return;
    if (tries === 10) {
      // Эхо: зверь только что сам назвал себя из колонок — микрофон слышит это и просит его снова.
      // Поэтому уже открытого зверя голос не перезапускает, а только что замолчавшего —
      // не открывает ещё 6 секунд.
      if (i === scene.index && (scene.open || !sound.isQuiet(6000))) return;
      if (i === lastVoice.i && performance.now() - lastVoice.t < 3000) return;
      lastVoice = { i, t: performance.now() };
    }
    if (!scene.busy) return scene.goTo(i);
    if (tries > 0) setTimeout(() => goWhenFree(i, tries - 1), 300);
  };
  const showHeard = (line) => { $('heard').textContent = line; };

  // ---------- голос малыша ----------
  // Держите кнопку «Малыш» (или пробел), пока малыш говорит. Если модель узнала зверя —
  // он появляется, и игра спрашивает «Малыш сказал „Котик“?». Если нет — «Кого назвал малыш?»,
  // и ответ родителя становится новым примером. Модель доучивается сама, это видно в подсказке.

  const child = new ChildVoice();
  const kidMic = new ChildMic();
  let holding = false;
  let pending = null;   // фрагмент, который ждёт ответа родителя
  // Подсказка с вопросом прячется через 15 с; после этого ответа уже не ждём.
  const waitingAnswer = () => pending && performance.now() - pending.at < 16000;

  const kidCaption = (text) => { $('kid-caption').textContent = text; };
  const bubble = initKidBubble($('kid-bubble'), {
    animalSvg,
    onTeach: (label) => teach(label),
    onWrongGuess: () => bubble.choose(pending?.similar || []),
    pageCards: () => scene.visible(),
  });

  async function beginKid() {
    if (holding || !started || panel.isOpen() || childPanel.isOpen()) return;
    holding = true;
    sound.stop();   // чтобы микрофон слышал малыша, а не зверька
    $('kid').classList.add('listening');
    kidCaption('Слушаю…');
    bubble.listening();
    if (!child.ready) child.init().catch(() => {});   // модель грузится, пока малыш говорит
    try {
      await kidMic.start();
    } catch {
      holding = false;
      $('kid').classList.remove('listening');
      kidCaption('Малыш');
      bubble.info('Нет доступа к микрофону. Разрешите его в Chrome (значок слева от адреса).');
      return;
    }
    if (holding) kidMic.beginHold();
  }

  async function endKid() {
    if (!holding) return;
    holding = false;
    $('kid').classList.remove('listening');
    kidCaption('Малыш');
    await new Promise((r) => setTimeout(r, RELEASE_GRACE_MS));
    const seg = kidMic.endHold();
    if (!seg || seg.held.length < MIN_HOLD_FRAMES) return bubble.info('Держите кнопку, пока малыш говорит, и отпустите, когда скажет.');
    if (seg.loudness < MIN_LOUDNESS) return bubble.info('Ничего не расслышал. Попробуйте ещё раз поближе к Маку.');

    if (!child.ready) {
      bubble.info('Загружаю модель… В первый раз нужен интернет.', { keep: true });
      try {
        await child.init();
      } catch {
        return bubble.info('Не получилось загрузить модель. Проверьте интернет.');
      }
    }
    const frames = enough(seg.held, seg.before, child.windowFrames);
    pending = { frames, before: seg.before, at: performance.now(), similar: [] };
    const guess = child.training ? null : child.predict(frames);
    pending.similar = ChildVoice.similar(guess);
    if (guess && guess.label !== NOISE && guess.score >= settings.childThreshold) {
      const i = ANIMALS.findIndex((a) => a.id === guess.label);
      showHeard(`малыш → ${ANIMALS[i].name} (${Math.round(guess.score * 100)}%)`);
      goWhenFree(i);
      bubble.guess(ANIMALS[i]);
    } else {
      bubble.choose(ChildVoice.similar(guess));
    }
  }

  // Модели нужно минимум ~1 с звука: короткое «ко» дополняем тем, что было перед ним.
  function enough(held, before, n) {
    let frames = held;
    if (frames.length < n) frames = before.slice(-(n - frames.length)).concat(frames);
    while (frames.length < n) frames = [frames[0], ...frames];
    return frames;
  }

  async function teach(label) {
    const p = pending;
    pending = null;
    bubble.hide();
    if (!p || !child.ready) return;
    await child.addFromFrames(label, p.frames, kidMic.sampleRate);
    // То, что звучало до нажатия (голоса взрослых, шум комнаты), — хороший пример «фона».
    if (p.before.length >= child.windowFrames && child.counts()[NOISE] < MAX_AUTO_NOISE) {
      await child.addFromFrames(NOISE, p.before, kidMic.sampleRate);
    }
    if (label !== NOISE) {
      const i = ANIMALS.findIndex((a) => a.id === label);
      if (scene.index !== i || !scene.open) goWhenFree(i);
      const n = child.counts()[label];
      bubble.info(`Запомнил: ${ANIMALS[i].name} (${n} ${n === 1 ? 'пример' : n < 5 ? 'примера' : 'примеров'})`);
    } else {
      bubble.info('Запомнил: это был шум.');
    }
    refreshChildStatus();
    maybeTrain();
  }

  // Модель растёт вместе с речью малыша: как только примеров хватает, она тихо учится.
  async function maybeTrain() {
    if (child.training || !child.canTrain()) return;
    if (child.trained && child.newSinceTrain() < RETRAIN_EVERY) return;
    if (holding || waitingAnswer() || scene.busy || !sound.isQuiet(300)) return setTimeout(maybeTrain, 1500);
    $('kid').classList.add('training');
    try {
      await child.train((p) => {
        kidCaption(`Учусь… ${Math.round(p * 100)}%`);
        if (!waitingAnswer() && !holding) bubble.training(p);
      });
      if (!waitingAnswer() && !holding) bubble.info('Готово! Теперь я лучше понимаю малыша.');
    } catch (err) {
      console.warn('Обучение не удалось:', err);
      bubble.info('Не получилось обучиться. Попробую ещё раз после следующих примеров.');
    }
    $('kid').classList.remove('training');
    kidCaption('Малыш');
    refreshChildStatus();
  }

  // Зелёные полоски вокруг зверей: сколько примеров голоса малыша уже есть (полный круг — 8).
  const RING_FULL = 8;
  function refreshRings() {
    if (!child.ready) return;
    const counts = child.counts();
    scene.setProgress(ANIMALS.map((a) => (counts[a.id] || 0) / RING_FULL));
    document.body.classList.toggle('rings', settings.showRings && child.examples.length > 0);
  }

  function refreshChildStatus() {
    refreshRings();
    if (typeof syncAutoKid === 'function') syncAutoKid();
    $('child-status').textContent = !child.ready ? 'Модель ещё не загружена'
      : child.trained ? `Модель обучена, примеров: ${child.examples.length}`
        : 'Модель ещё не обучена: держите «Малыш» и отвечайте, кого он назвал';
  }

  const childPanel = initChildPanel($('child-panel'), {
    child,
    playSamples: sound.playSamples,
    onOpen: () => {},
    onClose: () => {
      refreshChildStatus();
      maybeTrain();
    },
    onTrained: refreshChildStatus,
  });
  $('open-child').addEventListener('click', () => childPanel.open());

  // Библиотеки для малыша грузим заранее, только если уже есть записи или модель.
  child.hasData().then((has) => {
    if (has) child.init().then(refreshChildStatus).catch(() => {});
  });

  const kid = $('kid');
  kid.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    beginKid();
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => kid.addEventListener(ev, endKid));

  // ---------- малыш без кнопки ----------
  // Пока включён микрофон «Взрослый», модель малыша тоже слушает: замечает, что кто-то
  // заговорил и замолчал, и проверяет этот кусочек. Узнала уверенно — показывает зверя и
  // спрашивает «Малыш сказал „Котик“?» (ответ учит модель дальше). Звук самой игры не слушает.
  const AUTO = {
    START_FRAMES: 3,     // столько громких кадров подряд (~70 мс) — начало речи
    END_SILENCE: 13,     // столько тихих (~300 мс) — конец
    MAX_FRAMES: 110,     // не длиннее ~2,5 с
    MIN_FRAMES: 7,       // короче ~0,15 с — щелчок, не слово (короткое «ма» проходит)
    GAP_MS: 2500,        // не чаще одного зверя за 2,5 с
    BONUS: 0.05,         // без кнопки требуем уверенность чуть выше
    SUGGEST_MIN: 0.35,   // «похоже на…» спрашиваем, только если зверь набрал хотя бы столько
    SUGGEST_MAX_FRAMES: 70, // и звук короткий (до ~1,6 с), как слово малыша, а не фраза взрослого
    ECHO_MS: 900,
  };
  const auto = { on: false, speech: false, tainted: false, frames: [], pre: [], loud: 0, silent: 0, floor: 0.004, lastHit: 0 };

  async function syncAutoKid() {
    const want = voice.listening && child.trained;
    if (want === auto.on) return;
    auto.on = want;
    if (want) {
      try {
        await kidMic.start();
        kidMic.onFrame = onKidFrame;
      } catch {
        auto.on = false;
      }
    } else {
      kidMic.onFrame = null;
      if (!holding) kidMic.stop();
    }
  }

  function onKidFrame(frame, rms) {
    if (holding || !auto.on) {
      auto.speech = false;
      auto.frames = [];
      return;
    }
    if (!auto.speech) {
      auto.pre.push(frame);
      if (auto.pre.length > 12) auto.pre.shift();
      auto.floor = auto.floor * 0.97 + Math.min(rms, 0.05) * 0.03;   // уровень тишины в комнате
      auto.loud = rms > Math.max(0.008, auto.floor * 3) ? auto.loud + 1 : 0;
      if (auto.loud >= AUTO.START_FRAMES) {
        auto.speech = true;
        auto.tainted = !sound.isQuiet(300);   // началось, пока говорил зверёк, — не наше
        auto.frames = [...auto.pre];
        auto.silent = 0;
      }
      return;
    }
    auto.frames.push(frame);
    auto.silent = rms < Math.max(0.008, auto.floor * 2) ? auto.silent + 1 : 0;
    if (auto.silent >= AUTO.END_SILENCE || auto.frames.length >= AUTO.MAX_FRAMES) {
      const seg = auto.frames;
      const tainted = auto.tainted;
      auto.speech = false;
      auto.frames = [];
      auto.pre = [];
      auto.loud = 0;
      if (!tainted && seg.length - auto.silent >= AUTO.MIN_FRAMES) onAutoSegment(seg);
    }
  }

  function onAutoSegment(frames) {
    if (!child.trained || child.training || waitingAnswer() || !sound.isQuiet(AUTO.ECHO_MS)) return;
    if (panel.isOpen() || childPanel.isOpen() || modes.mode === 'sleep' || modes.mode === 'peek') return;
    if (performance.now() - auto.lastHit < AUTO.GAP_MS) return;
    const guess = child.predict(enough(frames, [], child.windowFrames));
    if (!guess) return;
    const sure = guess.label !== NOISE && guess.score >= Math.min(0.97, settings.childThreshold + AUTO.BONUS);
    if (!sure) {
      // Не уверена, но звук похож на кого-то («ма» — мама или машина?) — спросим родителя,
      // ответ станет новым примером. На явный шум и разговоры не реагируем.
      const near = ChildVoice.similar(guess, 3, AUTO.SUGGEST_MIN);
      if ((guess.label === NOISE && guess.score > 0.6) || !near.length || frames.length > AUTO.SUGGEST_MAX_FRAMES) return;
      auto.lastHit = performance.now();
      pending = { frames, before: [], at: performance.now(), similar: near };
      bubble.choose(near, 'Малыш что-то сказал… Похоже на:');
      return;
    }
    const i = ANIMALS.findIndex((a) => a.id === guess.label);
    if (i < 0) return;
    auto.lastHit = performance.now();
    showHeard(`малыш (без кнопки) → ${ANIMALS[i].name} (${Math.round(guess.score * 100)}%)`);
    goWhenFree(i);
    pending = { frames, before: [], at: performance.now(), similar: ChildVoice.similar(guess) };
    bubble.guess(ANIMALS[i]);
  }

  // ---------- голос взрослого ----------

  const voice = new AdultVoice({
    onMatch: (i) => {
      // Пока держат «Малыш», слушаем малыша, а не взрослого.
      if (started && !panel.isOpen() && !childPanel.isOpen() && !holding) goWhenFree(i);
    },
    onHeard: (text, animal, how) => {
      const line = animal ? `«${text.trim()}» → ${animal} (${how})` : `«${text.trim()}»`;
      $('voice-heard').textContent = 'Услышано: ' + line;
      showHeard(line);
    },
    onStatus: (text) => { $('voice-status').textContent = text; },
    onListening: (on) => {
      $('mic').classList.toggle('on', on);
      $('mic').setAttribute('aria-pressed', String(on));
      syncAutoKid();
    },
    isQuiet: sound.isQuiet,
  });
  if (!voice.supported) {
    document.body.classList.add('no-voice');
    $('voice-status').textContent = 'Этот браузер не умеет распознавать речь. Откройте игру в Google Chrome.';
  }
  $('voice-install').addEventListener('click', async () => {
    $('voice-local').textContent = 'Скачиваю…';
    showLocal(await voice.installLocal());
  });
  const showLocal = (state) => {
    const text = {
      available: 'Русское распознавание есть на этом Маке: работает без интернета.',
      downloadable: 'Chrome может скачать русское распознавание на Мак, тогда интернет не понадобится.',
      downloading: 'Распознавание скачивается…',
      unavailable: 'Распознавание на Маке для русского недоступно: работает через интернет (Google).',
      unsupported: 'Работает через интернет (Google).',
    };
    $('voice-local').textContent = text[state] || text.unsupported;
    $('voice-install-row').hidden = state !== 'downloadable';
  };
  if (voice.supported) voice.checkLocal().then(showLocal);

  $('mic').addEventListener('click', () => voice.toggle());

  // ---------- любимые карточки и показ «сами собой» ----------
  // Игра считает, сколько раз открывали каждую карточку (нажатием, голосом, клавишей).
  // Если несколько секунд (1–5, в настройках) ничего не выбирают, она сама показывает любую
  // карточку со всех страниц, без повторов, пока не покажет все. Показанное самой игрой в счёт не идёт.

  const STATS_KEY = 'zverushki.stats';
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch {}
  let autoShowing = false;
  let lastActivity = performance.now();
  let idleBag = [];   // все карточки в случайном порядке; закончились — перемешиваем заново
  const touch = () => { lastActivity = performance.now(); };
  document.addEventListener('pointerdown', touch, true);
  document.addEventListener('keydown', touch, true);

  scene.onCard = (i) => {
    if (autoShowing) {
      autoShowing = false;
      return;
    }
    touch();
    const id = ANIMALS[i].id;
    stats[id] = (stats[id] || 0) + 1;
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
  };

  function randomCard(not) {
    if (!idleBag.length) {
      idleBag = ANIMALS.map((_, i) => i).filter((i) => i !== not);
      for (let i = idleBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idleBag[i], idleBag[j]] = [idleBag[j], idleBag[i]];
      }
    }
    return idleBag.pop();
  }

  const idleSec = $('set-idle-sec');
  const syncIdleSec = () => {
    idleSec.value = settings.idleSec;
    $('set-idle-sec-out').textContent = settings.idleSec + ' с';
  };
  syncIdleSec();
  idleSec.addEventListener('input', () => {
    settings.idleSec = Number(idleSec.value);
    saveSettings(settings);
    syncIdleSec();
  });

  setInterval(() => {
    // Пока карточка открыта или что-то происходит — тишина ещё не началась.
    const busy = scene.open || scene.busy || modes.mode || holding || waitingAnswer() ||
      panel.isOpen() || childPanel.isOpen() || !sound.isQuiet(500) || document.hidden;
    if (busy || !settings.idleShow) {
      if (scene.open || scene.busy) touch();
      return;
    }
    if (performance.now() - lastActivity < settings.idleSec * 1000) return;
    const i = randomCard(scene.index);
    if (i == null) return;
    autoShowing = true;
    touch();
    scene.goTo(i);
  }, 250);

  function renderFavorites() {
    const top = Object.entries(stats)
      .map(([id, n]) => ({ a: ANIMALS.find((x) => x.id === id), n }))
      .filter((x) => x.a)
      .sort((x, y) => y.n - x.n)
      .slice(0, 5);
    const list = $('fav-list');
    list.replaceChildren(...top.map(({ a, n }) => {
      const li = document.createElement('li');
      li.textContent = `${a.name} — ${n}`;
      return li;
    }));
    if (!top.length) list.innerHTML = '<li class="empty">Пока ничего не открывали</li>';
  }
  $('gear').addEventListener('pointerdown', renderFavorites);
  $('fav-reset').addEventListener('click', () => {
    stats = {};
    try { localStorage.removeItem(STATS_KEY); } catch {}
    renderFavorites();
  });
  renderFavorites();

  // ---------- старт и клавиатура ----------

  // Стартового экрана нет: браузер разрешает звук и полный экран только после действия
  // человека, поэтому включаем их на первом же нажатии (мышь или клавиша).
  const started = true;
  document.body.classList.add('started');
  const firstTouch = () => {
    sound.unlock();
    enterFullscreen();
  };
  document.addEventListener('pointerdown', firstTouch, { capture: true, once: true });
  document.addEventListener('keydown', firstTouch, { capture: true, once: true });

  // Клавиатура: зверей листают только пробел (короткое нажатие) и стрелки.
  // Остальные клавиши ничего не делают — малыш может спокойно стучать по клавиатуре.
  const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
  const PREV_KEYS = ['ArrowLeft', 'ArrowUp'];
  let lastKey = 0;
  let spaceTimer = null;
  const keyStep = (dir = 1) => {
    const now = performance.now();
    if (now - lastKey < KEY_GAP_MS) return;
    lastKey = now;
    if (dir > 0) scene.next();
    else scene.prev();
  };
  document.addEventListener('keydown', (e) => {
    if (panel.isOpen() || childPanel.isOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyF') return enterFullscreen();
    const dir = NEXT_KEYS.includes(e.code) ? 1 : PREV_KEYS.includes(e.code) ? -1 : 0;
    if (e.code !== 'Space' && !dir) return;
    if (e.code !== 'Space' && modes.onKey()) return;
    if (e.code === 'Space') {
      spaceTimer = setTimeout(() => {
        spaceTimer = null;
        beginKid();
      }, HOLD_MS);
      return;
    }
    keyStep(dir);
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    if (spaceTimer) {
      clearTimeout(spaceTimer);
      spaceTimer = null;
      if (!modes.onKey()) keyStep(1);
    } else {
      endKid();
    }
  });

  // Клик не забирает фокус (иначе пробел «нажимал» бы последнюю кнопку).
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.settings')) e.preventDefault(); });
  // Без контекстного меню, перетаскивания картинок и масштабирования жестом.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  document.body.classList.add('ready');
}

init();
