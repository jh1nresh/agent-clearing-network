"use client";

import { useState } from "react";

interface SettledSession {
  id: string;
  callCount: number;
  status: string;
  settledAt: string | null;
}

export default function ReviewForm({
  targetType,
  targetId,
  userId,
  sessions,
}: {
  targetType: "skill" | "agent";
  targetId: string;
  userId?: string;
  sessions?: SettledSession[];
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sessionId, setSessionId] = useState(sessions?.[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No settled sessions — can't review
  if (!sessions || sessions.length === 0) {
    return (
      <div className="mt-6 border-t border-dotted border-[var(--card-border)] pt-6">
        <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-3">
          Write a Review
        </h4>
        <p className="text-sm text-[var(--text-muted)]">
          Complete a session to leave a review.
        </p>
      </div>
    );
  }

  const submit = async () => {
    if (!comment.trim() || !sessionId || !userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${targetType}s/${targetId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, userId, sessionId }),
      });
      if (res.status === 409) {
        setError("You already reviewed this session.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to submit review");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setComment("");
    } catch {
      setError("Failed to submit review");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="py-4 text-center font-mono text-sm text-[var(--text-muted)]">
        Review submitted.
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-dotted border-[var(--card-border)] pt-6">
      <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4">
        Write a Review
      </h4>

      {/* Session selector */}
      <div className="mb-3">
        <label className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">
          Session
        </label>
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="w-full bg-transparent border border-[var(--card-border)] p-2 font-mono text-xs text-[var(--text)] focus:outline-none focus:border-[#b08d57]/50"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id.slice(0, 8)}... — {s.callCount} calls — {s.status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <label className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          Rating
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`text-xl transition-colors ${
                n <= rating ? "text-[#b08d57]" : "text-[var(--text-muted)]/30"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience..."
        rows={3}
        className="w-full bg-transparent border border-[var(--card-border)] p-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/40 focus:outline-none focus:border-[#b08d57]/50 resize-none"
      />

      {error && (
        <p className="mt-2 font-mono text-xs text-red-500">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !comment.trim() || !sessionId}
        className="mt-3 bg-[var(--text)] text-[var(--bg)] font-mono text-xs uppercase tracking-widest px-6 py-2.5 hover:bg-[#b08d57] transition-colors disabled:opacity-40"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </div>
  );
}
