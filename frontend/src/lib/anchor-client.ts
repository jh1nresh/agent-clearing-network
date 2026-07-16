import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import type { WalletContextState } from '@solana/wallet-adapter-react'

import agentRegistryIdl from './idl/agent_registry.json'
import skillListingIdl from './idl/skill_listing.json'
import jobEscrowIdl from './idl/job_escrow.json'
import reputationLedgerIdl from './idl/reputation_ledger.json'

// Anchor's Wallet interface needs publicKey + signTransaction + signAllTransactions.
// wallet-adapter gives us the same shape once a wallet is connected.
export function getProvider(
  connection: Connection,
  wallet: WalletContextState,
): AnchorProvider | null {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    return null
  }
  return new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    },
    { commitment: 'confirmed' },
  )
}

export function agentRegistryProgram(provider: AnchorProvider): Program {
  return new Program(agentRegistryIdl as Idl, provider)
}

export function skillListingProgram(provider: AnchorProvider): Program {
  return new Program(skillListingIdl as Idl, provider)
}

export function jobEscrowProgram(provider: AnchorProvider): Program {
  return new Program(jobEscrowIdl as Idl, provider)
}

export function reputationLedgerProgram(provider: AnchorProvider): Program {
  return new Program(reputationLedgerIdl as Idl, provider)
}

export { PublicKey }
