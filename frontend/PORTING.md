# Frontend Porting: BSC/EVM → Solana

Source: `~/maiat-dojo/` (BSC Maiat Dojo, Phase 1+2 shipped)
Target: Colosseum Frontier submission (Solana)

## What copied cleanly (keep as-is)
- `src/app/` layouts, pages structure, globals.css, DarkModeContext
- `src/components/` presentational: SkillCard, TrustCard, TrustBadge, ReviewSection, ReviewForm, landing/, editorial/, chat/
- `tailwind.config.ts`, `next.config.js`, `postcss.config.js`, `tsconfig.json`
- Newspaper aesthetic + design tokens

## Needs web3 swap (EVM → Solana)

### Libraries
| Remove | Add |
|---|---|
| `wagmi`, `viem` | `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/web3.js` |
| `@x402/evm` | `@x402/solana` (check latest name) |
| `@privy-io/react-auth` (optional) | keep if Privy supports Solana OR drop for wallet-adapter only |

### Files to rewrite
- `src/lib/wagmi.ts` → `src/lib/solana.ts` (connection + wallet provider)
- `src/lib/contracts.ts` → `src/lib/programs.ts` (program IDs + Anchor IDLs)
- `src/lib/erc8004.ts` → `src/lib/agent-registry.ts` (Solana Agent Registry client)
- `src/lib/bas.ts` → DROP (attestation moves on-chain via Reputation Ledger)
- `src/lib/bsc-acp.ts` → `src/lib/job-escrow.ts`
- `src/lib/trust-oracle.ts` → `src/lib/reputation.ts`
- `src/lib/gateway-signer.ts` → DROP (no relayer; wallet signs directly)
- `src/lib/relayer.ts` → DROP
- `src/lib/swap-router.ts` → `src/lib/settlement-router.ts` (off-chain routing by rep tier)
- `src/lib/xlayer.ts` → DELETE (abandoned)
- `src/lib/x402.ts` → adapt for x402 on Solana
- `src/hooks/useEscrowFund.ts` → Anchor-based equivalent
- `src/components/BuyWithX402Button.tsx` → Solana x402 flow
- `src/components/PurchaseCard.tsx` → Solana wallet + program calls
- `src/components/PrivyProvider.tsx` → replace with WalletProviderWrapper
- `src/components/TrustCard.tsx` → read from Reputation Ledger PDA

### API routes
All `/api/v1/*` and `/api/sessions/*` were BSC-specific. Options:
1. **Keep the endpoint shape** (clients don't care about chain), swap impl to call Anchor programs
2. Drop API entirely and use client-side wallet + Anchor for MVP (faster for hackathon)

Recommendation: option 2 for speed. API layer is nice-to-have, not core differentiator.

### Prisma / DB
Original had Prisma (Postgres on Railway) for session metadata. For Solana MVP:
- On-chain state is source of truth
- Use Helius webhooks + simple Postgres cache for indexing (per spec §4)
- Skip complex Prisma schema; start with a minimal `sessions_cache` table when needed

## Suggested order
1. Strip EVM deps from package.json, add Solana deps
2. Replace `PrivyProvider` with `WalletProviderWrapper` (wallet-adapter)
3. Build minimal `src/lib/programs.ts` (empty IDLs for now)
4. Gut `/api/` routes — keep only what UI calls
5. Wire up one happy path: register agent → browse skills → fund job → complete
