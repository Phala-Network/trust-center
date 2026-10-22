import {describe, expect, test} from 'bun:test'
import {X509Certificate} from 'node:crypto'

import type {AcmeInfo} from '../types'
import {
  isChainAnchoredToTrustedRoot,
  verifyCertificateKey,
} from './domainVerification'
import {TRUSTED_GATEWAY_ROOT_CERTIFICATES} from './trustedRoots'

// Chain served by the public emSign self-test site (leaf <- EM DV TLS CA - G3B
// <- emSign Root TLS CA - G3), captured 2026-10-22.
const EMSIGN_SERVED_CHAIN_PEM = `-----BEGIN CERTIFICATE-----
MIICOTCCAb6gAwIBAgIUY1R/PHrtXShV0uhLJ5EyjsHvMi0wCgYIKoZIzj0EAwIw
PzELMAkGA1UEBhMCTkwxEzARBgNVBAoMCmVNdWRocmEgQlYxGzAZBgNVBAMMEkVN
IERWIFRMUyBDQSAtIEczQjAeFw0yNjEwMjAwMDU5MzZaFw0yNzA1MDMwMTA0MzZa
MC8xLTArBgNVBAMMJGR2LWczYi1lbXVkaHJhLndlLWhhdmUtYS1wcm9ibGVtLmNv
bTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABFpE24ACBFHQLzpg+7D767thJ3+Q
NIoJJugUMT/OftEz6G6uDdxlS+9VfXYBDglHjJirjEPFNglOGJoQNQuiz7Gjgacw
gaQwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCB4AwEwYDVR0lBAwwCgYIKwYB
BQUHAwEwLwYDVR0RBCgwJoIkZHYtZzNiLWVtdWRocmEud2UtaGF2ZS1hLXByb2Js
ZW0uY29tMB0GA1UdDgQWBBT4r5v4etYNuG21BqBqs273OkcHiDAfBgNVHSMEGDAW
gBTiHi/nHBk5DlVLYsEgJFc1JIolFDAKBggqhkjOPQQDAgNpADBmAjEAlxNF+/8l
APpgibawACy15yn5bcvTksz2Zw0R9z9nUK9e3MSSk+hXagg7LVb7V4NtAjEA4qyR
laFPkaokrnTjqQieq8CgDQ6tIz3FjBvj3D7vkhKXHaml6zD2zT5ih2Y+lD2h
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDaDCCAu6gAwIBAgIQAKSu5njyM2K0wORgt3LyFDAKBggqhkjOPQQDAzBWMQsw
CQYDVQQGEwJJTjElMCMGA1UECgwcZU11ZGhyYSBUZWNobm9sb2dpZXMgTGltaXRl
ZDEgMB4GA1UEAwwXZW1TaWduIFJvb3QgVExTIENBIC0gRzMwHhcNMjUwNDMwMTU1
NDA4WhcNNDAwNDI4MTgzMDAwWjA/MQswCQYDVQQGEwJOTDETMBEGA1UECgwKZU11
ZGhyYSBCVjEbMBkGA1UEAwwSRU0gRFYgVExTIENBIC0gRzNCMHYwEAYHKoZIzj0C
AQYFK4EEACIDYgAE557ZwEqXc8RzXlERHahawr1eZKs3S4DhLLwgOOweTw47gS/J
hZ4eZ6+wTi+LyX90hbplqpEe6KTkW2LVzAPVa+Z4s8OMtNyTfKJGDiOEU8iSk10p
1E+R4VYGtjzO2rRoo4IBljCCAZIwHwYDVR0jBBgwFoAU4TqrIXzx401UrtRyt/2L
WUIgkFQwHQYDVR0OBBYEFOIeL+ccGTkOVUtiwSAkVzUkiiUUMB0GA1UdJQQWMBQG
CCsGAQUFBwMBBggrBgEFBQcDAjBdBgNVHSAEVjBUMDkGCysGAQQBg44hAQABMCow
KAYIKwYBBQUHAgEWHGh0dHA6Ly9yZXBvc2l0b3J5LmVtc2lnbi5jb20wDQYLKwYB
BAGDjiEBAmQwCAYGZ4EMAQIBMHUGCCsGAQUFBwEBBGkwZzAkBggrBgEFBQcwAYYY
aHR0cDovL29jc3AtYi5lbXNpZ24uY29tMD8GCCsGAQUFBzAChjNodHRwOi8vcmVw
b3NpdG9yeS5lbXNpZ24uY29tL2NlcnRzL0VNRFZUTFNDQUczQi5wN2MwNwYDVR0f
BDAwLjAsoCqgKIYmaHR0cDovL2NybC5lbXNpZ24uY29tLz9yb290dGxzY2FnMy5j
cmwwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwCgYIKoZIzj0E
AwMDaAAwZQIwLmsGXi6oFMJ2klkcEMXMug6gvxQWZWkewiDWVzQyl2L6z6DuQfPO
Ibh1grvdULDCAjEAxZvLlxUavG69J6wnSjC8XBbqNIQsJ6CE2QdNOe84Ptxb6VG8
gt2TlfJbHii+KNvK
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDdDCCAvmgAwIBAgIQAJYaPvsTWVdu0EAFtGhKWzAKBggqhkjOPQQDAzBrMQsw
CQYDVQQGEwJJTjETMBEGA1UECxMKZW1TaWduIFBLSTElMCMGA1UEChMcZU11ZGhy
YSBUZWNobm9sb2dpZXMgTGltaXRlZDEgMB4GA1UEAxMXZW1TaWduIEVDQyBSb290
IENBIC0gRzMwHhcNMjQwNzExMTU0MzM2WhcNMzkwNzA5MTgzMDAwWjBWMQswCQYD
VQQGEwJJTjElMCMGA1UECgwcZU11ZGhyYSBUZWNobm9sb2dpZXMgTGltaXRlZDEg
MB4GA1UEAwwXZW1TaWduIFJvb3QgVExTIENBIC0gRzMwdjAQBgcqhkjOPQIBBgUr
gQQAIgNiAARfD9w/q1cWxL6D9bMGH6CQ4u+gAV6GN9s+PwQx9Bl4hC+0iU8QOk8m
WO/RwXQy10DCSxT8vSIJClHKp+Ao4qJKdYeV0SwZ7LMQziyLfxIUOY6Grja/sQFw
LKYf8EdDXAyjggF1MIIBcTAfBgNVHSMEGDAWgBR8XQKEE9TMipuBzhccLikenEhj
QjAdBgNVHQ4EFgQU4TqrIXzx401UrtRyt/2LWUIgkFQwHQYDVR0lBBYwFAYIKwYB
BQUHAwEGCCsGAQUFBwMCMD0GA1UdIAQ2MDQwMgYEVR0gADAqMCgGCCsGAQUFBwIB
FhxodHRwOi8vcmVwb3NpdG9yeS5lbXNpZ24uY29tMHgGCCsGAQUFBwEBBGwwajAi
BggrBgEFBQcwAYYWaHR0cDovL29jc3AuZW1zaWduLmNvbTBEBggrBgEFBQcwAoY4
aHR0cDovL3JlcG9zaXRvcnkuZW1zaWduLmNvbS9jZXJ0cy9lbVNpZ25FQ0NSb290
Q0FHMy5jcnQwMwYDVR0fBCwwKjAooCagJIYiaHR0cDovL2NybC5lbXNpZ24uY29t
P1Jvb3RDQUczLmNybDAOBgNVHQ8BAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIB
ATAKBggqhkjOPQQDAwNpADBmAjEAt9CIpRGp46QHQYDUBnLKw+vvK0/h9vmilEAg
TroUl/anH4x2rXHqiCtBTBfgKDegAjEA8WpG1LTZdAIL0FSYqxXeREaeTSxEofM0
1jJH3jGvCXC79LU9UPJ2o3TU+UIj2gMV
-----END CERTIFICATE-----`

