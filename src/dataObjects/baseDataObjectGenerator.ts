import type {AppInfo, DataObject, QuoteData, VerifyQuoteResult} from '../types'
import {createEventLogDataObjects} from '../utils/dataObjectCollector'

/**
 * Base class for generating DataObjects across different verifier types.
 */
export abstract class BaseDataObjectGenerator {
  protected verifierType: 'kms' | 'gateway' | 'app'
  protected metadata: Record<string, unknown>

  constructor(
    verifierType: 'kms' | 'gateway' | 'app',
    metadata: Record<string, unknown> = {},
  ) {
    this.verifierType = verifierType
    this.metadata = metadata
  }

  /**
   * Generates a unique object ID for a given component type.
   */
  protected generateObjectId(component: string): string {
    return `${this.verifierType}_${component}`
  }

  /**
   * Generates common hardware DataObjects for CPU verification.
   */
  protected generateCpuHardwareObject(
    verificationResult: VerifyQuoteResult,
    layer: number = 3,
  ): DataObject {
    const typeMap = {
      kms: 'trust_authority',
      gateway: 'network_report',
      app: 'hardware_report',
    }

    return {
      id: this.generateObjectId('hardware'),
      name: `${this.verifierType.toUpperCase()} TEE Hardware`,
      description: `Hardware platform details for the ${this.verifierType} Trusted Execution Environment, including manufacturer, model, and supported security features.`,
      fields: {
        manufacturer: 'Intel Corporation',
        model: 'Intel(R) Xeon(R) CPU',
        security_feature: 'Intel Trust Domain Extensions (TDX)',
        verification_status: verificationResult.status,
        advisory_ids: verificationResult.advisory_ids || [],
      },
      layer,
      type: typeMap[this.verifierType],
      kind: this.verifierType,
      measuredBy:
        this.verifierType === 'kms'
          ? [
              {
                objectId: this.generateObjectId('quote'),
              },
            ]
          : undefined,
    }
  }

  /**
   * Generates common quote DataObjects for Intel attestation.
   */
  protected generateQuoteObject(
    verificationResult: VerifyQuoteResult,
    layer: number = 3,
  ): DataObject {
    const typeMap = {
      kms: 'trust_authority',
      gateway: 'network_report',
      app: 'application_report',
    }

    return {
      id: this.generateObjectId('quote'),
      name: `${this.verifierType.toUpperCase()} Attestation Report`,
      description: `Cryptographic attestation report by the ${this.verifierType} node's TEE. Used to prove the integrity and authenticity of the ${this.verifierType}.`,
      fields: {
        tee_tcb_svn: verificationResult.report?.TD10?.tee_tcb_svn || '',
        mrseam: verificationResult.report?.TD10?.mr_seam || '',
        mrsignerseam: verificationResult.report?.TD10?.mr_signer_seam || '',
        seamattributes: verificationResult.report?.TD10?.seam_attributes || '',
        tdattributes: verificationResult.report?.TD10?.td_attributes || '',
        xfam: verificationResult.report?.TD10?.xfam || '',
        mrtd: verificationResult.report?.TD10?.mr_td || '',
        mrconfig: verificationResult.report?.TD10?.mr_config_id || '',
        mrowner: verificationResult.report?.TD10?.mr_owner || '',
        mrownerconfig: verificationResult.report?.TD10?.mr_owner_config || '',
        rtmr0: verificationResult.report?.TD10?.rt_mr0 || '',
        rtmr1: verificationResult.report?.TD10?.rt_mr1 || '',
        rtmr2: verificationResult.report?.TD10?.rt_mr2 || '',
        rtmr3: verificationResult.report?.TD10?.rt_mr3 || '',
        reportdata: verificationResult.report?.TD10?.report_data || '',
      },
      layer,
      type: typeMap[this.verifierType],
      kind: this.verifierType,
      measuredBy: [
        {
          objectId: this.generateObjectId('main'),
          fieldName:
            this.verifierType === 'app'
              ? 'intel_attestation_report'
              : 'attestation_report',
        },
      ],
    }
  }

