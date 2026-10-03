import type { Detail, Drawing, Region } from '@/lib/mandalas'
import {
  aim,
  bend,
  capsule,
  dot,
  ellipse,
  ellipseArc,
  line,
  mirror,
  outline,
  region,
  roundedPolygon,
  scale,
  shift,
  smoothLine,
  smoothLoop,
  turn,
  type Pt,
  type Shape,
} from '@/lib/templates/geometry'

const rad = (d: number) => (d * Math.PI) / 180
const around = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => offset + (360 / count) * i)

function page(build: (add: (id: string, label: string, shape: Shape) => void, details: Detail[]) => void): Drawing {
  const regions: Region[] = []
  const details: Detail[] = []
  build((id, label, shape) => regions.push(region(id, label, shape)), details)
  return { regions, details }
}

/** Six fish swim nose-in like petals, with bubbles between them. */
const fishFlower = page((add, details) => {
  const body = smoothLoop([
    [0, -135], [52, -160], [80, -212], [72, -272], [42, -332], [16, -368],
    [-16, -368], [-42, -332], [-72, -272], [-80, -212], [-52, -160],
  ])
  const tail = roundedPolygon([[-18, -350], [18, -350], [78, -455], [0, -420], [-78, -455]], 14)
  const eye = ellipse(36, -198, 13)

  around(6).forEach((angle, i) => {
    add(`fish${i}-tail`, `第 ${i + 1} 条鱼的尾巴`, turn(tail, angle))
    add(`fish${i}`, `第 ${i + 1} 条鱼`, turn(body, angle))
    details.push(dot(turn(eye, angle)))
  })
  around(6, 30).forEach((angle, i) => add(`bubble${i}`, `泡泡 ${i + 1}`, turn(ellipse(0, -300, 44), angle)))
  add('center', '中间的泡泡', ellipse(0, 0, 105))
})

/** A turtle seen from above whose shell is a six-petal flower. */
const turtleFlower = page((add, details) => {
  const cy = 20
  const [rx, ry] = [245, 270]
  const shellT = (phi: number) => {
    let t = Math.atan2(rx * Math.sin(rad(phi)), ry * Math.cos(rad(phi)))
    while (t < rad(phi) - Math.PI) t += 2 * Math.PI
    while (t > rad(phi) + Math.PI) t -= 2 * Math.PI
    return t
  }
  const edge = (phi: number, reach = 1): Pt => {
    const t = shellT(phi)
    return [rx * Math.cos(t) * reach, cy + ry * Math.sin(t) * reach]
  }
  const hex = (k: number): Pt => [105 * Math.cos(rad(-90 + 60 * k)), cy + 105 * Math.sin(rad(-90 + 60 * k))]

  const flipper = smoothLoop([[-10, -40], [80, -58], [175, -42], [225, -8], [200, 18], [110, 30], [20, 38], [-10, 20]])
  const front = aim(flipper, edge(-40, 0.8), -28)
  const back = aim(scale(flipper, 0.7), edge(45, 0.8), 40)
  add('flipper-front-left', '左前鳍', mirror(front))
  add('flipper-front-right', '右前鳍', front)
  add('flipper-back-left', '左后鳍', mirror(back))
  add('flipper-back-right', '右后鳍', back)
  add('tail', '海龟尾巴', roundedPolygon([[-42, 255], [42, 255], [0, 370]], 16))
  add('head', '海龟头', ellipse(0, -330, 82, 95))

  for (let k = 0; k < 6; k++) {
    const [phi0, phi1] = [-90 + 60 * k, -30 + 60 * k]
    add(
      `shell${k}`,
      `龟壳花纹 ${k + 1}`,
      outline(hex(k), [hex(k + 1), edge(phi1), ...ellipseArc(0, cy, rx, ry, shellT(phi1), shellT(phi0))]),
    )
  }
  add('center', '龟壳中心', outline(hex(0), [hex(1), hex(2), hex(3), hex(4), hex(5)]))

  details.push(dot(ellipse(-34, -352, 13)), dot(ellipse(34, -352, 13)))
  details.push(line(smoothLine([[-26, -302], [0, -290], [26, -302]])))
})

