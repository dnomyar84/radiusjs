# Radius

Radius is an open-source diagramming system for AI agents. An agent writes a short text diagram. Radius lays it out, paints it, and keeps it interactive in the browser.

The name expands to **R**aymond's **A**gentic **D**iagramming **U**nified **S**ystem. The product is one language and one HTML5 renderer, shared by every template: architecture, process, timeline, map, mind map, and relationship cloud.

## What it is for

Agents are asked to show structure: a landing zone, a migration, a license model, a delivery flow. Radius is the contract and the engine for that work.

- **One language.** A `radius` fence, or the same document as JSON. [RADIUS.md](RADIUS.md) is the spec an agent learns, at the same version as the script.
- **Layout stays in the engine.** With only nodes and edges, the board packs itself. A template or soft hints (`rank`, `lane`, `order`) steer the shape when the story needs one. The parser rejects coordinates and raw CSS.
- **One canvas, many reads.** Flow, deck, cloud, Kubernetes, GIS, timeline, mind map, and a 3D constellation share themes, icons, fold, and story.
- **Open source, pinned.** MIT. You copy `dist/radius.js` from a fixed commit of this repository. The contract forbids a floating `@latest` URL.

## Quick start

```html
<script type="module" src="./dist/radius.js"></script>
<pre class="radius">
title: Hello
nodes:
  a[Start]
  b[Done]
edges:
  a --> b
</pre>
```

`dist/radius.js` mounts every `pre.radius`, `[data-radius]`, and `code.language-radius` on the page. This repository is **0.5.0**. Load that file from a fixed commit. On a bad document, the runtime returns `{ path, fix, see }` so the agent can repair against [RADIUS.md](RADIUS.md).

## What a document can say

| You write | Radius does |
| --- | --- |
| Nodes, edges, groups | Default `flow` layout on a 16:9 board |
| `template` | `deck`, `process`, `hub`, `sequence`, `hierarchy`, `flow`, `bars`, `gis`, `cloud`, `k8s`, `nkp`, `timeline`, `mindmap`, `constellation` |
| `theme`, `ground`, `look`, `motion` | Paper, night, indigo, neon, and vendor palettes; grounds from a wash to a world map |
| `kind` | AWS, Azure, and Esri-family chips. Glyphs in this repo are original MIT drawings, not vendor logos |
| `parent`, `collapsed`, `story` | Drill from a face into children; play expand, focus, wire filters, and replace |
| `engine: auto` | Graph templates may use [elkjs](https://github.com/kieler/elkjs) 0.9.3; otherwise native packers |

Keys, shapes, and story verbs: [RADIUS.md](RADIUS.md).

## Examples

The gallery in [`demos/`](demos/) is static HTML. Open `demos/index.html`, or serve the repository and visit `/demos/`.

- **Styling playground** — themes and grounds on a live board (`#/playground`)
- **Architecture** — drill-in, ArcGIS Enterprise, delivery lanes
- **Cloud and platform** — AWS, Azure, Nutanix
- **GIS and Esri** — maps, named users, org charts
- **Narrative and time** — deck slide, cutover story, timeline
- **Layout** — constellation, mind map, expand, layout hints

Deep link example: `#/demo/20-mindmap`.

## Develop

Node 20 or newer.

```bash
npm ci
npm test
```

`npm test` covers parse, layout, kinds, fold, regressions, and the gallery catalog.

On Windows, portable wrappers expect a gitignored `.tools/` directory:

```powershell
.\npm.cmd test
.\serve.ps1
```

`serve.ps1` serves the repository at http://127.0.0.1:8765/demos/. Any static file server rooted at the repository does the same job.

## Status

**0.5.0.** Public source under MIT. Consume `dist/radius.js` and `dist/radius.css` from this repository. npm publication is a later step (`private` in `package.json`). Icon art and the world-map ground carry separate licenses — see [NOTICE](NOTICE).

## License

[MIT](LICENSE) © 2026 Raymond Huang.