// Self-signed emSign ECC Root CA - G3, from the pre-fix Mozilla root store.
const EMSIGN_ECC_ROOT_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICTjCCAdOgAwIBAgIKPPYHqWhwDtqLhDAKBggqhkjOPQQDAzBrMQswCQYDVQQG
EwJJTjETMBEGA1UECxMKZW1TaWduIFBLSTElMCMGA1UEChMcZU11ZGhyYSBUZWNo
bm9sb2dpZXMgTGltaXRlZDEgMB4GA1UEAxMXZW1TaWduIEVDQyBSb290IENBIC0g
RzMwHhcNMTgwMjE4MTgzMDAwWhcNNDMwMjE4MTgzMDAwWjBrMQswCQYDVQQGEwJJ
TjETMBEGA1UECxMKZW1TaWduIFBLSTElMCMGA1UEChMcZU11ZGhyYSBUZWNobm9s
b2dpZXMgTGltaXRlZDEgMB4GA1UEAxMXZW1TaWduIEVDQyBSb290IENBIC0gRzMw
djAQBgcqhkjOPQIBBgUrgQQAIgNiAAQjpQy4LRL1KPOxst3iAhKAnjlfSU2fySU0
WXTsuwYc58Byr+iuL+FBVIcUqEqy6HyC5ltqtdyzdc6LBtCGI79G1Y4PPwT01xyS
fvalY8L1X44uT6EYGQIrMgqCZH0Wk9GjQjBAMB0GA1UdDgQWBBR8XQKEE9TMipuB
zhccLikenEhjQjAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAKBggq
hkjOPQQDAwNpADBmAjEAvvNhzwIQHWSVB7gYboiFBS+DCBeQyh+KTOgNG3qxrdWB
CUfvO6wIBHxcmbHtRwfSAjEAnbpV/KlK6O3t5nYBQnvI+GDZjVGLVTv7jHvrZQnD
+JbNR6iC8hZVdyR+EhCVBCyj
-----END CERTIFICATE-----`

// Let's Encrypt E6 intermediate, issued by ISRG Root X1.
const LETS_ENCRYPT_E6_PEM = `-----BEGIN CERTIFICATE-----
MIIEVzCCAj+gAwIBAgIRALBXPpFzlydw27SHyzpFKzgwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjQwMzEzMDAwMDAw
WhcNMjcwMzEyMjM1OTU5WjAyMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg
RW5jcnlwdDELMAkGA1UEAxMCRTYwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAATZ8Z5G
h/ghcWCoJuuj+rnq2h25EqfUJtlRFLFhfHWWvyILOR/VvtEKRqotPEoJhC6+QJVV
6RlAN2Z17TJOdwRJ+HB7wxjnzvdxEP6sdNgA1O1tHHMWMxCcOrLqbGL0vbijgfgw
gfUwDgYDVR0PAQH/BAQDAgGGMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcD
ATASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBSTJ0aYA6lRaI6Y1sRCSNsj
v1iU0jAfBgNVHSMEGDAWgBR5tFnme7bl5AFzgAiIyBpY9umbbjAyBggrBgEFBQcB
AQQmMCQwIgYIKwYBBQUHMAKGFmh0dHA6Ly94MS5pLmxlbmNyLm9yZy8wEwYDVR0g
BAwwCjAIBgZngQwBAgEwJwYDVR0fBCAwHjAcoBqgGIYWaHR0cDovL3gxLmMubGVu
Y3Iub3JnLzANBgkqhkiG9w0BAQsFAAOCAgEAfYt7SiA1sgWGCIpunk46r4AExIRc
MxkKgUhNlrrv1B21hOaXN/5miE+LOTbrcmU/M9yvC6MVY730GNFoL8IhJ8j8vrOL
pMY22OP6baS1k9YMrtDTlwJHoGby04ThTUeBDksS9RiuHvicZqBedQdIF65pZuhp
eDcGBcLiYasQr/EO5gxxtLyTmgsHSOVSBcFOn9lgv7LECPq9i7mfH3mpxgrRKSxH
pOoZ0KXMcB+hHuvlklHntvcI0mMMQ0mhYj6qtMFStkF1RpCG3IPdIwpVCQqu8GV7
s8ubknRzs+3C/Bm19RFOoiPpDkwvyNfvmQ14XkyqqKK5oZ8zhD32kFRQkxa8uZSu
h4aTImFxknu39waBxIRXE4jKxlAmQc4QjFZoq1KmQqQg0J/1JF8RlFvJas1VcjLv
YlvUB2t6npO6oQjB3l+PNf0DpQH7iUx3Wz5AjQCi6L25FjyE06q6BZ/QlmtYdl/8
ZYao4SRqPEs/6cAiF+Qf5zg2UkaWtDphl1LKMuTNLotvsX99HP69V2faNyegodQ0
LyTApr/vT01YPE46vNsDLgK+4cL6TrzC/a4WcmF5SRJ938zrv/duJHLXQIku5v0+
EwOy59Hdm0PT/Er/84dDV0CSjdR/2XuZM3kpysSKLgD1cKiDA+IRguODCxfO9cyY
Ig46v9mFmBvyH04=
-----END CERTIFICATE-----`

// An arbitrary self-signed CA certificate (Dstack KMS CA sample).
const SELF_SIGNED_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIBmjCCAUCgAwIBAgIUc3eKrPu8iKxJ/kETws0tgtnmO5cwCgYIKoZIzj0EAwIw
KTEPMA0GA1UECgwGRHN0YWNrMRYwFAYDVQQDDA1Ec3RhY2sgS01TIENBMB4XDTc1
MDEwMTAwMDAwMFoXDTM1MDgxMjE5MDUxN1owKTEPMA0GA1UECgwGRHN0YWNrMRYw
FAYDVQQDDA1Ec3RhY2sgS01TIENBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE
i/hPUpEQVkdMIHy1C06AENmE+JdepXuPDIsXUCGBwoPpOmiphkrRn2KVCMxpnxJb
44cewuJqsFl+W8pOKbdCX6NGMEQwDwYDVR0PAQH/BAUDAweAADAdBgNVHQ4EFgQU
g8KbWJEasjHzRn4FShxW2kn3SUswEgYDVR0TAQH/BAgwBgEB/wIBATAKBggqhkjO
PQQDAgNIADBFAiEAmRZ1ZOdFi4NYDQ9IC9cezYyYx49UEL3CdUaHWaWyFGoCIHGC
jsNjzXfGnNCrwzgYNgEc/+qpMRZANGTVLmOfErnn
-----END CERTIFICATE-----`

