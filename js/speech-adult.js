// Голос взрослого: Web Speech API в Chrome (ru-RU).
// Взрослый говорит «кот», «где уточка?», и на экране появляется нужный зверёк.

import { ANIMALS } from './animals.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const LANG = 'ru-RU';
const SAME_ANIMAL_GAP_MS = 3000; // один и тот же зверь не чаще раза в 3 с
const ECHO_GUARD_MS = 2000;      // столько после звука зверька микрофон ещё «не верит» услышанному
                                 // (Google присылает слова с опозданием — иначе зверь слышит сам себя)
const WATCHDOG_MS = 40000;       // Chrome молчит дольше — тихо перезапускаем распознавание

// Частые ошибки распознавателя и формы коротких слов → слово из словаря зверей.
// Пополнять по ходу тестов (смотрите «Услышано» в настройках).
const FIXES = {
  код: 'кот', кода: 'кот', коды: 'кот', кот: 'кот', кота: 'кот', коту: 'кот', коте: 'кот',
  котом: 'кот', коты: 'кот', котов: 'кот', котам: 'кот', котята: 'кот', котятки: 'кот',
  котейка: 'кот', котенька: 'кот', котэ: 'кот', котят: 'кот', котенка: 'кот', котенку: 'кот',
  котика: 'кот', котику: 'кот', котиком: 'кот',
  кису: 'киса', кисы: 'киса', кисонька: 'киса', кисуля: 'киса', кись: 'кис',
  мяв: 'мяу', мяу: 'мяу', мао: 'мяу',
  пандо: 'панда', понда: 'панда',
  утя: 'утя', утята: 'утя', утятки: 'утя', утенка: 'утенок', утенку: 'утенок', утку: 'утка',
  кряк: 'кря', кряква: 'утка',
  мартышку: 'мартышка',
  пса: 'пес', псу: 'пес', псом: 'пес', коня: 'конь', коню: 'конь', конем: 'конь',
  хрюхрю: 'хрю', тик: 'тиктак', квак: 'ква', пчёлы: 'пчела', пчелы: 'пчела', хрюша: 'хрюшка', мууу: 'му', муу: 'му', беее: 'бе', бее: 'бе',
};

// Обычные слова, которые похожи на имена зверей, но ими не являются («крошка» ≈ «кошка»).
const NOT_ANIMAL = new Set([
  'крошка', 'крошки', 'крошку', 'крошечка', 'шутка', 'шутку', 'точка', 'точку',
  'мышка', 'мышку', 'кашка', 'кашку', 'банда', 'котел', 'котла', 'который', 'которая',
]);

const wordCount = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const lastWords = (t, n) => t.trim().split(/\s+/).filter(Boolean).slice(-n).join(' ');

const normalize = (s) => s.toLowerCase().replace(/ё/g, 'е');
const tokensOf = (s) => normalize(s).split(/[^а-яa-z]+/).filter(Boolean);

// Словарь: слово → индекс зверя. «у-а» хранится как «уа».
const WORDS = [];
ANIMALS.forEach((a, index) => {
  for (const w of a.words) WORDS.push({ word: normalize(w).replace(/[^а-яa-z]/g, ''), index });
});

