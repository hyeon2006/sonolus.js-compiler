import { RuntimeFunction } from '@sonolus/core'
import { BaseIR, IR } from './index.js'

export type Native = BaseIR & {
    type: 'Native'
    func: RuntimeFunction
    args: IR[]
    validate?: (ir: Native) => void
}

export type NativeChildren = [...args: IR[]]
