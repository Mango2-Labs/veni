use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        get_mint_extension_data, spl_token_2022, transfer_checked, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};
use spl_token_group_interface::state::TokenGroupMember;

use crate::{
    constants::*,
    errors::VeniError,
    state::{Rewards, SeekerClaim, StampCount},
};

/// Pays a Seeker owner what their stamps have earned and their Seeker hasn't
/// claimed yet. The wallet signs and pays the fees.
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(seeds = [REWARDS_SEED], bump = rewards.bump)]
    pub rewards: Account<'info, Rewards>,
    #[account(seeds = [STAMP_COUNT_SEED, wallet.key().as_ref()], bump = stamp_count.bump)]
    pub stamp_count: Account<'info, StampCount>,
    /// CHECK: a Token-2022 mint; the handler checks it's in the Seeker group.
    #[account(owner = spl_token_2022::ID @ VeniError::NotASeeker)]
    pub seeker_mint: UncheckedAccount<'info>,
    #[account(
        token::mint = seeker_mint,
        token::authority = wallet,
        constraint = seeker_token_account.amount > 0 @ VeniError::SeekerTokenNotHeld,
    )]
    pub seeker_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = wallet,
        space = 8 + SeekerClaim::INIT_SPACE,
        seeds = [SEEKER_CLAIM_SEED, seeker_mint.key().as_ref()],
        bump,
    )]
    pub seeker_claim: Account<'info, SeekerClaim>,
    #[account(address = rewards.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = rewards,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = wallet,
        associated_token::mint = mint,
        associated_token::authority = wallet,
        associated_token::token_program = token_program,
    )]
    pub wallet_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    let settings = &ctx.accounts.rewards.settings;
    require!(!settings.is_paused, VeniError::RewardsPaused);
    // Only the group's update authority can add a member, so this can't be faked.
    let seeker_mint = ctx.accounts.seeker_mint.to_account_info();
    let member = get_mint_extension_data::<TokenGroupMember>(&seeker_mint).map_err(|_| VeniError::NotASeeker)?;
    require!(
        member.group == settings.seeker_group && member.mint == seeker_mint.key(),
        VeniError::NotASeeker
    );

    let earned = settings.earned_by(ctx.accounts.stamp_count.count);
    let owed = earned.saturating_sub(ctx.accounts.seeker_claim.claimed);
    require!(owed > 0, VeniError::NothingToClaim);

    let accounts = &ctx.accounts;
    let signer_seeds: &[&[&[u8]]] = &[&[REWARDS_SEED, &[accounts.rewards.bump]]];
    let transfer = TransferChecked {
        from: accounts.vault.to_account_info(),
        mint: accounts.mint.to_account_info(),
        to: accounts.wallet_token_account.to_account_info(),
        authority: accounts.rewards.to_account_info(),
    };
    transfer_checked(
        CpiContext::new_with_signer(accounts.token_program.key(), transfer, signer_seeds),
        owed,
        accounts.mint.decimals,
    )?;

    let seeker_claim = &mut ctx.accounts.seeker_claim;
    seeker_claim.claimed = earned;
    seeker_claim.bump = ctx.bumps.seeker_claim;
    Ok(())
}
