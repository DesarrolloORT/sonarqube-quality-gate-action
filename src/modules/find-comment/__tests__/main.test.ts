import * as github from '@actions/github'
import { findComment } from '../main'

jest.mock('@actions/github')

const mockGithub = github as jest.Mocked<typeof github>

describe('find-comment module', () => {
  const mockPaginate = jest.fn()
  const mockPaginateIterator = jest.fn()
  
  const mockOctokit = {
    paginate: mockPaginate,
    rest: {
      issues: {
        listComments: jest.fn()
      }
    }
  }

  // Add iterator property to paginate
  ;(mockOctokit.paginate as any).iterator = mockPaginateIterator

  beforeEach(() => {
    jest.clearAllMocks()
    mockGithub.getOctokit.mockReturnValue(mockOctokit as any)
  })

  const baseInputs = {
    token: 'test-token',
    repository: 'owner/repo',
    issueNumber: 123,
    commentAuthor: '',
    bodyIncludes: '',
    direction: 'first'
  }

  describe('findComment with direction: first', () => {
    it('should find comment by author in first direction', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'test-user',
        direction: 'first'
      }

      const mockComments = [
        { id: 1, body: 'First comment', user: { login: 'other-user' } },
        { id: 2, body: 'Second comment', user: { login: 'test-user' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 2, body: 'Second comment', user: { login: 'test-user' } })
      expect(mockGithub.getOctokit).toHaveBeenCalledWith('test-token')
      expect(mockPaginateIterator).toHaveBeenCalledWith(
        mockOctokit.rest.issues.listComments,
        {
          owner: 'owner',
          repo: 'repo',
          issue_number: 123
        }
      )
    })

    it('should find comment by body content in first direction', async () => {
      const inputs = {
        ...baseInputs,
        bodyIncludes: 'quality gate',
        direction: 'first'
      }

      const mockComments = [
        { id: 1, body: 'Regular comment', user: { login: 'user1' } },
        { id: 2, body: 'SonarQube quality gate results', user: { login: 'user2' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 2, body: 'SonarQube quality gate results', user: { login: 'user2' } })
    })

    it('should find comment by both author and body content', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'sonar-bot',
        bodyIncludes: 'quality gate',
        direction: 'first'
      }

      const mockComments = [
        { id: 1, body: 'SonarQube quality gate results', user: { login: 'other-bot' } },
        { id: 2, body: 'SonarQube quality gate results', user: { login: 'sonar-bot' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 2, body: 'SonarQube quality gate results', user: { login: 'sonar-bot' } })
    })

    it('should handle comments with null user', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: '', // No author filter
        bodyIncludes: 'null user',
        direction: 'first'
      }

      const mockComments = [
        { id: 1, body: 'Comment with null user', user: null },
        { id: 2, body: 'Valid comment', user: { login: 'test-user' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 1, body: 'Comment with null user', user: null })
    })

    it('should handle comments without body', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: '', // No author filter
        bodyIncludes: '', // No body filter - should match first comment
        direction: 'first'
      }

      const mockComments = [
        { id: 1, user: { login: 'user1' } }, // No body property
        { id: 2, body: 'Comment with test content', user: { login: 'user2' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 1, user: { login: 'user1' } })
    })

    it('should return undefined when no matching comment found in first direction', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'nonexistent-user',
        direction: 'first'
      }

      const mockComments = [
        { id: 1, body: 'Comment 1', user: { login: 'user1' } },
        { id: 2, body: 'Comment 2', user: { login: 'user2' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toBeUndefined()
    })

    it('should handle multiple pages in first direction', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'target-user',
        direction: 'first'
      }

      const page1Comments = [
        { id: 1, body: 'Comment 1', user: { login: 'user1' } },
        { id: 2, body: 'Comment 2', user: { login: 'user2' } }
      ]

      const page2Comments = [
        { id: 3, body: 'Comment 3', user: { login: 'target-user' } },
        { id: 4, body: 'Comment 4', user: { login: 'user4' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: page1Comments },
        { data: page2Comments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 3, body: 'Comment 3', user: { login: 'target-user' } })
    })
  })

  describe('findComment with direction: last', () => {
    it('should find comment in last direction', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'test-user',
        direction: 'last'
      }

      const mockComments = [
        { id: 1, body: 'First comment', user: { login: 'test-user' } },
        { id: 2, body: 'Second comment', user: { login: 'other-user' } },
        { id: 3, body: 'Third comment', user: { login: 'test-user' } }
      ]

      // Mock paginate to return all comments (simulating getting all pages)
      mockPaginate.mockResolvedValue(mockComments)

      const result = await findComment(inputs)

      // Should find the last matching comment (id: 3) since comments are reversed
      expect(result).toEqual({ id: 3, body: 'Third comment', user: { login: 'test-user' } })
      expect(mockPaginate).toHaveBeenCalledWith(
        mockOctokit.rest.issues.listComments,
        {
          owner: 'owner',
          repo: 'repo',
          issue_number: 123
        }
      )
    })

    it('should return undefined when no matching comment found in last direction', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'nonexistent-user',
        direction: 'last'
      }

      const mockComments = [
        { id: 1, body: 'Comment 1', user: { login: 'user1' } },
        { id: 2, body: 'Comment 2', user: { login: 'user2' } }
      ]

      mockPaginate.mockResolvedValue(mockComments)

      const result = await findComment(inputs)

      expect(result).toBeUndefined()
    })

    it('should find comment by body content in last direction', async () => {
      const inputs = {
        ...baseInputs,
        bodyIncludes: 'important',
        direction: 'last'
      }

      const mockComments = [
        { id: 1, body: 'This is important', user: { login: 'user1' } },
        { id: 2, body: 'Regular comment', user: { login: 'user2' } },
        { id: 3, body: 'Another important message', user: { login: 'user3' } }
      ]

      mockPaginate.mockResolvedValue(mockComments)

      const result = await findComment(inputs)

      // Should find the last matching comment (id: 3)
      expect(result).toEqual({ id: 3, body: 'Another important message', user: { login: 'user3' } })
    })
  })

  describe('edge cases and predicate logic', () => {
    it('should match when no author or body criteria specified', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: '',
        bodyIncludes: '',
        direction: 'first'
      }

      const mockComments = [
        { id: 1, body: 'Any comment', user: { login: 'any-user' } }
      ]

      mockPaginateIterator.mockReturnValue([
        { data: mockComments }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toEqual({ id: 1, body: 'Any comment', user: { login: 'any-user' } })
    })

    it('should handle empty comments array', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'test-user',
        direction: 'first'
      }

      mockPaginateIterator.mockReturnValue([
        { data: [] }
      ] as any)

      const result = await findComment(inputs)

      expect(result).toBeUndefined()
    })

    it('should handle empty comments array in last direction', async () => {
      const inputs = {
        ...baseInputs,
        commentAuthor: 'test-user',
        direction: 'last'
      }

      mockPaginate.mockResolvedValue([])

      const result = await findComment(inputs)

      expect(result).toBeUndefined()
    })
  })
})
