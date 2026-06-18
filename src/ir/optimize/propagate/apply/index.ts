import { IR } from '../../../nodes/index.js'
import { replaceIR } from '../../../replace/index.js'
import { PropagateStates } from '../analyze/state.js'

export const applyPropagateIR = (
    ir: IR,
    states: PropagateStates,
): { ir: IR; changed: boolean } => {
    const replacements = new Map<IR, IR>()
    for (const [ir, state] of states) {
        if (ir.type !== 'Get') continue

        const element = state.get(ir.target)
        if (!element || element === 'T') continue

        replacements.set(ir, { ...element })
    }

    states.clear()

    return replaceIR(ir, replacements)
}
