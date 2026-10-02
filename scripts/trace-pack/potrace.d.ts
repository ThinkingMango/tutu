declare module 'potrace' {
  export type PotraceOptions = {
    turdSize?: number
    optTolerance?: number
    threshold?: number
    blackOnWhite?: boolean
  }
  export class Potrace {
    constructor(options?: PotraceOptions)
    loadImage(image: Buffer, callback: (error: Error | null) => void): void
    getPathTag(fillColor?: string): string
  }
}
