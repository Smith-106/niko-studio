import { useState, useCallback } from 'react'

const ONBOARDING_KEY = 'niko-onboarding-done'

export function useOnboarding() {
  const [isFirstRun, setIsFirstRun] = useState(() => {
    return localStorage.getItem(ONBOARDING_KEY) !== 'true'
  })

  const markDone = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setIsFirstRun(false)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY)
    setIsFirstRun(true)
  }, [])

  return { isFirstRun, markDone, resetOnboarding }
}