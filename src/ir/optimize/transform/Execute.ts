import { sideEffectFreeFuncs } from '../../../utils/funcs.js'
import { Execute } from '../../nodes/Execute.js'
import { IR } from '../../nodes/index.js'
import { TransformIRContext } from './context.js'
import { transformIR, TransformIR } from './index.js'

export const transformExecute: TransformIR<Execute> = (ir, ctx) => {
    const children: IR[] = []
    for (const [i, child] of ir.children.entries()) {
        appendExpand(children, transformIR(child, ctx), i === ir.children.length - 1, ctx)
    }

    const cutOffIndex = children.findIndex(
        (child) => child.type === 'Break' || child.type === 'Throw',
    )
    if (cutOffIndex !== -1) {
        children.length = cutOffIndex + 1
    }

    if (children.length === 0) return ctx.zero(ir)
    if (children.length === 1) return children[0]

    return sameChildren(ir.children, children) ? ir : { ...ir, children }
}

const sameChildren = (a: readonly IR[], b: readonly IR[]): boolean => {
    if (a.length !== b.length) return false

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }

    return true
}

// Wraps an already-discard-expanded child list into an Execute WITHOUT
// re-transforming it: mirrors `transformExecute`'s tail (cut off after a
// Break/Throw, then collapse empty/single) but skips the per-child transform.
// `expandDiscard` already produced a fully discard-expanded, flat list, so the
// re-transform that `rewriteAsExecute` would do is a structural no-op — yet it
// re-descends every child and, because the discard branches are rebuilt fresh
// each pass, compounds into millions of redundant re-transforms on large bodies.
const buildDiscardExecute = (ir: IR, children: IR[], ctx: TransformIRContext): IR => {
    const cutOffIndex = children.findIndex(
        (child) => child.type === 'Break' || child.type === 'Throw',
    )
    if (cutOffIndex !== -1) {
        children.length = cutOffIndex + 1
    }

    if (children.length === 0) return ctx.zero(ir)
    if (children.length === 1) return children[0]

    return ctx.Execute(ir, { children })
}

const appendExpand = (
    children: IR[],
    ir: IR,
    shouldPreserve: boolean,
    ctx: TransformIRContext,
): void => {
    if (shouldPreserve) {
        append(children, expandPreserve(ir))
    } else {
        expandDiscardInto(children, ir, ctx)
    }
}

const append = (children: IR[], values: IR[]): void => {
    for (const value of values) {
        children.push(value)
    }
}

const expandPreserve = (ir: IR): IR[] => {
    switch (ir.type) {
        case 'Execute':
            return ir.children
        default:
            return [ir]
    }
}

const expandDiscard = (ir: IR, ctx: TransformIRContext): IR[] => {
    const children: IR[] = []
    expandDiscardInto(children, ir, ctx)

    return children
}

const expandDiscardInto = (children: IR[], ir: IR, ctx: TransformIRContext): void => {
    switch (ir.type) {
        case 'Binary':
            expandDiscardInto(children, ir.lhs, ctx)
            expandDiscardInto(children, ir.rhs, ctx)
            return
        case 'Conditional':
            children.push(
                ctx.Conditional(ir, {
                    test: ir.test,
                    consequent: buildDiscardExecute(ir, expandDiscard(ir.consequent, ctx), ctx),
                    alternate: buildDiscardExecute(ir, expandDiscard(ir.alternate, ctx), ctx),
                }),
            )
            return
        case 'Execute':
            for (const child of ir.children) {
                expandDiscardInto(children, child, ctx)
            }
            return
        case 'Logical':
            children.push(
                ctx.Logical(ir, {
                    operator: ir.operator,
                    lhs: ir.lhs,
                    rhs: buildDiscardExecute(ir, expandDiscard(ir.rhs, ctx), ctx),
                }),
            )
            return
        case 'Native':
            if (!sideEffectFreeFuncs.includes(ir.func)) {
                children.push(ir)
                return
            }

            for (const arg of ir.args) {
                expandDiscardInto(children, arg, ctx)
            }
            return
        case 'Unary':
            expandDiscardInto(children, ir.arg, ctx)
            return
        case 'Get':
        case 'Member':
        case 'Reference':
        case 'Value':
            return
        default:
            children.push(ir)
            return
    }
}
