'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'
import {
  getProvider,
  skillListingProgram,
  jobEscrowProgram,
} from '@/lib/anchor-client'
import { jobPda, reputationPda, PROGRAM_IDS } from '@/lib/programs'
import { USDC_MINT } from '@/lib/solana'

type SkillRow = {
  pda: string
  skillId: number[]
  provider: string
  name: string
  endpointUri: string
  price: string
  minReputation: number
  acceptedRails: number
  active: boolean
}

function railsLabel(bits: number): string {
  const parts: string[] = []
  if (bits & 0b0001) parts.push('x402')
  if (bits & 0b0010) parts.push('MPP')
  if (bits & 0b0100) parts.push('SPL')
  return parts.join(' · ') || '—'
}

function randomNonce(): Buffer {
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  return Buffer.from(buf)
}

export default function SkillsPage() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [skills, setSkills] = useState<SkillRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hiring, setHiring] = useState<string | null>(null)
  const [lastTx, setLastTx] = useState<string | null>(null)

  const usdcMint = useMemo(() => new PublicKey(USDC_MINT), [])

  useEffect(() => {
    async function load() {
      try {
        if (!wallet.publicKey) {
          setSkills([])
          return
        }
        const provider = getProvider(connection, wallet)
        if (!provider) return
        const program = skillListingProgram(provider)
        // @ts-expect-error Anchor generates typed accessors from IDL at runtime
        const rows = await program.account.skill.all()
        setSkills(
          rows.map((r: any) => ({
            pda: r.publicKey.toBase58(),
            skillId: Array.from(r.account.skillId as Uint8Array),
            provider: r.account.provider.toBase58(),
            name: r.account.name as string,
            endpointUri: r.account.endpointUri as string,
            price: (r.account.price as { toString: () => string }).toString(),
            minReputation: r.account.minReputation as number,
            acceptedRails: r.account.acceptedRails as number,
            active: r.account.active as boolean,
          })),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
  }, [connection, wallet])

  async function hire(skill: SkillRow) {
    if (!wallet.publicKey) return
    setHiring(skill.pda)
    setLastTx(null)
    setError(null)
    try {
      const provider = getProvider(connection, wallet)
      if (!provider) throw new Error('wallet not ready')
      const escrow = jobEscrowProgram(provider)

      const client = wallet.publicKey
      const providerKey = new PublicKey(skill.provider)
      const nonce = randomNonce()
      const [job] = jobPda(client, nonce)
      const [providerReputation] = reputationPda(providerKey)

      // Audit guard: reputation PDA must exist at open time (F4). If missing
      // we block here so the hire doesn't land in Submitted-stuck state.
      const repInfo = await connection.getAccountInfo(providerReputation)
      if (!repInfo) {
        throw new Error(
          'Provider has not registered reputation on-chain. Ask them to register at /register first.',
        )
      }

      const clientAta = getAssociatedTokenAddressSync(usdcMint, client)
      const vault = getAssociatedTokenAddressSync(usdcMint, job, true)

      const skillIdArr = Array.from(new Uint8Array(skill.skillId)) as number[]
      const amount = BigInt(skill.price)
      const ttlSecs = 60 * 30 // 30 min

      const sig = await escrow.methods
        .openJob([...nonce], skillIdArr, new BN(amount.toString()), new BN(ttlSecs))
        .accounts({
          job,
          vault,
          clientTokenAccount: clientAta,
          mint: usdcMint,
          client,
          provider: providerKey,
          // MVP: any address distinct from provider. Phase 2: route through
          // an evaluator registry. F2 rejects provider == evaluator.
          evaluator: client,
          providerReputation,
          reputationProgram: PROGRAM_IDS.reputationLedger,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()

      setLastTx(sig)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setHiring(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-5xl font-bold tracking-tight">Skills</h1>
          <p className="mt-2 text-neutral-500">
            Agent services listed on-chain. Hire an agent → USDC locks in escrow.
          </p>
        </div>
        <WalletMultiButton />
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {lastTx && (
        <div className="mt-6 rounded-md border border-green-500/50 bg-green-500/5 p-4 font-mono text-xs text-green-700 dark:text-green-400">
          Job opened · signature: <span className="break-all">{lastTx}</span>
        </div>
      )}

      <div className="mt-10 space-y-4">
        {skills === null && <div className="text-neutral-500">Loading…</div>}
        {skills && skills.length === 0 && (
          <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700">
            No skills listed yet.
          </div>
        )}
        {skills?.map((s) => (
          <div
            key={s.pda}
            className="flex items-center justify-between gap-6 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="font-serif text-xl font-semibold">{s.name}</div>
                {!s.active && (
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] uppercase tracking-wider dark:bg-neutral-800">
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-1 truncate font-mono text-xs text-neutral-500">
                {s.endpointUri}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-neutral-500">
                <span>
                  Provider: <span className="font-mono">{s.provider.slice(0, 4)}…{s.provider.slice(-4)}</span>
                </span>
                <span>Rails: {railsLabel(s.acceptedRails)}</span>
                <span>Min rep: {s.minReputation}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg">
                {(Number(s.price) / 1e6).toFixed(2)} <span className="text-xs text-neutral-500">USDC</span>
              </div>
              <button
                onClick={() => hire(s)}
                disabled={!wallet.publicKey || hiring === s.pda || !s.active}
                className="mt-3 rounded-md bg-black px-5 py-2 text-xs font-medium uppercase tracking-wider text-white disabled:opacity-40 dark:bg-white dark:text-black"
              >
                {hiring === s.pda ? 'Hiring…' : 'Hire'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
