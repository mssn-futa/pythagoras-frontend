import { useCallback, useEffect, useState } from 'react'

/**
 * Loads `load()` whenever `key` changes (or `reload()` is called).
 * Loading is derived (state belongs to a different key), so no state is set
 * synchronously inside the effect and stale responses are ignored.
 */
export function useRemote(load, key) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, data: null, error: null })
  const requestKey = `${key}#${attempt}`

  useEffect(() => {
    let active = true
    load().then(
      (data) => active && setState({ key: requestKey, data, error: null }),
      (error) => active && setState({ key: requestKey, data: null, error }),
    )
    return () => {
      active = false
    }
    // `load` closes over `key`; the key is the identity of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const settled = state.key === requestKey
  return {
    loading: !settled,
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    reload: useCallback(() => setAttempt((n) => n + 1), []),
  }
}
