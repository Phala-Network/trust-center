import type {
  AppInfo,
  DataObject,
  LogEntry,
  QuoteData,
  VerifyQuoteResult,
} from '../types'

/**
 * Global type mapping for different verifier types.
 */
const TYPE_MAP = {
  kms: 'trust_authority',
  gateway: 'network_report',
  app: 'application_report',
} as const

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
    // Use kebab-case to match tee-visualization TRUST_ITEMS
    return `${this.verifierType}-${component}`
  }

  /**
   * Generates common hardware DataObjects for CPU verification.
   */
  protected generateCpuHardwareObject(
    verificationResult: VerifyQuoteResult,
    layer: number = 3,
  ): DataObject {
    return {
      id: this.generateObjectId('cpu'),
      name: `${this.verifierType.toUpperCase()} TEE Hardware`,
      description: `Hardware platform details for the ${this.verifierType} Trusted Execution Environment, including manufacturer, model, and supported security features.`,
      fields: {
        manufacturer: this.metadata.cpuManufacturer || 'Intel Corporation',
        model: this.metadata.cpuModel || 'Intel(R) Xeon(R) CPU',
        security_feature:
          this.metadata.securityFeature ||
          'Intel Trust Domain Extensions (TDX)',
        verification_status: verificationResult.status,
      },
      layer,
      type: 'hardware_report',
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
    layer: number = 3,
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
      layer,
      type: TYPE_MAP[this.verifierType],
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
    measurementResult: any,
    layer: number = 3,
    hasNvidiaSupport: boolean = false,
  ): DataObject {
    const osVersion = this.metadata.osVersion || '0.5.3'
    const isNvidiaVariant = hasNvidiaSupport

    return {
      id: this.generateObjectId('os'),
      name: `${this.verifierType.toUpperCase()} OS`,
      description: `Integrity measurements and configuration of the ${this.verifierType} operating system, including boot parameters and system components.`,
      fields: {
        os: `dstack v${osVersion}${isNvidiaVariant ? ' (nvidia)' : ''}`,
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
        ...(isNvidiaVariant && { gpu_enabled: true }),
      },
      layer,
      type: TYPE_MAP[this.verifierType],
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
   * Generates OS Code DataObjects for operating system source code information.
   */
  protected generateOSCodeObject(
    hasNvidiaSupport: boolean = false,
    layer: number = 1,
  ): DataObject {
    const osVersion = String(this.metadata.osVersion || '0.5.3')
    const gitRevision =
      this.metadata.gitRevision || '5b63aec337f19a541798970c7cf8d846171f0ca9'
    const isNvidiaVariant = hasNvidiaSupport

    const versionSuffix = isNvidiaVariant ? '-nvidia' : '-dev'
    const version = `dstack${versionSuffix}-${osVersion}`

    const repoVersion = osVersion.startsWith('0.') ? `v${osVersion}` : osVersion
    const githubRepo = `https://github.com/Dstack-TEE/meta-dstack/tree/${repoVersion}`

    return {
      id: this.generateObjectId('os-code'),
      name: `${this.verifierType.toUpperCase()} OS Code`,
      description: `Source code and version information for the ${this.verifierType} operating system, including repository URL, commit hash, and release version.`,
      fields: {
        github_repo: githubRepo,
        git_commit: gitRevision,
        version: version,
      },
      layer,
      type: TYPE_MAP[this.verifierType],
      kind: this.verifierType,
      measuredBy: [
        {
          objectId: this.generateObjectId('os'),
          fieldName: 'os',
        },
      ],
      calculations: [
        {
          inputs: ['ovmf.fd'],
          calcFunc: 'sha256',
          outputs: ['bios'],
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
    layer: number,
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
        layer,
        type: TYPE_MAP[this.verifierType],
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

    return this.createEventLogDataObjects(eventlog, objectIdPrefix, 4)
  }

  /**
   * Generates code DataObject for source code verification.
   */
  protected generateCodeObject(
    appInfo: AppInfo,
    isRegistered?: boolean,
    layer: number = 3,
  ): DataObject {
    const defaultRepoMap = {
      kms: 'https://github.com/Dstack-TEE/dstack/tree/main/kms',
      gateway: 'https://github.com/Dstack-TEE/dstack/tree/main/gateway',
      app: 'N/A',
    }

    const fields: Record<string, unknown> = {
      github_repo:
        this.metadata.githubRepo || defaultRepoMap[this.verifierType],
      git_commit: this.metadata.gitCommit || this.metadata.gitRevision || 'N/A',
      version: this.metadata.version || 'N/A',
      compose_file: appInfo.tcb_info.app_compose,
    }

    if (isRegistered !== undefined) {
      fields.is_registered = isRegistered
    }

    if (this.metadata.modelName) {
      fields.model_name = this.metadata.modelName
    }

    return {
      id: this.generateObjectId('code'),
      name: `${this.verifierType.toUpperCase()} Code`,
      description: `Source code and deployment configuration for the ${this.verifierType} service, including compose files and version information.`,
      fields,
      layer,
      type: TYPE_MAP[this.verifierType],
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
