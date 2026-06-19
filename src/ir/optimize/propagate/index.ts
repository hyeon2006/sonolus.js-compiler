import { mapCompare, mapMerge } from '../../../utils/map.js'
import { collectIR } from '../../collect/index.js'
import { BasicBlock, createBasicBlocks } from '../../dataflowAnalysis/basicBlocks.js'
import { generate } from '../../dataflowAnalysis/generate/index.js'
import { iterateIR } from '../../iterate/index.js'
import { IR } from '../../nodes/index.js'
import { Set as SetIR } from '../../nodes/Set.js'
import { Value } from '../../nodes/Value.js'
import { replaceIR } from '../../replace/index.js'
import { analyzeLiveBlockOutputs, emptyLiveState, LiveState } from '../liveness.js'
import { binaryOperations, nativeOperations, unaryOperations } from '../operations.js'

type PropagateElement = Value | 'T'
type PropagateState = ReadonlyMap<object, PropagateElement>
type Evaluated = PropagateElement | undefined

const emptyPropagateState: PropagateState = new Map()

export const propagateIR = (ir: IR): { ir: IR; changed: boolean } => {
    const irs = collectIR(ir)
    const graph = generate(ir, irs)
    const { blocks } = createBasicBlocks(irs, graph)
    const liveOutputs = analyzeLiveBlockOutputs(blocks)
    const { inputs, setElements } = analyzePropagateBlocks(blocks, liveOutputs)
    const replacements = collectConstantGetReplacements(blocks, inputs, liveOutputs, setElements)

    inputs.length = 0
    liveOutputs.length = 0
    setElements.clear()
    irs.length = 0

    return replaceIR(ir, replacements)
}

const analyzePropagateBlocks = (
    blocks: BasicBlock[],
    liveOutputs: readonly LiveState[],
): {
    inputs: PropagateState[]
    setElements: Map<SetIR, PropagateElement>
} => {
    const inputs: PropagateState[] = []
    const outputs: PropagateState[] = []
    const setElements = new Map<SetIR, PropagateElement>()
    const dirty = new Uint8Array(blocks.length)
    dirty.fill(1)

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let index = 0; index < blocks.length; index++) {
            if (!dirty[index]) continue
            dirty[index] = 0

            const block = blocks[index]
            const input = meetPredecessorOutputs(block, outputs)
            const output = transferPropagateBlock(
                block,
                input,
                liveOutputs[block.index] ?? emptyLiveState,
                setElements,
            )

            const oldInput = inputs[index] ?? emptyPropagateState
            const oldOutput = outputs[index] ?? emptyPropagateState
            if (compareStates(input, oldInput) && compareStates(output, oldOutput)) continue

            setState(inputs, index, input)
            setState(outputs, index, output)

            for (const successor of block.successors) {
                if (dirty[successor.index]) continue

                dirty[successor.index] = 1
                if (successor.index <= index) needsSweep = true
            }
        }
    }

    outputs.length = 0

    return { inputs, setElements }
}

const collectConstantGetReplacements = (
    blocks: BasicBlock[],
    inputs: readonly PropagateState[],
    liveOutputs: readonly LiveState[],
    setElements: ReadonlyMap<SetIR, PropagateElement>,
): Map<IR, IR> => {
    const replacements = new Map<IR, IR>()

    for (const block of blocks) {
        let state = inputs[block.index] ?? emptyPropagateState
        const remainingGets = countBlockGets(block)
        const liveOutput = liveOutputs[block.index] ?? emptyLiveState

        for (const ir of block.nodes) {
            switch (ir.type) {
                case 'Get': {
                    const element = state.get(ir.target)
                    if (element && element !== 'T') replacements.set(ir, { ...element })
                    break
                }
                case 'Set': {
                    state = transferPropagateSet(ir, state, setElements.get(ir))
                    state = pruneConsumedValueTargets(state, remainingGets, liveOutput, ir.value)
                    state = pruneDeadTarget(state, ir.target, remainingGets, liveOutput)
                    break
                }
                default:
                    break
            }
        }
    }

    return replacements
}

const meetPredecessorOutputs = (block: BasicBlock, outputs: PropagateState[]): PropagateState => {
    let state: PropagateState | undefined

    for (const predecessor of block.predecessors) {
        const output = outputs[predecessor.index] ?? emptyPropagateState
        state = state ? meetStates(state, output) : output
    }

    return state ?? emptyPropagateState
}

const transferPropagateBlock = (
    block: BasicBlock,
    input: PropagateState,
    liveOutput: LiveState,
    setElements: Map<SetIR, PropagateElement>,
): PropagateState => {
    let output = input
    const remainingGets = countBlockGets(block)

    for (const ir of block.nodes) {
        switch (ir.type) {
            case 'Set': {
                output = transferPropagateSet(ir, output, setElements.get(ir))
                output = pruneConsumedValueTargets(output, remainingGets, liveOutput, ir.value)
                output = pruneDeadTarget(output, ir.target, remainingGets, liveOutput)

                const element = output.get(ir.target)
                if (element) {
                    setElements.set(ir, element)
                } else {
                    setElements.delete(ir)
                }
                break
            }
            default:
                break
        }
    }

    return output
}

