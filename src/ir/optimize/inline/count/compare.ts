import { mapCompare } from '../../../../utils/map.js'
import { CountInlineState } from './state.js'

export const compareCountInlineStates = (a: CountInlineState, b: CountInlineState): boolean =>
    mapCompare(a.refs, b.refs, (valueA, valueB) => valueA === valueB) &&
    mapCompare(a.counts, b.counts, (valueA, valueB) => valueA === valueB)
