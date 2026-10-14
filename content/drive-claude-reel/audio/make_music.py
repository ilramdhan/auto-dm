#!/usr/bin/env python3
"""Synthesize a lo-fi/tech minimal background bed. Usage: make_music.py [duration_s] [out.wav]"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dsp import *

BPM = 110
BEAT = 60.0 / BPM
BAR = 4 * BEAT
# Am7 - Fmaj7 - Cmaj7 - G6  (midi)
CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 64]]
ROOTS = [33, 29, 36, 31]  # sub bass root midi (A1, F1, C2, G1)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f, n, detune_cents, phase0):
    t = np.arange(n) / SR
    ph = (f * 2 ** (detune_cents / 1200) * t + phase0) % 1.0
    return 2 * ph - 1


def kick(dur=0.35):
    t = t_axis(dur)
    f = 45 + 95 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)
    x += 0.25 * lowpass(np.random.default_rng(1).standard_normal(len(t)), 2500) * np.exp(-t * 90)
    return np.tanh(x * 1.2) * 0.9


def hat(rng, dur=0.06):
    t = t_axis(dur)
    return highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * 90)


def main():
    dur = float(sys.argv[1]) if len(sys.argv) > 1 else 52.0
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'music_bed.wav')
    n = int(dur * SR) + SR  # padding
    rng = np.random.default_rng(42)
    L = np.zeros(n); R = np.zeros(n)
    drums = np.zeros(n); sub = np.zeros(n)
    pad_l = np.zeros(n); pad_r = np.zeros(n)

    k = kick()
    nbars = int(np.ceil(dur / BAR)) + 1
    for bar in range(nbars):
        b0 = bar * BAR
        ci = bar % 4
        # kicks on every beat (softer on 2 and 4)
        for beat in range(4):
            s = int((b0 + beat * BEAT) * SR)
            if s >= n: continue
            g = 1.0 if beat in (0, 2) else 0.7
            seg = k[:n - s]; drums[s:s + len(seg)] += seg * g
        # hats on 8ths, offbeats a bit louder, humanized
        for e in range(8):
            s = int((b0 + e * BEAT / 2) * SR) + int(rng.integers(0, 120))
            if s >= n: continue
            h = hat(rng) * (0.45 if e % 2 else 0.22) * (0.8 + 0.4 * rng.random())
            h = h[:n - s]; drums[s:s + len(h)] += h
        # pad chord (held full bar with soft attack/release overlap)
        s = int(b0 * SR); clen = int((BAR + 0.5) * SR)
        clen = min(clen, n - s)
        if clen <= 0: continue
        tt = np.arange(clen) / SR
        env = np.minimum(tt / 0.35, 1) * np.clip((BAR + 0.5 - tt) / 0.5, 0, 1)
        cl = np.zeros(clen); cr = np.zeros(clen)
        for vi, m in enumerate(CHORDS[ci]):
            f = mtof(m)
            for d, p in ((-9, 0.0), (0, 0.33), (8, 0.66)):
                w = saw(f, clen, d, p + vi * 0.13)
                pan = (-0.6 if d < 0 else 0.6 if d > 0 else 0.0) * (0.7 + 0.1 * vi)
                cl += w * np.cos((pan + 1) * np.pi / 4)
                cr += w * np.sin((pan + 1) * np.pi / 4)
        pad_l[s:s + clen] += cl * env
        pad_r[s:s + clen] += cr * env
        # sub bass: note on beat 1 and a short one on the 'and' of 3
        for off, ln, g in ((0, 1.6 * BEAT, 1.0), (2.5 * BEAT, 1.0 * BEAT, 0.7)):
            s2 = int((b0 + off) * SR); m = int(ln * SR)
            m = min(m, n - s2)
            if m <= 0: continue
            tt2 = np.arange(m) / SR
            e2 = np.minimum(tt2 / 0.01, 1) * np.exp(-tt2 * 2.2) * np.clip((ln - tt2) / 0.05, 0, 1)
            sub[s2:s2 + m] += np.sin(2 * np.pi * mtof(ROOTS[ci]) * tt2) * e2 * g

    # pad: lowpass (with slow LFO-ish brightness via two mixed cutoffs), lo-fi warmth
    pl = lowpass(pad_l, 1100, 2); pr = lowpass(pad_r, 1100, 2)
    pl = 0.7 * pl + 0.3 * lowpass(pad_l, 500, 2); pr = 0.7 * pr + 0.3 * lowpass(pad_r, 500, 2)
    pl = highpass(pl, 120, 2); pr = highpass(pr, 120, 2)
    pn = max(np.max(np.abs(pl)), np.max(np.abs(pr)), 1e-9)
    pl /= pn; pr /= pn
    drums_l = drums
    # sidechain-ish pump on pad from kick grid
    pump = np.ones(n)
    for bar in range(nbars):
        for beat in range(4):
            s = int((bar * BAR + beat * BEAT) * SR)
            m = min(int(0.25 * SR), n - s)
            if m > 0:
                pump[s:s + m] *= 1 - 0.35 * np.exp(-np.arange(m) / SR * 12)
    pl *= pump; pr *= pump

    hatsrc = drums
    L = pl * 0.40 + sub * 0.30 + drums * 0.55
    R = pr * 0.40 + sub * 0.30 + drums * 0.55
    # gentle lo-fi tone: lowpass the whole thing at 9 kHz
    L = lowpass(L, 9000, 2); R = lowpass(R, 9000, 2)

    N = int(dur * SR)
    L, R = L[:N], R[:N]
    m = np.stack([L, R], axis=1)
    fi, fo = int(0.5 * SR), int(2.0 * SR)
    m[:fi] *= np.linspace(0, 1, fi)[:, None]
    if fo < N:
        m[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    m *= db(-6.0) / np.max(np.abs(m))
    write_wav(out_path, m)
    print('wrote', out_path, f'{dur}s')


if __name__ == '__main__':
    main()
