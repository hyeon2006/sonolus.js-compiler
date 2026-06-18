import { dataAnalysisForwardIR } from '../../../dataflowAnalysis/forward/index.js'
import { generate } from '../../../dataflowAnalysis/generate/index.js'
import { Graph } from '../../../dataflowAnalysis/graph.js'
import { IR } from '../../../nodes/index.js'
import { Set } from '../../../nodes/Set.js'
import { compareFindInlineStates } from './compare.js'
import { meetFindInlineStates } from './meet.js'
import { FindInlineState, FindInlineStates } from './state.js'
import { transferFindInlineIR } from './transfer/index.js'

export const findInlineIR = (
    ir: IR,
    irs: IR[],
    graph: Graph = generate(ir, irs),
): { states: FindInlineStates; merged: ReadonlySet<Set> } => {
    const input: FindInlineState = new Map()
    const states: FindInlineStates = new Map()

    dataAnalysisForwardIR(
        ir,
        irs,
        input,
        states,
        {
            transfer: transferFindInlineIR,
            meet: meetFindInlineStates,
            compare: compareFindInlineStates,
        },
        graph,
    )

    return { states, merged: collectMerged(irs, states, graph, input) }
}

const collectMerged = (
    irs: IR[],
    states: FindInlineStates,
    graph: Graph,
    input: FindInlineState,
): ReadonlySet<Set> => {
    const merged = new globalThis.Set<Set>()

    for (const node of irs) {
        const ins = graph.ins.get(node)
        if (!ins || ins.size < 2) continue

        const seen = new Map<object, Set | 'T'>()
        for (const inNode of ins) {
            const state = states.get(inNode) ?? input
            for (const [target, value] of state) {
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
