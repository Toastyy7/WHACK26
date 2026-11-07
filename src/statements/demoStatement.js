// Realistic pre-parsed statement dataset for instant demoing without file upload.
export function getDemoStatement() {
  const transactions = [
    { id: 'demo-tx-1', date: '02 Oct 26', isoDate: '2026-10-02', description: 'SAINSBURYS S/MKTS LONDON', page: 1, amount: 4850, category: 'Groceries', included: true },
    { id: 'demo-tx-2', date: '04 Oct 26', isoDate: '2026-10-04', description: 'TFL TRAVEL CHARGE TFL.GOV.UK', page: 1, amount: 780, category: 'Transport', included: true },
    { id: 'demo-tx-3', date: '07 Oct 26', isoDate: '2026-10-07', description: 'AMAZON.CO.UK*2E4X8 PRIME', page: 1, amount: 899, category: 'Subscriptions', included: true },
    { id: 'demo-tx-4', date: '11 Oct 26', isoDate: '2026-10-11', description: 'COSTA COFFEE COVENTRY', page: 1, amount: 420, category: 'Takeaways & dining', included: true },
    { id: 'demo-tx-5', date: '14 Oct 26', isoDate: '2026-10-14', description: 'EE MOBILE MONTHLY BILL', page: 1, amount: 2500, category: 'Bills & utilities', included: true },
    { id: 'demo-tx-6', date: '18 Oct 26', isoDate: '2026-10-18', description: 'BOOTS PHARMACY WARWICK', page: 1, amount: 1640, category: 'Health & personal care', included: true },
    { id: 'demo-tx-7', date: '21 Oct 26', isoDate: '2026-10-21', description: 'PUREGYM RECURRING DIRECT DEBIT', page: 1, amount: 1999, category: 'Subscriptions', included: true },
    { id: 'demo-tx-8', date: '25 Oct 26', isoDate: '2026-10-25', description: 'NANDOS CHICKEN COVENTRY', page: 1, amount: 2850, category: 'Takeaways & dining', included: true },
    { id: 'demo-tx-9', date: '28 Oct 26', isoDate: '2026-10-28', description: 'ASDA SUPERSTORE ONLINE', page: 1, amount: 5410, category: 'Groceries', included: true },
  ];

  const declaredTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0); // 21348 pence (£213.48)

  return {
    transactions,
    declaredTotal,
    supportedPages: 1,
    pageCount: 1,
    unresolved: 0,
  };
}
