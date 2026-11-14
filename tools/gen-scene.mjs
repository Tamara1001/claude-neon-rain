// Generates hooks/scene.ts: the Neon Rain scene as one animated SVG, a port of the "neon-rain" scene from
// 0toshigami/claude-desktop-themes (MIT, see NOTICE.md): 14 px ASCII cells, speed 2, smooth motion.
// Usage: node tools/gen-scene.mjs [copy.svg]   (writes ../hooks/scene.ts, and a plain .svg copy if a path is given)
//
// Why the output looks the way it does (Claude Desktop):
// - The SVG is sanitized with DOMPurify and drawn in a sandboxed iframe: <style>, class, style, @keyframes and
//   url(#id) survive; scripts do not. Max size is 131,072 characters.
// - Desktop did not animate a scene whose CSS computes with round()/tan()/pow() or @media rules, so the city
//   is generated for a fixed 1400x1050 box (building heights are precomputed) and the root has a viewBox with
//   preserveAspectRatio="xMidYMax slice": it fills any window, cropped at the sides/top, anchored at the street.
// - If the app turns animation off (reduced motion, software compositing) it freezes the scene on purpose.
// - Only transform/opacity are animated; no filters; the big glyph blocks are strokes, not <text>.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// ---- kit del original (core.js) ----
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)
const shade = (c, k) => hex(mix(rgb(c), k > 0 ? [1, 1, 1] : [0, 0, 0], Math.abs(k)))
const hash = (a, b, c = 0) => {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const sketch = (w, h, parts) => {
  const g = Array.from({ length: h }, () => Array(w).fill('.'))
  for (const [r, c, s] of parts) [...s].forEach((ch, i) => { if (ch !== ' ' && g[r]?.[c + i]) g[r][c + i] = ch })
  return g.map(r => r.join(''))
}
const GLYPHS = 'St%;:X'

// ---- parámetros ----
const CELL = 14
const SPEED = 2 // speed del theme.json: el tiempo de la escena corre al doble
const STREET = 3
const MAXC = 230 // columnas generadas (3220 px): más ancho que cualquier ventana usual
const ROWS_REF = 60 // filas de referencia (ventana ~827 px) para los hash que usan la fila absoluta
const GROUND_REF = ROWS_REF - STREET
const BASE = '#0c1020' // bg del theme.json (surface-0)
const f2 = v => String(Math.round(v * 100) / 100)
const over = (c, a, base = BASE) => hex(mix(rgb(base), rgb(c), a)) // color con alfa ya mezclado (opaco)

// ---- glifos como trazos (medidos sobre Consolas negrita 8 px centrado en la celda de 14) ----
const G = {
  '/': [[[5, 10], [9, 4.2]]],
  '\\': [[[5, 4.2], [9, 10]]],
  '|': [[[7, 3.4], [7, 11.2]]],
  S: [[[9, 5], [8.1, 4.4], [6, 4.4], [5.1, 5.2], [5.4, 6.5], [8.6, 7.5], [9, 8.8], [8, 9.6], [5.9, 9.6], [4.9, 9]]],
  t: [[[6.4, 4], [6.4, 8.7], [7.1, 9.5], [8.8, 9.5]], [[4.6, 5.9], [8.8, 5.9]]],
  '%': [[[5.2, 9.4], [8.8, 4.6]], [[5.2, 4.9], [5.6, 5.3]], [[8.4, 8.7], [8.8, 9.1]]],
  ';': [[[7.3, 6.6], [7.4, 6.7]], [[7.4, 8.9], [6.3, 10.9]]],
  ':': [[[7, 6.5], [7.1, 6.6]], [[7, 9], [7.1, 9.1]]],
  X: [[[4.7, 4.4], [9.3, 9.6]], [[9.3, 4.4], [4.7, 9.6]]],
  o: 'o',
  _: [[[4.3, 10.6], [9.7, 10.6]]],
  '~': [[[4.4, 8.1], [5.6, 7.1], [7, 7.8], [8.4, 8.6], [9.6, 7.6]]],
  '*': [[[7, 4.2], [7, 7.6]], [[5.4, 5.1], [8.6, 6.7]], [[8.6, 5.1], [5.4, 6.7]]],
  '.': [[[7, 8.9], [7.1, 9]]],
}
// d de un glifo en la celda (cx, cy) en px; warp = transformación opcional de cada punto
const glyphD = (ch, ox, oy, warp = (x, y) => [x, y]) => {
  if (G[ch] === 'o') {
    const [x, y] = warp(ox + 4.9, oy + 7.8)
    return `M${f2(x)} ${f2(y)}a2.1 1.8 0 1 0 4.2 0a2.1 1.8 0 1 0-4.2 0`
  }
  // primer punto absoluto, el resto relativo (más corto)
  const n1 = v => { const s = f2(v); return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s }
  return G[ch]
    .map(line => {
      let px = 0
      let py = 0
      return line
        .map(([a, b], i) => {
          const [x, y] = warp(ox + a, oy + b)
          const dx = Math.round((x - px) * 100) / 100
          const dy = Math.round((y - py) * 100) / 100
          const r = i ? `l${n1(dx)}${dy < 0 ? '' : ' '}${n1(dy)}` : `M${f2(x)} ${f2(y)}`
          px = i ? px + dx : Math.round(x * 100) / 100
          py = i ? py + dy : Math.round(y * 100) / 100
          return r
        })
        .join('')
    })
    .join('')
}
const strokeP = (d, fg, a, w = 1.05) => (d ? `<path d="${d}" fill="none" stroke="${fg}"${a < 1 ? ` stroke-opacity="${a}"` : ''} stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` : '')
const cellR = (x, y, bg, a = 1) => `<rect x="${f2(x + 2)}" y="${f2(y + 2)}" width="10" height="10" rx="3" fill="${bg}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`
const glyphAt = (x, y, s) => GLYPHS[Math.floor(hash(x, y, s) * GLYPHS.length)]

const defs = []
const css = []

// ---- ciudad (fórmulas de cityOf) ----
const cityRow = (seed, lo, hi, pow) => {
  const out = []
  for (let x = 0, b = 0; x < MAXC; b++) {
    const w = 4 + Math.floor(hash(b, seed) * 5)
    out.push({ b, x0: x, x1: x + w - 1, w, r: 0.6 + 0.4 * hash(b, seed + 1), lo, hi, pow })
    x += w
  }
  return out
}
const NEAR = cityRow(1, 0.08, 0.52, 2)
const FAR = cityRow(5, 0.16, 0.48, 1.4)
const hOf = (bd, cols, rows) => {
  const e = Math.min(1, Math.abs(bd.x0 + bd.w / 2 - cols / 2) / Math.max(1, cols / 2))
  return Math.round(rows * (bd.lo + bd.hi * e ** bd.pow * bd.r))
}
// La misma fórmula en CSS (--C = cols*14px, --R = rows*14px, --c = centro en px, --r = factor del edificio)
const hCss = (lo, hi, pow) =>
  `--e:min(1,abs(2*tan(atan2(var(--c),var(--C))) - 1));--h:max(14px,round(nearest,var(--R)*(${lo} + ${hi}*pow(var(--e),${pow})*var(--r)),14px))`
css.push(`svg{--C:round(up,100vw,14px);--R:round(up,100vh,14px)}`, `.n{${hCss(0.08, 0.52, 2)}}`, `.f{${hCss(0.16, 0.48, 1.4)}}`)
const vars = bd => `--c:${f2((bd.x0 + bd.w / 2) * CELL)}px;--r:${bd.r.toFixed(4)}`

const CITY = {
  wall: { bg: '#1b2242', fg: '#2b355a', a: 0.95 }, roof: { bg: '#2a3358', fg: '#3a4570', a: 0.95 },
  dark: { bg: '#232b4e', fg: '#323c64', a: 0.95 }, far: { bg: '#121730', fg: '#1b2140', a: 0.75 },
  farWin: { bg: '#6a5a3a', fg: '#2a2416', a: 0.5 },
  win: [{ bg: '#f3c56b', fg: '#6a4a10', a: 0.85 }, { bg: '#ffe2a0', fg: '#7a5a18', a: 0.85 }, { bg: '#8fd3ff', fg: '#1d4a6a', a: 0.75 }],
}
// celdas opacas (ya mezcladas sobre el fondo, como el canvas sobre la app)
const solid = c => ({ bg: over(c.bg, c.a), fg: over(c.fg, c.a, over(c.bg, c.a)) })

// Patrón de celdas con glifos: tile de tw x th celdas anclado a la calle (y = 0 es la línea de la calle;
// la fila k sobre la calle ocupa y ∈ [-14k, -14k+14); en el tile, la fila j = (th - k % th) % th).
const kOfRow = (j, th) => (j === 0 ? th : th - j)
const cellSyms = new Map()
const cellSym = (bg, a) => {
  const key = `${bg}|${a}`
  if (!cellSyms.has(key)) {
    const id = `q${cellSyms.size}`
    cellSyms.set(key, id)
    defs.push(`<rect id="${id}" x="2" y="2" width="10" height="10" rx="3" fill="${bg}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`)
  }
  return cellSyms.get(key)
}
const cellPattern = (id, tw, th, at) => {
  const bgs = new Map()
  const fgs = new Map()
  for (let j = 0; j < th; j++)
    for (let i = 0; i < tw; i++) {
      const c = at(i, kOfRow(j, th))
      if (!c) continue
      const kb = `${c.bg}|${c.a ?? 1}`
      bgs.set(kb, (bgs.get(kb) ?? '') + `<use href="#${cellSym(c.bg, c.a ?? 1)}" x="${i * CELL}" y="${j * CELL}"/>`)
      const kf = `${c.fg}|${c.a ?? 1}`
      fgs.set(kf, (fgs.get(kf) ?? '') + glyphD(c.ch, i * CELL, j * CELL))
    }
  let body = ''
  for (const uses of bgs.values()) body += uses
  for (const [k, d] of fgs) { const [fg, a] = k.split('|'); body += strokeP(d, fg, +a) }
  defs.push(`<pattern id="${id}" width="${tw * CELL}" height="${th * CELL}" patternUnits="userSpaceOnUse">${body}</pattern>`)
  return `url(#${id})`
}
// Fondo de celda repetido (sin glifos) para no dibujar miles de rects
const plainCell = (id, c) => {
  defs.push(`<pattern id="${id}" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">${cellR(0, 0, c.bg, c.a)}</pattern>`)
  return `url(#${id})`
}
// Patrón de pared: fondo repetido + glifos en un tile grande
const glyphTile = (id, tw, th, c, seed) => {
  let d = ''
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) d += glyphD(glyphAt(i, j, seed), i * CELL, j * CELL)
  const bg = plainCell(id + 'c', c)
  defs.push(`<pattern id="${id}" width="${tw * CELL}" height="${th * CELL}" patternUnits="userSpaceOnUse"><rect width="${tw * CELL}" height="${th * CELL}" fill="${bg}"/>${strokeP(d, c.fg, c.a)}</pattern>`)
  return `url(#${id})`
}
const P_WALL = glyphTile('pw', 12, 8, CITY.wall, 101)
const P_ROOF = glyphTile('pr', 16, 1, CITY.roof, 102)
const P_FAR = glyphTile('pf', 12, 6, CITY.far, 103)

