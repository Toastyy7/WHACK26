import React from 'react';
import { parsePoundsToPence } from '../account.js';

// Show pounds in the input, but save integer pence in the shared account.
function MoneyControl({ label, amount, minimum, onSave }) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={minimum / 100}
        max="9999999.99"
        step="0.01"
        key={amount}
        defaultValue={(amount / 100).toFixed(2)}
        onBlur={(event) => {
          const value = parsePoundsToPence(event.target.value);
          // Reject empty, negative or overly precise amounts. The limit must be positive.
          if (value !== null && value >= minimum) {
            onSave(value);
          } else {
            event.target.value = (amount / 100).toFixed(2);
          }
        }}
      />
    </label>
  );
}

// Presenter-only controls for the account amounts and gauge target.
export default function DemoControls({
  account,
  updateAccount,
}) {
  return (
    <details className="demo">
      <summary>Demo controls</summary>
      <div className="controls">
        <MoneyControl
          label="Starting balance before this month’s transactions (£)"
          amount={account.balance}
          minimum={0}
          onSave={(balance) => updateAccount({ balance })}
        />
        <MoneyControl
          label="Credit limit (£)"
          amount={account.limit}
          minimum={1}
          onSave={(limit) => updateAccount({ limit })}
        />
        <label>
          Credit limit target (%)
          <input
            type="number"
            min="1"
            max="49"
            step="1"
            key={account.target}
            defaultValue={account.target}
            // Save when the input loses focus; restore the old value if it is invalid.
            onBlur={(e) => {
              const target = Number(e.target.value);
              if (Number.isInteger(target) && target >= 1 && target <= 49)
                updateAccount({ target });
              else e.target.value = account.target;
            }}
          />
        </label>
      </div>
      <p>
        Selected transactions from the current month are added to this starting balance, like purchases on a real card. Amounts save when you leave the field. Starting balance must be £0 or more and
        credit limit must be at least £0.01. Use up to two decimal places;
        invalid entries revert to the previous amount.
      </p>
    </details>
  );
}

