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

/**
 * Sleep for a specified number of milliseconds
 */
const sleep = async (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if the response indicates an incomplete analysis (N/A status)
 * An analysis is incomplete if:
 * - Status is "NONE" (SonarQube still processing, no QG result yet)
 * - ALL conditions have N/A values (quality gate not yet evaluated)
 * - Status is UNKNOWN or missing
 */
const isIncompleteAnalysis = (data: QualityGate): boolean => {
  if (!data.projectStatus || !data.projectStatus.status) {
    return true
  }

  // If status is NONE, SonarQube is still processing - retry
  if (data.projectStatus.status === 'NONE') {
    console.log('Status is NONE - SonarQube analysis may still be processing')
    return true
  }

  // Check if all conditions show incomplete status
  const conditions = data.projectStatus.conditions || []
  if (conditions.length === 0) {
    // Only consider it complete if we have a real status (OK, ERROR, etc)
    // NONE with empty conditions means still processing
    return false
  }

  // If even ONE condition has a real status (not UNKNOWN), the analysis is complete
  const hasAnyRealStatus = conditions.some(
    condition => condition.status && condition.status !== 'UNKNOWN'
  )

  // If we have at least one real status, analysis is complete
  if (hasAnyRealStatus) {
    return false
  }

  // If all conditions are UNKNOWN and ALL have N/A values, it's incomplete
  const allNAWithUnknownStatus = conditions.every(
    condition =>
      condition.status === 'UNKNOWN' && condition.actualValue === 'N/A'
  )

  return allNAWithUnknownStatus
}

/**
 * Fetch quality gate with retry logic for incomplete analyses
 * Uses exponential backoff to wait for SonarQube to process the analysis
 */
const fetchQualityGateWithRetry = async (
  apiUrl: string,
  params: { projectKey: string; branch?: string; pullRequest?: string },
  token: string,
  maxRetries = 5,
  initialDelayMs = 2000
): Promise<QualityGate> => {
  let lastError: Error | null = null
  let lastResponse: QualityGate | null = null
  let authenticationError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try with Bearer token first (newer SonarQube versions)
      const response = await axios.get<QualityGate>(apiUrl, {
        params,
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      console.log(
        `API Response Status (attempt ${attempt}): ${response.status}`
      )
      console.log(`API Response Data:`, JSON.stringify(response.data, null, 2))

      lastResponse = validateQualityGateResponse(response.data)

      // Check if analysis is complete
      if (!isIncompleteAnalysis(lastResponse)) {
        console.log(
          `Analysis is complete on attempt ${attempt}, returning results`
        )
        return lastResponse
      }

      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1)
        console.warn(
          `Analysis appears incomplete (all values are N/A), retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`
        )
        await sleep(delayMs)
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        if (attempt === 1) {
          console.log(
            `Bearer token failed with status ${error.response?.status}, trying basic auth...`
          )
        }

        // Fallback to basic auth for older versions
        try {
          const response = await axios.get<QualityGate>(apiUrl, {
            params,
            auth: {
              username: token,
              password: ''
            }
          })

          console.log(
            `API Response Status (basic auth, attempt ${attempt}): ${response.status}`
          )
          console.log(
            `API Response Data:`,
            JSON.stringify(response.data, null, 2)
          )

          lastResponse = validateQualityGateResponse(response.data)

          // Check if analysis is complete
          if (!isIncompleteAnalysis(lastResponse)) {
            console.log(
              `Analysis is complete on attempt ${attempt}, returning results`
            )
            return lastResponse
          }

          if (attempt < maxRetries) {
            const delayMs = initialDelayMs * Math.pow(2, attempt - 1)
            console.warn(
              `Analysis appears incomplete (all values are N/A), retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`
            )
            await sleep(delayMs)
          }
        } catch (basicAuthError) {
          if (basicAuthError instanceof AxiosError) {
            console.error(
              `Attempt ${attempt}: Both authentication methods failed.`
            )
            console.error(
              `Bearer token error: ${error.response?.status} - ${error.response?.statusText}`
            )
            console.error(
              `Basic auth error: ${basicAuthError.response?.status} - ${basicAuthError.response?.statusText}`
            )

            // If we have consistent authentication errors, stop retrying
            if (
              error.response?.status &&
              [401, 403, 404].includes(error.response.status)
            ) {
              authenticationError = new Error(
                `Failed to fetch quality gate status. Bearer auth: ${error.response?.status}, Basic auth: ${basicAuthError.response?.status}. Check your token and project key.`
              )
              throw authenticationError
            }

            lastError = basicAuthError instanceof Error ? basicAuthError : error
          } else {
            // Non-AxiosError in basic auth fallback - throw immediately
            throw basicAuthError
          }

          if (attempt < maxRetries) {
            const delayMs = initialDelayMs * Math.pow(2, attempt - 1)
            console.log(
              `Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`
            )
            await sleep(delayMs)
          }
        }
      } else {
        throw error
      }
    }
  }

  // If we got here, return the last valid response or throw an error
  if (authenticationError) {
    throw authenticationError
  }

  if (lastResponse) {
    console.warn(
      'Max retries reached. Returning incomplete analysis. Status may show N/A values.'
    )
    return lastResponse
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Failed to fetch quality gate status after maximum retries.')
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

  return fetchQualityGateWithRetry(apiUrl, params, token)
}