  /**
   * Generates OS DataObjects for operating system verification.
   */
  protected generateOSObject(
    appInfo: AppInfo,
    measurementResult: any,
    layer: number = 3,
  ): DataObject {
    const typeMap = {
      kms: 'trust_authority',
      gateway: 'network_report',
      app: 'application_report',
    }

    const osVersion = this.metadata.osVersion || '0.5.3'
    const gitRevision = this.metadata.gitRevision || ''
    const isNvidiaVariant = this.verifierType === 'app'

    return {
      id: this.generateObjectId('os'),
      name: `${this.verifierType.toUpperCase()} OS`,
      description: `Integrity measurements and configuration of the ${this.verifierType} operating system, including version, kernel, and boot parameters.`,
      fields: {
        os: `dstack v${osVersion}${isNvidiaVariant ? ' (nvidia)' : ''}`,
        version: osVersion,
        git_revision: gitRevision,
        artifacts: `https://github.com/Dstack-TEE/meta-dstack/releases/tag/v${osVersion}`,
        shared_ro: true,
        is_dev: true,
        bios: 'ovmf.fd',
        vm_config: JSON.stringify(appInfo.vm_config),
        kernel: 'bzImage',
        initrd: 'initramfs.cpio.gz',
        rootfs: 'rootfs.img.verity',
        measured_mrtd: measurementResult.mrtd,
        measured_rtmr0: measurementResult.rtmr0,
        measured_rtmr1: measurementResult.rtmr1,
        measured_rtmr2: measurementResult.rtmr2,
        ...(isNvidiaVariant && {gpu_enabled: true}),
      },
      layer,
      type: typeMap[this.verifierType],
      kind: this.verifierType,
      calculations: [
        {
          inputs: ['bios'],
          calcFunc: 'sha384',
          outputs: ['mrtd'],
        },
        {
          inputs: ['vm_config'],
          calcFunc: 'sha384',
          outputs: ['rtmr0'],
        },
        {
          inputs: ['kernel', 'initrd'],
          calcFunc: 'sha384',
          outputs: ['rtmr1'],
        },
        {
          inputs: ['rootfs'],
          calcFunc: 'sha384',
          outputs: ['rtmr2'],
        },
        ...(isNvidiaVariant
          ? [
              {
                inputs: ['bios', 'vm_config', 'kernel', 'initrd', 'rootfs'],
                calcFunc: 'sha384',
                outputs: ['os_image_hash'],
              },
            ]
          : []),
      ],
      measuredBy: [
        {
          selfCalcOutputName: 'mrtd',
          objectId: this.generateObjectId('quote'),
          fieldName: 'mrtd',
        },
        {
          selfCalcOutputName: 'rtmr0',
          objectId: this.generateObjectId('quote'),
          fieldName: 'rtmr0',
        },
        {
          selfCalcOutputName: 'rtmr1',
          objectId: this.generateObjectId('quote'),
          fieldName: 'rtmr1',
        },
        {
          selfCalcOutputName: 'rtmr2',
          objectId: this.generateObjectId('quote'),
          fieldName: 'rtmr2',
        },
      ],
    }
  }

  /**
   * Generates event log DataObjects.
   */
  protected generateEventLogObjects(
    eventlog: QuoteData['eventlog'],
  ): DataObject[] {
    return createEventLogDataObjects(
      eventlog,
      'event_logs',
      4,
      this.verifierType,
    )
  }

  /**
   * Generates code DataObject for source code verification.
   */
  protected generateCodeObject(
    appInfo: AppInfo,
    isRegistered?: boolean,
    layer: number = 3,
  ): DataObject {
    const typeMap = {
      kms: 'trust_authority',
      gateway: 'network_report',
      app: 'application_report',
    }

    const repoMap = {
      kms: 'https://github.com/Dstack-TEE/dstack/tree/main/kms',
      gateway: 'https://github.com/Dstack-TEE/dstack/tree/main/gateway',
      app: 'https://github.com/nearai/private-ml-sdk/tree/main',
    }

    const fields: Record<string, unknown> = {
      github_repo: repoMap[this.verifierType],
      git_commit: this.metadata.gitRevision || '',
      version:
        this.verifierType === 'app'
          ? 'dev'
          : this.metadata.osVersion || 'v0.5.3',
      compose_file: appInfo.tcb_info.app_compose,
    }

    if (isRegistered !== undefined) {
      fields.is_registered = isRegistered
    }

    if (this.verifierType === 'app') {
      fields.model_name = 'deepseek/deepseek-chat-v3-0324'
    }

    return {
      id: this.generateObjectId('code'),
      name: `${this.verifierType.toUpperCase()} Code`,
      description: `Source code and deployment configuration for the ${this.verifierType} service, including compose files and version information.`,
      fields,
      layer,
      type: typeMap[this.verifierType],
      kind: this.verifierType,
      calculations: [
        {
          inputs: ['compose_file'],
          calcFunc: 'sha256',
          outputs: ['compose_hash'],
        },
      ],
      measuredBy: [
        {
          selfCalcOutputName: 'compose_hash',
          objectId: this.generateObjectId('main'),
          fieldName: 'event_log',
        },
      ],
    }
  }
}
