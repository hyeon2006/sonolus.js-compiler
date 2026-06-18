import { sideEffectFreeFuncs } from '../../../../utils/funcs.js'
import { iterateIR } from '../../../iterate/index.js'
import { Native } from '../../../nodes/Native.js'
import { TrackInlineIR, trackInlineIR } from './index.js'

export const trackInlineNative: TrackInlineIR<Native> = (ir, ctx, dependencies) => {
    let sideEffect = !sideEffectFreeFuncs.includes(ir.func)

    for (const child of iterateIR(ir)) {
        const childSideEffect = trackInlineIR(child, ctx, dependencies)
        sideEffect ||= childSideEffect
    }

    return sideEffect
}
