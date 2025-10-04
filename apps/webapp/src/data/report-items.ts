import type {ReportItem} from '@/components/visualization/report-item-card'
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
    title: 'TEE CPU',
    intro:
      'Intel TDX provides hardware-based protection to keep your data encrypted and secure, along with a verifiable attestation report.',
    links: [
      {
        text: 'Learn more about Intel TDX',
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
    ],
  },
  'app-gpu': {
    id: 'app-gpu',
    title: 'TEE GPU',
    intro:
      'NVIDIA GPU with confidential computing support secures data and AI models during use.',
    links: [
      {
        text: 'Learn more about NVIDIA Confidential Computing',
        url: 'https://www.nvidia.com/en-us/data-center/solutions/confidential-computing/',
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
    ],
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
