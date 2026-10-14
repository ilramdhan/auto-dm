# Accessibility

We aim for **WCAG 2.2 level AA** across the dashboard.

## Practices

- Semantic landmarks (`header`, `nav`, `main`), a skip-to-content link and a logical heading order.
- Built on accessible Radix/shadcn primitives (dialogs trap focus, menus are keyboard navigable).
- Every form control has a visible `<Label>`; errors are announced and linked with `aria-describedby`.
- Visible focus indicators; everything operable by keyboard; touch targets at least 24x24 CSS px.
- Contrast of at least 4.5:1 for text in light and dark themes; status never conveyed by colour alone.
- `prefers-reduced-motion` is respected; layouts reflow down to 320px and zoom to 200%.
- Toasts and live regions use polite announcements.

## Testing

Keyboard-only pass, a screen reader spot check (NVDA/VoiceOver), and automated checks (axe) for new UI.

## Reporting problems

Open an issue with the "Accessibility" mention, or email me@ilramdhan.dev. Include page, browser,
assistive technology and what you expected. We aim to respond within 7 days.
