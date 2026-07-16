'use client';

export default function CheckoutCard() {
  return (
    <div className="border-t border-dotted border-[var(--border)] pt-4 mt-4">
      <div className="space-y-3">
        {/* Settlement section */}
        <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Settlement
        </div>
        <div className="border-t border-dotted border-[var(--border)] pt-2 space-y-0">
          {[
            { label: 'Network', value: 'BNB Smart Chain' },
            { label: 'Standard', value: 'ERC-8183' },
            { label: 'Payment', value: 'USDC per call' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-1 border-b border-dotted border-[var(--border-light)] last:border-b-0"
            >
              <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                {label}
              </span>
              <span className="font-mono text-[10px] text-[var(--text)] font-bold">{value}</span>
            </div>
          ))}
        </div>

        {/* Revenue split section */}
        <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-3 mb-1">
          Revenue Split
        </div>
        <div className="border-t border-dotted border-[var(--border)] pt-2 space-y-0">
          {[
            { label: 'Creator', value: '95%' },
            { label: 'Protocol', value: '5%' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-1 border-b border-dotted border-[var(--border-light)] last:border-b-0"
            >
              <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                {label}
              </span>
              <span className="font-mono text-[10px] text-[var(--text)] font-bold">{value}</span>
            </div>
          ))}
        </div>

        {/* Footer line */}
        <div className="font-mono text-[9px] text-[var(--text-secondary)] border-l-2 border-[var(--border)] pl-2 mt-2">
          Escrow: ERC-8183 · Settle: on PASS
        </div>
      </div>
    </div>
  );
}
