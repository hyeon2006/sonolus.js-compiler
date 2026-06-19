import { sideEffectFreeFuncs } from '../../../utils/funcs.js'
import { collectIR } from '../../collect/index.js'
import { createBasicBlocks, type BasicBlock } from '../../dataflowAnalysis/basicBlocks.js'
import { generate } from '../../dataflowAnalysis/generate/index.js'
import { iterateIR } from '../../iterate/index.js'
import { Get } from '../../nodes/Get.js'
import { IR } from '../../nodes/index.js'
import { Native } from '../../nodes/Native.js'
import { Set as SetIR } from '../../nodes/Set.js'
import { replaceIR } from '../../replace/index.js'

const top: -1 = -1

type TargetId = number
type DefId = number
// A reaching value is either a definition id or the `top` sentinel (-1); both
// are plain numbers, so the type is just `number`.
type ReachValue = DefId
type ReachState = ReadonlyMap<TargetId, ReachValue>

type Def = {
    readonly id: DefId
    readonly set: SetIR
    readonly target: TargetId
    readonly dependencies: ReadonlySet<TargetId>
    readonly sideEffect: boolean
    block?: BasicBlock
    nodeIndex: number
}

type Use = {
    readonly get: Get
    readonly target: TargetId
    block?: BasicBlock
    nodeIndex: number
}

type DefUse = {
    readonly defs: Def[]
    readonly defsBySet: ReadonlyMap<SetIR, Def>
    readonly usesByGet: ReadonlyMap<Get, Use>
    readonly dependentTargets: ReadonlyMap<TargetId, ReadonlySet<TargetId>>
}

type InlineInfo = {
    readonly dependencies: ReadonlySet<object>
    readonly sideEffect: boolean
}

type SccInfo = {
    readonly ids: Int32Array
    readonly cyclic: readonly boolean[]
}

type UseSummary = {
    readonly gets: (Get | undefined)[]
    readonly counts: Uint8Array
}

const emptyReachState: ReachState = new Map()
const emptyDependencies: ReadonlySet<object> = new Set()
const emptyInlineInfo: InlineInfo = {
    dependencies: emptyDependencies,
    sideEffect: false,
}

export const inlineIR = (ir: IR): { ir: IR; changed: boolean } => {
    const irs = collectIR(ir)
    const graph = generate(ir, irs)
    const basicBlocks = createBasicBlocks(irs, graph)
    const defUse = createDefUse(irs)

    annotateDefUseLocations(basicBlocks.blocks, defUse)

    const scc = createSccInfo(basicBlocks.blocks)
    const inputs = analyzeReachingDefs(basicBlocks.blocks, defUse)
    const uses = collectReachingUses(basicBlocks.blocks, inputs, defUse, scc)

    irs.length = 0

    const replacements = new Map<IR, IR>()

    for (const def of defUse.defs) {
        const get = uses.gets[def.id]
        if (!get) continue

        if (def.sideEffect) continue
        if (def.dependencies.has(def.target)) continue
        if (uses.counts[def.id] !== 1) continue

        replacements.set(def.set, {
            stackTraces: def.set.stackTraces,
            env: def.set.env,

            type: 'Value',
            value: 0,
            thisValue: undefined,
            isSuper: false,
        })
        replacements.set(get, def.set.value)
    }

    uses.gets.length = 0

    return replaceIR(ir, replacements)
}

