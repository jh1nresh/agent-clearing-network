"use client";

import { useAutoCreateUser } from "@/hooks/useAutoCreateUser";
import { useKYAMint } from "@/hooks/useKYAMint";

/**
 * ClientInit — mounted once in root layout inside PrivyProvider.
 * Fires side-effects that require Privy context:
 *   1. useAutoCreateUser — syncs Privy identity to DB on login
 *   2. useKYAMint       — mints ERC-8004 agent identity (KYA-0) after sync
 *
 * Renders nothing — pure side-effect component.
 */
export function ClientInit() {
  useAutoCreateUser();
  useKYAMint();
  return null;
}
