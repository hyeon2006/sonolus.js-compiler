import { dataAnalysisForwardIR } from '../../../dataflowAnalysis/forward/index.js'
import { generate } from '../../../dataflowAnalysis/generate/index.js'
import { IR } from '../../../nodes/index.js'
import { Set } from '../../../nodes/Set.js'
import { compareFindInlineStates } from './compare.js'
import { meetFindInlineStates } from './meet.js'
import { FindInlineState, FindInlineStates } from './state.js'
import { transferFindInlineIR } from './transfer/index.js'

export const findInlineIR = (
    ir: IR,
    irs: IR[],
): { states: FindInlineStates; merged: ReadonlySet<Set> } => {
    const input: FindInlineState = []
    const states: FindInlineStates = new Map(irs.map((ir) => [ir, []]))

    dataAnalysisForwardIR(ir, irs, input, states, {
        transfer: transferFindInlineIR,
        meet: meetFindInlineStates,
        compare: compareFindInlineStates,
    })

    return { states, merged: collectMerged(ir, irs, states) }
}

const collectMerged = (ir: IR, irs: IR[], states: FindInlineStates): ReadonlySet<Set> => {
    const merged = new globalThis.Set<Set>()

    const graph = generate(ir, irs)

    for (const node of irs) {
        const ins = graph.ins.get(node)
        if (!ins || ins.size < 2) continue

        const seen = new Map<object, Set | 'T'>()
        for (const inNode of ins) {
            const state = states.get(inNode)
            if (!state) throw new Error('Unexpected missing state')

            for (const { k: target, v: value } of state) {
                const previous = seen.get(target)
                if (previous === undefined) {
                    seen.set(target, value)
                    continue
                }
                if (previous === value) continue

                if (previous !== 'T') merged.add(previous)
                if (value !== 'T') merged.add(value)
                seen.set(target, 'T')
            }
        }
    }

    return merged
}
