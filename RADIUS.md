# Radius — agent contract (v0.5)

Learn this file. Emit a ` ```radius ` fence (or JSON). Pin the script version — never `@latest`.

## Quickstart

```html
<script type="module" src="../dist/radius.js"></script>
<pre class="radius">
title: Hello
nodes:
  a[Start]
  b[Done]
edges:
  a --> b
</pre>
```

Omit `template` — engine defaults to `flow` and auto-layouts. Never emit `x` / `y` / `font-size`.

## Layout (omit → coarse → hints)

| Tier | Write | Engine |
| --- | --- | --- |
| **0 omit** | nodes / edges / groups / story only | Auto-layout (`template: flow`) |
| **1 coarse** | `template:` (+ optional `dir: lr\|rl\|tb\|bt`) | Algorithm family |
| **2 hints** | `rank`, `order`, `lane`, `span` on nodes | Soft constraints |
| **Forbidden** | `x`, `y`, `font-size`, CSS | Repair error → `RADIUS.md#layout` |

```radius
# Tier 0
title: Simple
nodes:
  a[Start]
  b[Done]
edges:
  a --> b
```

```radius
# Tier 2
template: flow
dir: lr
engine: auto
nodes:
  edge[Edge]{rank:0 lane:data}
  core[Core]{rank:1 lane:data}
  ctrl[Control]{rank:2 lane:control}
edges:
  edge --> core
  core --> ctrl
```

`engine: auto` (default) uses **elkjs** for graph templates when available, else native packers. `engine: native` forces Radius packers. `engine: elk` requires elkjs.

The board is a fixed slide canvas (host width × 16:9 by default). Expand/collapse **re-packs into that canvas**; if content still overflows, Radius **keeps shrinking** (uniform fit-scale + translate) until the diagram fits in view — it does not grow the viewport.

Fold motion: expand/collapse uses a short **FLIP** morph (collapsed face grows into the new box) then staggered child fade-in. `motion: none` or `prefers-reduced-motion` skips it.

**Zoom:** double-click an **expanded** group’s body (not the face/label — that still expands/collapses) to zoom the board to that parent. Zoom back out via the **Zoom out** control, `Esc`, double-click the same body again, or double-click empty board.

