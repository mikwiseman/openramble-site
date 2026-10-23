# OpenRamble website

The English website for [OpenRamble](https://github.com/mikwiseman/openramble):
[mikwiseman.github.io/openramble-site](https://mikwiseman.github.io/openramble-site/).

Proof uses letterpress type and proofreading marks to demonstrate Clean Verbatim.
Static HTML, CSS and JavaScript; no build step, framework, analytics or third-party
requests. Artwork and textures live in `assets/`. Fonts are self-hosted under
`fonts/`, with their SIL Open Font License files.

Preview locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

GitHub Pages publishes `main` from the repository root. Push changes, wait for the
Pages deployment to succeed, then check the live page and its hold/release demo.
The site uses relative asset URLs so it also works under the repository subpath.

The Russian page remains at [waiwai.is/ramble](https://waiwai.is/ramble).
The app's Sparkle feed stays at `mikwiseman.github.io/openramble`; it is not served
from this repository. Downloads link to the app's latest GitHub release.
