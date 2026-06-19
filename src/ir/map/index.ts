import { visit } from '../../utils/visitor.js'
import { IR, IRChildren } from '../nodes/index.js'
import { mapArrayConstructor } from './ArrayConstructor.js'
import { mapArrayConstructorAdd } from './ArrayConstructorAdd.js'
import { mapArrayConstructorSpread } from './ArrayConstructorSpread.js'
import { mapArrayDestructor } from './ArrayDestructor.js'
import { mapArrayDestructorGet } from './ArrayDestructorGet.js'
import { mapArrayDestructorRest } from './ArrayDestructorRest.js'
import { mapAssign } from './Assign.js'
import { mapBinary } from './Binary.js'
import { mapBlock } from './Block.js'
import { mapBreak } from './Break.js'
import { mapCall } from './Call.js'
import { mapConditional } from './Conditional.js'
import { mapDeclare } from './Declare.js'
import { mapDoWhile } from './DoWhile.js'
import { mapExecute } from './Execute.js'
import { mapForOf } from './ForOf.js'
import { mapGet } from './Get.js'
import { mapJSCall } from './JSCall.js'
import { mapLogical } from './Logical.js'
import { mapMember } from './Member.js'
import { mapNative } from './Native.js'
import { mapNew } from './New.js'
import { mapObjectConstructor } from './ObjectConstructor.js'
import { mapObjectConstructorAdd } from './ObjectConstructorAdd.js'
import { mapObjectConstructorSpread } from './ObjectConstructorSpread.js'
import { mapObjectDestructor } from './ObjectDestructor.js'
import { mapObjectDestructorGet } from './ObjectDestructorGet.js'
import { mapObjectDestructorRest } from './ObjectDestructorRest.js'
import { mapReference } from './Reference.js'
import { mapSet } from './Set.js'
import { mapSuper } from './Super.js'
import { mapSwitch } from './Switch.js'
import { mapThrow } from './Throw.js'
import { mapUnary } from './Unary.js'
import { mapValue } from './Value.js'
import { mapWhile } from './While.js'

export type MapIR<N extends IR> = (ir: N, ...children: IR[]) => N

export const mapIR = visit<<N extends IR>(ir: N, ...children: IRChildren<N>) => N>().create('map', {
    mapArrayConstructor,
    mapArrayConstructorAdd,
    mapArrayConstructorSpread,
    mapArrayDestructor,
    mapArrayDestructorGet,
    mapArrayDestructorRest,
    mapAssign,
    mapBinary,
    mapBlock,
    mapBreak,
    mapCall,
    mapConditional,
    mapDeclare,
    mapDoWhile,
    mapExecute,
    mapForOf,
    mapGet,
    mapJSCall,
    mapLogical,
    mapMember,
    mapNative,
    mapNew,
    mapObjectConstructor,
    mapObjectConstructorAdd,
    mapObjectConstructorSpread,
    mapObjectDestructor,
    mapObjectDestructorGet,
    mapObjectDestructorRest,
    mapReference,
    mapSet,
    mapSuper,
    mapSwitch,
    mapThrow,
    mapUnary,
    mapValue,
    mapWhile,
})

/**
 * Rebuilds `ir` with a replacement child list, without spreading the children as
 * call arguments. For the variable-arity node types a single node can hold tens
 * of thousands of children (e.g. a very long callback body becomes one big
 * `Execute`), and `mapIR(ir, ...children)` would then blow the call stack with
 * `RangeError: Maximum call stack size exceeded` once the argument count crosses
 * the engine limit (~65k). These are reconstructed field-for-field to match
 * their `mapIR` handlers exactly; all fixed-arity nodes keep going through
 * `mapIR` (their child counts are tiny, so the spread is safe).
 */
export const mapIRChildren = (ir: IR, children: IR[]): IR => {
    switch (ir.type) {
        case 'Execute':
        case 'ArrayConstructor':
        case 'ObjectConstructor':
            return { ...ir, children }
        case 'Native':
        case 'JSCall':
            return { ...ir, args: children }
        case 'Switch': {
            const cases: typeof ir.cases = []
            const casePairsLength = children.length - 2
            for (let i = 0; i < casePairsLength / 2; i++) {
                cases.push({
                    test: children[2 + i * 2],
                    consequent: children[2 + i * 2 + 1],
                })
            }

            return { ...ir, discriminant: children[0], defaultCase: children[1], cases }
        }
        default:
            // Fixed-arity nodes: child counts are tiny, so the spread is safe.
            // `ir` is narrowed to non-variadic types here, so its per-type
            // `IRChildren` tuple no longer accepts a plain `IR[]`; the cast just
            // restores the runtime-correct variadic call.
            return (mapIR as (ir: IR, ...children: IR[]) => IR)(ir, ...children)
    }
}
