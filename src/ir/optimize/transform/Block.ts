import { iterateIR } from '../../iterate/index.js'
import { Block } from '../../nodes/Block.js'
import { Break } from '../../nodes/Break.js'
import { IR } from '../../nodes/index.js'
import { replaceIR } from '../../replace/index.js'
import { TransformIRContext } from './context.js'
import { TransformIR } from './index.js'
import { rewriteAsExecute, transformIRAndGet } from './utils.js'
import {
    createCopyObjectChildren,
    createObjectBuffer,
    getObjectResult,
    ObjectBuffer,
} from './utils/object.js'

export const transformBlock: TransformIR<Block> = (ir, ctx) => {
    let body = transformIRAndGet(ir.body, ctx)

    while (true) {
        const count = countBreaks(body, ir.target)
        if (count === 0) return body

        const objectReturnBlock = transformObjectReturnBlock(ir, body, ctx)
        if (objectReturnBlock) return objectReturnBlock

        const replacements = new Map<IR, IR>()
        findBreakReplacements(body, ir.target, replacements)

        const result = replaceIR(body, replacements)
        if (!result.changed) return { ...ir, body }

        body = transformIRAndGet(result.ir, ctx)
    }
}

const countBreaks = (ir: IR, target: object) => {
    let count = 0

    visitBreaks(ir, target, () => {
        count++
    })

    return count
}

const collectBreaks = (ir: IR, target: object) => {
    const breaks: Break[] = []

    visitBreaks(ir, target, (ir) => {
        breaks.push(ir)
    })

    return breaks
}

const visitBreaks = (ir: IR, target: object, visit: (ir: Break) => void) => {
    if (ir.type === 'Break' && ir.target === target) visit(ir)

    for (const child of iterateIR(ir)) {
        visitBreaks(child, target, visit)
    }
}

const findBreakReplacements = (ir: IR, target: object, replacements: Map<IR, IR>) => {
    switch (ir.type) {
        case 'Break': {
            if (ir.target !== target) break

            replacements.set(ir, ir.value)
            break
        }
        case 'Conditional': {
            findBreakReplacements(ir.consequent, target, replacements)
            findBreakReplacements(ir.alternate, target, replacements)
            break
        }
        case 'Execute': {
            const last = ir.children[ir.children.length - 1]
            findBreakReplacements(last, target, replacements)
            break
        }
        case 'Logical': {
            findBreakReplacements(ir.rhs, target, replacements)
            break
        }
        case 'Switch': {
            for (const { consequent } of ir.cases) {
                findBreakReplacements(consequent, target, replacements)
            }
            findBreakReplacements(ir.defaultCase, target, replacements)
            break
        }
        default:
            break
    }
}

const transformObjectReturnBlock = (
    ir: Block,
    body: IR,
    ctx: TransformIRContext,
): IR | undefined => {
    const targetBreaks = collectBreaks(body, ir.target)
    if (!targetBreaks.length) return

    const breakResults = targetBreaks.map((breakIR) => getObjectResult(breakIR.value))
    if (breakResults.some((result) => !result)) return

    const finalResult = getObjectResult(body)
    const sample = finalResult?.value ?? breakResults[0]?.value
    if (!sample) return

    const buffer = createObjectBuffer(sample, ctx)
    if (!buffer) return

    const replacements = new Map<IR, IR>()
    for (const breakIR of targetBreaks) {
        const replacement = createCopyAndBreak(ir.target, breakIR, buffer, ctx)
        if (!replacement) return

        replacements.set(breakIR, replacement)
    }

    const bodyWithCopiedBreaks = replaceIR(body, replacements).ir
    const bodyChildren = finalResult
        ? createCopyObjectChildren(ir, bodyWithCopiedBreaks, buffer, ctx)
        : [bodyWithCopiedBreaks]
    if (!bodyChildren) return

    return rewriteAsExecute(ir, ctx, [
        ctx.Block(ir, {
            target: ir.target,
            body: ctx.Execute(ir, {
                children: [...bodyChildren, ctx.zero(ir)],
            }),
        }),
        ctx.value(ir, buffer.value),
    ])
}

const createCopyAndBreak = (
    target: object,
    breakIR: Break,
    buffer: ObjectBuffer,
    ctx: TransformIRContext,
) => {
    const children = createCopyObjectChildren(breakIR, breakIR.value, buffer, ctx)
    if (!children) return

    return ctx.Execute(breakIR, {
        children: [
            ...children,
            ctx.Break(breakIR, {
                target,
                value: ctx.zero(breakIR),
            }),
        ],
    })
}
