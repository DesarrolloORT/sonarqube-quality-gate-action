import { getStatusEmoji, getComparatorSymbol } from '../utils'

describe('utils - additional coverage', () => {
  describe('getStatusEmoji', () => {
    it('should return warning for WARNING status', () => {
      const result = getStatusEmoji('WARNING')
      expect(result).toBe(':warning: Warning')
    })

    it('should return in progress for IN_PROGRESS status', () => {
      const result = getStatusEmoji('IN_PROGRESS')
      expect(result).toBe(':hourglass_flowing_sand: In Progress')
    })

    it('should return pending for PENDING status', () => {
      const result = getStatusEmoji('PENDING')
      expect(result).toBe(':clock1: Pending')
    })

    it('should return grey question mark and warn for unknown status', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const result = getStatusEmoji('UNKNOWN_STATUS')
      
      expect(result).toBe(':grey_question:')
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown status received: "UNKNOWN_STATUS". Defaulting to grey question mark.'
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('getComparatorSymbol', () => {
    it('should handle unknown comparator and return empty string', () => {
      const result = getComparatorSymbol('UNKNOWN')
      expect(result).toBe('')
    })

    it('should handle undefined comparator and return empty string', () => {
      const result = getComparatorSymbol(undefined as any)
      expect(result).toBe('')
    })

    it('should handle null comparator and return empty string', () => {
      const result = getComparatorSymbol(null as any)
      expect(result).toBe('')
    })
  })
})