const createDefUse = (irs: IR[]): DefUse => {
    const targetIds = new Map<object, TargetId>()
    const defs: Def[] = []
    const defsBySet = new Map<SetIR, Def>()
    const usesByGet = new Map<Get, Use>()
    const dependentTargets = new Map<TargetId, Set<TargetId>>()
    const infoCache = new Map<IR, InlineInfo>()

    const getTargetId = (target: object): TargetId => {
        let id = targetIds.get(target)
        if (id !== undefined) return id

        id = targetIds.size
        targetIds.set(target, id)

        return id
    }

    for (const ir of irs) {
        switch (ir.type) {
            case 'Get': {
                const use: Use = {
                    get: ir,
                    target: getTargetId(ir.target),
                    nodeIndex: -1,
                }
                usesByGet.set(ir, use)
                break
            }
            case 'Set': {
                const dependencies = new Set<TargetId>()
                const info = analyzeInlineInfo(ir.value, infoCache)
                const target = getTargetId(ir.target)

                for (const dependency of info.dependencies) {
                    dependencies.add(getTargetId(dependency))
                }

                const def: Def = {
                    id: defs.length,
                    set: ir,
                    target,
                    dependencies,
                    sideEffect: info.sideEffect,
                    nodeIndex: -1,
                }
                defs.push(def)
                defsBySet.set(ir, def)

                for (const dependency of dependencies) {
                    let targets = dependentTargets.get(dependency)
                    if (!targets) {
                        targets = new Set()
                        dependentTargets.set(dependency, targets)
                    }
                    targets.add(target)
                }
                break
            }
            default:
                break
        }
    }

    infoCache.clear()

    return { defs, defsBySet, usesByGet, dependentTargets }
}

const analyzeInlineInfo = (ir: IR, cache: Map<IR, InlineInfo>): InlineInfo => {
    const cached = cache.get(ir)
    if (cached) return cached

    let result: InlineInfo

    switch (ir.type) {
        case 'Get':
            result = {
                dependencies: new Set([ir.target]),
                sideEffect: false,
            }
            break
        case 'Set':
            result = analyzeInlineInfo(ir.value, cache)
            break
        case 'Native':
            result = analyzeChildrenInlineInfo(ir, cache, !sideEffectFreeFuncs.includes(ir.func))
            break
        default:
            result = analyzeChildrenInlineInfo(ir, cache, false)
            break
    }

    cache.set(ir, result)

    return result
}

const analyzeChildrenInlineInfo = (
    ir: IR,
    cache: Map<IR, InlineInfo>,
    hasSideEffect: boolean,
): InlineInfo => {
    let dependencies: Set<object> | undefined
    let sideEffect = hasSideEffect

    for (const child of iterateIR(ir)) {
        const info = analyzeInlineInfo(child, cache)
        sideEffect ||= info.sideEffect

        if (!info.dependencies.size) continue

        dependencies ??= new Set()
        for (const dependency of info.dependencies) {
            dependencies.add(dependency)
        }
    }

    if (!dependencies && !sideEffect) return emptyInlineInfo

    return {
        dependencies: dependencies ?? emptyDependencies,
        sideEffect,
    }
}

const annotateDefUseLocations = (blocks: BasicBlock[], defUse: DefUse): void => {
    for (const block of blocks) {
        for (let nodeIndex = 0; nodeIndex < block.nodes.length; nodeIndex++) {
            const ir = block.nodes[nodeIndex]

            switch (ir.type) {
                case 'Get': {
                    const use = defUse.usesByGet.get(ir)
                    if (!use) break

                    use.block = block
                    use.nodeIndex = nodeIndex
                    break
                }
                case 'Set': {
                    const def = defUse.defsBySet.get(ir)
                    if (!def) break

                    def.block = block
                    def.nodeIndex = nodeIndex
                    break
                }
                default:
                    break
            }
        }
    }
}

const analyzeReachingDefs = (
    blocks: BasicBlock[],
    defUse: DefUse,
): ReadonlyMap<BasicBlock, ReachState> => {
    const inputs = new Map<BasicBlock, ReachState>()
    const outputs = new Map<BasicBlock, ReachState>()
    const dirty = new Uint8Array(blocks.length)
    dirty.fill(1)

    let needsSweep = true
    while (needsSweep) {
        needsSweep = false

        for (let index = 0; index < blocks.length; index++) {
            if (!dirty[index]) continue
            dirty[index] = 0

            const block = blocks[index]
            const input = meetPredecessors(block, outputs)
            setState(inputs, block, input)

            const output = transferBlock(block, input, defUse)
            const oldOutput = outputs.get(block) ?? emptyReachState
            if (compareStates(output, oldOutput)) continue

            setState(outputs, block, output)

            for (const successor of block.successors) {
                if (dirty[successor.index]) continue

                dirty[successor.index] = 1
                if (successor.index <= index) needsSweep = true
            }
        }
    }

    outputs.clear()

    return inputs
}

