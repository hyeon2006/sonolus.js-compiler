// This module is a pure numeric lookup table; every function takes and returns
// `number`s as declared by the `nativeOperations`/`binaryOperations` types, so
// per-arrow parameter/return annotations would only add noise.
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { RuntimeFunction } from '@sonolus/core'
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

const reducer =
    (fn: (a: number, b: number) => number) =>
    (...values: number[]) => {
        if (!values.length) return 0

        const [head, ...rest] = values
        if (!rest.length) return head

        let sum = head
        for (const value of rest) {
            sum = fn(sum, value)
        }

        return sum
    }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

const lerp = (x: number, y: number, s: number) => x * (1 - s) + y * s

const unlerp = (a: number, b: number, x: number) => (x - a) / (b - a)

export const nativeOperations: Partial<
    Record<RuntimeFunction, [length: number, func: (...values: number[]) => number]>
> = {
    Add: [Infinity, reducer((a, b) => a + b)],
    Multiply: [Infinity, reducer((a, b) => a * b)],
    Divide: [Infinity, reducer((a, b) => a / b)],
    Rem: [Infinity, reducer((a, b) => a % b)],
    Mod: [Infinity, reducer((a, b) => ((a % b) + b) % b)],
    Power: [Infinity, reducer((a, b) => a ** b)],
    Log: [1, Math.log],
    Negate: [1, (x) => -x],

    Equal: [2, (a, b) => +(a === b)],
    NotEqual: [2, (a, b) => +(a !== b)],
    Greater: [2, (a, b) => +(a > b)],
    GreaterOr: [2, (a, b) => +(a >= b)],
    Less: [2, (a, b) => +(a < b)],
    LessOr: [2, (a, b) => +(a <= b)],

    Not: [1, (x) => +!x],

    Abs: [1, Math.abs],
    Sign: [1, Math.sign],
    Min: [2, Math.min],
    Max: [2, Math.max],

    Ceil: [1, Math.ceil],
    Floor: [1, Math.floor],
    Round: [1, Math.round],
    Frac: [1, (x) => x - Math.floor(x)],
    Trunc: [1, Math.trunc],

    Degree: [1, (x) => (x * 180) / Math.PI],
    Radian: [1, (x) => (x * Math.PI) / 180],

    Sin: [1, Math.sin],
    Cos: [1, Math.cos],
    Tan: [1, Math.tan],

    Sinh: [1, Math.sinh],
    Cosh: [1, Math.cosh],
    Tanh: [1, Math.tanh],

    Arcsin: [1, Math.asin],
    Arccos: [1, Math.acos],
    Arctan: [1, Math.atan],
    Arctan2: [2, Math.atan2],

    Clamp: [3, clamp],
    Lerp: [3, lerp],
    LerpClamped: [3, (x, y, s) => lerp(x, y, clamp(s, 0, 1))],
    Unlerp: [3, unlerp],
    UnlerpClamped: [3, (a, b, x) => clamp(unlerp(a, b, x), 0, 1)],
    Remap: [5, (a, b, c, d, x) => lerp(c, d, unlerp(a, b, x))],
    RemapClamped: [5, (a, b, c, d, x) => lerp(c, d, clamp(unlerp(a, b, x), 0, 1))],
}
