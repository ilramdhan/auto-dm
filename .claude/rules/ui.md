# UI rules

- Server components by default; `"use client"` only for interactivity.
- Forms: react-hook-form + Zod resolver sharing the schema in `src/lib/validation`; server action re-validates.
- Feedback via sonner toasts plus inline errors (`aria-describedby`); destructive actions use a confirm dialog.
- Status badges always carry text, not just colour.
- Dialogs/sheets need a title; icon-only buttons need `aria-label`.
- Test at 320px width, keyboard-only, and dark mode.
