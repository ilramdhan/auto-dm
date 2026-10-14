#!/usr/bin/env python3
"""Synthesize UI/motion-graphics SFX into audio/sfx/*.wav (numpy only)."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsp import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx')
rng = np.random.default_rng(7)


def noise(n):
    return rng.standard_normal(n)


def sine(f, dur, phase=0.0):
    t = t_axis(dur)
    f = np.broadcast_to(f, t.shape)
    return np.sin(phase + 2 * np.pi * np.cumsum(f) / SR)


def save(name, x):
    x = fade(x, 0.002, 0.012)
    x = normalize(x, -3.0)
    write_wav(os.path.join(OUT, name + '.wav'), x)


def stereo_wide(m, amount=0.3, delay_ms=0.4):
    d = int(delay_ms * SR / 1000)
    r = np.concatenate([np.zeros(d), m])[:len(m)]
    return np.stack([m, (1 - amount) * m + amount * r], axis=1)


def whoosh_core(dur, f0, f1, q, pan_range=0.8, peak_pos=0.45, lo_boost=True):
    t = t_axis(dur); n = len(t); u = t / dur
    # sweep up to f1 at peak_pos then down to f0
    s = np.where(u < peak_pos, (u / peak_pos), 1 - (u - peak_pos) / (1 - peak_pos))
    s = np.sin(s * np.pi / 2) ** 1.5
    fc = f0 * (f1 / f0) ** s
    x = svf_bandpass(noise(n), fc, q)
    env = np.sin(np.pi * u ** 0.8) ** 2
    x = x * env
    x = lowpass(x, 9000, 2)
    pan = -pan_range * np.cos(np.pi * u)
    return pan_stereo(x, pan)


def make_whoosh():
    save('whoosh', whoosh_core(0.6, 300, 4500, 1.6))
    save('whoosh_fast', whoosh_core(0.3, 500, 6000, 1.8, peak_pos=0.4))


def make_whoosh_rev():
    dur = 0.8; hit_t = 0.62
    n = int(dur * SR); t = t_axis(dur)
    rise_n = int(hit_t * SR)
    u = np.linspace(0, 1, rise_n)
    fc = 250 * (7000 / 250) ** (u ** 1.6)
    r = svf_bandpass(noise(rise_n), fc, 1.4) * (u ** 2.2)
    r = lowpass(r, 10000)
    x = np.zeros(n); x[:rise_n] = r
    # hit: low thump + short noise
    ht = t_axis(dur - hit_t)
    thump = np.sin(2 * np.pi * np.cumsum(55 + 70 * np.exp(-ht * 25)) / SR) * np.exp(-ht * 9)
    tick = lowpass(noise(len(ht)), 3500) * np.exp(-ht * 40) * 0.5
    x[rise_n:] += (thump + tick)[:n - rise_n] * 1.2
    save('whoosh_rev', pan_stereo(x, 0.0) if False else stereo_wide(x, 0.25))


def click_core(f=2400, dur=0.04, decay=160, body=900):
    t = t_axis(dur)
    tick = highpass(noise(len(t)), 1800) * np.exp(-t * decay)
    tone = np.sin(2 * np.pi * f * t) * np.exp(-t * decay * 0.7) * 0.5
    low = np.sin(2 * np.pi * body * t) * np.exp(-t * 90) * 0.4
    return lowpass(tick + tone + low, 9000)


def make_click():
    save('click', stereo_wide(click_core(), 0.15))
    # toggle: down click then up click+blip
    dur = 0.18; x = np.zeros(int(dur * SR))
    c = click_core(1800, 0.03, 220, 700)
    x[:len(c)] += c * 0.8
    off = int(0.045 * SR)
    c2 = click_core(2800, 0.03, 200, 1000)
    x[off:off + len(c2)] += c2
    bt = t_axis(0.12)
    f = 880 + 440 * np.minimum(bt / 0.05, 1)
    blip = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-bt * 28) * 0.35
    o2 = int(0.05 * SR)
    x[o2:o2 + len(blip)] += blip
    save('toggle', stereo_wide(x, 0.2))


def key_press(f_body, f_click, dur=0.05, bright=3500, thock=1.0, seed=0):
    r = np.random.default_rng(seed)
    t = t_axis(dur); n = len(t)
    nz = r.standard_normal(n)
    down = highpass(lowpass(nz, bright), 1200) * np.exp(-t * 170)
    body = np.sin(2 * np.pi * f_body * t) * np.exp(-t * 110) * thock
    tick = np.sin(2 * np.pi * f_click * t) * np.exp(-t * 330) * 0.35
    x = down * 0.9 + body * 0.7 + tick
    # key-up release click, quiet
    up = int(0.028 * SR)
    ut = t[:n - up]
    rel = highpass(r.standard_normal(len(ut)), 2500) * np.exp(-ut * 300) * 0.18
    x[up:] += rel
    return lowpass(x, 8500)


def make_keys():
    params = [(180, 3100, 3200, 1.0), (210, 3400, 3600, 0.9), (165, 2900, 3000, 1.1),
              (195, 3700, 3400, 0.95), (225, 3200, 3800, 0.85), (175, 3500, 3100, 1.05)]
    for i, (fb, fc, br, th) in enumerate(params):
        k = key_press(fb, fc, 0.05, br, th, seed=100 + i)
        save(f'key{i+1}', stereo_wide(k, 0.1 + 0.03 * i))
    # space: deeper, longer
    sp = key_press(120, 2400, 0.08, 2600, 1.5, seed=200)
    save('key_space', stereo_wide(sp, 0.2))
    # enter: deeper thock + second tick
    en = key_press(140, 2600, 0.11, 2800, 1.4, seed=300)
    t = t_axis(0.11)
    en += np.sin(2 * np.pi * 95 * t) * np.exp(-t * 55) * 0.5
    save('key_enter', stereo_wide(en, 0.2))


def make_shutter():
    dur = 0.25; n = int(dur * SR); x = np.zeros(n)
    c1 = click_core(1500, 0.05, 130, 600)
    x[:len(c1)] += c1
    o = int(0.07 * SR)
    c2 = click_core(1100, 0.06, 110, 500)
    x[o:o + len(c2)] += c2 * 1.0
    bt = t_axis(0.12)
    burst = bandpass(noise(len(bt)), 1500, 7000) * np.exp(-bt * 28) * 0.45
    x[int(0.02 * SR):int(0.02 * SR) + len(bt)] += burst
    save('shutter', stereo_wide(x, 0.3, 0.6))


def pop_core(f_start, f_end, dur, decay):
    t = t_axis(dur)
    f = f_end + (f_start - f_end) * np.exp(-t * 60)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)
    x += 0.2 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * np.exp(-t * decay * 1.6)
    x += 0.15 * highpass(noise(len(t)), 2500) * np.exp(-t * 250)
    return x


def make_pops():
    save('pop', stereo_wide(pop_core(900, 360, 0.12, 38), 0.2))
    save('pop_hi', stereo_wide(pop_core(1700, 700, 0.1, 42), 0.2))


def bell(f, dur, decay=4.0, partials=((1, 1.0), (2.0, 0.35), (3.01, 0.12), (4.2, 0.05))):
    t = t_axis(dur); x = np.zeros(len(t))
    for r, a in partials:
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * decay * (1 + 0.5 * (r - 1)))
    x *= np.minimum(t / 0.004, 1)
    return x


def make_chimes():
    ding = bell(1318.5, 1.0, 3.5) + 0.6 * bell(1975.5, 1.0, 4.0, ((1, 1.0), (2.0, 0.2)))
    ding += 0.4 * bell(2637, 1.0, 5.0, ((1, 1.0),))
    save('ding', stereo_wide(ding, 0.35, 0.8))
    notes = [783.99, 987.77, 1318.5]  # G5 B5 E6
    dur = 1.3; x = np.zeros(int(dur * SR))
    for i, f in enumerate(notes):
        b = bell(f, dur - i * 0.11, 4.0, ((1, 1.0), (2.0, 0.25), (3.0, 0.08)))
        o = int(i * 0.11 * SR)
        b = b[:len(x) - o]; x[o:o + len(b)] += b * (0.8 + 0.1 * i)
    save('success', stereo_wide(x, 0.35, 0.8))


def make_impact():
    dur = 1.2; t = t_axis(dur)
    f = 42 + 90 * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    mid = np.sin(2 * np.pi * np.cumsum(90 + 120 * np.exp(-t * 30)) / SR) * np.exp(-t * 12) * 0.6
    tr = lowpass(noise(len(t)), 4500) * np.exp(-t * 55) * 0.7
    tail = lowpass(noise(len(t)), 600) * np.exp(-t * 4) * 0.15
    x = sub + mid + tr + tail
    x = np.tanh(x * 1.3)
    x = stereo_wide(x, 0.15)
    save('bass_hit', x)
    save('impact', x * 1.0)


def make_glitch():
    dur = 0.4; n = int(dur * SR); r = np.random.default_rng(11)
    t = t_axis(dur)
    src = np.sin(2 * np.pi * 440 * t) * 0.5 + 0.5 * bandpass(noise(n), 800, 6000)
    out = np.zeros(n); i = 0
    while i < n:
        seg = int(r.integers(120, 1400))
        seg = min(seg, n - i)
        rep = src[i:i + max(seg // int(r.integers(1, 4)), 8)]
        piece = np.resize(rep, seg)
        if r.random() < 0.5:
            step = int(r.integers(8, 40))  # sample-and-hold downsample
            piece = np.repeat(piece[::step], step)[:seg]
        lev = 2 ** int(r.integers(3, 6))
        piece = np.round(piece * lev) / lev  # bitcrush
        out[i:i + seg] = piece * (0.5 + 0.5 * r.random())
        i += seg
        if r.random() < 0.25:
            i += int(r.integers(100, 600))
    out = lowpass(out, 9000, 2) * (1 - t / dur * 0.6)
    st = np.stack([out, np.roll(out, 37)], axis=1)
    save('glitch', st)


def make_riser():
    dur = 2.0; t = t_axis(dur); u = t / dur; n = len(t)
    fc = 200 * (9000 / 200) ** (u ** 1.5)
    nz = svf_bandpass(noise(n), fc, 1.2) * (0.15 + u ** 2)
    f = 220 * 2 ** (u * 3)
    tone = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)) * u ** 2.5 * 0.5
    x = lowpass(nz * 1.3 + tone, 11000)
    x *= u ** 1.1
    L = x; R = np.roll(x, 60) * 0.95
    save('riser', np.stack([L, R], axis=1))


def make_swoosh_send():
    dur = 0.35; t = t_axis(dur); u = t / dur; n = len(t)
    fc = 400 * (7000 / 400) ** (u ** 1.3)
    nz = svf_bandpass(noise(n), fc, 2.2) * np.sin(np.pi * u ** 0.7) ** 1.5
    f = 500 * 2 ** (u * 2.2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * u) ** 2 * 0.25
    x = lowpass(nz + tone, 10000)
    save('swoosh_send', pan_stereo(x, -0.6 + 1.2 * u))


def make_notif():
    dur = 0.35; t = t_axis(dur)
    x = np.zeros(len(t))
    for f, o, a in ((1046.5, 0, 1.0), (1568.0, 0.07, 0.8)):
        s = int(o * SR); tt = t[:len(t) - s]
        x[s:] += a * (np.sin(2 * np.pi * f * tt) + 0.15 * np.sin(2 * np.pi * 2 * f * tt)) * np.minimum(tt / 0.006, 1) * np.exp(-tt * 14)
    save('notif', stereo_wide(lowpass(x, 7000), 0.25, 0.5))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make_whoosh(); make_whoosh_rev(); make_click(); make_keys(); make_shutter()
    make_pops(); make_chimes(); make_impact(); make_glitch(); make_riser()
    make_swoosh_send(); make_notif()
    print('wrote', len(os.listdir(OUT)), 'files to', OUT)
