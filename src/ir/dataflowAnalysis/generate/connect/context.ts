import { IR } from '../../../nodes/index.js'

export type ConnectIRContext = {
    blocks: ReadonlyMap<object, IR>
    ins: Map<IR, Set<IR>>
}

export const connectIns = (ir: IR, inputs: IR[], ctx: ConnectIRContext): void => {
    if (!inputs.length) return

    let ins = ctx.ins.get(ir)
    if (!ins) {
        ins = new Set()
        ctx.ins.set(ir, ins)
    }

    for (const input of inputs) {
        ins.add(input)
    }
}
