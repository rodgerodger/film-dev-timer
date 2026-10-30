/*
 * Film / chemistry data for Soup — home film developing timer.
 *
 * IMPORTANT: All times are starting points compiled from manufacturer
 * datasheets and common community references (e.g. the Massive Dev Chart).
 * Always double-check against the instructions that came with your kit or
 * film. Every step time can be edited on the Review screen before you start.
 *
 * Times are in SECONDS unless the key says otherwise.
 * Temperatures are in °C.
 */

/* ---------- Agitation schemes ----------
 * initial:  seconds of continuous agitation at the start
 * interval: repeat every N seconds after that
 * duration: length of each repeat agitation (seconds)
 */
const AGITATION = {
  ilford: { label: 'Ilford — 10 s inversions every minute', initial: 10, interval: 60, duration: 10 },
  kodak:  { label: 'Kodak — 30 s initial, then 5 s every 30 s', initial: 30, interval: 30, duration: 5 },
  color:  { label: 'Colour — 10 s initial, then 5 s every 30 s', initial: 10, interval: 30, duration: 5 },
  continuous: 'continuous',
};

/* ---------- Push / pull multipliers on developer time ---------- */
const PUSH_FACTORS = {
  c41:  { '-1': 0.77, '0': 1, '1': 1.3, '2': 1.7 },
  ecn2: { '-1': 0.77, '0': 1, '1': 1.3, '2': 1.7 },
  bw:   { '-1': 0.75, '0': 1, '1': 1.4, '2': 1.9, '3': 2.5 },
};

/* ---------- Shared step builders ---------- */
const S = {
  load: () => ({
    id: 'load', name: 'Load film in the dark', manual: true,
    instr: 'In a changing bag or totally dark room, load the film onto the reel and close the tank. Lights can come on once the lid is sealed.',
  }),
  prepColor: (temp) => ({
    id: 'prep', name: 'Bring chemistry to temperature', manual: true, temp,
    instr: `Warm all chemistry bottles in a water bath until the developer is at ${'{T}'}. Developer temperature is critical — hold it within ±0.3 °C. Other baths can be within a couple of degrees.`,
  }),
  prewarm: (temp) => ({
    id: 'prewarm', name: 'Pre-warm tank', time: 60, temp, agitation: 'continuous', optional: true, drain: true,
    instr: 'Fill the tank with water at process temperature and agitate gently. This brings the tank and reels up to temperature so the developer doesn\'t cool down. Drain fully.',
  }),
  dry: (extra = '') => ({
    id: 'dry', name: 'Hang to dry', manual: true,
    instr: `Remove film from the reel, clip the ends and hang in a dust-free place (a bathroom after running a hot shower works well). Let it dry 2–4 hours before cutting. ${extra}`,
  }),
};

/* ---------- C-41 ---------- */
const C41_FILMS = [
  { id: 'portra160', name: 'Kodak Portra 160', iso: 160 },
  { id: 'portra400', name: 'Kodak Portra 400', iso: 400 },
  { id: 'portra800', name: 'Kodak Portra 800', iso: 800 },
  { id: 'ektar100', name: 'Kodak Ektar 100', iso: 100 },
  { id: 'gold200', name: 'Kodak Gold 200', iso: 200 },
  { id: 'ultramax400', name: 'Kodak UltraMax 400', iso: 400 },
  { id: 'colorplus200', name: 'Kodak ColorPlus 200', iso: 200 },
  { id: 'fuji400', name: 'Fujifilm 400', iso: 400 },
  { id: 'cs800t', name: 'CineStill 800T', iso: 800 },
  { id: 'cs400d', name: 'CineStill 400D', iso: 400 },
  { id: 'cs50d', name: 'CineStill 50D', iso: 50 },
  { id: 'lomo100', name: 'Lomography Color 100', iso: 100 },
  { id: 'lomo400', name: 'Lomography Color 400', iso: 400 },
  { id: 'lomo800', name: 'Lomography Color 800', iso: 800 },
  { id: 'xp2', name: 'Ilford XP2 Super (C-41 B&W)', iso: 400 },
  { id: 'other', name: 'Other C-41 film', iso: null },
];

