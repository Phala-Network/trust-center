import { getKmsAppInfo } from '../constants'
import type { AppInfo, KmsMetadata, SystemInfo } from '../types'
import { KmsVerifier } from './kmsVerifier'

/**
 * Phala Cloud-specific KMS verifier implementation.
 *
 * This verifier fetches application information from the Phala Cloud API,
 * similar to how PhalaCloudVerifier works but for KMS context.
 */
export class PhalaCloudKmsVerifier extends KmsVerifier {
  /** System information retrieved from Phala Cloud API */
  private readonly systemInfo: SystemInfo

  /**
   * Creates a new Phala Cloud KMS verifier instance.
   */
  constructor(
    contractAddress: `0x${string}`,
    metadata: KmsMetadata,
    chainId: number,
    systemInfo: SystemInfo,
  ) {
    super(contractAddress, metadata, chainId)
    this.systemInfo = systemInfo
  }

  protected override async getAppInfo(): Promise<AppInfo> {
    return getKmsAppInfo(this.systemInfo.kms_info)
  }
}