// Ventanas (near): columnas con (x - x0) impar, filas k par; encendida si hash(x, y, 21) < .45, con 3 tonos.
const TW = 32
const TH = 24
const yAbs = k => GROUND_REF - k
const litAt = (x, k) => hash(x % TW, yAbs(((k - 1) % TH) + 1), 21) < 0.45
const toneAt = (x, k) => { const s = hash(x % TW, yAbs(((k - 1) % TH) + 1), 23); return s < 0.6 ? 0 : s < 0.85 ? 1 : 2 }
const DARK = { ...solid(CITY.dark) }
const LIT = CITY.win.map(solid)
// La paridad 1 es la 0 corrida una columna (pattern href + patternTransform): un solo tile.
const shifted = (id, src) => {
  defs.push(`<pattern id="${id}" href="#${src}" patternTransform="translate(${CELL} 0)"/>`)
  return `url(#${id})`
}
const P_WIN = [
  cellPattern('pn0', TW, TH, (i, k) => {
    if (i % 2 !== 0 || k % 2 !== 0) return null
    const ch = glyphAt(i, k, 104)
    return litAt(i, k) ? { ...LIT[toneAt(i, k)], ch } : { ...DARK, ch }
  }),
  shifted('pn1', 'pn0'),
]
// Ventanas lejanas: (x - fx0) impar, k % 3 == 0, hash < .3
const FARWIN = solid(CITY.farWin)
const P_FWIN = [
  cellPattern('pfw0', TW, TH, (i, k) => (i % 2 === 0 && k % 3 === 0 && hash(i, yAbs(k), 25) < 0.3 ? { ...FARWIN, ch: glyphAt(i, k, 105) } : null)),
  shifted('pfw1', 'pfw0'),
]

