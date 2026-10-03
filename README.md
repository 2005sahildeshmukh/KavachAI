# Kavach: student hackathon prototype

Kavach shows how a lender could connect a climate warning or observed event to borrower communication and a reviewed repayment change. It covers heat, flood and drought with one shared support workflow.

**Live demo:** https://kavach-demo-sd26.web.app

> Student demo · Synthetic data · Mock loan system
>
> This is an independent student demonstration. It is not an official application of Satin or any other lender. No real integration, permission or partnership exists.

## Run, test, build

Needs Node.js 20 or later.

```bash
npm install
npm run dev       # local development server
npm test          # unit tests for rules, schedule, adapter and state transitions
npm run build     # type-check, then production build into dist/
npm run preview   # serve the production build locally
```

## Deploy

The build is a static site with relative asset paths and hash routes (`#/overview`), so it works on any static host without rewrite rules.

The live demo is on Firebase Hosting, in a project created only for this demo:

```bash
npm run build
firebase deploy --only hosting --project kavach-demo-sd26
```

To use another host, upload the contents of `dist/`.

## Demo walkthrough

Press **Run demo** for a guided version, or follow these steps yourself. The simulation date is fixed at 12 May 2026.

1. **Overview.** Twenty fictional borrowers in four fictional areas. Heat is selected and covers Suryagarh block.
2. **Climate evidence.** Three complete days at 40.5, 41.0 and 40.8°C. Each step of the demo rule is shown.
3. **Borrower case: Sunita.** Three unpaid instalments of ₹1,500 on 15 May, 15 June and 15 July. The proposal moves May to 15 August. The total stays ₹4,500.
4. **Borrower accepts.** Switch the demo role to Borrower and accept. The message preview is available in English and Hindi.
5. **Approver approves.** In the approval queue, switch to Approver and approve. Approval alone does not change the loan.
6. **Apply to the mock loan system.** Success appears only after the mock system commits and the collection record matches.
7. **Confirmed schedule.** 15 May shows ₹0 with a "Deferred" label. 15 August shows ₹1,500.
8. **Activity history.** Every step is listed with its operation reference. The original and revised schedules are kept.

Exceptions to try:

| Situation | How to trigger it | What happens |
| --- | --- | --- |
| Borrower declines | Decline as Borrower | No schedule change. Nothing reaches the approver. |
| Missing evidence | Sample evidence: "Missing a day" | Cases go to review. No proposal. |
| Exactly 40°C | Sample evidence: "Exactly 40°C on one day" | Rule not met. |
| Warning only | Sample evidence: a forecast, rainfall warning or outlook | Borrower can be informed. No proposal. |
| Unaffected area | Open any borrower outside the evidence area | Not affected. No case. |
| Duplicate approval or request | "Approve again" or "Send the same request again" | The existing result is returned. No second benefit. |
| Payment during approval | "Simulate a posted payment" on the case | The proposal is invalidated and returns for review. |
| System failure | "Simulate system failure": fails before committing | Red failure state. Official dues unchanged. Retry reuses the same operation. |
| Unknown outcome | "Simulate system failure": loses its response | The existing operation is queried. No new financial action. |
| Arrears, prior relief, unsupported product, not enrolled | Rekha, Meena, Shabnam (flood), Asha (drought) | Review with the reason stated. |

## Structure

```
src/
  domain/      Pure logic: hazard rules, schedule, eligibility, messages, dates
  fixtures/    Synthetic borrowers, loans and evidence records
  adapter/     LoanSystemAdapter interface and MockLoanSystemAdapter
  state/       Reducer (workflow transitions), persistence, selectors
  components/  Small reusable UI pieces
  views/       Overview, Climate evidence, Borrower case, Approval queue, Activity history
```

## Assumptions

- **Heat rule.** Daily maximum strictly above 40°C on three complete consecutive days. This is an arbitrary test rule. It is not an official heatwave definition or a validated loss threshold.
- **Flood rule.** An observed inundation record for the matching area. A rainfall warning by itself stays a warning.
- **Drought rule.** A drought assessment over a completed seasonal reference period for the matching area. Drought has no short advance-warning window.
- **Relief.** One unpaid, not-yet-due instalment moves to one month after the last scheduled due date. Other dates stay. The total is unchanged. The payment is postponed, not forgiven.
- **Funding.** Illustrative lender-funded relief. No extra borrower charge in this demo. A real policy requires lender approval and funding.
- **Schedule.** This is a schedule simulation, not a production interest or amortisation calculation.

## Simulation labels

- Every borrower, business, area, loan and climate record is invented. Evidence is marked "Synthetic test fixture" and does not imitate any agency's bulletin.
- No real messages are sent. The message and speech previews are previews only.
- No money moves and no real financial system is connected.
- No impact figures are claimed. Counts on the overview are computed from the demo state.

## Limitations

- **State is local.** Demo state is saved in the browser's local storage with a schema version. Each browser and device has its own independent copy. **Reset demo** clears it.
- **Roles are not security.** Role switching is for demonstration only. It gives no authentication or authorisation.
- **Scenarios are sandboxes.** Each hazard and evidence sample has its own cases and mock loan records, so nothing carries over between events.
- **No climate model.** The app reads fixed sample records. It does not predict anything.
- **Mock behaviour only.** Duplicate prevention, version rechecks and unknown-outcome recovery are shown inside a single-browser mock. They are not production concurrency guarantees.
- **Speech preview** depends on the voices installed on the device. If none fits, the text is the fallback.

## Mock adapter and a future lender integration

`MockLoanSystemAdapter` is an in-browser stand-in. It holds the synthetic loans, commits a change together with the collection record, recognises a repeated operation ID, and rejects a stale loan version.

A real integration would implement the same `LoanSystemAdapter` interface against the lender's own system. That needs things this project does not have: a chosen legal entity and loan product, a supported API or an authorised staff workflow, the lender's core staying authoritative, reconciliation with collections, and an approved and funded relief policy. The operation names in the interface are our own proposal. They are not Satin endpoint names.
