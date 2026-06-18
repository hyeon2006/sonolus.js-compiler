import { MemberExpression } from 'estree'
import { compileESTree, CompileESTree } from '../index.js'
import { compileObjectKey } from '../utils/object.js'

export const compileMemberExpression: CompileESTree<MemberExpression> = (node, ctx) => {
    return ctx.Member(node, {
        object: compileESTree(node.object, ctx),
        key: compileObjectKey(node.property, node.computed, ctx),
        optional: node.optional,
    })
}
