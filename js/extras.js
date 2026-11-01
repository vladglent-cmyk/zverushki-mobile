// Дополнительные (развивающие) вставки после показа карточки. Каждая включается в настройках
// отдельно, по умолчанию все выключены. За одно открытие — одна вставка (случайная из включённых),
// чтобы не перегружать: настоящий зверь → рисунок → маленький урок → возврат к сетке.

const S = 'stroke="#6E5A50" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

// ---------- еда (маленькие картинки) ----------
const ICONS = {
  milk: `<svg viewBox="0 0 100 100"><g ${S}><path d="M40 14 H60 V26 L68 38 V84 Q68 90 62 90 H38 Q32 90 32 84 V38 L40 26 Z" fill="#FFFFFF"/><path d="M32 52 H68" fill="none"/><rect x="38" y="8" width="24" height="8" rx="3" fill="#9CC3E6"/></g><path d="M34 54 H66 V84 Q66 88 62 88 H38 Q34 88 34 84 Z" fill="#EAF3FB"/></svg>`,
  bone: `<svg viewBox="0 0 100 100"><g stroke="#6E5A50" stroke-width="12"><circle cx="24" cy="40" r="11"/><circle cx="24" cy="60" r="11"/><circle cx="76" cy="40" r="11"/><circle cx="76" cy="60" r="11"/><rect x="24" y="42" width="52" height="16"/></g><g fill="#FBF3E4"><circle cx="24" cy="40" r="11"/><circle cx="24" cy="60" r="11"/><circle cx="76" cy="40" r="11"/><circle cx="76" cy="60" r="11"/><rect x="24" y="42" width="52" height="16"/></g></svg>`,
  bamboo: `<svg viewBox="0 0 100 100"><g ${S}><rect x="40" y="10" width="18" height="82" rx="8" fill="#A9CC98"/><path d="M40 38 H58 M40 66 H58" fill="none"/><path d="M58 30 Q80 14 88 26 Q76 40 58 36 Z" fill="#BFDDAE"/><path d="M40 58 Q18 44 12 56 Q24 68 40 64 Z" fill="#BFDDAE"/></g></svg>`,
  leaf: `<svg viewBox="0 0 100 100"><g ${S}><path d="M18 80 Q16 26 82 18 Q84 80 18 80 Z" fill="#A9CC98"/><path d="M22 76 Q46 50 74 26" fill="none"/></g></svg>`,
  bread: `<svg viewBox="0 0 100 100"><g ${S}><path d="M14 62 Q14 30 50 30 Q86 30 86 62 V74 Q86 80 80 80 H20 Q14 80 14 74 Z" fill="#E8B878"/><path d="M34 42 L40 54 M50 40 L54 54 M64 42 L68 54" fill="none"/></g></svg>`,
  grass: `<svg viewBox="0 0 100 100"><g ${S} fill="#A9CC98"><path d="M14 88 Q20 50 12 26 Q30 50 32 88 Z"/><path d="M30 88 Q40 40 36 14 Q52 44 50 88 Z"/><path d="M48 88 Q60 46 64 20 Q70 52 68 88 Z"/><path d="M66 88 Q78 56 90 36 Q86 64 86 88 Z"/></g><path d="M8 88 H92" ${S}/></svg>`,
  grain: `<svg viewBox="0 0 100 100"><g ${S} fill="#F2C14E"><ellipse cx="30" cy="40" rx="9" ry="13" transform="rotate(-20 30 40)"/><ellipse cx="56" cy="30" rx="9" ry="13" transform="rotate(15 56 30)"/><ellipse cx="72" cy="58" rx="9" ry="13" transform="rotate(-10 72 58)"/><ellipse cx="42" cy="66" rx="9" ry="13" transform="rotate(25 42 66)"/><ellipse cx="22" cy="74" rx="8" ry="11" transform="rotate(-30 22 74)"/></g></svg>`,
  honey: `<svg viewBox="0 0 100 100"><g ${S}><path d="M24 40 Q22 88 50 88 Q78 88 76 40 Z" fill="#F2C14E"/><rect x="20" y="28" width="60" height="14" rx="6" fill="#D9A066"/><path d="M40 42 Q40 56 44 56 Q48 56 48 42" fill="#F2C14E"/></g><text x="50" y="76" text-anchor="middle" font-size="16" font-weight="700" fill="#8A5A2B" font-family="sans-serif">мёд</text></svg>`,
  nut: `<svg viewBox="0 0 100 100"><g ${S}><path d="M28 46 Q28 88 50 90 Q72 88 72 46 Z" fill="#D9A066"/><path d="M20 46 Q20 22 50 22 Q80 22 80 46 Z" fill="#9C6B45"/><path d="M50 22 Q50 12 58 8" fill="none"/></g></svg>`,
  fly: `<svg viewBox="0 0 100 100"><g ${S}><ellipse cx="34" cy="36" rx="18" ry="11" fill="#E4F1FA" transform="rotate(-25 34 36)"/><ellipse cx="66" cy="36" rx="18" ry="11" fill="#E4F1FA" transform="rotate(25 66 36)"/><ellipse cx="50" cy="58" rx="13" ry="18" fill="#5F575C"/></g><circle cx="45" cy="50" r="3" fill="#fff"/><circle cx="55" cy="50" r="3" fill="#fff"/></svg>`,
  meat: `<svg viewBox="0 0 100 100"><g ${S}><path d="M58 60 L80 82" stroke-width="12"/><path d="M58 60 L80 82" stroke="#FBF3E4" stroke-width="5"/><circle cx="82" cy="84" r="7" fill="#FBF3E4"/><path d="M20 46 Q18 18 44 16 Q72 16 68 46 Q64 66 44 68 Q22 68 20 46 Z" fill="#D9786B"/></g><ellipse cx="38" cy="36" rx="9" ry="6" fill="#EFA59B"/></svg>`,
};

