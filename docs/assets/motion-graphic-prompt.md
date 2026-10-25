# Prompt: AutoDM motion graphic

Copy everything below the line into a new AI session (a video/motion tool, or an AI that writes
Remotion / After Effects / Lottie scripts). It is version-agnostic on purpose: no release
numbers, dates or prices, so the same video can be posted again and again.

---

## Role

You are a senior motion designer and storyteller. Create a **45–60 second explainer motion
graphic** for **AutoDM**, an open-source app that automatically replies to Instagram comments
and sends a DM when someone comments a keyword. Deliver a shot-by-shot storyboard with exact
on-screen text, voice-over (VO) lines, timing, transitions and animation notes, then produce the
animation (or code for it, e.g. a Remotion composition) if your tool supports it.

## Story in one sentence

A creator who was tired of paying for limited third-party tools that keep their audience's data
on someone else's servers built their own tool, and made it **free, open source, unlimited and
self-hosted** for everyone.

## Hard rules

- **Never show a version number, release date, price of AutoDM, or "new"/"just launched".** The
  video must stay evergreen.
- Use only **fake** data: account `@yourbrand`, commenters like `@nadia.notes`, `@intan.ideas`,
  `@kira.knits`; domain `autodm.example.com`. No real people, faces, or real Instagram UI
  screenshots. Use **stylised** phone and post mockups instead. No Instagram or Meta logos: say
  "Instagram" in text only, and add the small disclaimer from scene 10.
- Don't claim things the app doesn't do. It works with **Instagram professional (Business or
  Creator) accounts**. It sends **one private reply per comment, within 7 days**. DMs are **up
  to 1000 characters**. It does not send cold DMs to people who didn't comment.
- Accessible: on-screen captions for every VO line, contrast at least 4.5:1, no rapid flashing,
  and text on screen for at least 1.5 s per line.

## Brand

- **Name:** AutoDM. **Tagline:** "Comment a keyword on Instagram, get a public reply and a DM
  automatically. Free, self-hosted, open source."
