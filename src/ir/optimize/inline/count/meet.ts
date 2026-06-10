import { mapMerge } from '../../../../utils/map.js'
import { CountInlineState } from './state.js'

export const meetCountInlineStates = (
    a: CountInlineState,
    b: CountInlineState,
): CountInlineState => ({
    refs:
        a.refs === b.refs
            ? a.refs
            : mapMerge(a.refs, b.refs, (valueA, valueB) => {
                  if (valueA === 'T' || valueB === 'T') return 'T'

                  return valueA ?? valueB
              }),
    counts:
        a.counts === b.counts
            ? a.counts
            : mapMerge(a.counts, b.counts, (valueA, valueB) => {
                  if (valueA === 'T' || valueB === 'T') return 'T'

                  return valueA ?? valueB
              }),
})
