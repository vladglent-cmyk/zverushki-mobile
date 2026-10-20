// Голос малыша: маленькая модель, дообученная на голосе именно этого ребёнка.
// TensorFlow.js + speech-commands (transfer learning) прямо в браузере.
//
// Все записи остаются на этом Маке: примеры и модель лежат в IndexedDB браузера,
// резервная копия — в JSON-файле, который родитель сохраняет сам.
// Из интернета грузятся только библиотеки и базовая (общая, не наша) модель.

import { ANIMALS } from './animals.js';

const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js';
const SPEECH_COMMANDS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js';

export const NOISE = '_background_noise_';
export const WORD_SEC = 2;      // запись слова: библиотека сама найдёт в ней самое громкое место
export const NOISE_SEC = 5;     // запись фона: режется на много коротких примеров
const MODEL_NAME = 'zverushki-child';
const EPOCHS = 25;
const PLAYBACK_RATE = 16000;    // для «прослушать» храним звук попроще, чтобы занимал меньше места
const MIN_LOUDNESS = 0.008;     // тише этого — считаем, что малыш ничего не сказал (короткое тихое «ма» проходит)
const FFT_SIZE = 1024;           // как в speech-commands: кадр 1024 отсчёта (~23 мс)
const COLUMNS = 232;            // и первые 232 частоты каждого кадра

export const labelName = (label) =>
  label === NOISE ? 'Фон / другое' : (ANIMALS.find((a) => a.id === label)?.name ?? label);

// ---------- IndexedDB ----------

let dbPromise = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('zverushki', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('examples', { keyPath: 'id', autoIncrement: true });
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idb(store, mode, op) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = op(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

// ---------- вспомогательное ----------

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не удалось загрузить ' + src));
    document.head.append(s);
  });
}

function toPlayback(data, rate) {
  const ratio = rate / PLAYBACK_RATE;
  const out = new Int16Array(Math.floor(data.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(data.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += data[j];
    out[i] = Math.max(-1, Math.min(1, sum / Math.max(1, b - a))) * 32767;
  }
  return out;
}

function loudness(data) {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  return max;
}

function joinFrames(frames, key) {
  const size = frames[0][key].length;
  const out = new Float32Array(frames.length * size);
  frames.forEach((fr, i) => out.set(fr[key], i * size));
  return out;
}

function loudestFrame(frames) {
  let best = 0;
  let bestSum = -Infinity;
  frames.forEach((fr, i) => {
    let sum = 0;
    for (let j = 0; j < fr.f.length; j++) sum += fr.f[j];
    if (sum > bestSum) {
      bestSum = sum;
      best = i;
    }
  });
  return best;
}

function toBase64(typed) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(str, Type) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer);
}

// ---------- модель ----------

export class ChildVoice {
  constructor() {
    this.transfer = null;
    this.examples = [];     // наши записи: { id, uid, label, date, frameSize, spec, audio?, sr? }
    this.labels = null;     // классы обученной модели в порядке её выходов; null — не обучена
    this.trainedAt = 0;
    this.training = false;
    this.initPromise = null;
  }

  // Без загрузки TensorFlow: есть ли что-то сохранённое (чтобы не грузить библиотеки зря).
  async hasData() {
    try {
      const trained = await idb('meta', 'readonly', (s) => s.get('trained'));
      const count = await idb('examples', 'readonly', (s) => s.count());
      return Boolean(trained) || count > 0;
    } catch {
      return false;
    }
  }

  init() {
    this.initPromise ??= (async () => {
      await loadScript(TFJS_URL);
      await loadScript(SPEECH_COMMANDS_URL);
      const base = window.speechCommands.create('BROWSER_FFT');
      await base.ensureModelLoaded();
      this.transfer = base.createTransfer(MODEL_NAME);

      const trained = await idb('meta', 'readonly', (s) => s.get('trained'));
      if (trained) {
        try {
          await this.transfer.load();
          this.labels = trained.labels;
          this.trainedAt = trained.date;
        } catch {
          this.labels = null;
        }
      }
      this.examples = await idb('examples', 'readonly', (s) => s.getAll());
      for (const ex of this.examples) ex.uid = this.addToDataset(ex);
    })();
    this.initPromise.catch(() => { this.initPromise = null; });
    return this.initPromise;
  }

  get ready() {
    return this.transfer != null;
  }

  get trained() {
    return this.labels != null;
  }

  addToDataset(ex) {
    return this.transfer.dataset.addExample({
      label: ex.label,
      spectrogram: { data: ex.spec, frameSize: ex.frameSize },
    });
  }

  async save(ex) {
    const { uid, ...stored } = ex;
    ex.id = await idb('examples', 'readwrite', (s) => s.add(stored));
    this.examples.push(ex);
  }

