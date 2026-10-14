// Shared timeline (seconds, video time). VO is trimmed by VO_TRIM so speech starts ~0.4s.
// Scene cuts are aligned to pauses detected in the voice-over (ffmpeg silencedetect).
const TL = {
  VO_TRIM: 0.8,
  DURATION: 71.5,
  scenes: {
    hook:   [0.0, 5.6],
    title:  [5.6, 11.3],
    step1:  [11.3, 18.3],
    step2:  [18.3, 25.5],
    step3:  [25.5, 46.6],
    step4:  [46.6, 53.4],
    before: [53.4, 62.6],
    cta:    [62.6, 71.5],
  },
  // Design was authored against VO v1; WARP maps those times onto VO v2 (Voice Memos take).
  // Anchors = section starts found in VO v2 via pause + syllable-count alignment.
  // Branch A (before the analysis scene) and branch B (after it).
  WARP_SPLIT: 46.6,
  WARP_A: [[0, 0], [0.44, 0.32], [6.28, 5.62], [11.52, 11.76], [18.58, 18.0], [25.66, 26.42], [46.6, 46.95]],
  WARP_B: [[46.6, 55.0], [47.11, 55.27], [53.75, 61.47], [55.58, 63.72], [62.81, 69.65], [70.3, 76.27], [71.5, 77.6]],
  SCAN: [46.95, 55.0],
  // key beats
  k: {
    onePrompt: 10.0,
    s1Settings: 13.3, s1Connectors: 14.5, s1Drive: 15.6, s1Click: 16.9,
    s2UrlStart: 19.0, s2Enter: 20.1, s2ExtClick: 21.9, s2Install: 23.7,
    s3TypeStart: 26.3, s3TypeEnd: 39.4,
    s3Lines: [[26.3, 29.0], [29.2, 31.3], [31.5, 33.9], [34.1, 35.9], [36.1, 37.7], [37.9, 39.4]],
    s3Hl: { deep: 28.4, structure: 31.5, dup: 33.0, before: 40.4, del: 41.6, agents: 43.1, sonnet: 44.0, opus: 45.4 },
    s3Send: 45.9,
    s4Items: 47.3, s4Approve: 50.5, s4Progress: 51.1,
    bShutter: 53.9, bMorph: 55.5, bRows: 55.7, bStat11: 57.4, bStatDup: 59.0, bStatDel: 61.0,
    cKeyword: 64.4, cDm: 66.4, cFollow: 68.2,
  },
};

// warp design times onto VO v2, then add the analysis scene
(() => {
  const lin = (pts, v) => {
    for (let i = 1; i < pts.length; i++) if (v <= pts[i][0] || i === pts.length - 1) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return +(y0 + (v - x0) * (y1 - y0) / (x1 - x0)).toFixed(3);
    }
  };
  const w = v => (v < TL.WARP_SPLIT - 1e-6 ? lin(TL.WARP_A, v) : lin(TL.WARP_B, v));
  for (const n in TL.scenes) TL.scenes[n] = TL.scenes[n].map(w);
  TL.scenes.step3[1] = TL.SCAN[0];
  TL.scenes.scan = TL.SCAN.slice();
  for (const n in TL.k) {
    const v = TL.k[n];
    if (typeof v === 'number') TL.k[n] = w(v);
    else if (Array.isArray(v)) TL.k[n] = v.map(r => r.map(w));
    else TL.k[n] = Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, w(vv)]));
  }
  TL.DURATION = w(TL.DURATION);
  // Per-beat overrides in heard time (VO v2 raw + 0.6 s delay applied in the mix), placed on
  // phrase pauses detected in the take where a linear warp drifted (step 2 tail, step 3, before/after).
  Object.assign(TL.k, {
    s2UrlStart: 20.0, s2Enter: 21.0, s2ExtClick: 22.8, s2Install: 24.3,
    s3TypeStart: 27.3, s3TypeEnd: 41.6,
    s3Lines: [[27.3, 30.6], [30.8, 32.8], [33.0, 34.8], [35.0, 37.0], [37.2, 39.0], [39.2, 41.6]],
    s3Hl: { deep: 31.35, structure: 33.1, dup: 35.0, before: 40.0, del: 42.6, agents: 44.5, sonnet: 45.1, opus: 46.65 },
    s3Send: 47.0,
    bMorph: 64.25, bRows: 64.45,
  });
  TL.scenes.step2[1] = TL.scenes.step3[0] = 26.7;
  TL.scenes.step3[1] = TL.SCAN[0] = TL.scenes.scan[0] = 47.55;
  const a = TL.SCAN[0];
  // VO v2: "Nah, Claude langsung kerja. Semua folder di-scan, isi file ... dibaca, terus tiap file dikasih label ..."
  TL.k.scanBeam = [a + 0.6, a + 6.0]; TL.k.scanPeek = a + 2.8; TL.k.scanDone = a + 6.7;
})();

