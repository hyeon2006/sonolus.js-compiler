import { visit } from '../../../../utils/visitor.js'
import { iterateIR } from '../../../iterate/index.js'
import { IR } from '../../../nodes/index.js'
import { TrackInlineIRContext } from './context.js'
import { trackInlineGet } from './Get.js'
import { trackInlineNative } from './Native.js'
import { trackInlineSet } from './Set.js'

export type TrackInlineIR<N extends IR> = (
    ir: N,
    ctx: TrackInlineIRContext,
    dependencies: Set<object>,
) => boolean

export const trackInlineIR: TrackInlineIR<IR> = visit<TrackInlineIR<IR>>().create(
    'trackInline',
    {
        trackInlineGet,
        trackInlineNative,
        trackInlineSet,
    },
    (ir, ctx, dependencies): boolean => {
        let sideEffect = false

        for (const child of iterateIR(ir)) {
            const childSideEffect: boolean = trackInlineIR(child, ctx, dependencies)
            sideEffect ||= childSideEffect
        }

        return sideEffect
    },
)