const C41_KITS = [
  {
    id: 'cs41', name: 'CineStill Cs41 (Dev + Blix)',
    note: 'Simplified 2-bath kit. Developer time increases with every roll processed.',
    temp: 39, capacity: 24, perRollPct: 2, perWeekPct: 1, shelfLifeWeeks: 8,
    steps: (t) => [
      S.load(), S.prepColor(t), S.prewarm(t),
      { id: 'dev', name: 'Developer', time: 210, temp: t, agitation: AGITATION.color, compensate: true, drain: true,
        instr: 'Pour developer in and start the timer as you begin pouring. Tap the tank to dislodge air bubbles after the first agitation. Keep the tank in the water bath between agitations.' },
      { id: 'blix', name: 'Blix', time: 480, temp: t, agitation: AGITATION.color, drain: true,
        instr: 'Pour in blix (no rinse needed after developer). Return used developer to its bottle. Over-blixing does no harm; under-blixing leaves film murky.' },
      { id: 'wash', name: 'Wash', time: 180, temp: t, agitation: 'continuous', drain: true,
        instr: 'Wash with running water at roughly process temperature (within a few degrees), or fill-and-dump at least 6 times.' },
      { id: 'stab', name: 'Stabilizer / final rinse', time: 60, temp: null, agitation: { initial: 15, interval: 999, duration: 0 }, optional: true, drain: true,
        instr: 'Gently agitate for 15 s then let it sit. Do not rinse afterwards — hang straight to dry.' },
      S.dry(),
    ],
  },
  {
    id: 'colortec', name: 'Tetenal Colortec / Arista C-41 (Dev, Blix, Stab)',
    note: '3-bath press kit. ~12 rolls per litre.',
    temp: 38, capacity: 12, perRollPct: 2.5, perWeekPct: 1, shelfLifeWeeks: 6,
    steps: (t) => [
      S.load(), S.prepColor(t), S.prewarm(t),
      { id: 'dev', name: 'Developer', time: 195, temp: t, agitation: AGITATION.color, compensate: true, drain: true,
        instr: 'Pour developer in and start the timer as you begin pouring. Tap the tank to dislodge air bubbles. Keep the tank in the water bath between agitations.' },
      { id: 'blix', name: 'Blix', time: 240, temp: t, agitation: AGITATION.color, drain: true,
        instr: 'Pour in blix straight after the developer. Return used developer to its bottle.' },
      { id: 'wash', name: 'Wash', time: 180, temp: t, agitation: 'continuous', drain: true,
        instr: 'Wash with running water at roughly process temperature, or fill-and-dump at least 6 times.' },
      { id: 'stab', name: 'Stabilizer', time: 60, temp: null, agitation: { initial: 15, interval: 999, duration: 0 }, drain: true,
        instr: 'Gently agitate for 15 s then let it sit. Do not rinse afterwards — hang straight to dry.' },
      S.dry(),
    ],
  },
  {
    id: 'flexicolor', name: 'Kodak Flexicolor / Bellini (separate Bleach & Fix)',
    note: 'Full professional C-41 process with separate bleach and fixer.',
    temp: 37.8, capacity: 16, perRollPct: 2, perWeekPct: 1, shelfLifeWeeks: 6,
    steps: (t) => [
      S.load(), S.prepColor(t), S.prewarm(t),
      { id: 'dev', name: 'Developer', time: 195, temp: t, agitation: AGITATION.color, compensate: true, drain: true,
        instr: 'Pour developer in and start the timer as you begin pouring. Tap the tank to dislodge air bubbles. Keep the tank in the water bath between agitations.' },
      { id: 'bleach', name: 'Bleach', time: 390, temp: t, agitation: AGITATION.color, drain: true,
        instr: 'Pour in bleach directly after developer. Return used developer to its bottle.' },
      { id: 'wash1', name: 'Wash', time: 180, temp: t, agitation: 'continuous', drain: true,
        instr: 'Wash with running water at roughly process temperature.' },
      { id: 'fix', name: 'Fixer', time: 390, temp: t, agitation: AGITATION.color, drain: true,
        instr: 'Pour in fixer. Return used bleach to its bottle.' },
      { id: 'wash2', name: 'Final wash', time: 180, temp: t, agitation: 'continuous', drain: true,
        instr: 'Wash with running water at roughly process temperature.' },
      { id: 'stab', name: 'Stabilizer', time: 90, temp: null, agitation: { initial: 15, interval: 999, duration: 0 }, drain: true,
        instr: 'Gently agitate for 15 s then let it sit. Do not rinse afterwards — hang straight to dry.' },
      S.dry(),
    ],
  },
];

