'use client'

import {useAtom} from 'jotai'
import {useEffect, useState} from 'react'

import {AttestationDataProvider as ContextProvider} from '@/components/attestation-data-context'
import type {Data} from '@/data/schema'
import {fetchDataFromS3Client} from '@/lib/s3-data-client'
import {appWithTaskAtom} from '@/stores/app'

interface AttestationDataProviderProps {
  children: React.ReactNode
  initialSelectedObjectId?: string | null
}

export function AttestationDataProvider({
  children,
  initialSelectedObjectId,
}: AttestationDataProviderProps) {
  const [app] = useAtom(appWithTaskAtom)
  const [attestationData, setAttestationData] = useState<Data>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchAttestationData = async () => {
      if (!app?.task.s3Key) {
        setAttestationData([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const data = await fetchDataFromS3Client(app.task.s3Key)
        if (data) {
          setAttestationData(data)
        } else {
          setError('Failed to load attestation data')
          setAttestationData([])
        }
      } catch (error) {
        console.warn('Error fetching attestation data:', error)
        setError('Error loading attestation data')
        setAttestationData([])
      } finally {
        setLoading(false)
      }
    }

    fetchAttestationData()
  }, [app?.task.s3Key])

  // Show error if data loading failed
  if (error) {
    return (
      <div className="flex h-screen flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600">
            Error Loading Data
          </h2>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    )
  }

  // Show loading state
  if (loading || !attestationData || attestationData.length === 0) {
    return (
      <div className="flex h-screen flex-1 items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground">
            Loading attestation data...
          </div>
        </div>
      </div>
    )
  }

  return (
    <ContextProvider
      attestationData={attestationData}
      loading={loading}
      error={error}
      initialSelectedObjectId={initialSelectedObjectId}
    >
      {children}
    </ContextProvider>
  )
}
