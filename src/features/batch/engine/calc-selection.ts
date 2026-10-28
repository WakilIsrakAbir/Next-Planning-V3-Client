/* Batch engine slice "calc": Generic ERP Machine Selection.
   Port of the embedded factory block of the old js/batch/batch-app.js (old lines 2540-2703), which the old
   page published as `window.GenericMachineSelection`. The rules are unchanged; the factory is now plain
   module exports, and `GenericMachineSelection` keeps the old object (selectMachine, formatEvaluations,
   compareConfigurations, MachineSelectionError, DEFAULT_MAXIMUM_LOADING_PERCENT) so the old calls
   `GenericMachineSelection.selectMachine(...)` / `error instanceof GenericMachineSelection.MachineSelectionError`
   read the same.

   Old comment:
   Generic ERP Machine Selection — reusable in browsers and Node.js.

   Example:
   selectMachine({ totalQuantityKg: 1251, machines: [250, 500, 750, 1000, 1500],
                   maximumLoadingPercent: 80 });
   => capacityKg 1000, batches 2, batchQuantityKg 625.5, loading 62.55%.

   No dependency on ERP, fabric, floor, shade, brand or machine number.
   Ceiling, loading eligibility and ranking use exact decimal fractions derived
   from the numeric inputs. Returned numeric fields are unrounded Number
   representations; formatting is separate. Never pass display-rounded inputs. */
import type { Row } from './types';

// The project compiles to ES2017, which has no bigint literals: BigInt(10) is the old `10n`.
const B1 = BigInt(1);
const B10 = BigInt(10);
const B100 = BigInt(100);
const B0 = BigInt(0);

export const DEFAULT_MAXIMUM_LOADING_PERCENT = 80;

export class MachineSelectionError extends Error {
  code: string;
  evaluations: Row[];
  constructor(message: string, evaluations: Row[]) {
    super(message);
    this.name = 'MachineSelectionError';
    this.code = 'NO_ELIGIBLE_MACHINE';
    this.evaluations = evaluations;
  }
}

type ExactFraction = { n: bigint; d: bigint };

/** A constraint returns true, false, or a human-readable rejection reason. */
export type MachineConstraint = (machine: Row, inputs: MachineSelectionInputs) => unknown;

export type MachineSelectionInputs = {
  /** Positive, finite production quantity. */
  totalQuantityKg: unknown;
  /** Capacities or machine objects: { id?, capacityKg, available?, eligible?, rejectionReasons?, maximumLoadingPercent? }. */
  machines: unknown;
  /** Configurable default limit (80 when left out). */
  maximumLoadingPercent?: unknown;
  /** (machine, inputs) => true/false/reason. */
  availability?: unknown;
  /** Same contract as availability. */
  productionEligibility?: unknown;
};

export type MachineSelectionResult = {
  totalQuantityKg: number;
  maximumLoadingPercent: number;
  selected: Row;
  evaluations: Row[];
  ranking: Row[];
};

