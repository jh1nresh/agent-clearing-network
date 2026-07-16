import { clusterApiUrl } from '@solana/web3.js'

export type SolanaCluster = 'devnet' | 'mainnet-beta' | 'localnet'

export const SOLANA_CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster) || 'devnet'

export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  (SOLANA_CLUSTER === 'localnet' ? 'http://127.0.0.1:8899' : clusterApiUrl(SOLANA_CLUSTER))

export const USDC_MINT =
  process.env.NEXT_PUBLIC_USDC_MINT ||
  // Devnet USDC (Circle's devnet mint)
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
