import { Set } from '../../nodes/Set.js'
import { TransformIR } from './index.js'
import { transformIRAndGet } from './utils.js'

export const transformSet: TransformIR<Set> = (ir, ctx) => {
    const value = transformIRAndGet(ir.value, ctx)

    return value === ir.value ? ir : { ...ir, value }
}
