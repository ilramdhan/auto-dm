#!/usr/bin/env bash
# usage: audio/process_vo.sh <input> <output.wav> [extra ffmpeg -af prefix, e.g. trims]
# Voice chain tuned on spectrum measurements so the voice isn't boomy/heavy:
# steep rumble cut (<110 Hz), tame proximity/boxy low-mids, add presence + air,
# light denoise, gentle compression, loudness normalize.
set -e
IN="$1"; OUT="$2"; PRE="${3:+$3,}"
ffmpeg -v error -y -i "$IN" -af "${PRE}highpass=f=110:poles=2,highpass=f=110:poles=2,\
lowshelf=f=180:g=-4,\
equalizer=f=280:t=q:w=1.1:g=-3,\
equalizer=f=3200:t=q:w=1.0:g=5,\
highshelf=f=6500:g=4,\
afftdn=nr=6:nf=-45,\
acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=2dB,\
loudnorm=I=-16:TP=-2:LRA=9" -ar 48000 -ac 2 "$OUT"