// Celdas sueltas (ventanas que cambian, paseantes): símbolos por (color, glifo)
const symbols = new Map()
const sym = (c, ch) => {
  const id = `y${symbols.size.toString(36)}`
  const key = `${c.bg}|${c.fg}|${c.a ?? 1}|${ch}`
  if (!symbols.has(key)) symbols.set(key, { id, body: `<g id="${id}">${cellR(0, 0, c.bg, c.a ?? 1)}${strokeP(glyphD(ch, 0, 0), c.fg, c.a ?? 1)}</g>` })
  return symbols.get(key).id
}

// ---- edificios ----
// Altura mínima posible (ventanas de 560 px de alto, cualquier ancho): las ventanas que parpadean van por debajo.
const hMin = bd => { let m = 1e9; for (let cols = 50; cols <= MAXC; cols += 5) m = Math.min(m, hOf(bd, cols, 40)); return m }
const WIN_EPOCH = 7 / SPEED // s: una ventana se invierte por épocas de t/7
const WIN_LOOP = 12 // épocas por vuelta
let toggles = 0
const building = (bd, far) => {
  const X = bd.x0 * CELL
  const W = bd.w * CELL
  let s = `<g class="${far ? 'f' : 'n'}" style="${vars(bd)}">`
  s += `<rect class="s" x="${X}" width="${W}" fill="${BASE}"/>` // silueta: tapa la lluvia (y lo lejano)
  if (far) {
    s += `<rect class="s" x="${X}" width="${W}" fill="${P_FAR}"/>`
    s += `<rect class="s" x="${X + CELL}" width="${W - CELL}" fill="${P_FWIN[(bd.x0 + 1) % 2]}"/>`
    return s + '</g>'
  }
  s += `<rect class="rf" x="${X}" width="${W}" fill="${P_ROOF}"/><rect class="wa" x="${X}" width="${W}" fill="${P_WALL}"/>`
  if (bd.w > 2) s += `<rect class="wi" x="${X + CELL}" width="${W - 2 * CELL}" fill="${P_WIN[(bd.x0 + 1) % 2]}"/>`
  // ventanas que se prenden o apagan (el XOR de hash(.., 22 + época) < .08 del original), siempre dentro del edificio
  const top = hMin(bd) - 2
  for (let k = 2; k <= top; k += 2)
    for (let x = bd.x0 + 1; x < bd.x1; x += 2) {
      if (hash(x, k, 77) > 0.3) continue
      const tx = x - ((bd.x0 + 1) % 2) // columna en el tile del patrón (la paridad 1 está corrida una columna)
      const lit = litAt(tx, k)
      const id = sym(lit ? DARK : LIT[toneAt(tx, k)], glyphAt(x, k, 106))
      const phase = hash(x, k, 24) * WIN_LOOP * WIN_EPOCH
      s += `<use href="#${id}" x="${x * CELL}" y="${-k * CELL}" class="tg" style="animation-delay:-${phase.toFixed(1)}s"/>`
      toggles++
    }
  return s + '</g>'
}
css.push(
  `.s{y:calc(-1*var(--h));height:var(--h)}.rf{y:calc(-1*var(--h));height:14px}`,
  `.wa{y:calc(14px - var(--h));height:max(0px,var(--h) - 14px)}.wi{y:calc(28px - var(--h));height:max(0px,var(--h) - 28px)}`,
  `.tg{opacity:0;animation:tg ${(WIN_LOOP * WIN_EPOCH).toFixed(1)}s steps(1,end) infinite}@keyframes tg{0%{opacity:1}${(100 / WIN_LOOP).toFixed(3)}%{opacity:0}}`,
)
const farSvg = FAR.map(bd => building(bd, true)).join('')
const nearSvg = NEAR.map(bd => building(bd, false)).join('')