// что ест: картинка (из ICONS или id карточки с рисунком) и фраза
const FOOD = {
  cat: ['milk', 'Котик пьёт молочко'],
  snoopy: ['bone', 'Снупи грызёт косточку'],
  dog: ['bone', 'Собачка грызёт косточку'],
  monkey: ['#banana', 'Обезьянка ест банан'],
  panda: ['bamboo', 'Панда ест бамбук'],
  turtle: ['leaf', 'Черепаха ест листики'],
  duck: ['bread', 'Уточка ест хлебушек'],
  cow: ['grass', 'Коровка ест травку'],
  chicken: ['grain', 'Курочка клюёт зёрнышки'],
  horse: ['#carrot', 'Лошадка ест морковку'],
  sheep: ['grass', 'Овечка ест травку'],
  pig: ['#apple', 'Свинка ест яблочко'],
  bear: ['honey', 'Мишка ест мёд'],
  giraffe: ['leaf', 'Жираф ест листики'],
  elephant: ['#watermelon', 'Слон ест арбуз'],
  whale: ['#fish', 'Кит ест маленьких рыбок'],
  butterfly: ['#flower', 'Бабочка пьёт сок цветочка'],
  bee: ['#flower', 'Пчёлка собирает мёд с цветочка'],
  snail: ['leaf', 'Улитка ест листик'],
  caterpillar: ['leaf', 'Гусеница ест листик'],
  ant: ['grain', 'Муравей несёт зёрнышко'],
  bunny: ['#carrot', 'Зайчик ест морковку'],
  hedgehog: ['#apple', 'Ёжик несёт яблочко'],
  squirrel: ['nut', 'Белка грызёт орешек'],
  frog: ['fly', 'Лягушка ловит мушку'],
  lion: ['meat', 'Лев ест мясо'],
  tiger: ['meat', 'Тигр ест мясо'],
  rooster: ['grain', 'Петушок клюёт зёрнышки'],
  parrot: ['grain', 'Попугай ест зёрнышки'],
  pigeon: ['grain', 'Голубь клюёт зёрнышки'],
  penguin: ['#fish', 'Пингвин ест рыбку'],
  dolphin: ['#fish', 'Дельфин ест рыбку'],
  seal: ['#fish', 'Тюлень ест рыбку'],
  polarbear: ['#fish', 'Белый мишка ест рыбку'],
  zebra: ['grass', 'Зебра ест травку'],
  hippo: ['grass', 'Бегемот ест травку'],
  camel: ['grass', 'Верблюд ест колючки и травку'],
  kangaroo: ['grass', 'Кенгуру ест травку'],
  goat: ['grass', 'Козочка ест травку'],
  donkey: ['grass', 'Ослик ест травку'],
  goose: ['grass', 'Гусь щиплет травку'],
  raccoon: ['#apple', 'Енот моет яблочко'],
  beaver: ['#tree', 'Бобёр грызёт деревце'],
  koala: ['leaf', 'Коала ест листики'],
};

