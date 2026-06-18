import { Switch } from '../nodes/Switch.js'
import { CompileIR } from './index.js'

export const compileSwitch: CompileIR<Switch> = (ir, ctx) => {
    const args = [ir.discriminant]

    for (const { test, consequent } of ir.cases) {
        args.push(test, consequent)
    }

    args.push(ir.defaultCase)

    return ctx.func('SwitchWithDefault', ...args)
}