/* ---------- ECN-2 ---------- */
const ECN2_FILMS = [
  { id: 'v50d', name: 'Kodak Vision3 50D (5203)', iso: 50, remjet: true },
  { id: 'v250d', name: 'Kodak Vision3 250D (5207)', iso: 250, remjet: true },
  { id: 'v200t', name: 'Kodak Vision3 200T (5213)', iso: 200, remjet: true },
  { id: 'v500t', name: 'Kodak Vision3 500T (5219)', iso: 500, remjet: true },
  { id: 'norj', name: 'ECN-2 film with rem-jet already removed', iso: null, remjet: false },
  { id: 'other', name: 'Other ECN-2 film (with rem-jet)', iso: null, remjet: true },
];

const ECN2_KITS = [
  {
    id: 'ecn2std', name: 'ECN-2 kit — standard 41.1 °C (Flic Film, Bellini, home-mix)',
    note: 'Standard ECN-2 sequence with stop bath, bleach and fixer.',
    temp: 41.1, capacity: 12, perRollPct: 2, perWeekPct: 1, shelfLifeWeeks: 6,
    steps: (t, film) => {
      const steps = [S.load(), S.prepColor(t)];
      if (film && film.remjet) {
        steps.push(
          { id: 'prebath', name: 'Rem-jet pre-bath', time: 60, temp: t, agitation: 'continuous', drain: true,
            instr: 'Alkaline pre-bath (e.g. 20 g borax or baking soda + 20 g sodium sulfate per litre, or the kit pre-bath). This softens the black rem-jet backing. Agitate continuously. The liquid will come out black.' },
          { id: 'remjet', name: 'Rem-jet rinse', time: 60, temp: t, agitation: 'continuous', drain: true,
            instr: 'Rinse vigorously with warm water (≈ process temp), fill-and-dump until it runs mostly clear. Remaining rem-jet comes off at the end.' },
        );
      } else {
        steps.push(S.prewarm(t));
      }
      steps.push(
        { id: 'dev', name: 'Developer', time: 180, temp: t, agitation: AGITATION.color, compensate: true, drain: true,
          instr: 'Pour developer in and start the timer as you begin pouring. Hold the temperature tightly — ECN-2 is sensitive to temperature drift.' },
        { id: 'stop', name: 'Stop bath', time: 30, temp: null, agitation: 'continuous', drain: true,
          instr: 'Pour in stop bath. Return used developer to its bottle.' },
        { id: 'wash1', name: 'Rinse', time: 30, temp: null, agitation: 'continuous', drain: true,
          instr: 'Quick rinse with warm water.' },
        { id: 'bleach', name: 'Bleach', time: 180, temp: null, agitation: AGITATION.color, drain: true,
          instr: 'Pour in bleach. Bleach can be a bit cooler than the developer (27–38 °C).' },
        { id: 'wash2', name: 'Wash', time: 60, temp: null, agitation: 'continuous', drain: true,
          instr: 'Wash with warm water.' },
        { id: 'fix', name: 'Fixer', time: 120, temp: null, agitation: AGITATION.color, drain: true,
          instr: 'Pour in fixer.' },
        { id: 'wash3', name: 'Final wash', time: 180, temp: null, agitation: 'continuous', drain: true,
          instr: 'Wash with running warm water, or fill-and-dump at least 6 times.' },
        { id: 'final', name: 'Final rinse / stabilizer', time: 30, temp: null, agitation: { initial: 10, interval: 999, duration: 0 }, optional: true, drain: true,
          instr: 'Gently agitate then let it sit. Do not rinse afterwards.' },
      );
      steps.push(S.dry(film && film.remjet
        ? 'Before hanging, gently wipe both sides with a wet finger or soft sponge to remove any remaining rem-jet specks — especially the base (shiny) side.'
        : ''));
      return steps;
    },
  },
];

