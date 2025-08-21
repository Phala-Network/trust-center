import type {
  AppInfo,
  AttestationBundle,
  DataObject,
  QuoteData,
  VerifyQuoteResult,
} from '../types'
import {BaseDataObjectGenerator} from './baseDataObjectGenerator'

/**
 * Data object generator specific to Redpill (App) verifier.
 */
export class RedpillDataObjectGenerator extends BaseDataObjectGenerator {
  constructor(metadata: Record<string, unknown> = {}) {
    super('app', metadata)
  }

  /**
   * Generates all DataObjects for App hardware verification (CPU + GPU).
   */
  generateHardwareDataObjects(
    quoteData: QuoteData,
    verificationResult: VerifyQuoteResult,
    attestationBundle: AttestationBundle,
  ): DataObject[] {
    const objects: DataObject[] = []

    // App CPU hardware object
    objects.push(this.generateCpuHardwareObject(verificationResult, 3))

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
      layer: 3,
      type: 'hardware_report',
      kind: 'app',
      measuredBy: [
        {
          objectId: this.generateObjectId('gpu-quote'),
        },
      ],
    }

    // App Intel quote object
    objects.push(this.generateQuoteObject(verificationResult, 4))

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
      layer: 3,
      type: 'application_report',
      kind: 'app',
      measuredBy: [
        {
          objectId: this.generateObjectId('main'),
          fieldName: 'nvidia_attestation_report',
        },
      ],
    }

    // Event log objects
    objects.push(...this.generateEventLogObjects(quoteData.eventlog))
    objects.push(appGpu, gpuQuote)

    return objects
  }

  /**
   * Generates all DataObjects for App OS verification.
   */
  generateOSDataObjects(
    appInfo: AppInfo,
    measurementResult: any,
  ): DataObject[] {
    return [this.generateOSObject(appInfo, measurementResult, 3)]
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
  ): DataObject[] {
    const objects: DataObject[] = []

    // App main object
    const app: DataObject = {
      id: this.generateObjectId('main'),
      name: 'App',
      description:
        'Deepseek V3 model running in TEE GPU, powered by the vllm project',
      fields: {
        app_id: appInfo.app_id,
        instance_id: appInfo.instance_id || '',
        sig_pubkey: '0x12C2CE9007DC00158FB17c6BCAd3f9c4e3C226Ba',
        intel_attestation_report: quoteData.quote,
        nvidia_attestation_report: attestationBundle?.nvidia_payload
          ? JSON.stringify(attestationBundle.nvidia_payload)
          : undefined,
        event_log: JSON.stringify(quoteData.eventlog),
        app_cert: appInfo.app_cert || 'N/A',
        device_id: appInfo.device_id,
        compose_hash: calculatedHash,
        mr_aggregated: appInfo.mr_aggregated,
        os_image_hash: appInfo.os_image_hash,
        is_registered: isRegistered,
      },
      layer: 3,
      type: 'application_report',
      kind: 'app',
    }

    // App code object
    const appCode = this.generateCodeObject(appInfo, isRegistered, 3)

    objects.push(app, appCode)
    return objects
  }
}
