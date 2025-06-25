/**
 * Prefix status string with emojis
 * @param status status returned from quality gate result
 * @returns formatted status string
 */
export const getStatusEmoji = (status: string): string => {
  console.log(`Processing status: "${status}"`)

  switch (status) {
    case 'OK':
      return ':white_check_mark: OK'
    case 'ERROR':
      return ':exclamation: Error'
    case 'WARN':
    case 'WARNING':
      return ':warning: Warning'
    case 'NONE':
      return ':grey_question: None'
    case 'IN_PROGRESS':
      return ':hourglass_flowing_sand: In Progress'
    case 'PENDING':
      return ':clock1: Pending'
    default:
      console.warn(
        `Unknown status received: "${status}". Defaulting to grey question mark.`
      )
      return ':grey_question:'
  }
}

/**
 * Convert comparator into symbol
 * @param comparator comparator from quality gate result
 * @returns comparator as a symbol
 */
export const getComparatorSymbol = (comparator: string): string => {
  switch (comparator) {
    case 'GT':
      return '>'
    case 'LT':
      return '<'
    default:
      return ''
  }
}

/**
 * Format the metric key returned from quality gate result
 * @param metricKey metric key in `snake_case` format
 * @returns formatted metric key
 */
export const formatMetricKey = (metricKey: string): string => {
  const replacedString = metricKey.replace(/_/g, ' ')
  return replacedString.charAt(0).toUpperCase() + replacedString.slice(1)
}

export const trimTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value

/**
 * Format number string into number string with decimal places if the value is float
 * @param value number in string format
 * @returns formatted number string
 */
export const formatStringNumber = (value: string): string => {
  // Handle edge cases
  if (!value || value === 'N/A' || value === 'null' || value === 'undefined') {
    return 'N/A'
  }

  const floatValue = parseFloat(value)

  // Handle NaN cases
  if (isNaN(floatValue)) {
    console.warn(`Invalid number format: "${value}", returning as-is`)
    return value
  }

  const isValueInteger = floatValue % 1 === 0
  return isValueInteger ? floatValue.toFixed(0) : floatValue.toFixed(2)
}

export const getCurrentDateTime = (): { value: string; offset: string } => {
  const currentDate = new Date()
  const offset = -(currentDate.getTimezoneOffset() / 60)
  const offsetSign = offset >= 0 ? '+' : '-'

  return {
    value: currentDate.toLocaleString(undefined, { hourCycle: 'h23' }),
    offset: `UTC${offsetSign}${Math.abs(offset)}`
  }
}
