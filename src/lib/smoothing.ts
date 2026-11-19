/** Time-window rolling average of power, keyed on sample timestamps. */
export class PowerSmoother {
  private samples: { t: number; w: number }[] = []
  private readonly maxWindowMs: number

  constructor(maxWindowS: number) {
    this.maxWindowMs = maxWindowS * 1000
  }

  push(t: number, w: number): void {
    this.samples.push({ t, w })
    const cutoff = t - this.maxWindowMs - 1000
    while (this.samples.length > 0 && this.samples[0].t < cutoff) this.samples.shift()
  }

  /** Average over the last windowS seconds, measured back from the newest sample. */
  average(windowS: number): number | null {
    const n = this.samples.length
    if (n === 0) return null
    const latest = this.samples[n - 1].t
    // A small tolerance so a 1 Hz stream gives exactly N samples for an N-second window.
    const cutoff = latest - windowS * 1000 + 250
    let sum = 0
    let count = 0
    for (let i = n - 1; i >= 0 && this.samples[i].t > cutoff; i--) {
      sum += this.samples[i].w
      count++
    }
    return count === 0 ? this.samples[n - 1].w : sum / count
  }

  clear(): void {
    this.samples = []
  }
}
