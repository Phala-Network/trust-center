import {ImageResponse} from 'next/og'

import {getApp} from '@/lib/db'

export const runtime = 'nodejs'
export const alt = 'Trust Center App Verification'
export const size = {width: 1200, height: 630}
export const contentType = 'image/png'

// Light mode colors
const PHALA_GREEN = '#CDFA50'
const BG_COLOR = '#FFFFFF'
const CARD_BG = '#FAFAFA'
const BORDER_COLOR = '#E5E5E5'
const TEXT_PRIMARY = '#18181B'
const TEXT_SECONDARY = '#71717A'
const SUCCESS_GREEN = '#16A34A'
const BADGE_BG = '#F0FDF4'

// Badge colors - harmonious palette matching brand colors
const BADGE_COLORS = {
  intel: {bg: '#EFF6FF', border: '#BFDBFE', check: '#2563EB'}, // Blue (Intel brand)
  nvidia: {bg: '#F0FDF4', border: '#BBF7D0', check: '#16A34A'}, // Green (NVIDIA brand)
  dstack: {bg: '#F5F5F5', border: '#D4D4D4', check: '#525252'}, // Neutral gray (dstack)
  source: {bg: '#EEF2FF', border: '#C7D2FE', check: '#4F46E5'}, // Indigo (code/dev)
  phala: {bg: '#FEFCE8', border: '#FEF08A', check: '#CA8A04'}, // Yellow/lime (Phala brand)
}

// Check icon for badges - accepts color prop
const BadgeCheck = ({color}: {color: string}) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M20 6L9 17L4 12"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Large check icon for verified badge
const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M20 6L9 17L4 12"
      stroke={SUCCESS_GREEN}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Intel logo
const IntelLogo = () => (
  <svg width="64" height="26" viewBox="0 0 389 151" fill="none">
    <path d="M28.1 2.1H0V30.2H28.1V2.1Z" fill="#04C7FD" />
    <path
      d="M27.4 148.5V47.3H0.8V148.5H27.4ZM204.2 149.5V124.7C200.3 124.7 197 124.5 194.6 124.1C191.8 123.7 189.7 122.7 188.3 121.3C186.9 119.9 186 117.9 185.5 115.3C185.1 112.8 184.9 109.5 184.9 105.5V70.1H204.2V47.3H184.9V7.8H158.2V105.7C158.2 114 158.9 121 160.3 126.6C161.7 132.1 164.1 136.6 167.4 140C170.7 143.4 175.1 145.8 180.4 147.3C185.8 148.8 192.6 149.5 200.7 149.5H204.2ZM357 148.5V0H330.3V148.5H357ZM132.5 57.2C125.1 49.2 114.7 45.2 101.5 45.2C95.1 45.2 89.3 46.5 84 49.1C78.8 51.7 74.3 55.3 70.8 59.9L69.3 61.8V60.1V47.3H43V148.5H69.5V94.6V98.3C69.5 97.7 69.5 97.1 69.5 96.5C69.8 87 72.1 80 76.5 75.5C81.2 70.7 86.9 68.3 93.4 68.3C101.1 68.3 107 70.7 110.9 75.3C114.7 79.9 116.7 86.4 116.7 94.7V94.9V148.4H143.6V91C143.7 76.6 139.9 65.2 132.5 57.2ZM316.5 97.7C316.5 90.4 315.2 83.6 312.7 77.2C310.1 70.9 306.5 65.3 302 60.5C297.4 55.7 291.9 52 285.5 49.3C279.1 46.6 272 45.3 264.3 45.3C257 45.3 250.1 46.7 243.7 49.4C237.3 52.2 231.7 55.9 227 60.6C222.3 65.3 218.5 70.9 215.8 77.3C213 83.7 211.7 90.6 211.7 97.9C211.7 105.2 213 112.1 215.6 118.5C218.2 124.9 221.9 130.5 226.5 135.2C231.1 139.9 236.8 143.7 243.4 146.4C250 149.2 257.3 150.6 265.1 150.6C287.7 150.6 301.7 140.3 310.1 130.7L290.9 116.1C286.9 120.9 277.3 127.4 265.3 127.4C257.8 127.4 251.6 125.7 246.9 122.2C242.2 118.8 239 114 237.3 108.1L237 107.2H316.5V97.7ZM237.2 88.4C237.2 81 245.7 68.1 264 68C282.3 68 290.9 80.9 290.9 88.3L237.2 88.4Z"
      fill="#0068B5"
    />
  </svg>
)

