import { Context } from '@actions/github/lib/context'
import { Condition, QualityGate } from './models'
import {
  formatMetricKey,
  getStatusEmoji,
  getComparatorSymbol,
  trimTrailingSlash,
  formatStringNumber,
  getCurrentDateTime
} from './utils'

const buildRow = (condition: Condition): string => {
  // Handle missing or undefined values
  const metricKey = condition.metricKey ?? 'Unknown'
  const status = condition.status ?? 'UNKNOWN'
  const actualValue = condition.actualValue ?? 'N/A'
  const comparator = condition.comparator ?? ''

  console.log(`Building row for metric: ${metricKey}, status: ${status}`)

  // Handle errorThreshold - some conditions don't have this per API docs
  let thresholdDisplay = 'N/A'
  if (condition.errorThreshold) {
    thresholdDisplay = `${getComparatorSymbol(comparator)} ${condition.errorThreshold}`
  } else if (comparator) {
    thresholdDisplay = `${getComparatorSymbol(comparator)} (no threshold)`
  }

  const rowValues = [
    formatMetricKey(metricKey), // Metric
    getStatusEmoji(status), // Status
    formatStringNumber(actualValue), // Value
    thresholdDisplay // Error Threshold
  ]

  return `|${rowValues.join('|')}|`
}

export const buildReport = (
  result: QualityGate,
  hostURL: string,
  projectKey: string,
  context: Context,
  branch?: string
): string => {
  const projectURL = `${trimTrailingSlash(hostURL)}/dashboard?id=${projectKey}${
    branch ? `&branch=${encodeURIComponent(branch)}` : ''
  }`

  const projectStatus = getStatusEmoji(result.projectStatus.status)

  // Handle case where conditions might be empty or missing
  const conditions = result.projectStatus.conditions || []
  const resultTable =
    conditions.length > 0
      ? conditions.map(buildRow).join('\n')
      : '|No metrics available|:grey_question:|N/A|N/A|'

  const { value: updatedDate, offset: updatedOffset } = getCurrentDateTime()

  console.log(`Building report for project ${projectKey}`)
  console.log(`Status: ${result.projectStatus.status}`)
  console.log(`Number of conditions: ${conditions.length}`)

  return `### SonarQube Quality Gate Result
- **Result**: ${projectStatus}${branch ? `\n- **Branch**: \`${branch}\`` : ''}
- Triggered by @${context.actor} on \`${context.eventName}\`

| Metric | Status | Value | Error Threshold |
|:------:|:------:|:-----:|:---------------:|
${resultTable}

[View on SonarQube](${projectURL})
###### _updated: ${updatedDate} (${updatedOffset})_`
}
