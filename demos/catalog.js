/**
 * Demo gallery catalog — categories for the left nav (newest-first within each).
 * Paths are relative to demos/ for GitHub Pages static hosting.
 */
export const VERSION = '0.5.0';

/** @typedef {{ id: string, file: string, title: string, blurb: string, tags?: string[] }} DemoEntry */

/** @type {Record<string, DemoEntry>} */
export const DEMOS = {
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
    blurb: 'Services · storage · HA profiles',
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
    hint: 'Themes · grounds · live preview',
  },
  {
    id: 'new',
    label: 'New',
    demos: ['21-constellation', '20-mindmap', '19-delivery-arch', '18-reality-jupedsim'],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    demos: ['08-arch-drill', '17-egis-one', '14-age-ha', '11-age-k8s', '19-delivery-arch'],
  },
  {
    id: 'cloud',
    label: 'Cloud & platform',
    demos: ['12-aws', '13-azure', '03-azure-nutanix', '05-nkp'],
  },
  {
    id: 'gis',
    label: 'GIS & Esri',
    demos: ['02-gis-esri', '15-named-user', '16-sg-mha', '18-reality-jupedsim'],
  },
  {
    id: 'narrative',
    label: 'Narrative & time',
    demos: ['01-deck', '04-story-replace', '09-timeline'],
  },
  {
    id: 'layout',
    label: 'Layout & fold',
    demos: ['21-constellation', '20-mindmap', '07-expand', '10-layout-hints'],
  },
  {
    id: 'look',
    label: 'Look & feel',
    demos: ['06-neon', '21-constellation'],
  },
];

/** Sample fence for the styling playground (meta keys overwritten live). */
export const PLAYGROUND_BASE = `template: mindmap
route: curve
frame: system
title: Style lab
nodes:
  hub[Product]{shape:circle}
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
