declare namespace Intl {
  type SegmenterGranularity = 'grapheme' | 'word' | 'sentence'
  interface SegmenterOptions {
    granularity?: SegmenterGranularity
    localeMatcher?: 'best fit' | 'lookup'
  }
  interface SegmentData {
    segment: string
    index: number
    input: string
    isWordLike?: boolean
  }
  interface Segmenter {
    segment(input: string): Iterable<SegmentData>
  }
  const Segmenter: {
    new (locales?: string | string[], options?: SegmenterOptions): Segmenter
    supportedLocalesOf(locales: string | string[], options?: SegmenterOptions): string[]
  }
}