// мама и малыш
const BABY = {
  cat: 'Кошка и котёнок', dog: 'Собака и щенок', cow: 'Корова и телёнок', chicken: 'Курочка и цыплёнок',
  horse: 'Лошадка и жеребёнок', sheep: 'Овечка и ягнёнок', pig: 'Свинка и поросёнок', duck: 'Уточка и утёнок',
  bear: 'Мишка и медвежонок', giraffe: 'Жираф и жирафёнок', elephant: 'Слон и слонёнок', whale: 'Кит и китёнок',
  turtle: 'Черепаха и черепашонок', bunny: 'Зайчик и зайчонок', hedgehog: 'Ёжик и ежонок', fox: 'Лиса и лисёнок',
  squirrel: 'Белка и бельчонок', owl: 'Сова и совёнок', frog: 'Лягушка и лягушонок', lion: 'Лев и львёнок',
  penguin: 'Пингвин и пингвинёнок', tiger: 'Тигр и тигрёнок', zebra: 'Зебра и зебрёнок', hippo: 'Бегемот и бегемотик',
  camel: 'Верблюд и верблюжонок', kangaroo: 'Кенгуру и кенгурёнок', goat: 'Коза и козлёнок', donkey: 'Ослик и ослёнок',
  goose: 'Гусь и гусёнок', raccoon: 'Енот и енотик', beaver: 'Бобёр и бобрёнок', seal: 'Тюлень и тюленёнок',
  polarbear: 'Белая медведица и медвежонок', dolphin: 'Дельфин и дельфинёнок', monkey: 'Обезьянка и малыш',
  panda: 'Панда и малыш', koala: 'Коала и малыш', rooster: 'Петушок и цыплёнок',
};

// где живёт: фон в круге и конец фразы
const HOME = {
  cat: 'home|живёт дома', dog: 'home|живёт дома', snoopy: 'home|живёт дома',
  cow: 'farm|живёт на ферме', chicken: 'farm|живёт на ферме', horse: 'farm|живёт на ферме', sheep: 'farm|живёт на ферме',
  pig: 'farm|живёт на ферме', goose: 'farm|живёт на ферме', goat: 'farm|живёт на ферме', donkey: 'farm|живёт на ферме',
  rooster: 'farm|живёт на ферме', duck: 'pond|живёт у пруда', frog: 'pond|живёт в пруду', fish: 'pond|живёт в речке',
  beaver: 'pond|живёт у речки', hippo: 'pond|живёт в речке', dragonfly: 'pond|летает над прудом',
  monkey: 'savanna|живёт в жарких странах', giraffe: 'savanna|живёт в жарких странах', elephant: 'savanna|живёт в жарких странах',
  lion: 'savanna|живёт в жарких странах', zebra: 'savanna|живёт в жарких странах', kangaroo: 'savanna|живёт в жарких странах',
  parrot: 'savanna|живёт в жарких странах', camel: 'desert|живёт в пустыне',
  panda: 'forest|живёт в лесу', bear: 'forest|живёт в лесу', tiger: 'forest|живёт в лесу', bunny: 'forest|живёт в лесу',
  hedgehog: 'forest|живёт в лесу', fox: 'forest|живёт в лесу', squirrel: 'forest|живёт в лесу', owl: 'forest|живёт в лесу',
  raccoon: 'forest|живёт в лесу', koala: 'forest|живёт на дереве', tree: 'forest|растёт в лесу',
  whale: 'sea|живёт в море', turtle: 'sea|живёт в море', dolphin: 'sea|живёт в море', octopus: 'sea|живёт в море',
  crab: 'sea|живёт в море', boat: 'sea|плывёт по морю',
  seal: 'ice|живёт там, где холодно', penguin: 'ice|живёт там, где холодно', polarbear: 'ice|живёт там, где холодно',
  butterfly: 'meadow|летает на полянке', ladybug: 'meadow|живёт на полянке', bee: 'meadow|летает на полянке',
  snail: 'meadow|живёт на полянке', caterpillar: 'meadow|живёт на полянке', ant: 'meadow|живёт на полянке',
  flower: 'meadow|растёт на полянке',
  car: 'road|едет по дороге', motorcycle: 'road|едет по дороге', bus: 'road|едет по дороге', bicycle: 'road|едет по дороге',
  tractor: 'road|едет по дороге', firetruck: 'road|едет по дороге', ambulance: 'road|едет по дороге', taxi: 'road|едет по дороге',
  scooter: 'road|едет по дороге', train: 'road|едет по рельсам',
  plane: 'sky|летит в небе', helicopter: 'sky|летит в небе', balloon: 'sky|летят в небе', pigeon: 'sky|летает в небе',
  sun: 'sky|светит в небе', cloud: 'sky|плывёт по небу',
  rocket: 'space|летит в космос', moon: 'space|светит ночью', star: 'space|светит ночью',
};

