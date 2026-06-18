import { SimpleCallExpression } from 'estree'
import { compileESTree, CompileESTree } from '../index.js'
import { compileCallArgs } from '../utils/call.js'

export const compileCallExpression: CompileESTree<SimpleCallExpression> = (node, ctx) => {
    if (node.callee.type === 'Super') {
        const args = compileCallArgs(node, ctx)

        return ctx.Super(node, {
            instance: ctx.thisValue as object,
            prototype: ctx.prototype,
            args,
        })
    }

    const callee = compileESTree(node.callee, ctx)
    const args = compileCallArgs(node, ctx)

    return ctx.Call(node, {
        callee,
        args,
        optional: node.optional || isOptionalMemberCallee(node.callee),
    })
}

const isOptionalMemberCallee = (callee: SimpleCallExpression['callee']) =>
    callee.type === 'MemberExpression' && callee.optional
