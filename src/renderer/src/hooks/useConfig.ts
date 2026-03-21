import { useCallback, useEffect, useState } from 'react'
import type { AppConfig } from '../../../main/config/app-config'

/**
 * Subscribe to a slice of the persisted config.
 * Returns [value, setter] — setter persists the change via IPC.
 */
export function useConfig<K extends keyof AppConfig>(
  key: K
): [AppConfig[K] | undefined, (value: AppConfig[K]) => void] {
  const [value, setValue] = useState<AppConfig[K] | undefined>(undefined)

  useEffect(() => {
    window.config.get().then((cfg) => setValue(cfg[key]))

    const unsub = window.config.onChange((cfg) => setValue(cfg[key]))
    return unsub
  }, [key])

  const setter = useCallback(
    (val: AppConfig[K]) => {
      void window.config.set(key, val)
    },
    [key]
  )

  return [value, setter]
}
