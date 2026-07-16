# Execution Plan — Week 1 (4/23 - 4/29)

> One task = one commit. Tick as we go.

## Day 0 — 4/23 ✅
- [x] Repo + spec + UI port + Anchor scaffold + build green

## Day 1 — 4/24 · Agent Registry + Wallet

- [ ] **T1** — `agent_registry` program: `register_agent(metadata_uri)`
  - PDA seeds: `[b"agent", owner]`
  - State: `Agent { owner, agent_id, metadata_uri, created_at, bump }`
  - Auto-increment `agent_id` via a `Counter` PDA
  - Anchor test: register + re-register should fail
- [ ] **T2** — Frontend: replace `PrivyProvider` with `WalletProviderWrapper`
  - Scan layout.tsx + ClientInit.tsx for Privy imports → swap
  - `pnpm install` verify typecheck
- [ ] **T3** — Frontend `src/lib/solana.ts` + `src/lib/programs.ts`
  - Connection (devnet RPC)
  - Program ID map from Anchor.toml

## Day 2 — 4/25 · Skill Listing + Register UI

- [ ] **T4** — `skill_listing` program: `list_skill`
  - PDA: `[b"skill", provider_agent, skill_id]`
  - Fields: endpoint_uri, price (u64 lamports/USDC), min_reputation, accepted_rails (bitflags)
- [ ] **T5** — UI: `/register` page — connect wallet → register agent → show agent_id

## Day 3 — 4/26 · Job Escrow (hardest)

- [ ] **T6** — `job_escrow` state machine
  - `open_job(skill, client, evaluator, amount)` → PDA + USDC vault ATA (owned by PDA authority)
  - `submit_result(ref_uri)` → Funded → Submitted
  - `accept_result()` → Submitted → Completed (CPI to reputation_ledger stub)
  - `reject_result()` → refund client
  - `expire_job()` → refund after TTL

## Day 4 — 4/27 · Reputation Ledger + CPI

- [ ] **T7** — `reputation_ledger` program
  - PDA: `[b"reputation", agent]`
  - Ix: `initialize_reputation`, `record_completion(volume, latency, success: bool)`
  - **Access control**: only escrow program can call `record_*` (check `instruction_sysvar` or use CPI signer check)
- [ ] **T8** — Wire escrow → reputation CPI in `accept_result` / `reject_result`
- [ ] Tests: end-to-end escrow happy path on localnet

## Day 5 — 4/28 · Demo agent + x402 client

- [ ] **T9** — UI: browse skills page + call one skill (x402 on Solana)
- [ ] **T10** — Python/TS agent that discovers skills + pays via x402

## Day 6 — 4/29 · Integration

- [ ] **T11** — Happy-path end-to-end on devnet: register → list skill → open job → submit → accept → rep updated
- [ ] **T12** — Week 1 checkpoint: tx signature on Solscan + screenshot
