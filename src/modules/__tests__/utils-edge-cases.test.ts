import { formatStringNumber } from '../utils'

describe('formatStringNumber - edge cases', () => {
  test('should return N/A for null value', () => {
    expect(formatStringNumber('null')).toBe('N/A')
  })

  test('should return N/A for undefined value', () => {
    expect(formatStringNumber('undefined')).toBe('N/A')
  })

  test('should return N/A for N/A value', () => {
    expect(formatStringNumber('N/A')).toBe('N/A')
  })

  test('should return original value for invalid number format', () => {
    expect(formatStringNumber('not-a-number')).toBe('not-a-number')
  })

  test('should return N/A for empty string', () => {
    expect(formatStringNumber('')).toBe('N/A')
  })
})
