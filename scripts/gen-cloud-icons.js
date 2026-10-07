/**
 * Generate MIT-original AWS + Azure chip icons
 * → assets/{aws,azure} + dist/icons/{aws,azure}
 * Not Amazon/Microsoft trademark artwork.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>\n`;
}

const aws = {
  aws: '<path d="M4 14c2.5 3 5.5 4.5 8 4.5S17.5 17 20 14"/><path d="M7 10h10M9 7h6"/>',
  s3: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  ec2: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M8 9h2M8 12h2M8 15h2M13 9h3M13 12h3"/>',
  lambda: '<path d="M7 19l4-14h3l4 14"/><path d="M9.5 14h5"/>',
  vpc: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 12h17M12 5v14"/>',
  alb: '<path d="M4 12h4M16 7h4M16 17h4M8 12l8-5M8 12l8 5"/><circle cx="6" cy="12" r="1.5"/><circle cx="18" cy="7" r="1.5"/><circle cx="18" cy="17" r="1.5"/>',
  nlb: '<path d="M4 12h16M12 5v14"/><circle cx="4" cy="12" r="1.5"/><circle cx="20" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  apigateway: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><path d="M17 13v3h3"/>',
  cloudfront: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1"/>',
  route53: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.2 2.5 2.2 11.5 0 16M12 4c-2.2 2.5-2.2 11.5 0 16"/>',
  rds: '<ellipse cx="12" cy="6.5" rx="7" ry="2.5"/><path d="M5 6.5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7"/><path d="M5 10.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  aurora: '<path d="M12 3l2.5 7H21l-5.5 4 2 7L12 17l-5.5 4 2-7L3 10h6.5z"/>',
  dynamodb: '<path d="M6 4h12v4H6zM6 10h12v4H6zM6 16h12v4H6z"/>',
  elasticache: '<circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M11 12h2"/>',
  ecs: '<rect x="5" y="6" width="6" height="5" rx="1"/><rect x="13" y="6" width="6" height="5" rx="1"/><rect x="5" y="13" width="6" height="5" rx="1"/><rect x="13" y="13" width="6" height="5" rx="1"/>',
  eks: '<circle cx="12" cy="12" r="3"/><path d="M12 4l7 4v8l-7 4-7-4V8z"/>',
  fargate: '<path d="M4 16c0-4 3.5-7 8-7s8 3 8 7"/><rect x="7" y="9" width="10" height="7" rx="1"/>',
  ecr: '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  sqs: '<path d="M4 8h12v6H8l-4 3z"/><path d="M10 11h10v6h-4l-3 2.5V17"/>',
  sns: '<circle cx="12" cy="7" r="2.5"/><path d="M12 9.5v3M7 18l5-5.5L17 18"/>',
  iam: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/>',
  cloudwatch: '<path d="M3 16l4-6 3 3 4-7 5 10"/>',
  secretsmanager: '<rect x="6" y="10" width="12" height="10" rx="1.5"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/><circle cx="12" cy="15" r="1.2" fill="#fff" stroke="none"/>',
  cognito: '<circle cx="9" cy="9" r="2.5"/><circle cx="16" cy="10" r="2"/><path d="M4 19c1-3 3-4.5 5-4.5s3.5 1 4.5 3"/>',
  waf: '<path d="M12 3l8 3.5v5c0 4.5-3.2 7.5-8 9.5-4.8-2-8-5-8-9.5v-5L12 3z"/>',
  subnet: '<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M4 12h16"/>',
  nat: '<circle cx="12" cy="12" r="7"/><path d="M8 12h8M14 9l3 3-3 3"/>',
  asg: '<path d="M6 16V8l6-3 6 3v8l-6 3z"/><path d="M12 5v14M6 16l6-3 6 3"/>',
};

const azure = {
  azure: '<path d="M4 18L10 5h4l6 13"/><path d="M8.5 14h7"/>',
  hci: '<rect x="4" y="5" width="16" height="5" rx="1"/><rect x="4" y="12" width="16" height="5" rx="1"/><path d="M8 7.5h2M8 14.5h2"/>',
  arc: '<path d="M7 12a5 5 0 0 1 10 0"/><path d="M5 12a7 7 0 0 1 14 0"/><circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none"/>',
  vm: '<rect x="3.5" y="5" width="17" height="11" rx="1.5"/><path d="M8 19h8M12 16v3"/>',
  aks: '<circle cx="12" cy="12" r="2.5"/><path d="M12 3.5l2 5.5 5.7 1.2-4.2 4.1 1.2 5.7L12 17.2l-5.7 2.8 1.2-5.7-4.2-4.1L10 9z"/>',
  storage: '<path d="M4 7h16v3H4zM4 12h16v3H4zM4 17h16v3H4z"/>',
  vnet: '<path d="M4 8h6v8H4zM14 8h6v8h-6z"/><path d="M10 12h4"/>',
  keyvault: '<path d="M12 3l7 3v5.5c0 4-2.8 6.8-7 8.5-4.2-1.7-7-4.5-7-8.5V6l7-3z"/><path d="M12 11v4M12 11a1.5 1.5 0 1 0 0-0.01"/>',
  monitor: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M7 15l3-4 2.5 2.5L17 8"/>',
  appservice: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9h16M8 5v4"/>',
  functions: '<path d="M10 3h4l-2 7h4l-8 11 2-7H6z"/>',
  sql: '<ellipse cx="12" cy="6" rx="7" ry="2.2"/><path d="M5 6v5c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2V6"/><path d="M5 14.5c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2"/><path d="M5 11.5v3"/>',
  cosmos: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3"/><path d="M12 4v16"/>',
  frontdoor: '<path d="M4 12h6l2-5 2 10 2-5h4"/>',
  appgateway: '<path d="M4 7h16v3H4z"/><path d="M7 10v7M12 10v7M17 10v7"/><path d="M5 17h4M10 17h4M15 17h4"/>',
  loadbalancer: '<path d="M4 12h6M14 7h6M14 17h6M10 12l4-5M10 12l4 5"/>',
  entra: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/><path d="M16 7.5l3-1.5"/>',
  redis: '<rect x="4" y="6" width="16" height="4" rx="1"/><rect x="4" y="12" width="16" height="4" rx="1"/><path d="M7 8h2M7 14h2"/>',
  eventhubs: '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="18" cy="17" r="2"/><path d="M8 12h6M14 12l3-4M14 12l3 4"/>',
  servicebus: '<rect x="4" y="7" width="6" height="10" rx="1"/><rect x="14" y="7" width="6" height="10" rx="1"/><path d="M10 10h4M10 14h4"/>',
  containerapps: '<rect x="5" y="4" width="14" height="6" rx="1"/><rect x="5" y="12" width="14" height="6" rx="1"/><path d="M8 7h2M8 15h2"/>',
  acr: '<circle cx="12" cy="12" r="7"/><path d="M12 8v8M9 10h6M9 14h6"/>',
  appinsights: '<circle cx="12" cy="12" r="2"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/><path d="M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"/>',
  bastion: '<path d="M5 20V9l7-5 7 5v11"/><path d="M10 20v-5h4v5"/>',
  firewall: '<path d="M5 5h14v3H5zM5 10h14v3H5zM5 15h14v4H5z"/>',
  subnet: '<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M4 12h16"/>',
  nsg: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M8 9h8M8 12h8M8 15h5"/>',
  privateendpoint: '<circle cx="8" cy="12" r="3"/><circle cx="17" cy="12" r="2.5"/><path d="M11 12h3.5"/>',
  devops: '<circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="8" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="M9 9.5l2 5.5M15 9.5l-2 5.5"/>',
  pipelines: '<circle cx="6" cy="8" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="16" r="2"/><path d="M8 9l2 2M14 13l2 2"/>',
  dns: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.2 2.5 2.2 11.5 0 16"/>',
  cdn: '<path d="M6 15a5 5 0 1 1 9.5-2.5"/><path d="M8 18h10a3.5 3.5 0 1 0-.3-7"/>',
  blob: '<path d="M7 8h10v10H7z"/><path d="M7 8l5-3 5 3"/>',
  files: '<path d="M6 5h7l4 4v10H6z"/><path d="M13 5v4h4"/>',
  postgresql: '<path d="M8 4h8v4c0 2-1.5 3.5-4 4.5-2.5-1-4-2.5-4-4.5V4z"/><path d="M8 12.5c0 2 1.8 3.5 4 4.5 2.2-1 4-2.5 4-4.5"/><path d="M12 17v3"/>',
  mysql: '<path d="M5 16c2-6 5-10 7-10s5 4 7 10"/><path d="M8 16h8"/>',
  vmss: '<rect x="3" y="5" width="8" height="6" rx="1"/><rect x="13" y="5" width="8" height="6" rx="1"/><rect x="8" y="13" width="8" height="6" rx="1"/>',
  apim: '<rect x="4" y="4" width="7" height="7" rx="1"/><path d="M14 7h6M14 12h6M7 14v6M4 17h6"/>',
};

function writePack(family, icons) {
  const dirs = [path.join(root, `assets/${family}`), path.join(root, `dist/icons/${family}`)];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(icons)) {
      fs.writeFileSync(path.join(dir, `${name}.svg`), svg(body));
    }
  }
  fs.writeFileSync(
    path.join(root, `assets/${family}/README.md`),
    `# ${family.toUpperCase()}-family icons (Radius)

MIT-original product-role glyphs for \`${family}.*\` kinds. **Not** official vendor trademark artwork.

- Runtime copies: \`dist/icons/${family}/\`
- Replace with a licensed icon pack later (same filenames).

Fallback glyph: \`${family}.svg\`.
`,
  );
  return Object.keys(icons).length;
}

const nAws = writePack('aws', aws);
const nAzure = writePack('azure', azure);
console.log(`aws ${nAws} icons, azure ${nAzure} icons`);
