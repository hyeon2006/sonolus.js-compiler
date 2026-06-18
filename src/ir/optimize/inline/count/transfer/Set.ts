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

    const refs = new Map(input.refs)
    let counts = input.counts

    if (oldElement) {
        const nextCounts = new Map(input.counts)

        refs.delete(ir.target)
        nextCounts.set(ir, targets?.has(ir.target) && nextCounts.has(ir) ? 'T' : oldElement)

        counts = nextCounts
    }

    if (targets?.size) {
        for (const target of targets) {
            if (!refs.has(target)) continue

            refs.set(target, 'T')
        }
    }

    return {
        refs,
        counts,
    }
}
