"""Tiny numpy-only DSP helpers (no scipy)."""
import wave
import numpy as np

SR = 48000


def write_wav(path, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = np.nan_to_num(np.clip(x, -1.0, 1.0))
    pcm = np.round(x * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def read_wav(path):
    with wave.open(str(path), 'rb') as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    assert sw == 2 and sr == SR, f"{path}: expected 48k 16-bit"
    a = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    a = a.reshape(-1, ch)
    if ch == 1:
        a = np.repeat(a, 2, axis=1)
    return a[:, :2]


def db(x):
    return 10 ** (x / 20.0)


def fft_filter(x, resp_fn):
    """Zero-phase filtering: resp_fn(freqs)->magnitude."""
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + 1)))
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    return np.fft.irfft(X * resp_fn(f), N)[:n]


def lowpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, lo, hi, order=2):
    return highpass(lowpass(x, hi, order), lo, order)


def svf_bandpass(x, fc, q=2.0):
    """Time-varying state-variable band-pass. fc: scalar or array (Hz)."""
    n = len(x)
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    g = 2 * np.sin(np.pi * np.minimum(fc, SR * 0.45) / SR)
    k = 1.0 / q
    out = np.zeros(n)
    lp = bp = 0.0
    xl = x.tolist(); gl = g.tolist()
    for i in range(n):
        hp = xl[i] - lp - k * bp
        bp += gl[i] * hp
        lp += gl[i] * bp
        out[i] = bp
    return out * k  # roughly unity gain at centre


def fade(x, fin=0.003, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        x[:a] *= np.linspace(0, 1, a).reshape((-1,) + (1,) * (x.ndim - 1))
    if b > 0:
        x[-b:] *= np.linspace(1, 0, b).reshape((-1,) + (1,) * (x.ndim - 1))
    return x


def normalize(x, peak_db=-3.0):
    p = np.max(np.abs(x))
    return x * (db(peak_db) / p) if p > 0 else x


def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def pan_stereo(mono, pan):
    """pan scalar or array in [-1,1] (equal power) -> (n,2)."""
    p = np.broadcast_to(np.asarray(pan, dtype=float), mono.shape)
    th = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], axis=1)
