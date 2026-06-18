import { Switch, SwitchChildren } from '../nodes/Switch.js'
import { IterateIR } from './index.js'

export const iterateSwitch: IterateIR<Switch> = (ir) => {
    const children: SwitchChildren = [ir.discriminant, ir.defaultCase]

    for (const { test, consequent } of ir.cases) {
        children.push(test, consequent)
    }

    return children
}
