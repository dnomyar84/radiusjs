theme: paper
template: cloud
frame: system
ground: circuit
title: Migrate
groups:
  src[Azure HCI]{family:azure members:hci arc vms collapsed:true}
  dst[Nutanix]{family:nutanix members:nci ahv nkp collapsed:true}
nodes:
  hci[Azure Stack HCI]{kind:azure.hci}
  arc[Azure Arc]{kind:azure.arc}
  vms[Guest VMs]{kind:azure.vm}
  nci[NCI]{kind:nutanix.nci}
  ahv[AHV]{kind:nutanix.ahv}
  nkp[NKP]{kind:nkp.management}
edges:
  hci --> nci: migrate
  vms --> ahv
  arc --> nkp
story:
  expand src
  focus hci vms
  expand dst
  collapse src
