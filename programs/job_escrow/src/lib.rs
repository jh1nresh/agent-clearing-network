use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use reputation_ledger::cpi::accounts::RecordCompletion;
use reputation_ledger::program::ReputationLedger;
use reputation_ledger::{self, Reputation};

declare_id!("3vVNQgBxwUUkHNYM7En3zXehrpH9ZWWdJraRWpcovGRX");

pub const MAX_RESULT_URI_LEN: usize = 300;
pub const SKILL_ID_LEN: usize = 32;
pub const NONCE_LEN: usize = 8;

#[program]
pub mod job_escrow {
    use super::*;

    /// Client opens a job and funds the vault atomically (Funded state).
    pub fn open_job(
        ctx: Context<OpenJob>,
        nonce: [u8; NONCE_LEN],
        skill_id: [u8; SKILL_ID_LEN],
        amount: u64,
        ttl_secs: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        require!(ttl_secs > 0, ErrorCode::InvalidTtl);
        // Block reputation farming (client hires self) and evaluator self-approval.
        require_keys_neq!(
            ctx.accounts.client.key(),
            ctx.accounts.provider.key(),
            ErrorCode::SelfHire
        );
        require_keys_neq!(
            ctx.accounts.provider.key(),
            ctx.accounts.evaluator.key(),
            ErrorCode::ProviderIsEvaluator
        );

        let job = &mut ctx.accounts.job;
        let clock = Clock::get()?;

        job.nonce = nonce;
        job.client = ctx.accounts.client.key();
        job.provider = ctx.accounts.provider.key();
        job.evaluator = ctx.accounts.evaluator.key();
        job.skill_id = skill_id;
        job.amount = amount;
        job.mint = ctx.accounts.mint.key();
        job.state = JobState::Funded as u8;
        job.opened_at = clock.unix_timestamp;
        job.expires_at = clock
            .unix_timestamp
            .checked_add(ttl_secs)
            .ok_or(ErrorCode::ClockOverflow)?;
        job.result_uri = String::new();
        job.bump = ctx.bumps.job;

        // Transfer USDC from client to vault (ATA owned by job PDA).
        let cpi_accounts = Transfer {
            from: ctx.accounts.client_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.client.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        emit!(JobOpened {
            job: job.key(),
            client: job.client,
            provider: job.provider,
            amount,
        });
        Ok(())
    }

    /// Provider submits result URI. Funded → Submitted.
    pub fn submit_result(ctx: Context<SubmitResult>, result_uri: String) -> Result<()> {
        require!(
            result_uri.len() <= MAX_RESULT_URI_LEN,
            ErrorCode::ResultUriTooLong
        );
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Funded as u8, ErrorCode::InvalidState);
        // Reject late submissions — otherwise provider could grab a post-TTL job
        // and block the client's expire_job refund path.
        let now = Clock::get()?.unix_timestamp;
        require!(now < job.expires_at, ErrorCode::Expired);

        job.result_uri = result_uri;
        job.state = JobState::Submitted as u8;

        emit!(JobSubmitted { job: job.key() });
        Ok(())
    }

    /// Evaluator accepts. Submitted → Completed. Pays provider.
    pub fn accept_result(ctx: Context<ResolveJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(
            job.state == JobState::Submitted as u8,
            ErrorCode::InvalidState
        );

        let amount = job.amount;
        let bump = job.bump;
        let client = job.client;
        let nonce = job.nonce;
        let opened_at = job.opened_at;

        let seeds: &[&[u8]] = &[
            b"job",
            client.as_ref(),
            nonce.as_ref(),
            std::slice::from_ref(&bump),
        ];
        let signer: &[&[&[u8]]] = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.provider_token_account.to_account_info(),
            authority: ctx.accounts.job.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        record_reputation(
            &ctx.accounts.reputation_program,
            &ctx.accounts.provider_reputation,
            &ctx.accounts.provider,
            &ctx.accounts.job,
            client,
            nonce,
            bump,
            true,
            amount,
            opened_at,
        )?;

        let job = &mut ctx.accounts.job;
        job.state = JobState::Completed as u8;

        emit!(JobCompleted {
            job: job.key(),
            provider: job.provider,
            amount,
        });
        Ok(())
    }

