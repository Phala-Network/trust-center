import {ImageResponse} from 'next/og'

import {getApps, getUsers} from '@/lib/db'

export const runtime = 'nodejs'
export const alt = 'Trust Center Project'
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

interface PageProps {
  params: Promise<{username: string}>
}

export default async function Image({params}: PageProps) {
  const {username} = await params
  const decodedUsername = decodeURIComponent(username)

  // Get user profile
  const allUsers = await getUsers()
  const profile = allUsers.find((u) => u.user === decodedUsername)

  // Get apps for this user
  const appsData = await getApps({
    username: decodedUsername,
    page: 1,
    perPage: 6,
    sortBy: 'appName',
  })

  // If profile not found, return a generic image
  if (!profile) {
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
            <div style={{display: 'flex', fontSize: 32, fontWeight: 600, color: TEXT_PRIMARY}}>
              Project Not Found
            </div>
            <div style={{display: 'flex', fontSize: 18, marginTop: 12}}>Phala Trust Center</div>
          </div>
        </div>
      ),
      {...size},
    )
  }

  const avatarUrl = profile.avatarUrl?.startsWith('/')
    ? `https://trust.phala.com${profile.avatarUrl}`
    : profile.avatarUrl

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
            {/* Project logo */}
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
                <span
                  style={{
                    display: 'flex',
                    fontSize: 36,
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                  }}
                >
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Project info */}
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
                  display: 'flex',
                  fontSize: 48,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.1,
                }}
              >
                {profile.displayName.length > 25
                  ? `${profile.displayName.slice(0, 22)}...`
                  : profile.displayName}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  color: TEXT_SECONDARY,
                  marginTop: 8,
                }}
              >
                {profile.count} verified {profile.count === 1 ? 'app' : 'apps'}
              </div>
            </div>

            {/* Verified badge */}
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
                  display: 'flex',
                  fontSize: 28,
                  fontWeight: 700,
                  color: SUCCESS_GREEN,
                }}
              >
                Verified
              </span>
            </div>
          </div>

          {/* App preview grid */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 'auto',
              paddingTop: 40,
            }}
          >
            {appsData.apps.slice(0, 6).map((app, index) => {
              const appAvatarUrl =
                app.profile?.fullAvatarUrl ||
                app.workspaceProfile?.fullAvatarUrl ||
                app.userProfile?.fullAvatarUrl
              const appAvatar = appAvatarUrl?.startsWith('/')
                ? `https://trust.phala.com${appAvatarUrl}`
                : appAvatarUrl
              const appName = app.profile?.displayName || app.appName

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${BORDER_COLOR}`,
                    borderRadius: 12,
                    padding: '12px 20px',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: CARD_BG,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      fontSize: 20,
                    }}
                  >
                    {appAvatar ? (
                      <img
                        src={appAvatar}
                        alt=""
                        width={40}
                        height={40}
                        style={{objectFit: 'cover', borderRadius: 6}}
                      />
                    ) : (
                      <span style={{display: 'flex'}}>📦</span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'flex',
                      fontSize: 18,
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {appName.length > 12 ? `${appName.slice(0, 10)}...` : appName}
                  </span>
                </div>
              )
            })}
            {profile.count > 6 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: CARD_BG,
                  border: `2px solid ${BORDER_COLOR}`,
                  borderRadius: 12,
                  padding: '12px 20px',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    fontSize: 18,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                  }}
                >
                  +{profile.count - 6} more
                </span>
              </div>
            ) : null}
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
                style={{display: 'flex', fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY}}
              >
                Phala Trust Center
              </span>
            </div>
            <span style={{display: 'flex', fontSize: 18, color: TEXT_SECONDARY}}>
              trust.phala.com
            </span>
          </div>
        </div>
      </div>
    ),
    {...size},
  )
}
