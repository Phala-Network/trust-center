import type {
  AcmeInfo,
  AppInfo,
  AttestationBundle,
  CTVerificationResult,
  QuoteAndEventLog,
} from './types'

// Verifier for basic TEE application
export abstract class Verifier {
  // Get quote and event log from TDX
  protected abstract getQuote(): Promise<QuoteAndEventLog>

  // Get both TDX and Nvidia attestation
  protected abstract getAttestation(): Promise<AttestationBundle | null>

  // Get AppInfo defined in dstack-guest-agent
  // This needs to be acquired locally through http://${GUEST_AGENT_ADDR}/prpc/Info
  protected abstract getAppInfo(): Promise<AppInfo>

  // Verify TDX and Nvidia attestation signatures
  public abstract verifyHardware(): Promise<boolean>

  public abstract verifyOperatingSystem(): Promise<boolean>

  public abstract verifySourceCode(): Promise<boolean>

  public abstract getMetadata(): Promise<any>
}

// TEE-controlled Domain Checker
export abstract class OwnDomain {
  // Get ACME account information with TEE-controlled keys
  protected abstract getAcmeInfo(): Promise<AcmeInfo>

  // Verify that the public key is TEE-controlled by checking quote report_data
  public abstract verifyTeeControlledKey(): Promise<boolean>

  // Verify TLS certificate matches the TEE-controlled public key
  public abstract verifyCertificateKey(): Promise<boolean>

  // Verify domain is controlled by the Let's Encrypt account via DNS CAA records
  public abstract verifyDnsCAA(): Promise<boolean>

  // Verify domain is always controlled by TEE through Certificate Transparency Logs
  public abstract verifyCTLog(): Promise<CTVerificationResult>
}
