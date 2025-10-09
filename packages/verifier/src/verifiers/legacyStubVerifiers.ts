/**
 * Lightweight stub verifiers for legacy Phala Cloud versions that cannot be verified
 * but need to generate hardcoded data objects
 */

import type {
  AppInfo,
  AttestationBundle,
  DataObject,
  QuoteData,
  SystemInfo,
} from '../types'
import type { DataObjectCollector } from '../utils/dataObjectCollector'
import { kmsVersionToSourceInfo } from '../utils/metadataUtils'
import { Verifier } from '../verifier'

/**
 * Legacy KMS stub verifier - generates hardcoded KMS data objects for legacy versions
 */
export class LegacyKmsStubVerifier extends Verifier {
  private systemInfo: SystemInfo

  constructor(systemInfo: SystemInfo, collector: DataObjectCollector) {
    // Create minimal metadata for the stub verifier
    super(
      {
        osSource: kmsVersionToSourceInfo(systemInfo.kms_info.version),
        appSource: kmsVersionToSourceInfo(systemInfo.kms_info.version, 'kms'),
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
      collector,
    )

    this.systemInfo = systemInfo
    this.generateLegacyDataObjects()
  }

  private generateLegacyDataObjects(): void {
    const sourceInfo = kmsVersionToSourceInfo(
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
      measuredBy: [
        {
          objectId: 'kms-main',
        },
      ],
    }

    // Generate kms hardware object
    const kmsHardware: DataObject = {
      id: 'kms-cpu',
      name: 'KMS TEE Hardware',
      description:
        'Hardware platform details for the kms Trusted Execution Environment, including manufacturer, model, and supported security features.',
      fields: {
        manufacturer:
          this.metadata.hardware?.cpuManufacturer ?? 'Intel Corporation',
        model: this.metadata.hardware?.cpuModel ?? 'Intel(R) Xeon(R) CPU',
        security_feature:
          this.metadata.hardware?.securityFeature ??
          'Intel Trust Domain Extensions (TDX)',
        verification_status: 'Legacy version cannot be verified',
      },
      kind: 'kms',
      measuredBy: [
        {
          objectId: 'kms-main',
        },
      ],
    }

    this.createDataObject(kmsMain)
    this.createDataObject(kmsSource)
    this.createDataObject(kmsHardware)
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

  public async getQuote(): Promise<QuoteData> {
    throw new Error('Not implemented for legacy stub verifier')
  }

  public async getAttestation(): Promise<AttestationBundle | null> {
    throw new Error('Not implemented for legacy stub verifier')
  }

  public async getAppInfo(): Promise<AppInfo> {
    throw new Error('Not implemented for legacy stub verifier')
  }
}

/**
 * Legacy Gateway stub verifier - generates hardcoded Gateway data objects for legacy versions
 */
export class LegacyGatewayStubVerifier extends Verifier {
  private systemInfo: SystemInfo

  constructor(systemInfo: SystemInfo, collector: DataObjectCollector) {
    // Create minimal metadata for the stub verifier
    super(
      {
        osSource: kmsVersionToSourceInfo(systemInfo.kms_info.version),
        appSource: kmsVersionToSourceInfo(
          systemInfo.kms_info.version,
          'gateway',
        ),
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
      collector,
    )

    this.systemInfo = systemInfo
    this.generateLegacyDataObjects()
  }

  private generateLegacyDataObjects(): void {
    const sourceInfo = kmsVersionToSourceInfo(
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
      measuredBy: [
        {
          objectId: 'gateway-main',
        },
      ],
    }

    // Generate gateway hardware object
    const gatewayHardware: DataObject = {
      id: 'gateway-cpu',
      name: 'Gateway TEE Hardware',
      description:
        'Hardware platform details for the gateway Trusted Execution Environment, including manufacturer, model, and supported security features.',
      fields: {
        manufacturer:
          this.metadata.hardware?.cpuManufacturer ?? 'Intel Corporation',
        model: this.metadata.hardware?.cpuModel ?? 'Intel(R) Xeon(R) CPU',
        security_feature:
          this.metadata.hardware?.securityFeature ??
          'Intel Trust Domain Extensions (TDX)',
        verification_status: 'Legacy version cannot be verified',
      },
      kind: 'gateway',
      measuredBy: [
        {
          objectId: 'gateway-main',
        },
      ],
    }

    this.createDataObject(gatewayMain)
    this.createDataObject(gatewaySource)
    this.createDataObject(gatewayHardware)
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

  public async getQuote(): Promise<QuoteData> {
    throw new Error('Not implemented for legacy stub verifier')
  }

  public async getAttestation(): Promise<AttestationBundle | null> {
    throw new Error('Not implemented for legacy stub verifier')
  }

  public async getAppInfo(): Promise<AppInfo> {
    throw new Error('Not implemented for legacy stub verifier')
  }
}