// NVIDIA logo
const NvidiaLogo = () => (
  <svg width="64" height="38" viewBox="0 0 924 172" fill="none">
    <path
      d="M96.4 51.67V36.33C97.91 36.23 99.43 36.14 100.94 36.14C143 34.81 170.55 72.32 170.55 72.32C170.55 72.32 140.81 113.61 108.9 113.61C104.64 113.61 100.47 112.94 96.49 111.62V65.02C112.88 67.01 116.19 74.21 125.94 90.59L147.82 72.22C147.82 72.22 131.82 51.29 104.92 51.29C102.08 51.2 99.24 51.39 96.4 51.67ZM96.4 0.91V23.83L100.94 23.54C159.37 21.55 197.54 71.46 197.54 71.46C197.54 71.46 153.79 124.69 108.23 124.69C104.26 124.69 100.37 124.31 96.49 123.65V137.85C99.71 138.23 103.03 138.51 106.25 138.51C148.67 138.51 179.36 116.83 209.09 91.26C214.02 95.23 234.19 104.8 238.36 108.97C210.14 132.64 144.32 151.68 107 151.68C103.4 151.68 100 151.49 96.59 151.11V171.09H257.77V0.91L96.4 0.91ZM96.4 111.62V123.74C57.19 116.73 46.3 75.91 46.3 75.91C46.3 75.91 65.14 55.08 96.4 51.67V64.93H96.3C79.92 62.94 67.04 78.28 67.04 78.28C67.04 78.28 74.33 104.14 96.4 111.62ZM26.79 74.21C26.79 74.21 49.99 39.93 96.49 36.33V23.83C44.97 27.99 0.46 71.56 0.46 71.56C0.46 71.56 25.65 144.48 96.4 151.11V137.85C44.5 131.41 26.79 74.21 26.79 74.21Z"
      fill="#76B900"
    />
  </svg>
)

// dstack logo
const DstackLogo = () => (
  <svg width="44" height="44" viewBox="0 0 110 106" fill="none">
    <path
      d="M90.45 11.31C93.94 14.14 95.01 18.99 93.05 23.03C85.92 37.69 70.41 47.8 63.28 49.93C58.59 51.33 53.78 50.68 50.36 49.8C48.12 49.21 47.17 46.55 48.53 44.67C52.91 38.62 60.19 24.75 55.5 3.56C55.1 1.76 56.45 0.04 58.31 0.01C62.68 -0.06 67.65 0.48 73.01 1.88C79.44 3.93 85.33 7.16 90.45 11.31Z"
      fill="#18181B"
    />
    <path
      d="M110.31 52.96C110.31 61.04 108.53 68.7 105.32 75.57C104.24 77.88 101.11 78.24 99.52 76.24C91.66 66.41 80.9 61.96 74.57 59.66C72.12 58.78 70.17 57.76 68.65 56.78C66.57 55.45 66.92 52.3 69.23 51.41C76.38 48.64 89.58 41.38 97.79 23.79C98.5 22.26 100.6 22.13 101.53 23.54C107.08 31.98 110.31 42.09 110.31 52.96Z"
      fill="#18181B"
    />
    <path
      d="M47.6 35.63C47.91 28.42 46.5 17.27 36.3 10.97C34.74 10 34.68 7.75 36.2 6.72C38.66 5.05 42.32 3.04 47.14 1.65C49.24 1.05 51.4 2.34 51.87 4.47C54.97 18.4 52.33 29.55 49.82 36.09C49.36 37.3 47.55 36.93 47.6 35.63Z"
      fill="#18181B"
    />
    <path
      d="M96.67 88.68C90.86 95.18 83.48 100.25 75.14 103.3C71.83 104.51 68.34 101.92 68.59 98.4C68.85 94.63 69.83 91.47 69.52 86.19C69.17 80.2 66.59 73.98 64.77 70.25C63.67 68.01 64.8 65.32 67.16 64.52C69.31 63.79 72.25 63.33 75.92 64C82.52 65.21 91.7 70.51 97.37 79.2C99.29 82.16 99.02 86.05 96.67 88.68Z"
      fill="#18181B"
    />
    <path
      d="M62.55 105.81C21.32 105.72 10.63 74.16 8 61.61C7.8 60.65 9.08 60.13 9.61 60.95C14.1 67.99 25.52 81.43 49.13 86.05C51.5 86.52 53.69 87.68 55.39 89.4C58.35 92.39 62.82 97.39 64.93 102.19C65.69 103.9 64.42 105.81 62.55 105.81Z"
      fill="#18181B"
    />
  </svg>
)

// GitHub logo for Source Code
const SourceCodeLogo = () => (
  <svg width="44" height="44" viewBox="0 0 98 96" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      fill="#24292f"
    />
  </svg>
)

// End-to-end encryption lock icon for Zero Trust HTTPS
const E2ELogo = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="#CA8A04" />
    <path
      d="M7 11V7a5 5 0 0 1 10 0v4"
      stroke="#CA8A04"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="12" cy="16" r="1.5" fill="#FEFCE8" />
    <path d="M12 17.5V19" stroke="#FEFCE8" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

interface PageProps {
  params: Promise<{'app-id': string; 'task-id': string}>
}

