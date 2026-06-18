import { sideEffectFreeFuncs } from '../../../utils/funcs.js'
import { iterateIR } from '../../iterate/index.js'
import { Get } from '../../nodes/Get.js'
import { IR } from '../../nodes/index.js'
import { Native } from '../../nodes/Native.js'
import { Set as SetIR } from '../../nodes/Set.js'
import { replaceIR } from '../../replace/index.js'
import { TrackInlineIRContext } from './track/context.js'
import { trackInlineIR } from './track/index.js'

type InlineCandidate = {
    readonly target: object
    readonly set: SetIR
    readonly dependencies: ReadonlySet<object>
    get?: Get
    blocked: boolean
}

type InlineScope = {
    readonly active: Map<object, InlineCandidate>
    readonly byDependency: Map<object, Set<InlineCandidate>>
    readonly replacements: Map<IR, IR>
}

export const inlineIR = (ir: IR): { ir: IR; changed: boolean } => {
    const replacements = new Map<IR, IR>()
    const scope = createScope(replacements)

    visitInlineIR(ir, scope)
    closeAll(scope)

    return replaceIR(ir, replacements)
}

const createScope = (replacements: Map<IR, IR>): InlineScope => ({
    active: new Map(),
    byDependency: new Map(),
    replacements,
})

const visitInlineIR = (ir: IR, scope: InlineScope): void => {
    switch (ir.type) {
        case 'Get':
            useTarget(ir, scope)
            return
        case 'Set':
            visitInlineIR(ir.value, scope)
            closeTarget(ir.target, scope)
            closeDependents(ir.target, scope)
            addCandidate(ir, scope)
            return
        case 'Block':
        case 'Break':
        case 'Call':
        case 'Conditional':
        case 'DoWhile':
        case 'ForOf':
        case 'JSCall':
        case 'Logical':
        case 'Switch':
        case 'Throw':
        case 'While':
            visitBoundaryIR(ir, scope)
            return
        case 'Native':
            if (!isSideEffectFree(ir)) {
                visitBoundaryIR(ir, scope)
                return
            }
            break
    }

    for (const child of iterateIR(ir)) {
        visitInlineIR(child, scope)
    }
}

const visitBoundaryIR = (ir: IR, scope: InlineScope): void => {
    closeAll(scope)

    for (const child of iterateIR(ir)) {
        visitIsolatedIR(child, scope.replacements)
    }
}

const visitIsolatedIR = (ir: IR, replacements: Map<IR, IR>): void => {
    const scope = createScope(replacements)

    visitInlineIR(ir, scope)
    closeAll(scope)
}

const useTarget = (ir: Get, scope: InlineScope): void => {
    const candidate = scope.active.get(ir.target)
    if (!candidate) return

    if (!candidate.get) {
        candidate.get = ir
        return
    }

    candidate.blocked = true
    removeCandidate(candidate, scope)
}

const addCandidate = (ir: SetIR, scope: InlineScope): void => {
    const dependencies = new Set<object>()
    const trackCtx: TrackInlineIRContext = {
        sideEffects: new Set(),
        dependencies: new Map(),
    }

    if (trackInlineIR(ir.value, trackCtx, dependencies)) return

    const candidate: InlineCandidate = {
        target: ir.target,
        set: ir,
        dependencies,
        blocked: false,
    }

    scope.active.set(ir.target, candidate)

    for (const dependency of dependencies) {
        let candidates = scope.byDependency.get(dependency)
        if (!candidates) {
            candidates = new Set()
            scope.byDependency.set(dependency, candidates)
        }
        candidates.add(candidate)
    }
}

const closeTarget = (target: object, scope: InlineScope): void => {
    const candidate = scope.active.get(target)
    if (!candidate) return

    closeCandidate(candidate, scope)
}

const closeDependents = (target: object, scope: InlineScope): void => {
    const candidates = scope.byDependency.get(target)
    if (!candidates) return

    for (const candidate of [...candidates]) {
        closeCandidate(candidate, scope)
    }
}

const closeAll = (scope: InlineScope): void => {
    for (const candidate of [...scope.active.values()]) {
        closeCandidate(candidate, scope)
    }
}

const closeCandidate = (candidate: InlineCandidate, scope: InlineScope): void => {
    removeCandidate(candidate, scope)

    if (candidate.blocked) return
    if (!candidate.get) return

    scope.replacements.set(candidate.set, {
        stackTraces: candidate.set.stackTraces,
        env: candidate.set.env,

        type: 'Value',
        value: 0,
        thisValue: undefined,
        isSuper: false,
    })
    scope.replacements.set(candidate.get, candidate.set.value)
}

const removeCandidate = (candidate: InlineCandidate, scope: InlineScope): void => {
    if (scope.active.get(candidate.target) === candidate) {
        scope.active.delete(candidate.target)
    }

    for (const dependency of candidate.dependencies) {
        const candidates = scope.byDependency.get(dependency)
        if (!candidates) continue

        candidates.delete(candidate)
        if (!candidates.size) scope.byDependency.delete(dependency)
    }
}

const isSideEffectFree = (ir: Native): boolean => sideEffectFreeFuncs.includes(ir.func)
