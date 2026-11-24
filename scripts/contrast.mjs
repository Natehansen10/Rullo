// WCAG contrast for every color pair DESIGN.md depends on, in both themes.
// Reads the values from src/styles/tokens.css, so there is no hex here.
// Run: npm run contrast. Exits 1 when a rule fails.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

/** The custom properties of the first block that starts with `selector {`. */
function block(selector) {
  const at = css.indexOf(`\n${selector} {`)
  if (at < 0) throw new Error(`No block for ${selector}`)
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('\n}', at))
  const out = {}
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--ww-([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const light = block(':root')
const dark = { ...light, ...block(":root[data-theme='dark']") }

const hex = (v) => {
  const m = /^#([0-9a-f]{6})$/i.exec(v)
  if (!m) throw new Error(`Not a color: ${v}`)
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
}

/** A token as [r, g, b], following var(). */
function rgb(theme, name) {
  let v = theme[name]
  for (let i = 0; i < 8 && v?.startsWith('var('); i++) v = theme[/var\(--ww-([a-z0-9-]+)\)/.exec(v)[1]]
  if (!v) throw new Error(`No token ${name}`)
  return hex(v)
}

/** color-mix(in srgb, var(--ww-x) N%, transparent) as [rgb, alpha]. */
function tint(theme, name) {
  const m = /color-mix\(in srgb, var\(--ww-([a-z0-9-]+)\) ([\d.]+)%, transparent\)/.exec(theme[name])
  if (!m) throw new Error(`Not a tint: ${name}`)
  return [rgb(theme, m[1]), Number(m[2]) / 100]
}

const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** `top` at `alpha` over `under`, mixed in sRGB as the browser does. */
const over = (top, alpha, under) => top.map((v, i) => Math.round(v * alpha + under[i] * (1 - alpha)))

const ZONES = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7']
const GROUNDS = ['surface', 'bg', 'raised']

/**
 * The checks. `min` is the rule; a row without one is a number DESIGN.md
 * quotes, or one that another rule covers (the note says which).
 * `a` and `b` are token names, or functions of the theme for a mixed color.
 */
const checks = []
const add = (group, label, a, b, min, note = '') => checks.push({ group, label, a, b, min, note })
const tok = (name) => (t) => rgb(t, name)

// Text: 4.5:1 on every background it sits on.
for (const fg of ['fg', 'fg-muted', 'fg-subtle']) for (const g of GROUNDS) add('Text, 4.5:1', `${fg} on ${g}`, fg, g, 4.5)
add('Text, 4.5:1', 'fg-muted on line (secondary button, hover)', 'fg-muted', 'line', null, 'no text is fg-muted on a hovered button; for reference')
add('Text, 4.5:1', 'fg on line (secondary button, hover)', 'fg', 'line', 4.5)
add('Text, 4.5:1', 'accent-ink on accent', 'accent-ink', 'accent', 4.5)
add('Text, 4.5:1', 'accent-ink on accent-hover', 'accent-ink', 'accent-hover', 4.5)
add('Text, 4.5:1', 'accent-ink on accent-press', 'accent-ink', 'accent-press', 4.5)
add('Text, 4.5:1', 'state-on on surface', 'state-on', 'surface', 4.5)
add('Text, 4.5:1', 'state-on on bg', 'state-on', 'bg', 4.5)
add('Text, 4.5:1', 'state-on on raised', 'state-on', 'raised', null, 'state-on is text on surface only (the cadence cue)')
add('Text, 4.5:1', 'state-under on surface', 'state-under', 'surface', 4.5)
add('Text, 4.5:1', 'state-under on bg', 'state-under', 'bg', 4.5)
add('Text, 4.5:1', 'state-under on raised', 'state-under', 'raised', 4.5)
add('Text, 4.5:1', 'state-over on surface', 'state-over', 'surface', 4.5)
add('Text, 4.5:1', 'state-over on bg', 'state-over', 'bg', 4.5)
add('Text, 4.5:1', 'state-over on raised (danger button)', 'state-over', 'raised', 4.5)
add('Text, 4.5:1', 'state-over on surface (danger button, hover)', 'state-over', 'surface', 4.5)
add('Text, 4.5:1', 'state-over on line (why danger hover is not line)', 'state-over', 'line', null, 'not used: danger hover goes to surface')
add('Text, 4.5:1', 'fg-subtle on raised (disabled button, field)', 'fg-subtle', 'raised', 4.5)

// Live numbers and graphics: 3:1.
add('Graphics, 3:1', 'accent on surface', 'accent', 'surface', 3)
add('Graphics, 3:1', 'accent on bg', 'accent', 'bg', 3)
add('Graphics, 3:1', 'accent on raised (ridden stretch over the profile fill)', 'accent', 'raised', 3)
add('Graphics, 3:1', 'accent-on-dark on fg (light) / on bg (dark)', 'accent-on-dark', (t) => (t === light ? rgb(t, 'fg') : rgb(t, 'bg')), 3)
add('Graphics, 3:1', 'accent on fg', 'accent', 'fg', null, 'why Olive never goes on a dark background in Light')
add('Graphics, 3:1', 'cadence on surface', 'cadence', 'surface', 3)
add('Graphics, 3:1', 'fg-muted on surface (training bars, heart rate line)', 'fg-muted', 'surface', 3)
add('Graphics, 3:1', 'fg-subtle on surface (profile line, rest-day tick)', 'fg-subtle', 'surface', 3)
add('Graphics, 3:1', 'fg-subtle on raised (profile line over its fill)', 'fg-subtle', 'raised', 3)
add('Graphics, 3:1', 'state-on on raised (status dot in the pill)', 'state-on', 'raised', 3)
add('Graphics, 3:1', 'state-under on raised (status dot in the pill)', 'state-under', 'raised', 3)
add('Graphics, 3:1', 'state-over on raised (status dot in the pill)', 'state-over', 'raised', 3)
add('Graphics, 3:1', 'fg-subtle on raised (idle status dot)', 'fg-subtle', 'raised', 3)
for (const z of ZONES) add('Zones on surface, 3:1 (the Power number, the trace, a block)', `${z} on surface`, z, 'surface', 3)
for (const z of ZONES) add('Zones on raised (the trace over the target band, the builder plot)', `${z} on raised`, z, 'raised', null, 'covered by the surface hairline on each side of the line')
for (const z of ZONES) add('Zones on bg (a card graph on the page)', `${z} on bg`, z, 'bg', null, 'DESIGN.md sets the zone rule on surface; a card graph repeats the card name and line')

// The two-tone outline: an fg line on a surface hairline, the hairline against every fill.
add('Two-tone outline', 'fg on surface (the line on its hairline)', 'fg', 'surface', 4.5)
for (const z of ZONES) add('Two-tone outline', `surface hairline on ${z}`, 'surface', z, 3)
for (const z of ZONES) add('Two-tone outline', `fg alone on ${z}`, 'fg', z, null, 'why the outline needs its hairline')
add('Two-tone outline', 'surface hairline on raised (cursor line over the profile fill)', 'surface', 'raised', null, 'the fg line carries it: next row')
add('Two-tone outline', 'fg on raised (cursor line, drop marker)', 'fg', 'raised', 3)

// The workout strip's position line: accent on surface hairlines, over zone fills.
add('Position line', 'accent on surface (the line on its hairline)', 'accent', 'surface', 3)
for (const z of ZONES) add('Position line', `accent alone on ${z}`, 'accent', z, null, 'why the line has hairlines')

// The "done" wash: surface at 60% over a zone fill.
const washed = (z) => (t) => over(rgb(t, 'surface'), 0.6, rgb(t, z))
const DONE = 'Done wash (surface at 60% over a zone)'
for (const z of ZONES) add(DONE, `washed ${z} on surface`, washed(z), 'surface', 'floor', 'a done block still reads on the panel')
for (const z of ZONES) add(DONE, `washed ${z} against ${z}`, washed(z), z, 'floor', 'done against not done')

// Edges.
add('Edges and steps', 'line-strong on surface (field and chip border)', 'line-strong', 'surface', null, 'never the only edge: the fill is a step too; no weaker in Dark')
add('Edges and steps', 'line-strong on raised (chip border on its track)', 'line-strong', 'raised', null, 'no weaker in Dark')
add('Edges and steps', 'line-strong on bg', 'line-strong', 'bg', null, 'no weaker in Dark')
add('Edges and steps', 'line on surface (hairline)', 'line', 'surface', null, 'no weaker in Dark')
add('Edges and steps', 'line on bg (panel border)', 'line', 'bg', null, 'no weaker in Dark')
add('Edges and steps', 'surface against bg (panel on page)', 'surface', 'bg', null, 'no weaker in Dark')
add('Edges and steps', 'raised against surface (control on panel)', 'raised', 'surface', null, 'no weaker in Dark')
add('Edges and steps', 'raised against bg (control on page)', 'raised', 'bg', null, 'no weaker in Dark')
add('Edges and steps', 'fg-muted on surface (focus ring)', 'fg-muted', 'surface', 3)
add('Edges and steps', 'fg-muted on bg (focus ring)', 'fg-muted', 'bg', 3)
add('Edges and steps', 'fg-muted on raised (focus ring)', 'fg-muted', 'raised', 3)
add('Edges and steps', 'fg on raised (picked card border)', 'fg', 'raised', 3)

// The pop-up card over the scrim.
const scrimmed = (g) => (t) => over(...tint(t, 'scrim'), rgb(t, g))
add('Pop-up card', 'card surface against the scrimmed page', 'surface', scrimmed('bg'), null, 'the fill carries the edge in Light')
add('Pop-up card', 'card surface against a scrimmed panel', 'surface', scrimmed('surface'), null)
add('Pop-up card', 'line-strong border against the scrimmed page', 'line-strong', scrimmed('bg'), null, 'the hairline carries the edge in Dark')
add('Pop-up card', 'line-strong border against a scrimmed panel', 'line-strong', scrimmed('surface'), null)
add('Pop-up card', 'scrimmed page against the page (how much it dims)', 'bg', scrimmed('bg'), null, 'for reference')
add('Pop-up card', 'fg text on a scrimmed panel against its own ground', (t) => over(...tint(t, 'scrim'), rgb(t, 'fg')), scrimmed('surface'), null, 'the page stays readable but quieter')

// Colors that sit near each other in hue: quoted in DESIGN.md, never a rule.
add('Near neighbors (never told apart by color alone)', 'fg-subtle against z1 (stale number, Z1 number)', 'fg-subtle', 'z1', null, 'wider in Dark is better')
add('Near neighbors (never told apart by color alone)', 'accent against state-on', 'accent', 'state-on', null)
add('Near neighbors (never told apart by color alone)', 'accent against z3', 'accent', 'z3', null)
add('Near neighbors (never told apart by color alone)', 'accent against state-under', 'accent', 'state-under', null)
add('Near neighbors (never told apart by color alone)', 'z3 against state-on', 'z3', 'state-on', null)
add('Near neighbors (never told apart by color alone)', 'z4 against state-under', 'z4', 'state-under', null)
add('Near neighbors (never told apart by color alone)', 'z6 against state-over', 'z6', 'state-over', null)
add('Near neighbors (never told apart by color alone)', 'z1 against fg-muted', 'z1', 'fg-muted', null)
add('Near neighbors (never told apart by color alone)', 'z1 against fg', 'z1', 'fg', null)

const value = (t, x) => (typeof x === 'function' ? x(t) : rgb(t, x))
const show = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
const fmt = (n) => n.toFixed(2).padStart(5)

// The token tables.
const COLOR_TOKENS = ['bg', 'surface', 'raised', 'line', 'line-strong', 'fg', 'fg-muted', 'fg-subtle', 'accent', 'accent-hover', 'accent-press', 'accent-ink', 'accent-on-dark', 'cadence', 'state-on', 'state-under', 'state-over', ...ZONES]
console.log('Tokens\n  token            Light     Dark')
for (const n of COLOR_TOKENS) console.log(`  ${n.padEnd(16)} ${show(rgb(light, n))}   ${show(rgb(dark, n))}`)
console.log(`  ${'shade'.padEnd(16)} ${'(fg)'.padEnd(9)} ${show(rgb(dark, 'shade'))}`)
for (const n of ['scrim', 'shadow-ink']) {
  const [l, d] = [tint(light, n), tint(dark, n)]
  console.log(`  ${n.padEnd(16)} ${show(l[0])} at ${Math.round(l[1] * 100)}%   ${show(d[0])} at ${Math.round(d[1] * 100)}%`)
}

let failed = 0
let group = ''
for (const c of checks) {
  if (c.group !== group) {
    group = c.group
    console.log(`\n${group}\n  ${'pair'.padEnd(58)} Light   Dark  rule`)
  }
  const l = ratio(value(light, c.a), value(light, c.b))
  const d = ratio(value(dark, c.a), value(dark, c.b))
  let verdict
  if (typeof c.min === 'number') {
    const bad = [l < c.min && 'Light', d < c.min && 'Dark'].filter(Boolean)
    verdict = bad.length ? `FAIL ${c.min}:1 in ${bad.join(' and ')}` : `pass ${c.min}:1`
    if (bad.length) failed++
  } else if (c.min === 'floor') {
    // No zone may wash out more than the weakest zone does in Light.
    const floor = Math.min(...checks.filter((x) => x.group === c.group && x.label.includes(' on ') === c.label.includes(' on ')).map((x) => ratio(value(light, x.a), value(light, x.b))))
    const ok = Number(d.toFixed(2)) >= Number(floor.toFixed(2))
    verdict = ok ? `pass, at or over Light's weakest (${floor.toFixed(2)})` : `FAIL, under Light's weakest (${floor.toFixed(2)})`
    if (!ok) failed++
  } else if (/no weaker in Dark/.test(c.note)) {
    // Compared at the two decimals shown, so a tie is a tie.
    const ok = Number(d.toFixed(2)) >= Number(l.toFixed(2))
    verdict = ok ? 'pass, Dark is no weaker' : 'FAIL, Dark is weaker than Light'
    if (!ok) failed++
  } else verdict = 'no rule'
  console.log(`  ${c.label.padEnd(58)} ${fmt(l)}  ${fmt(d)}  ${verdict}${c.note && !/^must|^no weaker/.test(c.note) ? ` (${c.note})` : ''}`)
}

// The card's edge against the dimmed page: its fill or its hairline, whichever is stronger.
{
  const edge = (t, g) => Math.max(ratio(rgb(t, 'surface'), scrimmed(g)(t)), ratio(rgb(t, 'line-strong'), scrimmed(g)(t)))
  for (const g of ['bg', 'surface']) {
    const [l, d] = [edge(light, g), edge(dark, g)]
    const ok = d >= l
    if (!ok) failed++
    console.log(`  ${`card edge (the stronger of fill and hairline), scrimmed ${g}`.padEnd(58)} ${fmt(l)}  ${fmt(d)}  ${ok ? 'pass, Dark is no weaker' : 'FAIL, Dark is weaker than Light'}`)
  }
}

console.log(failed ? `\n${failed} failed.` : '\nEvery rule passes in both themes.')
process.exit(failed ? 1 : 0)