/** Five striped scallop shells open around a pearl. */
const shellBloom = page((add) => {
  const apex: Pt = [0, -178]
  const R = 250
  const at = (a: number, r = R): Pt => [apex[0] + r * Math.sin(rad(a)), apex[1] - r * Math.cos(rad(a))]
  const stripe = (a0: number, a1: number) => {
    const d = (a1 - a0) * 0.12
    return outline(apex, [at(a0), [at(a0 + d, R + 44), at(a1 - d, R + 44), at(a1)]])
  }
  const hinge = roundedPolygon([[-74, -178], [74, -178], [36, -115], [-36, -115]], 14)
  const edges = [-48, -16, 16, 48]

  around(5).forEach((angle, i) => {
    add(`shell${i}-hinge`, `第 ${i + 1} 个贝壳的壳根`, turn(hinge, angle))
    for (let j = 0; j < 3; j++) {
      add(`shell${i}-stripe${j}`, `第 ${i + 1} 个贝壳的条纹 ${j + 1}`, turn(stripe(edges[j], edges[j + 1]), angle))
    }
  })
  add('center', '珍珠', ellipse(0, 0, 82))
})

/** A smiling starfish inside a ring of curling waves. */
const starfishWaves = page((add, details) => {
  const inner = 118
  const corner = (a: number): Pt => [inner * Math.sin(rad(a)), -inner * Math.cos(rad(a))]
  const [right, left] = [corner(36), corner(-36)]
  const arm = outline(right, [
    [[72, -160], [56, -230], [48, -280]],
    ...ellipseArc(0, -280, 48, 48, 0, -Math.PI),
    [[-56, -230], [-72, -160], left],
  ])
  const wave = outline([-92, -352], [
    [[-62, -372], [-36, -458], [20, -458]],
    [[60, -458], [88, -440], [80, -414]],
    [[74, -398], [52, -398], [42, -412]],
    [[28, -400], [30, -362], [92, -352]],
  ])

  around(10).forEach((angle, i) => add(`wave${i}`, `波浪 ${i + 1}`, turn(wave, angle)))
  around(5).forEach((angle, i) => add(`arm${i}`, `海星触手 ${i + 1}`, turn(arm, angle)))
  add('center', '海星中心', outline(corner(36), around(5, 36 + 72).map(corner)))

  details.push(dot(ellipse(-32, -20, 12)), dot(ellipse(32, -20, 12)))
  details.push(line(smoothLine([[-30, 16], [0, 34], [30, 16]])))
})

/** An octopus seen from above, giving the page a hug with eight wavy arms. */
const octopusHug = page((add, details) => {
  const steps = 12
  const spine = (t: number): Pt => [34 * Math.sin(1.7 * Math.PI * t) * Math.pow(t, 0.7), -(110 + 330 * t)]
  const width = (t: number) => 42 - 24 * t
  const right: Pt[] = []
  const left: Pt[] = []
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const [a, b] = [spine(Math.max(0, t - 0.01)), spine(Math.min(1, t + 0.01))]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n: Pt = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
    const c = spine(t)
    right.push([c[0] + n[0] * width(t), c[1] + n[1] * width(t)])
    left.push([c[0] - n[0] * width(t), c[1] - n[1] * width(t)])
  }
  const end = spine(1)
  const beyond = spine(0.99)
  const len = Math.hypot(end[0] - beyond[0], end[1] - beyond[1])
  const tip: Pt = [end[0] + ((end[0] - beyond[0]) / len) * width(1), end[1] + ((end[1] - beyond[1]) / len) * width(1)]
  const tentacle = smoothLoop([...right, tip, ...left.reverse()])

  around(8, 22.5).forEach((angle, i) => add(`arm${i}`, `章鱼触手 ${i + 1}`, turn(tentacle, angle)))
  add('center', '章鱼头', ellipse(0, 0, 150))

  details.push(dot(ellipse(-50, -28, 18)), dot(ellipse(50, -28, 18)))
  details.push(line(smoothLine([[-46, 34], [0, 62], [46, 34]])))
})

/** A round puffer fish whose spikes open like petals. */
const pufferBloom = page((add, details) => {
  const bx = -10
  const spike = roundedPolygon([[-40, -200], [40, -200], [0, -330]], 12)
  around(12)
    .filter((angle) => angle !== 90)
    .forEach((angle, i) => add(`spike${i}`, `刺 ${i + 1}`, shift(turn(spike, angle), bx, 0)))
  add(
    'tail',
    '河豚尾巴',
    roundedPolygon([[bx + 190, -40], [bx + 190, 40], [bx + 340, 125], [bx + 300, 0], [bx + 340, -125]], 18),
  )
  add('center', '河豚', ellipse(bx, 0, 225))
  const [from, to] = [rad(155), rad(25)]
  add(
    'belly',
    '河豚肚子',
    outline([bx + 225 * Math.cos(from), 225 * Math.sin(from)], [
      [[bx - 110, 40], [bx + 110, 40], [bx + 225 * Math.cos(to), 225 * Math.sin(to)]],
      ...ellipseArc(bx, 0, 225, 225, to, from),
    ]),
  )

  details.push(dot(ellipse(bx - 95, -55, 22)))
  details.push(line(ellipse(bx - 195, 25, 14)))
})

