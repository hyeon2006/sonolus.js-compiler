import { Switch } from '../nodes/Switch.js'
import { createMapIRVisitor } from './utils.js'

export const mapSwitch = createMapIRVisitor<Switch>(
    (_, discriminant, defaultCase, ...casePairs) => {
        const cases: Switch['cases'] = []

        for (let i = 0; i < casePairs.length / 2; i++) {
            cases.push({
                test: casePairs[i * 2],
                consequent: casePairs[i * 2 + 1],
            })
        }

        return {
            discriminant,
            defaultCase,
            cases,
        }
    },
)
