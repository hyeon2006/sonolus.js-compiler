import { IR } from '../../../../nodes/index.js'
import { Set } from '../../../../nodes/Set.js'
import { Value } from '../../../../nodes/Value.js'
import { binaryOperations, unaryOperations } from '../../../operations.js'
import { PropagateState } from '../state.js'
import { TransferPropagateIR } from './index.js'

type Evaluated = Value | 'T' | undefined

const evaluate = (ir: IR, state: PropagateState): Evaluated => {
    switch (ir.type) {
        case 'Value':
            return ir
        case 'Get':
            return state.get(ir.target)
        case 'Binary': {
            const lhs = evaluate(ir.lhs, state)
            if (lhs === undefined) return undefined

            const rhs = evaluate(ir.rhs, state)
            if (rhs === undefined) return undefined

            if (lhs === 'T' || rhs === 'T') return 'T'

            let value
            try {
                value = binaryOperations[ir.operator](lhs.value, rhs.value)
            } catch {
                return 'T'
            }

            return {
                stackTraces: ir.stackTraces,
                env: ir.env,

                type: 'Value',
                value,
                thisValue: undefined,
                isSuper: false,
            }
        }
        case 'Unary': {
            const arg = evaluate(ir.arg, state)
            if (arg === undefined) return undefined

            if (arg === 'T') return 'T'

            let value
            try {
                value = unaryOperations[ir.operator](arg.value)
            } catch {
                return 'T'
            }

            return {
                stackTraces: ir.stackTraces,
                env: ir.env,

                type: 'Value',
                value,
                thisValue: undefined,
                isSuper: false,
            }
        }
        default:
            return 'T'
    }
}

export const transferPropagateSet: TransferPropagateIR<Set> = (ir, input, oldOutput) => {
    let element = evaluate(ir.value, input)

    if (element !== undefined && oldOutput) {
        const old = oldOutput.get(ir.target)
        if (old === 'T') {
            element = 'T'
        } else if (old !== undefined && element !== 'T' && old.value !== element.value) {
            element = 'T'
        }
    }

    const existing = input.get(ir.target)

    if (element === undefined) {
        if (existing === undefined) return input

        const output = new Map(input)
        output.delete(ir.target)

        return output
    }

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
