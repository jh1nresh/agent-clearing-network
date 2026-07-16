"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

export type KYAMintStatus = "idle" | "existing" | "pending" | "minted" | "error";

export interface KYAMintResult {
  status: KYAMintStatus;
  tokenId?: string;
  txHash?: string | null;
  kyaLevel?: number;
  retryAt?: string;
}

/**
 * Hook that mints an ERC-8004 agent identity for the user on first login.
 * Call once in a high-level component after useAutoCreateUser runs.
 *
 * Fires only when: ready + authenticated + user has wallet + not yet run this session.
 */
export function useKYAMint(onResult?: (result: KYAMintResult) => void) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const hasMinted = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !user || hasMinted.current) return;
    if (!user.wallet?.address) return; // need wallet before minting

    const doMint = async () => {
      hasMinted.current = true; // prevent concurrent calls

      try {
        const token = await getAccessToken();
        if (!token) {
          console.warn("[useKYAMint] No access token — skipping");
          return;
        }

        const res = await fetch("/api/users/mint-identity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ privyId: user.id }),
        });

        const data: KYAMintResult = await res.json();
        console.log("[useKYAMint] result:", data);
        onResult?.(data);
      } catch (err) {
        console.error("[useKYAMint] error:", err);
        hasMinted.current = false; // allow retry on next render if transient error
      }
    };

    doMint();
  }, [ready, authenticated, user, getAccessToken, onResult]);
}
