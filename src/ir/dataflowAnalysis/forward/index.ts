import { IR } from '../../nodes/index.js'
import { generate } from '../generate/index.js'
import { Graph } from '../graph.js'
import { StateOperators, States } from '../state.js'

export const dataAnalysisForwardIR = <T>(
    ir: IR,
    irs: IR[],
    initial: T,
    states: States<T>,
    operators: StateOperators<T>,
    graph: Graph = generate(ir, irs),
): void => {
    const { transfer, meet, compare } = operators

    const empty = new Set<IR>()
    const dirty = new Uint8Array(irs.length)
    dirty.fill(1)

    const getState = (ir: IR) => states.get(ir) ?? initial

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let index = 0; index < irs.length; index++) {
            if (!dirty[index]) continue
            dirty[index] = 0

            const ir = irs[index]

            const inputs = graph.ins.get(ir) ?? empty

            let input = initial
            let hasInput = false
            for (const ir of inputs) {
                const state = getState(ir)
                input = hasInput ? meet(input, state) : state
                hasInput = true
            }

            const oldState = getState(ir)
            const output = transfer(ir, input, oldState)

            if (output === oldState) continue
            if (compare(output, oldState)) continue

            if (compare(output, initial)) {
                states.delete(ir)
            } else {
                states.set(ir, output)
            }

            const outs = graph.outs.get(ir) ?? empty

            for (const out of outs) {
                const outIndex = graph.indexes.get(out)
                if (outIndex === undefined) throw new Error('Unexpected missing index')

                if (dirty[outIndex]) continue
                dirty[outIndex] = 1

                if (outIndex <= index) needsSweep = true
            }
        }
    }
}