// BigInt fractions prevent decimal boundary errors (e.g. 0.56 / 0.7 at 80%).
// These private values never enter JSON output or display formatting.
const exactLoading = new WeakMap<object, ExactFraction>();
function decimalFraction(value: unknown): ExactFraction {
  const [coefficient, exponentText = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const power = Number(exponentText) - fraction.length;
  const digits = BigInt(whole + fraction);
  return power >= 0 ? { n: digits * B10 ** BigInt(power), d: B1 } : { n: digits, d: B10 ** BigInt(-power) };
}
function fractionNumber(n: bigint, d: bigint): number {
  let a = n,
    b = d;
  while (b) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  n /= a;
  d /= a;
  const numerator = Number(n),
    denominator = Number(d);
  if (Number.isFinite(numerator) && Number.isFinite(denominator)) return numerator / denominator;
  // Preserve Number's range when the fraction's integer components are huge.
  const numeratorText = n.toString(),
    denominatorText = d.toString();
  const top = Number(numeratorText.slice(0, 16)) / 10 ** (Math.min(16, numeratorText.length) - 1);
  const bottom = Number(denominatorText.slice(0, 16)) / 10 ** (Math.min(16, denominatorText.length) - 1);
  return Number(String(top / bottom) + 'e' + (numeratorText.length - denominatorText.length));
}
function validPercentage(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100;
}
// Optional constraints may return true, false, or a human-readable reason.
// They must be synchronous. Throwing from a constraint propagates to its caller.
function constraintReasons(result: unknown, fallback: string): string[] {
  if (result === true) return [];
  if (result === false) return [fallback];
  if (typeof result === 'string' && result.trim()) return [result.trim()];
  throw new TypeError('A machine constraint must return true, false, or a non-empty rejection reason.');
}
function compareLoading(a: Row, b: Row): number {
  const left = exactLoading.get(a),
    right = exactLoading.get(b);
  if (left && right) {
    const difference = right.n * left.d - left.n * right.d;
    return difference === B0 ? 0 : difference > B0 ? 1 : -1;
  }
  return b.actualLoadingPercent - a.actualLoadingPercent;
}
export function compareConfigurations(a: Row, b: Row): number {
  return a.batches - b.batches || compareLoading(a, b) || a.capacityKg - b.capacityKg || a.inputIndex - b.inputIndex;
}

/**
 * Evaluates every machine and ranks the eligible ones: fewest batches, then highest loading,
 * then smallest capacity, then input order.
 * @throws {MachineSelectionError} If none eligible; .evaluations retains all rows.
 * @throws {TypeError} For invalid top-level inputs or constraint contracts.
 */
export function selectMachine(inputs: MachineSelectionInputs): MachineSelectionResult {
  if (!inputs || typeof inputs !== 'object') throw new TypeError('Machine selection inputs are required.');
  const { totalQuantityKg, machines, availability, productionEligibility } = inputs;
  const maximumLoadingPercent = inputs.maximumLoadingPercent === undefined ? DEFAULT_MAXIMUM_LOADING_PERCENT : inputs.maximumLoadingPercent;
  if (typeof totalQuantityKg !== 'number' || !Number.isFinite(totalQuantityKg) || totalQuantityKg <= 0) {
    throw new TypeError('Total production quantity must be a finite number greater than zero kg.');
  }
  if (!Array.isArray(machines)) throw new TypeError('Machines must be an array of capacities or machine objects.');
  if (!validPercentage(maximumLoadingPercent)) throw new TypeError('Maximum loading percentage must be greater than 0 and at most 100.');
  for (const callback of [availability, productionEligibility]) {
    if (callback !== undefined && typeof callback !== 'function') throw new TypeError('Machine constraints must be functions.');
  }
  const quantity = decimalFraction(totalQuantityKg);
  const evaluations: Row[] = machines.map((input: unknown, inputIndex: number) => {
    const machine: Row | null | undefined = typeof input === 'number' ? { capacityKg: input } : (input as Row | null | undefined);
    const reasons: string[] = [];
    const capacityKg = machine?.capacityKg;
    const limit = machine?.maximumLoadingPercent === undefined ? maximumLoadingPercent : machine.maximumLoadingPercent;
    const row: Row = {
      machine: machine || {},
      inputIndex,
      id: machine?.id ?? inputIndex + 1,
      capacityKg: capacityKg ?? null,
      maximumLoadingPercent: limit,
      batches: null,
      batchQuantityKg: null,
      actualLoadingPercent: null,
      eligible: false,
      selected: false,
      rank: null,
      rejectionReasons: reasons,
      remarks: '',
    };
    if (!machine || typeof machine !== 'object') reasons.push('Invalid machine record.');
    if (typeof capacityKg !== 'number' || !Number.isFinite(capacityKg) || capacityKg <= 0) reasons.push('Capacity must be a finite number greater than zero kg.');
    if (!validPercentage(limit)) reasons.push('Invalid permitted loading percentage.');
    if (typeof capacityKg === 'number' && Number.isFinite(capacityKg) && capacityKg > 0 && validPercentage(limit)) {
      const capacity = decimalFraction(capacityKg),
        percentage = decimalFraction(limit);
      const numerator = quantity.n * capacity.d * percentage.d * B100;
      const denominator = quantity.d * capacity.n * percentage.n;
      const batchesExact = (numerator + denominator - B1) / denominator;
      if (batchesExact < B1 || batchesExact > BigInt(Number.MAX_SAFE_INTEGER)) {
        reasons.push('Batch count is outside the supported numeric range.');
      } else {
        row.batches = Number(batchesExact);
        row.batchQuantityKg = fractionNumber(quantity.n, quantity.d * batchesExact);
        const loading = { n: quantity.n * capacity.d * B100, d: quantity.d * batchesExact * capacity.n };
        exactLoading.set(row, loading);
        row.actualLoadingPercent = fractionNumber(loading.n, loading.d);
        if (loading.n * percentage.d > percentage.n * loading.d) reasons.push('Actual loading exceeds the permitted loading percentage.');
      }
    }
    if (machine?.available === false) reasons.push('Machine is unavailable.');
    if (machine?.eligible === false) reasons.push('Machine is not eligible for this production.');
    if (Array.isArray(machine?.rejectionReasons)) {
      for (const reason of (machine as Row).rejectionReasons) if (typeof reason === 'string' && reason.trim()) reasons.push(reason.trim());
    }
    if (machine && typeof machine === 'object') {
      if (availability) reasons.push(...constraintReasons((availability as MachineConstraint)(machine, inputs), 'Machine is unavailable.'));
      if (productionEligibility) reasons.push(...constraintReasons((productionEligibility as MachineConstraint)(machine, inputs), 'Machine is not eligible for this production.'));
    }
    row.eligible = reasons.length === 0;
    row.remarks = row.eligible ? 'Eligible.' : reasons.join(' ');
    return row;
  });
  const ranking = evaluations.filter((row) => row.eligible).sort(compareConfigurations);
  if (!ranking.length) {
    throw new MachineSelectionError(
      'No eligible machine configuration exists. Check machine availability, production eligibility, capacities and permitted loading percentages.',
      evaluations
    );
  }
  const selected = ranking[0];
  selected.selected = true;
  ranking.forEach((row, index) => {
    row.rank = index + 1;
    if (row === selected) row.remarks = 'Selected: fewest batches, then highest loading, then smallest capacity.';
    else if (row.batches > selected.batches) row.remarks = 'Not selected: requires more batches.';
    else if (compareLoading(row, selected) > 0) row.remarks = 'Not selected: lower loading with the same batch count.';
    else if (row.capacityKg > selected.capacityKg) row.remarks = 'Not selected: larger capacity with equal batch count and loading.';
    else row.remarks = 'Equivalent configuration; earlier input selected.';
  });
  return { totalQuantityKg, maximumLoadingPercent, selected, evaluations, ranking };
}
// Display-only formatting. None of these rounded strings influence selection.
export function formatEvaluations(
  evaluations: unknown,
  { quantityDecimals = 3, percentageDecimals = 2 }: { quantityDecimals?: number; percentageDecimals?: number } = {}
): Row[] {
  if (!Array.isArray(evaluations)) throw new TypeError('Evaluations must be an array.');
  return evaluations.map((row: Row) => ({
    machineId: row.id,
    capacityKg: typeof row.capacityKg === 'number' && Number.isFinite(row.capacityKg) ? row.capacityKg.toFixed(quantityDecimals) : '—',
    batches: row.batches ?? '—',
    batchQuantityKg: row.batchQuantityKg === null ? '—' : row.batchQuantityKg.toFixed(quantityDecimals),
    maximumLoadingPercent: validPercentage(row.maximumLoadingPercent) ? row.maximumLoadingPercent.toFixed(percentageDecimals) + '%' : '—',
    actualLoadingPercent: row.actualLoadingPercent === null ? '—' : row.actualLoadingPercent.toFixed(percentageDecimals) + '%',
    eligibility: row.eligible ? 'Eligible' : 'Rejected',
    selected: row.selected,
    rank: row.rank,
    remarks: row.remarks,
  }));
}

/** The old `window.GenericMachineSelection` object. */
export const GenericMachineSelection = Object.freeze({
  selectMachine,
  formatEvaluations,
  compareConfigurations,
  MachineSelectionError,
  DEFAULT_MAXIMUM_LOADING_PERCENT,
});
