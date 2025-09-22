/**
 * Lightweight stub verifiers for legacy Phala Cloud versions that cannot be verified
 * but need to generate hardcoded data objects
 */

import type { DataObject, SystemInfo } from '../types'
import { versionToSourceInfo } from '../utils/metadataUtils'
import { Verifier } from '../verifier'

/**
 * Legacy KMS stub verifier - generates hardcoded KMS data objects for legacy versions
 */
export class LegacyKmsStubVerifier extends Verifier {
  private systemInfo: SystemInfo

  constructor(systemInfo: SystemInfo) {
    // Create minimal metadata for the stub verifier
    super(
      {
        osSource: versionToSourceInfo(systemInfo.kms_info.version),
        appSource: versionToSourceInfo(systemInfo.kms_info.version, 'kms'),
        hardware: {
          cpuManufacturer: 'Intel Corporation',
          cpuModel: 'Intel(R) Xeon(R) CPU',
          securityFeature: 'Intel Trust Domain Extensions (TDX)',
          hasNvidiaSupport: false,
        },
        governance: {
          type: 'HostedBy',
          host: 'Phala',
        },
      },
      'kms',
    )

    this.systemInfo = systemInfo
    this.generateLegacyDataObjects()
  }

  private generateLegacyDataObjects(): void {
    const sourceInfo = versionToSourceInfo(
      this.systemInfo.kms_info.version,
      'kms',
    )

    // Generate kms-main object
    const kmsMain: DataObject = {
      id: 'kms-main',
      name: 'KMS',
      description:
        'The KMS Info serves as the root-of-trust for the whole system, managing cryptographic keys and providing authentication for applications.',
      fields: {
        hosted_by: 'Phala Cloud',
      },
      kind: 'kms',
    }

    // Generate kms source object
    const kmsSource: DataObject = {
      id: 'kms-source',
      name: 'KMS Source Code',
      description: 'Source code information for the KMS component',
      fields: {
        github_repo: sourceInfo.github_repo,
        git_commit: sourceInfo.git_commit,
        version: sourceInfo.version,
      },
      kind: 'kms',
    }

    this.createDataObject(kmsMain)
    this.createDataObject(kmsSource)
  }

  public async verifyHardware(): Promise<boolean> {
    return true // Legacy versions cannot be verified
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    return true // Legacy versions cannot be verified
  }

  public async verifySourceCode(): Promise<boolean> {
    return true // Legacy versions cannot be verified
  }
}

/**
 * Legacy Gateway stub verifier - generates hardcoded Gateway data objects for legacy versions
 */
export class LegacyGatewayStubVerifier extends Verifier {
  private systemInfo: SystemInfo

  constructor(systemInfo: SystemInfo) {
    // Create minimal metadata for the stub verifier
    super(
      {
        osSource: versionToSourceInfo(systemInfo.kms_info.version),
        appSource: versionToSourceInfo(systemInfo.kms_info.version, 'gateway'),
        hardware: {
          cpuManufacturer: 'Intel Corporation',
          cpuModel: 'Intel(R) Xeon(R) CPU',
          securityFeature: 'Intel Trust Domain Extensions (TDX)',
          hasNvidiaSupport: false,
        },
        governance: {
          type: 'HostedBy',
          host: 'Phala',
        },
      },
      'gateway',
    )

    this.systemInfo = systemInfo
    this.generateLegacyDataObjects()
  }

  private generateLegacyDataObjects(): void {
    const sourceInfo = versionToSourceInfo(
      this.systemInfo.kms_info.version,
      'gateway',
    )

    // Generate gateway-main object
    const gatewayMain: DataObject = {
      id: 'gateway-main',
      name: 'Gateway',
      description:
        "Details and attestation information for the gateway. This represents the gateway's role in securely connecting and registering applications within the network.",
      fields: {
        hosted_by: 'Phala Cloud',
      },
      kind: 'gateway',
    }

    // Generate gateway source object
    const gatewaySource: DataObject = {
      id: 'gateway-source',
      name: 'Gateway Source Code',
      description: 'Source code information for the Gateway component',
      fields: {
        github_repo: sourceInfo.github_repo,
        git_commit: sourceInfo.git_commit,
        version: sourceInfo.version,
      },
      kind: 'gateway',
    }

    this.createDataObject(gatewayMain)
    this.createDataObject(gatewaySource)
  }

  public async verifyHardware(): Promise<boolean> {
    return true // Legacy versions cannot be verified
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    return true // Legacy versions cannot be verified
  }

  public async verifySourceCode(): Promise<boolean> {
    return true // Legacy versions cannot be verified
  }
}