// фоны «где живёт» (рисуются в круге за зверем)
const BG = {
  home: `<rect width="400" height="400" fill="#F6E7D6"/><rect x="0" y="290" width="400" height="110" fill="#E3C7A6"/><path d="M0 290 H400" stroke="#6E5A50" stroke-width="5"/><g stroke="#6E5A50" stroke-width="5" stroke-linejoin="round"><rect x="250" y="60" width="110" height="100" rx="8" fill="#D6EAF6"/><path d="M305 60 V160 M250 110 H360" fill="none"/></g><rect x="40" y="70" width="70" height="50" rx="6" fill="#F2C9C1" stroke="#6E5A50" stroke-width="5"/>`,
  farm: `<rect width="400" height="400" fill="#D9ECF7"/><rect x="0" y="260" width="400" height="140" fill="#BFDDAE"/><g stroke="#6E5A50" stroke-width="5" stroke-linejoin="round"><path d="M250 260 V170 L300 130 L350 170 V260 Z" fill="#E59A8C"/><rect x="285" y="205" width="30" height="55" fill="#F6E1C6"/><path d="M20 250 V210 M60 250 V210 M100 250 V210 M10 222 H110 M10 240 H110" fill="none"/></g><circle cx="80" cy="80" r="30" fill="#FBE29A"/>`,
  pond: `<rect width="400" height="400" fill="#DCEFF7"/><rect x="0" y="230" width="400" height="170" fill="#BFDDAE"/><ellipse cx="200" cy="320" rx="190" ry="70" fill="#9CCBE6" stroke="#6E5A50" stroke-width="5"/><g stroke="#6E5A50" stroke-width="5" stroke-linecap="round"><path d="M40 250 V190 M56 252 V170 M72 250 V200" fill="none"/><ellipse cx="56" cy="165" rx="6" ry="16" fill="#9C6B45"/><path d="M340 250 V180 M356 252 V196" fill="none"/></g>`,
  savanna: `<rect width="400" height="400" fill="#FBE7C2"/><circle cx="310" cy="80" r="40" fill="#F7C970"/><rect x="0" y="260" width="400" height="140" fill="#EBC98A"/><g stroke="#6E5A50" stroke-width="5" stroke-linejoin="round"><path d="M80 260 V180" fill="none"/><path d="M20 180 Q80 140 140 180 Z" fill="#A9CC98"/></g>`,
  desert: `<rect width="400" height="400" fill="#FBE7C2"/><circle cx="90" cy="80" r="40" fill="#F7C970"/><path d="M0 270 Q100 220 200 262 Q300 220 400 268 V400 H0 Z" fill="#EBC98A" stroke="#6E5A50" stroke-width="5"/><g stroke="#6E5A50" stroke-width="5" stroke-linejoin="round" fill="#A9CC98"><path d="M320 270 V200 Q320 186 332 186 Q344 186 344 200 V270 Z"/><path d="M320 236 H306 V214" fill="none"/></g>`,
  forest: `<rect width="400" height="400" fill="#DCEFF7"/><rect x="0" y="270" width="400" height="130" fill="#BFDDAE"/><g stroke="#6E5A50" stroke-width="5" stroke-linejoin="round"><path d="M60 270 V230" fill="none"/><path d="M60 110 L110 230 H10 Z" fill="#8FBF7F"/><path d="M340 270 V236" fill="none"/><path d="M340 120 L385 236 H295 Z" fill="#8FBF7F"/><path d="M290 270 V250" fill="none"/><circle cx="290" cy="220" r="34" fill="#A9CC98"/></g>`,
  sea: `<rect width="400" height="400" fill="#DCEFF7"/><circle cx="320" cy="70" r="30" fill="#FBE29A"/><rect x="0" y="200" width="400" height="200" fill="#9CCBE6"/><g fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"><path d="M30 250 Q50 238 70 250 Q90 262 110 250"/><path d="M250 300 Q270 288 290 300 Q310 312 330 300"/><path d="M120 350 Q140 338 160 350"/></g>`,
  ice: `<rect width="400" height="400" fill="#E8F2F8"/><rect x="0" y="250" width="400" height="150" fill="#A9D2EA"/><g stroke="#6E5A50" stroke-width="5" stroke-linejoin="round" fill="#FFFFFF"><path d="M-10 270 L60 236 L170 246 L210 280 L-10 290 Z"/><path d="M250 290 L300 256 L410 262 V300 Z"/></g><g fill="#FFFFFF"><circle cx="60" cy="60" r="5"/><circle cx="140" cy="110" r="4"/><circle cx="300" cy="50" r="5"/><circle cx="350" cy="140" r="4"/></g>`,
  meadow: `<rect width="400" height="400" fill="#DCEFF7"/><rect x="0" y="240" width="400" height="160" fill="#BFDDAE"/><g stroke="#6E5A50" stroke-width="4"><circle cx="60" cy="280" r="12" fill="#F4B6B0"/><circle cx="330" cy="300" r="12" fill="#FBE29A"/><circle cx="110" cy="350" r="11" fill="#C9B6E4"/><circle cx="280" cy="360" r="11" fill="#F4B6B0"/></g><circle cx="70" cy="80" r="28" fill="#FBE29A"/>`,
  road: `<rect width="400" height="400" fill="#DCEFF7"/><rect x="0" y="220" width="400" height="180" fill="#BFDDAE"/><rect x="0" y="280" width="400" height="80" fill="#B8B2AC" stroke="#6E5A50" stroke-width="5"/><path d="M10 320 H390" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="36 28"/><circle cx="320" cy="80" r="30" fill="#FBE29A"/>`,
  sky: `<rect width="400" height="400" fill="#CFE6F6"/><g fill="#FFFFFF" stroke="#6E5A50" stroke-width="4"><path d="M40 120 Q40 90 70 92 Q84 66 112 80 Q140 76 140 104 Q156 120 136 132 H52 Q30 132 40 120 Z"/><path d="M260 300 Q260 274 286 276 Q300 254 324 266 Q350 262 350 288 Q364 302 346 312 H272 Q250 312 260 300 Z"/></g>`,
  space: `<rect width="400" height="400" fill="#3A4466"/><g fill="#FBE29A"><circle cx="60" cy="70" r="5"/><circle cx="140" cy="40" r="3"/><circle cx="330" cy="60" r="5"/><circle cx="360" cy="180" r="3"/><circle cx="40" cy="220" r="4"/><circle cx="100" cy="330" r="3"/><circle cx="300" cy="340" r="5"/><circle cx="220" cy="30" r="3"/></g>`,
};