  counts() {
    const out = { [NOISE]: 0 };
    for (const a of ANIMALS) out[a.id] = 0;
    for (const ex of this.examples) out[ex.label] = (out[ex.label] || 0) + 1;
    return out;
  }

  newSinceTrain() {
    return this.examples.filter((ex) => ex.date > this.trainedAt).length;
  }

  canTrain() {
    const c = this.counts();
    return c[NOISE] >= 1 && ANIMALS.some((a) => c[a.id] >= 3);
  }

  // Запись с микрофона. Для слова: если было слишком тихо, запись не сохраняется.
  async record(label) {
    const sec = label === NOISE ? NOISE_SEC : WORD_SEC;
    await this.transfer.collectExample(label, { durationSec: sec, includeRawAudio: true });
    const list = this.transfer.getExamples(label);
    const { uid, example } = list[list.length - 1];
    const raw = example.rawAudio;
    if (label !== NOISE && raw && loudness(raw.data) < MIN_LOUDNESS) {
      this.transfer.removeExample(uid);
      return null;
    }
    const ex = {
      uid,
      label,
      date: Date.now(),
      source: 'record',
      frameSize: example.spectrogram.frameSize,
      spec: Float32Array.from(example.spectrogram.data),
      audio: raw ? toPlayback(raw.data, raw.sampleRateHz) : undefined,
      sr: PLAYBACK_RATE,
    };
    await this.save(ex);
    return ex;
  }

  // Фрагмент с детского микрофона: родитель сказал, кого назвал малыш (или «шум»).
  async addFromFrames(label, frames, sampleRate) {
    const ex = {
      label,
      date: Date.now(),
      source: 'teach',
      frameSize: COLUMNS,
      spec: joinFrames(frames, 'f'),
      audio: toPlayback(joinFrames(frames, 't'), sampleRate),
      sr: PLAYBACK_RATE,
    };
    ex.uid = this.addToDataset(ex);
    await this.save(ex);
    return ex;
  }

  lastOf(label) {
    for (let i = this.examples.length - 1; i >= 0; i--) {
      if (this.examples[i].label === label) return this.examples[i];
    }
    return null;
  }

  async remove(ex) {
    this.transfer.removeExample(ex.uid);
    await idb('examples', 'readwrite', (s) => s.delete(ex.id));
    this.examples.splice(this.examples.indexOf(ex), 1);
  }

  // Речь малыша меняется: старые записи можно убрать.
  oldExamples(days) {
    const limit = Date.now() - days * 24 * 3600 * 1000;
    return this.examples.filter((ex) => ex.date < limit);
  }

  async train(onProgress) {
    this.training = true;
    try {
      this.transfer.collateTransferWords();
      // Библиотека создаёт модель один раз под тот набор слов, что был при первом обучении,
      // и потом переиспользует её. Когда малыш выучил нового зверя, слов стало больше —
      // и обучение падало с ошибкой о размерах. Поэтому «голову» модели всегда собираем
      // заново под текущие слова (общая базовая часть остаётся), учится она на всех примерах.
      this.transfer.transferHead?.dispose();
      this.transfer.transferHead = null;
      this.transfer.model = null;
      await this.transfer.train({
        epochs: EPOCHS,
        augmentByMixingNoiseRatio: 0.5,
        callback: { onEpochEnd: async (epoch) => onProgress?.((epoch + 1) / EPOCHS) },
      });
      await this.transfer.save();
      this.labels = this.transfer.wordLabels();
      this.trainedAt = Date.now();
      await idb('meta', 'readwrite', (s) => s.put({ labels: this.labels, date: this.trainedAt }, 'trained'));
    } finally {
      this.training = false;
    }
  }

  get windowFrames() {
    return this.transfer?.nonBatchInputShape?.[0] ?? 43;
  }

  // Кого назвал малыш: берём окно ~1 с вокруг самого громкого места фрагмента.
  predict(frames) {
    const n = this.windowFrames;
    if (!this.trained || frames.length < n) return null;
    const left = Math.max(0, Math.min(frames.length - n, loudestFrame(frames) - Math.floor(n / 2)));
    const data = joinFrames(frames.slice(left, left + n), 'f');
    const tf = window.tf;
    const scores = tf.tidy(() => {
      const x = tf.tensor4d(data, [1, n, COLUMNS, 1]);
      const { mean, variance } = tf.moments(x);
      return this.transfer.model.predict(x.sub(mean).div(variance.sqrt().add(1e-7))).dataSync();
    });
    const ranked = this.labels
      .map((label, i) => ({ label, score: scores[i] }))
      .sort((a, b) => b.score - a.score);
    return { label: ranked[0].label, score: ranked[0].score, ranked };
  }

