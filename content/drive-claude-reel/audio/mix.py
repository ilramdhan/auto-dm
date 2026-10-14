#!/usr/bin/env python3
"""Usage: python3 audio/mix.py timeline.json out.wav  (see audio/README.md)"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dsp import SR, db, read_wav, write_wav

ROOT = os.path.dirname(HERE)
_cache = {}


def load_sfx(name):
    if name not in _cache:
        _cache[name] = read_wav(os.path.join(HERE, 'sfx', name + '.wav'))
    return _cache[name]


def resolve(p):
    if os.path.isabs(p) or os.path.exists(p):
        return p
    return os.path.join(ROOT, p)


def expand_events(events, rng):
    out = []
    for e in events:
        if 'typing' in e:
            ty = e['typing']
            chars, cps = int(ty.get('chars', 20)), float(ty.get('cps', 20))
            t = float(e['t']); g = float(e.get('gain_db', 0)); pan = float(e.get('pan', 0))
            next_space = int(rng.integers(5, 7))
            for i in range(chars):
                is_space = (i + 1) == next_space
                if is_space:
                    next_space = i + 1 + int(rng.integers(5, 7))
                name = 'key_space' if is_space else 'key'
                out.append({'t': t, 'sfx': name, 'gain_db': g, 'pan': pan})
                t += (1.0 / cps) * (1 + rng.uniform(-0.25, 0.25))
        else:
            out.append(e)
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    tl = json.load(open(sys.argv[1]))
    dur = float(tl['duration'])
    N = int(round(dur * SR))
    rng = np.random.default_rng(1234)
    mix = np.zeros((N, 2))

    # music
    mus = tl.get('music')
    if mus and mus.get('file'):
        m = read_wav(resolve(mus['file']))
        buf = np.zeros((N, 2)); k = min(N, len(m)); buf[:k] = m[:k]
        gain = np.full(N, db(float(mus.get('gain_db', -14))))
        for s, e, d in mus.get('duck', []):
            ramp = int(0.15 * SR)
            s_i, e_i = int(s * SR), int(e * SR)
            env = np.zeros(N)  # 0..1 amount
            a0, a1 = max(s_i - ramp, 0), min(s_i, N)
            if a1 > a0: env[a0:a1] = np.linspace(0, 1, a1 - a0, endpoint=False) if s_i - ramp >= 0 else np.linspace(1 - (a1 - a0) / ramp, 1, a1 - a0)
            env[max(s_i, 0):min(e_i, N)] = 1
            b0, b1 = max(e_i, 0), min(e_i + ramp, N)
            if b1 > b0: env[b0:b1] = np.maximum(env[b0:b1], np.linspace(1, 0, ramp, endpoint=False)[:b1 - b0])
            gain *= db(float(d)) ** env
        mix += buf * gain[:, None]

    # events
    events = expand_events(tl.get('events', []), rng)
    for e in events:
        name = e['sfx']
        g = float(e.get('gain_db', 0))
        if name == 'key':
            name = f'key{int(rng.integers(1, 7))}'
            g += rng.uniform(-1.5, 1.5)
        elif name == 'key_space':
            g += rng.uniform(-1.0, 1.0)
        s = load_sfx(name)
        pan = float(np.clip(e.get('pan', 0.0), -1, 1))
        th = (pan + 1) * np.pi / 4
        # balance: pan stereo samples with equal-power gains (centre = unity)
        gl, gr = np.cos(th) * np.sqrt(2), np.sin(th) * np.sqrt(2)
        i0 = int(round(float(e['t']) * SR))
        if i0 >= N or i0 + len(s) <= 0:
            continue
        a = max(0, -i0); b = min(len(s), N - i0)
        seg = s[a:b] * db(g)
        mix[i0 + a:i0 + b, 0] += seg[:, 0] * gl
        mix[i0 + a:i0 + b, 1] += seg[:, 1] * gr

    # master: soft clip above knee, then hard-guarantee <= -1 dBFS
    knee = 0.6; ceil = db(-1.0)
    a = np.abs(mix)
    over = a > knee
    sc = np.where(over, knee + (ceil - knee) * np.tanh((a - knee) / (ceil - knee)), a)
    mix = np.sign(mix) * sc
    p = np.max(np.abs(mix))
    if p > ceil:
        mix *= ceil / p
    write_wav(sys.argv[2], mix)
    print(f'wrote {sys.argv[2]}: {dur}s, {len(events)} events, peak {20*np.log10(max(np.max(np.abs(mix)),1e-9)):.2f} dBFS')


if __name__ == '__main__':
    main()
