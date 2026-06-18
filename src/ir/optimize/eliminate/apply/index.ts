import { IR } from '../../../nodes/index.js'
import { replaceIR } from '../../../replace/index.js'
import { EliminateState, EliminateStates } from '../analyze/state.js'

export const applyEliminateIR = (
    ir: IR,
    irs: IR[],
    states: EliminateStates,
): { ir: IR; changed: boolean } => {
    const initial: EliminateState = new Set()
    const replacements = new Map<IR, IR>()
    for (const ir of irs) {
        if (ir.type !== 'Set') continue

        const state = states.get(ir) ?? initial
        if (state.has(ir.target)) continue

        replacements.set(ir, ir.value)
    }

    states.clear()
    irs.length = 0

    return replaceIR(ir, replacements)
}