Graph geometry is delegated to [elkjs](https://github.com/kieler/elkjs) (EPL-2.0) — see NOTICE. Timeline / deck / hub stay Radius-native.

## Labels

Agents write **full** labels. Radius fits in this order: **stretch box horizontally** (single line, up to grow max) → **wrap** at full font only after max width is hit (≤2 lines, if height allows) → shrink font (still one line) → shrink with wrap → ellipsis + `title` tooltip. Do not truncate in the fence.

## Document shape

| key | values | default |
| --- | --- | --- |
| `theme` | paper night **indigo** ios material esri aws azure gcp oci k8s nutanix **neon** | paper |
| `template` | deck process hub sequence hierarchy flow bars gis cloud k8s nkp **timeline** **mindmap** **constellation** | flow |
| `dir` | lr rl tb bt | lr (flow/timeline); **tb** stacks cloud root groups top→bottom |
| `engine` | auto elk native | auto |
| `route` | **ortho** · **curve** · **straight** | ortho; **mindmap** defaults to **curve** |
| `frame` | slide system | slide |
| `look` | flat elevated perspective | elevated |
| `motion` | tasteful none bold | tasteful |
| `font` | system modern display | modern |
| `ground` | none solid wash vignette grid dots matrix circuit **chip** mesh hex **aurora** roads helix **hatch** contour parcels globe globe-horizon globe-corner **worldmap** | from template |
| `glass` | **frost** solid none | frost |
| `wires` | **all** / on · **off** / none · or wire names (`flow trust`) | all |
| `title` | string | — |

Prefer a ground that fits the story (GIS → `parcels` / `contour` / `roads` / **`worldmap`**; neon energy → `chip`; timeline → `grid`). Tone defaults muted; neon uses strong. `glass: frost` (default) gives elements a frosted card so busy grounds do not show through; use `glass: solid` for opaque cards.

### nodes

```
id[Label]{kind:azure.hci layer:logical rank:1 lane:data parent:sys collapsed:true}
```

| attr | meaning |
| --- | --- |
| `kind` | chip family |
| `shape` | face geometry — see [Shapes](#shapes) |
| `layer` | `conceptual\|logical\|physical` or `year\|half\|quarter\|month\|week\|day` |
| `parent` | expandable parent node id |
| `collapsed` | start folded (parents default collapsed when they have children) |
| `rank` `order` `lane` `span` | layout hints |
| `time` | timeline tick caption |
| `stack` | multiplicity: `true` / `2` / `3` / `4` — duplicate the box down-right to mean “many” |

### edges

```
a --> b
a --> b: label
a --> b{wire:flow}
a --> b: DNS{wire:trust}
portal --> maps: to group exterior
```

Tag edges with `wire:name` to form named **wire groups** (default `main`). Document `wires:` filters which groups paint:

```
wires: off              # conceptual — no lines
wires: flow trust       # only those groups
wires: all              # every edge (default)
```

Story can retoggle without reflow:

```
story:
  wires off
  wires flow
  wires flow trust
  wires all
```

Aliases: `links:`, `showEdges:`, and meta `edges: off` (value must be a toggle / name list — bare `edges:` still opens the edge section).

Endpoints may be **node** or **group** ids. Group id = attach to that box’s **exterior**; node id = attach to the **internal** element. Both can appear in one diagram.

When a child endpoint’s parent (group or expandable node) is **collapsed**, Radius **promotes** the edge to that parent’s face. Expand again and the edge returns to the child. Parent→parent edges stay on the exteriors / faces. Multiple child→child edges that promote to the **same** visible pair collapse to **one** arrow.

### groups

```
groups:
  src[On-prem]{family:azure layer:conceptual members:hci arc collapsed:true}
  compute[Compute]{family:azure parent:src layer:logical members:vms}
  tier[App tier]{family:esri members:portal hosting collapsed:true virtual:true}
```

Collapsed groups render as **element faces** (icon + label), not chrome headers. Click the face to expand.

`virtual:true` — **AWS-style region**: dotted border, soft **pastel backing** (stable per group id), children flow inside. Caption is a small bare uppercase label (no chip). With `glass: frost`, the pastel region is also lightly frosted. Omit `virtual` (or `false`) for a solid expanded card with frosted header strip (no pastel wash).

### story

```
story:
  expand src
  expand all
  wires off
  wires flow
  wires all
  focus hci
  expand y1
  collapse src
  collapse all
  replace hci with nci
```

`expand all` / `collapse all` (also `expand-all`, `collapseAll`) fold every expandable group and node parent in one step.

## Shapes

Node `shape:` sets the face geometry (any template). Default `rect`.

| shape | read as |
| --- | --- |
| `rect` | process / default box |
| `round` | soft process |
| `oval` / `circle` | start / end / terminal |
| `diamond` | decision |
| `parallelogram` | input / output |
| `hex` | preparation / callout |
| `table` | expandable parent whose **children are row elements** |

### Table rows as elements

`shape: table` on a parent (`parent:` children) stacks each child as a **first-class node** — full-width row under the header. Rows keep ids, edges, tips, and further drill (`parent:` on a row). Collapse the table to park rows and **promote** edges to the header face (same fold model as other expandable parents).

```radius
template: flow
nodes:
  matrix[Risk matrix]{shape:table collapsed:false}
  r1[Likelihood]{parent:matrix}
  r2[Impact]{parent:matrix}
  r3[Mitigation]{parent:matrix shape:diamond}
edges:
  upstream --> r2
```

Aliases for `table`: `grid`, `rows`, `tabular`.

### Route

Document `route: curve|ortho|straight` (alias `routing:`). Ortho is the default elbow packer; `curve` uses cubic Béziers (mindmap-friendly). `template: mindmap` defaults to `curve` unless overridden.

## Constellation (3D relationship cloud)

`template: constellation` packs many cross-linked elements into a **3D cloud** (force springs on edges + spherical shell), then projects to the board. Default: slow auto-spin. Drag to orbit, scroll to zoom. Respects `prefers-reduced-motion` and `motion: none` (no spin). Default ground: `aurora`. Edges are straight chords through the cloud (not ortho).

```radius
template: constellation
theme: indigo
title: Capability mesh
nodes:
  id[Identity]
  api[API gateway]
  data[Data lake]
  ml[Models]
  ops[Ops]
  edge[Edge]
  policy[Policy]
edges:
  id --> api
  api --> data
  data --> ml
  ml --> api
  ops --> api
  ops --> edge
  policy --> id
  policy --> api
  edge --> data
```

Use when relationships are dense and non-hierarchical — complementary to flat `mindmap`.

## Mindmap

`template: mindmap` places a root at the center and fans children on rings (explicit `parent:` and/or edge tree). Same expandable `parent:` drill as cloud/flow — shapes and `route: curve` compose.

```radius
template: mindmap
route: curve
title: Product map
nodes:
  hub[Product]{shape:circle}
  mkt[Marketing]{parent:hub shape:oval}
  eng[Engineering]{parent:hub shape:hex collapsed:false}
  api[API]{parent:eng shape:parallelogram}
  ui[UI]{parent:eng}
  risks[Risks]{parent:hub shape:table collapsed:false}
  r1[Latency]{parent:risks}
  r2[Auth]{parent:risks shape:diamond}
edges:
  hub --> mkt
  hub --> eng
  eng --> api
  eng --> ui
  hub --> risks
```

## Drill-in

Same expand tree, two vocabularies:

- **Architecture:** conceptual → logical → physical  
- Prefer year / quarter labels via node `time:` on a flat chronological list — not nested expand trees.

### Timeline

Instances sit on a **tick-marked horizontal rail**. When a row fills the board, the axis **U-turns** onto the next row (serpentine). Optional `time:` is the caption under each tick. Milestone boxes are **text-only** (no kind chip); keep labels short or let them wrap.

```radius
template: timeline
dir: lr
title: Migration timeline
nodes:
  assess[Assess]{rank:0 time:2024 Q1}
  pilot[Pilot LZ]{rank:1 time:2024 Q2}
  scale[Scale]{rank:2 time:2024 Q3}
  harden[Harden]{rank:3 time:2024 Q4}
  cutover[Cutover]{rank:4 time:2025 Q1}
  optimize[Optimize]{rank:5 time:2025 Q2}
edges:
  assess --> pilot
  pilot --> scale
  scale --> harden
  harden --> cutover
  cutover --> optimize
```

Order by `rank` / `order` (else edge topology). Do not model time as nested year→half→quarter expand trees — use ticks.

## Themes

One board `theme`. Group `family` tints faces; kinds color chips.

### `indigo`

Dark purple→green architecture void (verified pilot / eGIS boards). Amber accent; cyan / violet / emerald glows. Default `ground: aurora`. Optional `ground: hex` keeps honeycomb over a similar wash.

### `neon`

Dark void, cyan / amber / violet. `ground: chip` is an **energy / electricity** field (glowing buses + lightning), not a CPU plate. Default `look: elevated` keeps the neon palette without box extrusion. Optional `look: perspective` adds experimental 2.5D block faces (depth shadows) — use only when that read works for the board.

Common cloud kinds (**Esri / AWS / Azure** load MIT glyphs from `dist/icons/{family}/`). Elements with a `kind` render **AWS Architecture style**: fixed **category-colored square**, white icon centered inside, label centered below — no outer card border. AWS fills follow service categories (compute orange, storage green, database purple, network violet, security red, …).

- **AWS** (`theme: aws`, `family: aws`): `aws.vpc` `aws.alb` `aws.cloudfront` `aws.route53` `aws.ecs` `aws.eks` `aws.fargate` `aws.lambda` `aws.ecr` `aws.rds` `aws.aurora` `aws.dynamodb` `aws.s3` `aws.elasticache` `aws.sqs` `aws.sns` `aws.iam` `aws.cloudwatch` `aws.waf` …
- **Azure** (`theme: azure`, `family: azure`): `azure.vnet` `azure.frontdoor` `azure.appgateway` `azure.aks` `azure.containerapps` `azure.functions` `azure.sql` `azure.cosmos` `azure.blob` `azure.keyvault` `azure.entra` `azure.firewall` `azure.apim` `azure.monitor` …

Demos: `12-aws-architecture.html`, `13-azure-architecture.html`.

## Errors

```json
{ "path": "theme", "fix": "…", "see": "RADIUS.md#themes" }
```

## Version

`Radius.version` is **0.5.0**. Pin `…/radiusjs@0.5.0/dist/radius.js` when published. Never `@latest`.
