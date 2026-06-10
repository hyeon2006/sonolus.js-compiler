import { IR } from '../../nodes/index.js'
import { generate } from '../generate/index.js'
import { StateOperators, States } from '../state.js'
import { meetAll } from '../utils.js'

export const dataAnalysisForwardIR = <T>(
    ir: IR,
    irs: IR[],
    initial: T,
    states: States<T>,
    operators: StateOperators<T>,
): void => {
    const { transfer, meet, compare } = operators

    const graph = generate(ir, irs)

    const indexes = new Map(irs.map((ir, index) => [ir, index]))
    const dirty = irs.map(() => true)

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let index = 0; index < irs.length; index++) {
            if (!dirty[index]) continue
            dirty[index] = false

            const ir = irs[index]

            const inputs = graph.ins.get(ir)
            if (!inputs) throw new Error('Unexpected missing ins')

            const inputStates = [...inputs].map((ir) => {
                const state = states.get(ir)
                if (!state) throw new Error('Unexpected missing state')

                return state
            })

            const input = meetAll(initial, inputStates, meet)

            const oldState = states.get(ir)
            if (!oldState) throw new Error('Unexpected missing old state')

            const output = transfer(ir, input, oldState)

            if (compare(output, oldState)) continue

            states.set(ir, output)

            const outs = graph.outs.get(ir)
            if (!outs) throw new Error('Unexpected missing outs')

            for (const out of outs) {
                const outIndex = indexes.get(out)
                if (outIndex === undefined) throw new Error('Unexpected missing index')

                if (dirty[outIndex]) continue
                dirty[outIndex] = true

                if (outIndex <= index) needsSweep = true
            }
        }
    }
}
