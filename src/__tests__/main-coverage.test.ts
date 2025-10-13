import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from '../main'
import { fetchQualityGate } from '../modules/sonarqube-api'
import { buildReport } from '../modules/report'
import { findComment } from '../modules/find-comment/main'

// Mock all dependencies
jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../modules/sonarqube-api')
jest.mock('../modules/report')
jest.mock('../modules/find-comment/main')

const mockCore = core as jest.Mocked<typeof core>
const mockGithub = github as jest.Mocked<typeof github>
const mockFetchQualityGate = fetchQualityGate as jest.MockedFunction<
  typeof fetchQualityGate
>
const mockBuildReport = buildReport as jest.MockedFunction<typeof buildReport>
const mockFindComment = findComment as jest.MockedFunction<typeof findComment>

describe('main - coverage improvements', () => {
  const mockOctokit = {
    rest: {
      issues: {
        createComment: jest.fn(),
        updateComment: jest.fn()
      }
    }
  }

  const mockContext = {
    eventName: 'pull_request',
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 123 },
    actor: 'test-user',
    payload: {
      pull_request: {
        head: {
          ref: 'feature-branch'
        }
      }
    }
  }

  const mockQualityGateResult = {
    projectStatus: {
      status: 'OK',
      conditions: [],
      ignoredConditions: false
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mocks
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'sonar-host-url': 'https://sonar.example.com/',
        'sonar-project-key': 'test-project',
        'sonar-token': 'test-token',
        'disable-pr-comment': 'false',
        'fail-on-quality-gate-error': 'false',
        branch: 'main',
        'github-token': 'github-token'
      }
      return inputs[name] || ''
    })

    // Mock the context properly
    Object.defineProperty(mockGithub, 'context', {
      value: mockContext,
      writable: true,
      configurable: true
    })

    mockGithub.getOctokit.mockReturnValue(mockOctokit as any)

    mockFetchQualityGate.mockResolvedValue(mockQualityGateResult as any)
    mockBuildReport.mockReturnValue('Mock report body')
    mockFindComment.mockResolvedValue(undefined)
  })

  it('should handle non-PR events without commenting', async () => {
    Object.defineProperty(mockGithub, 'context', {
      value: { ...mockContext, eventName: 'push' },
      writable: true,
      configurable: true
    })

    await run()

    expect(mockFindComment).not.toHaveBeenCalled()
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
    expect(mockCore.setOutput).toHaveBeenCalledWith('project-status', 'OK')
  })

  it('should skip commenting when disabled', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'disable-pr-comment') return 'true'
      return name === 'sonar-host-url'
        ? 'https://sonar.example.com/'
        : 'test-value'
    })

    await run()

    expect(mockFindComment).not.toHaveBeenCalled()
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('should throw error when github token is missing for PR', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') return ''
      return name === 'sonar-host-url'
        ? 'https://sonar.example.com/'
        : 'test-value'
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      '`inputs.github-token` is required for result comment creation.'
    )
  })

  it('should create new comment when no existing comment found', async () => {
    mockFindComment.mockResolvedValue(undefined)

    await run()

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: 'Mock report body'
    })
  })

  it('should update existing comment when found', async () => {
    const existingComment = { id: 456 }
    mockFindComment.mockResolvedValue(existingComment as any)

    await run()

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      comment_id: 456,
      body: 'Mock report body'
    })
  })

  it('should fail when quality gate error and fail-on-quality-gate-error is true', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'fail-on-quality-gate-error') return 'true'
      if (name === 'sonar-project-key') return 'test-project'
      return name === 'sonar-host-url'
        ? 'https://sonar.example.com/'
        : 'test-value'
    })

    const errorResult = {
      projectStatus: {
        status: 'ERROR',
        conditions: [],
        ignoredConditions: false
      }
    }
    mockFetchQualityGate.mockResolvedValue(errorResult as any)

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Quality gate status for `test-project` returned `ERROR`'
    )
  })

  it('should not fail when quality gate error but fail-on-quality-gate-error is false', async () => {
    const errorResult = {
      projectStatus: {
        status: 'ERROR',
        conditions: [],
        ignoredConditions: false
      }
    }
    mockFetchQualityGate.mockResolvedValue(errorResult as any)

    await run()

    expect(mockCore.setFailed).not.toHaveBeenCalled()
    expect(mockCore.setOutput).toHaveBeenCalledWith('project-status', 'ERROR')
  })

  it('should handle generic Error and set failure', async () => {
    const error = new Error('Test error message')
    mockFetchQualityGate.mockRejectedValue(error)

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith('Test error message')
  })

  it('should handle non-Error exception and set generic failure', async () => {
    mockFetchQualityGate.mockRejectedValue('String error')

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith('Unexpected error')
  })

  it('should trim trailing slash from host URL', async () => {
    await run()

    expect(mockFetchQualityGate).toHaveBeenCalledWith(
      'https://sonar.example.com', // Should be trimmed
      'test-project',
      'test-token',
      'main'
    )
  })

  it('should auto-detect branch from PR when branch input is empty', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'sonar-host-url': 'https://sonar.example.com/',
        'sonar-project-key': 'test-project',
        'sonar-token': 'test-token',
        'disable-pr-comment': 'false',
        'fail-on-quality-gate-error': 'false',
        branch: '', // Empty branch input
        'github-token': 'github-token'
      }
      return inputs[name] || ''
    })

    await run()

    // Should use the branch from PR context (feature-branch)
    expect(mockFetchQualityGate).toHaveBeenCalledWith(
      'https://sonar.example.com',
      'test-project',
      'test-token',
      'feature-branch' // Auto-detected from context.payload.pull_request.head.ref
    )
  })

  it('should use manual branch input over auto-detection', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'sonar-host-url': 'https://sonar.example.com/',
        'sonar-project-key': 'test-project',
        'sonar-token': 'test-token',
        'disable-pr-comment': 'false',
        'fail-on-quality-gate-error': 'false',
        branch: 'manual-branch', // Explicit branch input
        'github-token': 'github-token'
      }
      return inputs[name] || ''
    })

    await run()

    // Should use the manual branch input
    expect(mockFetchQualityGate).toHaveBeenCalledWith(
      'https://sonar.example.com',
      'test-project',
      'test-token',
      'manual-branch' // Manual input takes precedence
    )
  })
})