// ---- balizas rojas: '*' sobre el techo, en la columna del medio; alfa .95 si sin(t*2.5 + b) > .3 ----
const BK_PERIOD = (2 * Math.PI) / (2.5 * SPEED)
let beaconSvg = ''
for (const bd of NEAR) {
  if (hash(bd.b, 31) >= 0.35) continue
  const x = Math.floor((bd.x0 + bd.x1) / 2) * CELL
  // encendida desde que 2.5*SPEED*t + b pasa por asin(.3)
  const on = ((((Math.asin(0.3) - bd.b) / (2.5 * SPEED)) % BK_PERIOD) + BK_PERIOD) % BK_PERIOD
  beaconSvg += `<g class="n bk" style="${vars(bd)}"><path class="bl" style="animation-delay:-${(BK_PERIOD - on).toFixed(2)}s" d="${glyphD('*', x, 0)}"/></g>`
}
const bkOn = (Math.PI - 2 * Math.asin(0.3)) / (2 * Math.PI)
css.push(
  `.bk{transform:translateY(calc(-14px - var(--h)))}`,
  `.bl{fill:none;stroke:#ff4d5e;stroke-width:1.3;stroke-linecap:round;opacity:.2;animation:bl ${BK_PERIOD.toFixed(4)}s steps(1,end) infinite}`,
  `@keyframes bl{0%{opacity:.95}${(bkOn * 100).toFixed(2)}%{opacity:.2}}`,
)

// ---- lluvia (rain): '/' por celda, alfa .28 (q%3==0) y .6 (q%3==1), pista floor(x + .3y), 11 celdas/s x speed ----
// Se dibuja en un patrón inclinado (skewX: x = u - .3y) que se repite cada 30 filas y 9 columnas a la izquierda,
// y se mueve a saltos de una fila (14 px abajo, 4,2 px a la izquierda) 22 veces por segundo, como el canvas.
const RAIN_K = 0.3
const RAIN_V = 11 * SPEED
const RP = 30 // filas por vuelta (múltiplo de 10: .3*30 = 9 columnas exactas)
const RW = 40 // pistas por tile
const rainD = ['', '']
for (let T = 0; T < RW; T++)
  for (let n = 0; n < RP / 3; n++) {
    if (hash(T, n, 27) >= 0.09) continue
    for (const m of [0, 1]) {
      const y = 3 * n + m
      const x = Math.ceil(T - RAIN_K * y)
      rainD[m] += glyphD('/', x * CELL, y * CELL, (px, py) => [px + RAIN_K * py, py])
    }
  }
