// Интерфейс для взрослого: панель «Учим голос малыша» и подтверждение ✓/✗ после срабатывания.

import { ANIMALS } from './animals.js';
import { NOISE, NOISE_SEC, labelName } from './speech-child.js';

const $ = (id) => document.getElementById(id);
const LABELS = [...ANIMALS.map((a) => a.id), NOISE];
const RECOMMENDED = { [NOISE]: 4 };   // фон пишется по 5 с, это ~20 коротких примеров
const RECOMMENDED_WORD = 8;
const OLD_DAYS = 60;
const CONFIRM_MS = 10000;

const formatDate = (t) =>
  new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function initChildPanel(panel, { child, playSamples, onOpen, onClose, onTrained }) {
  const rows = $('child-rows');
  const status = $('child-panel-status');
  const trainBtn = $('child-train');
  const oldBtn = $('child-old');
  const progress = $('child-progress');
  const fileInput = $('child-import-file');
  let busy = false;
  let oldConfirm = null;

  function setStatus(text) {
    status.textContent = text;
  }

  function summary() {
    if (child.trained) {
      const fresh = child.newSinceTrain();
      return `Модель обучена ${formatDate(child.trainedAt)}.` +
        (fresh ? ` Новых записей с тех пор: ${fresh}, можно обучить ещё раз.` : '');
    }
    return 'Модель ещё не обучена. Нужно хотя бы 3 записи одного зверя и 1 запись фона.';
  }

  function render() {
    const counts = child.ready ? child.counts() : {};
    rows.replaceChildren(...LABELS.map((label) => row(label, counts[label] || 0)));
    trainBtn.disabled = busy || !child.ready || !child.canTrain();
    const old = child.ready ? child.oldExamples(OLD_DAYS).length : 0;
    oldBtn.hidden = old === 0;
    oldBtn.textContent = `Удалить записи старше 2 месяцев (${old})`;
    for (const b of panel.querySelectorAll('.buttons button:not(#child-close)')) {
      if (b !== trainBtn) b.disabled = busy || !child.ready;
    }
  }

  function row(label, count) {
    const need = RECOMMENDED[label] ?? RECOMMENDED_WORD;
    const el = document.createElement('div');
    el.className = 'child-row' + (label === NOISE ? ' noise' : '');
    el.innerHTML = `
      <span class="name"></span>
      <span class="count${count >= need ? ' ok' : ''}">${count} из ${need}</span>
      <button type="button" class="rec">● Записать${label === NOISE ? ` ${NOISE_SEC} с` : ''}</button>
      <button type="button" class="play" title="Прослушать последнюю запись">▶</button>
      <button type="button" class="del" title="Удалить последнюю запись">✕</button>`;
    el.querySelector('.name').textContent = labelName(label);
    const last = child.ready ? child.lastOf(label) : null;
    const lastAudio = child.ready ? [...child.examples].reverse().find((ex) => ex.label === label && ex.audio) : null;
    el.querySelector('.rec').disabled = busy || !child.ready;
    el.querySelector('.play').disabled = busy || !lastAudio;
    el.querySelector('.del').disabled = busy || !last;

    el.querySelector('.rec').addEventListener('click', () => record(label));
    el.querySelector('.play').addEventListener('click', () => playSamples(lastAudio.audio, lastAudio.sr));
    el.querySelector('.del').addEventListener('click', async () => {
      await child.remove(last);
      setStatus(`Последняя запись «${labelName(label)}» удалена.`);
      render();
    });
    return el;
  }

  async function record(label) {
    busy = true;
    render();
    const btn = rows.children[LABELS.indexOf(label)].querySelector('.rec');
    btn.classList.add('recording');
    btn.textContent = label === NOISE ? 'Пишу фон…' : 'Говорите!';
    setStatus(label === NOISE
      ? 'Пишу 5 секунд того, что вокруг: тишину, шум квартиры, лепет, голоса взрослых.'
      : `Пусть малыш скажет своё слово для «${labelName(label)}». Запись 2 секунды.`);
    try {
      const ex = await child.record(label);
      setStatus(ex ? `Записано: ${labelName(label)}.` : 'Было слишком тихо, запись не сохранена. Попробуйте ещё раз ближе к Маку.');
    } catch (err) {
      setStatus('Не получилось записать: ' + err.message);
    }
    busy = false;
    render();
  }

  trainBtn.addEventListener('click', async () => {
    busy = true;
    render();
    progress.hidden = false;
    const bar = progress.firstElementChild;
    bar.style.width = '0%';
    setStatus('Обучаю модель… Обычно это несколько секунд.');
    try {
      await child.train((p) => { bar.style.width = Math.round(p * 100) + '%'; });
      setStatus('Готово! Модель обучена и сохранена на этом Маке.');
      onTrained();
    } catch (err) {
      console.warn('Обучение не удалось:', err);
      setStatus('Не получилось обучить. Попробуйте нажать «Обучить» ещё раз.');
    }
    progress.hidden = true;
    busy = false;
    render();
  });

  $('child-export').addEventListener('click', () => {
    const blob = new Blob([child.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zverushki-golos-malysha-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('Копия записей сохранена в «Загрузки». Храните её на случай очистки браузера.');
  });

  $('child-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const added = await child.importJson(await file.text());
      setStatus(`Добавлено записей: ${added}. Нажмите «Обучить», чтобы модель их выучила.`);
    } catch (err) {
      setStatus('Не получилось загрузить файл: ' + err.message);
    }
    render();
  });

  // Удаление старых записей — в два нажатия, чтобы не стереть случайно.
  oldBtn.addEventListener('click', async () => {
    const old = child.oldExamples(OLD_DAYS);
    if (!oldConfirm) {
      oldBtn.textContent = `Нажмите ещё раз, чтобы удалить ${old.length}`;
      oldConfirm = setTimeout(() => { oldConfirm = null; render(); }, 4000);
      return;
    }
    clearTimeout(oldConfirm);
    oldConfirm = null;
    for (const ex of old) await child.remove(ex);
    setStatus(`Удалено старых записей: ${old.length}. Обучите модель заново.`);
    render();
  });

  $('child-close').addEventListener('click', () => close());

  async function open() {
    panel.hidden = false;
    onOpen();
    render();
    if (!child.ready) {
      setStatus('Загружаю модель… В первый раз нужен интернет.');
      try {
        await child.init();
      } catch (err) {
        setStatus('Не получилось загрузить модель. Проверьте интернет и откройте панель ещё раз.');
        return;
      }
    }
    setStatus(summary());
    render();
  }

  function close() {
    if (busy) return;
    panel.hidden = true;
    onClose();
  }

  return { open, isOpen: () => !panel.hidden };
}

