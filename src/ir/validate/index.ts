import { iterateIR } from '../iterate/index.js'
import { IR } from '../nodes/index.js'

export const validateIR = (ir: IR): void => {
    validateReachableIR(ir)
}

const validateReachableIR = (ir: IR): void => {
    switch (ir.type) {
        case 'Conditional':
            validateReachableIR(ir.test)
            validateSelectedConditionalBranch(ir)
            return
        case 'Execute':
            for (const child of ir.children) {
                validateReachableIR(child)
                if (child.type === 'Break' || child.type === 'Throw') break
            }
            return
        case 'Logical':
            validateReachableIR(ir.lhs)
            if (shouldValidateLogicalRhs(ir)) validateReachableIR(ir.rhs)
            return
        case 'Native':
            for (const arg of ir.args) {
                validateReachableIR(arg)
            }
            ir.validate?.(ir)
            return
        case 'Switch':
            validateReachableIR(ir.discriminant)
            validateSelectedSwitchBranch(ir)
            return
        default:
            break
    }

    for (const child of iterateIR(ir)) {
        validateReachableIR(child)
    }
}

const validateSelectedConditionalBranch = (ir: Extract<IR, { type: 'Conditional' }>): void => {
    const test = getConstant(ir.test)
    if (!test) {
        validateReachableIR(ir.consequent)
        validateReachableIR(ir.alternate)
        return
    }

    validateReachableIR(test.value ? ir.consequent : ir.alternate)
}

const shouldValidateLogicalRhs = (ir: Extract<IR, { type: 'Logical' }>): boolean => {
    const lhs = getConstant(ir.lhs)
    if (!lhs) return true

    switch (ir.operator) {
        case '||':
            return !lhs.value
        case '&&':
            return !!lhs.value
        case '??':
            return lhs.value === null || lhs.value === undefined
    }
}

const validateSelectedSwitchBranch = (ir: Extract<IR, { type: 'Switch' }>): void => {
    const discriminant = getConstant(ir.discriminant)
    if (!discriminant) {
        validateReachableIR(ir.defaultCase)
        for (const { test, consequent } of ir.cases) {
            validateReachableIR(test)
            validateReachableIR(consequent)
        }
        return
    }

    for (const { test, consequent } of ir.cases) {
        validateReachableIR(test)

        const testValue = getConstant(test)
        if (!testValue) {
            validateReachableIR(consequent)
            continue
        }

        if (discriminant.value !== testValue.value) continue

        validateReachableIR(consequent)
        return
    }

    validateReachableIR(ir.defaultCase)
}

const getConstant = (ir: IR): Extract<IR, { type: 'Value' }> | undefined => {
    switch (ir.type) {
        case 'Execute':
            return getConstant(ir.children[ir.children.length - 1])
        case 'Value':
            return ir
        default:
            return undefined
    }
}
