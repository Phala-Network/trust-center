import type { AppInfo, KmsMetadata } from '../types'
import { KmsVerifier } from './kmsVerifier'

/**
 * Phala Cloud-specific KMS verifier implementation.
 *
 * This verifier fetches application information from the Phala Cloud API,
 * similar to how PhalaCloudVerifier works but for KMS context.
 */
export class PhalaCloudKmsVerifier extends KmsVerifier {
  /**
   * Creates a new Phala Cloud KMS verifier instance.
   */
  constructor(
    contractAddress: `0x${string}`,
    metadata: KmsMetadata,
    chainId = 8453, // Base mainnet
  ) {
    super(contractAddress, metadata, chainId)
  }

  /**
   * Retrieves application information from the Phala Cloud API.
   * This method fetches app info from the /prpc/Info endpoint.
   */
  protected override async getAppInfo(): Promise<AppInfo> {
    // TODO: fix mock implementation
    return {
      app_id: '78601222ada762fa7cdcbc167aa66dd7a5f57ece',
      instance_id: '',
      app_cert:
        '-----BEGIN CERTIFICATE-----\nMock Certificate for Phala Cloud KMS\n-----END CERTIFICATE-----',
      app_name: 'kms',
      device_id: 'phala-cloud-device-001',
      mr_aggregated:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      os_image_hash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      compose_hash:
        '78601222ada762fa7cdcbc167aa66dd7a5f57ece418cef114a148e33742525ad7e',
      tcb_info: {
        mrtd: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        rtmr0:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        rtmr1:
          '0x2468135792468135792468135792468135792468135792468135792468135792468135792468135792468135792468',
        rtmr2:
          '0x13579024681357902468135790246813579024681357902468135790246813579024681357902468135790246813',
        rtmr3:
          '0x97531864209753186420975318642097531864209753186420975318642097531864209753186420975318642097',
        mr_aggregated:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        os_image_hash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        compose_hash:
          '78601222ada762fa7cdcbc167aa66dd7a5f57ece418cef114a148e33742525ad7e',
        device_id: 'phala-cloud-device-001',
        event_log: [],
        app_compose:
          '{"manifest_version": 1, "name": "kms", "runner": "docker"}',
      },
      vm_config: {
        spec_version: 1,
        os_image_hash:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        cpu_count: 4,
        memory_size: 8589934592, // 8GB in bytes
        qemu_single_pass_add_pages: true,
        pic: false,
        pci_hole64_size: 34359738368,
        hugepages: false,
        num_gpus: 0,
        num_nvswitches: 0,
        hotplug_off: false,
      },
      key_provider_info: {
        name: 'phala-cloud',
        id: '1b7a1439373840332490b699686a907844cab092e1eca32dd47e65766f360311cca',
      },
    }
  }
}
