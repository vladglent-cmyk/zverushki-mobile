// Три спокойных режима с отдельными кнопками внизу:
//   «Спать»  — мама и папа уходят, звери рядами машут в экран и ложатся в кроватки под одеяло;
//              экран темнеет: «Спокойной ночи, пора выключать компьютер».
//   «Где?»   — игра называет зверя («корова»), малыш ищет и нажимает. Без очков и ошибок:
//              нажал не того — тот просто скажет своё имя, и вопрос прозвучит ещё раз.
//   «Ку-ку»  — за кустиком прячется зверь; нажатие (или пробел/стрелка) — он выглядывает и говорит.
// Во всех режимах двигается что-то одно.

import { ANIMALS } from './animals.js';
import { animalSvg } from './scene.js';
import * as sound from './sound.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const AWAY_MS = 1000;          // мама и папа плавно исчезают
const WAVE_MS = 1700;          // ряд машет
const TUCK_MS = 1300;          // и укладывается под одеяло
const WAKE_AFTER_MS = 3000;    // разбудить можно не раньше, чем через 3 с
const QUIZ_GAP_MS = 1500;      // пауза перед следующим вопросом
const QUIZ_REPEAT_MS = 1600;   // после «не того» вопрос повторяется
const PEEK_SHOW_MS = 2500;     // сколько зверь смотрит из-за куста после звука

