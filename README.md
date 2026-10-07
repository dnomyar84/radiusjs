# Radius

**R**aymond's **A**gentic **D**iagramming **U**nified **S**ystem — AI-native diagrams (HTML5). Agents learn [RADIUS.md](RADIUS.md), emit ` ```radius `, you pin a versioned script.

## Examples

The gallery is static HTML. Open [`demos/index.html`](demos/index.html). The repository root redirects there.

- Playground: `demos/#/playground`
- A diagram: `demos/#/demo/20-mindmap`

On Cloud Agents, open that file. Do not start a static server.

GitHub Pages, if enabled from the repository root (there is no `/docs` folder):

- https://dnomyar84.github.io/radiusjs/demos/
- https://dnomyar84.github.io/radiusjs/demos/#/playground
- https://dnomyar84.github.io/radiusjs/demos/#/demo/20-mindmap

Windows local preview only, optional:

```powershell
.\serve.ps1
```

That serves http://127.0.0.1:8765/demos/

## Agent 30-second path

1. Read `RADIUS.md`
2. Write a fence (see demos for snippets)
3. Load `dist/radius.js` as `type="module"` (auto-mounts `pre.radius`)

## Status

Local **0.5.0** — drill-in (C/L/P + timeline), layout omit/hints, label packing, optional elkjs. GitHub publish + `1.0.0` tag later.

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
