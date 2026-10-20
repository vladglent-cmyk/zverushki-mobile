// Звуки: записи из assets/sounds (слово, потом голос зверя), если их нет — голос браузера (ru-RU).
// Всегда тихо, с плавным нарастанием, без наложения: новый звук перезапускает старый.
// Скачанные записи разные по громкости и с тишиной по краям, поэтому при загрузке
// они обрезаются, выравниваются по громкости и укорачиваются.

const FADE_IN = 0.15;      // с
const FADE_OUT = 0.08;     // с
const CLIP_GAP = 0.3;      // пауза между словом и голосом зверя, с
const MAX_CLIP_SEC = 3;    // длиннее не звучит: спокойно и коротко
const TARGET_RMS = 0.12;   // выравниваем по средней громкости: лай не громче «мяу»
const TARGET_PEAK = 0.8;
const EDGE_FADE = 0.03;    // плавные края у обрезанной записи, с

let ctx = null;
let volume = 0.45;
let current = null;     // { sources, gain }
let speakTimer = null;
let playing = false;    // звучит ли сейчас зверёк (микрофон в это время не слушаем)
let endedAt = 0;
let playId = 0;         // отменённая фраза не должна «закончить» новую
let ruVoice = null;
const clips = new Map(); // id зверя → [AudioBuffer]

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
}

// Вызывать по первому действию пользователя (политика автозапуска звука).
export async function unlock() {
  if (!ctx) ctx = new AudioContext();
  // iPhone разрешает голос устройства только после касания: «будим» его пустой фразой.
  if ('speechSynthesis' in window && !unlock.spoken) {
    unlock.spoken = true;
    try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch {}
  }
  if (ctx.state === 'suspended') await ctx.resume();
}

// На телефоне звуки не грузятся все сразу (это десятки мегабайт): только по мере надобности.
// preload лишь готовит голос браузера; записи зверя загружаются при первом показе
// (и заранее — для карточек открытой страницы, см. prefetch).
export async function preload() {
  if (!ctx) ctx = new AudioContext();
  pickVoice();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = pickVoice;
}

const loading = new Map();   // id зверя → Promise

function ensureClips(animal) {
  if (clips.has(animal.id) || !animal.clips?.length) return Promise.resolve();
  if (!loading.has(animal.id)) {
    if (!ctx) ctx = new AudioContext();
    loading.set(animal.id, (async () => {
      // Элемент clips — путь или список путей: из списка при каждом показе звучит случайная запись.
      const loaded = await Promise.all(animal.clips.map(async (entry) => {
        const options = (await Promise.all([].concat(entry).map(loadClip))).filter(Boolean);
        return options.length ? options : null;
      }));
      if (loaded.some(Boolean)) clips.set(animal.id, loaded);
    })());
  }
  return loading.get(animal.id);
}

// Заранее подгрузить звуки карточек открытой страницы — тихо, по одной.
export async function prefetch(animals) {
  for (const a of animals) {
    try { await ensureClips(a); } catch {}
  }
}

async function loadClip(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return tidy(await ctx.decodeAudioData(await res.arrayBuffer()));
  } catch {
    return null; // нет файла или он не читается
  }
}

// Моно, без тишины по краям, не длиннее MAX_CLIP_SEC, пик на одном уровне.
function tidy(buf) {
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mono[i]));
  if (peak < 1e-4) return null;

  const threshold = peak * 0.06;
  let first = 0;
  let last = n - 1;
  while (first < n && Math.abs(mono[first]) < threshold) first++;
  while (last > first && Math.abs(mono[last]) < threshold) last--;
  const rate = buf.sampleRate;
  const start = Math.max(0, first - Math.round(0.04 * rate));
  const end = Math.min(n, last + Math.round(0.12 * rate), start + Math.round(MAX_CLIP_SEC * rate));

  // Громкость считаем по тому кусочку, который реально прозвучит (у длинных записей
  // самое громкое место бывает дальше 3 секунд).
  let sum = 0;
  let segPeak = 0;
  for (let i = start; i < end; i++) {
    sum += mono[i] * mono[i];
    segPeak = Math.max(segPeak, Math.abs(mono[i]));
  }
  const rms = Math.sqrt(sum / Math.max(1, end - start));
  const out = ctx.createBuffer(1, end - start, rate);
  const data = out.getChannelData(0);
  const gain = Math.min(TARGET_RMS / Math.max(rms, 1e-4), TARGET_PEAK / Math.max(segPeak, 1e-4));
  const edge = Math.round(EDGE_FADE * rate);
  for (let i = 0; i < data.length; i++) {
    const fade = Math.min(1, i / edge, (data.length - 1 - i) / edge);
    data[i] = mono[start + i] * gain * fade;
  }
  return out;
}

