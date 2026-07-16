/**
 * Privy Server-Side Authentication
 *
 * Uses @privy-io/node to verify JWT tokens from the Authorization header.
 * This replaces insecure query param-based auth.
 */

import { PrivyClient } from '@privy-io/node';

// Lazy-initialize the Privy client to avoid errors at module load time
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('Privy credentials not configured');
    }

    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

export interface VerifyAuthResult {
  success: boolean;
  privyId?: string;
  error?: string;
}

/**
 * Extract and verify Privy JWT from Authorization header
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns Verification result with privyId if successful
 */
export async function verifyPrivyAuth(
  authHeader: string | null
): Promise<VerifyAuthResult> {
  if (!authHeader) {
    return { success: false, error: 'Missing Authorization header' };
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { success: false, error: 'Invalid Authorization header format' };
  }

  const token = parts[1];
  if (!token) {
    return { success: false, error: 'Missing token in Authorization header' };
  }

  try {
    const privyClient = getPrivyClient();
    const verifiedClaims = await privyClient.utils().auth().verifyAuthToken(token);
    return {
      success: true,
      privyId: verifiedClaims.user_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    return { success: false, error: message };
  }
}