  // Самые похожие зверушки (без «фона») — чтобы спросить родителя «Мама или Машина?».
  static similar(guess, max = 3, min = 0.08) {
    if (!guess) return [];
    return guess.ranked.filter((r) => r.label !== NOISE && r.score >= min).slice(0, max).map((r) => r.label);
  }

  exportJson() {
    return JSON.stringify({
      app: 'zverushki',
      version: 1,
      exported: new Date().toISOString(),
      examples: this.examples.map((ex) => ({
        label: ex.label,
        date: ex.date,
        source: ex.source,
        frameSize: ex.frameSize,
        spec: toBase64(ex.spec),
        audio: ex.audio ? toBase64(ex.audio) : undefined,
        sr: ex.sr,
      })),
    });
  }

  // Добавляет примеры из файла; уже имеющиеся (та же дата и класс) пропускает.
  async importJson(text) {
    const data = JSON.parse(text);
    if (data.app !== 'zverushki' || !Array.isArray(data.examples)) throw new Error('Это не файл Зверушек');
    const known = new Set(this.examples.map((ex) => ex.label + ':' + ex.date));
    let added = 0;
    for (const item of data.examples) {
      if (known.has(item.label + ':' + item.date)) continue;
      const ex = {
        label: item.label,
        date: item.date,
        source: item.source,
        frameSize: item.frameSize,
        spec: fromBase64(item.spec, Float32Array),
        audio: item.audio ? fromBase64(item.audio, Int16Array) : undefined,
        sr: item.sr,
      };
      ex.uid = this.addToDataset(ex);
      await this.save(ex);
      added++;
    }
    return added;
  }
}

// ---------- детский микрофон ----------

// Слушает так же, как speech-commands (те же кадры и частоты), но сам: держит последние
// секунды звука и по команде отдаёт фрагмент «пока был зажат пробел» и немного до него.
// Звук хранится только в памяти, пока не решено, что это пример для обучения.
const PRE_SEC = 2;      // сколько секунд «до нажатия» помнить (пойдёт в фон)
const MAX_HOLD_SEC = 8;

export class ChildMic {
  constructor() {
    this.running = false;
    this.frames = [];
    this.holdAt = null;   // номер кадра, с которого зажали пробел
    this.total = 0;       // сколько кадров снято всего
    this.onFrame = null;  // (кадр, громкость) — для «слушать малыша без кнопки»
  }

  async start(sampleRate = 44100) {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.ctx = new AudioContext({ sampleRate });
    this.sampleRate = this.ctx.sampleRate;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE * 2;
    this.analyser.smoothingTimeConstant = 0;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.frameMs = (FFT_SIZE / this.sampleRate) * 1000;
    this.keep = Math.ceil((PRE_SEC * 1000) / this.frameMs);
    this.maxHold = Math.ceil((MAX_HOLD_SEC * 1000) / this.frameMs);
    this.freq = new Float32Array(FFT_SIZE);
    this.timer = setInterval(() => this.tick(), this.frameMs);
    this.running = true;
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.timer);
    this.stream.getTracks().forEach((t) => t.stop());
    this.ctx.close();
    this.running = false;
    this.frames = [];
    this.holdAt = null;
  }

  tick() {
    this.analyser.getFloatFrequencyData(this.freq);
    if (this.freq[0] === -Infinity) return;
    const t = new Float32Array(FFT_SIZE);
    this.analyser.getFloatTimeDomainData(t);
    const frame = { f: this.freq.slice(0, COLUMNS), t };
    this.frames.push(frame);
    this.total++;
    if (this.onFrame) {
      let sum = 0;
      for (let i = 0; i < t.length; i++) sum += t[i] * t[i];
      this.onFrame(frame, Math.sqrt(sum / t.length));
    }
    const limit = this.holdAt == null ? this.keep : this.keep + this.maxHold;
    if (this.frames.length > limit) this.frames.shift();
  }

  beginHold() {
    this.holdAt = this.total;
  }

  // { before: кадры до нажатия, held: кадры, пока держали, loudness: громкость в held }
  endHold() {
    if (this.holdAt == null) return null;
    const firstIndex = this.total - this.frames.length;
    const split = Math.max(0, this.holdAt - firstIndex);
    const before = this.frames.slice(0, split);
    const held = this.frames.slice(split);
    this.holdAt = null;
    this.frames = this.frames.slice(-this.keep);
    let loud = 0;
    for (const fr of held) for (let i = 0; i < fr.t.length; i++) loud = Math.max(loud, Math.abs(fr.t[i]));
    return { before, held, loudness: loud };
  }
}

export { MIN_LOUDNESS };
