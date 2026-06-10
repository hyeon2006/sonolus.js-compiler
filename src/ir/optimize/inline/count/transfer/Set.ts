import { Set } from '../../../../nodes/Set.js'
import { TransferCountInlineStateIR } from './index.js'

export const transferCountInlineSet: TransferCountInlineStateIR<Set> = (
    ir,
    input,
    dependencies,
) => {
    const oldElement = input.refs.get(ir.target)
    const targets = dependencies.get(ir.target)

    if (!oldElement) {
        if (!targets?.size) return input

        let needed = false
        for (const target of targets) {
            const element = input.refs.get(target)
            if (element !== undefined && element !== 'T') {
                needed = true
                break
            }
        }
        if (!needed) return input
    }

    const output = {
        refs: new Map(input.refs),
        counts: new Map(input.counts),
    }

    if (oldElement) {
        output.refs.delete(ir.target)
        output.counts.set(ir, targets?.has(ir.target) && output.counts.has(ir) ? 'T' : oldElement)
    }

    if (targets?.size) {
        for (const target of targets) {
            if (!output.refs.has(target)) continue

            output.refs.set(target, 'T')
        }
    }

    return output
}