    /// Evaluator rejects. Submitted → Rejected. Refunds client.
    pub fn reject_result(ctx: Context<ResolveJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(
            job.state == JobState::Submitted as u8,
            ErrorCode::InvalidState
        );

        let amount = job.amount;
        let bump = job.bump;
        let client = job.client;
        let nonce = job.nonce;
        let opened_at = job.opened_at;

        refund_client(
            &ctx.accounts.vault,
            &ctx.accounts.client_token_account,
            &ctx.accounts.job,
            &ctx.accounts.token_program,
        )?;

        record_reputation(
            &ctx.accounts.reputation_program,
            &ctx.accounts.provider_reputation,
            &ctx.accounts.provider,
            &ctx.accounts.job,
            client,
            nonce,
            bump,
            false,
            amount,
            opened_at,
        )?;

        let job = &mut ctx.accounts.job;
        job.state = JobState::Rejected as u8;

        emit!(JobRejected {
            job: job.key(),
            client: job.client,
        });
        Ok(())
    }

    /// Anyone can expire a Funded job past its deadline. Refunds client.
    pub fn expire_job(ctx: Context<ExpireJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Funded as u8, ErrorCode::InvalidState);
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= job.expires_at,
            ErrorCode::NotYetExpired
        );

        refund_client(
            &ctx.accounts.vault,
            &ctx.accounts.client_token_account,
            &ctx.accounts.job,
            &ctx.accounts.token_program,
        )?;

        let job = &mut ctx.accounts.job;
        job.state = JobState::Expired as u8;

        emit!(JobExpired { job: job.key() });
        Ok(())
    }
}

// ────────── Helpers ──────────

fn refund_client<'info>(
    vault: &Account<'info, TokenAccount>,
    client_token_account: &Account<'info, TokenAccount>,
    job: &Account<'info, Job>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    let amount = job.amount;
    let client = job.client;
    let nonce = job.nonce;
    let bump = job.bump;

    let seeds: &[&[u8]] = &[
        b"job",
        client.as_ref(),
        nonce.as_ref(),
        std::slice::from_ref(&bump),
    ];
    let signer: &[&[&[u8]]] = &[seeds];

    let cpi_accounts = Transfer {
        from: vault.to_account_info(),
        to: client_token_account.to_account_info(),
        authority: job.to_account_info(),
    };
    let cpi_ctx =
        CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn record_reputation<'info>(
    reputation_program: &Program<'info, ReputationLedger>,
    provider_reputation: &Account<'info, Reputation>,
    provider: &AccountInfo<'info>,
    job: &Account<'info, Job>,
    client: Pubkey,
    nonce: [u8; NONCE_LEN],
    bump: u8,
    success: bool,
    volume: u64,
    opened_at: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    let latency_secs = clock.unix_timestamp.saturating_sub(opened_at).max(0) as u64;
    let latency_ms = latency_secs.saturating_mul(1000).min(u32::MAX as u64) as u32;

    let seeds: &[&[u8]] = &[
        b"job",
        client.as_ref(),
        nonce.as_ref(),
        std::slice::from_ref(&bump),
    ];
    let signer: &[&[&[u8]]] = &[seeds];

    let cpi_accounts = RecordCompletion {
        reputation: provider_reputation.to_account_info(),
        agent: provider.to_account_info(),
        job_authority: job.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        reputation_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    reputation_ledger::cpi::record_completion(cpi_ctx, client, nonce, success, volume, latency_ms)?;
    Ok(())
}

// ────────── Accounts ──────────

