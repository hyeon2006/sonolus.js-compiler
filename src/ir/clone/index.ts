import { iterateIR } from '../iterate/index.js'
import { mapIRChildren } from '../map/index.js'
import { IR } from '../nodes/index.js'

export const cloneIR = (ir: IR): IR => mapIRChildren(ir, iterateIR(ir).map(cloneIR))
