/**
 * Granular Object Diff Calculator for Audit Logs
 * Reference: CelestiumERP.md Section 1.3
 */

export interface FieldDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export function calculateObjectDiff(
  oldObj: Record<string, any> | null | undefined,
  newObj: Record<string, any> | null | undefined,
  ignoredKeys: string[] = ['updatedAt', 'createdAt', '__v']
): FieldDiff[] {
  if (!oldObj && !newObj) return [];
  if (!oldObj) {
    return Object.entries(newObj || {})
      .filter(([key]) => !ignoredKeys.includes(key))
      .map(([field, newValue]) => ({ field, oldValue: null, newValue }));
  }
  if (!newObj) {
    return Object.entries(oldObj)
      .filter(([key]) => !ignoredKeys.includes(key))
      .map(([field, oldValue]) => ({ field, oldValue, newValue: null }));
  }

  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (ignoredKeys.includes(key)) continue;

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Compare values JSON-wise if objects, otherwise standard strict equality
    const isDifferent =
      typeof oldVal === 'object' && typeof newVal === 'object'
        ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
        : oldVal !== newVal;

    if (isDifferent) {
      diffs.push({
        field: key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null
      });
    }
  }

  return diffs;
}
