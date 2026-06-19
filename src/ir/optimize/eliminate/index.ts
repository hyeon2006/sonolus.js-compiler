import { collectIR } from '../../collect/index.js'
import { BasicBlock, createBasicBlocks } from '../../dataflowAnalysis/basicBlocks.js'
import { generate } from '../../dataflowAnalysis/generate/index.js'
import { IR } from '../../nodes/index.js'
import { replaceIR } from '../../replace/index.js'
import { analyzeLiveBlockOutputs, emptyLiveState, LiveState } from '../liveness.js'

export const eliminateIR = (ir: IR): { ir: IR; changed: boolean } => {
    const irs = collectIR(ir)
    const graph = generate(ir, irs)
    const { blocks } = createBasicBlocks(irs, graph)
    const outputs = analyzeLiveBlockOutputs(blocks)
    const replacements = collectDeadSetReplacements(blocks, outputs)

    outputs.length = 0
    irs.length = 0

    return replaceIR(ir, replacements)
}

const collectDeadSetReplacements = (
    blocks: BasicBlock[],
    outputs: readonly LiveState[],
): Map<IR, IR> => {
    const replacements = new Map<IR, IR>()

    for (const block of blocks) {
        const live = new Set(outputs[block.index] ?? emptyLiveState)

        for (let index = block.nodes.length - 1; index >= 0; index--) {
            const ir = block.nodes[index]

            switch (ir.type) {
                case 'Get':
                    live.add(ir.target)
                    break
                case 'Set':
                    if (!live.has(ir.target)) replacements.set(ir, ir.value)
                    live.delete(ir.target)
                    break
                default:
                    break
            }
        }
    }

    return replacements
}
