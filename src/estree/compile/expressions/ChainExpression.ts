import { ChainExpression } from 'estree'
import { compileESTree, CompileESTree } from '../index.js'

export const compileChainExpression: CompileESTree<ChainExpression> = (node, ctx) =>
    compileESTree(node.expression, ctx)
