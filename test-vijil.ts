/**
 * Test script for Vijil API integration
 * Tests creating an evaluation for the demo agent
 */

const VIJIL_API_URL = 'https://evaluate-api.vijil.ai'
const VIJIL_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijd6XzJmTFF3MVJhcHFNazNkVUhFaCJ9.eyJpc3MiOiJodHRwczovL2xvZ2luLnZpamlsLmFpLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTExNDg1MTc4MTM0MzQ2MTIxNjcyIiwiYXVkIjpbImh0dHBzOi8vcHJvZC1hcGkuY2xvdWQtZGV2LnZpamlsLmFpIiwiaHR0cHM6Ly90cnVzdHZpamlsLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NjMwMzY1NDUsImV4cCI6MTc2MzEyMjk0NSwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCByZWFkOmV2YWx1YXRpb25zIHdyaXRlOmV2YWx1YXRpb25zIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoidWwwdG01cW5zTWZFMkpWMjg2Mnk3bXd3SEI0b1R3T3kiLCJwZXJtaXNzaW9ucyI6WyJyZWFkOmV2YWx1YXRpb25zIiwicmVhZDp0ZWFtcyIsIndyaXRlOmV2YWx1YXRpb25zIiwid3JpdGU6dGVhbXMiXX0.15JuU66ffISU4LNvVymK7CJDpP-hJq1kPj-26DU67k4FU7Mo2v4D5AvEOyghVNILEpl2-ZY_KQSjguJ-nhn9NozOWcnt7AlsqESo2d0swaYcX27CiXCCqMQuOTLg_zXqcVF-xo4YOSmZRqASHe8Efam_IBpn3wf3wwOkYwt0-SQv1JYpqI4C6L1flDwpmSwDeRxCdMQw9Bx1WRDuBxneF6Wzw692EnIqsi5B36A7-Ar7VXvoB6ibMr8X0CZO_nW2kgwmzvD175jOAmBaURIEsdLz8cdh3S8UCJBALQ2ymFhJIrWSYFi7f8Xbb-QZFD5w-Knosg9qNaiM9MFossEkyg'
const AGENT_ENDPOINT = 'https://22b30e8e1b01d732e7dae67d7b0c2dfd67dfeb53-8000.dstack-pha-prod7.phala.network/v1'
const MODEL_NAME = 'vijil-docs-agent'


