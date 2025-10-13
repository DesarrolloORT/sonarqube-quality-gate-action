import { buildReport } from '../report'
import { QualityGate } from '../models'
import { Context } from '@actions/github/lib/context'

describe('report - additional coverage', () => {
  const mockContext: Context = {
    actor: 'test-user',
    eventName: 'pull_request'
  } as Context

  const mockProjectStatus = {
    status: 'ERROR',
    conditions: [
      {
        status: 'ERROR',
        metricKey: 'coverage',
        comparator: 'LT',
        actualValue: '75.5',
        errorThreshold: '80'
      },
      {
        status: 'OK',
        metricKey: 'duplicated_lines_density',
        comparator: 'GT',
        actualValue: '2.5'
      }
    ],
    ignoredConditions: false
  }

  const mockQualityGate: QualityGate = {
    projectStatus: mockProjectStatus
  }

  it('should handle condition with comparator but no errorThreshold', () => {
    const result = buildReport(
      mockQualityGate,
      'https://sonar.example.com',
      'test-project',
      mockContext
    )

    expect(result).toContain('> (no threshold)')
  })

  it('should handle condition with neither comparator nor errorThreshold', () => {
    const qualityGateWithoutBoth: QualityGate = {
      projectStatus: {
        status: 'ERROR',
        conditions: [
          {
            status: 'ERROR',
            metricKey: 'some_metric',
            comparator: '',
            actualValue: '50'
          }
        ],
        ignoredConditions: false
      }
    }

    const result = buildReport(
      qualityGateWithoutBoth,
      'https://sonar.example.com',
      'test-project',
      mockContext
    )

    expect(result).toContain('N/A')
  })

  it('should build report with pullRequest parameter in URL', () => {
    const result = buildReport(
      mockQualityGate,
      'https://sonar.example.com',
      'test-project',
      mockContext,
      undefined,
      '228'
    )

    expect(result).toContain(
      'https://sonar.example.com/dashboard?id=test-project&pullRequest=228'
    )
    expect(result).toContain('**Pull Request**: #228')
  })

  it('should build report without pullRequest when undefined', () => {
    const result = buildReport(
      mockQualityGate,
      'https://sonar.example.com',
      'test-project',
      mockContext
    )

    expect(result).toContain(
      'https://sonar.example.com/dashboard?id=test-project'
    )
    expect(result).not.toContain('&pullRequest=')
    expect(result).not.toContain('**Pull Request**')
  })

  it('should build report without pullRequest when empty string', () => {
    const result = buildReport(
      mockQualityGate,
      'https://sonar.example.com',
      'test-project',
      mockContext,
      undefined,
      ''
    )

    expect(result).toContain(
      'https://sonar.example.com/dashboard?id=test-project'
    )
    expect(result).not.toContain('&pullRequest=')
  })

  it('should handle missing conditions and show "No metrics available"', () => {
    const qualityGateNoConditions: QualityGate = {
      projectStatus: {
        status: 'OK',
        conditions: [],
        ignoredConditions: false
      }
    }

    const result = buildReport(
      qualityGateNoConditions,
      'https://sonar.example.com',
      'test-project',
      mockContext
    )

    expect(result).toContain('No metrics available')
  })
})
