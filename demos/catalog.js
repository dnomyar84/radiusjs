/**
 * Demo gallery catalog — categories for the left nav (newest-first within each).
 * Paths are relative to demos/ for GitHub Pages static hosting.
 */
export const VERSION = '0.5.0';

/** @typedef {{ id: string, file: string, title: string, blurb: string, tags?: string[] }} DemoEntry */

/** @type {Record<string, DemoEntry>} */
export const DEMOS = {
  '25-crowd-pipeline': {
    id: '25-crowd-pipeline',
    file: '25-crowd-pipeline.html',
    title: 'Crowd simulation pipeline',
    blurb: 'ArcGIS Online triggers Fargate Spot, then the map refreshes',
    tags: ['sequence', 'aws', 'esri'],
  },
  '24-mermaid-flow': {
    id: '24-mermaid-flow',
    file: '24-mermaid-flow.html',
    title: 'From Mermaid',
    blurb: 'Pasted flowchart · shapes · subgraph',
    tags: ['mermaid', 'flow'],
  },
  '23-sequence': {
    id: '23-sequence',
    file: '23-sequence.html',
    title: 'Sequence',
    blurb: 'Lifelines · notes · alt · dotted reply',
    tags: ['sequence', 'mermaid'],
  },
  '22-age-velocity-ha': {
    id: '22-age-velocity-ha',
    file: '22-arcgis-enterprise-velocity-ha.html',
    title: 'AGE 12.3 + Velocity HA',
    blurb: 'VMs · WAF · gateway · Nutanix files · DBaaS',
    tags: ['esri', 'ha', 'nutanix'],
  },
  '21-constellation': {
    id: '21-constellation',
    file: '21-constellation.html',
    title: 'Constellation · 3D cloud',
    blurb: 'Dense relationships · slow spin · drag to orbit',
    tags: ['constellation', '3d', 'orbit'],
  },
  '20-mindmap': {
    id: '20-mindmap',
    file: '20-mindmap.html',
    title: 'Mindmap · shapes · table rows',
    blurb: 'Radial · curve wires · UML faces · row elements',
    tags: ['mindmap', 'shapes', 'table'],
  },
  '19-delivery-arch': {
    id: '19-delivery-arch',
    file: '19-delivery-arch-agent-workflow.html',
    title: 'Delivery arch agents',
    blurb: 'Esri Aus swimlanes · text cards · edges front',
    tags: ['cloud', 'agents'],
  },
  '18-reality-jupedsim': {
    id: '18-reality-jupedsim',
    file: '18-reality-jupedsim-pilot.html',
    title: 'Reality → JuPedSim',
    blurb: 'Pilot · splat · mesh · barriers · routing',
    tags: ['gis', 'indigo'],
  },
  '17-egis-one': {
    id: '17-egis-one',
    file: '17-egis-one-hybrid.html',
    title: 'eGIS ONE hybrid',
    blurb: 'K8s + VMs · indigo · aurora',
    tags: ['gis', 'k8s'],
  },
  '16-sg-mha': {
    id: '16-sg-mha',
    file: '16-sg-mha.html',
    title: 'Singapore MHA',
    blurb: 'Home Team · HQ · SPF · SCDF',
    tags: ['org', 'hatch'],
  },
  '15-named-user': {
    id: '15-named-user',
    file: '15-arcgis-named-user.html',
    title: 'Named User licenses',
    blurb: 'User types · apps · Pro extensions',
    tags: ['esri', 'gis'],
  },
  '14-age-ha': {
    id: '14-age-ha',
    file: '14-arcgis-enterprise-123-ha.html',
    title: 'ArcGIS Enterprise 12.3 HA',
    blurb: 'Tiers · ports · object HA×3',
    tags: ['esri', 'ha'],
  },
  '13-azure': {
    id: '13-azure',
    file: '13-azure-architecture.html',
    title: 'Azure landing zone',
    blurb: 'Hub-spoke · AKS · Front Door',
    tags: ['azure', 'cloud'],
  },
  '12-aws': {
    id: '12-aws',
    file: '12-aws-architecture.html',
    title: 'AWS three-tier',
    blurb: 'VPC · ALB · ECS · data',
    tags: ['aws', 'cloud'],
  },
  '11-age-k8s': {
    id: '11-age-k8s',
    file: '11-arcgis-enterprise-k8s.html',
    title: 'AGE on Kubernetes',
    blurb: 'Pod sets · expanded · no edges',
    tags: ['esri', 'k8s'],
  },
  '10-layout-hints': {
    id: '10-layout-hints',
    file: '10-layout-hints.html',
    title: 'Layout omit vs hints',
    blurb: 'Tier 0 / Tier 2 · dots',
    tags: ['layout'],
  },
  '09-timeline': {
    id: '09-timeline',
    file: '09-timeline.html',
    title: 'Timeline',
    blurb: 'Ticks rail · U-turn wrap',
    tags: ['timeline', 'story'],
  },
  '08-arch-drill': {
    id: '08-arch-drill',
    file: '08-arch-drill.html',
    title: 'Architecture drill-in',
    blurb: 'Conceptual → logical → physical',
    tags: ['drill', 'matrix'],
  },
  '07-expand': {
    id: '07-expand',
    file: '07-expand.html',
    title: 'Expand / nest',
    blurb: 'Multi-level fold',
    tags: ['fold'],
  },
  '06-neon': {
    id: '06-neon',
    file: '06-neon.html',
    title: 'Neon',
    blurb: 'Cyan / amber / violet · elevated',
    tags: ['theme', 'neon'],
  },
  '05-nkp': {
    id: '05-nkp',
    file: '05-nkp.html',
    title: 'NKP fleet',
    blurb: 'Platform + workloads',
    tags: ['nutanix', 'k8s'],
  },
  '04-story-replace': {
    id: '04-story-replace',
    file: '04-story-replace.html',
    title: 'Story replace',
    blurb: 'Cutover narrative',
    tags: ['story'],
  },
  '03-azure-nutanix': {
    id: '03-azure-nutanix',
    file: '03-azure-to-nutanix.html',
    title: 'Azure HCI → Nutanix',
    blurb: 'Deep nest migration',
    tags: ['migration', 'cloud'],
  },
  '02-gis-esri': {
    id: '02-gis-esri',
    file: '02-gis-esri.html',
    title: 'GIS / Esri',
    blurb: 'Neon palette · nested maps',
    tags: ['gis', 'esri'],
  },
  '01-deck': {
    id: '01-deck',
    file: '01-deck-slide.html',
    title: 'Deck slide',
    blurb: 'Agent pipeline · wash',
    tags: ['deck', 'intro'],
  },
};

