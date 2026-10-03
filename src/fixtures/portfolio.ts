import { addMonths } from '../domain/dates';
import type { Area, Borrower, Instalment, Loan } from '../domain/types';

/**
 * Synthetic portfolio. Every name, place, business and loan here is invented for the demo.
 * No real customer, lender or location data is used.
 */
export const AREAS: Area[] = [
  { id: 'A1', name: 'Suryagarh block' },
  { id: 'A2', name: 'Neelpur block' },
  { id: 'A3', name: 'Chandanwadi block' },
  { id: 'A4', name: 'Meghpur block' },
];

export const MAIN_BORROWER_ID = 'B01';

const STANDARD_PRODUCT = 'Group business loan (monthly)';

interface Row {
  name: string;
  business: string;
  areaId: string;
  amount: number;
  firstDue: string;
  count: number;
  paid: number;
  enrolled?: boolean;
  product?: string;
  priorRelief?: string;
}

// `paid` counts instalments already paid, starting from the first.
// Rows with a past-due unpaid instalment model existing arrears.
const ROWS: Row[] = [
  { name: 'Sunita', business: 'Tailoring shop', areaId: 'A1', amount: 1500, firstDue: '2026-03-15', count: 5, paid: 2 },
  { name: 'Kavita', business: 'Vegetable stall', areaId: 'A1', amount: 1200, firstDue: '2026-03-20', count: 6, paid: 2 },
  { name: 'Rekha', business: 'Small dairy', areaId: 'A1', amount: 1800, firstDue: '2026-02-15', count: 6, paid: 2 },
  { name: 'Meena', business: 'Tea stall', areaId: 'A1', amount: 1000, firstDue: '2026-03-18', count: 5, paid: 2, priorRelief: 'One instalment was deferred in February 2026 (synthetic record).' },
  { name: 'Anita', business: 'Bangle shop', areaId: 'A1', amount: 2000, firstDue: '2026-03-25', count: 5, paid: 2 },

  { name: 'Farida', business: 'Grocery shop', areaId: 'A2', amount: 1500, firstDue: '2026-03-15', count: 5, paid: 2 },
  { name: 'Lakshmi', business: 'Poultry unit', areaId: 'A2', amount: 1300, firstDue: '2026-03-20', count: 6, paid: 2 },
  { name: 'Pooja', business: 'Snack cart', areaId: 'A2', amount: 1100, firstDue: '2026-02-18', count: 6, paid: 2 },
  { name: 'Shabnam', business: 'Embroidery workshop', areaId: 'A2', amount: 2500, firstDue: '2026-03-22', count: 5, paid: 2, product: 'Individual enterprise loan' },
  { name: 'Geeta', business: 'Flower stall', areaId: 'A2', amount: 1000, firstDue: '2026-03-25', count: 5, paid: 2 },

  { name: 'Radha', business: 'Flour mill', areaId: 'A3', amount: 1500, firstDue: '2026-03-15', count: 5, paid: 2 },
  { name: 'Savitri', business: 'Goat rearing', areaId: 'A3', amount: 1400, firstDue: '2026-03-20', count: 6, paid: 2 },
  { name: 'Nirmala', business: 'Seed and fodder shop', areaId: 'A3', amount: 1600, firstDue: '2026-03-18', count: 5, paid: 2, priorRelief: 'One instalment was deferred in January 2026 (synthetic record).' },
  { name: 'Asha', business: 'Pottery', areaId: 'A3', amount: 1200, firstDue: '2026-03-22', count: 5, paid: 2, enrolled: false },
  { name: 'Usha', business: 'Vegetable farming', areaId: 'A3', amount: 1700, firstDue: '2026-03-25', count: 5, paid: 2 },

  { name: 'Mamta', business: 'Stationery shop', areaId: 'A4', amount: 1500, firstDue: '2026-03-15', count: 5, paid: 2 },
  { name: 'Seema', business: 'Beauty parlour', areaId: 'A4', amount: 1800, firstDue: '2026-03-20', count: 6, paid: 2 },
  { name: 'Rukhsana', business: 'Bakery', areaId: 'A4', amount: 2200, firstDue: '2026-03-18', count: 5, paid: 2 },
  { name: 'Deepa', business: 'Mobile repair kiosk', areaId: 'A4', amount: 1300, firstDue: '2026-03-22', count: 5, paid: 2 },
  { name: 'Parvati', business: 'Basket weaving', areaId: 'A4', amount: 1000, firstDue: '2026-03-25', count: 5, paid: 2 },
];

const pad = (n: number) => String(n).padStart(2, '0');

export const BORROWERS: Borrower[] = ROWS.map((r, i) => ({
  id: `B${pad(i + 1)}`,
  name: r.name,
  business: r.business,
  areaId: r.areaId,
  enrolled: r.enrolled ?? true,
  loanId: `L${pad(i + 1)}`,
}));

/** Fresh copies of the synthetic loans, as the mock loan system holds them at the start. */
export function createLoans(): Loan[] {
  return ROWS.map((r, i) => {
    const instalments: Instalment[] = Array.from({ length: r.count }, (_, k) => ({
      id: `I${k + 1}`,
      dueDate: addMonths(r.firstDue, k),
      amount: r.amount,
      status: k < r.paid ? 'paid' : 'unpaid',
    }));
    return {
      id: `L${pad(i + 1)}`,
      borrowerId: `B${pad(i + 1)}`,
      product: r.product ?? STANDARD_PRODUCT,
      supportedProduct: !r.product,
      version: 1,
      instalments,
      priorRelief: r.priorRelief,
      reliefEventIds: [],
    };
  });
}

export function areaName(areaId: string): string {
  return AREAS.find((a) => a.id === areaId)?.name ?? areaId;
}

export function borrowerById(id: string): Borrower | undefined {
  return BORROWERS.find((b) => b.id === id);
}
