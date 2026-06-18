import { dataAnalysisBackwardIR } from '../../../dataflowAnalysis/backward/index.js'
import { Graph } from '../../../dataflowAnalysis/graph.js'
import { head } from '../../../head/index.js'
import { IR } from '../../../nodes/index.js'
import { compareCountInlineStates } from './compare.js'
import { meetCountInlineStates } from './meet.js'
import { CountInlineState, CountInlineStates } from './state.js'
import { transferCountInlineIR } from './transfer/index.js'

export const countInlineIR = (
    ir: IR,
    irs: IR[],
    dependencies: ReadonlyMap<object, ReadonlySet<object>>,
    graph?: Graph,
): CountInlineState => {
    const input: CountInlineState = {
        refs: new Map(),
        counts: new Map(),
    }
    const states: CountInlineStates = new Map()

    dataAnalysisBackwardIR(
        ir,
        irs,
        input,
        states,
        {
            transfer: (ir, input) => transferCountInlineIR(ir, input, dependencies),
            meet: meetCountInlineStates,
            compare: compareCountInlineStates,
        },
        graph,
    )

    const state = states.get(head(ir)) ?? input
    states.clear()

    return {
        refs: input.refs,
        counts: state.counts,
    }
}
