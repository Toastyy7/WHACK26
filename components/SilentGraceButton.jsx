"use client";

import { useState } from "react";

export default function SilentGraceButton({ userId, currentBalance }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleRequest() {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/silent-grace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, currentBalance }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "We couldn't submit your request.");
      }

      if (
        data.status !== "success" ||
        typeof data.letter !== "string" ||
        typeof data.referenceNumber !== "string"
      ) {
        throw new Error("The response from the service was incomplete. Please try again.");
      }

      setResult(data);
      setStatus("success");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again.",
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <section className="space-y-4" aria-live="polite">
        <div className="flex items-center gap-3 text-green-800">
          <span className="flex h-10 w-10 animate-[bounce_500ms_ease-out_1] items-center justify-center rounded-full bg-green-100 text-xl font-bold">
            ✓
          </span>
          <p className="font-semibold">Request filed successfully</p>
        </div>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Your Silent Grace request
            </h2>
            <p className="text-sm text-slate-500">
              Reference: <span className="font-medium text-slate-700">{result.referenceNumber}</span>
            </p>
          </div>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
            {result.letter}
          </p>
        </article>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleRequest}
        disabled={status === "loading"}
        className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" && (
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {status === "loading"
          ? "Drafting secure request..."
          : "Request 14-Day Silent Grace"}
      </button>

      {status === "error" && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
