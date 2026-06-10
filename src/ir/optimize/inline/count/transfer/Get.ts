import { Get } from '../../../../nodes/Get.js'
import { TransferCountInlineStateIR } from './index.js'

export const transferCountInlineGet: TransferCountInlineStateIR<Get> = (ir, input) => {
    const oldElement = input.refs.get(ir.target)
    if (oldElement === 'T') return input

    const outputRefs = new Map(input.refs)
    outputRefs.set(ir.target, oldElement ? 'T' : 1)

    return {
        refs: outputRefs,
        counts: input.counts,
    }
}
