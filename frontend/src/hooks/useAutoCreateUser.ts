"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Hook that automatically syncs the Privy user to the database on login.
 * Call this hook once in a high-level component (e.g., layout or root page).
 */
export function useAutoCreateUser() {
  const { ready, authenticated, user } = usePrivy();
  const hasSynced = useRef(false);

  useEffect(() => {
    // Only sync once per session when user becomes authenticated
    if (!ready || !authenticated || !user || hasSynced.current) {
      return;
    }

    const syncUser = async () => {
      try {
        const privyId = user.id;
        const email = user.email?.address ?? undefined;
        const walletAddress = user.wallet?.address ?? undefined;
        const displayName =
          user.google?.name ??
          user.email?.address?.split("@")[0] ??
          undefined;

        const response = await fetch("/api/users/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyId,
            email,
            walletAddress,
            displayName,
          }),
        });

        if (response.ok) {
          hasSynced.current = true;
        } else {
          console.error("[useAutoCreateUser] Sync failed:", await response.text());
        }
      } catch (err) {
        console.error("[useAutoCreateUser] Sync error:", err);
      }
    };

    syncUser();
  }, [ready, authenticated, user]);
}
