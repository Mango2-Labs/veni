use anchor_lang::prelude::*;

use crate::{
    constants::*,
    errors::VeniError,
    state::{RewardSettings, Rewards},
};

/// Changes the amounts, the Seeker group, the admin, or pauses claims. It
/// can't move the vault's tokens.
#[derive(Accounts)]
pub struct UpdateRewards<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [REWARDS_SEED],
        bump = rewards.bump,
        constraint = rewards.settings.admin == admin.key() @ VeniError::NotRewardsAdmin,
    )]
    pub rewards: Account<'info, Rewards>,
}

pub fn handle_update_rewards(ctx: Context<UpdateRewards>, settings: RewardSettings) -> Result<()> {
    require!(settings.has_ordered_milestones(), VeniError::MilestonesOutOfOrder);
    ctx.accounts.rewards.settings = settings;
    Ok(())
}
