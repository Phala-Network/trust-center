#!/usr/bin/env bun

/**
 * Simple test runner for the three curl requests
 */

import type { SystemInfo } from './types/application'
import type { AppSourceInfo } from './types/metadata'
import { createAppMetadata } from './utils/metadataUtils'
import { getPhalaCloudInfo, getRedpillInfo } from './utils/systemInfo'
import { VerificationService } from './verificationService'

// Sample app source info for ML applications
const deepseekAppSource: AppSourceInfo = {
  github_repo: 'https://github.com/phala-network/ai-agent-template',
  git_commit: 'a1b2c3d4e5f6',
  version: 'v1.0.0',
  model_name: 'phala/deepseek-chat-v3-0324',
}

const TEST_CASES = [
  {
    name: 'Redpill verification (deepseek-chat)',
    config: {
      contractAddress: '0x78601222ada762fa7cdcbc167aa66dd7a5f57ece' as const,
      model: 'phala/deepseek-chat-v3-0324',
      metadata: {} as any, // Will be populated dynamically
      appSource: deepseekAppSource,
      hasNvidiaSupport: true,
    },
  },
  // This will fail because of Gateway cert configuration issues
  // {
  //   name: 'Phala Cloud verification (dstack-eth-prod6)',
  //   config: {
  //     contractAddress: '0x421a4972020dda79fcdedb3e95099bc36ea3e701' as const,
  //     domain: 'dstack-eth-prod6.phala.network',
  //     metadata: {},
  //   },
  // },
  {
    name: 'Phala Cloud verification (dstack-base-prod6)',
    config: {
      contractAddress: '0xc16c8a4bbc5a8a8a09464eedae0eb6bfd60e77cb' as const,
      domain: 'dstack-base-prod6.phala.network',
      metadata: {} as any, // Will be populated dynamically
    },
  },
  {
    name: 'Phala Cloud verification (dstack-base-prod7)',
    config: {
      contractAddress: '0xd722c43a6f4f42d53dc7bc97ba04a1cb17ce3a34' as const,
      domain: 'dstack-base-prod7.phala.network',
      metadata: {} as any, // Will be populated dynamically
    },
  },
]

async function runTests() {
  console.log(
    '🧪 Running verification tests (equivalent to your curl requests)',
  )
  console.log(`Found ${TEST_CASES.length} test cases\n`)

  const service = new VerificationService()

  for (const testCase of TEST_CASES) {
    console.log(`🔍 ${testCase.name}`)
    console.log(`   Contract: ${testCase.config.contractAddress}`)

    const startTime = Date.now()

    try {
      // Get systemInfo and populate metadata
      let systemInfo: SystemInfo
      if ('model' in testCase.config) {
        // Redpill config
        systemInfo = await getRedpillInfo(
          testCase.config.contractAddress,
          testCase.config.model || '',
        )
        testCase.config.metadata = createAppMetadata(
          systemInfo,
          (testCase.config as any).appSource,
          (testCase.config as any).hasNvidiaSupport,
        )
      } else if ('domain' in testCase.config) {
        // PhalaCloud config
        systemInfo = await getPhalaCloudInfo(testCase.config.contractAddress)
        testCase.config.metadata = createAppMetadata(
          systemInfo,
          undefined,
          true,
        )
      } else {
        throw new Error('Invalid test case configuration')
      }

      console.log(
        `   📋 Metadata populated from systemInfo (version: ${systemInfo.kms_info.version})`,
      )

      const result = await service.verify(testCase.config)
      const duration = Date.now() - startTime

      console.log(`   ✅ Success: ${result.success}`)
      console.log(`   ⏱️  Duration: ${duration}ms`)
      console.log(`   📊 Data Objects: ${result.dataObjects.length}`)

      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.length}`)
        result.errors.forEach((error, i) => {
          console.log(`      ${i + 1}. ${error.message}`)
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.log(
        `   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      console.log(`   ⏱️  Duration: ${duration}ms`)
    }

    console.log() // Empty line between tests

    // Wait 2 seconds between tests to avoid rate limiting
    if (TEST_CASES.indexOf(testCase) < TEST_CASES.length - 1) {
      console.log('   ⏳ Waiting 2 seconds to avoid rate limit...\n')
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log('✅ All tests completed')
}

if (import.meta.main) {
  await runTests()
}
