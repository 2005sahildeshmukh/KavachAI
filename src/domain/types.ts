export type Hazard = 'heat' | 'flood' | 'drought';
export type Variant = 'qualifying' | 'warning' | 'missing' | 'threshold';
export type Role = 'officer' | 'borrower' | 'approver';
export type Lang = 'en' | 'hi';

export interface Area {
  id: string;
  name: string;
}

export interface Borrower {
  id: string;
  name: string;
  business: string;
  areaId: string;
  enrolled: boolean;
  loanId: string;
}

export type InstalmentStatus = 'unpaid' | 'paid' | 'deferred';

export interface Instalment {
  id: string;
  dueDate: string; // ISO yyyy-mm-dd
  amount: number;
  status: InstalmentStatus;
  /** Set on the ₹0 row left behind by a deferral. */
  movedTo?: string;
  /** Set on the new instalment created by a deferral. */
  movedFrom?: string;
}

export interface Loan {
  id: string;
  borrowerId: string;
  product: string;
  supportedProduct: boolean;
  /** Incremented by the mock loan system on every committed change. */
  version: number;
  instalments: Instalment[];
  /** Relief recorded before this demo's events, if any. */
  priorRelief?: string;
  /** Event IDs for which relief has already been committed. */
  reliefEventIds: string[];
}

export type EvidenceKind = 'warning' | 'observed';

export interface Reading {
  date: string;
  maxC: number | null;
}

export interface Evidence {
  id: string;
  eventId: string;
  hazard: Hazard;
  variant: Variant;
  variantLabel: string;
  areaId: string;
  /** False when the record does not clearly confirm the service area. */
  areaConfirmed: boolean;
  kind: EvidenceKind;
  title: string;
  sourceType: string;
  issuedAt: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  detail: string;
  readings?: Reading[];
  /** Evidence older than this many days at simulation date needs review. */
  maxAgeDays: number;
}

/** Climate-event status. Kept separate from the loan-change (case) status. */
export type EventStatus = 'qualified' | 'warning' | 'review_required' | 'not_met';

export type CheckResult = 'pass' | 'fail' | 'review' | 'info';

export interface Check {
  key: string;
  label: string;
  result: CheckResult;
  detail: string;
}

export interface EvidenceEvaluation {
  status: EventStatus;
  headline: string;
  rule: string;
  steps: Check[];
  ageDays: number;
}

export type CaseStatus =
  | 'not_affected'
  | 'rule_not_met'
  | 'warning_only'
  | 'review_required'
  | 'proposal_ready'
  | 'accepted'
  | 'declined'
  | 'approved'
  | 'rejected'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'unknown';

export interface Proposal {
  /** Stable for a given event + loan + instalment, so retries never create a second action. */
  operationId: string;
  eventId: string;
  loanId: string;
  /** Loan version the proposal was prepared against. Rechecked at application. */
  loanVersion: number;
  instalmentId: string;
  amount: number;
  originalDueDate: string;
  newDueDate: string;
  policyVersion: string;
  /** Schedule as it stood when the proposal was prepared. Retained after application. */
  originalSchedule: Instalment[];
}

export interface SupportCase {
  borrowerId: string;
  eventId: string;
  status: CaseStatus;
  checks: Check[];
  reviewReasons: string[];
  proposal?: Proposal;
  consent?: { decision: 'accepted' | 'declined'; at: string; operationId: string };
  approval?: { decision: 'approved' | 'rejected'; at: string; operationId: string; loanVersion: number };
  application?: { attempts: number; lastMessage: string; confirmedAt?: string };
  /** Operation IDs of proposals invalidated by a later change. */
  superseded: string[];
  messagePreviewedAt?: string;
}

export type ActivityKind =
  | 'event'
  | 'message'
  | 'acceptance'
  | 'approval'
  | 'loan_change'
  | 'collection'
  | 'review'
  | 'system';

export interface ActivityEntry {
  id: string;
  at: string;
  kind: ActivityKind;
  actor: Role | 'system';
  title: string;
  detail: string;
  borrowerId?: string;
  operationId?: string;
}
