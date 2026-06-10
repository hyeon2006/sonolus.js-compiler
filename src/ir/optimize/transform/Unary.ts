import { Unary } from '../../nodes/Unary.js'
import { unaryOperations } from '../operations.js'
import { TransformIR } from './index.js'
import { isConstant, rewriteAsExecute, transformIRAndGet } from './utils.js'

export const transformUnary: TransformIR<Unary> = (ir, ctx) => {
    const arg = transformIRAndGet(ir.arg, ctx)

    const result = isConstant(arg)
    if (!result) return { ...ir, arg }

    const operation = unaryOperations[ir.operator]

    return rewriteAsExecute(ir, ctx, [arg, ctx.value(ir, operation(result.value))])
}
