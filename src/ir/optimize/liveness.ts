import { compare, union } from '../../utils/set.js'
import { BasicBlock } from '../dataflowAnalysis/basicBlocks.js'

export type LiveState = ReadonlySet<object>

export const emptyLiveState: LiveState = new Set()

export const analyzeLiveBlockOutputs = (blocks: BasicBlock[]): LiveState[] => {
    const inputs: LiveState[] = []
    const outputs: LiveState[] = []
    const dirty = new Uint8Array(blocks.length)
    dirty.fill(1)

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let scanIndex = 0; scanIndex < blocks.length; scanIndex++) {
            const index = blocks.length - 1 - scanIndex
            if (!dirty[index]) continue
            dirty[index] = 0

            const block = blocks[index]
            const output = meetSuccessorInputs(block, inputs)
            const input = transferLiveBlock(block, output)

            const oldOutput = outputs[index] ?? emptyLiveState
            const oldInput = inputs[index] ?? emptyLiveState
            if (compare(output, oldOutput) && compare(input, oldInput)) continue

            setState(outputs, index, output)
            setState(inputs, index, input)

            for (const predecessor of block.predecessors) {
                if (dirty[predecessor.index]) continue

                dirty[predecessor.index] = 1
                if (predecessor.index >= index) needsSweep = true
            }
        }
    }

    inputs.length = 0

    return outputs
}

const meetSuccessorInputs = (block: BasicBlock, inputs: LiveState[]): LiveState => {
    let state: LiveState | undefined

    for (const successor of block.successors) {
        const input = inputs[successor.index] ?? emptyLiveState
        state = state ? union(state, input) : input
    }

    return state ?? emptyLiveState
}

const transferLiveBlock = (block: BasicBlock, output: LiveState): LiveState => {
    let input: Set<object> | undefined
    const getState = () => input ?? output
    const getInput = () => (input ??= new Set(output))

    for (let index = block.nodes.length - 1; index >= 0; index--) {
        const ir = block.nodes[index]

        switch (ir.type) {
            case 'Get':
                if (!getState().has(ir.target)) getInput().add(ir.target)
                break
            case 'Set':
                if (getState().has(ir.target)) getInput().delete(ir.target)
                break
            default:
                break
        }
    }

    return input ?? output
}

const setState = <T>(
    states: T[],
    index: number,
    state: T & {
        readonly size: number
    },
): void => {
    if (state.size) {
        states[index] = state
    } else {
        // Intentional sparse array: the slot is keyed by block index and read
        // back with `?? empty`, so removing it is correct and never iterated.
        // eslint-disable-next-line @typescript-eslint/no-array-delete, @typescript-eslint/no-dynamic-delete
        delete states[index]
    }
}
