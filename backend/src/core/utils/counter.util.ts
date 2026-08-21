import { CounterModel } from '../models/counter.model.js';

/**
 * Sequential Code Generator Utility
 * Generates monotonic collision-free business identifiers (e.g. JOB-00001, QC-00001)
 * Reference: CelestiumERP.md Section 1.4
 */

export async function generateNextSequenceCode(
  tenantId: string,
  domain: string,
  prefix: string,
  paddingLength: number = 5
): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { tenantId, domain },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const paddedNumber = String(counter.seq).padStart(paddingLength, '0');
  return `${prefix}-${paddedNumber}`;
}
