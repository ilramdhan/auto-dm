#!/usr/bin/env bash
# usage: audio/process_vo.sh <input> <output.wav> [extra ffmpeg -af prefix, e.g. trims]
# Voice chain: cut rumble + boxy low-mids (phone proximity effect), add presence/air,
# gentle compression, loudness normalize. No aggressive denoise (it dulls the voice).
set -e
IN="$1"; OUT="$2"; PRE="${3:+$3,}"
ffmpeg -v error -y -i "$IN" -af "${PRE}highpass=f=100:poles=2,\
equalizer=f=220:t=q:w=1.0:g=-5,\
equalizer=f=450:t=q:w=1.2:g=-2,\
equalizer=f=3500:t=q:w=1.0:g=5,\
highshelf=f=7000:g=4,\
afftdn=nr=6:nf=-40,\
acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=2dB,\
loudnorm=I=-16:TP=-2:LRA=9" -ar 48000 -ac 2 "$OUT"