// Основа слова без последней гласной: «кошка» → «кошк», чтобы ловить «кошку», «кошкой».
const stemOf = (w) => (w.length >= 4 && /[аяоеиыуь]$/.test(w) ? w.slice(0, -1) : w);

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Ищет зверя в вариантах распознавания. Сначала точные совпадения во всех вариантах,
// потом по основе слова, потом нечёткие (одна ошибка в слове из 4+ букв).
export function matchAnimal(transcripts) {
  const variants = transcripts.map((t) => {
    const tokens = tokensOf(t)
      .filter((tok) => !NOT_ANIMAL.has(tok))
      .map((tok) => FIXES[tok] || tok);
    const pairs = tokens.slice(1).map((tok, i) => tokens[i] + tok); // «у а» → «уа»
    return { tokens, pairs };
  });

  for (const { tokens, pairs } of variants) {
    for (const tok of [...tokens, ...pairs]) {
      const hit = WORDS.find((w) => w.word === tok);
      if (hit) return { index: hit.index, word: tok, how: 'точно' };
    }
  }
  for (const { tokens } of variants) {
    for (const tok of tokens) {
      const hit = WORDS.find((w) => {
        const stem = stemOf(w.word);
        return stem.length >= 4 && tok.startsWith(stem) && tok.length - stem.length <= 3;
      });
      if (hit) return { index: hit.index, word: tok, how: 'по основе' };
    }
  }
  for (const { tokens } of variants) {
    for (const tok of tokens) {
      if (tok.length < 4) continue;
      const hit = WORDS.find((w) => w.word.length >= 4 && levenshtein(tok, w.word) <= 1);
      if (hit) return { index: hit.index, word: tok, how: 'примерно' };
    }
  }
  return null;
}

export class AdultVoice {
  constructor({ onMatch, onHeard, onStatus, onListening, isQuiet }) {
    this.supported = Boolean(SR);
    this.onMatch = onMatch;
    this.onHeard = onHeard;
    this.onStatus = onStatus;
    this.onListening = onListening;
    this.isQuiet = isQuiet;
    this.listening = false;
    this.local = false;        // распознавание на самом Маке, без интернета
    this.localState = 'unsupported';
    this.consumed = new Map(); // номер фразы → сколько слов в ней уже разобрано
    this.lastActivity = 0;     // когда Chrome последний раз что-то присылал
    this.last = { index: -1, t: 0 };
    this.startedAt = 0;
    this.quickEnds = 0;
    if (!this.supported) return;

    const rec = new SR();
    rec.lang = LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    this.rec = rec;

    rec.onstart = () => {
      this.consumed.clear();
      this.lastActivity = performance.now();
      this.startedAt = performance.now();
      this.onStatus(this.local ? 'Слушаю (на Маке, без интернета)' : 'Слушаю (через интернет, Google)');
    };
    rec.onresult = (e) => this.handleResult(e);
    rec.onerror = (e) => this.handleError(e.error);
    rec.onend = () => {
      this.lastActivity = performance.now();
      this.handleEnd();
    };
  }

  async checkLocal() {
    if (!this.supported) return this.localState;
    try {
      if (SR.available) this.localState = await SR.available({ langs: [LANG], processLocally: true });
      else if (SR.availableOnDevice) this.localState = await SR.availableOnDevice(LANG);
    } catch {
      this.localState = 'unsupported';
    }
    this.local = this.localState === 'available' && 'processLocally' in this.rec;
    this.rec.processLocally = this.local;
    return this.localState;
  }

  // Скачать модель распознавания русского на Мак (Chrome сам спросит, если нужно).
  async installLocal() {
    try {
      if (SR.install) await SR.install({ langs: [LANG], processLocally: true });
      else if (SR.installOnDevice) await SR.installOnDevice(LANG);
    } catch {}
    return this.checkLocal();
  }

  toggle() {
    if (this.listening) this.stop();
    else this.start();
  }

  start() {
    if (!this.supported || this.listening) return;
    clearInterval(this.watchdog);
    this.watchdog = setInterval(() => {
      if (this.listening && performance.now() - this.lastActivity > WATCHDOG_MS) {
        this.lastActivity = performance.now();
        this.recycle();
      }
    }, 5000);
    this.listening = true;
    this.quickEnds = 0;
    this.onListening(true);
    this.onStatus('Включаю микрофон…');
    try { this.rec.start(); } catch {}
  }

  stop(status = 'Микрофон выключен') {
    if (!this.supported) return;
    this.listening = false;
    clearTimeout(this.restartTimer);
    clearInterval(this.watchdog);
    this.onListening(false);
    this.onStatus(status);
    try { this.rec.abort(); } catch {}
  }

