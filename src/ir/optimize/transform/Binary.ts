import { Binary } from '../../nodes/Binary.js'
import { binaryOperations } from '../operations.js'
import { TransformIR } from './index.js'
import { isConstant, rewriteAsExecute, transformIRAndGet } from './utils.js'

export const transformBinary: TransformIR<Binary> = (ir, ctx) => {
    const lhs = transformIRAndGet(ir.lhs, ctx)
    const rhs = transformIRAndGet(ir.rhs, ctx)

    const lhsResult = isConstant(lhs)
    const rhsResult = isConstant(rhs)
    if (!lhsResult || !rhsResult) return { ...ir, lhs, rhs }

    const operation = binaryOperations[ir.operator]

    return rewriteAsExecute(ir, ctx, [
        lhs,
        rhs,
        ctx.value(ir, operation(lhsResult.value, rhsResult.value)),
    ])
}
