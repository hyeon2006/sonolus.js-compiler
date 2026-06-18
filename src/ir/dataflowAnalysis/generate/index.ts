import { Block } from '../../nodes/Block.js'
import { IR } from '../../nodes/index.js'
import { Graph } from '../graph.js'
import { ConnectIRContext } from './connect/context.js'
import { connectIR } from './connect/index.js'

export const generate = (ir: IR, irs: IR[]): Graph => {
    const indexes = new Map<IR, number>()
    const blocks = new Map<object, Block>()
    for (let index = 0; index < irs.length; index++) {
        const ir = irs[index]
        indexes.set(ir, index)
        if (ir.type === 'Block') blocks.set(ir.target, ir)
    }

    const ctx: ConnectIRContext = {
        blocks,
        ins: new Map(),
    }

    connectIR(ir, [], ctx)

    const outs = new Map<IR, Set<IR>>()

    for (const [inKey, inValues] of ctx.ins) {
        for (const outKey of inValues) {
            let outValues = outs.get(outKey)
            if (!outValues) {
                if (!indexes.has(outKey)) throw new Error('Unexpected missing values')

                outValues = new Set()
                outs.set(outKey, outValues)
            }
            outValues.add(inKey)
        }
    }

    return {
        indexes,
        ins: ctx.ins,
        outs: outs,
    }
}