  // Chrome в режиме «слушать постоянно» дописывает новые слова в ту же фразу, пока речь
  // не прервётся. Поэтому помним не «фраза обработана», а сколько слов в ней уже разобрано,
  // и проверяем только новые слова (иначе после пары зверей новые слова «залипали»).
  handleResult(e) {
    this.lastActivity = performance.now();
    const quiet = this.isQuiet(ECHO_GUARD_MS);
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const alts = Array.from(e.results[i], (a) => a.transcript);
      const total = wordCount(alts[0]);
      const done = this.consumed.get(i) || 0;
      // Пока говорит сам зверёк, услышанное — это он, а не взрослый: просто пропускаем.
      if (!quiet) {
        this.consumed.set(i, total);
        continue;
      }
      if (total <= done) continue;
      const fresh = alts.map((t) => lastWords(t, Math.max(1, wordCount(t) - done)));
      this.onHeard(fresh[0]);
      const m = matchAnimal(fresh);
      if (!m) continue;
      this.consumed.set(i, total);
      const now = performance.now();
      if (m.index === this.last.index && now - this.last.t < SAME_ANIMAL_GAP_MS) continue;
      this.last = { index: m.index, t: now };
      this.onHeard(fresh[0], ANIMALS[m.index].name, m.how);
      this.onMatch(m.index);
      this.recycle();
      return;
    }
  }

  // Начать распознавание с чистого листа (после узнанного зверя или если Chrome «завис»).
  recycle() {
    if (!this.listening) return;
    this.recycling = true;
    try { this.rec.abort(); } catch {}
  }

  handleError(error) {
    if (error === 'no-speech' || error === 'aborted') return;
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      // Иногда Chrome отвечает так при перезапуске, хотя доступ к микрофону есть.
      // Выключаемся, только если доступа действительно нет.
      navigator.permissions?.query({ name: 'microphone' }).then((p) => {
        if (p.state !== 'granted') {
          this.stop('Нет доступа к микрофону. Разрешите его в Chrome (значок слева от адреса) и в Системных настройках → Конфиденциальность → Микрофон.');
        }
      }).catch(() => {});
    } else if (error === 'network') {
      this.onStatus('Нет связи с сервером распознавания. Проверьте интернет — продолжаю пробовать.');
    } else if (error === 'language-not-supported' && this.local) {
      this.useCloud('Распознавание на Маке недоступно, переключаюсь на интернет.');
    } else {
      this.onStatus('Ошибка распознавания: ' + error + ' — продолжаю слушать.');
    }
  }

  useCloud(status) {
    this.local = false;
    this.rec.processLocally = false;
    this.onStatus(status);
  }

  // Chrome сам останавливает распознавание после паузы в речи. Перезапускаем всегда,
  // пока взрослый сам не выключит микрофон. Если остановки идут одна за другой,
  // ждём чуть дольше (до 3 с), а распознавание на Маке меняем на интернет.
  handleEnd() {
    if (!this.listening) return;
    if (this.recycling) {
      // это мы сами начали с чистого листа — сразу слушаем дальше
      this.recycling = false;
      this.quickEnds = 0;
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => this.restart(), 150);
      return;
    }
    const quick = performance.now() - this.startedAt < 1500;
    this.quickEnds = quick ? this.quickEnds + 1 : 0;
    if (this.quickEnds >= 3 && this.local) this.useCloud('Распознавание на Маке не держится, переключаюсь на интернет.');
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => this.restart(), quick ? Math.min(3000, 500 * this.quickEnds) : 200);
  }

  restart() {
    if (!this.listening) return;
    try {
      this.rec.start();
    } catch (err) {
      if (err.name !== 'InvalidStateError') this.restartTimer = setTimeout(() => this.restart(), 1000);
    }
  }
}
