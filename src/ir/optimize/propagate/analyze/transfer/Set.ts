import { Set } from '../../../../nodes/Set.js'
import { TransferPropagateIR } from './index.js'

export const transferPropagateSet: TransferPropagateIR<Set> = (ir, input) => {
    const element = ir.value.type === 'Value' ? ir.value : 'T'

    const existing = input.get(ir.target)
    if (existing === element) return input
    if (
        existing !== undefined &&
        existing !== 'T' &&
        element !== 'T' &&
        existing.value === element.value
    )
        return input

    const output = new Map(input)
    output.set(ir.target, element)

    return output
}
