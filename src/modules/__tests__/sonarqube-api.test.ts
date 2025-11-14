import axios from 'axios'
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

const mockIncompleteResponse = {
  data: {
    projectStatus: {
      status: 'OK',
      conditions: [
        {
          metricKey: 'coverage',
          status: 'UNKNOWN',
          actualValue: 'N/A',
          comparator: 'LT',
          errorThreshold: '80'
        }
      ],
      ignoredConditions: false
    }
  },
  status: 200
}

describe('fetchQualityGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should make a GET request to the correct URL with all parameters when branch is defined', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue(mockValidResponse)

    await fetchQualityGate('https://example.com', 'key', 'token', 'branch')

    expect(axios.get).toHaveBeenCalledWith(
      `https://example.com/api/qualitygates/project_status`,
      {
        params: { projectKey: 'key', branch: 'branch' },
        headers: {
          Authorization: 'Bearer token'
        }
      }
    )
  })

  it('should make a GET request to the correct URL with all parameters except branch when branch is not defined', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue(mockValidResponse)

    await fetchQualityGate('https://example.com', 'key', 'token')

    expect(axios.get).toHaveBeenCalledWith(
      `https://example.com/api/qualitygates/project_status`,
      {
        params: { projectKey: 'key' },
        headers: {
          Authorization: 'Bearer token'
        }
      }
    )
  })

  it('should retry when analysis is incomplete and eventually return complete result', async () => {
    // First call returns incomplete, second returns complete
    ;(axios.get as jest.Mock)
      .mockResolvedValueOnce(mockIncompleteResponse)
      .mockResolvedValueOnce(mockValidResponse)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(result.projectStatus.status).toBe('OK')
    expect(result.projectStatus.conditions.length).toBe(0)
  })

  it('should use pullRequest parameter when provided', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue(mockValidResponse)

    await fetchQualityGate(
      'https://example.com',
      'key',
      'token',
      undefined,
      '123'
    )

    expect(axios.get).toHaveBeenCalledWith(
      `https://example.com/api/qualitygates/project_status`,
      {
        params: { projectKey: 'key', pullRequest: '123' },
        headers: {
          Authorization: 'Bearer token'
        }
      }
    )
  })

  it('should return valid result even with empty conditions array', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue(mockValidResponse)

    const result = await fetchQualityGate('https://example.com', 'key', 'token')

    expect(result.projectStatus.status).toBe('OK')
    expect(Array.isArray(result.projectStatus.conditions)).toBe(true)
  })
})
