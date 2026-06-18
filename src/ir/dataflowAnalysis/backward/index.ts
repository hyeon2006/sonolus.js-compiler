import { IR } from '../../nodes/index.js'
import { generate } from '../generate/index.js'
import { Graph } from '../graph.js'
import { StateOperators, States } from '../state.js'

export const dataAnalysisBackwardIR = <T>(
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

    const transferred = new Map<IR, T>()
    const getTransferred = (ir: IR) => {
        const cached = transferred.get(ir)
        if (cached !== undefined) return cached

        const state = getState(ir)
        const output = transfer(ir, state)
        transferred.set(ir, output)

        return output
    }

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let index = 0; index < irs.length; index++) {
            if (!dirty[index]) continue
            dirty[index] = 0

            const ir = irs[irs.length - 1 - index]

            const inputs = graph.outs.get(ir) ?? empty

            let output = initial
            let hasInput = false
            for (const input of inputs) {
                const state = getTransferred(input)

                output = hasInput ? meet(output, state) : state
                hasInput = true
            }

            const oldState = getState(ir)
            if (output === oldState) continue
            if (compare(output, oldState)) continue

            if (compare(output, initial)) {
                states.delete(ir)
            } else {
                states.set(ir, output)
            }
            transferred.delete(ir)

            const ins = graph.ins.get(ir) ?? empty

            for (const inIr of ins) {
                const inOriginalIndex = graph.indexes.get(inIr)
                if (inOriginalIndex === undefined) throw new Error('Unexpected missing index')

                const inIndex = irs.length - 1 - inOriginalIndex

                if (dirty[inIndex]) continue
                dirty[inIndex] = 1

                if (inIndex <= index) needsSweep = true
            }
        }
    }
}
