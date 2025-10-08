import { z } from 'zod'

// Zod schemas for JSON parsing validation

export const LogEntrySchema = z.object({
  imr: z.number(),
  event_type: z.number(),
  digest: z.string(),
  event: z.string(),
  event_payload: z.string(),
})

export const EventLogSchema = z.array(LogEntrySchema)

export const QuoteSchema = z
  .string()
  .refine(
    (val): val is `0x${string}` => val.startsWith('0x'),
    'Quote must be a hex string starting with 0x',
  )

export const KmsInfoSchema = z.object({
  contract_address: z.string(),
  chain_id: z.number().nullable(),
  version: z.string(),
  url: z.string(),
  gateway_app_id: z.string(),
  gateway_app_url: z.string(),
})

export const DstackInstanceSchema = z.object({
  quote: z.string().optional(),
  eventlog: EventLogSchema.optional(),
  image_version: z.string().optional(),
})

export const SystemInfoSchema = z.object({
  app_id: z.string(),
  contract_address: z.string(),
  kms_info: KmsInfoSchema,
  instances: z.array(DstackInstanceSchema),
})

export const AppComposeSchema = z.object({
  manifest_version: z.number(),
  name: z.string(),
  runner: z.string(),
  docker_compose_file: z.string(),
  kms_enabled: z.boolean(),
  gateway_enabled: z.boolean(),
  local_key_provider_enabled: z.boolean(),
  key_provider_id: z.string(),
  public_logs: z.boolean(),
  public_sysinfo: z.boolean(),
  allowed_envs: z.array(z.string()),
  no_instance_id: z.boolean(),
  secure_time: z.boolean(),
  pre_launch_script: z.string(),
  launch_token_hash: z.string(),
})

export const VmConfigSchema = z.object({
  spec_version: z.number(),
  os_image_hash: z.string(),
  cpu_count: z.number(),
  memory_size: z.number(),
  qemu_single_pass_add_pages: z.boolean(),
  pic: z.boolean(),
  pci_hole64_size: z.number(),
  hugepages: z.boolean(),
  num_gpus: z.number(),
  num_nvswitches: z.number(),
  hotplug_off: z.boolean(),
})

export const TcbInfoSchema = z.object({
  mrtd: z.string(),
  rtmr0: z.string(),
  rtmr1: z.string(),
  rtmr2: z.string(),
  rtmr3: z.string(),
  mr_aggregated: z.string(),
  os_image_hash: z.string(),
  compose_hash: z.string(),
  device_id: z.string(),
  event_log: EventLogSchema,
  app_compose: z.string(),
})

export const LegacyTcbInfoSchema = z.object({
  rootfs_hash: z.string(),
  mrtd: z.string(),
  rtmr0: z.string(),
  rtmr1: z.string(),
  rtmr2: z.string(),
  rtmr3: z.string(),
  event_log: EventLogSchema,
  app_compose: z.string(),
})

export const KeyProviderSchema = z.object({
  name: z.string(),
  id: z.string(),
})

export const AppInfoSchema = z.object({
  app_id: z.string(),
  instance_id: z.string(),
  app_cert: z.string(),
  tcb_info: TcbInfoSchema,
  app_name: z.string(),
  device_id: z.string(),
  mr_aggregated: z.string(),
  os_image_hash: z.string(),
  key_provider_info: KeyProviderSchema,
  compose_hash: z.string(),
  vm_config: VmConfigSchema,
})

export const LegacyAppInfoSchema = z.object({
  app_id: z.string(),
  instance_id: z.string(),
  app_cert: z.string(),
  tcb_info: LegacyTcbInfoSchema,
  app_name: z.string(),
  public_logs: z.boolean(),
  public_sysinfo: z.boolean(),
})

export const TDReport10Schema = z.object({
  tee_tcb_svn: z.string(),
  mr_seam: z.string(),
  mr_signer_seam: z.string(),
  seam_attributes: z.string(),
  td_attributes: z.string(),
  xfam: z.string(),
  mr_td: z.string(),
  mr_config_id: z.string(),
  mr_owner: z.string(),
  mr_owner_config: z.string(),
  rt_mr0: z.string(),
  rt_mr1: z.string(),
  rt_mr2: z.string(),
  rt_mr3: z.string(),
  report_data: z.string(),
})

export const VerifyQuoteResultSchema = z.object({
  status: z.string(),
  advisory_ids: z.array(z.string()),
  report: z.object({
    TD10: TDReport10Schema,
  }),
})

export const QuoteHeaderSchema = z.object({
  version: z.number(),
  attestation_key_type: z.number(),
  tee_type: z.number(),
  qe_svn: z.number(),
  pce_svn: z.number(),
  qe_vendor_id: z.string(),
  user_data: z.string(),
})

export const CertDataSchema = z.object({
  cert_type: z.number(),
  body: z.string(),
})

export const QEReportCertSchema = z.object({
  qe_report: z.string(),
  qe_report_signature: z.string(),
  qe_auth_data: z.string(),
  certification_data: CertDataSchema,
})

export const AuthDataSchema = z.object({
  V4: z.object({
    ecdsa_signature: z.string(),
    ecdsa_attestation_key: z.string(),
    certification_data: CertDataSchema,
    qe_report_data: QEReportCertSchema,
  }),
})

export const QuoteResultSchema = z.object({
  header: QuoteHeaderSchema,
  report: z.object({
    TD10: TDReport10Schema,
  }),
  auth_data: AuthDataSchema,
})

export const OsMeasurementSchema = z.object({
  mrtd: z.string(),
  rtmr0: z.string(),
  rtmr1: z.string(),
  rtmr2: z.string(),
})

export const ExtendedQuoteDataSchema = z.object({
  quote: z.string(),
  event_log: z.string(),
})

export const NvidiaEvidenceSchema = z.object({
  certificate: z.string(),
  evidence: z.string(),
  arch: z.string(),
})

export const NvidiaPayloadSchema = z.object({
  nonce: z.string(),
  evidence_list: z.array(NvidiaEvidenceSchema),
  arch: z.string(),
})

export const AttestationSchema = z.object({
  signing_address: z.string(),
  intel_quote: z.string(),
  nvidia_payload: NvidiaPayloadSchema,
  event_log: z.array(LogEntrySchema),
  info: AppInfoSchema,
})

export const AttestationBundleSchema = AttestationSchema.extend({
  all_attestations: z.array(AttestationSchema),
})

// Safe JSON parsing functions using Zod validation
export function safeParseEventLog(jsonString: string) {
  const parsed = JSON.parse(jsonString)
  return EventLogSchema.parse(parsed)
}

export function safeParseQuoteResult(jsonString: string) {
  const parsed = JSON.parse(jsonString)
  return VerifyQuoteResultSchema.parse(parsed)
}

export function safeParseQuoteData(jsonString: string) {
  const parsed = JSON.parse(jsonString)
  return QuoteResultSchema.parse(parsed)
}

export function safeParseOsMeasurement(jsonString: string) {
  const parsed = JSON.parse(jsonString)
  return OsMeasurementSchema.parse(parsed)
}

export function safeParseQuoteExt(jsonString: string) {
  const parsed = JSON.parse(jsonString)
  return ExtendedQuoteDataSchema.parse(parsed)
}

// Generic safe parse function with schema parameter
export function safeParse<T>(jsonString: string, schema: z.ZodSchema<T>): T {
  const parsed = JSON.parse(jsonString)
  return schema.parse(parsed)
}
