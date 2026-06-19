import { Native } from '../../nodes/Native.js'
import { Value } from '../../nodes/Value.js'
import { nativeOperations } from '../operations.js'
import { TransformIR } from './index.js'
import { isConstant, transformIRAndGet } from './utils.js'

export const transformNative: TransformIR<Native> = (ir, ctx) => {
    const args = ir.args.map((arg) => transformIRAndGet(arg, ctx))

    const result = nativeOperations[ir.func]
    if (!result) return { ...ir, args }

    const [length, func] = result
    if (length !== Infinity && args.length !== length) return { ...ir, args }

    const results = args.map(isConstant)
    if (!results.every((result): result is Value => !!result)) return { ...ir, args }

    return ctx.value(ir, func(...results.map((arg) => arg.value as number)))
}
