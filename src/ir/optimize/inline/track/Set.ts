import { Set } from '../../../nodes/Set.js'
import { TrackInlineIR, trackInlineIR } from './index.js'

export const trackInlineSet: TrackInlineIR<Set> = (ir, ctx, dependencies) => {
    const valueDependencies = new globalThis.Set<object>()
    const sideEffect = trackInlineIR(ir.value, ctx, valueDependencies)

    if (sideEffect) ctx.sideEffects.add(ir)

    for (const dependency of valueDependencies) {
        const targets = ctx.dependencies.get(dependency)
        if (targets) {
            targets.add(ir.target)
        } else {
            ctx.dependencies.set(dependency, new globalThis.Set([ir.target]))
        }

        dependencies.add(dependency)
    }

    return sideEffect
}
