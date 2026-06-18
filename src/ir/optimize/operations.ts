import { BinaryOperator } from '../nodes/Binary.js'
import { UnaryOperator } from '../nodes/Unary.js'

export const binaryOperations: Record<BinaryOperator, (lhs: unknown, rhs: unknown) => unknown> = {
    '==': (lhs, rhs) => lhs == rhs,
    '!=': (lhs, rhs) => lhs != rhs,
    '===': (lhs, rhs) => lhs === rhs,
    '!==': (lhs, rhs) => lhs !== rhs,
    '<': (lhs, rhs) => (lhs as never) < (rhs as never),
    '<=': (lhs, rhs) => (lhs as never) <= (rhs as never),
    '>': (lhs, rhs) => (lhs as never) > (rhs as never),
    '>=': (lhs, rhs) => (lhs as never) >= (rhs as never),
    '<<': (lhs, rhs) => (lhs as never) << (rhs as never),
    '>>': (lhs, rhs) => (lhs as never) >> (rhs as never),
    '>>>': (lhs, rhs) => (lhs as never) >>> (rhs as never),
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    '+': (lhs, rhs) => (lhs as never) + rhs,
    '-': (lhs, rhs) => (lhs as never) - (rhs as never),
    '*': (lhs, rhs) => (lhs as never) * (rhs as never),
    '/': (lhs, rhs) => (lhs as never) / (rhs as never),
    '%': (lhs, rhs) => (lhs as never) % (rhs as never),
    '**': (lhs, rhs) => (lhs as never) ** (rhs as never),
    '|': (lhs, rhs) => (lhs as never) | (rhs as never),
    '^': (lhs, rhs) => (lhs as never) ^ (rhs as never),
    '&': (lhs, rhs) => (lhs as never) & (rhs as never),
    in: (lhs, rhs) => isInTarget(rhs) && (lhs as PropertyKey) in rhs,
    instanceof: (lhs, rhs) => typeof rhs === 'function' && lhs instanceof rhs,
}

export const unaryOperations: Record<UnaryOperator, (arg: unknown) => unknown> = {
    '-': (arg) => -(arg as never),
    '+': (arg) => +(arg as never),
    '!': (arg) => !arg,
    '~': (arg) => ~(arg as never),
    typeof: (arg) => typeof arg,
}

const isInTarget = (value: unknown): value is object =>
    (typeof value === 'object' && value !== null) || typeof value === 'function'
