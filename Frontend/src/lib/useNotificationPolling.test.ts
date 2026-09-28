import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * `createNotificationPoller` — the visibility-aware scheduler shared by all
 * three notification bells.
 *
 * The poller is deliberately framework-free so it can be tested directly with
 * the same runner the backend uses. The contract under test:
 *
 *   VISIBLE            -> poll every intervalMs
 *   TAB HIDDEN         -> no polling at all
 *   VISIBLE AGAIN      -> exactly one immediate refresh, then resume
 *
 * The window/document are injected fakes, so no DOM and no real timers are
 * involved.
 */

const CHANGE_EVENT = 'emart:notifications-changed'

interface FakeEnv {
  win: any
  doc: any
  intervals: Map<number, () => void>
  nextId: number
  fireInterval: () => void
  intervalCount: () => number
  setVisibility: (state: 'visible' | 'hidden') => void
  fireWindowEvent: (type: string) => void
  listenerCount: (target: 'win' | 'doc', type: string) => number
  restoreTimers: () => void
}

function makeEnv(initialVisibility: 'visible' | 'hidden' = 'visible'): FakeEnv {
  const realSetInterval = globalThis.setInterval
  const realClearInterval = globalThis.clearInterval
  const intervals = new Map<number, () => void>()
  let nextId = 0
  let visibility = initialVisibility

  ;(globalThis as any).setInterval = ((fn: () => void) => {
    const id = ++nextId
    intervals.set(id, fn)
    return id as any
  }) as any
  ;(globalThis as any).clearInterval = ((id: any) => intervals.delete(id)) as any

  const target = () => {
    const map = new Map<string, Set<() => void>>()
    return {
      addEventListener(type: string, fn: () => void) {
        if (!map.has(type)) map.set(type, new Set())
        map.get(type)!.add(fn)
      },
      removeEventListener(type: string, fn: () => void) {
        map.get(type)?.delete(fn)
      },
      listenerCount(type: string) {
        return map.get(type)?.size ?? 0
      },
      fire(type: string) {
        map.get(type)?.forEach((fn) => fn())
      },
    }
  }

  const winTarget = target()
  const docTarget = target()

  const env: FakeEnv = {
    win: winTarget,
    doc: {
      get visibilityState() {
        return visibility;
      },
      addEventListener: docTarget.addEventListener,
      removeEventListener: docTarget.removeEventListener,
      listenerCount: docTarget.listenerCount,
    },
    intervals,
    nextId,
    fireInterval: () => {
      for (const fn of [...intervals.values()]) fn()
    },
    intervalCount: () => intervals.size,
    setVisibility: (state) => {
      visibility = state
      docTarget.fire('visibilitychange')
    },
    fireWindowEvent: (type) => winTarget.fire(type),
    listenerCount: (which, type) =>
      which === 'win' ? winTarget.listenerCount(type) : docTarget.listenerCount(type),
    restoreTimers: () => {
      globalThis.setInterval = realSetInterval
      globalThis.clearInterval = realClearInterval
    },
  }

  ;(env as any).fireDoc = (type: string) => docTarget.fire(type)
  return env
}

import { createNotificationPoller } from './useNotificationPolling';

function setup(env: FakeEnv, refresh: () => void, intervalMs = 30000) {
  return createNotificationPoller({
    refresh,
    intervalMs,
    changeEventName: CHANGE_EVENT,
    win: env.win,
    doc: env.doc,
  });
}

test('visible: one refresh on start, then one per interval tick', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1
  })

  assert.equal(calls, 1, 'one refresh when the poller starts')
  assert.equal(env.intervalCount(), 1, 'exactly one interval')

  env.fireInterval()
  assert.equal(calls, 2)
  env.fireInterval()
  assert.equal(calls, 3)

  poller.stop()
  env.restoreTimers()
})

test('mounted while hidden: no refresh and no interval', () => {
  const env = makeEnv('hidden')
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  assert.equal(calls, 0, 'a bell mounted in a hidden tab does not fetch')
  assert.equal(env.intervalCount(), 0, 'and does not poll')

  poller.stop()
  env.restoreTimers()
})

