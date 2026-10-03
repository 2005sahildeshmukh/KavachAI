import { formatDate, inr } from '../domain/dates';
import { compareSchedules, remainingTotal } from '../domain/schedule';
import type { Instalment } from '../domain/types';

export const RELIEF_DISCLOSURE =
  'Illustrative lender-funded relief. No extra borrower charge in this demo. A real policy requires lender approval and funding.';

interface Props {
  before: Instalment[];
  after: Instalment[];
  /** True only once the mock loan system has committed and the collection record matches. */
  applied: boolean;
}

export function ScheduleCompare({ before, after, applied }: Props) {
  const rows = compareSchedules(before, after);
  const cell = (n: number | null) => (n === null ? '—' : inr(n));
  return (
    <div className="table-wrap">
      <table className="table schedule">
        <caption className="sr-only">Instalments before and after the {applied ? 'applied' : 'proposed'} change</caption>
        <thead>
          <tr>
            <th scope="col">Due date</th>
            <th scope="col" className="num">
              Original
            </th>
            <th scope="col" className="num">
              {applied ? 'Revised (applied)' : 'Proposed (not applied)'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dueDate + (r.note ?? '')} className={r.note === 'Deferred' ? 'row-deferred' : r.note === 'Moved here' ? 'row-moved' : ''}>
              <th scope="row">{formatDate(r.dueDate)}</th>
              <td className="num">{cell(r.before)}</td>
              <td className="num">
                {cell(r.after)}
                {r.note && <span className="row-note">{r.note}</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total remaining</th>
            <td className="num">{inr(remainingTotal(before))}</td>
            <td className="num">{inr(remainingTotal(after))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ScheduleList({ instalments }: { instalments: Instalment[] }) {
  const rows = [...instalments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <div className="table-wrap">
      <table className="table schedule">
        <caption className="sr-only">Current loan schedule in the mock loan system</caption>
        <thead>
          <tr>
            <th scope="col">Due date</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className={i.status === 'paid' ? 'row-paid' : ''}>
              <th scope="row">{formatDate(i.dueDate)}</th>
              <td className="num">{inr(i.amount)}</td>
              <td>{i.status === 'paid' ? 'Paid' : i.status === 'deferred' ? `Deferred to ${formatDate(i.movedTo as string)}` : i.movedFrom ? `Unpaid (moved from ${formatDate(i.movedFrom)})` : 'Unpaid'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total remaining</th>
            <td className="num">{inr(remainingTotal(instalments))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
