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

describe('fetchQualityGate', () => {
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
})
