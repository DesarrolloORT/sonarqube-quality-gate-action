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
        // No errorThreshold to test the else if branch
      }
    ],
    ignoredConditions: false
  }

  const mockQualityGate: QualityGate = {
    projectStatus: mockProjectStatus
  }

  it('should handle condition with comparator but no errorThreshold', () => {
    const result = buildReport(mockQualityGate, 'https://sonar.example.com', 'test-project', mockContext)

    // Should contain "(no threshold)" for the condition without errorThreshold
    expect(result).toContain('> (no threshold)')
  })

  it('should handle condition with neither comparator nor errorThreshold', () => {
    const conditionWithoutBoth = {
      status: 'OK',
      metricKey: 'test_metric',
      comparator: '', // Required field, set to empty
      actualValue: '100'
      // No errorThreshold
    }

    const qualityGateWithoutBoth: QualityGate = {
      projectStatus: {
        ...mockProjectStatus,
        conditions: [conditionWithoutBoth]
      }
    }

    const result = buildReport(qualityGateWithoutBoth, 'https://sonar.example.com', 'test-project', mockContext)

    // Should contain "N/A" for threshold when no comparator or errorThreshold
    expect(result).toContain('N/A')
  })

  it('should build report with branch parameter in URL', () => {
    const result = buildReport(mockQualityGate, 'https://sonar.example.com', 'test-project', mockContext, 'feature/test')

    expect(result).toContain('https://sonar.example.com/dashboard?id=test-project&branch=feature%2Ftest')
  })

  it('should build report without branch parameter when branch is undefined', () => {
    const result = buildReport(mockQualityGate, 'https://sonar.example.com', 'test-project', mockContext)

    expect(result).toContain('https://sonar.example.com/dashboard?id=test-project')
    expect(result).not.toContain('&branch=')
  })

  it('should build report without branch parameter when branch is empty string', () => {
    const result = buildReport(mockQualityGate, 'https://sonar.example.com', 'test-project', mockContext, '')

    expect(result).toContain('https://sonar.example.com/dashboard?id=test-project')
    expect(result).not.toContain('&branch=')
  })

  it('should handle missing conditions and show "No metrics available"', () => {
    const qualityGateNoConditions: QualityGate = {
      projectStatus: {
        status: 'OK',
        conditions: [],
        ignoredConditions: false
      }
    }

    const result = buildReport(qualityGateNoConditions, 'https://sonar.example.com', 'test-project', mockContext)

    expect(result).toContain('No metrics available')
  })
})