const SKEW = (Math.atan(-RAIN_K) * 180) / Math.PI
// copias corridas un tile en cada dirección, para que las gotas de los bordes no se corten
const rainCopies = [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => (i || j ? `<use href="#rd" x="${i * RW * CELL}" y="${j * RP * CELL}"/>` : ''))).join('')
defs.push(
  `<pattern id="rn" width="${RW * CELL}" height="${RP * CELL}" patternUnits="userSpaceOnUse" patternTransform="skewX(${SKEW.toFixed(4)})">` +
    `<g id="rd">${strokeP(rainD[0], '#a9c4f0', 0.28, 1.3)}${strokeP(rainD[1], '#a9c4f0', 0.6, 1.3)}</g>${rainCopies}</pattern>`,
  `<clipPath id="sky"><rect x="0" y="-4600" width="4600" height="4600"/></clipPath>`,
)
const rainSvg = `<g clip-path="url(#sky)"><g class="rn"><rect x="0" y="${-4600 - RP * CELL}" width="${4600 + RP * CELL}" height="${4600 + RP * CELL}" fill="url(#rn)"/></g></g>`
css.push(`.rn{animation:rn ${(RP / RAIN_V).toFixed(4)}s steps(${RP},end) infinite}@keyframes rn{to{transform:translate(${-RAIN_K * RP * CELL}px,${RP * CELL}px)}}`)

// ---- calle: '_' fijo; charcos 'o' (hash(x,y,40+floor(3t)) < .025) y reflejos '|'/'~' (hash(x, floor(1.5t)+y, 41) < .12) ----
const SMEAR = ['#ff5fa2', '#4fe3ff', '#f3c56b']
defs.push(`<pattern id="pu" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">${strokeP(glyphD('_', 0, 0), '#3a4570', 0.55)}</pattern>`)
let streetSvg = `<rect x="0" y="0" width="4600" height="${CELL}" fill="url(#pu)"/>`
const slot = (name, n, period, k, body) => `<g class="${name}" style="animation-delay:-${(((n - k) % n) * (period / n)).toFixed(3)}s">${body}</g>`
const O_N = 16 // épocas de 'o' por vuelta: 3*SPEED por segundo
const O_T = O_N / (3 * SPEED)
for (let e = 0; e < O_N; e++) {
  let d = ''
  for (let x = 0; x < MAXC; x++) for (const y of [1, 2]) if (hash(x, y, 40 + e) < 0.025) d += glyphD('o', x * CELL, y * CELL)
  streetSvg += slot('so', O_N, O_T, e, strokeP(d, '#a9c4f0', 0.5, 1.2))
}
const S_N = 8 // épocas de reflejos por vuelta: 1.5*SPEED por segundo
const S_T = S_N / (1.5 * SPEED)
for (let key = 0; key < S_N; key++)
  for (const y of [1, 2]) {
    const d = ['', '', '']
    for (let x = 0; x < MAXC; x++) if (hash(x, key + 1000, 41) < 0.12) d[Math.floor(hash(x, 42) * 3)] += glyphD(y === 1 ? '|' : '~', x * CELL, y * CELL)
    // la fila y muestra la clave n + y en la época n
    streetSvg += slot('ss', S_N, S_T, (key - y + S_N) % S_N, d.map((dd, i) => strokeP(dd, SMEAR[i], 0.28)).join(''))
  }
css.push(
  `.so{opacity:0;animation:sl ${O_T.toFixed(4)}s steps(1,end) infinite}@keyframes sl{0%{opacity:1}${(100 / O_N).toFixed(3)}%{opacity:0}}`,
  `.ss{opacity:0;animation:ss ${S_T.toFixed(4)}s steps(1,end) infinite}@keyframes ss{0%{opacity:1}${(100 / S_N).toFixed(3)}%{opacity:0}}`,
)