const countBlockGets = (block: BasicBlock): Map<object, number> => {
    const counts = new Map<object, number>()

    for (const ir of block.nodes) {
        if (ir.type !== 'Get') continue

        counts.set(ir.target, (counts.get(ir.target) ?? 0) + 1)
    }

    return counts
}

const pruneConsumedValueTargets = (
    state: PropagateState,
    remainingGets: Map<object, number>,
    liveOutput: LiveState,
    value: IR,
): PropagateState => {
    const consumed = new Set<object>()
    decrementValueGets(remainingGets, value, consumed)

    let output = state
    for (const target of consumed) {
        output = pruneDeadTarget(output, target, remainingGets, liveOutput)
    }

    return output
}

const decrementValueGets = (counts: Map<object, number>, ir: IR, consumed: Set<object>): void => {
    if (ir.type === 'Get') {
        decrementRemainingGets(counts, ir.target)
        consumed.add(ir.target)
    }

    for (const child of iterateIR(ir)) {
        decrementValueGets(counts, child, consumed)
    }
}

const decrementRemainingGets = (counts: Map<object, number>, target: object): void => {
    const count = counts.get(target)
    if (count === undefined) return

    if (count > 1) {
        counts.set(target, count - 1)
    } else {
        counts.delete(target)
    }
}

const pruneDeadTarget = (
    state: PropagateState,
    target: object,
    remainingGets: ReadonlyMap<object, number>,
    liveOutput: LiveState,
): PropagateState => {
    if (remainingGets.has(target) || liveOutput.has(target)) return state
    if (!state.has(target)) return state

    const output = new Map(state)
    output.delete(target)

    return output
}

const transferPropagateSet = (
    ir: SetIR,
    input: PropagateState,
    oldElement?: PropagateElement,
): PropagateState => {
    let element = evaluate(ir.value, input)

    if (element !== undefined && oldElement) {
        if (oldElement === 'T') {
            element = 'T'
        } else if (element !== 'T' && oldElement.value !== element.value) {
            element = 'T'
        }
    }

    const existing = input.get(ir.target)

    if (element === undefined) {
        if (existing === undefined) return input

        const output = new Map(input)
        output.delete(ir.target)

        return output
    }

    if (existing === element) return input
    if (
        existing !== undefined &&
        existing !== 'T' &&
        element !== 'T' &&
        existing.value === element.value
    )
        return input

    const output = new Map(input)
    output.set(ir.target, element)

    return output
}

const evaluate = (ir: IR, state: PropagateState): Evaluated => {
    switch (ir.type) {
        case 'Value':
            return ir
        case 'Get':
            return state.get(ir.target)
        case 'Binary': {
            const lhs = evaluate(ir.lhs, state)
            if (lhs === undefined) return undefined

            const rhs = evaluate(ir.rhs, state)
            if (rhs === undefined) return undefined

            if (lhs === 'T' || rhs === 'T') return 'T'

            let value
            try {
                value = binaryOperations[ir.operator](lhs.value, rhs.value)
            } catch {
                return 'T'
            }

            return {
                stackTraces: ir.stackTraces,
                env: ir.env,

                type: 'Value',
                value,
                thisValue: undefined,
                isSuper: false,
            }
        }
        case 'Unary': {
            const arg = evaluate(ir.arg, state)
            if (arg === undefined) return undefined

            if (arg === 'T') return 'T'

            let value
            try {
                value = unaryOperations[ir.operator](arg.value)
            } catch {
                return 'T'
            }

            return {
                stackTraces: ir.stackTraces,
                env: ir.env,

                type: 'Value',
                value,
                thisValue: undefined,
                isSuper: false,
            }
        }
        case 'Native':
            return evaluateNative(ir, state)
        default:
            return 'T'
    }
}

const evaluateNative = (ir: Extract<IR, { type: 'Native' }>, state: PropagateState): Evaluated => {
    const result = nativeOperations[ir.func]
    if (!result) return 'T'

    const [length, func] = result
    if (length !== Infinity && ir.args.length !== length) return 'T'

    const values: number[] = []
    for (const arg of ir.args) {
        const element = evaluate(arg, state)
        if (element === undefined) return undefined
        if (element === 'T') return 'T'

        values.push(element.value as number)
    }

    let value
    try {
        value = func(...values)
    } catch {
        return 'T'
    }

    return {
        stackTraces: ir.stackTraces,
        env: ir.env,

        type: 'Value',
        value,
        thisValue: undefined,
        isSuper: false,
    }
}

const meetStates = (a: PropagateState, b: PropagateState): PropagateState =>
    a === b
        ? a
        : mapMerge(a, b, (elementA, elementB) => {
              if (elementA === 'T' || elementB === 'T') return 'T'

              if (!elementA || !elementB) return elementA ?? elementB

              return elementA.value === elementB.value ? elementA : 'T'
          })

const compareStates = (a: PropagateState, b: PropagateState): boolean =>
    mapCompare(a, b, (elementA, elementB) => {
        if (elementA === 'T' || elementB === 'T') return elementA === elementB

        return elementA.value === elementB.value
    })

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
