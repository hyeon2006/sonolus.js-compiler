import { Conditional } from '../../nodes/Conditional.js'
import { IR } from '../../nodes/index.js'
import { TransformIRContext } from './context.js'
import { TransformIR } from './index.js'
import { isConstant, rewriteAsExecute, transformIRAndGet } from './utils.js'
import { createCopyObjectChildren, createObjectBuffer, getObjectResult } from './utils/object.js'

export const transformConditional: TransformIR<Conditional> = (ir, ctx) => {
    const test = transformIRAndGet(ir.test, ctx)

    const result = isConstant(test)
    if (result) return transformIRAndGet(result.value ? ir.consequent : ir.alternate, ctx)

    const consequent = transformIRAndGet(ir.consequent, ctx)
    const alternate = transformIRAndGet(ir.alternate, ctx)

    return (
        transformObjectConditional(ir, test, consequent, alternate, ctx) ??
        (test === ir.test && consequent === ir.consequent && alternate === ir.alternate
            ? ir
            : { ...ir, test, consequent, alternate })
    )
}

const transformObjectConditional = (
    ir: Conditional,
    test: IR,
    consequent: IR,
    alternate: IR,
    ctx: TransformIRContext,
): IR | undefined => {
    const consequentResult = getObjectResult(consequent)
    if (!consequentResult) return

    const alternateResult = getObjectResult(alternate)
    if (!alternateResult) return

    const buffer = createObjectBuffer(consequentResult.value, ctx)
    if (!buffer) return

    const consequentChildren = createCopyObjectChildren(ir, consequent, buffer, ctx)
    if (!consequentChildren) return

    const alternateChildren = createCopyObjectChildren(ir, alternate, buffer, ctx)
    if (!alternateChildren) return

    return rewriteAsExecute(ir, ctx, [
        ctx.Conditional(ir, {
            test,
            consequent: rewriteAsExecute(ir, ctx, consequentChildren),
            alternate: rewriteAsExecute(ir, ctx, alternateChildren),
        }),
        ctx.value(ir, buffer.value),
    ])
}