/**
 * Left-nav categories. Order = display order.
 * `special: 'playground'` renders the styling lab instead of an iframe.
 */
export const CATEGORIES = [
  {
    id: 'playground',
    label: 'Styling playground',
    special: 'playground',
    hint: 'Paste Radius or Mermaid · color only',
  },
  {
    id: 'new',
    label: 'New',
    demos: ['25-crowd-pipeline', '24-mermaid-flow', '23-sequence', '22-age-velocity-ha', '21-constellation', '20-mindmap'],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    demos: ['22-age-velocity-ha', '08-arch-drill', '17-egis-one', '14-age-ha', '11-age-k8s', '19-delivery-arch'],
  },
  {
    id: 'cloud',
    label: 'Cloud & platform',
    demos: ['25-crowd-pipeline', '12-aws', '13-azure', '03-azure-nutanix', '05-nkp'],
  },
  {
    id: 'gis',
    label: 'GIS & Esri',
    demos: ['25-crowd-pipeline', '22-age-velocity-ha', '02-gis-esri', '15-named-user', '16-sg-mha', '18-reality-jupedsim'],
  },
  {
    id: 'narrative',
    label: 'Narrative & time',
    demos: ['25-crowd-pipeline', '23-sequence', '01-deck', '04-story-replace', '09-timeline'],
  },
  {
    id: 'layout',
    label: 'Layout & fold',
    demos: ['24-mermaid-flow', '23-sequence', '21-constellation', '20-mindmap', '07-expand', '10-layout-hints'],
  },
  {
    id: 'look',
    label: 'Look & feel',
    demos: ['06-neon', '21-constellation'],
  },
];

