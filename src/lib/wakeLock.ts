/** Screen wake lock while riding. Re-requested when the tab becomes visible again. */
let sentinel: WakeLockSentinel | null = null
let wanted = false

async function acquire(): Promise<void> {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch (err) {
    console.warn('Wake lock unavailable:', err)
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void acquire()
})

export function keepAwake(on: boolean): void {
  wanted = on
  if (on) void acquire()
  else if (sentinel) {
    void sentinel.release()
    sentinel = null
  }
}
