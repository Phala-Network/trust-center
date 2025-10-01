import { RedpillKmsAppInfo } from '../constants'
import type { AppInfo } from '../types'
import { KmsVerifier } from './kmsVerifier'

/**
 * Redpill-specific KMS verifier implementation.
 *
 * This verifier uses hardcoded application information specifically for Redpill apps.
 * It extends the base KmsVerifier class and provides the DeepseekKmsInfo for getAppInfo().
 */
export class RedpillKmsVerifier extends KmsVerifier {
  /**
   * Retrieves application information using hardcoded RedpillKmsAppInfo.
   * This is the original behavior that worked for Redpill apps.
   */
  protected override async getAppInfo(): Promise<AppInfo> {
    return RedpillKmsAppInfo
  }
}