const meetPredecessors = (
    block: BasicBlock,
    outputs: ReadonlyMap<BasicBlock, ReachState>,
): ReachState => {
    if (!block.predecessors.size) return emptyReachState

    let state: ReachState | undefined
    for (const predecessor of block.predecessors) {
        const output = outputs.get(predecessor) ?? emptyReachState
        state = state ? meetStates(state, output) : output
    }

    return state ?? emptyReachState
}

const transferBlock = (block: BasicBlock, input: ReachState, defUse: DefUse): ReachState => {
    let output: Map<TargetId, ReachValue> | undefined
    const getState = () => output ?? input
    const getOutput = () => (output ??= new Map(input))

    for (const ir of block.nodes) {
        switch (ir.type) {
            case 'Native':
                if (!isSideEffectFree(ir)) poisonActiveTargets(getState(), getOutput)
                break
            case 'Set': {
                const def = defUse.defsBySet.get(ir)
                if (!def) break

                poisonDependentTargets(def.target, defUse, getState, getOutput)
                getOutput().set(def.target, def.id)
                break
            }
            default:
                break
        }
    }

    return output ?? input
}

const collectReachingUses = (
    blocks: BasicBlock[],
    inputs: ReadonlyMap<BasicBlock, ReachState>,
    defUse: DefUse,
    scc: SccInfo,
): UseSummary => {
    const gets: (Get | undefined)[] = []
    const counts = new Uint8Array(defUse.defs.length)

    for (const block of blocks) {
        let output: Map<TargetId, ReachValue> | undefined
        const input = inputs.get(block) ?? emptyReachState
        const getState = () => output ?? input
        const getOutput = () => (output ??= new Map(input))

        for (const ir of block.nodes) {
            switch (ir.type) {
                case 'Get': {
                    const use = defUse.usesByGet.get(ir)
                    if (!use) break

                    const value = getState().get(use.target)
                    if (value === undefined || value === top) break

                    const def = defUse.defs[value]

                    recordUse(def, ir, gets, counts, isRepeatedDynamicUse(def, use, scc))
                    break
                }
                case 'Native':
                    if (!isSideEffectFree(ir)) poisonActiveTargets(getState(), getOutput)
                    break
                case 'Set': {
                    const def = defUse.defsBySet.get(ir)
                    if (!def) break

                    poisonDependentTargets(def.target, defUse, getState, getOutput)
                    getOutput().set(def.target, def.id)
                    break
                }
                default:
                    break
            }
        }
    }

    return { gets, counts }
}

const recordUse = (
    def: Def,
    get: Get,
    gets: (Get | undefined)[],
    counts: Uint8Array,
    repeated: boolean,
): void => {
    if (repeated || counts[def.id]) {
        counts[def.id] = 2
        gets[def.id] = undefined
        return
    }

    counts[def.id] = 1
    gets[def.id] = get
}

const isRepeatedDynamicUse = (def: Def, use: Use, scc: SccInfo): boolean => {
    if (!def.block || !use.block) return true

    const defScc = scc.ids[def.block.index]
    const useScc = scc.ids[use.block.index]

    if (scc.cyclic[defScc] && def.block !== use.block) return true
    if (!scc.cyclic[useScc]) return false

    return def.block !== use.block || def.nodeIndex >= use.nodeIndex
}

const poisonActiveTargets = (
    state: ReachState,
    getOutput: () => Map<TargetId, ReachValue>,
): void => {
    if (!state.size) return

    const output = getOutput()
    for (const target of state.keys()) {
        output.set(target, top)
    }
}