// ---- carteles RAMEN y HOTEL: tubo de neón, letras con fondo, parpadeo de letra y bajón cada 9 s de escena ----
const neon = (word, c) => {
  const art = sketch(3, word.length + 2, [[0, 0, '+-+'], ...[...word].map((ch, i) => [i + 1, 0, `|${ch}|`]), [word.length + 1, 0, '+-+']])
  return { c, word, art }
}
const SIGNS = [neon('RAMEN', '#ff5fa2'), neon('HOTEL', '#4fe3ff')]
const txt = (x, y, ch, fill, a) => `<text x="${x + 7}" y="${y + 8}" fill="${fill}"${a < 1 ? ` fill-opacity="${a}"` : ''}>${ch}</text>`
// edificio elegido por el original (el más alto del tramo) según el ancho de la ventana -> variantes con @media
const pick = (i, cols) => {
  const W = cols
  let best
  for (const bd of NEAR) {
    for (let x = Math.max(bd.x0, Math.floor(i ? W * 0.7 : 0)); x <= bd.x1 && x < (i ? cols : W * 0.3); x++)
      if (!best || hOf(bd, cols, ROWS_REF) > hOf(best, cols, ROWS_REF)) best = bd
  }
  return best
}
const SIGN_T = 9 / SPEED // el cartel baja a .3 durante .3 de escena cada 9
const LET_N = 36 // vueltas de 1/(4*SPEED) s en 4,5 s
let signSvg = ''
SIGNS.forEach((s, i) => {
  const ranges = new Map()
  for (let cols = 20; cols <= MAXC; cols++) {
    const bd = pick(i, cols)
    if (!bd) continue
    const r = ranges.get(bd) ?? []
    if (r.length && r[r.length - 1][1] === cols - 1) r[r.length - 1][1] = cols
    else r.push([cols, cols])
    ranges.set(bd, r)
  }
  // un solo cartel; cada tramo de anchos le da, con @media, el edificio (--c, --r) y la columna (--sx)
  const cls = `g${i}`
  css.push(`.${cls}{display:none}`)
  for (const [bd, r] of ranges) {
    const media = r.map(([a, b]) => `(min-width:${(a - 1) * CELL + 0.01}px) and (max-width:${b * CELL}px)`).join(',')
    css.push(`@media ${media}{.${cls}{display:inline;${vars(bd)};--sx:${(i ? bd.x0 - 2 : bd.x1) * CELL}px}}`)
  }
  {
    const sx = 0
    let body = `<circle cx="${sx + 1.5 * CELL}" cy="${3.5 * CELL}" r="${6 * CELL}" fill="url(#sg${i})"/>`
    s.art.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === '.') return
        const px = sx + rx * CELL
        const py = ry * CELL
        if ('+-|'.includes(ch)) body += txt(px, py, ch, s.c, 0.9)
        else body += cellR(px, py, '#1c0b1a', 0.95) + txt(px, py, ch, s.c, 0.95)
      }),
    )
    // letra que cae a minúscula: hash(k, i, 51) < .1 elige una letra (hash(k, i, 52)) en la vuelta k
    s.word.split('').forEach((ch, li) => {
      const on = []
      for (let k = 0; k < LET_N; k++) if (hash(k, i, 51) < 0.1 && Math.floor(hash(k, i, 52) * s.word.length) === li) on.push(k)
      if (!on.length) return
      const name = `lf${i}${li}`
      if (!css.some(c => c.startsWith(`@keyframes ${name}{`))) {
        const st = on.map(k => `${((k / LET_N) * 100).toFixed(3)}%{opacity:1}${(((k + 1) / LET_N) * 100).toFixed(3)}%{opacity:0}`).join('')
        css.push(`@keyframes ${name}{0%{opacity:0}${st}}`)
      }
      const px = sx + CELL
      const py = (li + 1) * CELL
      body += `<g style="opacity:0;animation:${name} ${SIGN_T}s steps(1,end) infinite">${cellR(px, py, '#1c0b1a', 1)}${txt(px, py, ch.toLowerCase(), shade(s.c, -0.55), 0.9)}</g>`
    })
    signSvg += `<g class="n sg ${cls}"><g class="z${i}">${body}</g></g>`
  }
  defs.push(`<radialGradient id="sg${i}"><stop offset="0" stop-color="${s.c}" stop-opacity=".35"/><stop offset="1" stop-color="${s.c}" stop-opacity="0"/></radialGradient>`)
})
css.push(
  `.sg{transform:translate(var(--sx),calc(28px - var(--h)))}`,
  `.z0,.z1{animation:zz ${SIGN_T}s steps(1,end) infinite}.z1{animation-delay:-${((SIGN_T - (4.5 / SPEED)) % SIGN_T).toFixed(2)}s}`,
  `@keyframes zz{0%{opacity:.3}${((0.3 / 9) * 100).toFixed(3)}%{opacity:1}}`,
)