/* ---------- Black & white ---------- */
const BW_DEVELOPERS = [
  { id: 'd76',     name: 'Kodak D-76 / Ilford ID-11 — stock', reusable: true, capacity: 10, perRollPct: 10, perWeekPct: 0, shelfLifeWeeks: 26,
    note: 'Reusable stock: Ilford advises +10% time per roll already developed (per litre). Full, tightly-capped bottle lasts ~6 months; half-full ~2 months.' },
  { id: 'd76h',    name: 'D-76 / ID-11 — 1+1 (one-shot)', reusable: false, shelfLifeWeeks: 26,
    note: 'Dilute stock 1+1 and discard after use.' },
  { id: 'r25',     name: 'Rodinal / Adonal — 1+25', reusable: false, shelfLifeWeeks: 520,
    note: 'Concentrate keeps for years. Dilute fresh, discard after use.' },
  { id: 'r50',     name: 'Rodinal / Adonal — 1+50', reusable: false, shelfLifeWeeks: 520,
    note: 'Concentrate keeps for years. Needs at least 5–6 ml concentrate per roll.' },
  { id: 'hc110b',  name: 'Kodak HC-110 — Dilution B (1+31)', reusable: false, shelfLifeWeeks: 260,
    note: 'Syrup concentrate lasts years. Dilute fresh, discard after use.' },
  { id: 'ddx',     name: 'Ilford Ilfotec DD-X — 1+4', reusable: false, shelfLifeWeeks: 26,
    note: 'Opened concentrate ~6 months.' },
  { id: 'ilfosol', name: 'Ilford Ilfosol 3 — 1+9', reusable: false, shelfLifeWeeks: 26,
    note: 'Opened concentrate ~6 months. Use within 1 hour of diluting.' },
  { id: 'xtol',    name: 'Kodak XTOL — stock (one-shot)', reusable: false, shelfLifeWeeks: 26,
    note: 'Mixed stock ~6 months in a full bottle. XTOL can fail suddenly — run a clip test if old.' },
];

/* Developer times in MINUTES at 20 °C, box speed. null = not recommended / no data. */
const BW_FILMS = [
  { id: 'hp5',    name: 'Ilford HP5 Plus 400',  iso: 400, fix: 300,
    times: { d76: 7.5, d76h: 13, r25: 6, r50: 11, hc110b: 5, ddx: 9, ilfosol: 6.5, xtol: 7.5 } },
  { id: 'fp4',    name: 'Ilford FP4 Plus 125',  iso: 125, fix: 300,
    times: { d76: 8.5, d76h: 11, r25: 9, r50: 15, hc110b: 9, ddx: 10, ilfosol: 4.5, xtol: 8 } },
  { id: 'delta100', name: 'Ilford Delta 100',   iso: 100, fix: 300,
    times: { d76: 8.5, d76h: 11, r25: 7, r50: 11, hc110b: 6, ddx: 12, ilfosol: 6, xtol: 8.5 } },
  { id: 'delta400', name: 'Ilford Delta 400',   iso: 400, fix: 300,
    times: { d76: 9.5, d76h: 14, r25: 8, r50: 15, hc110b: 6.5, ddx: 8, ilfosol: 7, xtol: 7.5 } },
  { id: 'delta3200', name: 'Ilford Delta 3200 @ EI 3200', iso: 3200, fix: 420,
    times: { d76: 9.5, d76h: null, r25: null, r50: null, hc110b: 9.5, ddx: 9.5, ilfosol: null, xtol: null } },
  { id: 'trix',   name: 'Kodak Tri-X 400',      iso: 400, fix: 300,
    times: { d76: 6.75, d76h: 9.75, r25: 7, r50: 13, hc110b: 6, ddx: 7, ilfosol: 7, xtol: 7 } },
  { id: 'tmax100', name: 'Kodak T-Max 100',     iso: 100, fix: 420,
    times: { d76: 9, d76h: 12, r25: null, r50: 12, hc110b: 7, ddx: 8, ilfosol: null, xtol: 7 } },
  { id: 'tmax400', name: 'Kodak T-Max 400',     iso: 400, fix: 420,
    times: { d76: 8, d76h: 12.5, r25: 7, r50: 13, hc110b: 6, ddx: 7, ilfosol: null, xtol: 7 } },
  { id: 'doublex', name: 'Kodak Double-X 5222 @ EI 250', iso: 250, fix: 300,
    times: { d76: 7, d76h: 10, r25: null, r50: 11, hc110b: 6, ddx: null, ilfosol: null, xtol: 7 } },
  { id: 'foma100', name: 'Fomapan 100 Classic', iso: 100, fix: 300,
    times: { d76: 6, d76h: 8, r25: 7, r50: 9, hc110b: 5.5, ddx: null, ilfosol: null, xtol: 6 } },
  { id: 'foma400', name: 'Fomapan 400 Action',  iso: 400, fix: 300,
    times: { d76: 8, d76h: 11, r25: 7.5, r50: 12, hc110b: 7, ddx: null, ilfosol: null, xtol: 7 } },
  { id: 'kent100', name: 'Kentmere Pan 100',    iso: 100, fix: 300,
    times: { d76: 9, d76h: 12, r25: null, r50: null, hc110b: null, ddx: 9, ilfosol: 7, xtol: null } },
  { id: 'kent400', name: 'Kentmere Pan 400',    iso: 400, fix: 300,
    times: { d76: 10, d76h: 14, r25: null, r50: null, hc110b: 6, ddx: 9, ilfosol: 8, xtol: null } },
  { id: 'custom', name: 'Custom — enter my own time', iso: null, fix: 300, times: {} },
];

