# Testing rules

- Vitest; colocate unit tests or use `tests/`. Pure modules (match, template, signature, payload parsing) must be covered.
- Matcher tests: case/diacritics, emoji, word boundaries, mode differences, empty keywords.
- Use fixtures with fake ids/tokens; never commit real Meta payloads containing user data.
- DB integration tests use `TEST_DATABASE_URL` and clean up their rows; skip gracefully when unset locally.
- Mock `fetch` for Graph API; assert retry on 429/5xx and no retry on 4xx.
- Run `pnpm check` before declaring work done.
