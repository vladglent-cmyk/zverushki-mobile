// Сетка зверей и большой показ одного зверька.
// В любой момент двигается не больше одного объекта.

import { ANIMALS, CATEGORIES, PAGES } from './animals.js';
// Мобильная версия: раскладка страниц под телефон (см. buildPages).

const GROW_MS = 900;
const SHRINK_MS = 800;
const FADE_MS = 550;
const ACT_MS = 2800;
const MAX_VIDEO_MS = 9000;   // видео — один короткий спокойный фрагмент, потом стоп-кадр
const RETURN_MS = 1500;      // всё отыграло — пауза, и зверёк возвращается в сетку
const SLIDE_MS = 3200;       // слайдшоу мамы и папы: одно фото — ~3 с, мягкая смена

const svgCache = new Map();

export async function loadImages() {
  await Promise.all(ANIMALS.filter((a) => a.image).map(async (a) => {
    const res = await fetch(a.image);
    svgCache.set(a.id, await res.text());
  }));
}

// Картинка зверя (SVG) или первое фото — для плиток и маленьких кнопок.
export function animalSvg(id) {
  const animal = ANIMALS.find((a) => a.id === id);
  if (animal?.photos) return `<img src="${animal.photos[0]}" alt="">`;
  return svgCache.get(id) || '';
}

export function tileHtml(animal) {
  const pic = animal.photos
    ? `<div class="tile-animal tile-photo" data-anim="slides"><img class="on" src="${animal.photos[0]}" alt=""></div>`
    : `<div class="tile-animal" data-anim="${animal.animation}">${svgCache.get(animal.id) || ''}</div>`;
  return `
    <div class="tile-pic">
      <div class="tile-circle"></div>
      ${pic}
    </div>
    <div class="tile-name">${animal.name}</div>`;
}

const isCalm = () => document.body.classList.contains('calm');

