# Prompt: Rapikan Google Drive dengan Claude

> Dipakai di **Claude in Chrome** (side panel) saat tab `drive.google.com` terbuka,
> dengan **Google Drive connector** sudah terhubung di Claude.

## Versi lengkap (kirim ini via DM)

```
Hi Claude, I want you to organize my Google Drive. Work in 3 phases and
STOP after phase 2 until I approve.

SCOPE
- Scan the folder I have open (or the whole "My Drive" if I'm at the root),
  recursively — every subfolder down to the deepest file.
- Read file names, types, dates, sizes, and peek at content when the name
  is unclear (e.g. "Untitled", "IMG_2021…", random numbers).

PHASE 1 — AUDIT (read-only)
- Inventory: total folders, total files, loose files at root.
- Group files by theme (personal, identity docs, education, certificates,
  career, projects/code, backups, photos/media, design assets, etc.).
- Flag:
  • DUPLICATES — same name, "(1)/(2)/Copy of", or same size+type. Show
    which copy you'd keep and why (newest / largest / original).
  • UNIDENTIFIED — files you can't confidently classify.
  • UNTITLED — "Untitled document/spreadsheet" files.
  • EMPTY folders.
  • SENSITIVE — KTP/ID, passwords, recovery codes, payslips, SSL keys.
    Put these under a restricted "00 Private" folder.
  • SUSPICIOUS — anything that looks unsafe or not mine.

PHASE 2 — PLAN (show me, don't move yet)
- Propose a numbered folder structure (00 Private, 01 Personal,
  02 Education … 99 Archive & To Review) with max 3 levels deep.
- Show it as a tree + a table: file → current path → new path → reason.
- Show a before/after summary (counts) and a Mermaid diagram.
- Leave Google-managed folders (Colab Notebooks, Google AI Studio,
  app backups) at the root.
- Ask me every question you have BEFORE executing.

PHASE 3 — EXECUTE (only after I reply "APPROVED")
- Create folders, then MOVE files according to the approved plan.
- NEVER delete, trash, rename the contents of, or overwrite anything.
  Duplicates/unknowns go to "99 Archive & To Review", not the trash.
- Work in batches and log every move (file, from, to) so it's reversible.
- At the end, report: moved count, skipped items + reason, and anything
  that still needs my decision.

HOW TO WORK
- Use sub-agents, chosen dynamically to save tokens and context:
  • Sonnet → light tasks: listing folders, reading metadata, moving files
    in batches, simple classification.
  • Opus → medium/heavy tasks: designing the structure, resolving
    duplicates, classifying ambiguous files, final review.
- Keep each sub-agent's report short; the main thread only keeps the
  summary.

If anything is unclear, ask me first.
```

## Versi singkat (yang tampil di video)

```
Hi Claude, review this Drive/folder recursively down to the deepest file.
1. Suggest a folder structure based on my files.
2. Flag possible duplicates & anything you can't identify.
3. Show me the plan BEFORE moving anything.
⚠ DON'T DELETE ANYTHING. Ask me if you have questions.
Use sub-agents: Sonnet for easy tasks, Opus for medium–heavy tasks
to save tokens & context.
```
