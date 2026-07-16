'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useSignTypedData, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, keccak256, toBytes } from 'viem';
import { USDC_ABI } from '@/lib/contracts';
import {
  X402_CHAINS,
  X402_PAYMENT_TYPES,
  getX402Domain,
  encodePaymentProof,
  type X402PaymentProof,
} from '@/lib/x402';

interface BuyWithX402ButtonProps {
  skillId: string;
  price: number;
  skillName: string;
  creatorAddress: `0x${string}`;
  onSuccess?: (purchaseId: string) => void;
}

type Status = 'idle' | 'signing' | 'verifying' | 'done' | 'error';

export default function BuyWithX402Button({
  skillId,
  price,
  skillName,
  creatorAddress,
  onSuccess,
}: BuyWithX402ButtonProps) {
  const { ready, authenticated, login, user } = usePrivy();
  const { address } = useAccount();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [purchaseId, setPurchaseId] = useState<string | null>(null);

  const chainConfig = X402_CHAINS.xlayer;
  const priceRaw = parseUnits(price.toString(), 6); // USDC has 6 decimals

  // Check USDC balance on X Layer
  const { data: balance } = useReadContract({
    address: chainConfig.usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    // Note: This would need proper chain switching to X Layer
  });

  const hasBalance = balance !== undefined && balance >= priceRaw;

  // Sign typed data for x402 payment
  const { signTypedDataAsync, reset: resetSign } = useSignTypedData();

  const handleBuy = useCallback(async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!address) {
      setStatus('error');
      setErrorMsg('Wallet not connected');
      return;
    }

    try {
      resetSign();
      setErrorMsg('');
      setStatus('signing');

      // Generate nonce
      const nonce = keccak256(
        toBytes(`${skillId}-${Date.now()}-${Math.random()}`)
      );

      // Create x402 payment authorization
      const now = Math.floor(Date.now() / 1000);
      const validAfter = now - 60; // 1 minute ago
      const validBefore = now + 300; // 5 minutes from now

      // Sign x402 payment authorization using EIP-712
      const signature = await signTypedDataAsync({
        domain: getX402Domain(196, chainConfig.usdcAddress), // X Layer mainnet chainId = 196
        types: X402_PAYMENT_TYPES,
        primaryType: 'PaymentAuthorization',
        message: {
          from: address,
          to: creatorAddress,
          asset: chainConfig.usdcAddress,
          amount: priceRaw,
          validAfter: BigInt(validAfter),
          validBefore: BigInt(validBefore),
          nonce: nonce as `0x${string}`,
        },
      });

      setStatus('verifying');

      // Construct x402 payment proof
      const proof: X402PaymentProof = {
        x402Version: 2,
        resource: {
          uri: `/api/skills/${skillId}/buy`,
          method: 'POST',
        },
        accepted: {
          scheme: 'exact',
          network: chainConfig.network,
          asset: chainConfig.usdcAddress,
          amount: priceRaw.toString(),
          payTo: creatorAddress,
        },
        payload: {
          signature,
          authorization: {
            from: address,
            validAfter,
            validBefore,
            nonce,
          },
        },
      };

      // Send to backend for verification and purchase
      const response = await fetch(`/api/skills/${skillId}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: user?.id,
          x402Proof: encodePaymentProof(proof),
          amount: price,
          currency: 'USDC',
          chain: 'xlayer',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      setStatus('done');
      setPurchaseId(data.purchaseId);
      onSuccess?.(data.purchaseId);
    } catch (err) {
      setStatus('error');
      if (err instanceof Error) {
        // User rejected signature
        if (err.message.includes('User rejected') || err.message.includes('denied')) {
          setErrorMsg('Signature cancelled');
        } else {
          setErrorMsg(err.message.slice(0, 100));
        }
      } else {
        setErrorMsg('Transaction failed');
      }
    }
  }, [
    authenticated,
    address,
    login,
    resetSign,
    skillId,
    signTypedDataAsync,
    chainConfig,
    creatorAddress,
    priceRaw,
    price,
    user,
    onSuccess,
  ]);

  // Button text
  const buttonText = () => {
    if (!authenticated) return 'Connect Wallet';
    if (status === 'signing') return 'Sign Payment...';
    if (status === 'verifying') return 'Verifying...';
    if (status === 'done') return '✓ Purchased!';
    if (status === 'error') return 'Try Again';
    return `Pay $${price.toFixed(2)} via x402`;
  };

  const isDisabled =
    status === 'signing' ||
    status === 'verifying' ||
    status === 'done';

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={isDisabled}
        className={`w-full font-mono text-sm uppercase tracking-widest py-3 transition-colors ${
          status === 'done'
            ? 'bg-green-800 text-[#f0ece2] cursor-default'
            : isDisabled
            ? 'bg-[#1a1a1a]/50 text-[#f0ece2] cursor-wait'
            : status === 'error'
            ? 'bg-[#dc2626] text-[#f0ece2] hover:bg-[#1a1a1a]'
            : 'bg-[#1a1a1a] text-[#f0ece2] hover:bg-[#b08d57]'
        }`}
      >
        {buttonText()}
      </button>

      {/* Progress indicator */}
      {(status === 'signing' || status === 'verifying') && (
        <div className="flex justify-center gap-2 mt-2">
          <span
            className={`font-mono text-[10px] ${
              status === 'signing' ? 'text-[#b08d57]' : 'text-[#1a1a1a]/30'
            }`}
          >
            ① Sign
          </span>
          <span className="font-mono text-[10px] text-[#1a1a1a]/30">→</span>
          <span
            className={`font-mono text-[10px] ${
              status === 'verifying' ? 'text-[#b08d57]' : 'text-[#1a1a1a]/30'
            }`}
          >
            ② Verify
          </span>
        </div>
      )}

      {status === 'error' && (
        <p className="font-mono text-[10px] text-red-600 text-center mt-2">
          {errorMsg}
        </p>
      )}

      {status === 'done' && purchaseId && (
        <p className="font-mono text-[10px] text-green-800 text-center mt-2">
          Purchase #{purchaseId.slice(0, 8)}... confirmed
        </p>
      )}

      {/* Chain info */}
      <p className="font-mono text-[10px] text-[#1a1a1a]/40 text-center mt-2">
        Powered by x402 on X Layer
      </p>

      {authenticated && address && balance !== undefined && (
        <p className="font-mono text-[10px] text-[#1a1a1a]/40 text-center mt-1">
          Balance: {formatUnits(balance, 6)} USDC
        </p>
      )}
    </div>
  );
}
