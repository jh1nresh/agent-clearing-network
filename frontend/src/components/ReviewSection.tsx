"use client";

interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string | null;
    walletAddress: string | null;
  };
  session: {
    id: string;
    callCount: number;
    status: string;
    settledAt: string | null;
  } | null;
}

function truncateAddress(addr: string | null): string {
  if (!addr) return "anon";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ReviewSection({ reviews }: { reviews: ReviewData[] }) {
  if (reviews.length === 0) {
    return (
      <section className="glass-card p-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.15em] mb-4 text-[var(--text-muted)]">
          Reviews
        </div>
        <p className="text-sm text-[var(--text-muted)]">No reviews yet.</p>
      </section>
    );
  }

  return (
    <section className="glass-card p-8">
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] mb-5 text-[var(--text-muted)]">
        Reviews ({reviews.length})
      </div>
      <div className="space-y-5">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="border-b border-[var(--card-border)] pb-5 last:border-0 last:pb-0"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#b08d57]">
                  {"★".repeat(r.rating)}
                  {"★".repeat(5 - r.rating).split("").map(() => "☆").join("")}
                </span>
                {r.session && (
                  <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#b08d57]/10 text-[#b08d57]">
                    Verified
                  </span>
                )}
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {timeAgo(r.createdAt)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-2">
              {r.comment}
            </p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
              <span>{r.user.displayName || truncateAddress(r.user.walletAddress)}</span>
              {r.session && (
                <>
                  <span>·</span>
                  <span>{r.session.callCount} calls</span>
                  <span>·</span>
                  <span>{r.session.status}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