test('hiding the tab clears the interval and issues no request', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  assert.equal(calls, 1)
  assert.equal(env.intervalCount(), 1)

  env.setVisibility('hidden')
  assert.equal(calls, 1, 'hiding issues no request')
  assert.equal(env.intervalCount(), 0, 'interval cleared')

  env.fireInterval()
  assert.equal(calls, 1, 'a cleared interval cannot fire')

  poller.stop()
  env.restoreTimers()
})

test('becoming visible refreshes exactly once and restarts a single interval', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  env.setVisibility('hidden')
  assert.equal(calls, 1)
  assert.equal(env.intervalCount(), 0)

  env.setVisibility('visible')
  assert.equal(calls, 2, 'one immediate refresh on becoming visible')
  assert.equal(env.intervalCount(), 1, 'exactly one interval restarted')

  env.fireInterval()
  assert.equal(calls, 3, 'polling resumes')
  assert.equal(env.intervalCount(), 1, 'still a single interval')

  poller.stop()
  env.restoreTimers()
})

test('repeated hide/show cycles never accumulate intervals or extra polls', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  for (let i = 0; i < 5; i++) {
    env.setVisibility('hidden')
    env.setVisibility('visible')
  }

  assert.equal(env.intervalCount(), 1, 'still exactly one interval after 5 cycles')
  assert.equal(calls, 1 + 5, 'one refresh per visible transition and nothing else')

  poller.stop()
  env.restoreTimers()
})

test('a visibility change to hidden twice does not restart polling', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  env.setVisibility('hidden')
  env.setVisibility('hidden')
  env.setVisibility('hidden')
  assert.equal(calls, 1)
  assert.equal(env.intervalCount(), 0)

  env.setVisibility('visible')
  assert.equal(calls, 2, 'only the first visible transition refreshes')

  poller.stop()
  env.restoreTimers()
})

test('listeners are registered once and removed on stop', () => {
  const env = makeEnv()
  const poller = setup(env, () => {})

  assert.equal(env.listenerCount('doc', 'visibilitychange'), 1)
  assert.equal(env.listenerCount('win', 'focus'), 1)
  assert.equal(env.listenerCount('win', CHANGE_EVENT), 1)

  poller.stop()

  assert.equal(env.listenerCount('doc', 'visibilitychange'), 0)
  assert.equal(env.listenerCount('win', 'focus'), 0)
  assert.equal(env.listenerCount('win', CHANGE_EVENT), 0)
  assert.equal(env.intervalCount(), 0, 'stop clears the interval')

  env.restoreTimers()
})

test('stop() prevents any later refresh from the removed listeners', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  assert.equal(calls, 1)
  poller.stop()

  env.setVisibility('visible')
  env.fireWindowEvent('focus')
  env.fireWindowEvent(CHANGE_EVENT)
  env.fireInterval()

  assert.equal(calls, 1, 'nothing runs after stop (unmount)')
  env.restoreTimers()
})

test('focus and notificationsChanged still refresh while visible', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  assert.equal(calls, 1)
  env.fireWindowEvent('focus')
  assert.equal(calls, 2, 'focus refresh preserved')
  env.fireWindowEvent(CHANGE_EVENT)
  assert.equal(calls, 3, 'notificationsChanged refresh preserved')

  poller.stop()
  env.restoreTimers()
})

test('focus and change events while hidden issue no request', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  env.setVisibility('hidden')
  env.fireWindowEvent('focus')
  env.fireWindowEvent(CHANGE_EVENT)
  assert.equal(calls, 1, 'no background request from focus or change events')

  // Returning to the tab still refreshes once, so nothing is missed.
  env.setVisibility('visible')
  assert.equal(calls, 2, 'the mandatory refresh on becoming visible still runs')

  poller.stop()
  env.restoreTimers()
})

test('an interval that fires after the tab was hidden is suppressed', () => {
  const env = makeEnv()
  let calls = 0
  const poller = setup(env, () => {
    calls += 1;
  })

  // Capture the scheduled callback before the interval is cleared, simulating a
  // tick already queued when the tab is backgrounded.
  const queued = [...env.intervals.values()][0]!
  env.setVisibility('hidden')
  queued()

  assert.equal(calls, 1, 'a queued tick does not fire a background request')
  poller.stop()
  env.restoreTimers()
})
