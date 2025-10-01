import {type DataObject} from './schema'

export const placeholderData: DataObject[] = [
  {
    id: 'kms-cpu',
    name: 'KMS TEE Hardware',
    description:
      'Hardware platform details for the kms Trusted Execution Environment, including manufacturer, model, and supported security features.',
    fields: {
      manufacturer: '',
      model: '',
      security_feature: '',
      verification_status: '',
    },
    kind: 'kms',
    measuredBy: [],
  },
  {
    id: 'kms-quote',
    name: 'KMS Attestation Report',
    description:
      "Cryptographic attestation report by the kms node's TEE. Used to prove the integrity and authenticity of the kms.",
    fields: {
      tee_tcb_svn: '',
      mrseam: '',
      mrsignerseam: '',
      seamattributes: '',
      tdattributes: '',
      xfam: '',
      mrtd: '',
      mrconfig: '',
      mrowner: '',
      mrownerconfig: '',
      rtmr0: '',
      rtmr1: '',
      rtmr2: '',
      rtmr3: '',
      reportdata: '',
    },
    kind: 'kms',
    measuredBy: [],
  },
  {
    id: 'kms-event-logs-imr0',
    name: 'Event Logs for RTMR0',
    description:
      'Event log entries associated with RTMR0, capturing secure boot and early system measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
      event_log_2: '',
      event_log_3: '',
      event_log_4: '',
      event_log_5: '',
      event_log_6: '',
      event_log_7: '',
      event_log_8: '',
      event_log_9: '',
      event_log_10: '',
      event_log_11: '',
      event_log_12: '',
    },
    kind: 'kms',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr0'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'kms-event-logs-imr1',
    name: 'Event Logs for RTMR1',
    description:
      'Event log entries associated with RTMR1, capturing kernel and boot services measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
      event_log_2: '',
      event_log_3: '',
      event_log_4: '',
    },
    kind: 'kms',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr1'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'kms-event-logs-imr2',
    name: 'Event Logs for RTMR2',
    description:
      'Event log entries associated with RTMR2, capturing application loader measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
    },
    kind: 'kms',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr2'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'kms-event-logs-imr3',
    name: 'Event Logs for RTMR3',
    description:
      'Event log entries associated with RTMR3, capturing application and runtime system measurements.',
    fields: {
      'system-preparing': '',
      'app-id': '',
      'compose-hash': '',
      'instance-id': '',
      'boot-mr-done': '',
      'key-provider': '',
      'system-ready': '',
    },
    kind: 'kms',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr3'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'kms-os',
    name: 'KMS OS',
    description:
      'Integrity measurements and configuration of the kms operating system, including boot parameters and system components.',
    fields: {
      os: '',
      artifacts: '',
      vm_config: '',
      bios: '',
      kernel: '',
      cmdline: '',
      initrd: '',
      rootfs: '',
      shared_ro: '',
      is_dev: '',
    },
    kind: 'kms',
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
    ],
    measuredBy: [],
  },
  {
    id: 'kms-os-code',
    name: 'KMS OS Code',
    description:
      'Source code and version information for the kms operating system, including repository URL, commit hash, and release version.',
    fields: {
      github_repo: '',
      git_commit: '',
      version: '',
    },
    kind: 'kms',
    measuredBy: [],
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'reproducible_build',
        outputs: ['artifacts'],
      },
    ],
  },
  {
    id: 'kms-main',
    name: 'KMS',
    description:
      'The KMS Info serves as the root-of-trust for the whole system, managing cryptographic keys and providing authentication for applications.',
    fields: {
      blockchain: '',
      registry_smart_contract: '',
      wallet_pubkey: '',
      cert_pubkey: '',
      intel_attestation_report: '',
      event_log: '',
      gateway_app_id: '',
    },
    kind: 'kms',
    measuredBy: [],
  },
  {
    id: 'kms-code',
    name: 'KMS Code',
    description:
      'Source code and deployment configuration for the kms service, including compose files and version information.',
    fields: {
      compose_file: '',
      github_repo: '',
      git_commit: '',
      version: '',
    },
    kind: 'kms',
    calculations: [
      {
        inputs: ['compose_file'],
        calcFunc: 'sha256',
        outputs: ['compose_hash'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'gateway-cpu',
    name: 'GATEWAY TEE Hardware',
    description:
      'Hardware platform details for the gateway Trusted Execution Environment, including manufacturer, model, and supported security features.',
    fields: {
      manufacturer: '',
      model: '',
      security_feature: '',
      verification_status: '',
    },
    kind: 'gateway',
    measuredBy: [],
  },
  {
    id: 'gateway-quote',
    name: 'GATEWAY Attestation Report',
    description:
      "Cryptographic attestation report by the gateway node's TEE. Used to prove the integrity and authenticity of the gateway.",
    fields: {
      tee_tcb_svn: '',
      mrseam: '',
      mrsignerseam: '',
      seamattributes: '',
      tdattributes: '',
      xfam: '',
      mrtd: '',
      mrconfig: '',
      mrowner: '',
      mrownerconfig: '',
      rtmr0: '',
      rtmr1: '',
      rtmr2: '',
      rtmr3: '',
      reportdata: '',
    },
    kind: 'gateway',
    measuredBy: [],
  },
  {
    id: 'gateway-event-logs-imr0',
    name: 'Event Logs for RTMR0',
    description:
      'Event log entries associated with RTMR0, capturing secure boot and early system measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
      event_log_2: '',
      event_log_3: '',
      event_log_4: '',
      event_log_5: '',
      event_log_6: '',
      event_log_7: '',
      event_log_8: '',
      event_log_9: '',
      event_log_10: '',
      event_log_11: '',
      event_log_12: '',
    },
    kind: 'gateway',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr0'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'gateway-event-logs-imr1',
    name: 'Event Logs for RTMR1',
    description:
      'Event log entries associated with RTMR1, capturing kernel and boot services measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
      event_log_2: '',
      event_log_3: '',
      event_log_4: '',
    },
    kind: 'gateway',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr1'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'gateway-event-logs-imr2',
    name: 'Event Logs for RTMR2',
    description:
      'Event log entries associated with RTMR2, capturing application loader measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
    },
    kind: 'gateway',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr2'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'gateway-event-logs-imr3',
    name: 'Event Logs for RTMR3',
    description:
      'Event log entries associated with RTMR3, capturing application and runtime system measurements.',
    fields: {
      'system-preparing': '',
      'app-id': '',
      'compose-hash': '',
      'instance-id': '',
      'boot-mr-done': '',
      'mr-kms': '',
      'os-image-hash': '',
      'key-provider': '',
      'system-ready': '',
    },
    kind: 'gateway',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr3'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'gateway-os',
    name: 'GATEWAY OS',
    description:
      'Integrity measurements and configuration of the gateway operating system, including boot parameters and system components.',
    fields: {
      os: '',
      artifacts: '',
      vm_config: '',
      bios: '',
      kernel: '',
      cmdline: '',
      initrd: '',
      rootfs: '',
      shared_ro: '',
      is_dev: '',
    },
    kind: 'gateway',
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
    ],
    measuredBy: [],
  },
  {
    id: 'gateway-os-code',
    name: 'GATEWAY OS Code',
    description:
      'Source code and version information for the gateway operating system, including repository URL, commit hash, and release version.',
    fields: {
      github_repo: '',
      git_commit: '',
      version: '',
    },
    kind: 'gateway',
    measuredBy: [],
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'reproducible_build',
        outputs: ['artifacts'],
      },
    ],
  },
  {
    id: 'gateway-main',
    name: 'Gateway',
    description:
      "Details and attestation information for the gateway. This represents the gateway's role in securely connecting and registering applications within the network.",
    fields: {
      app_id: '',
      registry_smart_contract: '',
      endpoint: '',
      guarded_domain: '',
      intel_attestation_report: '',
      event_log: '',
      app_cert: '',
    },
    kind: 'gateway',
    measuredBy: [],
  },
  {
    id: 'gateway-code',
    name: 'GATEWAY Code',
    description:
      'Source code and deployment configuration for the gateway service, including compose files and version information.',
    fields: {
      compose_file: '',
      github_repo: '',
      git_commit: '',
      version: '',
      is_registered: '',
    },
    kind: 'gateway',
    calculations: [
      {
        inputs: ['compose_file'],
        calcFunc: 'sha256',
        outputs: ['compose_hash'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'app-cpu',
    name: 'APP TEE Hardware',
    description:
      'Hardware platform details for the app Trusted Execution Environment, including manufacturer, model, and supported security features.',
    fields: {
      manufacturer: '',
      model: '',
      security_feature: '',
      verification_status: '',
    },
    kind: 'app',
    measuredBy: [],
  },
  {
    id: 'app-quote',
    name: 'APP Attestation Report',
    description:
      "Cryptographic attestation report by the app node's TEE. Used to prove the integrity and authenticity of the app.",
    fields: {
      tee_tcb_svn: '',
      mrseam: '',
      mrsignerseam: '',
      seamattributes: '',
      tdattributes: '',
      xfam: '',
      mrtd: '',
      mrconfig: '',
      mrowner: '',
      mrownerconfig: '',
      rtmr0: '',
      rtmr1: '',
      rtmr2: '',
      rtmr3: '',
      reportdata: '',
    },
    kind: 'app',
    measuredBy: [],
  },
  {
    id: 'app-event-logs-imr0',
    name: 'Event Logs for RTMR0',
    description:
      'Event log entries associated with RTMR0, capturing secure boot and early system measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
      event_log_2: '',
      event_log_3: '',
      event_log_4: '',
      event_log_5: '',
      event_log_6: '',
      event_log_7: '',
      event_log_8: '',
      event_log_9: '',
      event_log_10: '',
      event_log_11: '',
      event_log_12: '',
    },
    kind: 'app',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr0'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'app-event-logs-imr1',
    name: 'Event Logs for RTMR1',
    description:
      'Event log entries associated with RTMR1, capturing kernel and boot services measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
      event_log_2: '',
      event_log_3: '',
      event_log_4: '',
    },
    kind: 'app',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr1'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'app-event-logs-imr2',
    name: 'Event Logs for RTMR2',
    description:
      'Event log entries associated with RTMR2, capturing application loader measurements.',
    fields: {
      event_log_0: '',
      event_log_1: '',
    },
    kind: 'app',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr2'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'app-event-logs-imr3',
    name: 'Event Logs for RTMR3',
    description:
      'Event log entries associated with RTMR3, capturing application and runtime system measurements.',
    fields: {
      'system-preparing': '',
      'app-id': '',
      'compose-hash': '',
      'instance-id': '',
      'boot-mr-done': '',
      'mr-kms': '',
      'os-image-hash': '',
      'key-provider': '',
      'system-ready': '',
    },
    kind: 'app',
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'replay_rtmr',
        outputs: ['rtmr3'],
      },
    ],
    measuredBy: [],
  },
  {
    id: 'app-os',
    name: 'APP OS',
    description:
      'Integrity measurements and configuration of the app operating system, including boot parameters and system components.',
    fields: {
      os: '',
      artifacts: '',
      vm_config: '',
      bios: '',
      kernel: '',
      cmdline: '',
      initrd: '',
      rootfs: '',
      shared_ro: '',
      is_dev: '',
    },
    kind: 'app',
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
    ],
    measuredBy: [],
  },
  {
    id: 'app-os-code',
    name: 'APP OS Code',
    description:
      'Source code and version information for the app operating system, including repository URL, commit hash, and release version.',
    fields: {
      github_repo: '',
      git_commit: '',
      version: '',
    },
    kind: 'app',
    measuredBy: [],
    calculations: [
      {
        inputs: ['*'],
        calcFunc: 'reproducible_build',
        outputs: ['artifacts'],
      },
    ],
  },
  {
    id: 'app-main',
    name: 'App',
    description:
      'Deepseek V3 model running in TEE GPU, powered by the vllm project',
    fields: {
      app_id: '',
      instance_id: '',
      registry_smart_contract: '',
      endpoint: '',
      intel_attestation_report: '',
      event_log: '',
      app_cert: '',
      device_id: '',
      compose_hash: '',
      mr_aggregated: '',
      os_image_hash: '',
      is_registered: '',
    },
    kind: 'app',
    measuredBy: [],
  },
  {
    id: 'app-code',
    name: 'APP Code',
    description:
      'Source code and deployment configuration for the app service, including compose files and version information.',
    fields: {
      compose_file: '',
      is_registered: '',
    },
    kind: 'app',
    calculations: [
      {
        inputs: ['compose_file'],
        calcFunc: 'sha256',
        outputs: ['compose_hash'],
      },
    ],
    measuredBy: [],
  },
]
