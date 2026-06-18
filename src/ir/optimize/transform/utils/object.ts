import { hasIntrinsicGet } from '../../../../intrinsic/has.js'
import { Intrinsic } from '../../../../intrinsic/index.js'
import { IR } from '../../../nodes/index.js'
import { Value } from '../../../nodes/Value.js'
import { TransformIRContext } from '../context.js'
import { isConstant, transformIRAndGet } from '../utils.js'

export type ObjectSlot = {
    path: string[]
    target: Intrinsic<'Get' | 'Set'>
}

export type ObjectBuffer = {
    value: unknown
    slots: ObjectSlot[]
}

export const getObjectResult = (ir: IR): Value | undefined => {
    const result = isConstant(ir)
    if (!result || !isObject(result.value) || hasIntrinsicGet(result.value)) return

    return result
}

export const createObjectBuffer = (
    value: unknown,
    ctx: TransformIRContext,
): ObjectBuffer | undefined => {
    const slots: ObjectSlot[] = []
    const buffer = createBufferValue(value, [], slots, ctx)
    if (!buffer || !slots.length) return

    return {
        value: buffer,
        slots,
    }
}

export const createCopyObjectChildren = (
    ir: IR,
    sourceIR: IR,
    buffer: ObjectBuffer,
    ctx: TransformIRContext,
): IR[] | undefined => {
    const result = getObjectResult(sourceIR)
    if (!result) return

    const children = [sourceIR]
    for (const { path, target } of buffer.slots) {
        const source = getPath(result.value, path)
        if (!isLeaf(source)) return

        children.push(target[Intrinsic.Set](ir, transformIRAndGet(ctx.value(ir, source), ctx), ctx))
    }

    return children
}

const createBufferValue = (
    value: unknown,
    path: string[],
    slots: ObjectSlot[],
    ctx: TransformIRContext,
): unknown => {
    if (isLeaf(value)) {
        const target = ctx.allocate()
        slots.push({
            path,
            target,
        })

        return target
    }

    if (!isObject(value)) return

    const result = createObjectLike(value)
    for (const key of Object.keys(value)) {
        const child = createBufferValue(getKey(value, key), [...path, key], slots, ctx)
        if (!child) return

        setKey(result, key, child)
    }

    return result
}

const isLeaf = (value: unknown) =>
    typeof value === 'number' || typeof value === 'boolean' || hasIntrinsicGet(value)

const isObject = (value: unknown): value is object => !!value && typeof value === 'object'

const createObjectLike = (value: object): object => {
    if (Array.isArray(value)) return []

    const prototype = Object.getPrototypeOf(value) as object | null
    return Object.create(prototype) as object
}

const getPath = (value: unknown, path: string[]) => {
    let result = value

    for (const key of path) {
        if (!isObject(result)) return

        result = getKey(result, key)
    }

    return result
}

const getKey = (value: object, key: string) => (value as Record<string, unknown>)[key]

const setKey = (value: object, key: string, child: unknown) => {
    ;(value as Record<string, unknown>)[key] = child
}
