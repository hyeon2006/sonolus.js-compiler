import { mapCompare } from '../../../../utils/map.js'
import { FindInlineState } from './state.js'

export const compareFindInlineStates = (a: FindInlineState, b: FindInlineState): boolean =>
    mapCompare(a, b, (valueA, valueB) => valueA === valueB)