- **Icon:** a rounded-square app icon with a gradient from orange (#F97316) to pink (#EC4899) to
  violet (#6D28D9), and a white speech bubble with a "reply" arrow inside.
- **UI style:** clean shadcn-like dashboard; white or near-black background; violet primary
  (#6D28D9); green for "Sent", grey for "Skipped", red for "Failed". Each badge always pairs an
  icon with its text.
- **Type:** a geometric sans such as Inter or Geist. Bold headlines, regular body.
- **Mood:** calm frustration turning into relief and empowerment. Friendly, not corporate.
- **Music:** lo-fi or soft electronic. Start minimal and tense, build after the turn (scene 4),
  and resolve warmly at the end. Add soft UI "pop" and "whoosh" SFX on actions.

## Formats

Make a **9:16 (1080×1920)** master for Reels, TikTok and Shorts, with a safe area for platform
UI: keep text away from the top 220 px and the bottom 380 px. Also describe how to reframe it to
**1:1** and **16:9**. Language: **Bahasa Indonesia VO with English on-screen keywords**, plus an
alternate **English VO** track.

## Storyboard

### 1. Hook: the problem (0–5 s)

- **Visual:** a phone fills the screen. Comment notifications pile up ("info dong", "mau",
  "link?", "harga?") faster and faster, and the creator's tiny avatar gets buried.
- **On-screen:** "100 comments. 100 DMs to send. By hand?"
- **VO (ID):** "Satu postingan viral, ratusan komentar minta link. Balas satu-satu? Capek."
- **VO (EN):** "One post goes viral. Hundreds ask for the link. Reply one by one? Exhausting."

### 2. The usual fix, and its catch (5–11 s)

- **Visual:** three generic, unbranded "Auto-DM SaaS" cards slide in. Each grows a padlock and a
  meter: "Monthly subscription", "Limit: 1,000 DMs/month", "Upgrade to unlock". A meter fills to
  red.
- **On-screen:** "Subscriptions. Limits. Paywalls."

### 3. The hidden cost: your data (11–15 s)

- **Visual:** the commenters' avatars and messages flow out of the phone as small data packets,
  into a distant server cloud labelled "someone else's database". The packets scatter.
- **On-screen:** "And your audience's data? Stored on their servers."
- **VO (ID):** "Data audiens kita tersebar di database orang lain."

### 4. The turn (15–19 s)

- **Visual:** a beat of silence, then a cursor opens a code editor and the AutoDM icon assembles
  from code brackets with a soft glow. The music lifts.
- **On-screen:** "So I built my own." → "**AutoDM**"
- **VO (ID):** "Jadi saya bikin sendiri, dan saya buka untuk semua orang."

### 5. The promise (19–23 s)

- **Visual:** four pill badges pop in one after another, each with an icon: **Free** · **Open
  source (MIT)** · **Unlimited** · **Your own database**. The scattered data packets from scene 3
  fly back and lock into a small database icon labelled "yours".
- **On-screen:** "Free. Open source. Unlimited. Your data stays yours."

### 6. How it works: setup (23–31 s)

Show three quick steps as numbered cards connected by an animated line:

1. **Deploy:** a "Deploy" button, then a progress bar, then a check. Caption: "Deploy your own
   copy (Vercel + Supabase, or Docker)."
2. **Connect Instagram:** a "Connect Instagram" button, then a permission sheet with three
   checkmarks, then the status "@yourbrand connected".
3. **Create a campaign:** the campaign editor. Type the keyword **"mau"**, add a public reply
   ("Cek DM ya, {username}! 💌") and a DM message ("Hai {username}, ini link-nya: …"). The
   `{username}` and `{keyword}` variables highlight. Toggle "All posts" or pick a specific reel.
   Press **Save**.

- **VO (ID):** "Deploy sekali, hubungkan Instagram, lalu buat kampanye: pilih kata kunci, tulis
  balasan dan DM-nya."

### 7. The magic moment: the comment flow (31–43 s)

This is the hero scene; give it the most polish. Use a split view: the phone on the left, a
simplified flow diagram on the right that lights up step by step.

1. A follower, `@nadia.notes`, types the comment **"mau 🙏"** under a reel and taps send.
2. A pulse travels from the phone to the cloud, labelled **"Instagram webhook"**. The flow
   diagram lights up: **Verify signature** (shield check) → **Match keyword "mau"** (the keyword
   chip glows).
3. A **public reply** appears under her comment, written by `@yourbrand`: "Cek DM ya,
   @nadia.notes! 💌". Pop SFX.
4. Her phone's DM icon gets a badge, and the **DM** slides in: "Hai @nadia.notes, ini link-nya:
   autodm.example.com/guide 🎁". Pop SFX.
5. A small timer reads "~2 seconds".
6. Repeat quickly two more times in a mini grid with other fake commenters, to show it's
   automatic and unlimited.

- **On-screen:** "Comment → Public reply → DM. Automatically."
- **VO (ID):** "Begitu ada yang komen kata kuncinya, AutoDM langsung balas komentarnya dan kirim
  DM. Otomatis, dalam hitungan detik."

### 8. Proof: activity and analytics (43–51 s)

- **Visual:** zoom out from the phone into the AutoDM dashboard.
  - Stat cards count up: "Comments today", "DMs sent", "Failed", "Skipped".
  - A 14-day line chart (Comments vs DMs sent) draws itself.
  - The Activity list fills with rows: `@nadia.notes · mau · ✓ Sent`, `@intan.ideas · guide ·
    ✓ Sent`, `@omar.sketches · ⊖ Skipped (no match)`.
  - A cursor clicks **Analytics**: per-campaign and per-post tables, an outcome donut chart, and
    a "Download CSV" button pulses.
- **On-screen:** "See every comment, every DM, every result."

### 9. Trust details (51–55 s)

Show a fast montage of small icon and label pairs, about 0.6 s each:
- "Self-hosted"
- "Secrets encrypted"
- "Once per user"
- "Data retention you control"
- "Light & dark mode"
- "Installable app"
- "n8n-ready"

### 10. Closing banner (55–60 s)

- **Visual:** the AutoDM icon and wordmark sit centred on a soft gradient background, with the
  tagline below. Under it are three pills, "Open source · MIT", "Self-hosted" and "n8n ready",
  and a thin orange→pink→violet gradient bar. This mirrors the project banner.
- **CTA text:** "Free & open source. Get it on GitHub: **github.com/ilramdhan/autodm**"
- **Footer line:** "Made with ♥ in Indonesia"
- **Disclaimer:** "Not affiliated with Meta or Instagram." Use small text in the bottom-right.
- **VO (ID):** "AutoDM. Gratis, open source, tanpa batas. Cek di GitHub."
- Hold the last frame for 1.5 s so it can loop cleanly into scene 1.

## Animation notes

- **Easing and transitions:** spring or ease-out on entrances (about 250–400 ms) and ease-in on
  exits. Use match cuts between scenes: a notification becomes a data packet, which becomes a
  webhook pulse.
- **Kinetic type:** keywords like **"mau"**, **Free** and **Unlimited** scale in with a slight
  overshoot.
- **Restraint:** no more than 2 moving focal points at once, so viewers know where to look.
- **Deliverables:**
  1. a storyboard table: scene, time, visual, on-screen text, VO (ID/EN), SFX/music, transition;
  2. a style frame description for scenes 1, 5, 7 and 10;
  3. the animation itself or code for it (Remotion/AE expressions/Lottie JSON), with all text in
     a single config object so it can be translated or edited;
  4. caption files (`.srt`) for ID and EN.