// ---- paseantes con paraguas (drift + frame del original, modo smooth) ----
const WALK = [
  ['..uUu..', '.uUUUu.', 'uUUUUUu', 'd..|..d', '...h...', '..cCc..', '..cCc..', '..l.l..'],
  ['..uUu..', '.uUUUu.', 'uUUUUUu', '...|...', 'd..h..d', '..cCc..', '..cCc..', '...l...'],
]
const walkPal = c => ({
  U: { bg: c, fg: shade(c, -0.6), a: 0.95 }, u: { bg: shade(c, -0.25), fg: shade(c, -0.7), a: 0.95 },
  h: { bg: '#3a3550', fg: '#1a1828', a: 0.95 }, c: { bg: '#252a42', fg: '#121526', a: 0.95 },
  C: { bg: '#2f3554', fg: '#151a2e', a: 0.95 }, l: { bg: '#1c2034', fg: '#0c0e18', a: 0.95 },
})
const WALKERS = [[0.97, 1.5, false, walkPal('#ff5fa2')], [0.98, 1.1, true, walkPal('#f2c14e')]]
const walkCells = (rows, pal, key) => {
  let s = ''
  const loose = { d: ['', '#bcd2f5', 0.6, '.'], p: ['', '#8a92b0', 0.9, '|'] }
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === '.') return
      if (ch === 'd') loose.d[0] += glyphD('.', rx * CELL, ry * CELL)
      else if (ch === '|') loose.p[0] += glyphD('|', rx * CELL, ry * CELL)
      else s += `<use href="#${sym(pal[ch], glyphAt(rx + key * 997, ry, 107))}" x="${rx * CELL}" y="${ry * CELL}"/>`
    }),
  )
  return s + Object.values(loose).map(([d, fg, a]) => strokeP(d, fg, a)).join('')
}
let walkerSvg = ''
WALKERS.forEach(([f, v, left, pal], i) => {
  const same = WALK[0].map((r, ry) => (r === WALK[1][ry] ? r : '.'.repeat(r.length)))
  const only = k => WALK[k].map((r, ry) => (r === WALK[1 - k][ry] ? '.'.repeat(r.length) : r))
  // frame(WALK, t, 3, i): cuadro floor(3t + i) % 2, con t = SPEED * segundos
  const half = 1 / (3 * SPEED)
  walkerSvg +=
    `<g class="wk wk${i}"><g transform="translate(0 ${-8 * CELL})">${walkCells(same, pal, 90 + i)}` +
    `<g class="wf" style="animation-delay:-${(i * half).toFixed(4)}s">${walkCells(only(0), pal, 90 + i)}</g>` +
    `<g class="wf" style="animation-delay:-${((i + 1) * half).toFixed(4)}s">${walkCells(only(1), pal, 90 + i)}</g></g></g>`
  // drift(cols, f, t, v, 7): run = ((f*span + t*v) % span) - 7, span = cols + 14; x = (run - 3.5) celdas (o cols - run - 3.5)
  const dur = `calc((tan(atan2(var(--C),14px)) + 14)/${v * SPEED}*1s)`
  const from = left ? 'calc(var(--C) + 49px)' : '-147px'
  const to = left ? '-147px' : 'calc(var(--C) + 49px)'
  css.push(
    `.wk${i}{animation:wk${i} linear infinite;animation-duration:${dur};animation-delay:calc(-${f}*${dur.slice(5, -1)})}`,
    `@keyframes wk${i}{from{transform:translateX(${from})}to{transform:translateX(${to})}}`,
  )
  void half
})
css.push(`.wf{opacity:0;animation:wf ${(2 / (3 * SPEED)).toFixed(4)}s steps(1,end) infinite}@keyframes wf{0%{opacity:1}50%{opacity:0}}`)

// ---- rayo: cada 23 de escena (11,5 s), visible p < .1 y .2 < p < .32, con resplandor r = 16 celdas ----
const STORM = 23 / SPEED
const BOLTS = 4
const boltArt = k => {
  const out = []
  for (let y = 0, c = 4; y < 12; y++) {
    const s = Math.floor(hash(k, y, 61) * 3) - 1
    c = Math.max(0, Math.min(8, c + s))
    out.push('.'.repeat(c) + (s < 0 ? '/' : s > 0 ? '\\' : '|') + '.'.repeat(8 - c))
  }
  return out
}
defs.push(`<radialGradient id="bg"><stop offset="0" stop-color="#a9bcff" stop-opacity=".45"/><stop offset="1" stop-color="#a9bcff" stop-opacity="0"/></radialGradient>`)
let boltSvg = ''
for (let k = 0; k < BOLTS; k++) {
  const fx = hash(k, 62) < 0.5 ? 0.06 + 0.14 * hash(k, 63) : 0.78 + 0.14 * hash(k, 63)
  let d = ''
  boltArt(k).forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') d += glyphD(ch, rx * CELL, ry * CELL) }))
  const delay = (BOLTS * STORM - k * STORM) % (BOLTS * STORM)
  boltSvg +=
    `<g style="transform:translate(calc(var(--C)*${fx.toFixed(4)}),calc(var(--R)*.03))">` +
    `<g class="bo" style="animation-delay:-${delay.toFixed(2)}s"><circle cx="${4.5 * CELL}" cy="${6 * CELL}" r="${16 * CELL}" fill="url(#bg)"/>${strokeP(d, '#eef3ff', 1)}</g></g>`
}
const pc = s => ((s / SPEED / (BOLTS * STORM)) * 100).toFixed(4)
css.push(`.bo{opacity:0;animation:bo ${(BOLTS * STORM).toFixed(1)}s steps(1,end) infinite}@keyframes bo{0%{opacity:1}${pc(0.1)}%{opacity:0}${pc(0.2)}%{opacity:1}${pc(0.32)}%{opacity:0}}`)

