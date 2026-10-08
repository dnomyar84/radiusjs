# Radius

**R**aymond's **A**gentic **D**iagramming **U**nified **S**ystem — AI-native diagrams (HTML5). Agents learn [RADIUS.md](RADIUS.md), emit ` ```radius `, you pin a versioned script.

## Local preview

```powershell
.\npm.cmd test
.\serve.ps1
```

Open [http://127.0.0.1:8765/demos/](http://127.0.0.1:8765/demos/) — categorized left nav, diagram-first stage, and a **styling playground** (`#/playground`).

Portable Node + MinGit live under `.tools/` (gitignored). Use project wrappers:

```powershell
.\node.cmd -v
.\npm.cmd test
.\git.cmd status
.\gh.cmd auth status
```

## GitHub Pages

Live gallery: [https://dnomyar84.github.io/radiusjs/](https://dnomyar84.github.io/radiusjs/) (redirects to `/demos/`).

Pages publishes the repo root on `main`. `.nojekyll` keeps the files static. Deep links: `#/demo/20-mindmap`, `#/playground`.

## Agent 30-second path

1. Read `RADIUS.md`
2. Write a fence (see demos for snippets)
3. Load `dist/radius.js` as `type="module"` (auto-mounts `pre.radius`)

## Status

Local **0.5.0** — drill-in (C/L/P + timeline), layout omit/hints, label packing, optional elkjs. Examples are on GitHub Pages. `1.0.0` tag later.

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
