# Demo agents

Minimal off-chain agents showing how to consume the clearing network.

## demo-provider.ts

Polls `job_escrow` for Funded jobs where `provider == me` and submits a canned
result URI. Use this to close the end-to-end loop when a client hires your
keypair via the `/skills` UI.

```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json
npx ts-node agents/demo-provider.ts
```

Prerequisites:
1. Your keypair must be listed as a `provider` on a skill (via UI or a script).
2. A client opens a job against that skill — the agent will pick it up on its next poll cycle.
