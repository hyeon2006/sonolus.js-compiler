import { Get } from '../../../nodes/Get.js'
import { TrackInlineIR } from './index.js'

export const trackInlineGet: TrackInlineIR<Get> = (ir, _ctx, dependencies) => {
    dependencies.add(ir.target)

    return false
}