/** Opening diagram in the playground text box. Color rails do not rewrite it. */
export const PLAYGROUND_BASE = `template: mindmap
route: curve
frame: system
title: Style lab
nodes:
  hub[Product]{shape:circle collapsed:false}
  eng[Engineering]{parent:hub shape:hex collapsed:false}
  api[API]{parent:eng shape:parallelogram}
  ui[UI]{parent:eng}
  mkt[Marketing]{parent:hub shape:oval}
  risks[Risks]{parent:hub shape:table collapsed:false}
  lat[Latency]{parent:risks}
  auth[Auth]{parent:risks shape:diamond}
edges:
  hub --> eng
  eng --> api: serve
  eng --> ui
  hub --> mkt: grow
  hub --> risks
  api --> lat
`;

/**
 * Named theme and ground pairs kept for catalog checks.
 * The playground color rails use `colorPresets()` so a repeated theme is one color.
 * Ground stays on the pasted diagram.
 */
export const BEAUTY_PRESETS = [
  { id: 'indigo', label: 'Indigo', theme: 'indigo', ground: 'dots' },
  { id: 'aurora', label: 'Aurora', theme: 'indigo', ground: 'aurora' },
  { id: 'paper', label: 'Paper', theme: 'paper', ground: 'dots' },
  { id: 'night', label: 'Night', theme: 'night', ground: 'grid' },
  { id: 'ios', label: 'iOS', theme: 'ios', ground: 'solid' },
  { id: 'material', label: 'Material', theme: 'material', ground: 'wash' },
  { id: 'esri', label: 'Esri', theme: 'esri', ground: 'parcels' },
  { id: 'neon', label: 'Neon', theme: 'neon', ground: 'chip' },
  { id: 'copper', label: 'Copper', theme: 'aws', ground: 'hex' },
  { id: 'sky', label: 'Sky', theme: 'azure', ground: 'wash' },
  { id: 'glacier', label: 'Glacier', theme: 'gcp', ground: 'grid' },
  { id: 'clay', label: 'Clay', theme: 'oci', ground: 'diagonal' },
  { id: 'helm', label: 'Helm', theme: 'k8s', ground: 'circuit' },
  { id: 'tide', label: 'Tide', theme: 'nutanix', ground: 'mesh' },
];

/**
 * One playground color per theme. The first label wins when a theme repeats.
 */
export function colorPresets() {
  const seen = new Set();
  const out = [];
  for (const preset of BEAUTY_PRESETS) {
    if (seen.has(preset.theme)) continue;
    seen.add(preset.theme);
    out.push({ id: preset.theme, label: preset.label, theme: preset.theme });
  }
  return out;
}

/**
 * Sample diagrams kept for catalog checks.
 * The playground text box is the diagram; choosing a color does not load these.
 */