const BW_STEPS = (film, temp, agitation) => [
  S.load(),
  { id: 'prep', name: 'Mix & temper chemistry', manual: true, temp,
    instr: 'Dilute your developer, stop and fixer. Bring the developer to {T}. Stop and fixer should be within a couple of degrees of it.' },
  { id: 'presoak', name: 'Pre-soak (optional)', time: 60, temp, agitation: 'continuous', optional: true, enabled: false, drain: true,
    instr: 'Fill with plain water at developer temperature and agitate. Some films (and Ilford\'s recommendation) don\'t need this — skip it if unsure.' },
  { id: 'dev', name: 'Developer', time: 0, temp, agitation, compensate: true, drain: true,
    instr: 'Pour developer in and start the timer as you begin pouring. Tap the tank firmly after the first agitation to dislodge air bubbles. Inversions should be slow and smooth.' },
  { id: 'stop', name: 'Stop bath', time: 60, temp: null, agitation: 'continuous', drain: true,
    instr: 'Pour in stop bath (or plain water — fill and dump 3×). Discard or return used developer as appropriate.' },
  { id: 'fix', name: 'Fixer', time: film.fix || 300, temp: null, agitation: AGITATION.ilford, drain: true,
    instr: 'Pour in fixer. Return fixer to its bottle afterwards — it is reusable. T-grain films (T-Max, Delta 3200) need longer fixing.' },
  { id: 'wash', name: 'Wash (Ilford method)', time: 300, temp: null, agitation: null, drain: true,
    instr: 'Fill with water, invert 5×, dump. Refill, invert 10×, dump. Refill, invert 20×, dump. Or wash under running water for 5–10 minutes.' },
  { id: 'wet', name: 'Wetting agent', time: 60, temp: null, agitation: { initial: 5, interval: 999, duration: 0 }, optional: true, drain: true,
    instr: 'A few drops of Photo-Flo / Ilfotol in distilled water. Gently agitate once, then let it sit. Helps prevent drying marks.' },
  S.dry(),
];

const PROCESSES = {
  c41: {
    id: 'c41', name: 'C-41', subtitle: 'Colour negative', films: C41_FILMS, kits: C41_KITS,
    kitLabel: 'Kit', colour: true,
  },
  ecn2: {
    id: 'ecn2', name: 'ECN-2', subtitle: 'Motion picture colour negative', films: ECN2_FILMS, kits: ECN2_KITS,
    kitLabel: 'Kit', colour: true,
  },
  bw: {
    id: 'bw', name: 'B&W', subtitle: 'Black & white negative', films: BW_FILMS, kits: BW_DEVELOPERS,
    kitLabel: 'Developer', colour: false,
  },
};
