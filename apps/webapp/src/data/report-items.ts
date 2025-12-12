import type {ReportItem} from '@/components/visualization/collapsible-report-item-card'
import type {DataObjectId} from './schema'

const reportItemsIds = [
  'app-cpu',
  'app-gpu',
  'app-code',
  'gateway-main',
  'app-os',
  'kms-main',
] satisfies DataObjectId[]

type ReportItemId = (typeof reportItemsIds)[number]

// Shared trust item data to avoid duplication
export const REPORT_ITEMS: Record<ReportItemId, ReportItem> = {
  'app-cpu': {
    id: 'app-cpu',
    title: 'TDX Attestation',
    vendorTitle: 'Trust Domain Extensions',
    intro:
      "Intel TDX (Trust Domain Extensions) provides hardware-based attestation for confidential computing. You can verify the authenticity of this TDX quote using Phala's TEE Attestation Explorer - an open source tool for analyzing Intel attestation reports.",
    links: [
      {
        text: 'Verify TDX quote at TEE Explorer',
        url: 'https://ra-quote-explorer.vercel.app/',
        isAction: true,
        urlWithQuote: true,
      },
      {
        text: 'Learn about Intel TDX',
        url: 'https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html',
      },
    ],
    vendorIcon: '/intel.svg',
    fields: [
      {objectId: 'app-cpu', field: 'model', label: 'Model'},
      {
        objectId: 'app-cpu',
        field: 'security_feature',
        label: 'Security Feature',
      },
      {
        objectId: 'app-main',
        field: 'intel_attestation_report',
        label: 'Quote',
        copyable: true,
        isCode: true,
      },
    ],
  },
  'app-gpu': {
    id: 'app-gpu',
    title: 'GPU Attestation',
    vendorTitle: 'Remote Attestation Service',
    intro:
      "This verification uses NVIDIA's Remote Attestation Service (NRAS) to prove that your model is running on genuine NVIDIA hardware in a secure environment. You can independently verify the attestation evidence using NVIDIA's public API.",
    links: [
      {
        text: 'Verify GPU attestation yourself',
        url: 'https://nras.attestation.nvidia.com/v3/attest/gpu',
        isAction: true,
      },
      {
        text: 'Learn about NVIDIA Attestation',
        url: 'https://docs.nvidia.com/confidential-computing/attestation/nras-overview.html',
      },
    ],
    vendorIcon: '/nvidia.svg',
    fields: [
      {objectId: 'app-gpu', field: 'model', label: 'Model'},
      {objectId: 'app-gpu', field: 'switch', label: 'Switch'},
      {
        objectId: 'app-gpu',
        field: 'security_feature',
        label: 'Security Feature',
      },
      {
        objectId: 'app-gpu-quote',
        field: 'nonce',
        label: 'Nonce',
        copyable: true,
      },
      {
        objectId: 'app-gpu-quote',
        field: 'evidence_list',
        label: 'Evidence List',
        copyable: true,
        isJson: true,
      },
      {
        objectId: 'app-gpu-quote',
        field: 'arch',
        label: 'Architecture',
        copyable: true,
      },
    ],
    curlRequest: {
      method: 'POST',
      url: 'https://nras.attestation.nvidia.com/v3/attest/gpu',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      bodyFields: ['nonce', 'evidence_list', 'arch'],
    },
  },
  'app-code': {
    id: 'app-code',
    title: 'App Source Code',
    intro:
      'The Docker Compose file defines the application image and configuration.',
    vendorIcon: '/sigstore.svg',
    fields: [
      {
        objectId: 'app-code',
        field: 'github_repo',
        label: 'Github Repository',
      },
      {
        objectId: 'app-code',
        field: 'git_commit',
        label: 'Git Commit',
      },
      {
        objectId: 'app-code',
        field: 'compose_file',
        label: 'Compose File',
        copyable: true,
        isCode: true,
      },
    ],
  },
  'gateway-main': {
    id: 'gateway-main',
    title: 'Zero Trust Gateway',
    intro:
      'Your network connection is secured by the Zero Trust HTTPS protocol, ensuring that only trusted hardware can control the connection.',
    links: [
      {
        text: 'Learn more about Zero Trust HTTPS',
        url: 'https://docs.phala.network/dstack/design-documents/tee-controlled-domain-certificates',
      },
    ],
    vendorIcon: '/logo.svg',
    fields: [
      {
        objectId: 'gateway-main',
        field: 'endpoint',
        label: 'Guarded Domains',
      },
    ],
  },
  'app-os': {
    id: 'app-os',
    title: 'App OS',
    intro:
      'dstack OS is an open-source TEE operating system with a minimal trusted computing base and no backdoors.',
    links: [
      {
        text: 'Learn more about dstack OS',
        url: 'https://docs.phala.network/dstack/',
      },
    ],
    vendorIcon: '/dstack.svg',
    fields: [
      {objectId: 'app-os', field: 'os', label: 'OS'},
      {objectId: 'app-os', field: 'artifacts', label: 'Release'},
    ],
  },
  'kms-main': {
    id: 'kms-main',
    title: 'Key Management Service',
    vendorIcon: '/logo.svg',
    intro:
      'dstack KMS manages all encryption keys. It is controlled by a smart contract and runs in a TEE P2P network, ensuring no unauthorized access.',
    links: [
      {
        text: 'Learn more about dstack KMS',
        url: 'https://docs.phala.network/dstack/overview',
      },
    ],
    fields: [
      {
        objectId: 'kms-main',
        field: 'registry_smart_contract',
        label: 'Smart Contract',
      },
    ],
  },
}

const isReportItemId = (objectId: string): objectId is ReportItemId => {
  return reportItemsIds.includes(objectId as ReportItemId)
}

// Helper function to get trust item by object ID
export const getReportItem = (objectId: string): ReportItem | undefined => {
  if (isReportItemId(objectId)) {
    return REPORT_ITEMS[objectId]
  }
  return undefined
}
