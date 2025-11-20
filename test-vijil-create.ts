// Test script to verify creating evaluations works
const VIJIL_API_URL = 'https://evaluate-api.vijil.ai'
const VIJIL_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijd6XzJmTFF3MVJhcHFNazNkVUhFaCJ9.eyJpc3MiOiJodHRwczovL2xvZ2luLnZpamlsLmFpLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTExNDg1MTc4MTM0MzQ2MTIxNjcyIiwiYXVkIjpbImh0dHBzOi8vcHJvZC1hcGkuY2xvdWQtZGV2LnZpamlsLmFpIiwiaHR0cHM6Ly90cnVzdHZpamlsLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NjI4NjUzMjQsImV4cCI6MTc2Mjk1MTcyNCwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCByZWFkOmV2YWx1YXRpb25zIHdyaXRlOmV2YWx1YXRpb25zIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoidWwwdG01cW5zTWZFMkpWMjg2Mnk3bXd3SEI0b1R3T3kiLCJwZXJtaXNzaW9ucyI6WyJyZWFkOmV2YWx1YXRpb25zIiwicmVhZDp0ZWFtcyIsIndyaXRlOmV2YWx1YXRpb25zIiwid3JpdGU6dGVhbXMiXX0.X1CEANvTrCdwsW4hrW8rEOXyNAhw5CR0k9qLk38EDT7h40tBcTLefd-gNwACIiijK7uas5uquIY3ReRCpXTntTuinuVoMILq507XHgjR7D6G6jyChDo-J23sfOgbzbvzYuKRuZXH5AlCoN8ARA3Fh6fpuVMKvyNFaBrVf3ZBlS4mwIxdShhLe37VMatkSRH_XvYNg_ZofAEu6jvqvJ84-3fyj1_oxTt-i1cCcRteKXwAWyGbk7olJm2_AL6uTiMOpkdqQkvS9f0S6yV0S9sMRZljJTEl9afiw7Wy0_M-xI3VWVi0ahsItTgjEweL1aAA5zsV7Gt00BcFgWxDG186RA'
const AGENT_ENDPOINT = 'https://22b30e8e1b01d732e7dae67d7b0c2dfd67dfeb53-8000.dstack-pha-prod7.phala.network/v1'
const MODEL_NAME = 'vijil-docs-agent'

// Option: Use existing agent configuration
const USE_AGENT_CONFIG = true
const AGENT_CONFIG_ID = 'f101b5a6-6852-4dce-9330-a8e2af85948a'

async function testCreateEvaluation() {
  console.log('=== Testing Create Evaluation ===')
  console.log('Endpoint:', `${VIJIL_API_URL}/v1/evaluations`)
  console.log('Agent URL:', AGENT_ENDPOINT)
  console.log('Model:', MODEL_NAME)
  console.log('Using Agent Config:', USE_AGENT_CONFIG)
  console.log()

  // Build request body - all required fields must be present
  const requestBody = {
    id: crypto.randomUUID(),
    name: `phala-test-${Date.now()}`,
    hub: 'custom',
    model: MODEL_NAME,
    api_key_proxy: '',  // Empty string for custom endpoints without API key
    harness_config_ids: [],
    scenario_config_filters: [],
    agent_params: {
      temperature: 0,
    },
    tags: ['phala', 'trust-center', 'test'],
    // Optional: use existing agent configuration
    ...(USE_AGENT_CONFIG ? {
      agent_configuration_id: AGENT_CONFIG_ID,
      url: AGENT_ENDPOINT,
    } : {
      url: AGENT_ENDPOINT,
    })
  }

  console.log('Request body:', JSON.stringify(requestBody, null, 2))
  console.log()

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
    console.log('Response:', data)
    console.log()

    if (response.ok) {
      try {
        const json = JSON.parse(data)
        console.log('✅ Evaluation created successfully!')
        console.log('Evaluation ID:', json.id)
        console.log('Status:', json.status)
        console.log('Web Link:', `https://evaluate.vijil.ai/evaluations/${json.id}`)
      } catch (e) {
        console.log('Response was not valid JSON')
      }
    } else {
      console.error('❌ Failed to create evaluation')
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testCreateEvaluation()
