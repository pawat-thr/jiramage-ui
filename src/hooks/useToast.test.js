import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from './useToast.js'

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a toast and auto-dismisses after 4 seconds', () => {
    const { result } = renderHook(() => useToast())
    act(() => result.current.showToast('saved'))
    expect(result.current.toast).toEqual({ text: 'saved', error: false })
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current.toast).toBeNull()
  })

  it('showError marks the toast as an error and stringifies Error objects', () => {
    const { result } = renderHook(() => useToast())
    act(() => result.current.showError(new Error('boom')))
    expect(result.current.toast).toEqual({ text: 'boom', error: true })
  })

  it('a new toast resets the dismiss timer', () => {
    const { result } = renderHook(() => useToast())
    act(() => result.current.showToast('first'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.showToast('second'))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.toast?.text).toBe('second')
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.toast).toBeNull()
  })
})
