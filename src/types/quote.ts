/**
 * Types related to quote parsing and verification results.
 */

// Defined in https://github.com/Phala-Network/dcap-qvl/blob/a1b725dbeacc78125c7024e63e4d9a9293570a46/src/quote.rs
export interface TDReport10 {
  tee_tcb_svn: string
  mr_seam: string
  mr_signer_seam: string
  seam_attributes: string
  td_attributes: string
  xfam: string
  mr_td: string
  mr_config_id: string
  mr_owner: string
  mr_owner_config: string
  rt_mr0: string
  rt_mr1: string
  rt_mr2: string
  rt_mr3: string
  report_data: string
}

export interface VerifyQuoteResult {
  status: 'UpToDate' | string
  advisory_ids: string[]
  report: {
    TD10: TDReport10
  }
}

export interface QuoteHeader {
  version: number
  attestation_key_type: number
  tee_type: number
  qe_svn: number
  pce_svn: number
  qe_vendor_id: string
  user_data: string
}

export interface Report {
  TD10: TDReport10
}

export interface CertData {
  cert_type: number
  body: string
}

export interface AuthData {
  V4: {
    ecdsa_signature: string
    ecdsa_attestation_key: string
    certification_data: CertData
    qe_report_data: QEReportCert
  }
}

export interface QEReportCert {
  qe_report: string
  qe_report_signature: string
  qe_auth_data: string
  certification_data: CertData
}

export interface QuoteResult {
  header: QuoteHeader
  report: Report
  auth_data: AuthData
}
