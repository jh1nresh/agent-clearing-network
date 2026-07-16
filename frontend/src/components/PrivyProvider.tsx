'use client'

import { type ReactNode } from 'react'
import { PrivyProvider as Privy } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/lib/wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'

const queryClient = new QueryClient()

export function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()

  if (!appId) {
    console.warn('Privy App ID missing — auth disabled.')
    return <>{children}</>
  }

  return (
    <Privy
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#1a1a1a',
        },
        loginMethods: ['email', 'google', 'apple', 'wallet'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: bscTestnet,
        supportedChains: [bsc, bscTestnet],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </Privy>
  )
}
