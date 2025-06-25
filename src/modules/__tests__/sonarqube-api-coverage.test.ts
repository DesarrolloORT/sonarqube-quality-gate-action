import axios, { AxiosError } from 'axios'
import { fetchQualityGate } from '../sonarqube-api'

jest.mock('axios')

describe('fetchQualityGate - coverage improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle missing conditions array and set to empty', async () => {
    const responseWithoutConditions = {
      data: {
        projectStatus: {
          status: 'OK',
          ignoredConditions: false
          // No conditions array
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithoutConditions)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions).toEqual([])
  })

  it('should handle invalid conditions array and set to empty', async () => {
    const responseWithInvalidConditions = {
      data: {
        projectStatus: {
          status: 'OK',
          conditions: 'not-an-array', // Invalid type
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithInvalidConditions)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions).toEqual([])
  })

  it('should handle condition missing metricKey and skip it', async () => {
    const responseWithBadCondition = {
      data: {
        projectStatus: {
          status: 'ERROR',
          conditions: [
            {
              // Missing metricKey
              status: 'ERROR',
              actualValue: '50'
            },
            {
              metricKey: 'coverage',
              status: 'OK',
              actualValue: '80'
            }
          ],
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithBadCondition)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions).toHaveLength(2)
    expect(result.projectStatus.conditions[1].metricKey).toBe('coverage')
  })

  it('should handle condition missing status and default to UNKNOWN', async () => {
    const responseWithMissingStatus = {
      data: {
        projectStatus: {
          status: 'ERROR',
          conditions: [
            {
              metricKey: 'coverage',
              // Missing status
              actualValue: '50'
            }
          ],
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithMissingStatus)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions[0].status).toBe('UNKNOWN')
  })

  it('should handle condition missing actualValue and default to N/A', async () => {
    const responseWithMissingValue = {
      data: {
        projectStatus: {
          status: 'ERROR',
          conditions: [
            {
              metricKey: 'coverage',
              status: 'ERROR'
              // Missing actualValue
            }
          ],
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithMissingValue)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions[0].actualValue).toBe('N/A')
  })

  it('should handle condition missing comparator and default to empty', async () => {
    const responseWithMissingComparator = {
      data: {
        projectStatus: {
          status: 'ERROR',
          conditions: [
            {
              metricKey: 'coverage',
              status: 'ERROR',
              actualValue: '50'
              // Missing comparator
            }
          ],
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithMissingComparator)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.conditions[0].comparator).toBe('')
  })

  it('should throw error for missing status in projectStatus', async () => {
    const responseWithoutStatus = {
      data: {
        projectStatus: {
          // Missing status
          conditions: [],
          ignoredConditions: false
        }
      },
      status: 200
    }

    ;(axios.get as jest.Mock).mockResolvedValue(responseWithoutStatus)

    await expect(fetchQualityGate('https://example.com', 'key', 'token'))
      .rejects
      .toThrow('Missing status in projectStatus')
  })

  it('should handle non-AxiosError in bearer token attempt and rethrow', async () => {
    const genericError = new Error('Network error')
    
    ;(axios.get as jest.Mock).mockRejectedValue(genericError)

    await expect(fetchQualityGate('https://example.com', 'key', 'token'))
      .rejects
      .toThrow('Network error')
  })

  it('should handle non-AxiosError in basic auth fallback and rethrow', async () => {
    const bearerError = new AxiosError('Unauthorized', '401')
    bearerError.response = { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config: {} as any }
    
    const genericError = new Error('Network error in basic auth')
    
    ;(axios.get as jest.Mock)
      .mockRejectedValueOnce(bearerError)
      .mockRejectedValueOnce(genericError)

    await expect(fetchQualityGate('https://example.com', 'key', 'token'))
      .rejects
      .toThrow('Network error in basic auth')
  })
})
