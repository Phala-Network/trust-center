import type {
  AcmeInfo,
  AppInfo,
  AttestationBundle,
  CTResult,
  QuoteData,
} from './types'

/**
 * Abstract base class for TEE (Trusted Execution Environment) application verification.
 *
 * This class defines the interface for verifying different aspects of a TEE application:
 * hardware attestation, operating system integrity, and source code authenticity.
 */
export abstract class Verifier {
  /**
   * Retrieves the cryptographic quote and event log from the TDX environment.
   *
   * @returns Promise resolving to the quote and event log data
   */
  protected abstract getQuote(): Promise<QuoteData>

  /**
   * Retrieves both Intel TDX and NVIDIA GPU attestation data.
   *
   * @returns Promise resolving to the complete attestation bundle or null if unavailable
   */
  protected abstract getAttestation(): Promise<AttestationBundle | null>

  /**
   * Retrieves application information from the DStack Guest Agent.
   *
   * This data is typically acquired from the local guest agent endpoint:
   * http://${GUEST_AGENT_ADDR}/prpc/Info
   *
   * @returns Promise resolving to the application information
   */
  protected abstract getAppInfo(): Promise<AppInfo>

  /**
   * Verifies the hardware attestation signatures (Intel TDX and NVIDIA GPU).
   *
   * @returns Promise resolving to true if hardware attestation is valid
   */
  public abstract verifyHardware(): Promise<boolean>

  /**
   * Verifies the integrity of the operating system image.
   *
   * @returns Promise resolving to true if OS integrity is verified
   */
  public abstract verifyOperatingSystem(): Promise<boolean>

  /**
   * Verifies the authenticity of the source code through compose hash validation.
   *
   * @returns Promise resolving to true if source code is verified
   */
  public abstract verifySourceCode(): Promise<boolean>

  /**
   * Retrieves metadata about the verification process and results.
   *
   * @returns Promise resolving to verification metadata
   */
  public abstract getMetadata(): Promise<Record<string, unknown>>
}

/**
 * Abstract class for verifying TEE-controlled domain ownership and certificate management.
 *
 * This class provides methods to verify that a domain is completely controlled by a TEE
 * through ACME certificate management, DNS records, and Certificate Transparency logs.
 */
export abstract class OwnDomain {
  /**
   * Retrieves ACME account information with TEE-controlled cryptographic keys.
   *
   * @returns Promise resolving to ACME account details and key information
   */
  protected abstract getAcmeInfo(): Promise<AcmeInfo>

  /**
   * Verifies that the public key is controlled by the TEE by checking quote report_data.
   *
   * This ensures the private key corresponding to the public key is generated and
   * stored within the TEE and cannot be extracted.
   *
   * @returns Promise resolving to true if the key is TEE-controlled
   */
  public abstract verifyTeeControlledKey(): Promise<boolean>

  /**
   * Verifies that the TLS certificate matches the TEE-controlled public key.
   *
   * @returns Promise resolving to true if certificate key matches TEE key
   */
  public abstract verifyCertificateKey(): Promise<boolean>

  /**
   * Verifies domain control through DNS CAA (Certificate Authority Authorization) records.
   *
   * This ensures the domain can only issue certificates through the TEE-controlled
   * Let's Encrypt account.
   *
   * @returns Promise resolving to true if DNS CAA records are properly configured
   */
  public abstract verifyDnsCAA(): Promise<boolean>

  /**
   * Verifies complete TEE control over the domain through Certificate Transparency logs.
   *
   * This method analyzes historical certificate issuance to ensure the domain has
   * always been controlled by the TEE and no unauthorized certificates exist.
   *
   * @returns Promise resolving to detailed CT log verification results
   */
  public abstract verifyCTLog(): Promise<CTResult>
}