async function testGetEvaluations() {
  console.log('=== Testing GET /v1/evaluations ===')
  console.log('Endpoint:', `${VIJIL_API_URL}/v1/evaluations`)
  console.log('Token:', VIJIL_API_TOKEN)
  console.log()

  try {
    const response = await fetch(`${VIJIL_API_URL}/v1/evaluations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VIJIL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Status:', response.status, response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))

    const data = await response.text()
    console.log('Response body:', data)

    if (response.ok) {
      try {
        const json = JSON.parse(data)
        console.log('Parsed JSON:', JSON.stringify(json, null, 2))
      } catch (e) {
        console.log('Not valid JSON')
      }
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

async function testCreateEvaluation() {
  console.log('\n=== Creating New Evaluation ===')
  console.log('Endpoint:', `${VIJIL_API_URL}/v1/evaluations`)
  console.log('Agent URL:', AGENT_ENDPOINT)
  console.log('Model:', MODEL_NAME)
  console.log()

  // Evaluation request based on Vijil API
  // Key fields: model_hub, model_name, harnesses are required
  // For custom endpoints, also need url field
  const requestBody = {
    name: `phala-eval-${Date.now()}`,
    model_hub: 'custom',
    model_name: MODEL_NAME,
    url: AGENT_ENDPOINT,
    harnesses: ['security'],  // Required field
    model_params: {
      temperature: 0,
    },
    harness_params: {
      is_lite: false,  // Full evaluation
    },
    tags: ['phala', 'trust-center', 'auto-generated'],
  }

  console.log('Request body:', JSON.stringify(requestBody, null, 2))

  try {
    const response = await fetch(`${VIJIL_API_URL}/v1/evaluations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIJIL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log('Status:', response.status, response.statusText)

    const data = await response.text()
    console.log('Response body:', data)

    if (response.ok) {
      try {
        const json = JSON.parse(data)
        console.log('\n✅ Evaluation created successfully!')
        console.log('Evaluation ID:', json.id)
        console.log('Status:', json.status)
        console.log('Web Link:', `https://evaluate.vijil.ai/evaluations/${json.id}`)
        return json
      } catch (e) {
        console.log('Not valid JSON')
      }
    } else {
      console.error('❌ Failed to create evaluation')
      console.error('Response:', data)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

async function testAgentEndpoint() {
  console.log('\n=== Testing Agent Endpoint ===')
  console.log('Endpoint:', AGENT_ENDPOINT)
  console.log()

  try {
    // Test health endpoint
    const healthUrl = AGENT_ENDPOINT.replace('/v1', '/v1/health')
    console.log('Testing health endpoint:', healthUrl)

    const healthResponse = await fetch(healthUrl)
    console.log('Health check status:', healthResponse.status, healthResponse.statusText)

    if (healthResponse.ok) {
      const healthData = await healthResponse.text()
      console.log('Health response:', healthData)
    }

    // Test chat completions endpoint
    console.log('\nTesting chat completions endpoint...')
    const response = await fetch(`${AGENT_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: 'What is Vijil?',
          },
        ],
      }),
    })

    console.log('Chat status:', response.status, response.statusText)

    if (response.ok) {
      const chatData = await response.json()
      console.log('Chat response:', JSON.stringify(chatData, null, 2))
    } else {
      const errorData = await response.text()
      console.log('Chat error:', errorData)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

async function checkAndCreateEvaluation() {
  console.log('\n=== Checking for Existing Evaluations ===\n')
  console.log('Agent Endpoint:', AGENT_ENDPOINT)
  console.log()

  try {
    // Step 1: Fetch all evaluations
    const response = await fetch(`${VIJIL_API_URL}/v1/evaluations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VIJIL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Failed to fetch evaluations:', response.status, response.statusText)
      return
    }

    const data = await response.json()

    // Step 2: Filter for evaluations matching our agent endpoint
    const agentEvaluations = (data.results || []).filter((evaluation: any) =>
      evaluation.url === AGENT_ENDPOINT
    )

    console.log(`Found ${agentEvaluations.length} evaluation(s) for agent endpoint\n`)

    // Categorize evaluations
    const wipEvaluations = agentEvaluations.filter((evaluation: any) =>
      ['RUNNING', 'PENDING', 'CREATED'].includes(evaluation.status)
    )

    const completedEvaluations = agentEvaluations.filter((evaluation: any) =>
      evaluation.status === 'COMPLETED'
    )

    // Step 3: If there are WIP or completed evaluations, print them
    if (wipEvaluations.length > 0) {
      console.log('✅ Found work-in-progress evaluations:\n')
      wipEvaluations.forEach((evaluation: any, index: number) => {
        console.log(`${index + 1}. ${evaluation.name || 'Unnamed'}`)
        console.log(`   ID: ${evaluation.id}`)
        console.log(`   Status: ${evaluation.status}`)
        if (evaluation.completed_test_count !== undefined && evaluation.total_test_count !== undefined) {
          console.log(`   Progress: ${evaluation.completed_test_count}/${evaluation.total_test_count} tests`)
        }
        console.log(`   Link: https://evaluate.vijil.ai/evaluations/${evaluation.id}`)
        console.log()
      })
    }

    if (completedEvaluations.length > 0) {
      console.log('✅ Found completed evaluations:\n')
      completedEvaluations.forEach((evaluation: any, index: number) => {
        console.log(`${index + 1}. ${evaluation.name || 'Unnamed'}`)
        console.log(`   ID: ${evaluation.id}`)
        console.log(`   Status: ${evaluation.status}`)
        console.log(`   Score: ${evaluation.score}`)
        console.log(`   Tests: ${evaluation.completed_test_count}/${evaluation.total_test_count}`)
        console.log(`   Link: https://evaluate.vijil.ai/evaluations/${evaluation.id}`)
        console.log()
      })
      console.log('✅ Ready for demo! The integration will automatically include these evaluation links.')
      return
    }

    // If we have WIP evaluations, don't create a new one
    if (wipEvaluations.length > 0) {
      console.log('⏳ Evaluations are in progress. Wait for them to complete before creating new ones.')
      return
    }

    // Step 4: No evaluations found - create a new one
    console.log('⚠️  No evaluations found for this agent endpoint.')
    // console.log('Creating a new evaluation...\n')

    // await testCreateEvaluation()

  } catch (error) {
    console.error('❌ Error checking evaluations:', error)
  }
}

async function main() {
  console.log('Vijil API Test Script')
  console.log('====================\n')

  // Check for existing evaluations and create if needed
  await checkAndCreateEvaluation()

  console.log('\n✅ Test complete!')
}

main()
