use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    constants::*,
    errors::VeniError,
    program::Veni,
    state::{RewardSettings, Rewards},
};

/// Sets up rewards in `mint` and their vault. Only the program's upgrade
/// authority can, once. Anyone can then fund the vault.
#[derive(Accounts)]
pub struct InitRewards<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Rewards::INIT_SPACE,
        seeds = [REWARDS_SEED],
        bump,
    )]
    pub rewards: Account<'info, Rewards>,
    pub mint: InterfaceAccount<'info, Mint>,
    // If needed: anyone can create an associated token account, this one included.
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = rewards,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ VeniError::NotUpgradeAuthority)]
    pub program: Program<'info, Veni>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ VeniError::NotUpgradeAuthority)]
    pub program_data: Account<'info, ProgramData>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_rewards(ctx: Context<InitRewards>, settings: RewardSettings) -> Result<()> {
    require!(settings.has_ordered_milestones(), VeniError::MilestonesOutOfOrder);
    ctx.accounts.rewards.set_inner(Rewards {
        settings,
        mint: ctx.accounts.mint.key(),
        bump: ctx.bumps.rewards,
    });
    Ok(())
}
