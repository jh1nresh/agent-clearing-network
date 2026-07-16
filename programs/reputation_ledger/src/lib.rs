use anchor_lang::prelude::*;

declare_id!("BmhJPfUSCnrX2ctUcGCHJ6xLL8RwkWXU9VdxMAHHAH46");

// Only the job_escrow program's job PDA is allowed to call `record_completion`.
// The PDA is re-derived on our side with seeds::program = JOB_ESCROW_PROGRAM_ID,
// which guarantees the CPI comes from the escrow program and no one else.
pub const JOB_ESCROW_PROGRAM_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("3vVNQgBxwUUkHNYM7En3zXehrpH9ZWWdJraRWpcovGRX");

pub const NONCE_LEN: usize = 8;

#[program]
pub mod reputation_ledger {
    use super::*;

    /// Initialize reputation for an agent. Anyone can fund this once.
    pub fn initialize_reputation(ctx: Context<InitializeReputation>) -> Result<()> {
        let rep = &mut ctx.accounts.reputation;
        rep.agent = ctx.accounts.agent.key();
        rep.completed_jobs = 0;
        rep.rejected_jobs = 0;
        rep.total_volume = 0;
        rep.avg_latency_ms = 0;
        rep.score = 0;
        rep.last_update = Clock::get()?.unix_timestamp;
        rep.bump = ctx.bumps.reputation;

        emit!(ReputationInitialized {
            agent: rep.agent,
        });
        Ok(())
    }

    /// Record a job outcome. Gated: only the job_escrow program's job PDA may call.
    /// CPI path: job_escrow::accept_result / reject_result signs with the job PDA.
    pub fn record_completion(
        ctx: Context<RecordCompletion>,
        _client: Pubkey,
        _nonce: [u8; NONCE_LEN],
        success: bool,
        volume: u64,
        latency_ms: u32,
    ) -> Result<()> {
        let rep = &mut ctx.accounts.reputation;

        if success {
            rep.completed_jobs = rep.completed_jobs.saturating_add(1);
            rep.total_volume = rep.total_volume.saturating_add(volume as u128);

            // Exponential moving average of latency (alpha = 1/8).
            if rep.avg_latency_ms == 0 {
                rep.avg_latency_ms = latency_ms;
            } else {
                let prev = rep.avg_latency_ms as u64;
                let next = (prev * 7 + latency_ms as u64) / 8;
                rep.avg_latency_ms = next as u32;
            }
        } else {
            rep.rejected_jobs = rep.rejected_jobs.saturating_add(1);
        }

        // Score = completed * 100 - rejected * 50, floored at 0.
        let positive = rep.completed_jobs.saturating_mul(100);
        let negative = rep.rejected_jobs.saturating_mul(50);
        rep.score = positive.saturating_sub(negative);
        rep.last_update = Clock::get()?.unix_timestamp;

        emit!(ReputationUpdated {
            agent: rep.agent,
            success,
            volume,
            score: rep.score,
        });
        Ok(())
    }
}

// ────────── Accounts ──────────

#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Reputation::INIT_SPACE,
        seeds = [b"reputation", agent.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, Reputation>,
    /// CHECK: The agent this reputation tracks. Key-only reference.
    pub agent: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(client: Pubkey, nonce: [u8; NONCE_LEN])]
pub struct RecordCompletion<'info> {
    #[account(
        mut,
        seeds = [b"reputation", agent.key().as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, Reputation>,

    /// CHECK: Agent whose reputation is being updated. Key-only reference.
    pub agent: AccountInfo<'info>,

    /// Gating: this signer MUST be the job PDA from the job_escrow program.
    /// seeds::program pins derivation to JOB_ESCROW_PROGRAM_ID, so no other
    /// program and no user-controlled key can satisfy this constraint.
    #[account(
        seeds = [b"job", client.as_ref(), nonce.as_ref()],
        bump,
        seeds::program = JOB_ESCROW_PROGRAM_ID,
    )]
    pub job_authority: Signer<'info>,
}

// ────────── State ──────────

#[account]
#[derive(InitSpace)]
pub struct Reputation {
    pub agent: Pubkey,
    pub completed_jobs: u64,
    pub rejected_jobs: u64,
    pub total_volume: u128,
    pub avg_latency_ms: u32,
    pub score: u64,
    pub last_update: i64,
    pub bump: u8,
}

// ────────── Events ──────────

#[event]
pub struct ReputationInitialized {
    pub agent: Pubkey,
}

#[event]
pub struct ReputationUpdated {
    pub agent: Pubkey,
    pub success: bool,
    pub volume: u64,
    pub score: u64,
}
