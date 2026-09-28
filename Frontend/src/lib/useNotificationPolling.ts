import * as React from 'react'

/**
 * Framework-free scheduler for the notification bells.
 *
 * The bells each own an unread-count refresh function; the only thing they
 * share is *when* it runs. Previously every bell started a fixed
 * `setInterval` on mount and kept it running while the tab was in the
 * background, so a hidden tab still issued one request per bell per interval.
 *
 * The contract is:
 *
 *   VISIBLE            -> poll every `intervalMs`
 *   TAB HIDDEN         -> no polling at all
 *   VISIBLE AGAIN      -> one immediate refresh, then resume polling
 *
 * Exactly one interval and one listener per concern exist at any time: the
 * interval is always cleared before a new one is created, and both listeners
 * are removed by `stop()`.
 *
 * `notificationsChanged` events are still honoured while visible. They are
 * ignored while hidden because the mandatory refresh on becoming visible
 * already re-reads the current value, so no state is lost by dropping them.
 */
export interface NotificationPoller {
  /** Starts polling (or resumes it after a hidden period). */
  start: () => void
  /** Stops polling and detaches every listener. */
  stop: () => void
}

export interface PollerDeps {
  /** Performs the actual refresh. */
  refresh: () => void | Promise<void>
  /** Poll interval in milliseconds. */
  intervalMs: number
  /** Event name carrying "notifications changed" notifications. */
  changeEventName: string
  /** Injected for testability; defaults to the ambient environment. */
  win?: Window
  doc?: Document
}

const isHidden = (doc?: Document) =>
  typeof doc === 'undefined' || doc.visibilityState === 'hidden'

export const createNotificationPoller = (deps: PollerDeps): NotificationPoller => {
  const doc = deps.doc ?? (typeof document !== 'undefined' ? document : undefined)
  const win = deps.win ?? (typeof window !== 'undefined' ? window : undefined)

  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const stopTimer = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const startTimer = () => {
    stopTimer()
    timer = setInterval(() => {
      // Guard again at fire time: the tab can be hidden between ticks.
      if (!stopped && !isHidden(doc)) void deps.refresh()
    }, deps.intervalMs)
  }

  const runIfVisible = () => {
    if (!stopped && !isHidden(doc)) void deps.refresh()
  }

  const start = () => {
    void deps.refresh()
    startTimer()
  }

  const onVisibilityChange = () => {
    if (stopped) return
    if (isHidden(doc)) {
      // Hidden tab: stop issuing requests entirely.
      stopTimer()
    } else {
      // Back in the foreground: one immediate refresh, then resume.
      start()
    }
  }

  const onFocus = () => runIfVisible()
  const onChange = () => runIfVisible()

  if (isHidden(doc)) {
    // Mounted while already hidden: do not fetch and do not start polling.
    stopTimer()
  } else {
    start()
  }

  win?.addEventListener('focus', onFocus)
  win?.addEventListener(deps.changeEventName, onChange)
  doc?.addEventListener('visibilitychange', onVisibilityChange)

  return {
    start,
    stop: () => {
      stopped = true
      stopTimer()
      win?.removeEventListener('focus', onFocus)
      win?.removeEventListener(deps.changeEventName, onChange)
      doc?.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}

/**
 * React binding for `createNotificationPoller`. The scheduler is rebuilt only
 * when the interval changes; a new `refresh` identity is picked up through a
 * ref so the interval and listeners are never torn down needlessly.
 */
export const useNotificationPolling = (
  refresh: () => void | Promise<void>,
  intervalMs: number,
  changeEventName = 'emart:notifications-changed',
) => {
  const refreshRef = React.useRef(refresh)
  React.useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  React.useEffect(() => {
    const poller = createNotificationPoller({
      refresh: () => refreshRef.current(),
      intervalMs,
      changeEventName,
    })
    return () => poller.stop()
    // `refresh` is intentionally excluded: it is read through the ref above.
  }, [intervalMs, changeEventName])
}
