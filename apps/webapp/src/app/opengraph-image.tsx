import {ImageResponse} from 'next/og'

import {getApps, getUsers} from '@/lib/db'

export const runtime = 'nodejs'
export const alt = 'Phala Trust Center'
export const size = {width: 1200, height: 630}
export const contentType = 'image/png'

// Light mode colors
const PHALA_GREEN = '#CDFA50'
const BG_COLOR = '#FFFFFF'
const CARD_BG = '#FAFAFA'
const BORDER_COLOR = '#E5E5E5'
const TEXT_PRIMARY = '#18181B'
const TEXT_SECONDARY = '#71717A'

// Badge colors
const BADGE_COLORS = {
  intel: {bg: '#EFF6FF', border: '#BFDBFE'},
  nvidia: {bg: '#F0FDF4', border: '#BBF7D0'},
  dstack: {bg: '#F5F5F5', border: '#D4D4D4'},
  github: {bg: '#EEF2FF', border: '#C7D2FE'},
  e2e: {bg: '#FEFCE8', border: '#FEF08A'},
}

// Format number with commas (manual implementation for Satori compatibility)
function formatNumber(num: number): string {
  const intPart = Math.floor(num)
  return intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default async function Image() {
  // Get actual total app count and featured builders
  const [appsData, users] = await Promise.all([
    getApps({page: 1, perPage: 1}),
    getUsers(),
  ])
  const totalApps = appsData.total

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: BG_COLOR,
          fontFamily: 'system-ui, sans-serif',
          padding: 40,
        }}
      >
        {/* Main content card */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: CARD_BG,
            borderRadius: 24,
            border: `2px solid ${BORDER_COLOR}`,
            padding: 48,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Green accent bar at top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              backgroundColor: PHALA_GREEN,
            }}
          />

          {/* Header section */}
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 24}}>
            {/* Phala logo */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 20,
                backgroundColor: PHALA_GREEN,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
                <path
                  d="M11.2 29.33H16.53V37.33H11.2V29.33Z"
                  fill="#1E2119"
                />
                <path d="M32.53 16H37.87V24H32.53V16Z" fill="#1E2119" />
                <path d="M16.53 24H32.53V29.33H16.53V24Z" fill="#1E2119" />
                <path
                  d="M11.2 10.67H32.53V16H16.53V24L11.2 23.93V10.67Z"
                  fill="#1E2119"
                />
              </svg>
            </div>

            {/* Title */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.1,
                }}
              >
                Phala Trust Center
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: TEXT_SECONDARY,
                  marginTop: 8,
                }}
              >
                Verify TEE Applications on dstack
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: 48,
              marginTop: 48,
            }}
          >
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                }}
              >
                {formatNumber(totalApps)}+
              </span>
              <span style={{fontSize: 20, color: TEXT_SECONDARY}}>
                Verified Apps
              </span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                }}
              >
                {users.length}
              </span>
              <span style={{fontSize: 20, color: TEXT_SECONDARY}}>
                Projects
              </span>
            </div>
          </div>

          {/* Verification badges */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 'auto',
              paddingTop: 40,
            }}
          >
            {[
              {label: 'Intel TDX', colors: BADGE_COLORS.intel},
              {label: 'NVIDIA CC', colors: BADGE_COLORS.nvidia},
              {label: 'dstack OS', colors: BADGE_COLORS.dstack},
              {label: 'Source Code', colors: BADGE_COLORS.github},
              {label: 'Zero Trust HTTPS', colors: BADGE_COLORS.e2e},
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: item.colors.bg,
                  border: `2px solid ${item.colors.border}`,
                  borderRadius: 12,
                  padding: '12px 20px',
                  gap: 10,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="#16A34A"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${BORDER_COLOR}`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <span
                style={{fontSize: 20, fontWeight: 500, color: TEXT_SECONDARY}}
              >
                Powered by
              </span>
              <span style={{fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY}}>
                Phala Network
              </span>
            </div>
            <span style={{fontSize: 18, color: TEXT_SECONDARY}}>
              trust.phala.com
            </span>
          </div>
        </div>
      </div>
    ),
    {...size},
  )
}
