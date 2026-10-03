import type { ReactNode } from 'react';
import type { CaseStatus, Check, CheckResult, EventStatus, Hazard, Role } from '../domain/types';
import { useStore } from '../state/store';

export type Tone = 'neutral' | 'teal' | 'amber' | 'green' | 'red';

// Colour is always paired with a symbol and text.
const TONE_ICON: Record<Tone, string> = { neutral: '○', teal: '◆', amber: '!', green: '✓', red: '✕' };

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone }> = {
  not_affected: { label: 'Not affected', tone: 'neutral' },
  rule_not_met: { label: 'Rule not met', tone: 'neutral' },
  warning_only: { label: 'Warning only', tone: 'amber' },
  review_required: { label: 'Review required', tone: 'amber' },
  proposal_ready: { label: 'Awaiting borrower', tone: 'teal' },
  accepted: { label: 'Awaiting approval', tone: 'amber' },
  declined: { label: 'Declined by borrower', tone: 'neutral' },
  approved: { label: 'Approved, not applied', tone: 'amber' },
  rejected: { label: 'Rejected by approver', tone: 'neutral' },
  applying: { label: 'Applying', tone: 'amber' },
  applied: { label: 'Applied and confirmed', tone: 'green' },
  failed: { label: 'Application failed', tone: 'red' },
  unknown: { label: 'Outcome unknown', tone: 'amber' },
};

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
  qualified: { label: 'Qualifying observed event', tone: 'teal' },
  warning: { label: 'Warning only', tone: 'amber' },
  review_required: { label: 'Evidence needs review', tone: 'amber' },
  not_met: { label: 'Rule not met', tone: 'neutral' },
};

export const ROLE_LABEL: Record<Role, string> = { officer: 'Field officer', borrower: 'Borrower', approver: 'Approver' };

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span aria-hidden="true" className="badge-icon">
        {TONE_ICON[tone]}
      </span>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const meta = CASE_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function FixtureTag() {
  return <span className="fixture-tag">Synthetic test fixture</span>;
}

export function Card({ title, aside, children, className = '' }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

const CHECK_META: Record<CheckResult, { icon: string; word: string; tone: Tone }> = {
  pass: { icon: '✓', word: 'Met', tone: 'green' },
  fail: { icon: '✕', word: 'Not met', tone: 'neutral' },
  review: { icon: '!', word: 'Needs review', tone: 'amber' },
  info: { icon: 'i', word: 'Note', tone: 'teal' },
};

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => {
        const meta = CHECK_META[c.result];
        return (
          <li key={c.key}>
            <span className={`check-icon tone-${meta.tone}`} aria-hidden="true">
              {meta.icon}
            </span>
            <div>
              <strong>{c.label}</strong>
              <span className="check-word"> · {meta.word}</span>
              <p>{c.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HazardIcon({ hazard }: { hazard: Hazard }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, 'aria-hidden': true };
  if (hazard === 'heat') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </svg>
    );
  }
  if (hazard === 'flood') {
    return (
      <svg {...common}>
        <path d="M2 9c2.500-2 4.500-2 7 0s4.500 2 7 0 4-2 6 0M2 15c2.500-2 4.500-2 7 0s4.500 2 7 0 4-2 6 0M2 21c2.500-2 4.500-2 7 0s4.500 2 7 0 4-2 6 0" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 21v-9M12 12c0-4 2.500-6 6-6 0 4-2.500 6-6 6zM12 15c0-3-2-5-5-5 0 3 2 5 5 5zM4 21h16" />
    </svg>
  );
}

/**
 * Wraps an action that belongs to one demo role. Role switching is for
 * demonstration only and gives no real authentication or security.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { state, dispatch } = useStore();
  if (state.role === role) return <>{children}</>;
  return (
    <div className="role-gate">
      <p>
        This step belongs to the <strong>{ROLE_LABEL[role]}</strong>. You are viewing as {ROLE_LABEL[state.role]}.
      </p>
      <button type="button" className="btn" onClick={() => dispatch({ type: 'SET_ROLE', role })}>
        Switch demo role to {ROLE_LABEL[role]}
      </button>
    </div>
  );
}
