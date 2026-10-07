/**
 * Kind → icon SVG (optional overlay on monogram chips).
 * Packs are MIT originals under dist/icons/{family}/ — not vendor trademarks.
 */

/** Leaf → file for each family (fallback = family name). */
const PACKS = {
  esri: new Set([
    'portal',
    'map',
    'agol',
    'gdb',
    'feature',
    'scene',
    'notebook',
    'server',
    'datastore',
    'experience',
    'enterprise',
    'manager',
    'identity',
    'relational',
    'spatiotemporal',
    'objectstore',
    'raster',
    'gp',
    'webadaptor',
    'tilecache',
    'geoevent',
    'geoanalytics',
    'image',
    'mission',
    'knowledge',
    'workflow',
    'hosting',
    'lb',
  ]),
  aws: new Set([
    's3',
    'ec2',
    'lambda',
    'vpc',
    'alb',
    'nlb',
    'apigateway',
    'cloudfront',
    'route53',
    'rds',
    'aurora',
    'dynamodb',
    'elasticache',
    'ecs',
    'eks',
    'fargate',
    'ecr',
    'sqs',
    'sns',
    'iam',
    'cloudwatch',
    'secretsmanager',
    'cognito',
    'waf',
    'subnet',
    'nat',
    'asg',
  ]),
  azure: new Set([
    'hci',
    'arc',
    'vm',
    'aks',
    'storage',
    'vnet',
    'keyvault',
    'monitor',
    'appservice',
    'functions',
    'sql',
    'cosmos',
    'frontdoor',
    'appgateway',
    'loadbalancer',
    'entra',
    'redis',
    'eventhubs',
    'servicebus',
    'containerapps',
    'acr',
    'appinsights',
    'bastion',
    'firewall',
    'subnet',
    'nsg',
    'privateendpoint',
    'devops',
    'pipelines',
    'dns',
    'cdn',
    'blob',
    'files',
    'postgresql',
    'mysql',
    'vmss',
    'apim',
  ]),
};

function iconHref(rel) {
  try {
    return new URL(rel, import.meta.url).href;
  } catch {
    return rel.replace(/^\.\.\//, './');
  }
}

/**
 * @param {string|null|undefined} kindId already-normalized kind id
 * @returns {string|null} URL to SVG, or null
 */
export function kindIconHref(kindId) {
  if (!kindId) return null;
  const [family, leaf] = String(kindId).split('.');
  const pack = PACKS[family];
  if (!pack) return null;
  const file = pack.has(leaf) ? leaf : family;
  return iconHref(`../dist/icons/${family}/${file}.svg`);
}
