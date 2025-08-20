import type {AcmeInfo, AppInfo, CTResult, DataObject, QuoteData, VerifyQuoteResult} from '../types'
import {BaseDataObjectGenerator} from './baseDataObjectGenerator'

/**
 * Data object generator specific to Gateway verifier.
 */
export class GatewayDataObjectGenerator extends BaseDataObjectGenerator {
  constructor(metadata: Record<string, unknown> = {}) {
    super('gateway', metadata)
  }

  /**
   * Generates all DataObjects for Gateway hardware verification.
   */
  generateHardwareDataObjects(
    quoteData: QuoteData,
    verificationResult: VerifyQuoteResult,
  ): DataObject[] {
    const objects: DataObject[] = []

    // Gateway hardware object
    objects.push(this.generateCpuHardwareObject(verificationResult, 1))

    // Gateway quote object
    objects.push(this.generateQuoteObject(verificationResult, 3))

    // Event log objects
    objects.push(...this.generateEventLogObjects(quoteData.eventlog))

    return objects
  }

  /**
   * Generates all DataObjects for Gateway OS verification.
   */
  generateOSDataObjects(appInfo: AppInfo, measurementResult: any): DataObject[] {
    return [this.generateOSObject(appInfo, measurementResult, 3)]
  }

  /**
   * Generates all DataObjects for Gateway source code verification.
   */
  generateSourceCodeDataObjects(
    appInfo: AppInfo,
    quoteData: QuoteData,
    _calculatedHash: string,
    isRegistered: boolean,
    contractAddress: string,
    gatewayRpcEndpoint: string,
    activeCertificate: string,
  ): DataObject[] {
    const objects: DataObject[] = []

    // Gateway main object
    const gateway: DataObject = {
      id: this.generateObjectId('main'),
      name: 'Gateway',
      description:
        "Details and attestation information for the gateway. This represents the gateway's role in securely connecting and registering applications within the network.",
      fields: {
        app_id: contractAddress,
        registry_smart_contract: `https://basescan.org/address/${contractAddress}`,
        attestation_report: quoteData.quote,
        event_log: JSON.stringify(quoteData.eventlog),
        app_cert: activeCertificate,
        allowed_compose_hashes: '["hash1", "hash2"]', // Placeholder
        guarded_domains: '*.example.com', // Placeholder
        registered_apps: '["app1", "app2"]', // Placeholder
        endpoint: gatewayRpcEndpoint,
      },
      layer: 3,
      type: 'network_report',
      kind: 'gateway',
    }

    // Gateway code object
    const gatewayCode = this.generateCodeObject(appInfo, isRegistered, 3)

    objects.push(gateway, gatewayCode)
    return objects
  }

  /**
   * Generates DataObjects for domain verification results.
   */
  generateDomainVerificationDataObjects(
    ctResult: CTResult,
    acmeInfo: AcmeInfo,
  ): DataObject[] {
    const domainVerification: DataObject = {
      id: this.generateObjectId('domain'),
      name: 'Domain Verification',
      description:
        'TEE-controlled domain ownership verification through ACME certificates and Certificate Transparency logs.',
      fields: {
        domain: ctResult.domain,
        tee_controlled: ctResult.tee_controlled,
        certificates_checked: ctResult.verification_details.certificates_checked,
        tee_certificates: ctResult.verification_details.tee_certificates,
        non_tee_certificates: ctResult.verification_details.non_tee_certificates,
        earliest_certificate: ctResult.verification_details.earliest_certificate,
        latest_certificate: ctResult.verification_details.latest_certificate,
        acme_account_uri: acmeInfo.account_uri,
        historical_keys: acmeInfo.hist_keys,
        active_certificate: acmeInfo.active_cert,
      },
      layer: 4,
      type: 'domain_verification',
      kind: 'gateway',
      measuredBy: [
        {
          objectId: this.generateObjectId('main'),
          fieldName: 'app_cert',
        },
      ],
    }

    return [domainVerification]
  }
}