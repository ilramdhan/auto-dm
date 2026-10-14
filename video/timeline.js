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
  // analysis scene inserted into the VO pause after step 3 (VO padded with silence)
  INS_AT: 46.6, INS: 5.5,
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

// shift everything after the insert point, then add the analysis scene
(() => {
  const sh = v => (v >= TL.INS_AT - 1e-6 ? +(v + TL.INS).toFixed(3) : v);
  for (const n in TL.scenes) TL.scenes[n] = TL.scenes[n].map(sh);
  TL.scenes.step3[1] = TL.INS_AT;
  TL.scenes.scan = [TL.INS_AT, TL.INS_AT + TL.INS];
  for (const n in TL.k) if (typeof TL.k[n] === 'number') TL.k[n] = sh(TL.k[n]);
  TL.DURATION = +(TL.DURATION + TL.INS).toFixed(3);
  const a = TL.INS_AT;
  TL.k.scanBeam = [a + .9, a + 4.4]; TL.k.scanPeek = a + 2.3; TL.k.scanDone = a + 4.8;
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