export default async function Image({params}: PageProps) {
  const {'app-id': appId} = await params
  const app = await getApp(appId, true)

  // If app not found or not completed, return a generic image
  if (!app || app.task.status !== 'completed') {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: BG_COLOR,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: TEXT_SECONDARY,
            }}
          >
            <div style={{fontSize: 32, fontWeight: 600, color: TEXT_PRIMARY}}>
              Report Not Available
            </div>
            <div style={{fontSize: 18, marginTop: 12}}>Phala Trust Center</div>
          </div>
        </div>
      ),
      {...size},
    )
  }

  const displayName = app.profile?.displayName || app.appName
  const displayUser =
    app.workspaceProfile?.displayName || app.customUser || undefined
  const rawAvatarUrl =
    app.profile?.fullAvatarUrl ||
    app.workspaceProfile?.fullAvatarUrl ||
    app.userProfile?.fullAvatarUrl

  // Convert relative URLs to absolute for OG image generation
  const avatarUrl = rawAvatarUrl?.startsWith('/')
    ? `https://trust.phala.com${rawAvatarUrl}`
    : rawAvatarUrl

  // Determine verification items based on dataObjects
  const dataObjects = app.task.dataObjects || []
  const hasIntel = dataObjects.includes('app-cpu')
  const hasNvidia = dataObjects.includes('app-gpu')
  const hasOS = dataObjects.includes('app-os')
  const hasSourceCode = dataObjects.includes('app-code')
  const hasGateway = dataObjects.includes('gateway-main')

  // Build verification items list
  const verificationItems: Array<{
    label: string
    icon: 'intel' | 'nvidia' | 'dstack' | 'source' | 'phala'
  }> = []

  if (hasIntel) {
    verificationItems.push({label: 'Intel TDX', icon: 'intel'})
  }
  if (hasNvidia) {
    verificationItems.push({label: 'NVIDIA CC', icon: 'nvidia'})
  }
  if (hasOS) {
    verificationItems.push({label: 'dstack OS', icon: 'dstack'})
  }
  if (hasSourceCode) {
    verificationItems.push({label: 'Source Code', icon: 'source'})
  }
  if (hasGateway) {
    verificationItems.push({label: 'Zero Trust HTTPS', icon: 'phala'})
  }

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
            {/* App logo */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${BORDER_COLOR}`,
                overflow: 'hidden',
                flexShrink: 0,
                fontSize: 48,
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  width={96}
                  height={96}
                  style={{objectFit: 'cover', borderRadius: 18}}
                />
              ) : (
                <span>📦</span>
              )}
            </div>

            {/* App info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
              }}
            >
              {displayUser && (
                <div
                  style={{
                    fontSize: 20,
                    color: TEXT_SECONDARY,
                    marginBottom: 4,
                  }}
                >
                  {displayUser}
                </div>
              )}
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.1,
                }}
              >
                {displayName.length > 30
                  ? `${displayName.slice(0, 27)}...`
                  : displayName}
              </div>
            </div>

            {/* App Verified badge - height matches app logo (96px) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: BADGE_BG,
                border: `3px solid ${SUCCESS_GREEN}`,
                borderRadius: 20,
                padding: '0 32px',
                flexShrink: 0,
                gap: 16,
                height: 96,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17L4 12"
                  stroke={SUCCESS_GREEN}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: SUCCESS_GREEN,
                }}
              >
                App Verified
              </span>
            </div>
          </div>

          {/* Verification badges - PROMINENT */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 'auto',
              paddingTop: 40,
            }}
          >
            {verificationItems.map((item, index) => {
              const colors = BADGE_COLORS[item.icon]
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: colors.bg,
                    border: `3px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: '20px 28px',
                    gap: 16,
                  }}
                >
                  <BadgeCheck color={colors.check} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon === 'intel' && <IntelLogo />}
                    {item.icon === 'nvidia' && <NvidiaLogo />}
                    {item.icon === 'dstack' && <DstackLogo />}
                    {item.icon === 'source' && <SourceCodeLogo />}
                    {item.icon === 'phala' && <E2ELogo />}
                  </div>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              )
            })}
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
              {/* Phala logo */}
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <path
                  d="M0 7.68C0 4.99 0 3.65 0.52 2.62C0.98 1.72 1.72 0.98 2.62 0.52C3.65 0 4.99 0 7.68 0H40.32C43.01 0 44.35 0 45.38 0.52C46.28 0.98 47.02 1.72 47.48 2.62C48 3.65 48 4.99 48 7.68V40.32C48 43.01 48 44.35 47.48 45.38C47.02 46.28 46.28 47.02 45.38 47.48C44.35 48 43.01 48 40.32 48H7.68C4.99 48 3.65 48 2.62 47.48C1.72 47.02 0.98 46.28 0.52 45.38C0 44.35 0 43.01 0 40.32V7.68Z"
                  fill={PHALA_GREEN}
                />
                <path
                  d="M11.2 29.33H16.53V37.33H11.2V29.33Z"
                  fill="#1E2119"
                />
                <path d="M32.53 16H37.87V24H32.53V16Z" fill="#1E2119" />
                <path
                  d="M16.53 24H32.53V29.33H16.53V24Z"
                  fill="#1E2119"
                />
                <path
                  d="M11.2 10.67H32.53V16H16.53V24L11.2 23.93V10.67Z"
                  fill="#1E2119"
                />
              </svg>
              <span
                style={{fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY}}
              >
                Phala Trust Center
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
