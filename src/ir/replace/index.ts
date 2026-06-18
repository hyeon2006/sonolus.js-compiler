import { iterateIR } from '../iterate/index.js'
import { mapIR } from '../map/index.js'
import { IR } from '../nodes/index.js'

export const replaceIR = (ir: IR, replacements: Map<IR, IR>): { ir: IR; changed: boolean } => {
    if (!replacements.size)
        return {
            ir,
            changed: false,
        }

    return {
        ir: replace(ir, replacements),
        changed: true,
    }
}

const replace = (ir: IR, replacements: Map<IR, IR>): IR => {
    const newIR = replaceSelf(ir, replacements)
    const children = iterateIR(newIR)
    let childChanged = false

    for (let index = 0; index < children.length; index++) {
        const child = children[index]
        const newChild = replace(child, replacements)
        if (newChild === child) continue

        children[index] = newChild
        childChanged = true
    }

    if (!childChanged) return newIR

    return mapIR(newIR, ...children)
}

const replaceSelf = (ir: IR, replacements: Map<IR, IR>): IR => {
    while (true) {
        const newIR = replacements.get(ir)
        if (!newIR) return ir

        ir = newIR
    }
}
