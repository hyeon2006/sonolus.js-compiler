import { mapMerge } from '../../../../utils/map.js'
import { FindInlineState } from './state.js'

export const meetFindInlineStates = (a: FindInlineState, b: FindInlineState): FindInlineState =>
    a === b
        ? a
        : mapMerge(a, b, (valueA, valueB) => {
              if (valueA === 'T' || valueB === 'T') return 'T'

              if (!valueA || !valueB) return valueA ?? valueB

              return valueA === valueB ? valueA : 'T'
          })
