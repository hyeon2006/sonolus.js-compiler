import { createCompileESTreeContext } from '../../../estree/compile/context.js'
import { compileFunctionCall } from '../../../estree/compile/utils/function.js'
import { hasIntrinsicCall } from '../../../intrinsic/has.js'
import { Intrinsic } from '../../../intrinsic/index.js'
import { compileJSFunction } from '../../../js/compile/function.js'
import { searchPrototype } from '../../../utils/prototype.js'
import { Call } from '../../nodes/Call.js'
import { IR } from '../../nodes/index.js'
import { transformIR, TransformIR } from './index.js'
import { isConstant, rewriteAsExecute, transformIRAndGet } from './utils.js'

export const transformCall: TransformIR<Call> = (ir, ctx) => {
    const callee = transformIR(ir.callee, ctx)

    const calleeResult = isConstant(callee)
    if (ir.optional && calleeResult && isNullish(calleeResult.value))
        return rewriteAsExecute(ir, ctx, [callee, ctx.value(ir, undefined)])

    const args = transformIRAndGet(ir.args, ctx)

    if (!calleeResult) return { ...ir, callee, args }

    const argsResult = isConstant(args)
    if (!argsResult) return { ...ir, callee, args }

    if (hasIntrinsicCall(calleeResult.value))
        return rewriteAsExecute(ir, ctx, [
            callee,
            args,
            calleeResult.value[Intrinsic.Call](
                ir,
                calleeResult.thisValue,
                argsResult.value as unknown[],
                ctx,
            ),
        ])

    if (typeof calleeResult.value !== 'function') return { ...ir, callee, args }

    const calls = callFunction(
        ir,
        calleeResult.thisValue,
        calleeResult.value,
        argsResult.value as unknown[],
    )
    if (!calls) return { ...ir, callee, args }

    return rewriteAsExecute(ir, ctx, [callee, args, ...calls])
}

const isNullish = (value: unknown) => value === null || value === undefined

const callFunction = (ir: IR, thisValue: unknown, func: Function, args: unknown[]) => {
    const node = compileJSFunction(func)
    if (!node) return

    const prototype = searchPrototype(thisValue, func)
    const estreeCtx = createCompileESTreeContext(
        ir.stackTraces,
        thisValue,
        prototype,
        bindPrototypeConstructor(ir.env, prototype),
    )
    return compileFunctionCall(node, node.params, node.body, args, estreeCtx)
}

const bindPrototypeConstructor = (env: IR['env'], prototype: unknown): IR['env'] => {
    if (!prototype || typeof prototype !== 'object') return env

    const ctor = (prototype as { constructor?: unknown }).constructor
    if (typeof ctor !== 'function' || !ctor.name) return env

    return {
        ...env,

        lexical: {
            get: (name) => (name === ctor.name ? ctor : env.lexical.get(name)),
            set: (ir, name, value, ctx) => env.lexical.set(ir, name, value, ctx),
        },
    }
}
