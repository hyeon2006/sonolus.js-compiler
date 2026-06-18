import { IR } from '../../../nodes/index.js'
import { Set as SetIR } from '../../../nodes/Set.js'
import { replaceIR } from '../../../replace/index.js'
import { CountInlineState } from '../count/state.js'
import { FindInlineStates } from '../find/state.js'

export const applyInlineIR = (
    ir: IR,
    sideEffects: Set<IR>,
    countState: CountInlineState,
    findStates: FindInlineStates,
    merged: ReadonlySet<SetIR>,
): { ir: IR; changed: boolean } => {
    const replacements = new Map<IR, IR>()
    for (const [ir, state] of findStates) {
        if (ir.type !== 'Get') continue

        const element = state.get(ir.target)
        if (!element || element === 'T') continue

        if (merged.has(element)) continue

        const count = countState.counts.get(element)
        if (count !== 1) continue

        if (sideEffects.has(element)) continue

        replacements.set(element, {
            stackTraces: element.stackTraces,
            env: element.env,

            type: 'Value',
            value: 0,
            thisValue: undefined,
            isSuper: false,
        })
        replacements.set(ir, element.value)
    }

    findStates.clear()
    sideEffects.clear()

    if (countState.refs instanceof Map) countState.refs.clear()
    if (countState.counts instanceof Map) countState.counts.clear()
    if (merged instanceof Set) merged.clear()

    return replaceIR(ir, replacements)
}
