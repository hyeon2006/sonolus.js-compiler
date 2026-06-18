import { sideEffectFreeFuncs } from '../../../../../utils/funcs.js'
import { Native } from '../../../../nodes/Native.js'
import { TransferCountInlineStateIR } from './index.js'

export const transferCountInlineNative: TransferCountInlineStateIR<Native> = (ir, input) => {
    if (sideEffectFreeFuncs.includes(ir.func)) return input

    const refs = new Map<object, 'T'>()
    for (const target of input.refs.keys()) {
        refs.set(target, 'T')
    }

    return {
        refs,
        counts: input.counts,
    }
}