// ---- grilla tenue (rgba(160,180,255,.05), líneas en x*14+.5) ----
defs.push(`<pattern id="gd" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><path d="M0 .5H${CELL}M.5 0V${CELL}" stroke="#a0b4ff" stroke-opacity=".05"/></pattern>`)

css.push(
  `.city{transform:translateY(calc(var(--R) - 42px))}`,
  `text{font:bold 8px Consolas,'Cascadia Code',monospace;text-anchor:middle;dominant-baseline:central}`,
)

const svgDin =
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
  `<style>${css.join('')}</style>` +
  `<defs>${defs.join('')}${[...symbols.values()].map(s => s.body).join('')}</defs>` +
  `<rect width="100%" height="100%" fill="${BASE}"/>` +
  `<g class="city">${rainSvg}${farSvg}${nearSvg}${beaconSvg}${streetSvg}</g>` +
  `<rect width="100%" height="100%" fill="url(#gd)"/>` +
  boltSvg +
  `<g class="city">${signSvg}${walkerSvg}</g>` +
  `</svg>`

// Desktop no anima una escena cuyo CSS calcula con round()/tan(atan2())/pow() y @media según la ventana:
// se congela la ciudad para una ventana de 1400x1050 (alturas precalculadas) y se fija el tamaño con viewBox.
const VW = 1400, VH = 1050
const cssDin = css.join('')
const altura = (c, r, lo, hi, pw) => Math.max(14, Math.round((VH * (lo + hi * Math.min(1, Math.abs((2 * c) / VW - 1)) ** pw * r)) / 14) * 14)
let svg = svgDin.replace(/class="([^"]*)" style="--c:([\d.]+)px;--r:([\d.]+)"/g, (m, cls, c, r) =>
  `class="${cls}" style="--h:${cls === 'f' ? altura(+c, +r, 0.16, 0.48, 1.4) : altura(+c, +r, 0.08, 0.52, 2)}px"`)
let extra = ''
for (const g of ['g0', 'g1']) {
  const b = [...cssDin.matchAll(/@media \(min-width:([\d.]+)px\) and \(max-width:([\d.]+)px\)\{\.(g[01])\{display:inline;--c:([\d.]+)px;--r:([\d.]+);--sx:([\d.]+)px\}\}/g)]
    .find(m => m[3] === g && +m[1] <= VW && VW <= +m[2])
  if (b) extra += `.${g}{display:inline;--h:${altura(+b[4], +b[5], 0.08, 0.52, 2)}px;--sx:${b[6]}px}`
}
const cssFija = cssDin
  .replace('round(up,100vw,14px)', `${VW}px`).replace('round(up,100vh,14px)', `${VH}px`)
  .replace(/animation-duration:calc\([^;]*;animation-delay:calc\([^;}]*/g, 'animation-duration:12s;animation-delay:-5s')
  .replace(/@media[^{]+\{[^}]*\{[^}]*\}\}/g, '')
  .replace(/\.n\{[^}]*\}\.f\{[^}]*\}/, '') + extra
svg = svg.replace(cssDin, cssFija).replace('width="100%" height="100%"', `width="100%" height="100%" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMax slice"`)
if (/--c:|@media/.test(svg)) throw new Error('quedaron cálculos dinámicos en la escena')

const sizes = { css: css.join('').length, defs: defs.join('').length, sym: [...symbols.values()].map(s => s.body).join('').length, rain: rainSvg.length, far: farSvg.length, near: nearSvg.length, beacon: beaconSvg.length, street: streetSvg.length, bolt: boltSvg.length, sign: signSvg.length, walker: walkerSvg.length }
if (process.env.SIZES) console.log(sizes, defs.map(d => [d.slice(0, 24), d.length]).filter(d => d[1] > 2000))
if (svg.length > 131072) throw new Error('escena demasiado grande: ' + svg.length)
const out =
  `// GENERATED by tools/gen-scene.mjs. Do not edit by hand.\n` +
  `// Port of the Neon Rain scene from 0toshigami/claude-desktop-themes (MIT): cell 14, speed 2, smooth motion.\n` +
  `export const NEON_RAIN_SCENE: string = ${JSON.stringify(svg)}\n` +
  `export const NEON_RAIN_ALT = 'A night city in ASCII cells under neon rain, with neon signs and people with umbrellas'\n`
fs.writeFileSync(path.join(here, '..', 'hooks', 'scene.ts'), out)
if (process.argv[2]) fs.writeFileSync(process.argv[2], svg)
console.log('ok', svg.length, 'toggles', toggles, 'symbols', symbols.size, 'near', NEAR.length, 'far', FAR.length)
