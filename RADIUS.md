# Radius — agent contract (v0.1 local)

Learn this file. Emit a ` ```radius ` fence (or JSON). Pin the script version — never `@latest`.

## Quickstart

```html
<script type="module" src="../dist/radius.js"></script>
<pre class="radius">
theme: paper
template: process
title: Hello
nodes:
  a[Start]
  b[Done]
edges:
  a --> b
</pre>
```

## Document shape

Meta keys (optional unless noted):

| key | values | default |
| --- | --- | --- |
| `theme` | paper night ios material esri aws azure gcp oci k8s nutanix **neon** | paper |
| `template` | deck process hub sequence hierarchy flow bars gis cloud k8s nkp | flow |
| `frame` | slide system | slide |
| `look` | flat elevated perspective | elevated (**perspective** when `theme: neon`) |
| `motion` | tasteful none bold | tasteful |
| `font` | system modern display | modern |
| `ground` | … circuit **chip** … | from template (`chip` when `theme: neon`) |
| `title` | string | — |

### nodes

```
id[Label]{kind:azure.hci}
```

### edges

```
a --> b
a --> b: label
```

### groups

```
groups:
  src[On-prem Azure HCI]{family:azure members:hci arc collapsed:true}
  dst[Nutanix]{family:nutanix members:nci nkp collapsed:true}
```

One board `theme` only. Group `family` tints header/border; kinds color chips.

**Expand / collapse (Eraser-like):** `collapsed:true` starts folded. Click the group header to expand — children **appear one-by-one** (same stagger as mount appear). Click again to collapse. Use for sequential or hierarchical teaching flows.

### story

```
story:
  expand src
  focus hci arc
  expand dst
  collapse src
  replace hci with nci
```

ArrowLeft / ArrowRight on the board steps the story. `expand` / `collapse` drive foldable groups.

## Themes (multi-vendor)

Use **one** theme for the diagram. Prefer `paper` for Azure HCI → Nutanix migration; use `family:` on groups.

### `neon` — isometric neon tech (AI-infographic look)

Dark void, cyan / amber / violet glow, converging circuitry into a 2.5D chip (`ground: chip` by default). Board/ground stays **axis-aligned**; nodes/groups get isometric tilt when `look: perspective` (neon default). Neon edges. Same aesthetic people mean by cyber-neon / isometric HUD / synthwave circuit.

```
theme: neon
template: hub
title: Inference path
nodes:
  chip[Model]
  api[API]
  ui[App]
edges:
  api --> chip
  chip --> ui
```

## Errors

Parse failures are JSON-shaped: `{ "path", "fix", "see": "RADIUS.md#…" }` for agent retries.

## Version

`Radius.version` is `0.1.0` until the first tagged `1.0.0` release.
