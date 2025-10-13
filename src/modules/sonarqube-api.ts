import axios, { AxiosError } from 'axios'
import { QualityGate } from './models'

// Validate the response structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateQualityGateResponse = (data: any): QualityGate => {
  if (!data) {
    throw new Error('Empty response from SonarQube API')
  }

  if (!data.projectStatus) {
    throw new Error('Missing projectStatus in SonarQube API response')
  }

  if (!data.projectStatus.status) {
    throw new Error('Missing status in projectStatus')
  }

  // Ensure conditions array exists (can be empty)
  if (!Array.isArray(data.projectStatus.conditions)) {
    console.warn('Missing or invalid conditions array, setting to empty array')
    data.projectStatus.conditions = []
  }

  // Handle period vs periods - API documentation shows "period" (singular)
  // But ensure backward compatibility with "periods" (plural)
  if (data.projectStatus.periods && Array.isArray(data.projectStatus.periods)) {
    console.log('Found "periods" array, converting to single "period" object')
    data.projectStatus.period = data.projectStatus.periods[0] ?? null
    delete data.projectStatus.periods
  }

  // Validate each condition has required fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [index, condition] of data.projectStatus.conditions.entries()) {
    if (!condition.metricKey) {
      console.warn(`Condition ${index} missing metricKey, skipping`)
      continue
    }
    if (!condition.status) {
      console.warn(`Condition ${index} missing status, defaulting to UNKNOWN`)
      condition.status = 'UNKNOWN'
    }
    if (!condition.actualValue) {
      console.warn(`Condition ${index} missing actualValue, defaulting to N/A`)
      condition.actualValue = 'N/A'
    }
    if (!condition.comparator) {
      console.warn(`Condition ${index} missing comparator, defaulting to empty`)
      condition.comparator = ''
    }
    // errorThreshold is optional per API docs
  }

  console.log(
    `Validated response: status=${data.projectStatus.status}, conditions=${data.projectStatus.conditions.length}, caycStatus=${data.projectStatus.caycStatus ?? 'N/A'}`
  )

  return data as QualityGate
}

export const fetchQualityGate = async (
  url: string,
  projectKey: string,
  token: string,
  branch?: string,
  pullRequest?: string
): Promise<QualityGate> => {
  // Priority: pullRequest > branch > default (main)
  const params: { projectKey: string; branch?: string; pullRequest?: string } =
    {
      projectKey
    }

  if (pullRequest) {
    params.pullRequest = pullRequest
    console.log(`Using Pull Request parameter: ${pullRequest}`)
  } else if (branch) {
    params.branch = branch
    console.log(`Using branch parameter: ${branch}`)
  }

  const apiUrl = `${url}/api/qualitygates/project_status`

  console.log(`Fetching quality gate status from: ${apiUrl}`)
  console.log(`Parameters:`, JSON.stringify(params, null, 2))

  try {
    // Try with Bearer token first (newer SonarQube versions)
    const response = await axios.get<QualityGate>(apiUrl, {
      params,
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    console.log(`API Response Status: ${response.status}`)
    console.log(`API Response Data:`, JSON.stringify(response.data, null, 2))

    return validateQualityGateResponse(response.data)
  } catch (error) {
    if (error instanceof AxiosError) {
      console.log(
        `Bearer token failed with status ${error.response?.status}, trying basic auth...`
      )

      // Fallback to basic auth for older versions
      try {
        const response = await axios.get<QualityGate>(apiUrl, {
          params,
          auth: {
            username: token,
            password: ''
          }
        })

        console.log(`API Response Status (basic auth): ${response.status}`)
        console.log(
          `API Response Data:`,
          JSON.stringify(response.data, null, 2)
        )

        return validateQualityGateResponse(response.data)
      } catch (basicAuthError) {
        if (basicAuthError instanceof AxiosError) {
          console.error(`Both authentication methods failed.`)
          console.error(
            `Bearer token error: ${error.response?.status} - ${error.response?.statusText}`
          )
          console.error(
            `Basic auth error: ${basicAuthError.response?.status} - ${basicAuthError.response?.statusText}`
          )
          console.error(`Response data:`, basicAuthError.response?.data)

          throw new Error(
            `Failed to fetch quality gate status. Bearer auth: ${error.response?.status}, Basic auth: ${basicAuthError.response?.status}. Check your token and project key.`
          )
        }
        throw basicAuthError
      }
    }
    throw error
  }
}
