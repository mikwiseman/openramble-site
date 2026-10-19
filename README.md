# openramble-site

The English website for [OpenRamble](https://github.com/mikwiseman/openramble).
One hand-written `index.html` with inline CSS and JavaScript. No build step, no
framework, no analytics, no third-party requests: Manrope is self-hosted from
`fonts/` (SIL Open Font License, `fonts/Manrope-OFL.txt`).

Preview locally:

```bash
python3 -m http.server 8000
```

The app's Sparkle feed stays at `mikwiseman.github.io/openramble` and is not
served from here.

## When something ships

Each unreleased item is tagged `<span class="soon">coming soon</span>`, and
features also carry `data-soon`. Delete both when it ships.

| Item | Where in `index.html` |
|---|---|
| Clean Verbatim | features list. The headline and hero demo also describe it: publish the site only after it ships |
| As spoken | features list |
| "Send it." | features list |
| Shift for English | features list |
| Homebrew cask | hero, the `brew install` line |
| Public scorecard | replaces the benchmark table (`SCORECARD` comment) |
| Stable DMG URL | download links point at `releases/latest` for now |

## Before publishing

- `CNAME` and the canonical and `og:` URLs say `openramble.app`, a placeholder
  until the domain is bought.
- The benchmark link points at `research/product-benchmark-2026-10` on `main`
  of the openramble repo. That folder must be merged there first.
