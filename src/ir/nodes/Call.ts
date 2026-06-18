import { BaseIR, IR } from './index.js'

export type Call = BaseIR & {
    type: 'Call'
    callee: IR
    args: IR
    optional?: boolean
}

export type CallChildren = [callee: IR, args: IR]
