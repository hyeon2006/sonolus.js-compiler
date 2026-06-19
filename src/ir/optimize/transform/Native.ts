import { Native } from '../../nodes/Native.js'
import { Value } from '../../nodes/Value.js'
import { nativeOperations } from '../operations.js'
import { TransformIR } from './index.js'
import { isConstant, transformIRAndGet } from './utils.js'

export const transformNative: TransformIR<Native> = (ir, ctx) => {
    // Reference-preserving: only allocate a new args array (and node) when a
    // child actually changes, so re-transforming an unchanged subtree across the
    // optimizer's repeated passes does not churn the heap.
    let args = ir.args
    for (let i = 0; i < ir.args.length; i++) {
        const arg = transformIRAndGet(ir.args[i], ctx)
        if (arg === ir.args[i]) continue

        if (args === ir.args) args = [...ir.args]
        args[i] = arg
    }

    const result = nativeOperations[ir.func]
    if (!result) return args === ir.args ? ir : { ...ir, args }

    const [length, func] = result
    if (length !== Infinity && args.length !== length)
        return args === ir.args ? ir : { ...ir, args }

    const results = args.map(isConstant)
    if (!results.every((result): result is Value => !!result))
        return args === ir.args ? ir : { ...ir, args }

    return ctx.value(ir, func(...results.map((arg) => arg.value as number)))
}
