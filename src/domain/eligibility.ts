import { formatDate, inr } from './dates';
import { deferredDueDate, findTargetInstalment, overdueInstalments } from './schedule';
import type { Borrower, CaseStatus, Check, Evidence, EvidenceEvaluation, Loan, Proposal } from './types';

export const POLICY_VERSION = 'demo-policy-v1';

export interface CaseEvaluation {
  status: CaseStatus;
  checks: Check[];
  reviewReasons: string[];
  proposal?: Proposal;
}

export function operationIdFor(eventId: string, loanId: string, instalmentId: string): string {
  return `OP-${eventId}-${loanId}-${instalmentId}`;
}

/**
 * Decides what, if anything, Kavach may propose for one borrower under one event.
 * Anything uncertain goes to review with a stated reason. Nothing is silently dropped.
 */
export function evaluateCase(
  borrower: Borrower,
  loan: Loan,
  evidence: Evidence,
  evaluation: EvidenceEvaluation,
  areaName: string,
  simDate: string,
): CaseEvaluation {
  const inArea = borrower.areaId === evidence.areaId;
  const checks: Check[] = [
    {
      key: 'area',
      label: 'Business is in the affected area',
      result: inArea ? 'pass' : 'fail',
      detail: inArea ? `${areaName} matches the evidence area.` : `${areaName} is not covered by this evidence.`,
    },
  ];
  if (!inArea) return { status: 'not_affected', checks, reviewReasons: [] };

  checks.push({
    key: 'evidence',
    label: 'Qualifying observed evidence',
    result:
      evaluation.status === 'qualified' ? 'pass' : evaluation.status === 'not_met' ? 'fail' : evaluation.status === 'warning' ? 'info' : 'review',
    detail: evaluation.headline,
  });
  if (evaluation.status === 'warning') return { status: 'warning_only', checks, reviewReasons: [] };
  if (evaluation.status === 'not_met') return { status: 'rule_not_met', checks, reviewReasons: [] };

  const reviewReasons: string[] = [];
  if (evaluation.status === 'review_required') {
    reviewReasons.push('Climate evidence is incomplete or uncertain, so the rule cannot be decided automatically.');
  }

  checks.push({
    key: 'enrolled',
    label: 'Enrolled in the support programme',
    result: borrower.enrolled ? 'pass' : 'review',
    detail: borrower.enrolled ? 'Enrolment recorded in the demo data.' : 'No enrolment on record.',
  });
  if (!borrower.enrolled) reviewReasons.push('Borrower is not enrolled in the support programme.');

  checks.push({
    key: 'product',
    label: 'Loan product is covered by the demo policy',
    result: loan.supportedProduct ? 'pass' : 'review',
    detail: loan.product,
  });
  if (!loan.supportedProduct) reviewReasons.push(`Loan product "${loan.product}" is not covered by the demo policy.`);

  const overdue = overdueInstalments(loan, simDate);
  checks.push({
    key: 'arrears',
    label: 'No existing arrears',
    result: overdue.length === 0 ? 'pass' : 'review',
    detail:
      overdue.length === 0
        ? 'No instalment is past due.'
        : `${inr(overdue.reduce((s, i) => s + i.amount, 0))} was due on ${overdue.map((i) => formatDate(i.dueDate)).join(', ')} and is unpaid.`,
  });
  if (overdue.length > 0) reviewReasons.push('The loan has existing arrears. A deferral would not address them, so staff must review.');

  const hadRelief = Boolean(loan.priorRelief) || loan.reliefEventIds.length > 0;
  checks.push({
    key: 'prior',
    label: 'No previous or pending relief',
    result: hadRelief ? 'review' : 'pass',
    detail: hadRelief ? (loan.priorRelief ?? 'Relief already applied on this loan.') : 'No earlier relief on this loan.',
  });
  if (hadRelief) reviewReasons.push('The loan has already received relief. A second deferral needs a person to decide.');

  const target = findTargetInstalment(loan, simDate);
  checks.push({
    key: 'target',
    label: 'An unpaid, not-yet-due instalment exists',
    result: target ? 'pass' : 'review',
    detail: target ? `${inr(target.amount)} due ${formatDate(target.dueDate)}.` : 'No unpaid future instalment to move.',
  });
  if (!target) reviewReasons.push('There is no unpaid, not-yet-due instalment to defer.');

  if (reviewReasons.length > 0 || !target) return { status: 'review_required', checks, reviewReasons };

  const proposal: Proposal = {
    operationId: operationIdFor(evidence.eventId, loan.id, target.id),
    eventId: evidence.eventId,
    loanId: loan.id,
    loanVersion: loan.version,
    instalmentId: target.id,
    amount: target.amount,
    originalDueDate: target.dueDate,
    newDueDate: deferredDueDate(loan.instalments),
    policyVersion: POLICY_VERSION,
    originalSchedule: loan.instalments.map((i) => ({ ...i })),
  };
  return { status: 'proposal_ready', checks, reviewReasons: [], proposal };
}
