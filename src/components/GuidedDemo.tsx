import { useEffect, useRef } from 'react';
import { MAIN_BORROWER_ID } from '../fixtures/portfolio';
import { useStore } from '../state/store';

interface Step {
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { title: 'Portfolio', text: 'Twenty fictional borrowers. The heat scenario covers Suryagarh block. Every count on this page comes from the demo state.' },
  { title: 'Climate evidence', text: 'Three complete days at 40.5, 41.0 and 40.8°C. The demo rule needs every day strictly above 40°C, and each step of the rule is shown.' },
  { title: "Sunita's case", text: 'Her May instalment of ₹1,500 would move to 15 August. June and July stay the same, and the total stays ₹4,500.' },
  { title: 'Borrower accepts', text: 'As the borrower, Sunita accepts the exact terms. A lender cannot approve before this.' },
  { title: 'Lender approves', text: 'As the approver, the change is approved. Approval alone does not change the loan.' },
  { title: 'Mock loan system', text: 'The change is sent with a stable operation reference. The loan version and the instalment are rechecked before anything is committed.' },
  { title: 'Confirmed schedule', text: '15 May now shows ₹0 and "Deferred". Success appears only after the mock system commits and the collection record matches.' },
  { title: 'Activity history', text: 'Each step is recorded, with the original and revised schedules kept. Next, try a decline, missing evidence, a payment during approval or a system failure.' },
];

export function GuidedDemo({ step, setStep }: { step: number; setStep: (s: number | null) => void }) {
  const { dispatch, apply, navigate } = useStore();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = MAIN_BORROWER_ID;

  // Each step performs its own action when it is entered.
  useEffect(() => {
    switch (step) {
      case 0:
        dispatch({ type: 'SELECT_HAZARD', hazard: 'heat' });
        dispatch({ type: 'SELECT_VARIANT', variant: 'qualifying' });
        dispatch({ type: 'RESET_SCENARIO' });
        dispatch({ type: 'SET_ROLE', role: 'officer' });
        navigate('overview');
        break;
      case 1:
        navigate('evidence');
        break;
      case 2:
        navigate(`case/${id}`);
        break;
      case 3:
        dispatch({ type: 'SET_ROLE', role: 'borrower' });
        dispatch({ type: 'ACCEPT', borrowerId: id });
        break;
      case 4:
        dispatch({ type: 'SET_ROLE', role: 'approver' });
        dispatch({ type: 'APPROVE', borrowerId: id });
        navigate('queue');
        break;
      case 5:
        apply(id);
        break;
      case 6:
        navigate(`case/${id}`);
        break;
      case 7:
        navigate('history');
        break;
    }
    headingRef.current?.focus();
  }, [step, dispatch, apply, navigate, id]);

  const last = step === STEPS.length - 1;
  return (
    <aside className="guide" aria-label="Guided demo">
      <p className="guide-count">
        Guided demo · step {step + 1} of {STEPS.length}
      </p>
      <h2 ref={headingRef} tabIndex={-1}>
        {STEPS[step].title}
      </h2>
      <p aria-live="polite">{STEPS[step].text}</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => setStep(last ? null : step + 1)}>
          {last ? 'Finish' : `Next: ${STEPS[step + 1].title}`}
        </button>
        {!last && (
          <button type="button" className="btn" onClick={() => setStep(null)}>
            End walkthrough
          </button>
        )}
      </div>
    </aside>
  );
}