const pickOther = (list, not) => {
  const pool = list.filter((x) => x !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

export function initModes({ scene, onModeChange }) {
  let mode = null;   // null | 'sleep' | 'quiz' | 'peek'
  const setMode = (m) => {
    mode = m;
    // без режима атрибут убираем совсем: пустой data-mode="" тоже прятал стрелки страниц
    if (m) document.body.dataset.mode = m;
    else delete document.body.dataset.mode;
    for (const id of ['btn-sleep', 'btn-quiz', 'btn-peek']) $(id).classList.toggle('on', $(id).dataset.mode === m);
    onModeChange?.(m);
  };

  // ---------- Спать ----------

  let sleepToken = 0;
  let sleptAt = 0;

  // Кроватка: спинка и подушка за зверем, одеяло спереди.
  const BED_BACK = `<svg viewBox="0 0 100 100"><g stroke="#6E5A50" stroke-width="2.5" stroke-linejoin="round">
    <rect x="12" y="18" width="76" height="62" rx="16" fill="#D9B48F"/>
    <rect x="22" y="30" width="56" height="20" rx="10" fill="#FFFDF8"/></g></svg>`;
  const BED_FRONT = `<svg viewBox="0 0 100 100"><g stroke="#6E5A50" stroke-width="2.5" stroke-linejoin="round">
    <path d="M8 70 Q19 63 30 70 Q41 63 50 70 Q59 63 70 70 Q81 63 92 70 L92 92 Q50 100 8 92 Z" fill="#C9D8F0"/></g>
    <g fill="#E7EEF9"><circle cx="24" cy="80" r="3"/><circle cx="42" cy="87" r="3"/><circle cx="58" cy="79" r="3"/><circle cx="76" cy="86" r="3"/></g></svg>`;

  function tuckIn(tile) {
    if (!tile.querySelector('.bed-back')) {
      tile.querySelector('.tile-animal').insertAdjacentHTML('beforebegin', `<div class="bed-back">${BED_BACK}</div>`);
      tile.querySelector('.tile-animal').insertAdjacentHTML('afterend', `<div class="bed-front">${BED_FRONT}</div>`);
    }
    void tile.offsetWidth;
    tile.classList.add('asleep');
  }

  // Плитки по рядам, как они стоят на экране.
  function rows(tiles) {
    const map = new Map();
    for (const t of tiles) {
      const top = Math.round(t.getBoundingClientRect().top / 10);
      if (!map.has(top)) map.set(top, []);
      map.get(top).push(t);
    }
    return [...map.keys()].sort((x, y) => x - y).map((k) => map.get(k));
  }

  async function sleep() {
    const token = ++sleepToken;
    stopQuiz();
    stopPeek();
    if (scene.open) await scene.close();
    sound.stop();
    setMode('sleep');
    document.body.classList.add('dusk');   // экран начинает темнеть сразу
    // Засыпают карточки открытой страницы; мама и папа (фото) уходят.
    const tiles = [...document.querySelectorAll('#grid .page.on .tile')];
    const isPhoto = (t) => Boolean(ANIMALS.find((a) => a.id === t.dataset.id)?.photos);
    const people = tiles.filter(isPhoto);
    const animals = tiles.filter((t) => !isPhoto(t));
    people.forEach((t) => t.classList.add('away'));
    await wait(AWAY_MS);
    for (const row of rows(animals)) {
      if (token !== sleepToken) return;
      row.forEach((t) => t.classList.add('waving'));
      await wait(WAVE_MS);
      row.forEach((t) => {
        t.classList.remove('waving');
        tuckIn(t);
      });
      await wait(TUCK_MS);
    }
    if (token !== sleepToken) return;
    sleptAt = performance.now();
    $('night').hidden = false;
    requestAnimationFrame(() => document.body.classList.add('night'));
  }

  function wake() {
    if (performance.now() - sleptAt < WAKE_AFTER_MS && document.body.classList.contains('night')) return;
    sleepToken++;
    document.body.classList.remove('night', 'dusk');
    setTimeout(() => { if (!document.body.classList.contains('night')) $('night').hidden = true; }, 1500);
    document.querySelectorAll('#grid .tile').forEach((t) => t.classList.remove('waving', 'asleep', 'away'));
    setTimeout(() => {
      if (mode === 'sleep') return;
      document.querySelectorAll('#grid .bed-back, #grid .bed-front').forEach((el) => el.remove());
    }, 1200);
    setMode(null);
  }

  $('night-wake').addEventListener('click', wake);

  // ---------- Где котик? ----------

  // Вопросы — про карточки открытой страницы.
  const quizCards = () => {
    const withWord = scene.visible().filter((i) => sound.hasWord(ANIMALS[i]));
    return withWord.length >= 2 ? withWord : scene.visible();
  };
  let target = -1;
  let quizTimer = null;

  function ask(again = false) {
    clearTimeout(quizTimer);
    if (mode !== 'quiz') return;
    if (!again) target = pickOther(quizCards(), target);
    const animal = ANIMALS[target];
    $('quiz-text').textContent = `Где ${animal.name.toLowerCase()}?`;
    $('quiz').hidden = false;
    sound.playWord(animal);
  }

  function startQuiz() {
    stopPeek();
    setMode('quiz');
    target = -1;
    if (scene.open) scene.close();
    else ask();
  }

  function stopQuiz() {
    clearTimeout(quizTimer);
    $('quiz').hidden = true;
    if (mode === 'quiz') setMode(null);
  }

  scene.onPick = (i) => {
    if (mode === 'sleep') return true;          // спящих не будим нажатием
    if (mode !== 'quiz' || target < 0) return false;
    if (i === target) {
      $('quiz').hidden = true;
      return false;                              // правильный — обычный показ
    }
    // «Не тот» — без ошибок: этот зверь мягко кивает и говорит своё имя, вопрос звучит снова.
    const tile = document.querySelectorAll('#grid .tile')[i];
    tile.classList.remove('nudge');
    void tile.offsetWidth;
    tile.classList.add('nudge');
    sound.playWord(ANIMALS[i]);
    clearTimeout(quizTimer);
    quizTimer = setTimeout(() => ask(true), QUIZ_REPEAT_MS);
    return true;
  };

  // Показали загаданного — новый вопрос; показали другого (например, голосом) — тот же вопрос.
  scene.onClosed = () => {
    if (mode !== 'quiz') return;
    const again = target >= 0 && scene.index !== target;
    quizTimer = setTimeout(() => ask(again), QUIZ_GAP_MS);
  };

  $('quiz').addEventListener('click', () => ask(true));   // нажать на вопрос — повторить

  // ---------- Ку-ку ----------

  const peek = $('peek');
  const peekAnimal = $('peek-animal');
  let peekIndex = -1;
  let peekBusy = false;
  let peekBag = [];   // все карточки со всех страниц в случайном порядке: пока не выйдут все, никто не повторится

  function placePeek() {
    if (!peekBag.length) {
      peekBag = ANIMALS.map((_, i) => i).filter((i) => i !== peekIndex);
      for (let i = peekBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [peekBag[i], peekBag[j]] = [peekBag[j], peekBag[i]];
      }
    }
    peekIndex = peekBag.pop();
    const animal = ANIMALS[peekIndex];
    peekAnimal.innerHTML = animal.photos
      ? `<img class="peek-photo" src="${animal.photos[0]}" alt="">`
      : animalSvg(animal.id);
    peekAnimal.dataset.anim = animal.photos ? 'slides' : animal.animation;
    peekAnimal.classList.remove('up', 'act');
  }

  function startPeek() {
    stopQuiz();
    if (scene.open) scene.close();
    setMode('peek');
    placePeek();
    peek.classList.add('visible');
    $('grid').classList.remove('visible');
  }

  function stopPeek() {
    if (mode !== 'peek') return;
    peek.classList.remove('visible');
    peek.querySelector('.peek-box').classList.remove('open');
    $('grid').classList.add('visible');
    sound.stop();
    setMode(null);
  }

  async function peekOut() {
    if (mode !== 'peek' || peekBusy) return;
    peekBusy = true;
    const box = peekAnimal.parentElement;
    box.classList.add('open');           // кусты разъезжаются в стороны
    peekAnimal.classList.add('up');      // зверь выходит целиком
    await wait(1000);
    peekAnimal.classList.add('act');
    sound.play(ANIMALS[peekIndex]);
    await wait(600);
    while (mode === 'peek' && !sound.isQuiet(0)) await wait(300);
    await wait(PEEK_SHOW_MS);
    if (mode === 'peek') {
      peekAnimal.classList.remove('up', 'act');
      box.classList.remove('open');      // кусты снова сходятся
      await wait(1200);
      if (mode === 'peek') placePeek();
    }
    peekBusy = false;
  }

  peek.addEventListener('click', (e) => {
    if (e.target.closest('#peek-back')) return stopPeek();
    peekOut();
  });

  // ---------- кнопки ----------

  $('btn-sleep').addEventListener('click', () => (mode === 'sleep' ? wake() : sleep()));
  $('btn-quiz').addEventListener('click', () => (mode === 'quiz' ? stopQuiz() : startQuiz()));
  $('btn-peek').addEventListener('click', () => (mode === 'peek' ? stopPeek() : startPeek()));

  return {
    get mode() { return mode; },
    // Клавиатура (только пробел и стрелки): в «Ку-ку» — «выгляни», во сне и в «Где?» — ничего.
    onKey() {
      if (mode === 'peek') { peekOut(); return true; }
      if (mode === 'sleep') return true;
      if (mode === 'quiz') return true;
      return false;
    },
  };
}
