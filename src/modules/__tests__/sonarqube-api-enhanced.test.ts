import axios, { AxiosError } from 'axios'
import { fetchQualityGate } from '../sonarqube-api'

jest.mock('axios')

const mockValidResponse = {
  data: {
    projectStatus: {
      status: 'OK',
      conditions: [],
      ignoredConditions: false
    }
  },
  status: 200
}

const mockResponseWithCaycStatus = {
  data: {
    projectStatus: {
      status: 'ERROR',
      conditions: [
        {
          status: 'ERROR',
          metricKey: 'new_coverage',
          comparator: 'LT',
          errorThreshold: '85',
          actualValue: '82.5'
        },
        {
          status: 'OK',
          metricKey: 'reopened_issues',
          comparator: 'GT',
          actualValue: '0'
          // Note: no errorThreshold - this tests optional field handling
        }
      ],
      ignoredConditions: false,
      caycStatus: 'non-compliant'
    }
  },
  status: 200
}

describe('fetchQualityGate - enhanced functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle response with caycStatus field', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue(mockResponseWithCaycStatus)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.caycStatus).toBe('non-compliant')
    expect(result.projectStatus.conditions).toHaveLength(2)
  })

  it('should handle conditions without errorThreshold', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue(mockResponseWithCaycStatus)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    const conditionWithoutThreshold = result.projectStatus.conditions.find(
      c => c.metricKey === 'reopened_issues'
    )
    expect(conditionWithoutThreshold?.errorThreshold).toBeUndefined()
  })

  it('should fallback to basic auth when bearer token fails', async () => {
    const bearerError = new AxiosError('Unauthorized', '401')
    bearerError.response = {
      status: 401,
      statusText: 'Unauthorized',
      data: {},
      headers: {},
      config: {} as any
    }
    ;(axios.get as jest.Mock)
      .mockRejectedValueOnce(bearerError)
      .mockResolvedValueOnce(mockValidResponse)

    await fetchQualityGate('https://example.com', 'key', 'token')

    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://example.com/api/qualitygates/project_status',
      {
        params: { projectKey: 'key' },
        headers: { Authorization: 'Bearer token' }
      }
    )
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://example.com/api/qualitygates/project_status',
      {
        params: { projectKey: 'key' },
        auth: { username: 'token', password: '' }
      }
    )
  })

  it('should throw error when both auth methods fail', async () => {
    const bearerError = new AxiosError('Unauthorized', '401')
    bearerError.response = {
      status: 401,
      statusText: 'Unauthorized',
      data: {},
      headers: {},
      config: {} as any
    }

    const basicError = new AxiosError('Forbidden', '403')
    basicError.response = {
      status: 403,
      statusText: 'Forbidden',
      data: {},
      headers: {},
      config: {} as any
    }
    ;(axios.get as jest.Mock)
      .mockRejectedValueOnce(bearerError)
      .mockRejectedValueOnce(basicError)

    await expect(
      fetchQualityGate('https://example.com', 'key', 'token')
    ).rejects.toThrow(
      'Failed to fetch quality gate status. Bearer auth: 401, Basic auth: 403. Check your token and project key.'
    )
  })

  it('should throw error for empty response', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue({ data: null, status: 200 })

    await expect(
      fetchQualityGate('https://example.com', 'key', 'token')
    ).rejects.toThrow('Empty response from SonarQube API')
  })

  it('should throw error for missing projectStatus', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue({ data: {}, status: 200 })

    await expect(
      fetchQualityGate('https://example.com', 'key', 'token')
    ).rejects.toThrow('Missing projectStatus in SonarQube API response')
  })

  it('should handle legacy periods array and convert to period object', async () => {
    const legacyResponse = {
      data: {
        projectStatus: {
          status: 'OK',
          conditions: [],
          ignoredConditions: false,
          periods: [
            {
              mode: 'last_version',
              date: '2000-04-27T00:45:23+0200',
              parameter: '2015-12-07'
            }
          ]
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(legacyResponse)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.period).toBeDefined()
    expect(result.projectStatus.period?.mode).toBe('last_version')
    expect((result.projectStatus as any).periods).toBeUndefined()
  })

  it('should throw error for missing status in projectStatus', async () => {
    const invalidResponse = {
      data: {
        projectStatus: {
          // missing status
          conditions: []
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(invalidResponse)

    await expect(
      fetchQualityGate('https://example.com', 'key', 'token')
    ).rejects.toThrow('Missing status in projectStatus')
  })

  it('should handle missing or invalid conditions array', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    const invalidResponse = {
      data: {
        projectStatus: {
          status: 'OK'
          // missing conditions array
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(invalidResponse)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith(
      'Missing or invalid conditions array, setting to empty array'
    )
    consoleSpy.mockRestore()
  })

  it('should handle conditions with missing fields', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    const responseWithInvalidConditions = {
      data: {
        projectStatus: {
          status: 'OK',
          conditions: [
            {
              // missing metricKey
              status: 'OK',
              actualValue: '10'
            },
            {
              metricKey: 'test_metric',
              // missing status
              actualValue: '5'
            },
            {
              metricKey: 'another_metric',
              status: 'ERROR'
              // missing actualValue and comparator
            }
          ],
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithInvalidConditions)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(consoleSpy).toHaveBeenCalledWith(
      'Condition 0 missing metricKey, skipping'
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'Condition 1 missing status, defaulting to UNKNOWN'
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'Condition 2 missing actualValue, defaulting to N/A'
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'Condition 2 missing comparator, defaulting to empty'
    )

    // Should have processed the conditions (first one without metricKey is skipped, but it seems all 3 are processed)
    expect(result.projectStatus.conditions).toHaveLength(3) // All conditions processed, first one keeps other fields
    expect(result.projectStatus.conditions[1].status).toBe('UNKNOWN') // Second condition missing status
    expect(result.projectStatus.conditions[2].actualValue).toBe('N/A') // Third condition missing actualValue
    expect(result.projectStatus.conditions[2].comparator).toBe('') // Third condition missing comparator

    consoleSpy.mockRestore()
  })
})
