import { Logical, LogicalOperator } from '../../nodes/Logical.js'
import { TransformIR, transformIR } from './index.js'
import { isConstant, isResolved, rewriteAsExecute, transformIRAndGet } from './utils.js'

export const transformLogical: TransformIR<Logical> = (ir, ctx) => {
    if (ir.operator === '??') return transformNullish(ir, ctx)

    const lhs = transformIRAndGet(ir.lhs, ctx)
    const rhs = transformIRAndGet(ir.rhs, ctx)

    const result = isConstant(lhs)
    if (!result) return { ...ir, lhs, rhs }

    const operation = operations[ir.operator]
    const value = operation(result.value, {})

    return rewriteAsExecute(ir, ctx, [lhs, value === result.value ? ctx.value(ir, value) : rhs])
}

const transformNullish: TransformIR<Logical> = (ir, ctx) => {
    const lhs = transformIR(ir.lhs, ctx)
    const rhs = transformIRAndGet(ir.rhs, ctx)

    const result = isConstant(lhs)
    if (result)
        return result.value === null || result.value === undefined
            ? rewriteAsExecute(ir, ctx, [lhs, rhs])
            : lhs

    if (isResolved(lhs)) return lhs

    return { ...ir, lhs, rhs }
}

const operations: Record<LogicalOperator, (lhs: unknown, rhs: unknown) => unknown> = {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    '||': (lhs, rhs) => lhs || rhs,
    '&&': (lhs, rhs) => lhs && rhs,
    '??': (lhs, rhs) => lhs ?? rhs,
}