function parsePemChain(pem: string): X509Certificate[] {
  const blocks =
    pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
    ) ?? []
  return blocks.map((block) => new X509Certificate(block))
}

function spkiHex(certificate: X509Certificate): string {
  return certificate.publicKey
    .export({type: 'spki', format: 'der'})
    .toString('hex')
}

describe('isChainAnchoredToTrustedRoot', () => {
  test('accepts an intermediate signed by ISRG Root X1', () => {
    const chain = parsePemChain(LETS_ENCRYPT_E6_PEM)

    expect(isChainAnchoredToTrustedRoot(chain)).toBe(true)
  })

  test('accepts a chain that includes a trusted root', () => {
    const roots = TRUSTED_GATEWAY_ROOT_CERTIFICATES.map(
      (root) => new X509Certificate(root.pem),
    )
    for (const root of roots) {
      expect(isChainAnchoredToTrustedRoot([root])).toBe(true)
    }
  })

  test('rejects the emSign chain with its self-signed root appended', () => {
    const chain = parsePemChain(
      `${EMSIGN_SERVED_CHAIN_PEM}\n${EMSIGN_ECC_ROOT_G3_PEM}`,
    )

    expect(chain).toHaveLength(4)
    expect(isChainAnchoredToTrustedRoot(chain)).toBe(false)
  })

  test('rejects the emSign chain as served (no root)', () => {
    const chain = parsePemChain(EMSIGN_SERVED_CHAIN_PEM)

    expect(isChainAnchoredToTrustedRoot(chain)).toBe(false)
  })

  test('rejects an arbitrary self-signed root', () => {
    const chain = parsePemChain(SELF_SIGNED_ROOT_PEM)

    expect(isChainAnchoredToTrustedRoot(chain)).toBe(false)
  })
})

describe('verifyCertificateKey', () => {
  test('rejects an emSign-issued certificate even when its key matches', () => {
    const chainPem = `${EMSIGN_SERVED_CHAIN_PEM}\n${EMSIGN_ECC_ROOT_G3_PEM}`
    const [leaf] = parsePemChain(chainPem)
    if (!leaf) {
      throw new Error('fixture chain has no leaf certificate')
    }

    const acmeInfo = {
      active_cert: chainPem,
      hist_keys: [spkiHex(leaf)],
    } as unknown as AcmeInfo

    const result = verifyCertificateKey(acmeInfo)

    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Root certificate is not trusted')
  })
})