/** Four whales swim one behind the other around a big bubble. */
const whaleCircle = page((add, details) => {
  const radius = 318
  const size = 1
  const body = scale(
    smoothLoop([
      [182, -4], [168, -62], [100, -96], [0, -88], [-90, -56], [-158, -20],
      [-160, 14], [-96, 40], [0, 64], [110, 62], [168, 34],
    ]),
    size,
  )
  const flukes = scale(
    roundedPolygon(
      [[-150, -16], [-198, -62], [-252, -80], [-232, -24], [-214, 0], [-232, 24], [-252, 80], [-198, 62], [-150, 16]],
      10,
    ),
    size,
  )
  const fin = scale(smoothLoop([[70, 30], [40, 80], [-10, 112], [-36, 104], [-20, 60], [10, 30]]), size)
  const eye = scale(ellipse(122, -18, 13), size)
  const mouth = scale(smoothLine([[178, 10], [150, 24], [104, 26]]), size)

  around(4).forEach((angle, i) => {
    add(`whale${i}-tail`, `第 ${i + 1} 头鲸鱼的尾巴`, bend(flukes, radius, angle))
    add(`whale${i}-fin`, `第 ${i + 1} 头鲸鱼的鳍`, bend(fin, radius, angle))
    add(`whale${i}`, `第 ${i + 1} 头鲸鱼`, bend(body, radius, angle))
    details.push(dot(bend(eye, radius, angle)), line(bend(mouth, radius, angle)))
  })
  add('center', '中间的泡泡', ellipse(0, 0, 130))
})

/** A crab waving both claws, with three legs on each side. */
const crabCove = page((add, details) => {
  const pincer = (c: Pt, r: number, dir: number, notch: number) => {
    const [a0, a1] = [rad(dir + notch), rad(dir - notch + 360)]
    const tip: Pt = [c[0] + Math.cos(rad(dir)) * r * 0.2, c[1] + Math.sin(rad(dir)) * r * 0.2]
    return outline([c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], [...ellipseArc(c[0], c[1], r, r, a0, a1), tip])
  }
  const legs = [
    capsule([150, 60], [395, 20], 48),
    capsule([150, 110], [385, 150], 48),
    capsule([120, 150], [330, 285], 48),
  ]
  const arm = capsule([130, -40], [250, -205], 58)
  const claw = pincer([270, -235], 92, -55, 24)

  legs.forEach((leg, i) => {
    add(`leg-left${i}`, `左腿 ${i + 1}`, mirror(leg))
    add(`leg-right${i}`, `右腿 ${i + 1}`, leg)
  })
  add('arm-left', '左臂', mirror(arm))
  add('arm-right', '右臂', arm)
  add('claw-left', '左钳', mirror(claw))
  add('claw-right', '右钳', claw)
  add('center', '螃蟹身体', ellipse(0, 60, 215, 150))

  const stalk = outline([55, -80], [[70, -160]], false)
  details.push(line(stalk), line(mirror(stalk)))
  details.push(dot(ellipse(70, -172, 22)), dot(ellipse(-70, -172, 22)))
  details.push(line(smoothLine([[-50, 70], [0, 100], [50, 70]])))
})

/**
 * The first eight Ocean Friends pages shipped with these drawings made in code. They stay as version 1
 * so saved artwork keeps opening on the drawing it was started on; the traced art is version 2.
 */
export const OCEAN_FRIENDS_CODE_DRAWINGS: Readonly<Record<string, readonly Drawing[]>> = {
  'fish-flower': [fishFlower],
  'turtle-flower': [turtleFlower],
  'shell-bloom': [shellBloom],
  'starfish-waves': [starfishWaves],
  'octopus-hug': [octopusHug],
  'puffer-bloom': [pufferBloom],
  'whale-circle': [whaleCircle],
  'crab-cove': [crabCove],
}
