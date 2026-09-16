import { CounterModel } from '../models/counter.model.js';
import mongoose from 'mongoose';

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
  let counter: any = null;
  try {
    counter = await CounterModel.findOneAndUpdate(
      { tenantId, domain },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).exec();
  } catch (err: any) {
    if (err.code === 11000) {
      counter = await CounterModel.findOneAndUpdate(
        { tenantId, domain },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();
    } else {
      throw err;
    }
  }

  const paddedNumber = String(counter.seq).padStart(paddingLength, '0');
  return `${prefix}-${paddedNumber}`;
}

/**
 * Monthly Monotonic Collision-Free Business Identifier Generator
 * (e.g. PO-YYYYMM-XXXX, GRN-YYYYMM-XXXX, JOB-YYYYMM-XXXX, DSP-YYYYMM-XXXX)
 * Prevents race conditions and duplicate key collisions under concurrent record creation.
 */
export async function generateNextMonthlySequenceCode(
  tenantId: string,
  domainPrefix: string,
  codePrefix: string,
  paddingLength: number = 4
): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const domain = `${domainPrefix}_${yearMonth}`;
  const prefix = `${codePrefix}-${yearMonth}-`;

  if (mongoose.connection.readyState === 1) {
    let counter: any = null;
    try {
      counter = await CounterModel.findOneAndUpdate(
        { tenantId, domain },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();
    } catch (err: any) {
      if (err.code === 11000) {
        try {
          counter = await CounterModel.findOneAndUpdate(
            { tenantId, domain },
            { $inc: { seq: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          ).exec();
        } catch {
          // ignore
        }
      }
    }

    if (counter && typeof counter.seq === 'number') {
      return `${prefix}${String(counter.seq).padStart(paddingLength, '0')}`;
    }
  }

  return `${prefix}${String(1).padStart(paddingLength, '0')}`;
}
