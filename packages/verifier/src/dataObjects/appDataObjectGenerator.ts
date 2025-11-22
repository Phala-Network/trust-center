import type {
  AppInfo,
  AppMetadata,
  AttestationBundle,
  CompleteAppMetadata,
  DataObject,
  QuoteData,
  VerifyQuoteResult,
} from '../types'
import {BaseDataObjectGenerator} from './baseDataObjectGenerator'

/**
 * Data object generator specific to App verifier.
 */
export class AppDataObjectGenerator extends BaseDataObjectGenerator {
  constructor(metadata: CompleteAppMetadata) {
    super('app', metadata)
  }

  /**
   * Generates all DataObjects for App hardware verification (CPU + GPU).
   */
  generateHardwareDataObjects(
    quoteData: QuoteData,
    verificationResult: VerifyQuoteResult,
    attestationBundle?: AttestationBundle,
  ): DataObject[] {
    const objects: DataObject[] = []

    // App CPU hardware object
    objects.push(this.generateCpuHardwareObject(verificationResult))
    objects.push(this.generateQuoteObject(verificationResult))
    objects.push(...this.generateEventLogObjects(quoteData.eventlog))

    // Only generate GPU objects if attestationBundle is provided
    if (attestationBundle) {
      // App GPU hardware object
      const appGpu: DataObject = {
        id: this.generateObjectId('gpu'),
        name: 'App TEE GPU',
        description:
          'Graphic processor details for the application Trusted Execution Environment, including manufacturer, model, and supported security features.',
        fields: {
          manufacturer: 'Nvidia Corporation',
          arch: attestationBundle.nvidia_payload.arch || 'HOPPER',
          model: 'NVIDIA H200 Tensor Core GPU x 8',
          switch: 'NVLink Switch x 4',
          memory: '141GB x 8',
          security_feature: 'Confidential Computing mode',
        },
        kind: 'app',
        measuredBy: [
          {
            objectId: this.generateObjectId('gpu-quote'),
          },
        ],
      }

      // App GPU quote object
      const gpuQuote: DataObject = {
        id: this.generateObjectId('gpu-quote'),
        name: 'GPU Attestation Report',
        description:
          "Cryptographic attestation report by the application node's GPU. Used to prove the integrity and authenticity of the GPU program and data.",
        fields: {
          nonce: attestationBundle.nvidia_payload.nonce || '',
          evidence_list:
            attestationBundle.nvidia_payload.evidence_list?.map((evidence) => ({
              certificate: evidence.certificate,
              evidence: evidence.evidence,
              arch: evidence.arch,
            })) || [],
          arch: attestationBundle.nvidia_payload.arch || 'HOPPER',
        },
        kind: 'app',
        measuredBy: [
          {
            objectId: this.generateObjectId('main'),
            fieldName: 'nvidia_attestation_report',
          },
        ],
      }

      objects.push(appGpu, gpuQuote)
    }

    return objects
  }

  /**
   * Generates all DataObjects for App OS verification.
   */
  generateOSDataObjects(
    appInfo: AppInfo,
    hasNvidiaSupport: boolean = false,
  ): DataObject[] {
    const objects: DataObject[] = []

    // App OS object
    objects.push(this.generateOSObject(appInfo, hasNvidiaSupport))

    // App OS Code object
    objects.push(this.generateOSCodeObject())

    return objects
  }

  /**
   * Generates all DataObjects for App source code verification.
   */
  generateSourceCodeDataObjects(
    appInfo: AppInfo,
    quoteData: QuoteData,
    calculatedHash: string,
    isRegistered: boolean,
    attestationBundle?: AttestationBundle,
    endpoint?: string,
  ): DataObject[] {
    const objects: DataObject[] = []

    // App main object
    const app: DataObject = {
      id: this.generateObjectId('main'),
      name: 'App',
      description: '',
      fields: {
        app_id: appInfo.app_id,
        instance_id: appInfo.instance_id || '',
        ...(() => {
          const governance = (this.metadata as AppMetadata).governance
          return governance?.type === 'OnChain'
            ? {
                registry_smart_contract: `${governance.blockchainExplorerUrl}/address/${appInfo.app_id}`,
              }
            : {}
        })(),
        endpoint: endpoint,
        intel_attestation_report: quoteData.quote,
        nvidia_attestation_report: attestationBundle?.nvidia_payload
          ? JSON.stringify(attestationBundle.nvidia_payload)
          : undefined,
        event_log: JSON.stringify(quoteData.eventlog),
        app_cert: appInfo.app_cert || 'N/A',
        device_id: appInfo.device_id || 'N/A',
        compose_hash: calculatedHash,
        mr_aggregated: appInfo.mr_aggregated || 'N/A',
        os_image_hash: appInfo.os_image_hash || 'N/A',
        is_registered: isRegistered,
      },
      kind: 'app',
    }

    objects.push(app)

    const appCode = this.generateCodeObject(appInfo, isRegistered)
    objects.push(appCode)

    return objects
  }
}
