import { hasIntrinsicGet } from '../../../intrinsic/has.js'
import { Intrinsic } from '../../../intrinsic/index.js'
import { Value } from '../../nodes/Value.js'
import { IR } from '../../nodes/index.js'
import { TransformIRContext } from './context.js'
import { transformIR } from './index.js'

export const rewriteAsExecute = (ir: IR, ctx: TransformIRContext, children: IR[]): IR =>
    transformIR(
        ctx.Execute(ir, {
            children,
        }),
        ctx,
    )

// Membership = "re-transforming this node reproduces it unchanged with no side
// effects". A plain Set (faster than WeakSet at this call volume), reset at the
// start of every transform pass via `resetCleanIR` — transform always produces
// fresh nodes, so no identity is shared across passes and stale marks are never
// queried; resetting also bounds memory to a single pass.
const cleanIR = new Set<IR>()

export const resetCleanIR = (): void => {
    cleanIR.clear()
}

// A node is "clean" iff its `transform` is idempotent AND mutates no shared
// state, AND every child is clean (so one non-clean descendant taints the whole
// subtree). The switch lists ONLY the idempotent, non-mutating types.
//
// Deliberately omitted (re-transforming them is NOT idempotent — they mutate
// shared buffers or lexical scope, and the two-pass `transformIRAndGet` relies
// on running them twice): every Array/Object Constructor* node (push into a
// shared `array`), every Array/Object Destructor* node (consume `target`
// elements/keys), Declare/Call/New/JSCall/Super (lexical scope side effects),
// Reference (lexical resolution), Member/Assign/ForOf (intrinsic get/set
// expansion), and Block/Switch (break rewriting / object-return buffers).
//
// Direct per-type child checks avoid `iterateIR` (which would allocate a
// children array on every call); this runs once per transform result.
const isCleanIR = (ir: IR): boolean => {
    switch (ir.type) {
        case 'Value':
        case 'Get':
            return true
        case 'Unary':
            return cleanIR.has(ir.arg)
        case 'Throw':
            return cleanIR.has(ir.arg)
        case 'Set':
        case 'Break':
            return cleanIR.has(ir.value)
        case 'Binary':
        case 'Logical':
            return cleanIR.has(ir.lhs) && cleanIR.has(ir.rhs)
        case 'While':
            return cleanIR.has(ir.test) && cleanIR.has(ir.body)
        case 'DoWhile':
            return cleanIR.has(ir.body) && cleanIR.has(ir.test)
        case 'Conditional':
            return cleanIR.has(ir.test) && cleanIR.has(ir.consequent) && cleanIR.has(ir.alternate)
        case 'Native':
            return allCleanIR(ir.args)
        case 'Execute':
            return allCleanIR(ir.children)
        default:
            return false
    }
}

const allCleanIR = (irs: readonly IR[]): boolean => {
    for (const ir of irs) {
        if (!cleanIR.has(ir)) return false
    }

    return true
}

// Records, for every transform result, whether re-transforming it is a no-op.
// Wrapped around the `transformIR` dispatcher so children are marked before
// their parents are inspected (bottom-up), making `isCleanIR` an O(children)
// lookup rather than a full re-walk.
export const markCleanIR = (ir: IR): IR => {
    if (isCleanIR(ir)) cleanIR.add(ir)
    return ir
}

export const transformIRAndGet = (ir: IR, ctx: TransformIRContext): IR => {
    const transformed = transformIR(ir, ctx)
    const unwrapped = unwrapIRGet(transformed, ctx)

    // When `unwrapIRGet` is a no-op and the already-transformed operand is clean
    // (idempotent + no shared-state mutation), the second transform is
    // guaranteed to reproduce it unchanged. Skipping it avoids re-descending the
    // subtree, which otherwise compounds exponentially on nested expressions
    // (`a + b + c + …`). Stateful nodes are never clean, so they still take the
    // full two-pass path they depend on.
    if (unwrapped === transformed && cleanIR.has(transformed)) return transformed

    return transformIR(unwrapped, ctx)
}

export const unwrapIRGet = (ir: IR, ctx: TransformIRContext): IR => {
    switch (ir.type) {
        case 'Execute': {
            // Preserve identity when the tail does not actually unwrap, so the
            // no-op check in `transformIRAndGet` can fire for Execute operands.
            // This is only safe because that skip is additionally gated on the
            // Execute being clean (no stateful descendant).
            const last = ir.children[ir.children.length - 1]
            const unwrappedLast = unwrapIRGet(last, ctx)
            if (unwrappedLast === last) return ir

            return ctx.Execute(ir, {
                children: [...ir.children.slice(0, -1), unwrappedLast],
            })
        }
        case 'Value':
            if (!hasIntrinsicGet(ir.value)) return ir

            return ir.value[Intrinsic.Get](ir, ctx)
        default:
            return ir
    }
}

export const isResolved = (ir: IR): boolean => {
    switch (ir.type) {
        case 'Binary':
        case 'Block':
        case 'Break':
        case 'Conditional':
        case 'Declare':
        case 'DoWhile':
        case 'Execute':
        case 'Get':
        case 'Logical':
        case 'Native':
        case 'Set':
        case 'Unary':
        case 'Value':
        case 'While':
            return true
        default:
            return false
    }
}

export const isConstant = (ir: IR): Value | undefined => {
    switch (ir.type) {
        case 'Execute':
            return isConstant(ir.children[ir.children.length - 1])
        case 'Value':
            return ir
        default:
            return
    }
}

export const isReference = (ir: IR): Value | undefined => {
    switch (ir.type) {
        case 'Execute':
            return isReference(ir.children[ir.children.length - 1])
        case 'Value':
            if (typeof ir.value === 'number' || typeof ir.value === 'boolean') return

            return ir
        default:
            return
    }
}
