// Скрытые настройки родителя. Вход: удерживать шестерёнку 3 секунды.

const KEY = 'zverushki.settings';
const HOLD_MS = 3000;

export const DEFAULTS = {
  volume: 0.45,
  calm: false,
  showHeard: false,
  video: true,
  autoReturn: true,
  showRings: true,
  idleShow: true,
  idleSec: 5,          // через сколько секунд без нажатий карточки показываются сами
  page: 0,
  childThreshold: 0.8,
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function initGear(gear, onOpen) {
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    gear.classList.remove('holding');
  };
  gear.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gear.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      onOpen();
    }, HOLD_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => gear.addEventListener(ev, cancel));
}

export function initPanel(panel, settings, { onChange, onTest, onFullscreen }) {
  const volume = panel.querySelector('#set-volume');
  const volumeOut = panel.querySelector('#set-volume-out');
  const calm = panel.querySelector('#set-calm');
  const showHeard = panel.querySelector('#set-show-heard');
  const video = panel.querySelector('#set-video');
  const autoReturn = panel.querySelector('#set-auto-return');
  const showRings = panel.querySelector('#set-rings');
  const idleShow = panel.querySelector('#set-idle');
  const childThreshold = panel.querySelector('#set-child-threshold');
  const childThresholdOut = panel.querySelector('#set-child-threshold-out');

  const sync = () => {
    volume.value = settings.volume;
    volumeOut.textContent = Math.round(settings.volume * 100) + '%';
    calm.checked = settings.calm;
    showHeard.checked = settings.showHeard;
    video.checked = settings.video;
    autoReturn.checked = settings.autoReturn;
    showRings.checked = settings.showRings;
    idleShow.checked = settings.idleShow;
    childThreshold.value = settings.childThreshold;
    childThresholdOut.textContent = Math.round(settings.childThreshold * 100) + '%';
  };

  volume.addEventListener('input', () => {
    settings.volume = Number(volume.value);
    sync();
    saveSettings(settings);
    onChange(settings);
  });
  calm.addEventListener('change', () => {
    settings.calm = calm.checked;
    saveSettings(settings);
    onChange(settings);
  });
  idleShow.addEventListener('change', () => {
    settings.idleShow = idleShow.checked;
    saveSettings(settings);
    onChange(settings);
  });
  showRings.addEventListener('change', () => {
    settings.showRings = showRings.checked;
    saveSettings(settings);
    onChange(settings);
  });
  autoReturn.addEventListener('change', () => {
    settings.autoReturn = autoReturn.checked;
    saveSettings(settings);
    onChange(settings);
  });
  video.addEventListener('change', () => {
    settings.video = video.checked;
    saveSettings(settings);
    onChange(settings);
  });
  showHeard.addEventListener('change', () => {
    settings.showHeard = showHeard.checked;
    saveSettings(settings);
    onChange(settings);
  });
  childThreshold.addEventListener('input', () => {
    settings.childThreshold = Number(childThreshold.value);
    sync();
    saveSettings(settings);
    onChange(settings);
  });
  panel.querySelector('#set-test').addEventListener('click', onTest);
  panel.querySelector('#set-fullscreen').addEventListener('click', onFullscreen);
  panel.querySelector('#set-close').addEventListener('click', () => close());
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });

  function open() {
    sync();
    panel.hidden = false;
  }
  function close() {
    panel.hidden = true;
  }
  return { open, close, isOpen: () => !panel.hidden };
}
