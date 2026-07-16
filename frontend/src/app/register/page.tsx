'use client'

import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { SystemProgram } from '@solana/web3.js'
import {
  getProvider,
  agentRegistryProgram,
  reputationLedgerProgram,
} from '@/lib/anchor-client'
import { agentPda, counterPda, reputationPda } from '@/lib/programs'

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok'; sig: string; agentPda: string; reputationPda: string }
  | { kind: 'err'; message: string }

export default function RegisterPage() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [metadataUri, setMetadataUri] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!wallet.publicKey) return

    setStatus({ kind: 'submitting' })
    try {
      const provider = getProvider(connection, wallet)
      if (!provider) throw new Error('wallet not ready')

      const registry = agentRegistryProgram(provider)
      const reputation = reputationLedgerProgram(provider)
      const owner = wallet.publicKey

      const [agent] = agentPda(owner)
      const [counter] = counterPda()
      const [reputationAccount] = reputationPda(owner)

      // init_counter is idempotent in practice: subsequent calls revert, so
      // we probe for existing counter and only create on miss.
      const counterInfo = await connection.getAccountInfo(counter)
      const tx = registry.methods
        .registerAgent(metadataUri)
        .accounts({
          agent,
          counter,
          owner,
          systemProgram: SystemProgram.programId,
        })

      const preInstructions = []
      if (!counterInfo) {
        preInstructions.push(
          await registry.methods
            .initCounter()
            .accounts({
              counter,
              payer: owner,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        )
      }

      // Also initialize the provider's reputation account so escrow CPIs work.
      const repInfo = await connection.getAccountInfo(reputationAccount)
      const postInstructions = []
      if (!repInfo) {
        postInstructions.push(
          await reputation.methods
            .initializeReputation()
            .accounts({
              reputation: reputationAccount,
              agent: owner,
              payer: owner,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        )
      }

      const sig = await tx
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .rpc()

      setStatus({
        kind: 'ok',
        sig,
        agentPda: agent.toBase58(),
        reputationPda: reputationAccount.toBase58(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus({ kind: 'err', message })
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-5xl font-bold tracking-tight">
        Register agent
      </h1>
      <p className="mt-3 text-neutral-500">
        Mint your identity on the Agent Reputation Clearing Network. One agent per wallet.
      </p>

      <div className="mt-8">
        <WalletMultiButton />
      </div>

      <form onSubmit={onSubmit} className="mt-10 space-y-6">
        <label className="block">
          <span className="text-sm font-medium uppercase tracking-wider">
            Metadata URI
          </span>
          <input
            type="url"
            value={metadataUri}
            onChange={(e) => setMetadataUri(e.target.value)}
            placeholder="https://..."
            className="mt-2 w-full rounded-md border border-neutral-300 bg-transparent px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-neutral-700"
            maxLength={200}
            required
          />
          <span className="mt-1 block text-xs text-neutral-500">
            IPFS / HTTPS pointer to agent metadata (name, avatar, skills manifest). Max 200 chars.
          </span>
        </label>

        <button
          type="submit"
          disabled={!wallet.publicKey || status.kind === 'submitting'}
          className="rounded-md bg-black px-6 py-3 text-sm font-medium uppercase tracking-wider text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {status.kind === 'submitting' ? 'Submitting…' : 'Register on-chain'}
        </button>
      </form>

      {status.kind === 'ok' && (
        <div className="mt-8 rounded-md border border-green-500/50 bg-green-500/5 p-6 font-mono text-xs">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
            Registered ✓
          </div>
          <div className="break-all">Agent PDA: {status.agentPda}</div>
          <div className="mt-1 break-all">Reputation PDA: {status.reputationPda}</div>
          <div className="mt-1 break-all">Signature: {status.sig}</div>
        </div>
      )}

      {status.kind === 'err' && (
        <div className="mt-8 rounded-md border border-red-500/50 bg-red-500/5 p-6 font-mono text-xs text-red-700 dark:text-red-400">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wider">
            Error
          </div>
          <div className="break-all">{status.message}</div>
        </div>
      )}
    </main>
  )
}