// ---- sound design (consumed by build_audio.js -> audio/mix.py) ----
TL.sfx = (() => {
  const S = TL.scenes, k = TL.k, ev = [];
  const add = (t, sfx, gain_db = 0, pan = 0) => ev.push({ t: +t.toFixed(3), sfx, gain_db, pan });
  // hook
  add(0.02, 'bass_hit', -2); add(0.05, 'glitch', -8);
  for (let i = 0; i < 14; i++) add(0.2 + i * 0.075, i % 2 ? 'pop' : 'pop_hi', -16, (i % 5 - 2) / 3);
  add(1.55, 'glitch', -10); add(3.2, 'glitch', -12);
  add(4.9, 'whoosh_rev', -6);
  // scene transitions
  for (const name of ['title', 'step1', 'step2', 'step3', 'step4', 'before', 'cta']) add(S[name][0] - 0.12, 'whoosh', -7, 0.2);
  add(S.title[0] + 0.25, 'impact', -9); add(S.title[0] + 0.9, 'ding', -10);
  add(k.onePrompt, 'pop_hi', -8);
  // step 1
  add(k.s1Settings, 'click', -6); add(k.s1Connectors, 'click', -6); add(k.s1Drive, 'pop', -9);
  add(k.s1Click, 'click', -3); add(k.s1Click + 0.12, 'toggle', -6); add(k.s1Click + 0.45, 'success', -9);
  // step 2
  ev.push({ t: k.s2UrlStart, typing: { chars: 16, cps: 16 }, gain_db: -10 });
  add(k.s2Enter, 'key_enter', -6); add(k.s2Enter + 0.25, 'whoosh_fast', -12);
  add(k.s2ExtClick, 'click', -3); add(k.s2ExtClick + 0.15, 'whoosh', -9, 0.6);
  add(k.s2Install, 'notif', -9);
  // step 3 typing (per line)
  k.s3Lines.forEach(([a, b], i) => {
    const chars = [74, 50, 58, 44, 38, 62][i];
    ev.push({ t: a, typing: { chars, cps: chars / (b - a) }, gain_db: -12 });
  });
  for (const t of Object.values(k.s3Hl)) add(t, 'pop', -13);
  add(k.s3Send - 0.05, 'click', -4); add(k.s3Send, 'swoosh_send', -6);
  // analysis scene
  add(S.scan[0] - 0.12, 'whoosh', -7, 0.2);
  add(k.scanBeam[0] - 0.3, 'riser', -14);
  for (let i = 0; i < 11; i++) add(k.scanBeam[0] + (i + .5) / 11 * (k.scanBeam[1] - k.scanBeam[0]), i % 3 === 2 ? 'pop_hi' : 'pop', -15, (i % 3 - 1) / 3);
  for (let i = 0; i < 24; i++) add(k.scanBeam[0] + i * 0.15, 'key', -24);
  add(k.scanPeek, 'whoosh_fast', -13);
  add(k.scanDone, 'success', -10);
  // step 4
  for (let i = 0; i < 6; i++) add(k.s4Items + i * 0.36, 'pop', -12, (i % 3 - 1) / 3);
  add(k.s4Approve, 'click', -3); add(k.s4Approve + 0.15, 'success', -8);
  add(k.s4Progress, 'riser', -16); add(S.step4[1] - 0.45, 'ding', -12);
  // before / after
  add(k.bShutter, 'shutter', -3);
  add(k.bMorph - 0.3, 'whoosh_rev', -7);
  for (let i = 0; i < 12; i++) add(k.bRows + i * 0.14, i % 2 ? 'pop' : 'pop_hi', -13, (i % 3 - 1) / 4);
  add(k.bStat11, 'pop_hi', -8); add(k.bStatDup, 'pop_hi', -8);
  add(k.bStatDel, 'impact', -8); add(k.bStatDel + 0.05, 'shutter', -9);
  // cta
  add(S.cta[0] + 0.3, 'pop', -8);
  add(k.cKeyword, 'impact', -11); add(k.cKeyword + 0.1, 'ding', -9);
  add(k.cDm, 'notif', -6);
  add(k.cFollow, 'click', -5); add(k.cFollow + 0.1, 'success', -10);
  return ev.sort((a, b) => a.t - b.t);
})();

if (typeof module !== 'undefined') module.exports = TL;
