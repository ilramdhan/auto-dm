# Reels: Rapikan Google Drive dengan Claude

- `output/reels-drive-claude.mp4` — video final 1080×1920, 30 fps, 77 detik, H.264 + AAC
- `prompts/drive-organizer-prompt.md` — prompt lengkap (untuk DM) + versi singkat di video
- `docs/setup-instagram-comment-auto-dm.md` — setup auto-DM saat ada komen "DRIVE"
- `docs/voice-over-script.md` — naskah voice over

## Build ulang
```bash
node video/build_audio.js                                   # SFX timeline dari video/timeline.js
python3 audio/make_music.py 77 audio/music_bed.wav
python3 audio/mix.py audio/timeline.json audio/sfx_music.wav
# VO: potong 0.8 s di awal, sisipkan 5.5 s hening di 46.6 s (scene analisis), lalu mix -> audio/final_mix.wav
node video/render.cjs seg.mp4 60 <t0> <t1>                  # render frame 60 fps (Playwright)
# concat segmen -> tmix=frames=2,fps=30 (motion blur) + mux audio
```
Pratinjau safe zone: buka `video/scene.html?guides&t=30` di Chrome.
Safe zone: konten di x 72–952, y 250–1470 (aman dari top bar, caption/profil, dan tombol like/komen/share).
