import type {
  AppInfo,
  DataObject,
  KmsMetadata,
  QuoteData,
  VerifyQuoteResult,
} from '../types'
import { BaseDataObjectGenerator } from './baseDataObjectGenerator'

/**
 * Data object generator specific to KMS verifier.
 */
export class KmsDataObjectGenerator extends BaseDataObjectGenerator {
  constructor(metadata: KmsMetadata) {
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
    objects.push(this.generateCpuHardwareObject(verificationResult))

    // KMS quote object
    objects.push(this.generateQuoteObject(verificationResult))

    // Event log objects
    objects.push(...this.generateEventLogObjects(quoteData.eventlog))

    return objects
  }

  /**
   * Generates all DataObjects for KMS OS verification.
   */
  generateOSDataObjects(appInfo: AppInfo): DataObject[] {
    const objects: DataObject[] = []

    // KMS OS object
    objects.push(this.generateOSObject(appInfo))

    // KMS OS Code object
    objects.push(this.generateOSCodeObject())

    return objects
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
        blockchain: (this.metadata as KmsMetadata).governance?.blockchain,
        registry_smart_contract: `${(this.metadata as KmsMetadata).governance?.blockchainExplorerUrl}/address/${contractAddress}`,
        wallet_pubkey:
          '0x023b01f10326307ced2eaf59c798508f0b2c36c03788445d874b75507b730f6eba',
        cert_pubkey: certificateAuthorityPublicKey,
        intel_attestation_report: quoteData.quote,
        event_log: JSON.stringify(quoteData.eventlog),
        gateway_app_id: gatewayAppId,
      },
      kind: 'kms',
    }

    // KMS code object
    const kmsCode = this.generateCodeObject(appInfo, undefined)

    objects.push(kms, kmsCode)
    return objects
  }
}
