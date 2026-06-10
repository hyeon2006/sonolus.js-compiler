import { IR } from '../../nodes/index.js'
import { generate } from '../generate/index.js'
import { StateOperators, States } from '../state.js'
import { meetAll } from '../utils.js'

export const dataAnalysisBackwardIR = <T>(
    ir: IR,
    irs: IR[],
    initial: T,
    states: States<T>,
    operators: StateOperators<T>,
): void => {
    const { transfer, meet, compare } = operators

    const graph = generate(ir, irs)

    const orderedIrs = [...irs].reverse()
    const indexes = new Map(orderedIrs.map((ir, index) => [ir, index]))
    const dirty = orderedIrs.map(() => true)

    const transferred = new Map<IR, T>()
    const getTransferred = (ir: IR) => {
        const cached = transferred.get(ir)
        if (cached !== undefined) return cached

        const state = states.get(ir)
        if (!state) throw new Error('Unexpected missing state')

        const output = transfer(ir, state)
        transferred.set(ir, output)

        return output
    }

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let index = 0; index < orderedIrs.length; index++) {
            if (!dirty[index]) continue
            dirty[index] = false

            const ir = orderedIrs[index]

            const inputs = graph.outs.get(ir)
            if (!inputs) throw new Error('Unexpected missing outs')

            const inputStates = [...inputs].map(getTransferred)

            const output = meetAll(initial, inputStates, meet)

            const oldState = states.get(ir)
            if (!oldState) throw new Error('Unexpected missing old state')

            if (compare(output, oldState)) continue

            states.set(ir, output)
            transferred.delete(ir)

            const ins = graph.ins.get(ir)
            if (!ins) throw new Error('Unexpected missing ins')

            for (const inIr of ins) {
                const inIndex = indexes.get(inIr)
                if (inIndex === undefined) throw new Error('Unexpected missing index')

                if (dirty[inIndex]) continue
                dirty[inIndex] = true

                if (inIndex <= index) needsSweep = true
            }
        }
    }
}
