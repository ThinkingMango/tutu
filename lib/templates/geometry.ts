import type { Detail, Region } from '@/lib/mandalas'

/**
 * Drawing helpers for hand-composed pages. Shapes are authored around the page center (0, 0),
 * with negative y pointing up, and only become page coordinates when they are placed.
 */

export type Pt = readonly [number, number]
type Curve = readonly [Pt, Pt, Pt]
type Step = Pt | Curve
export type Shape = Readonly<{ start: Pt; curves: readonly Curve[]; closed: boolean }>

const PAGE_CENTER = 500
const KAPPA = 0.5523

const isCurve = (step: Step): step is Curve => Array.isArray(step[0])
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const deg = (d: number) => (d * Math.PI) / 180

/** A path made of straight lines (a point) and cubic curves (three points), in order. */
export function outline(start: Pt, steps: Step[], closed = true): Shape {
  let cursor = start
  const curves = steps.map((step) => {
    const curve: Curve = isCurve(step) ? step : [lerp(cursor, step, 1 / 3), lerp(cursor, step, 2 / 3), step]
    cursor = curve[2]
    return curve
  })
  if (closed && (cursor[0] !== start[0] || cursor[1] !== start[1])) {
    curves.push([lerp(cursor, start, 1 / 3), lerp(cursor, start, 2 / 3), start])
  }
  return { start, curves, closed }
}

/** A smooth closed outline passing through every point (Catmull-Rom). */
export function smoothLoop(points: Pt[]): Shape {
  const n = points.length
  const at = (i: number) => points[(i + n) % n]
  const curves: Curve[] = points.map((_, i) => {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    return [
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2,
    ]
  })
  return { start: points[0], curves, closed: true }
}

/** A smooth open line through every point, for drawn details like smiles. */
export function smoothLine(points: Pt[]): Shape {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]
  const curves: Curve[] = points.slice(1).map((_, index) => {
    const i = index
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    return [
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2,
    ]
  })
  return { start: points[0], curves, closed: false }
}

/** Cubic pieces along an axis-aligned ellipse, from parameter t0 to t1 (radians). */
export function ellipseArc(cx: number, cy: number, rx: number, ry: number, t0: number, t1: number): Curve[] {
  const pieces = Math.max(1, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 2)))
  const step = (t1 - t0) / pieces
  const k = (4 / 3) * Math.tan(step / 4)
  const point = (t: number): Pt => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]
  const tangent = (t: number): Pt => [-rx * Math.sin(t), ry * Math.cos(t)]
  return Array.from({ length: pieces }, (_, i) => {
    const a = t0 + step * i
    const b = a + step
    const [pa, pb, ta, tb] = [point(a), point(b), tangent(a), tangent(b)]
    return [
      [pa[0] + k * ta[0], pa[1] + k * ta[1]],
      [pb[0] - k * tb[0], pb[1] - k * tb[1]],
      pb,
    ] as Curve
  })
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx): Shape {
  const k = KAPPA
  return {
    start: [cx + rx, cy],
    curves: [
      [[cx + rx, cy + k * ry], [cx + k * rx, cy + ry], [cx, cy + ry]],
      [[cx - k * rx, cy + ry], [cx - rx, cy + k * ry], [cx - rx, cy]],
      [[cx - rx, cy - k * ry], [cx - k * rx, cy - ry], [cx, cy - ry]],
      [[cx + k * rx, cy - ry], [cx + rx, cy - k * ry], [cx + rx, cy]],
    ],
    closed: true,
  }
}

/** A polygon whose corners are softened so there are no sharp points for small fingers. */
export function roundedPolygon(points: Pt[], radius: number): Shape {
  const n = points.length
  const corner = (i: number) => {
    const p = points[i]
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const toward = (q: Pt) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      return lerp(p, q, Math.min(0.45, radius / len))
    }
    return { p, a: toward(prev), b: toward(next) }
  }
  const corners = points.map((_, i) => corner(i))
  const steps: Step[] = []
  corners.forEach((c, i) => {
    const next = corners[(i + 1) % n]
    steps.push(next.a)
    steps.push([lerp(next.a, next.p, 0.55), lerp(next.b, next.p, 0.55), next.b])
  })
  return outline(corners[0].b, steps)
}

/** A rounded stick from a to b, like a crab leg. */
export function capsule(a: Pt, b: Pt, width: number): Shape {
  const r = width / 2
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  const n: Pt = [-Math.sin(angle) * r, Math.cos(angle) * r]
  const up = angle + Math.PI / 2
  return outline([a[0] + n[0], a[1] + n[1]], [
    [b[0] + n[0], b[1] + n[1]],
    ...ellipseArc(b[0], b[1], r, r, up, up - Math.PI),
    [a[0] - n[0], a[1] - n[1]],
    ...ellipseArc(a[0], a[1], r, r, up - Math.PI, up - 2 * Math.PI),
  ])
}

export function mapShape(shape: Shape, fn: (p: Pt) => Pt): Shape {
  return {
    start: fn(shape.start),
    curves: shape.curves.map((c) => [fn(c[0]), fn(c[1]), fn(c[2])] as Curve),
    closed: shape.closed,
  }
}

export const mirror = (shape: Shape) => mapShape(shape, ([x, y]) => [-x, y])
export const shift = (shape: Shape, dx: number, dy: number) => mapShape(shape, ([x, y]) => [x + dx, y + dy])
export const scale = (shape: Shape, s: number) => mapShape(shape, ([x, y]) => [x * s, y * s])

/** Turns a shape clockwise by `degrees` around the page center. */
export function turn(shape: Shape, degrees: number): Shape {
  const cos = Math.cos(deg(degrees))
  const sin = Math.sin(deg(degrees))
  return mapShape(shape, ([x, y]) => [x * cos - y * sin, x * sin + y * cos])
}

/** Aims a shape drawn pointing right (+x) in the given direction, then moves it to `origin`. */
export function aim(shape: Shape, origin: Pt, degrees: number): Shape {
  return shift(turn(shape, degrees), origin[0], origin[1])
}

/**
 * Wraps a shape drawn along a straight line onto a circle of `radius`, so a whale drawn
 * horizontally swims around the page. Local x runs clockwise along the circle; local y is
 * distance inward (negative is outward), starting at the clockwise angle `degrees` from the top.
 */
export function bend(shape: Shape, radius: number, degrees: number): Shape {
  return mapShape(shape, ([x, y]) => {
    const theta = deg(degrees) + x / radius
    const rho = radius - y
    return [rho * Math.sin(theta), -rho * Math.cos(theta)]
  })
}

const fmt = (n: number) => Math.round(n * 10) / 10

export function toPath(shape: Shape): string {
  const toPage = ([x, y]: Pt) => `${fmt(x + PAGE_CENTER)} ${fmt(y + PAGE_CENTER)}`
  const curves = shape.curves.map((c) => `C ${c.map(toPage).join(' ')}`).join(' ')
  return `M ${toPage(shape.start)} ${curves}${shape.closed ? ' Z' : ''}`
}

export const region = (id: string, label: string, shape: Shape): Region => ({ id, label, d: toPath(shape) })
/** A solid ink spot, such as an eye. Details are drawn on top and can't be colored. */
export const dot = (shape: Shape): Detail => ({ kind: 'dot', d: toPath(shape) })
/** An ink line, such as a smile. */
export const line = (shape: Shape): Detail => ({ kind: 'line', d: toPath(shape) })