export function stop() {
  clearTimeout(speakTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (current && ctx) {
    const { sources, gain } = current;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FADE_OUT);
    for (const src of sources) {
      try { src.stop(t + FADE_OUT + 0.02); } catch {}
    }
  }
  current = null;
  markEnded();
}

// true, когда зверёк молчит уже ms: чтобы микрофон не узнал зверя в его же голосе.
export function isQuiet(ms) {
  return !playing && performance.now() - endedAt > ms;
}

function markEnded() {
  if (playing) endedAt = performance.now();
  playing = false;
}

export async function play(animal) {
  stop();
  playing = true;
  const id = ++playId;
  // Подстраховка: Chrome/Safari иногда не сообщают о конце фразы.
  setTimeout(() => { if (id === playId) markEnded(); }, 8000);
  if (!animal.macVoice) await ensureClips(animal);
  if (id !== playId) return;   // пока грузилось, уже попросили другой звук
  // macVoice — карточка всегда говорит голосом устройства (так попросили для петушка).
  const list = animal.macVoice ? null : clips.get(animal.id)?.filter(Boolean).map(pickOne);
  if (list?.length && ctx) playBuffers(list);
  else speak(animal.say);
}

// Только слово («корова») — для вопроса «Где…?». Если записи слова нет, имя скажет браузер.
export async function playWord(animal) {
  stop();
  playing = true;
  const id = ++playId;
  setTimeout(() => { if (id === playId) markEnded(); }, 5000);
  await ensureClips(animal);
  if (id !== playId) return;
  const first = clips.get(animal.id)?.[0];
  if (first && ctx && isWord(animal.clips[0])) playBuffers([pickOne(first)]);
  else speak(animal.name);
}

const pickOne = (options) => options[Math.floor(Math.random() * options.length)];
const isWord = (entry) => Boolean(entry) && !/-sound\./.test([].concat(entry)[0]);

// Есть ли у карточки запись слова (без загрузки самого звука).
export const hasWord = (animal) => isWord(animal.clips?.[0]);

// Проиграть запись (Int16) — для «прослушать» в обучении голоса малыша.
export async function playSamples(samples, sampleRate) {
  await unlock();
  stop();
  playing = true;
  playId++;
  const buf = ctx.createBuffer(1, samples.length, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
  playBuffers([buf]);
}

function playBuffers(list) {
  const t0 = ctx.currentTime + 0.02;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + FADE_IN);
  gain.connect(ctx.destination);

  const sources = [];
  let t = t0;
  for (const buf of list) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(t);
    sources.push(src);
    t += buf.duration + CLIP_GAP;
  }
  const me = { sources, gain };
  current = me;
  sources[sources.length - 1].onended = () => {
    if (current === me) {
      current = null;
      markEnded();
    }
  };
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return markEnded();
  // Chrome иногда «глотает» фразу, сказанную сразу после cancel(), поэтому короткая пауза.
  const id = playId;
  speakTimer = setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (ruVoice) u.voice = ruVoice;
    u.volume = volume;
    u.rate = 0.85;
    u.pitch = 1.15;
    u.onend = u.onerror = () => { if (id === playId) markEnded(); };
    speechSynthesis.speak(u);
  }, 60);
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const ru = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ru'));
  // Локальные голоса macOS работают без интернета; Милена звучит мягче всех.
  ruVoice =
    ru.find((v) => /milena|милена/i.test(v.name)) ||
    ru.find((v) => v.localService) ||
    ru[0] ||
    null;
}
