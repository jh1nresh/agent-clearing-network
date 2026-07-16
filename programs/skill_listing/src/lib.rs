use anchor_lang::prelude::*;

declare_id!("5sqKpGv5sNVHR2ZXpWzQC3HiJELD4XwZzSP7Wi4qVnd1");

pub const MAX_ENDPOINT_URI_LEN: usize = 300;
pub const MAX_NAME_LEN: usize = 64;
pub const SKILL_ID_LEN: usize = 32;

// Payment rail bitflags. Skill lists which rails it accepts.
pub mod rails {
    pub const X402: u8 = 1 << 0; // 0b0001
    pub const MPP: u8 = 1 << 1;  // 0b0010 — agent-to-agent session pay
    pub const SPL: u8 = 1 << 2;  // 0b0100 — native USDC escrow
}

#[program]
pub mod skill_listing {
    use super::*;

    /// Create a skill listing owned by `provider`.
    pub fn list_skill(
        ctx: Context<ListSkill>,
        skill_id: [u8; SKILL_ID_LEN],
        name: String,
        endpoint_uri: String,
        price: u64,
        min_reputation: u32,
        accepted_rails: u8,
    ) -> Result<()> {
        require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
        require!(
            endpoint_uri.len() <= MAX_ENDPOINT_URI_LEN,
            ErrorCode::EndpointUriTooLong
        );
        require!(accepted_rails > 0, ErrorCode::NoRailsAccepted);

        let skill = &mut ctx.accounts.skill;
        skill.skill_id = skill_id;
        skill.provider = ctx.accounts.provider.key();
        skill.name = name;
        skill.endpoint_uri = endpoint_uri;
        skill.price = price;
        skill.min_reputation = min_reputation;
        skill.accepted_rails = accepted_rails;
        skill.active = true;
        skill.bump = ctx.bumps.skill;

        emit!(SkillListed {
            provider: skill.provider,
            skill_id,
            price,
            min_reputation,
        });
        Ok(())
    }

    /// Update price / min_reputation / endpoint / rails. Provider only.
    pub fn update_skill(
        ctx: Context<UpdateSkill>,
        price: Option<u64>,
        min_reputation: Option<u32>,
        endpoint_uri: Option<String>,
        accepted_rails: Option<u8>,
    ) -> Result<()> {
        let skill = &mut ctx.accounts.skill;
        if let Some(p) = price {
            skill.price = p;
        }
        if let Some(r) = min_reputation {
            skill.min_reputation = r;
        }
        if let Some(uri) = endpoint_uri {
            require!(
                uri.len() <= MAX_ENDPOINT_URI_LEN,
                ErrorCode::EndpointUriTooLong
            );
            skill.endpoint_uri = uri;
        }
        if let Some(rails) = accepted_rails {
            require!(rails > 0, ErrorCode::NoRailsAccepted);
            skill.accepted_rails = rails;
        }
        Ok(())
    }

    /// Soft-delete a skill (stays on-chain for audit; no longer resolvable).
    pub fn deactivate_skill(ctx: Context<UpdateSkill>) -> Result<()> {
        ctx.accounts.skill.active = false;
        Ok(())
    }
}

// ────────── Accounts ──────────

#[derive(Accounts)]
#[instruction(skill_id: [u8; SKILL_ID_LEN])]
pub struct ListSkill<'info> {
    #[account(
        init,
        payer = provider,
        space = 8 + Skill::INIT_SPACE,
        seeds = [b"skill", provider.key().as_ref(), skill_id.as_ref()],
        bump
    )]
    pub skill: Account<'info, Skill>,
    #[account(mut)]
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSkill<'info> {
    #[account(
        mut,
        seeds = [b"skill", provider.key().as_ref(), skill.skill_id.as_ref()],
        bump = skill.bump,
        has_one = provider
    )]
    pub skill: Account<'info, Skill>,
    pub provider: Signer<'info>,
}

// ────────── State ──────────

#[account]
#[derive(InitSpace)]
pub struct Skill {
    pub skill_id: [u8; SKILL_ID_LEN],
    pub provider: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(300)]
    pub endpoint_uri: String,
    pub price: u64,           // USDC base units (micro-USDC, 6 decimals)
    pub min_reputation: u32,
    pub accepted_rails: u8,
    pub active: bool,
    pub bump: u8,
}

// ────────── Events ──────────

#[event]
pub struct SkillListed {
    pub provider: Pubkey,
    pub skill_id: [u8; SKILL_ID_LEN],
    pub price: u64,
    pub min_reputation: u32,
}

// ────────── Errors ──────────

#[error_code]
pub enum ErrorCode {
    #[msg("Name exceeds maximum length")]
    NameTooLong,
    #[msg("Endpoint URI exceeds maximum length")]
    EndpointUriTooLong,
    #[msg("Must accept at least one payment rail")]
    NoRailsAccepted,
}
