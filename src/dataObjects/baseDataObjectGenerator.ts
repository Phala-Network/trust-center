import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type {
  AppInfo,
  CompleteAppMetadata,
  DataObject,
  GatewayMetadata,
  KmsMetadata,
  LogEntry,
  QuoteData,
  VerifyQuoteResult,
} from '../types'

/**
 * Interface for DStack image metadata from external/dstack-images directory
 */
interface DStackImageMetadata {
  bios: string
  kernel: string
  cmdline: string
  initrd: string
  rootfs: string
  version: string
  git_revision: string
  shared_ro: boolean
  is_dev: boolean
}

/**
 * Base class for generating DataObjects across different verifier types.
 */
export abstract class BaseDataObjectGenerator {
  protected verifierType: 'kms' | 'gateway' | 'app'
  protected metadata: KmsMetadata | GatewayMetadata | CompleteAppMetadata

  constructor(
    verifierType: 'kms' | 'gateway' | 'app',
    metadata: KmsMetadata | GatewayMetadata | CompleteAppMetadata,
  ) {
    this.verifierType = verifierType
    this.metadata = metadata
  }

  /**
   * Generates a unique object ID for a given component type.
   */
  protected generateObjectId(component: string): string {
    // Use kebab-case to match tee-visualization TRUST_ITEMS
    return `${this.verifierType}-${component}`
  }

  /**
   * Reads DStack image metadata from external/dstack-images directory
   */
  protected readDStackImageMetadata(
    version: string,
    isNvidiaVariant: boolean,
  ): DStackImageMetadata {
    // Strip 'v' prefix if present
    const cleanVersion = version.startsWith('v') ? version.slice(1) : version
    const imageDirName = isNvidiaVariant
      ? `dstack-nvidia-${cleanVersion}`
      : `dstack-${cleanVersion}`
    const metadataPath = join(
      process.cwd(),
      'external',
      'dstack-images',
      imageDirName,
      'metadata.json',
    )

    try {
      const metadataContent = readFileSync(metadataPath, 'utf8')
      return JSON.parse(metadataContent) as DStackImageMetadata
    } catch {
      // Fallback to hardcoded values if metadata file is not found
      console.warn(
        `Warning: Could not read metadata from ${metadataPath}, using fallback values`,
      )
      return {
        bios: 'ovmf.fd',
        kernel: 'bzImage',
        cmdline: '',
        initrd: 'initramfs.cpio.gz',
        rootfs: 'rootfs.img.verity',
        version: cleanVersion,
        git_revision: '',
        shared_ro: true,
        is_dev: false,
      }
    }
  }

  /**
   * Generates common hardware DataObjects for CPU verification.
   */
  protected generateCpuHardwareObject(
    verificationResult: VerifyQuoteResult,
  ): DataObject {
    return {
      id: this.generateObjectId('cpu'),
      name: `${this.verifierType.toUpperCase()} TEE Hardware`,
      description: `Hardware platform details for the ${this.verifierType} Trusted Execution Environment, including manufacturer, model, and supported security features.`,
      fields: {
        manufacturer: this.metadata.hardware.cpuManufacturer,
        model: this.metadata.hardware.cpuModel,
        security_feature: this.metadata.hardware.securityFeature,
        verification_status: verificationResult.status,
      },
      kind: this.verifierType,
      measuredBy: [
        {
          objectId: this.generateObjectId('quote'),
        },
      ],
    }
  }

