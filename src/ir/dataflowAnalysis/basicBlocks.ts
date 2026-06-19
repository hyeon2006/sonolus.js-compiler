import { IR } from '../nodes/index.js'
import { Graph } from './graph.js'

export type BasicBlock = {
    readonly index: number
    readonly nodes: IR[]
    readonly predecessors: Set<BasicBlock>
    readonly successors: Set<BasicBlock>
}

export type BasicBlocks = {
    readonly blocks: BasicBlock[]
}

export const createBasicBlocks = (irs: IR[], graph: Graph): BasicBlocks => {
    const leaders = new Set<IR>()

    for (const ir of irs) {
        const inputs = graph.ins.get(ir)
        if (inputs?.size !== 1) leaders.add(ir)

        const outputs = graph.outs.get(ir)
        if (!outputs) continue

        if (outputs.size !== 1) {
            for (const output of outputs) {
                leaders.add(output)
            }
            continue
        }

        const output = first(outputs)
        const outputInputs = graph.ins.get(output)
        if (outputInputs?.size !== 1) leaders.add(output)
    }

    const blocks: BasicBlock[] = []
    const byNode = new Map<IR, BasicBlock>()

    for (const ir of irs) {
        if (byNode.has(ir)) continue

        const block: BasicBlock = {
            index: blocks.length,
            nodes: [],
            predecessors: new Set(),
            successors: new Set(),
        }
        blocks.push(block)

        let current = ir
        while (!byNode.has(current)) {
            block.nodes.push(current)
            byNode.set(current, block)

            const outputs = graph.outs.get(current)
            if (outputs?.size !== 1) break

            const output = first(outputs)
            if (leaders.has(output)) break

            current = output
        }
    }

    for (const block of blocks) {
        const last = block.nodes.at(-1)
        if (!last) continue

        const outputs = graph.outs.get(last)
        if (!outputs) continue

        for (const output of outputs) {
            const successor = byNode.get(output)
            if (!successor) continue

            block.successors.add(successor)
            successor.predecessors.add(block)
        }
    }

    return { blocks }
}

const first = <T>(values: ReadonlySet<T>): T => {
    const value = values.values().next().value
    if (value === undefined) throw new Error('Unexpected empty set')

    return value
}
