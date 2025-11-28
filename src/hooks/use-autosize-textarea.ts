import { useLayoutEffect, useRef } from "react"

interface UseAutosizeTextAreaProps {
  ref: React.RefObject<HTMLTextAreaElement | null>
  maxHeight?: number
  borderWidth?: number
  dependencies: React.DependencyList
  value?: string // Pass the controlled value directly
}

export function useAutosizeTextArea({
  ref,
  maxHeight = Number.MAX_SAFE_INTEGER,
  borderWidth = 0,
  dependencies,
  value,
}: UseAutosizeTextAreaProps) {
  const originalHeight = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!ref.current) return

    const currentRef = ref.current
    const borderAdjustment = borderWidth * 2

    // Capture original height on first render
    if (originalHeight.current === null) {
      // Force a reflow to get accurate initial height
      currentRef.style.height = 'auto'
      originalHeight.current = Math.max(currentRef.scrollHeight - borderAdjustment, 40)
    }

    // Check if empty using the passed value (more reliable than DOM value)
    const isEmpty = value !== undefined ? value === '' : currentRef.value === ''
    
    // If textarea is empty, reset to original height
    if (isEmpty) {
      currentRef.style.height = `${originalHeight.current + borderAdjustment}px`
      return
    }

    // Reset height to auto to get correct scrollHeight
    currentRef.style.height = 'auto'
    const scrollHeight = currentRef.scrollHeight

    // Make sure we don't go over maxHeight
    const clampedToMax = Math.min(scrollHeight, maxHeight)
    // Make sure we don't go less than the original height
    const clampedToMin = Math.max(clampedToMax, originalHeight.current)

    currentRef.style.height = `${clampedToMin + borderAdjustment}px`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxHeight, ref, value, ...dependencies])
}
