/**
 * Demo provider agent.
 *
 * Polls the job_escrow program for Funded jobs where provider == this keypair,
 * then submits a canned result URI. Shows that any off-chain agent can act as
 * a provider without owning a frontend.
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   npx ts-node agents/demo-provider.ts
 */
import * as anchor from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'

const JOB_ESCROW_ID = new PublicKey('3vVNQgBxwUUkHNYM7En3zXehrpH9ZWWdJraRWpcovGRX')
const RESULT_URI = 'ipfs://bafy-demo-result-uri'
const POLL_INTERVAL_MS = 5_000

const JobState = { Funded: 0, Submitted: 1, Completed: 2, Rejected: 3, Expired: 4 }

async function main() {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const idl = require('../target/idl/job_escrow.json')
  const program = new anchor.Program(idl, provider)

  const me = provider.wallet.publicKey
  console.log(`Demo provider: ${me.toBase58()}`)
  console.log(`Polling job_escrow ${JOB_ESCROW_ID.toBase58()} every ${POLL_INTERVAL_MS}ms…`)

  const seen = new Set<string>()

  while (true) {
    try {
      // @ts-expect-error Anchor generates typed accessors at runtime
      const jobs = await program.account.job.all([
        { memcmp: { offset: 8 + 8 + 32, bytes: me.toBase58() } }, // filter: provider == me
      ])

      for (const row of jobs as any[]) {
        const pda = row.publicKey.toBase58()
        const state = row.account.state as number
        if (state !== JobState.Funded) continue
        if (seen.has(pda)) continue
        seen.add(pda)

        console.log(`→ Submitting result for job ${pda} (amount=${row.account.amount.toString()})`)
        try {
          const sig = await program.methods
            .submitResult(RESULT_URI)
            .accounts({
              job: row.publicKey,
              provider: me,
            })
            .rpc()
          console.log(`  ✓ submitted: ${sig}`)
        } catch (e) {
          console.error(`  ✗ failed: ${(e as Error).message}`)
          seen.delete(pda)
        }
      }
    } catch (e) {
      console.error(`poll error: ${(e as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