export const STYLE_PRESETS = [
  { id: 'mindmap', label: 'Mind map', route: 'curve', fence: PLAYGROUND_BASE },
  {
    id: 'sequence',
    label: 'Sequence',
    route: 'straight',
    fence: `template: sequence
title: Checkout
nodes:
  alice[Alice]{shape:oval}
  api[API]
  db[Orders]{shape:cylinder}
  note1[In stock?]{role:note shape:note lane:api side:right rank:0}
edges:
  alice --> api: Place order
  api --> db: Insert
  db --> api: ok{line:dotted}
  api --> alice: Confirmed
groups:
  stock[alt in stock]{rank:1 span:2 virtual:true expandable:false}
`,
  },
  {
    id: 'mermaid',
    label: 'Mermaid',
    route: 'ortho',
    fence: `flowchart TB
  start([Start]) --> gate{Ready?}
  gate -->|Yes| work[Build]
  gate -->|No| stop([Stop])
  work --> db[(Save)]
  subgraph ship [Release]
    work
    db
  end
`,
  },
  {
    id: 'flow',
    label: 'Flow chart',
    route: 'ortho',
    fence: `template: flow
dir: lr
title: Flow chart
nodes:
  start[Start]{shape:round}
  check[Ready?]{shape:diamond}
  build[Build]
  ship[Ship]{shape:oval}
edges:
  start --> check
  check --> build: yes
  build --> ship
`,
  },
  {
    id: 'uml',
    label: 'UML',
    route: 'ortho',
    fence: `template: flow
dir: lr
title: UML
nodes:
  actor[Actor]{shape:oval}
  input[Request]{shape:parallelogram}
  gate[Allowed?]{shape:diamond}
  action[Update]{shape:rect}
  store[Record]{shape:table}
edges:
  actor --> input
  input --> gate
  gate --> action: yes
  action --> store
`,
  },
  {
    id: 'architecture',
    label: 'Architecture',
    route: 'ortho',
    fence: `template: cloud
title: Architecture
groups:
  edge[Edge]{virtual members:cdn gw collapsed:false}
  core[Core]{virtual members:api worker collapsed:false}
  data[Data]{virtual members:db collapsed:false}
nodes:
  cdn[CDN]
  gw[Gateway]
  api[API]
  worker[Worker]
  db[Database]
edges:
  cdn --> gw
  gw --> api
  api --> worker
  api --> db
`,
  },
  {
    id: 'aws',
    label: 'AWS',
    route: 'ortho',
    fence: `template: cloud
title: AWS
groups:
  vpc[VPC]{family:aws virtual members:alb ecs rds collapsed:false}
nodes:
  alb[Load balancer]{kind:aws.alb}
  ecs[Service]{kind:aws.ecs}
  rds[Database]{kind:aws.rds}
edges:
  alb --> ecs
  ecs --> rds
`,
  },
  {
    id: 'azure',
    label: 'Azure',
    route: 'ortho',
    fence: `template: cloud
title: Azure
groups:
  rg[Resource group]{family:azure virtual members:app db vault collapsed:false}
nodes:
  app[App Service]{kind:azure.appservice}
  db[SQL]{kind:azure.sql}
  vault[Key Vault]{kind:azure.keyvault}
edges:
  app --> db
  app --> vault
`,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    route: 'ortho',
    fence: `template: timeline
dir: lr
title: Timeline
nodes:
  assess[Assess]{rank:0 time:2025 Q1}
  pilot[Pilot]{rank:1 time:2025 Q2}
  scale[Scale]{rank:2 time:2025 Q3}
  live[Go live]{rank:3 time:2025 Q4}
edges:
  assess --> pilot
  pilot --> scale
  scale --> live: gate
`,
  },
  {
    id: 'hub',
    label: 'Hub',
    route: 'curve',
    fence: `template: hub
title: Hub
nodes:
  core[Core]
  api[API]
  ui[UI]
  data[Data]
edges:
  core --> api
  core --> ui
  core --> data
`,
  },
  {
    id: 'constellation',
    label: 'Constellation',
    route: 'straight',
    fence: `template: constellation
title: Constellation
nodes:
  id[Identity]
  api[API]
  data[Data]
  ml[Models]
  ops[Ops]
  edge[Edge]
  policy[Policy]
  bus[Bus]
  cache[Cache]
  search[Search]
  notify[Notify]
  audit[Audit]
  relay[Relay]
  shard[Shard]
  queue[Queue]
  token[Token]
  route[Route]
  index[Index]
  probe[Probe]
  vault[Vault]
edges:
  id --> api
  api --> data
  data --> ml
  ml --> ops
  ops --> edge
  edge --> policy
  policy --> bus
  bus --> cache
  cache --> search
  search --> notify
  notify --> audit
  audit --> id
  id --> bus
  api --> cache
  data --> search
  relay --> id
  shard --> data
  queue --> bus
  token --> api
  route --> edge
  index --> search
  probe --> ops
  vault --> audit
  relay --> shard
  queue --> token
`,
  },
];
