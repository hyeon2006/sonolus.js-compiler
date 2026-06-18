import { Switch } from '../../../nodes/Switch.js'
import { connectIns } from './context.js'
import { ConnectIR, connectIR } from './index.js'

export const connectSwitch: ConnectIR<Switch> = (ir, inputs, ctx) => {
    let current = connectIR(ir.discriminant, inputs, ctx)

    for (const { test, consequent } of ir.cases) {
        current = connectIR(test, current, ctx)
        connectIns(ir, connectIR(consequent, current, ctx), ctx)
    }

    const defaultCase = connectIR(ir.defaultCase, current, ctx)

    connectIns(ir, defaultCase, ctx)

    return [ir]
}
