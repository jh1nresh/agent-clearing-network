import { PublicKey } from '@solana/web3.js'

// Program IDs — synced from Anchor.toml. Keep in lockstep with anchor build output.
export const PROGRAM_IDS = {
  agentRegistry: new PublicKey('AiaStzpRxqRBPBe3ukdyLP3skz8wC2L1HH6MnPuYRTnk'),
  skillListing: new PublicKey('5sqKpGv5sNVHR2ZXpWzQC3HiJELD4XwZzSP7Wi4qVnd1'),
  jobEscrow: new PublicKey('3vVNQgBxwUUkHNYM7En3zXehrpH9ZWWdJraRWpcovGRX'),
  reputationLedger: new PublicKey('BmhJPfUSCnrX2ctUcGCHJ6xLL8RwkWXU9VdxMAHHAH46'),
} as const

// PDA derivations
export function agentPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), owner.toBuffer()],
    PROGRAM_IDS.agentRegistry
  )
}

export function counterPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('counter')],
    PROGRAM_IDS.agentRegistry
  )
}

export function skillPda(providerAgent: PublicKey, skillId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('skill'), providerAgent.toBuffer(), skillId],
    PROGRAM_IDS.skillListing
  )
}

export function reputationPda(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), agent.toBuffer()],
    PROGRAM_IDS.reputationLedger
  )
}

export function jobPda(client: PublicKey, nonce: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('job'), client.toBuffer(), nonce],
    PROGRAM_IDS.jobEscrow
  )
}
