import { daysBetween } from './dates';
import type { Check, Evidence, EvidenceEvaluation, EventStatus, Hazard } from './types';

/** Demo rule only. Not an official heatwave definition or a validated loss threshold. */
export const HEAT_THRESHOLD_C = 40;
export const HEAT_DAYS = 3;

export const RULE_TEXT: Record<Hazard, string> = {
  heat: `Demo rule: daily maximum strictly above ${HEAT_THRESHOLD_C}°C on ${HEAT_DAYS} complete consecutive days in the matching area. Exactly ${HEAT_THRESHOLD_C}°C does not qualify. A missing day needs review. This is an arbitrary test rule, not an official heatwave definition.`,
  flood:
    'Demo rule: an observed inundation record for the matching area, with a completed observation period. A rainfall warning by itself stays at warning and cannot open a repayment proposal.',
  drought:
    'Demo rule: a drought assessment covering a completed seasonal reference period for the matching area. Drought develops over weeks or months, so there is no short advance-warning window.',
};

function worst(steps: Check[]): EventStatus {
  if (steps.some((s) => s.result === 'review')) return 'review_required';
  if (steps.some((s) => s.result === 'fail')) return 'not_met';
  return 'qualified';
}

function freshness(e: Evidence, simDate: string): Check {
  const age = daysBetween(e.issuedAt, simDate);
  const fresh = age >= 0 && age <= e.maxAgeDays;
  return {
    key: 'freshness',
    label: 'Evidence is fresh enough',
    result: fresh ? 'pass' : 'review',
    detail: fresh
      ? `Issued ${age} day${age === 1 ? '' : 's'} before the simulation date (limit ${e.maxAgeDays} days).`
      : `Issued ${age} days before the simulation date, outside the ${e.maxAgeDays}-day limit.`,
  };
}

function areaStep(e: Evidence): Check {
  return {
    key: 'area',
    label: 'Record identifies the service area',
    result: e.areaConfirmed ? 'pass' : 'review',
    detail: e.areaConfirmed
      ? 'The record names the service area used in borrower profiles.'
      : 'The record does not clearly confirm the service area. A person must check it.',
  };
}

function periodStep(e: Evidence, simDate: string, label: string): Check {
  const complete = daysBetween(e.periodEnd, simDate) > 0;
  return {
    key: 'period',
    label,
    result: complete ? 'pass' : 'review',
    detail: complete
      ? 'The observation period ended before the simulation date.'
      : 'The period has not finished, so the record is incomplete.',
  };
}

function heatSteps(e: Evidence, simDate: string): Check[] {
  const readings = e.readings ?? [];
  const steps: Check[] = [areaStep(e)];

  const consecutive = readings.every((r, i) => i === 0 || daysBetween(readings[i - 1].date, r.date) === 1);
  const allComplete = readings.every((r) => daysBetween(r.date, simDate) > 0);
  const missing = readings.filter((r) => r.maxC === null).length;
  const haveDays = readings.length === HEAT_DAYS && consecutive && allComplete && missing === 0;
  steps.push({
    key: 'days',
    label: `${HEAT_DAYS} complete consecutive days of readings`,
    result: haveDays ? 'pass' : 'review',
    detail: haveDays
      ? 'All daily readings are present and each day has finished.'
      : missing > 0
        ? `${missing} daily reading${missing === 1 ? ' is' : 's are'} missing. The rule cannot be decided automatically.`
        : 'The readings do not cover three complete consecutive days.',
  });

  const present = readings.filter((r) => r.maxC !== null);
  const atOrBelow = present.filter((r) => (r.maxC as number) <= HEAT_THRESHOLD_C);
  steps.push({
    key: 'threshold',
    label: `Every day strictly above ${HEAT_THRESHOLD_C}°C`,
    result: atOrBelow.length > 0 ? 'fail' : missing > 0 ? 'review' : 'pass',
    detail:
      atOrBelow.length > 0
        ? `${atOrBelow.map((r) => `${(r.maxC as number).toFixed(1)}°C`).join(', ')} is not above ${HEAT_THRESHOLD_C}°C.`
        : missing > 0
          ? 'Available readings are above the threshold, but a day is missing.'
          : `${present.map((r) => `${(r.maxC as number).toFixed(1)}°C`).join(', ')} are all above ${HEAT_THRESHOLD_C}°C.`,
  });
  steps.push(freshness(e, simDate));
  return steps;
}

const HEADLINES: Record<EventStatus, string> = {
  qualified: 'Qualifying observed event. Support cases can be prepared for review.',
  warning: 'Warning only. Borrowers can be informed, but no repayment change is proposed.',
  review_required: 'Evidence is incomplete or uncertain. A person must review it before any proposal.',
  not_met: 'The demo rule is not met. No support case is opened.',
};

/** Pure evaluation of one evidence record against its hazard's demo rule. */
export function evaluateEvidence(e: Evidence, simDate: string): EvidenceEvaluation {
  const ageDays = daysBetween(e.issuedAt, simDate);
  const rule = RULE_TEXT[e.hazard];

  if (e.kind === 'warning') {
    const steps: Check[] = [
      {
        key: 'kind',
        label: 'Evidence type',
        result: 'info',
        detail: 'This is a forecast or outlook, not an observed event. Warnings never change a loan.',
      },
      areaStep(e),
      freshness(e, simDate),
    ];
    return { status: 'warning', headline: HEADLINES.warning, rule, steps, ageDays };
  }

  let steps: Check[];
  if (e.hazard === 'heat') {
    steps = heatSteps(e, simDate);
  } else if (e.hazard === 'flood') {
    steps = [areaStep(e), periodStep(e, simDate, 'Observation period is complete'), freshness(e, simDate)];
  } else {
    steps = [areaStep(e), periodStep(e, simDate, 'Seasonal reference period is complete'), freshness(e, simDate)];
  }
  const status = worst(steps);
  return { status, headline: HEADLINES[status], rule, steps, ageDays };
}