#[derive(Accounts)]
#[instruction(nonce: [u8; NONCE_LEN])]
pub struct OpenJob<'info> {
    #[account(
        init,
        payer = client,
        space = 8 + Job::INIT_SPACE,
        seeds = [b"job", client.key().as_ref(), nonce.as_ref()],
        bump
    )]
    pub job: Account<'info, Job>,

    #[account(
        init,
        payer = client,
        associated_token::mint = mint,
        associated_token::authority = job,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
    )]
    pub client_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: key reference only — bound to Job at write time; enforced on resolve
    /// via has_one = provider on the job account.
    pub provider: AccountInfo<'info>,
    /// CHECK: key reference only — bound to Job at write time; enforced on resolve
    /// via has_one = evaluator.
    pub evaluator: AccountInfo<'info>,

    /// F4 fix: require provider's reputation PDA at open time so a hire can't land
    /// in Submitted and get stuck because record_completion CPI fails at close.
    /// seeds::program pins derivation to the reputation_ledger program id.
    #[account(
        seeds = [b"reputation", provider.key().as_ref()],
        bump = provider_reputation.bump,
        seeds::program = reputation_program.key(),
    )]
    pub provider_reputation: Account<'info, Reputation>,
    pub reputation_program: Program<'info, ReputationLedger>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SubmitResult<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), job.nonce.as_ref()],
        bump = job.bump,
        has_one = provider,
    )]
    pub job: Account<'info, Job>,
    pub provider: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), job.nonce.as_ref()],
        bump = job.bump,
        has_one = evaluator,
        has_one = provider,
        has_one = mint,
    )]
    pub job: Account<'info, Job>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = job,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = job.provider,
    )]
    pub provider_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = job.client,
    )]
    pub client_token_account: Account<'info, TokenAccount>,

    /// CHECK: Key-only reference — gated by `has_one = provider` on `job`
    /// and by the reputation PDA seeds derived from this key.
    pub provider: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"reputation", provider.key().as_ref()],
        bump = provider_reputation.bump,
        seeds::program = reputation_program.key(),
    )]
    pub provider_reputation: Account<'info, Reputation>,

    pub reputation_program: Program<'info, ReputationLedger>,
    pub mint: Account<'info, Mint>,
    pub evaluator: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExpireJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), job.nonce.as_ref()],
        bump = job.bump,
        has_one = mint,
    )]
    pub job: Account<'info, Job>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = job,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = job.client,
    )]
    pub client_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

// ────────── State ──────────

#[repr(u8)]
pub enum JobState {
    Funded = 0,
    Submitted = 1,
    Completed = 2,
    Rejected = 3,
    Expired = 4,
}

#[account]
#[derive(InitSpace)]
pub struct Job {
    pub nonce: [u8; NONCE_LEN],
    pub client: Pubkey,
    pub provider: Pubkey,
    pub evaluator: Pubkey,
    pub mint: Pubkey,
    pub skill_id: [u8; SKILL_ID_LEN],
    pub amount: u64,
    pub state: u8,
    pub opened_at: i64,
    pub expires_at: i64,
    #[max_len(300)]
    pub result_uri: String,
    pub bump: u8,
}

// ────────── Events ──────────

#[event]
pub struct JobOpened {
    pub job: Pubkey,
    pub client: Pubkey,
    pub provider: Pubkey,
    pub amount: u64,
}

#[event]
pub struct JobSubmitted {
    pub job: Pubkey,
}

#[event]
pub struct JobCompleted {
    pub job: Pubkey,
    pub provider: Pubkey,
    pub amount: u64,
}

#[event]
pub struct JobRejected {
    pub job: Pubkey,
    pub client: Pubkey,
}

#[event]
pub struct JobExpired {
    pub job: Pubkey,
}

// ────────── Errors ──────────

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("TTL must be > 0")]
    InvalidTtl,
    #[msg("Invalid job state for this instruction")]
    InvalidState,
    #[msg("Result URI exceeds maximum length")]
    ResultUriTooLong,
    #[msg("Job has not yet reached its expiration")]
    NotYetExpired,
    #[msg("Clock arithmetic overflow")]
    ClockOverflow,
    #[msg("Client cannot hire themselves as provider")]
    SelfHire,
    #[msg("Provider cannot act as evaluator")]
    ProviderIsEvaluator,
    #[msg("Job has already expired — submit blocked")]
    Expired,
}
