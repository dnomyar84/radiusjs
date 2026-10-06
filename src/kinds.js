/** Kind registry — family-colored chips (MIT originals). Licensed SVG overlay later. */

export const FAMILIES = {
  esri: { fill: '#0079c1', on: '#fff', label: 'Esri' },
  aws: { fill: '#ff9900', on: '#111', label: 'AWS' },
  azure: { fill: '#0078d4', on: '#fff', label: 'Azure' },
  gcp: { fill: '#1a73e8', on: '#fff', label: 'GCP' },
  oci: { fill: '#c74634', on: '#fff', label: 'OCI' },
  k8s: { fill: '#326ce5', on: '#fff', label: 'K8s' },
  nutanix: { fill: '#1a7a9c', on: '#fff', label: 'Nutanix' },
  nkp: { fill: '#0e5c75', on: '#fff', label: 'NKP' },
  ctr: { fill: '#4b5563', on: '#fff', label: 'Ctr' },
  it: { fill: '#57534e', on: '#fff', label: 'IT' },
};

const ALIASES = {
  'azure.stackhci': 'azure.hci',
  'azure.local': 'azure.hci',
};

/** Short monogram for chip face */
const MONO = {
  'esri.portal': 'P',
  'esri.map': 'M',
  'esri.agol': 'AG',
  'esri.gdb': 'GDB',
  'esri.feature': 'FC',
  'aws.s3': 'S3',
  'aws.ec2': 'EC2',
  'aws.lambda': 'λ',
  'aws.vpc': 'VPC',
  'azure.hci': 'HCI',
  'azure.arc': 'Arc',
  'azure.vm': 'VM',
  'azure.aks': 'AKS',
  'azure.storage': 'ST',
  'azure.vnet': 'VNet',
  'azure.keyvault': 'KV',
  'azure.monitor': 'Mon',
  'gcp.gke': 'GKE',
  'gcp.compute': 'CE',
  'oci.compute': 'C',
  'k8s.cluster': 'K8s',
  'k8s.node': 'N',
  'k8s.ns': 'NS',
  'nutanix.ahv': 'AHV',
  'nutanix.aos': 'AOS',
  'nutanix.nci': 'NCI',
  'nutanix.prism': 'PC',
  'nutanix.prismcentral': 'PC',
  'nutanix.vm': 'VM',
  'nutanix.files': 'Fil',
  'nutanix.objects': 'Obj',
  'nutanix.flow': 'Flow',
  'nkp.management': 'Mgt',
  'nkp.managed': 'WK',
  'nkp.attached': 'Att',
  'nkp.workspace': 'WS',
  'nkp.project': 'Prj',
  'nkp.konvoy': 'Kon',
  'nkp.kommander': 'Kom',
  'nkp.capi': 'CAPI',
  'nkp.flux': 'Flux',
  'nkp.prometheus': 'Prom',
  'nkp.grafana': 'Grf',
  'nkp.velero': 'Vel',
  'nkp.dex': 'Dex',
  'nkp.csi': 'CSI',
  'nkp.gatekeeper': 'Gk',
  'ctr.pod': 'Pod',
  'ctr.deployment': 'Dep',
  'ctr.statefulset': 'STS',
  'ctr.service': 'Svc',
  'ctr.ingress': 'Ing',
  'ctr.container': 'Ctr',
  'ctr.registry': 'Reg',
  'ctr.helm': 'Helm',
  'esri.portal': 'P',
  'esri.map': 'M',
  'esri.agol': 'AG',
  'esri.gdb': 'GDB',
  'esri.feature': 'FC',
  'esri.scene': '3D',
  'esri.notebook': 'NB',
  'esri.server': 'Srv',
  'esri.datastore': 'DS',
  'esri.experience': 'EX',
  'it.step': '•',
  'it.person': 'P',
  'it.db': 'DB',
  'it.api': 'API',
  'it.queue': 'Q',
  'it.cache': 'Cache',
  'it.lb': 'LB',
};

export function normalizeKind(kind) {
  if (!kind) return null;
  const k = String(kind).trim().toLowerCase();
  return ALIASES[k] || k;
}

export function familyOf(kind) {
  const k = normalizeKind(kind);
  if (!k) return null;
  const prefix = k.split('.')[0];
  return FAMILIES[prefix] || FAMILIES.it;
}

export function chipLabel(kind) {
  const k = normalizeKind(kind);
  if (!k) return '?';
  if (MONO[k]) return MONO[k];
  const leaf = k.split('.').pop() || '?';
  return leaf.slice(0, 3).toUpperCase();
}

export function kindMeta(kind) {
  const id = normalizeKind(kind);
  const family = familyOf(id);
  return {
    id,
    family: id ? id.split('.')[0] : 'it',
    fill: family.fill,
    on: family.on,
    mono: chipLabel(id),
  };
}
