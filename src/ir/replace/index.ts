import { iterateIR } from '../iterate/index.js'
import { mapIRChildren } from '../map/index.js'
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
    const outputs = new Map<IR, IR>()
    const stack: Frame[] = [
        {
            input: ir,
            prepared: false,
        },
    ]

    while (stack.length) {
        const frame = stack[stack.length - 1]

        if (!frame.prepared) {
            const cached = outputs.get(frame.input)
            if (cached) {
                stack.pop()
                continue
            }

            const newIR = replaceSelf(frame.input, replacements)
            const cachedNewIR = outputs.get(newIR)
            if (cachedNewIR) {
                outputs.set(frame.input, cachedNewIR)
                stack.pop()
                continue
            }

            stack[stack.length - 1] = {
                input: frame.input,
                prepared: true,
                ir: newIR,
                children: iterateIR(newIR),
                index: 0,
                childChanged: false,
            }
            continue
        }

        if (frame.index < frame.children.length) {
            const child = frame.children[frame.index]
            const output = outputs.get(child)
            if (output) {
                if (output !== child) {
                    frame.children[frame.index] = output
                    frame.childChanged = true
                }
                frame.index++
                continue
            }

            stack.push({
                input: child,
                prepared: false,
            })
            continue
        }

        const output = frame.childChanged ? mapIRChildren(frame.ir, frame.children) : frame.ir
        outputs.set(frame.ir, output)
        outputs.set(frame.input, output)
        stack.pop()
    }

    const output = outputs.get(ir)
    if (!output) throw new Error('Unexpected missing replacement output')

    return output
}

type Frame = PendingFrame | ActiveFrame

type PendingFrame = {
    input: IR
    prepared: false
}

type ActiveFrame = {
    input: IR
    prepared: true
    ir: IR
    children: IR[]
    index: number
    childChanged: boolean
}

const replaceSelf = (ir: IR, replacements: Map<IR, IR>): IR => {
    while (true) {
        const newIR = replacements.get(ir)
        if (!newIR) return ir

        ir = newIR
    }
}