// что делает: глагол по движению рисунка; для «множественных» карточек — отдельно
const VERB = {
  'tail-wag': 'виляет хвостиком', sway: 'качается', munch: 'жуёт', peek: 'выглядывает', waddle: 'ходит вперевалочку',
  nod: 'кивает головой', peck: 'клюёт', bounce: 'прыгает', trunk: 'машет хоботом', drive: 'едет', fly: 'летит',
  spin: 'крутит винтом', ring: 'звонит', flutter: 'летает', crawl: 'ползёт', jump: 'прыгает', tick: 'тикает: тик-так',
  hop: 'скачет', owl: 'хлопает глазками', swim: 'плывёт', crow: 'кричит: ку-ка-ре-ку', dive: 'ныряет',
  octo: 'машет щупальцами', scuttle: 'бегает', page: 'открывается', launch: 'взлетает', shine: 'светит',
  twinkle: 'светит ночью', twirl: 'сверкает', rain: 'капает дождиком', tree: 'шумит листиками', juggle: 'играет с мячиком',
  wobble: 'качается', smile: 'улыбается', sniff: 'нюхает', inch: 'ползёт', brush: 'чистит зубки', strum: 'играет',
  play: 'играет', notes: 'играет', swing: 'качается', hoist: 'поднимает груз', dance: 'танцует', wave: 'машет ручкой',
  hello: 'здоровается', stomp: 'топает',
};
const VERB_BY_ID = {
  whale: 'пускает фонтанчик', cup: null, drum: 'стучит: бум-бум', excavator: 'копает', bell: 'звенит: динь-динь',
  socks: 'качаются', boots: 'топают', feet: 'топают', eyes: 'моргают', ears: 'слушают', hands: 'машут',
  balloon: 'летят', blocks: 'складываются в башню', bath: null, mama: null, papa: null,
};

