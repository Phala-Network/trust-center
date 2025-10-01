// Field documentation for attestation data
// Each description can apply to multiple object-field combinations

export interface FieldDocumentation {
  description: string
  objectFieldPairs: Array<{
    objectId: string
    fieldName: string
  }>
}

export const fieldDocumentation: FieldDocumentation[] = [
  // Web3 jargons
  {
    description:
      'The governance smart contract responsible for managing application lifecycle, including deployment and updates. It enforces security by validating code hashes and specifying compatible TEE hardware.',
    objectFieldPairs: [
      {objectId: 'kms', fieldName: 'registry_smart_contract'},
      {objectId: 'gateway', fieldName: 'registry_smart_contract'},
      {objectId: 'app_info', fieldName: 'registry_smart_contract'},
    ],
  },

  // TDX quote fields
  {
    description:
      'TEE Trusted Computing Base Security Version Number. This identifies the security version of the TEE implementation and is used to verify that the TEE is running an approved version.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'tee_tcb_svn'},
      {objectId: 'gateway-quote', fieldName: 'tee_tcb_svn'},
      {objectId: 'app-quote', fieldName: 'tee_tcb_svn'},
    ],
  },
  {
    description:
      'Measurement of TDX-Module. The cryptographic measurement of the SEAM (Secure Arbitration Mode) firmware. This is a hash representing the identity and integrity of the TDX module firmware.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'mrseam'},
      {objectId: 'gateway-quote', fieldName: 'mrseam'},
      {objectId: 'app-quote', fieldName: 'mrseam'},
    ],
  },
  {
    description:
      'Attributes of the SEAM (Secure Arbitration Mode). This shows the configuration flags for the SEAM firmware.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'seamattributes'},
      {objectId: 'gateway-quote', fieldName: 'seamattributes'},
      {objectId: 'app-quote', fieldName: 'seamattributes'},
    ],
  },
  {
    description:
      'Attributes of the Trust Domain. This shows the configuration flags for the Trust Domain.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'tdattributes'},
      {objectId: 'gateway-quote', fieldName: 'tdattributes'},
      {objectId: 'app-quote', fieldName: 'tdattributes'},
    ],
  },
  {
    description:
      'eXtended Feature Activation Mask. This controls which extended features are enabled in the TDX environment.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'xfam'},
      {objectId: 'gateway-quote', fieldName: 'xfam'},
      {objectId: 'app-quote', fieldName: 'xfam'},
    ],
  },
  {
    description:
      'Measurement Register for Trust Domain. This captures the initial state of the Trust Domain when it was created.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'mrtd'},
      {objectId: 'gateway-quote', fieldName: 'mrtd'},
      {objectId: 'app-quote', fieldName: 'mrtd'},
    ],
  },
  {
    description:
      'RunTime Measurement Registers. These registers are used to measure and protect the integrity of code and data loaded at runtime within a Trust Domain.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'rtmr0'},
      {objectId: 'kms-quote', fieldName: 'rtmr1'},
      {objectId: 'kms-quote', fieldName: 'rtmr2'},

      {objectId: 'gateway-quote', fieldName: 'rtmr0'},
      {objectId: 'gateway-quote', fieldName: 'rtmr1'},
      {objectId: 'gateway-quote', fieldName: 'rtmr2'},

      {objectId: 'app-quote', fieldName: 'rtmr0'},
      {objectId: 'app-quote', fieldName: 'rtmr1'},
      {objectId: 'app-quote', fieldName: 'rtmr2'},
    ],
  },
  {
    description:
      "Application-specific Measurement Register. In dstack's implementation, RTMR3 is dedicated to application-specific measurements including app-id, compose-hash, instance-id, and key-provider.",
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'rtmr3'},

      {objectId: 'gateway-quote', fieldName: 'rtmr3'},

      {objectId: 'app-quote', fieldName: 'rtmr3'},
    ],
  },
  {
    description:
      'User-specified data that gets included in the quote. A 64-byte field that applications can fill with custom data (such as nonces, challenge responses, or application state hashes).',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'reportdata'},

      {objectId: 'gateway-quote', fieldName: 'reportdata'},

      {objectId: 'app-quote', fieldName: 'reportdata'},
    ],
  },
  {
    description:
      'Configuration and ownership information. These fields can contain configuration data for more complex attestation scenarios.',
    objectFieldPairs: [
      {objectId: 'kms-quote', fieldName: 'mrconfig'},
      {objectId: 'kms-quote', fieldName: 'mrowner'},
      {objectId: 'kms-quote', fieldName: 'mrownerconfig'},

      {objectId: 'gateway-quote', fieldName: 'mrconfig'},
      {objectId: 'gateway-quote', fieldName: 'mrowner'},
      {objectId: 'gateway-quote', fieldName: 'mrownerconfig'},

      {objectId: 'app-quote', fieldName: 'mrconfig'},
      {objectId: 'app-quote', fieldName: 'mrowner'},
      {objectId: 'app-quote', fieldName: 'mrownerconfig'},
    ],
  },

  // Nvidia payload fields
  {
    description:
      'Attestation report from Nvidia GPU. The certificate is from the NVIDIA Certificate Authority. This can be verified with the NVIDIA Remote Attestation Service (NRAS).',
    objectFieldPairs: [
      {objectId: 'app', fieldName: 'nvidia_attestation_report'},
    ],
  },
]

// Helper function to get field description
export function getFieldDescription(
  objectId: string,
  fieldName: string,
): string | null {
  for (const doc of fieldDocumentation) {
    const match = doc.objectFieldPairs.find(
      (pair) => pair.objectId === objectId && pair.fieldName === fieldName,
    )
    if (match) {
      return doc.description
    }
  }
  return null
}
