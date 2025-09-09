import { getKmsAppInfo } from '../constants'
import type { AppInfo } from '../types'
import { KmsVerifier } from './kmsVerifier'

/**
 * Phala Cloud-specific KMS verifier implementation.
 *
 * This verifier fetches application information from the Phala Cloud API,
 * similar to how PhalaCloudVerifier works but for KMS context.
 */
export class PhalaCloudKmsVerifier extends KmsVerifier {
  protected override async getAppInfo(): Promise<AppInfo> {
    return getKmsAppInfo(this.systemInfo.kms_info)
  }
}
