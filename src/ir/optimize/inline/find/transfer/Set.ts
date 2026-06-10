import { Set } from '../../../../nodes/Set.js'
import { TransferFindInlineStateIR } from './index.js'

export const transferFindInlineSet: TransferFindInlineStateIR<Set> = (ir, input) => {
    if (input.get(ir.target) === ir) return input

    const output = new Map(input)
    output.set(ir.target, ir)

    return output
}