// части тела на рисунке: класс в SVG → слово
const PARTS = [['eyes', 'глазки'], ['tail', 'хвостик'], ['wing', 'крылышки'], ['ears', 'ушки'], ['trunk', 'хоботок'], ['head', 'головка']];

// род слова — для «большой/маленький» и «один/много»
const GENDER = {
  snoopy: 'm', kangaroo: 'm', taxi: 'n', ambulance: 'f', polarbear: 'm', bear: 'm', grandpa: 'm', papa: 'm',
  piano: 'n', coffee: 'm',
};
function gender(a) {
  if (GENDER[a.id]) return GENDER[a.id];
  const w = a.name.split(' ').pop().toLowerCase();
  if (/[иы]$/.test(w)) return 'p';
  if (/[ая]$/.test(w)) return 'f';
  if (/[оеё]$/.test(w)) return 'n';
  return 'm';
}
const BIG = { m: 'большой', f: 'большая', n: 'большое', p: 'большие' };
const SMALL = { m: 'маленький', f: 'маленькая', n: 'маленькое', p: 'маленькие' };
const ONE = { m: 'Один', f: 'Одна', n: 'Одно' };

const NO_COPY = new Set(['family', 'family2', 'body']);   // фото и части тела — без копий

export const EXTRA_KINDS = [
  ['food', 'Чем питается (рядом с едой)'],
  ['baby', 'Мама и малыш'],
  ['home', 'Где живёт (фон за зверем)'],
  ['action', 'Что делает (котик виляет хвостиком)'],
  ['body', 'Части тела (где глазки?)'],
  ['size', 'Большой и маленький'],
  ['count', 'Один и много'],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CANCEL = Symbol('cancel');

export function initExtras({ sound, settings, animalSvg }) {
  let cleanup = [];
  let lastKind = null;

  const cardSvg = (id) => animalSvg(id);
  const icon = (key) => (key.startsWith('#') ? cardSvg(key.slice(1)) : ICONS[key]);

  function applicable(a) {
    const has = (kind) => settings.extras?.[kind];
    const copyOk = !NO_COPY.has(a.category) && !a.photos && !a.family;
    const list = [];
    if (has('food') && FOOD[a.id]) list.push('food');
    if (has('baby') && BABY[a.id] && copyOk) list.push('baby');
    if (has('home') && HOME[a.id]) list.push('home');
    if (has('action') && verbOf(a)) list.push('action');
    if (has('body') && copyOk && partsOf(a).length) list.push('body');
    if (has('size') && copyOk) list.push('size');
    if (has('count') && copyOk && gender(a) !== 'p') list.push('count');
    return list;
  }

  function verbOf(a) {
    if (a.id in VERB_BY_ID) return VERB_BY_ID[a.id];
    return VERB[a.animation] || null;
  }

  function partsOf(a) {
    const svg = cardSvg(a.id);
    return PARTS.filter(([cls]) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(svg));
  }

  // Выбрать вставку для карточки: функция-«урок» или null, если ничего не включено.
  function pick(a) {
    const list = applicable(a);
    if (!list.length) return null;
    const pool = list.length > 1 ? list.filter((k) => k !== lastKind) : list;
    const kind = pool[Math.floor(Math.random() * pool.length)];
    lastKind = kind;
    return (ctx) => run(kind, a, ctx);
  }

  function cancel() {
    cleanup.forEach((f) => { try { f(); } catch {} });
    cleanup = [];
  }

  async function run(kind, a, { card, tile, alive }) {
    const step = async (ms) => {
      await wait(ms);
      if (!alive()) throw CANCEL;
    };
    const quiet = async () => {
      await step(250);
      while (!sound.isQuiet(0)) await step(200);
    };
    const say = async (text) => {
      sound.say(text);
      await quiet();
    };
    const layer = document.createElement('div');
    layer.className = 'extra';
    card.append(layer);
    cleanup.push(() => layer.remove());
    const el = tile.querySelector('.tile-animal');
    const show = (node) => requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('on')));
    const act = () => {
      el.classList.remove('act');
      void el.offsetWidth;
      el.classList.add('act');
      setTimeout(() => el.classList.remove('act'), 2800);
    };
    const copy = (cls) => {
      const d = document.createElement('div');
      d.className = cls;
      d.innerHTML = cardSvg(a.id);
      return d;
    };

    try {
      await step(900);   // видео уступило место рисунку — даём ему вырасти обратно

      if (kind === 'food') {
        const [key, text] = FOOD[a.id];
        const box = document.createElement('div');
        box.className = 'extra-food';
        box.innerHTML = icon(key);
        layer.append(box);
        show(box);
        await step(700);
        act();
        await say(text);
        await step(1500);
      }

      if (kind === 'baby') {
        const baby = copy('extra-small');
        layer.append(baby);
        show(baby);
        await step(800);
        baby.classList.add('hop');
        await say(BABY[a.id]);
        await step(1500);
      }

      if (kind === 'home') {
        const [bg, tail] = HOME[a.id].split('|');
        const back = document.createElement('div');
        back.className = 'extra-bg';
        back.innerHTML = `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">${BG[bg]}</svg>`;
        tile.querySelector('.tile-circle').after(back);
        cleanup.push(() => back.remove());
        show(back);
        await step(900);
        act();
        await say(`${a.name} ${tail}`);
        await step(1800);
        back.classList.remove('on');
        await step(900);
      }

      if (kind === 'action') {
        act();
        await say(`${a.name} ${verbOf(a)}`);
        await step(1200);
      }

      if (kind === 'body') {
        const parts = partsOf(a);
        const [cls, word] = parts[Math.floor(Math.random() * parts.length)];
        await say(`${a.name}. Где ${word}?`);
        await step(1200);
        const svg = el.querySelector('svg');
        const part = svg?.querySelector(`.${cls}`);
        if (part) {
          const b = part.getBBox();
          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
          ring.setAttribute('cx', b.x + b.width / 2);
          ring.setAttribute('cy', b.y + b.height / 2);
          ring.setAttribute('rx', b.width / 2 + 18);
          ring.setAttribute('ry', b.height / 2 + 18);
          ring.setAttribute('class', 'extra-ring');
          svg.append(ring);
          cleanup.push(() => ring.remove());
        }
        await say(`Вот ${word}!`);
        await step(2200);
      }

      if (kind === 'size') {
        const g = gender(a);
        const small = copy('extra-small');
        layer.append(small);
        show(small);
        await step(800);
        act();
        await say(`Это ${BIG[g]} ${a.name.toLowerCase()}.`);
        small.classList.add('hop');
        await say(`А это ${SMALL[g]}!`);
        await step(1500);
      }

      if (kind === 'count') {
        const g = gender(a);
        const many = document.createElement('div');
        many.className = 'extra-many';
        layer.append(many);
        el.classList.add('extra-hide');
        cleanup.push(() => el.classList.remove('extra-hide'));
        // один в центре, потом ещё четыре вокруг — «много»
        const spots = [[50, 52, 46], [24, 30, 30], [76, 30, 30], [24, 74, 30], [76, 74, 30]];
        const one = copy('extra-copy');
        one.style.cssText = 'left:50%;top:50%;width:52%';
        many.append(one);
        show(one);
        await step(900);
        await say(`${ONE[g]} ${a.name.toLowerCase()}.`);
        await step(500);
        one.style.cssText = `left:${spots[0][0]}%;top:${spots[0][1]}%;width:${spots[0][2]}%`;
        for (const [x, y, w] of spots.slice(1)) {
          const c = copy('extra-copy');
          c.style.cssText = `left:${x}%;top:${y}%;width:${w}%`;
          many.append(c);
          show(c);
          await step(250);
        }
        await say('А вот много!');
        await step(2000);
      }
    } catch (e) {
      if (e !== CANCEL) console.warn(e);
    } finally {
      cancel();
    }
  }

  return { pick, cancel };
}
