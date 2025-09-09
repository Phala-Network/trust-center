import type {
  AcmeInfo,
  AppInfo,
  CTResult,
  DataObject,
  GatewayMetadata,
  QuoteData,
  VerifyQuoteResult,
} from '../types'
import { BaseDataObjectGenerator } from './baseDataObjectGenerator'

/**
 * Extracts the guarded domain pattern from a gateway endpoint URL.
 * Converts https://gateway.example.com -> *.example.com
 */
function extractGuardedDomain(endpoint: string): string {
  try {
    const url = new URL(endpoint)
    const hostname = url.hostname

    // Split hostname and replace the first part with wildcard
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      return `*.${parts.slice(1).join('.')}`
    }

    return `*.${hostname}`
  } catch {
    // If URL parsing fails, return the original string with wildcard prefix
    return `*.${endpoint}`
  }
}

/**
 * Data object generator specific to Gateway verifier.
 */
export class GatewayDataObjectGenerator extends BaseDataObjectGenerator {
  constructor(metadata: GatewayMetadata) {
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
    objects.push(this.generateCpuHardwareObject(verificationResult))

    // Gateway quote object
    objects.push(this.generateQuoteObject(verificationResult))

    // Event log objects
    objects.push(...this.generateEventLogObjects(quoteData.eventlog))

    return objects
  }

  /**
   * Generates all DataObjects for Gateway OS verification.
   */
  generateOSDataObjects(appInfo: AppInfo): DataObject[] {
    const objects: DataObject[] = []

    // Gateway OS object
    objects.push(this.generateOSObject(appInfo))

    // Gateway OS Code object
    objects.push(this.generateOSCodeObject())

    return objects
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
    allowedComposeHashes?: string[],
    guardedDomains?: string[],
    registeredApps?: string[],
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
        registry_smart_contract: `${(this.metadata as GatewayMetadata).governance?.blockchainExplorerUrl}/address/${contractAddress}`,
        endpoint: gatewayRpcEndpoint,
        guarded_domain: extractGuardedDomain(gatewayRpcEndpoint),
        intel_attestation_report: quoteData.quote,
        event_log: JSON.stringify(quoteData.eventlog),
        app_cert: activeCertificate,
        allowed_compose_hashes: allowedComposeHashes
          ? JSON.stringify(allowedComposeHashes)
          : undefined,
        guarded_domains: guardedDomains
          ? JSON.stringify(guardedDomains)
          : undefined,
        registered_apps: registeredApps
          ? JSON.stringify(registeredApps)
          : undefined,
      },
      kind: 'gateway',
      measuredBy: [
        {
          selfFieldName: 'app_id',
          objectId: 'kms',
          fieldName: 'gateway_app_id',
        },
        ...(registeredApps && registeredApps.length > 0
          ? [
              {
                selfFieldName: 'registered_apps',
                objectId: 'app-main',
                fieldName: 'app_id',
              },
            ]
          : []),
      ],
    }

    // Gateway code object
    const gatewayCode = this.generateCodeObject(appInfo, isRegistered)

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
        certificates_checked:
          ctResult.verification_details.certificates_checked,
        tee_certificates: ctResult.verification_details.tee_certificates,
        non_tee_certificates:
          ctResult.verification_details.non_tee_certificates,
        earliest_certificate:
          ctResult.verification_details.earliest_certificate,
        latest_certificate: ctResult.verification_details.latest_certificate,
        acme_account_uri: acmeInfo.account_uri,
        historical_keys: acmeInfo.hist_keys,
        active_certificate: acmeInfo.active_cert,
      },
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
