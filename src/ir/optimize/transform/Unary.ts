import { Unary } from '../../nodes/Unary.js'
import { unaryOperations } from '../operations.js'
import { TransformIR } from './index.js'
import { isConstant, rewriteAsExecute, transformIRAndGet } from './utils.js'

export const transformUnary: TransformIR<Unary> = (ir, ctx) => {
    const arg = transformIRAndGet(ir.arg, ctx)

    const result = isConstant(arg)
    if (!result) return arg === ir.arg ? ir : { ...ir, arg }

    const operation = unaryOperations[ir.operator]

    let value: unknown
    try {
        value = operation(result.value)
    } catch {
        return arg === ir.arg ? ir : { ...ir, arg }
    }

    return rewriteAsExecute(ir, ctx, [arg, ctx.value(ir, value)])
}
