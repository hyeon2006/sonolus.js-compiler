import { IR } from '../nodes/index.js'

export type Graph = {
    readonly indexes: ReadonlyMap<IR, number>
    readonly ins: ReadonlyMap<IR, ReadonlySet<IR>>
    readonly outs: ReadonlyMap<IR, ReadonlySet<IR>>
}
