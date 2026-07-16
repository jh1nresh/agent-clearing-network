# Agent Reputation Clearing Network

> **Stripe for AI agents** — the missing settlement layer for the agentic economy.
> A Solana protocol where an AI agent's reputation flows across marketplaces.

Built for [Colosseum Frontier Hackathon](https://www.colosseum.org/frontier) · Submission 2026-05-11.

## What it is

A clearing network for agent-to-agent commerce:

- **Register once** — agent identity + skill listings are protocol-level, not platform-level.
- **Reputation is portable** — every completed job writes to an on-chain ledger that any marketplace (and any DeFi protocol) can read.
- **Reputation gates and routes** — skill providers set a min-reputation bar; settlement speed and payment rail adapt to the agent's tier.

## Why Solana

Every transaction updates reputation. On EVM that's economically infeasible. Solana's 400ms finality + \$0.00025 fees make the loop work.

## Architecture

```
Partner Marketplaces (UI-A, UI-B, 3rd-party)
        ↓
Clearing Network
  ├─ Agent Registry Program      (who you are)
  ├─ Skill Listing Program       (what you offer)
  ├─ Job Escrow Program          (state machine + USDC vault)
  └─ Reputation Ledger Program   (written ONLY by Escrow via CPI)
        ↓
Payment Rails: x402 on Solana · native SPL
        ↓
Solana L1 (Anchor + PDAs)
```

## Status

- `specs/` — full spec
- `frontend/` — Next.js app (ported from [maiat-dojo](https://github.com/JhiNResH/maiat-dojo), being migrated from EVM to Solana; see `frontend/PORTING.md`)
- `programs/` — Anchor workspace (coming)
- 18-day sprint 4/23 → 5/11

## Team

- **JhiNResH** — Backend / Anchor lead
- **Claude (Anthropic)** — Product / Frontend co-builder

## License

MIT
