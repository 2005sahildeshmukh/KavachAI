import { useState } from 'react';
import { GuidedDemo } from './components/GuidedDemo';
import { ShieldArt } from './components/ShieldArt';
import { ROLE_LABEL } from './components/ui';
import { SIM_DATE, formatDate } from './domain/dates';
import type { Role } from './domain/types';
import { BORROWERS } from './fixtures/portfolio';
import { useStore, type Route } from './state/store';
import { ApprovalQueue } from './views/ApprovalQueue';
import { BorrowerCase } from './views/BorrowerCase';
import { EvidenceView } from './views/EvidenceView';
import { HistoryView } from './views/HistoryView';
import { Overview } from './views/Overview';

const ROLES: Role[] = ['officer', 'borrower', 'approver'];

export function App() {
  const { state, scenario, evidence, route, dispatch, navigate } = useStore();
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // The case tab opens the first borrower in the evidence area unless one is already chosen.
  const defaultCase = BORROWERS.find((b) => b.areaId === evidence.areaId)?.id ?? BORROWERS[0].id;
  const caseId = route.borrowerId ?? defaultCase;
  const waiting = Object.values(scenario.cases).filter((c) => ['accepted', 'approved', 'failed', 'unknown'].includes(c.status)).length;

  const tabs: { view: Route['view']; label: string; path: string }[] = [
    { view: 'overview', label: 'Overview', path: 'overview' },
    { view: 'evidence', label: 'Climate evidence', path: 'evidence' },
    { view: 'case', label: 'Borrower case', path: `case/${caseId}` },
    { view: 'queue', label: waiting > 0 ? `Approval queue (${waiting})` : 'Approval queue', path: 'queue' },
    { view: 'history', label: 'Activity history', path: 'history' },
  ];

  return (
    <div className={guideStep !== null ? 'app with-guide' : 'app'}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="demo-strip">
        <span>Student demo · Synthetic data · Mock loan system</span>
        <span>Simulation date {formatDate(SIM_DATE)}</span>
      </div>

      <header className="masthead">
        <div className="brand">
          <ShieldArt />
          <div>
            <p className="brand-name">Kavach</p>
            <p className="brand-line">Climate evidence connected to a reviewed repayment change</p>
          </div>
        </div>
        <div className="masthead-actions">
          <button type="button" className="btn btn-primary" onClick={() => setGuideStep(0)}>
            <span aria-hidden="true">▶</span> Run demo
          </button>
          {confirmReset ? (
            <span className="confirm" role="group" aria-label="Confirm reset">
              Clear all demo state?
              <button
                type="button"
                className="btn"
                onClick={() => {
                  dispatch({ type: 'RESET_ALL' });
                  setConfirmReset(false);
                  setGuideStep(null);
                  navigate('overview');
                }}
              >
                Yes, reset
              </button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmReset(true)}>
              Reset demo
            </button>
          )}
        </div>
      </header>

      <div className="toolbar">
        <nav aria-label="Sections">
          <ul className="tabs">
            {tabs.map((t) => (
              <li key={t.view}>
                <a href={`#/${t.path}`} aria-current={route.view === t.view ? 'page' : undefined}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="role-switch">
          <span id="role-label">Demo role (not a login)</span>
          <div className="segmented" role="group" aria-labelledby="role-label">
            {ROLES.map((r) => (
              <button key={r} type="button" aria-pressed={state.role === r} onClick={() => dispatch({ type: 'SET_ROLE', role: r })}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main id="main" tabIndex={-1}>
        {route.view === 'overview' && <Overview />}
        {route.view === 'evidence' && <EvidenceView />}
        {route.view === 'case' && <BorrowerCase borrowerId={caseId} />}
        {route.view === 'queue' && <ApprovalQueue />}
        {route.view === 'history' && <HistoryView />}
      </main>

      <footer className="footer">
        <p>
          Independent student demonstration for a hackathon. It is not an official application of any lender. All borrowers, places, loans and climate records are
          invented. No real messages are sent and no money moves.
        </p>
        <p>
          Demo state is saved only in this browser, so each browser and device has its own copy. Role switching is for demonstration and gives no real
          authentication or security.
        </p>
      </footer>

      {guideStep !== null && <GuidedDemo step={guideStep} setStep={setGuideStep} />}
    </div>
  );
}