  /**
   * Generates common quote DataObjects for Intel attestation.
   */
  protected generateQuoteObject(
    verificationResult: VerifyQuoteResult,
  ): DataObject {
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
      kind: this.verifierType,
      measuredBy: [
        {
          objectId: this.generateObjectId('main'),
          fieldName: 'intel_attestation_report',
        },
      ],
    }
  }

  /**
   * Generates OS DataObjects for operating system verification.
   */
  protected generateOSObject(
    appInfo: AppInfo,
    hasNvidiaSupport: boolean = false,
  ): DataObject {
    const osVersionString = this.metadata.osSource.version
    const isNvidiaVariant =
      hasNvidiaSupport || this.metadata.hardware.hasNvidiaSupport

    // Read dynamic metadata from dstack-images
    const imageMetadata = this.readDStackImageMetadata(
      osVersionString,
      Boolean(isNvidiaVariant),
    )

    return {
      id: this.generateObjectId('os'),
      name: `${this.verifierType.toUpperCase()} OS`,
      description: `Integrity measurements and configuration of the ${this.verifierType} operating system, including boot parameters and system components.`,
      fields: {
        os: osVersionString,
        artifacts: isNvidiaVariant
          ? `https://github.com/nearai/private-ml-sdk/releases/tag/${osVersionString}`
          : `https://github.com/Dstack-TEE/meta-dstack/releases/tag/${osVersionString}`,
        vm_config: appInfo.vm_config
          ? JSON.stringify(appInfo.vm_config)
          : 'N/A',
        ...(isNvidiaVariant && { gpu_enabled: true }),
        bios: imageMetadata.bios,
        kernel: imageMetadata.kernel,
        cmdline: imageMetadata.cmdline,
        initrd: imageMetadata.initrd,
        rootfs: imageMetadata.rootfs,
        shared_ro: imageMetadata.shared_ro,
        is_dev: imageMetadata.is_dev,
      },
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
          inputs: ['kernel', 'cmdline', 'initrd'],
          calcFunc: 'sha384',
          outputs: ['rtmr1'],
        },
        {
          inputs: ['rootfs'],
          calcFunc: 'sha384',
          outputs: ['rtmr2'],
        },
        {
          inputs: ['artifacts'],
          calcFunc: 'sha384',
          outputs: ['os_image_hash'],
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
        {
          selfCalcOutputName: 'os_image_hash',
          objectId: this.generateObjectId('event-logs-imr3'),
          fieldName: 'os-image-hash',
        },
      ],
    }
  }

  /**
   * Generates OS Code DataObjects for operating system source code information.
   */
  protected generateOSCodeObject(): DataObject {
    return {
      id: this.generateObjectId('os-code'),
      name: `${this.verifierType.toUpperCase()} OS Code`,
      description: `Source code and version information for the ${this.verifierType} operating system, including repository URL, commit hash, and release version.`,
      fields: {
        github_repo: this.metadata.osSource.github_repo,
        git_commit: this.metadata.osSource.git_commit,
        version: this.metadata.osSource.version,
      },
      kind: this.verifierType,
      measuredBy: [
        {
          selfCalcOutputName: 'artifacts',
          objectId: this.generateObjectId('os'),
          fieldName: 'artifacts',
        },
      ],
      calculations: [
        {
          inputs: ['*'],
          calcFunc: 'reproducible_build',
          outputs: ['artifacts'],
        },
      ],
    }
  }

  /**
   * Groups event log entries by their IMR (Index Measurement Register) values.
   */
  private static groupEventLogsByIMR(
    eventLog: LogEntry[],
  ): Record<number, LogEntry[]> {
    return eventLog.reduce(
      (groups, entry) => {
        const imr = entry.imr
        if (!groups[imr]) {
          groups[imr] = []
        }
        groups[imr].push(entry)
        return groups
      },
      {} as Record<number, LogEntry[]>,
    )
  }

  /**
   * Creates DataObjects for event logs grouped by IMR/RTMR values.
   */
  private createEventLogDataObjects(
    eventLog: LogEntry[],
    objectIdPrefix: string,
  ): DataObject[] {
    const groupedLogs = BaseDataObjectGenerator.groupEventLogsByIMR(eventLog)
    const dataObjects: DataObject[] = []

    Object.entries(groupedLogs).forEach(([imr, logs]) => {
      const imrNumber = Number(imr)
      const fields: Record<string, unknown> = {}

      // Create numbered event log fields, using event names for RTMR3
      logs.forEach((log, index) => {
        const fieldName =
          imrNumber === 3 && log.event ? log.event : `event_log_${index}`
        fields[fieldName] = JSON.stringify(log)
      })

      // Get description based on IMR number
      const getIMRDescription = (imrNum: number): string => {
        switch (imrNum) {
          case 0:
            return 'Event log entries associated with RTMR0, capturing secure boot and early system measurements.'
          case 1:
            return 'Event log entries associated with RTMR1, capturing kernel and boot services measurements.'
          case 2:
            return 'Event log entries associated with RTMR2, capturing application loader measurements.'
          case 3:
            return 'Event log entries associated with RTMR3, capturing application and runtime system measurements.'
          default:
            return `Event log entries associated with RTMR${imrNum}, capturing system measurements.`
        }
      }

      const dataObject: DataObject = {
        id: `${objectIdPrefix}-imr${imr}`,
        name: `Event Logs for RTMR${imr}`,
        description: getIMRDescription(imrNumber),
        fields,
        kind: this.verifierType,
        calculations: [
          {
            inputs: ['*'],
            calcFunc: 'replay_rtmr',
            outputs: [`rtmr${imr}`],
          },
        ],
        measuredBy: [
          {
            objectId: `${this.verifierType}-main`,
            fieldName: 'event_log',
          },
          {
            selfCalcOutputName: `rtmr${imr}`,
            objectId: `${this.verifierType}-quote`,
            fieldName: `rtmr${imr}`,
          },
        ],
      }

      dataObjects.push(dataObject)
    })

    return dataObjects
  }

  /**
   * Generates event log DataObjects with verifier-specific configuration.
   */
  protected generateEventLogObjects(
    eventlog: QuoteData['eventlog'],
  ): DataObject[] {
    // Configure object ID prefix based on verifier type
    const objectIdPrefix = this.generateObjectId('event-logs')

    return this.createEventLogDataObjects(eventlog, objectIdPrefix)
  }

  /**
   * Generates code DataObject for source code verification.
   */
  protected generateCodeObject(
    appInfo: AppInfo,
    isRegistered?: boolean,
  ): DataObject {
    const fields: Record<string, unknown> = {
      compose_file: appInfo.tcb_info.app_compose,
    }

    // Add app source info if available (for gateway and app verifiers)
    if ('appSource' in this.metadata) {
      fields.github_repo = this.metadata.appSource?.github_repo
      fields.git_commit = this.metadata.appSource?.git_commit
      fields.version = this.metadata.appSource?.version

      if (this.metadata.appSource?.model_name) {
        fields.model_name = this.metadata.appSource.model_name
      }
    }

    if (isRegistered !== undefined) {
      fields.is_registered = isRegistered
    }

    return {
      id: this.generateObjectId('code'),
      name: `${this.verifierType.toUpperCase()} Code`,
      description: `Source code and deployment configuration for the ${this.verifierType} service, including compose files and version information.`,
      fields,
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
          objectId: `${this.verifierType}-event-logs-imr3`,
          fieldName: 'compose-hash',
        },
      ],
    }
  }
}
