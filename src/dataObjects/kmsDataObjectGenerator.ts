import type {AppInfo, DataObject, QuoteData, VerifyQuoteResult} from '../types'
import {BaseDataObjectGenerator} from './baseDataObjectGenerator'

/**
 * Data object generator specific to KMS verifier.
 */
export class KmsDataObjectGenerator extends BaseDataObjectGenerator {
  constructor(metadata: Record<string, unknown> = {}) {
    super('kms', metadata)
  }

  /**
   * Generates all DataObjects for KMS hardware verification.
   */
  generateHardwareDataObjects(
    quoteData: QuoteData,
    verificationResult: VerifyQuoteResult,
  ): DataObject[] {
    const objects: DataObject[] = []

    // KMS hardware object
    objects.push(this.generateCpuHardwareObject(verificationResult, 1))

    // KMS quote object
    objects.push(this.generateQuoteObject(verificationResult, 2))

    // Event log objects
    objects.push(...this.generateEventLogObjects(quoteData.eventlog))

    return objects
  }

  /**
   * Generates all DataObjects for KMS OS verification.
   */
  generateOSDataObjects(
    appInfo: AppInfo,
    measurementResult: any,
  ): DataObject[] {
    return [this.generateOSObject(appInfo, measurementResult, 3)]
  }

  /**
   * Generates all DataObjects for KMS source code verification.
   */
  generateSourceCodeDataObjects(
    appInfo: AppInfo,
    quoteData: QuoteData,
    _calculatedHash: string,
    contractAddress: string,
    gatewayAppId: string,
    certificateAuthorityPublicKey: string,
  ): DataObject[] {
    const objects: DataObject[] = []

    // KMS main object
    const kms: DataObject = {
      id: this.generateObjectId('main'),
      name: 'KMS',
      description:
        'The KMS Info serves as the root-of-trust for the whole system, managing cryptographic keys and providing authentication for applications.',
      fields: {
        blockchain: 'Base',
        registry_smart_contract: `https://basescan.org/address/${contractAddress}`,
        wallet_pubkey:
          '0x023b01f10326307ced2eaf59c798508f0b2c36c03788445d874b75507b730f6eba',
        cert_pubkey: certificateAuthorityPublicKey,
        attestation_report: quoteData.quote,
        event_log: JSON.stringify(quoteData.eventlog),
        gateway_app_id: gatewayAppId,
      },
      layer: 2,
      type: 'trust_authority',
      kind: 'kms',
    }

    // KMS code object
    const kmsCode = this.generateCodeObject(appInfo, undefined, 2)

    objects.push(kms, kmsCode)
    return objects
  }
}
