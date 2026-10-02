import {
  Apple,
  Bird,
  Bug,
  Cake,
  Candy,
  Car,
  Carrot,
  Castle,
  Cat,
  Cloud,
  Crown,
  Dog,
  Egg,
  Fish,
  Flower2,
  Ghost,
  Gift,
  Heart,
  IceCreamCone,
  Leaf,
  Moon,
  Music,
  PawPrint,
  Rabbit,
  Rainbow,
  Rocket,
  Sailboat,
  Shapes,
  Shell,
  Snail,
  Snowflake,
  Sparkles,
  Sprout,
  Squirrel,
  Star,
  Sun,
  Tent,
  Tractor,
  TrainFront,
  TreePine,
  Turtle,
  type LucideIcon,
} from 'lucide-react'
import type { PackIconName } from '@/lib/pack-icons'
import { packThemeStyle } from '@/lib/pack-theme'
import { PACK_BY_ID, type PackId } from '@/lib/packs'
import { cn } from '@/lib/utils'

export const PACK_ICONS: Record<PackIconName, LucideIcon> = {
  'flower-2': Flower2,
  fish: Fish,
  'paw-print': PawPrint,
  egg: Egg,
  'tree-pine': TreePine,
  bird: Bird,
  bug: Bug,
  cat: Cat,
  dog: Dog,
  rabbit: Rabbit,
  turtle: Turtle,
  squirrel: Squirrel,
  snail: Snail,
  shell: Shell,
  snowflake: Snowflake,
  sun: Sun,
  moon: Moon,
  star: Star,
  heart: Heart,
  leaf: Leaf,
  sprout: Sprout,
  rainbow: Rainbow,
  cloud: Cloud,
  rocket: Rocket,
  car: Car,
  tractor: Tractor,
  sailboat: Sailboat,
  'train-front': TrainFront,
  castle: Castle,
  crown: Crown,
  cake: Cake,
  'ice-cream-cone': IceCreamCone,
  apple: Apple,
  carrot: Carrot,
  candy: Candy,
  gift: Gift,
  ghost: Ghost,
  music: Music,
  sparkles: Sparkles,
  shapes: Shapes,
  tent: Tent,
}

/** The pack's icon on its own crayon, so the same color means the same pack on every screen. */
export function PackIcon({ id, className }: { id: PackId; className?: string }) {
  const Icon = PACK_ICONS[PACK_BY_ID[id].icon]
  return (
    <span
      style={packThemeStyle(id)}
      className={cn(
        'flex size-14 shrink-0 items-center justify-center rounded-full bg-(--pack) text-ink',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="size-8" strokeWidth={2.5} />
    </span>
  )
}
