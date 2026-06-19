import { Logical } from '../../nodes/Logical.js'
import { TransformIR, transformIR } from './index.js'
import { isConstant, isResolved, rewriteAsExecute, transformIRAndGet } from './utils.js'

export const transformLogical: TransformIR<Logical> = (ir, ctx) => {
    if (ir.operator === '??') return transformNullish(ir, ctx)

    const lhs = transformIRAndGet(ir.lhs, ctx)

    const result = isConstant(lhs)
    if (result) {
        const evaluatesRhs = ir.operator === '||' ? !result.value : !!result.value

        return rewriteAsExecute(ir, ctx, [
            lhs,
            evaluatesRhs ? transformIRAndGet(ir.rhs, ctx) : ctx.value(ir, result.value),
        ])
    }

    const rhs = transformIRAndGet(ir.rhs, ctx)
    return lhs === ir.lhs && rhs === ir.rhs ? ir : { ...ir, lhs, rhs }
}

const transformNullish: TransformIR<Logical> = (ir, ctx) => {
    const lhs = transformIR(ir.lhs, ctx)

    const result = isConstant(lhs)
    if (result)
        return result.value === null || result.value === undefined
            ? rewriteAsExecute(ir, ctx, [lhs, transformIRAndGet(ir.rhs, ctx)])
            : lhs

    if (isResolved(lhs)) return lhs

    const rhs = transformIRAndGet(ir.rhs, ctx)

    return lhs === ir.lhs && rhs === ir.rhs ? ir : { ...ir, lhs, rhs }
}