export class Scene {
  constructor({ grid, stage, stageTile, back, kruzhok, videos, videoEnabled, autoReturn, isQuiet, onShow, onHide }) {
    this.onPick = null;     // режимы (например «Где котик?») могут перехватить нажатие на плитку
    this.onPage = null;     // перелистнули страницу
    this.onCard = null;     // карточку показали (для подсчёта любимых)
    this.onClosed = null;   // зверёк вернулся в сетку

    this.grid = grid;
    this.stage = stage;
    this.stageTile = stageTile;
    this.kruzhok = kruzhok;
    this.card = kruzhok.parentElement;   // .stage-card: класс real — видео большое, рисунок в уголке
    this.video = kruzhok.querySelector('video');
    this.videos = videos || {};
    this.videoEnabled = videoEnabled;
    this.videoToken = 0;
    this.videoTimer = null;
    this.autoReturn = autoReturn;
    this.isQuiet = isQuiet;
    this.returnTimer = null;
    this.onShow = onShow;
    this.onHide = onHide;
    this.index = -1;
    this.open = false;
    this.busy = false;
    this.actTimer = null;
    this.tiles = [];

    this.renderGrid();

    stage.addEventListener('click', (e) => {
      if (e.target.closest('.kruzhok')) this.playVideo();
      else if (e.target.closest('.stage-card')) this.replay();
      else this.close();
    });
    back.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  // Под телефон: в портрете 3 карточки в ряд и до 4 рядов на странице, в горизонтальном
  // положении — 6 в ряд и 2 ряда. Категории идут в том же порядке, что на компьютере,
  // и не разрываются между страницами (кроме слишком больших). Листают свайпом.
  layout() {
    return innerWidth > innerHeight ? { cols: 6, rows: 2 } : { cols: 3, rows: 4 };
  }

  buildPages() {
    const { cols, rows } = this.layout();
    const pages = [];
    let cur = [];
    let rowsUsed = 0;
    for (const catId of PAGES.flat(2)) {
      const idx = ANIMALS.map((a, i) => (a.category === catId ? i : -1)).filter((i) => i >= 0);
      for (let k = 0; k < idx.length; k += cols * rows) {
        const items = idx.slice(k, k + cols * rows);
        const need = Math.ceil(items.length / cols);
        if (rowsUsed + need > rows && cur.length) {
          pages.push(cur);
          cur = [];
          rowsUsed = 0;
        }
        cur.push({ catId, items });
        rowsUsed += need;
      }
    }
    if (cur.length) pages.push(cur);
    return { cols, rows, pages };
  }

  renderGrid() {
    const keep = this.pages?.[this.page]?.order?.[0];
    const { cols, rows, pages } = this.buildPages();
    this.cols = cols;
    const inner = document.createElement('div');
    inner.className = 'grid-inner';
    this.pages = pages.map((groups) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'page';
      const order = [];
      for (const { catId, items } of groups) {
        const cat = CATEGORIES.find((c) => c.id === catId);
        const group = document.createElement('section');
        group.className = 'cat-group';
        group.dataset.cat = catId;
        group.innerHTML = '<div class="cat-label"></div><div class="cat-tiles"></div>';
        group.querySelector('.cat-label').textContent = cat.name;
        const tilesEl = group.querySelector('.cat-tiles');
        for (const i of items) {
          tilesEl.append(this.makeTile(ANIMALS[i], i));
          order.push(i);
        }
        pageEl.append(group);
      }
      const usedRows = groups.reduce((n, g) => n + Math.ceil(g.items.length / cols), 0);
      pageEl.style.setProperty('--cols', cols);
      pageEl.style.setProperty('--rows', Math.max(usedRows, rows));
      pageEl.style.setProperty('--groups', groups.length);
      inner.append(pageEl);
      return { el: pageEl, order };
    });

    // Точки страниц сверху: видно, где мы, и можно нажать.
    const dots = document.createElement('nav');
    dots.className = 'page-dots';
    this.dots = this.pages.map((_, k) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'page-dot';
      d.setAttribute('aria-label', `Страница ${k + 1}`);
      d.addEventListener('click', () => this.setPage(k, k > this.page ? 1 : -1));
      dots.append(d);
      return d;
    });
    this.arrows = [];
    this.grid.replaceChildren(dots, inner);
    const p = keep != null ? this.pageOf(keep) : -1;
    this.page = Math.max(0, Math.min(p >= 0 ? p : this.page || 0, this.pages.length - 1));
    this.applyPage();
    if (this.progress) this.setProgress(this.progress);
    this.bindSwipe();
  }

  // Свайп влево-вправо листает страницы; нажатие после свайпа не открывает карточку.
  bindSwipe() {
    if (this.swipeBound) return;
    this.swipeBound = true;
    let x0 = null;
    let y0 = 0;
    this.grid.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; this.swiped = false; });
    this.grid.addEventListener('pointermove', (e) => {
      if (x0 != null && Math.abs(e.clientX - x0) > 14) this.swiped = true;
    });
    this.grid.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.setPage(this.page + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    this.grid.addEventListener('click', (e) => {
      if (!this.swiped) return;
      this.swiped = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
    // Повернули телефон — раскладка меняется (3 или 6 в ряд).
    let t = null;
    addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (this.layout().cols !== this.cols && !this.open) this.renderGrid();
      }, 300);
    });
  }

  makeTile(animal, i) {
    const btn = document.createElement('button');
    btn.className = 'tile-btn';
    btn.setAttribute('aria-label', animal.name);
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.id = animal.id;
    tile.style.setProperty('--c', animal.color);
    tile.innerHTML = '<div class="tile-ring"></div>' + tileHtml(animal);
    btn.append(tile);
    btn.addEventListener('click', () => {
      if (this.onPick?.(i)) return;
      this.show(i);
    });
    this.tiles[i] = tile;
    return btn;
  }

  pageOf(i) {
    return this.pages.findIndex((p) => p.order.includes(i));
  }

  applyPage() {
    this.pages.forEach((p, k) => p.el.classList.toggle('on', k === this.page));
    this.dots?.forEach((d, k) => d.classList.toggle('on', k === this.page));
  }

  // Перелистнуть страницу: карточки мягко уезжают в сторону и появляются новые.
  setPage(k, dir = 1, animate = true) {
    if (k < 0 || k >= this.pages.length || k === this.page) return;
    this.page = k;
    this.applyPage();
    if (animate && !isCalm()) {
      this.pages[k].el.animate(
        [{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 600, easing: 'ease-in-out' },
      );
    }
    this.onPage?.(k);
  }

  // Порядок карточек открытой страницы (для пробела и стрелок).
  visible() {
    return this.pages[this.page].order;
  }

  // Насколько выучен голос малыша для каждого зверя: 0…1 → зелёная полоска по кругу.
  setProgress(values) {
    this.progress = values;
    this.tiles.forEach((t, i) => t?.style.setProperty('--p', Math.min(1, values[i] || 0)));
  }

  fill(i) {
    const animal = ANIMALS[i];
    this.stageTile.style.setProperty('--c', animal.color);
    this.stageTile.innerHTML = tileHtml(animal);
    this.tiles.forEach((t, k) => t.classList.toggle('lifted', k === i));
    this.index = i;
  }

  // Показ из сетки: карточка плавно вырастает на весь экран.
  async show(i) {
    if (this.busy || this.open) return;
    this.onCard?.(i);
    this.busy = true;
    this.open = true;
    this.fill(i);
    this.stage.classList.add('visible');
    this.grid.classList.remove('visible');

    const from = this.tiles[i].getBoundingClientRect();
    const keyframes = isCalm()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: flipTransform(from, this.stageTile.getBoundingClientRect()) },
         { transform: 'none' }];
    await this.stageTile.animate(keyframes, { duration: GROW_MS, easing: 'ease-in-out' }).finished;

    this.busy = false;
    this.act();
  }

  async close() {
    if (this.busy || !this.open) return;
    this.busy = true;
    this.onHide?.();
    this.stopAct();
    this.hideVideo();

    const tile = this.tiles[this.index];
    this.grid.classList.add('visible');
    const keyframes = isCalm()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'none' },
         { transform: flipTransform(tile.getBoundingClientRect(), this.stageTile.getBoundingClientRect()) }];
    const anim = this.stageTile.animate(keyframes, { duration: SHRINK_MS, easing: 'ease-in-out', fill: 'forwards' });
    await anim.finished;

    tile.classList.remove('lifted');
    this.stage.classList.remove('visible');
    anim.cancel();
    this.open = false;
    this.busy = false;
    this.onClosed?.();
  }

  // Следующий зверёк по кругу (для «любой клавиши»).
  // Следующий и предыдущий — в том порядке, как карточки стоят на экране.
  next() {
    return this.step(1);
  }

  prev() {
    return this.step(-1);
  }

  step(dir) {
    const list = this.visible();
    const pos = list.indexOf(this.index);
    const k = pos < 0 ? (dir > 0 ? 0 : list.length - 1) : (pos + dir + list.length) % list.length;
    return this.goTo(list[k]);
  }

  // Показать конкретного зверька откуда угодно (клавиша, голос).
  goTo(i) {
    // Карточка с другой страницы (позвали голосом) — сначала тихо открываем её страницу.
    const p = this.pageOf(i);
    if (p >= 0 && p !== this.page) this.setPage(p, p > this.page ? 1 : -1, false);
    if (!this.open) return this.show(i);
    if (i === this.index) return this.replay();
    return this.switchTo(i);
  }

  // Крупный зверёк уже на экране: мягкая смена одного на другого.
  async switchTo(i) {
    if (this.busy) return;
    this.onCard?.(i);
    this.busy = true;
    this.onHide?.();
    this.stopAct();
    this.hideVideo();
    const fade = { duration: FADE_MS, easing: 'ease-in-out', fill: 'forwards' };
    const out = this.stageTile.animate([{ opacity: 1 }, { opacity: 0 }], fade);
    await out.finished;
    this.fill(i);
    const inn = this.stageTile.animate([{ opacity: 0 }, { opacity: 1 }], fade);
    await inn.finished;
    out.cancel();
    inn.cancel();
    this.busy = false;
    this.act();
  }

  // Повторный клик по зверьку: звук перезапускается, анимация не дёргается.
  replay() {
    if (this.busy || !this.open) return;
    this.onCard?.(this.index);
    this.cancelReturn();
    if (this.actTimer) return this.onShow?.(ANIMALS[this.index]);
    this.act();
  }

  act() {
    const animal = ANIMALS[this.index];
    const el = this.stageTile.querySelector('.tile-animal');
    el.classList.add('act');
    this.onShow?.(animal);
    clearTimeout(this.actTimer);
    if (animal.photos) return this.slideshow(el, animal.photos);
    // Настоящий зверь сразу крупно (видео), рисунок уезжает маленьким кружком вниз направо
    // и двигается там под звук. Если видео нет — рисунок остаётся большим, как раньше.
    const withVideo = this.playVideo();
    this.actTimer = setTimeout(() => {
      el.classList.remove('act');
      this.actTimer = null;
      if (!withVideo) this.scheduleReturn();
    }, ACT_MS);
  }

  // Мама и папа: фото медленно сменяют друг друга, после последнего — возврат к сетке.
  slideshow(el, photos) {
    el.innerHTML = photos.map((src, k) => `<img src="${src}" alt=""${k === 0 ? ' class="on"' : ''}>`).join('');
    let k = 0;
    const step = () => {
      k++;
      if (k >= photos.length) {
        this.actTimer = null;
        this.scheduleReturn();
        return;
      }
      [...el.children].forEach((img, j) => img.classList.toggle('on', j === k));
      this.actTimer = setTimeout(step, SLIDE_MS);
    };
    this.actTimer = setTimeout(step, SLIDE_MS);
  }

  // Настоящий зверь: видео в большом круге, один раз, без звука (звук — у рисунка).
  playVideo() {
    const clip = this.videos[ANIMALS[this.index]?.id];
    if (!this.open || !clip || !this.videoEnabled()) return false;
    this.cancelReturn();
    const token = ++this.videoToken;
    const video = this.video;
    clearTimeout(this.videoTimer);
    if (video.dataset.src !== clip.file) {
      video.src = clip.file;
      video.dataset.src = clip.file;
    }
    const begin = () => {
      if (token !== this.videoToken) return;
      video.currentTime = clip.start || 0;
      video.play().catch(() => {});
      if (this.kruzhok.hidden) {
        this.kruzhok.hidden = false;
        requestAnimationFrame(() => this.kruzhok.classList.add('shown'));
      }
      this.card.classList.add('real');
      this.videoTimer = setTimeout(finish, MAX_VIDEO_MS);
    };
    const finish = () => {
      if (token !== this.videoToken) return;
      clearTimeout(this.videoTimer);
      video.pause();
      this.scheduleReturn();
    };
    video.ontimeupdate = () => {
      if (clip.end && video.currentTime >= clip.end && !video.paused) finish();
    };
    video.onended = finish;
    video.onerror = () => {   // видео не загрузилось — рисунок обратно крупно
      if (token !== this.videoToken) return;
      this.card.classList.remove('real');
      this.scheduleReturn();
    };
    if (video.readyState >= 1) begin();
    else video.addEventListener('loadedmetadata', begin, { once: true });
    return true;
  }

  // Всё отыграло: зверёк сам возвращается на место, и снова видно всех — кого назвать дальше.
  scheduleReturn() {
    this.cancelReturn();
    if (!this.autoReturn()) return;
    const tryReturn = () => {
      if (!this.open) return;
      if (this.busy || !this.isQuiet(300)) {
        this.returnTimer = setTimeout(tryReturn, 500);
        return;
      }
      this.close();
    };
    this.returnTimer = setTimeout(tryReturn, RETURN_MS);
  }

  cancelReturn() {
    clearTimeout(this.returnTimer);
    this.returnTimer = null;
  }

  hideVideo() {
    this.videoToken++;
    clearTimeout(this.videoTimer);
    this.video.pause();
    this.kruzhok.classList.remove('shown');
    this.kruzhok.hidden = true;
    this.card.classList.remove('real');
  }

  stopAct() {
    clearTimeout(this.actTimer);
    this.actTimer = null;
    this.cancelReturn();
  }
}

function flipTransform(from, to) {
  const s = from.width / to.width;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${s})`;
}
