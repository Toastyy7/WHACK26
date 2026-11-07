"use client";

import { useEffect, useState } from "react";
import SilentGraceButton from "../components/SilentGraceButton";

export default function HomePage() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchBalance() {
    setLoading(true);
    try {
      const res = await fetch("/api/check-balance");
      const data = await res.json();
      setBalance(data.balance);
    } catch (err) {
      console.error("Failed to fetch balance", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBalance();
  }, []);

  return (
    <div className="space-y-8">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          WHACK26 Banking Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Hackathon prototype testing frontend & simulated APIs
        </p>
      </header>

      {/* Account Balance Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Current Balance</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {loading ? "Checking..." : `$${balance?.toFixed(2)}`}
            </p>
          </div>
          <button
            onClick={fetchBalance}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Silent Grace Action */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Payment Support & Grace Period
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Need breathing room? Request an automated 14-day pause on upcoming payments under FCA Consumer Duty guidelines.
          </p>
        </div>

        {balance !== null && (
          <SilentGraceButton userId="user_hackathon_demo" currentBalance={balance} />
        )}
      </div>
    </div>
  );
}
