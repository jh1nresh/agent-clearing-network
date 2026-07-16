use anchor_lang::prelude::*;

declare_id!("AiaStzpRxqRBPBe3ukdyLP3skz8wC2L1HH6MnPuYRTnk");

// Max metadata URI length (IPFS CID / HTTPS URL)
pub const MAX_METADATA_URI_LEN: usize = 200;

#[program]
pub mod agent_registry {
    use super::*;

    /// Initialize the global agent counter. Call once per deployment.
    pub fn init_counter(ctx: Context<InitCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.next_id = 1;
        counter.bump = ctx.bumps.counter;
        Ok(())
    }

    /// Register a new agent owned by the signer. Fails if already registered.
    pub fn register_agent(ctx: Context<RegisterAgent>, metadata_uri: String) -> Result<()> {
        require!(
            metadata_uri.len() <= MAX_METADATA_URI_LEN,
            ErrorCode::MetadataUriTooLong
        );

        let counter = &mut ctx.accounts.counter;
        let agent = &mut ctx.accounts.agent;
        let clock = Clock::get()?;

        agent.agent_id = counter.next_id;
        agent.owner = ctx.accounts.owner.key();
        agent.metadata_uri = metadata_uri;
        agent.created_at = clock.unix_timestamp;
        agent.bump = ctx.bumps.agent;

        counter.next_id = counter
            .next_id
            .checked_add(1)
            .ok_or(ErrorCode::CounterOverflow)?;

        emit!(AgentRegistered {
            agent_id: agent.agent_id,
            owner: agent.owner,
            metadata_uri: agent.metadata_uri.clone(),
        });

        Ok(())
    }

    /// Update metadata URI. Only owner.
    pub fn update_metadata(ctx: Context<UpdateMetadata>, new_uri: String) -> Result<()> {
        require!(
            new_uri.len() <= MAX_METADATA_URI_LEN,
            ErrorCode::MetadataUriTooLong
        );
        ctx.accounts.agent.metadata_uri = new_uri;
        Ok(())
    }
}

// ────────── Accounts ──────────

#[derive(Accounts)]
pub struct InitCounter<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter"],
        bump
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", owner.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"counter"],
        bump = counter.bump
    )]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref()],
        bump = agent.bump,
        has_one = owner
    )]
    pub agent: Account<'info, Agent>,
    pub owner: Signer<'info>,
}

// ────────── State ──────────

#[account]
#[derive(InitSpace)]
pub struct Agent {
    pub agent_id: u64,
    pub owner: Pubkey,
    #[max_len(200)]
    pub metadata_uri: String,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub next_id: u64,
    pub bump: u8,
}

// ────────── Events ──────────

#[event]
pub struct AgentRegistered {
    pub agent_id: u64,
    pub owner: Pubkey,
    pub metadata_uri: String,
}

// ────────── Errors ──────────

#[error_code]
pub enum ErrorCode {
    #[msg("Metadata URI exceeds maximum length")]
    MetadataUriTooLong,
    #[msg("Agent counter overflow")]
    CounterOverflow,
}
