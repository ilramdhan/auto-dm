# audio/

Numpy-only (no scipy) audio toolkit. All output is 48 kHz / 16-bit stereo WAV.

- `dsp.py` – shared helpers (WAV IO, FFT filters, state-variable band-pass).
- `make_sfx.py` – synthesizes all one-shots into `sfx/` (peaks ~ -3 dBFS): whoosh, whoosh_fast, whoosh_rev, click, toggle, key1..key6, key_space, key_enter, shutter, pop, pop_hi, ding, success, bass_hit, impact, glitch, riser, swoosh_send, notif.
- `make_music.py [duration=52] [out]` – 110 BPM lo-fi bed (Am7-Fmaj7-Cmaj7-G6) -> `music_bed.wav` (peak -6 dBFS, 0.5 s fade in, 2 s fade out).
- `mix.py timeline.json out.wav` – renders the final soundtrack.
- `demo_timeline.json` – example exercising every SFX.

## Timeline format
```json
{"duration": 52.0,
 "music": {"file": "audio/music_bed.wav", "gain_db": -14, "duck": [[18.0, 30.0, -4]]},
 "events": [
  {"t": 0.1, "sfx": "bass_hit", "gain_db": 0, "pan": 0.0},
  {"t": 0.5, "sfx": "key", "gain_db": -6},
  {"t": 18.5, "typing": {"chars": 120, "cps": 22}, "gain_db": -8}
 ]}
```
- `sfx`: a name from `sfx/` (without `.wav`); `"key"` picks a random key1..key6 (seeded, +-1.5 dB).
- `typing` expands to key sounds at `cps` with +-25% jitter and a `key_space` every 5-6 chars (deterministic).
- `pan` in [-1, 1]; `gain_db` defaults to 0.
- `duck`: `[start, end, extra_db]` lowers the music with 150 ms ramps.
- Master gets a soft clip and is capped at -1 dBFS; output is exactly `duration` seconds.
- Music path is resolved as given, else relative to the repo root.