// Подсказка над кнопками: что сейчас происходит с голосом малыша.
// Видна родителю: «Слушаю…», «Малыш сказал: Котик?», «Кого назвал малыш?», «Учусь… 40%».
export function initKidBubble(box, { animalSvg, onTeach, onWrongGuess, pageCards = () => ANIMALS.map((_, i) => i) }) {
  const text = $('kid-text');
  const actions = $('kid-actions');
  const progress = $('kid-progress');
  const bar = progress.firstElementChild;
  let timer = null;

  function show(message, { buttons = [], keep = false, bar: withBar = false } = {}) {
    clearTimeout(timer);
    text.textContent = message;
    actions.replaceChildren(...buttons);
    progress.hidden = !withBar;
    box.hidden = false;
    if (!keep) timer = setTimeout(hide, buttons.length ? 15000 : 3500);
  }

  function hide() {
    clearTimeout(timer);
    box.hidden = true;
  }

  function button(label, onClick, className = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function animalButton(animal) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kid-animal';
    b.title = animal.name;
    b.style.setProperty('--c', animal.color);
    b.innerHTML = `<span class="kid-animal-pic">${animalSvg(animal.id)}</span><span class="kid-animal-name"></span>`;
    b.querySelector('.kid-animal-name').textContent = animal.name;
    b.addEventListener('click', () => onTeach(animal.id));
    return b;
  }

  return {
    hide,
    info: (message, opts) => show(message, opts),
    listening: () => show('Слушаю малыша… Отпустите, когда он скажет.', { keep: true }),
    guess(animal) {
      show(`Малыш сказал «${animal.name}»?`, {
        buttons: [
          button('✓ Да', () => onTeach(animal.id), 'yes'),
          button('✗ Нет', () => onWrongGuess()),
        ],
      });
    },
    // Кого назвал малыш? Если есть похожие — сначала они («Мама · Машина»), остальные по кнопке.
    choose(similar = [], title) {
      // Сначала карточки открытой страницы, остальные — по кнопке «С другой страницы…».
      const list = (indices, extra) => show('Кого назвал малыш? Нажмите на зверька — я запомню.', {
        buttons: [
          ...indices.map((i) => animalButton(ANIMALS[i])),
          ...extra,
          button('Ничего / шум', () => onTeach(NOISE), 'noise'),
          button('Не сохранять', hide, 'skip'),
        ],
      });
      const here = pageCards();
      const other = ANIMALS.map((_, i) => i).filter((i) => !here.includes(i));
      const all = () => list(here, other.length ? [button('С другой страницы…', () => list(other, []))] : []);
      const near = similar.map((id) => ANIMALS.find((a) => a.id === id)).filter(Boolean);
      if (!near.length) return all();
      show(title || 'Похоже на… Кого назвал малыш?', {
        buttons: [
          ...near.map((a) => {
            const b = animalButton(a);
            b.classList.add('near');
            return b;
          }),
          button('Другой…', all),
          button('Ничего / шум', () => onTeach(NOISE), 'noise'),
          button('Не сохранять', hide, 'skip'),
        ],
      });
    },
    training(p) {
      show(`Учусь понимать малыша… ${Math.round(p * 100)}%`, { keep: true, bar: true });
      bar.style.width = Math.round(p * 100) + '%';
    },
  };
}
