// Older uploads have no included field; keep them selected by default.
export function includedTransactions(transactions) {
  return transactions.filter((transaction) => transaction.included !== false);
}

// Keep removed rows in the import so they can be restored without re-uploading.
export function setTransactionIncluded(statement, id, included) {
  return {
    ...statement,
    result: {
      ...statement.result,
      transactions: statement.result.transactions.map((transaction) =>
        transaction.id === id ? { ...transaction, included } : transaction),
    },
  };
}
