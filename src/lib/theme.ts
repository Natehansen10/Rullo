/**
 * Appearance: Light, Dark, or Match my computer. Light by default, set on the
 * Profile tab, per rider (the key is in RIDER_KEYS in rider.ts).
 *
 * The theme is one attribute, `data-theme` on <html>: "dark" or "light". The
 * dark values of the tokens hang off it in tokens.css, so no component knows
 * which theme it is in.
 *
 * The small script in index.html sets the same attribute before the first
 * paint, so a rider who chose Dark never sees a light frame. It reads this
 * key and follows the same rule as `resolved` below: keep the two in step.
 * It can read the plain key because rider.ts keeps the current rider's
 * settings under their own names and puts the others away.
 */

export type Appearance = 'light' | 'dark' | 'auto'
export const APPEARANCES = ['light', 'dark', 'auto'] as const
export const APPEARANCE_LABEL: Record<Appearance, string> = { light: 'Light', dark: 'Dark', auto: 'Match my computer' }

/** Also read by the script in index.html. */
const KEY = 'ww.appearance'
const DARK_QUERY = '(prefers-color-scheme: dark)'

const isAppearance = (v: unknown): v is Appearance => APPEARANCES.includes(v as Appearance)

/** A choice made where storage is unavailable: it still applies this session. */
let unsaved: Appearance | null = null

/** The rider's choice as saved. Read each time, so a restore or another tab is picked up. */
export function appearance(): Appearance {
  try {
    const v = localStorage.getItem(KEY)
    return isAppearance(v) ? v : (unsaved ?? 'light')
  } catch {
    return unsaved ?? 'light'
  }
}

function computerIsDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches
}

/** The theme on screen for a choice. */
function resolved(a: Appearance): 'light' | 'dark' {
  return a === 'dark' || (a === 'auto' && computerIsDark()) ? 'dark' : 'light'
}

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)

/**
 * Put the saved choice on the page: the attribute, the browser's own controls
 * and scrollbars (`color-scheme`), and the browser's bar (`theme-color`).
 * `theme-color` cannot read a token, so it is given the value of `bg` as the
 * page has it now. No color is written here.
 */
export function applyTheme(): void {
  const theme = resolved(appearance())
  const root = document.documentElement
  if (root.dataset.theme !== theme) {
    // A switch is not a state change: every color snaps together (index.css), then the eases come back.
    root.dataset.themeSwitch = ''
    root.dataset.theme = theme
    void getComputedStyle(root).color
    requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.themeSwitch))
  }
  meta('color-scheme')?.setAttribute('content', theme)
  const bg = getComputedStyle(root).getPropertyValue('--ww-bg').trim()
  if (bg) meta('theme-color')?.setAttribute('content', bg)
}

export function setAppearance(a: Appearance): void {
  unsaved = null
  try {
    localStorage.setItem(KEY, a)
  } catch {
    unsaved = a
  }
  applyTheme()
}

/**
 * Apply the theme and keep it right: when the computer changes between light
 * and dark (Match my computer follows it live) and when another tab changes
 * the setting. Called once, before the first render.
 */
export function startTheme(): void {
  applyTheme()
  if (typeof matchMedia === 'function') matchMedia(DARK_QUERY).addEventListener('change', applyTheme)
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) applyTheme()
  })
}
