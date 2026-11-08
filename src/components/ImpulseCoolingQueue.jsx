import React from 'react';
import { formatMoney } from '../utils/format.js';

// `name` is the signed-in person's name, or null for a guest ("you" wording).
export default function ImpulseCoolingQueue({ items, savings, onDismiss, onAddSimulated, name = null }) {

  function handleSaveItem(id) {
    onDismiss(id);
  }

  function handleAddMockItem() {
    const mock = {
      version: 1,
      id: `cool-${Date.now()}`,
      title: 'Smart Fitness Tracker',
      store: 'Amazon UK',
      amount: 5499, // £54.99
      savedAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    onAddSimulated(mock);
  }

  return (
    <section className="card cooling-queue-card">
      <p className="eyebrow">02 / ADHD IMPULSE SHIELD</p>
      <h2>30-minute reflection queue</h2>
      <p>
        Checkouts intercepted by the Capital One Chrome Extension to prevent impulsive overspending.
      </p>

      {savings > 0 && (
        <div className="savings-badge" role="status">
          <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>🎉</span>
          <div>
            <strong>Total Impulse Money Saved: {formatMoney(savings)}</strong>
            <p className="savings-subtext">Money kept in {name ? `${name}’s` : 'your'} account by pausing and stepping away from impulsive buys.</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-cooling">
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>No items in your reflection queue right now.</p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
            When {name ? `${name} shops` : 'you shop'} online, the extension intercepts checkout and offers a 30-minute cooling pause.
          </p>
          <button type="button" className="secondary" onClick={handleAddMockItem}>
            + Simulate Extension Interception (£54.99 Tracker)
          </button>
        </div>
      ) : (
        <>
          <ul className="cooling-list">
            {items.map((item) => (
              <li key={item.id} className="cooling-item-card">
                <div className="cooling-item-header">
                  <strong>{item.title}</strong>
                  <span className="cooling-amount">{formatMoney(item.amount)}</span>
                </div>
                <p className="cooling-meta">
                  Paused from <strong>{item.store}</strong> · ⏳ 30-min cooldown active
                </p>
                <div className="actions" style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="celebrate-btn"
                    onClick={() => handleSaveItem(item.id)}
                  >
                    ✓ I don't need this (Save {formatMoney(item.amount)}!)
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '12px' }}>
            <button type="button" className="secondary" onClick={handleAddMockItem}>
              + Add another simulated checkout
            </button>
          </div>
        </>
      )}
    </section>
  );
}