const poisonDependentTargets = (
    dependency: TargetId,
    defUse: DefUse,
    getState: () => ReachState,
    getOutput: () => Map<TargetId, ReachValue>,
): void => {
    const targets = defUse.dependentTargets.get(dependency)
    if (!targets?.size) return

    const state = getState()
    let output: Map<TargetId, ReachValue> | undefined

    for (const target of targets) {
        const value = state.get(target)
        if (value === undefined || value === top) continue

        const def = defUse.defs[value]
        if (!def.dependencies.has(dependency)) continue

        output ??= getOutput()
        output.set(target, top)
    }
}

const meetStates = (a: ReachState, b: ReachState): ReachState => {
    if (a === b) return a

    let output: Map<TargetId, ReachValue> | undefined
    let sameAsB = true
    const getOutput = () => (output ??= new Map(a))

    for (const [target, valueA] of a) {
        const hasB = b.has(target)
        const valueB = b.get(target)
        const value = meetValues(valueA, hasB, valueB)

        if (value === undefined) {
            getOutput().delete(target)
            if (hasB) sameAsB = false
            continue
        }

        if (value !== valueA) getOutput().set(target, value)
        if (value !== valueB) sameAsB = false
    }

    for (const [target, valueB] of b) {
        if (a.has(target)) continue

        const value = meetValues(undefined, true, valueB)
        if (value === undefined) {
            sameAsB = false
            continue
        }

        getOutput().set(target, value)
        if (value !== valueB) sameAsB = false
    }

    if (!output) return a
    if (sameAsB && output.size === b.size) return b

    return output
}

const meetValues = (
    valueA: ReachValue | undefined,
    hasB: boolean,
    valueB: ReachValue | undefined,
): ReachValue | undefined => {
    if (valueA === undefined && !hasB) return undefined
    if (valueA === valueB && hasB) return valueA

    return top
}

const compareStates = (a: ReachState, b: ReachState): boolean => {
    if (a === b) return true
    if (a.size !== b.size) return false

    for (const [key, value] of a) {
        if (b.get(key) !== value) return false
    }

    return true
}

const setState = (
    states: Map<BasicBlock, ReachState>,
    block: BasicBlock,
    state: ReachState,
): void => {
    if (compareStates(state, emptyReachState)) {
        states.delete(block)
    } else {
        states.set(block, state)
    }
}

const createSccInfo = (blocks: BasicBlock[]): SccInfo => {
    const indexes = new Int32Array(blocks.length)
    const lowLinks = new Int32Array(blocks.length)
    const onStack = new Uint8Array(blocks.length)
    const ids = new Int32Array(blocks.length)
    const cyclic: boolean[] = []
    const stack: BasicBlock[] = []

    indexes.fill(-1)
    ids.fill(-1)

    let index = 0

    const visit = (block: BasicBlock): void => {
        indexes[block.index] = index
        lowLinks[block.index] = index
        index++

        stack.push(block)
        onStack[block.index] = 1

        for (const successor of block.successors) {
            if (indexes[successor.index] === -1) {
                visit(successor)
                lowLinks[block.index] = Math.min(lowLinks[block.index], lowLinks[successor.index])
                continue
            }

            if (onStack[successor.index]) {
                lowLinks[block.index] = Math.min(lowLinks[block.index], indexes[successor.index])
            }
        }

        if (lowLinks[block.index] !== indexes[block.index]) return

        const sccId = cyclic.length
        let size = 0
        let hasSelfLoop = false

        while (true) {
            const current = stack.pop()
            if (!current) throw new Error('Unexpected empty SCC stack')

            onStack[current.index] = 0
            ids[current.index] = sccId
            size++

            if (current.successors.has(current)) hasSelfLoop = true
            if (current === block) break
        }

        cyclic.push(size > 1 || hasSelfLoop)
    }

    for (const block of blocks) {
        if (indexes[block.index] === -1) visit(block)
    }

    return { ids, cyclic }
}

const isSideEffectFree = (ir: Native): boolean => sideEffectFreeFuncs.includes(ir.func)
