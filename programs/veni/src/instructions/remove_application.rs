use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    errors::VeniError,
    state::{Event, Guest},
    vault::transfer_from_vault,
};

/// The organizer declines an application, or the applicant withdraws it. The
/// stake, any ticket and the rent go back in full, with no fee.
#[derive(Accounts)]
pub struct RemoveApplication<'info> {
    /// The organizer or the applicant.
    pub remover: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [GUEST_SEED, event.key().as_ref(), wallet.key().as_ref()],
        bump = guest.bump,
        close = wallet,
    )]
    pub guest: Account<'info, Guest>,
    /// CHECK: the applicant's wallet. Seeds the guest address and gets the refund.
    #[account(mut)]
    pub wallet: UncheckedAccount<'info>,
    #[account(address = event.stake_mint @ VeniError::WrongStakeMint)]
    pub stake_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = event,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = wallet,
        associated_token::token_program = token_program,
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_remove_application(ctx: Context<RemoveApplication>) -> Result<()> {
    let remover = ctx.accounts.remover.key();
    let event = &ctx.accounts.event;

    require!(
        remover == event.organizer || remover == ctx.accounts.wallet.key(),
        VeniError::NotOrganizerOrApplicant
    );
    require!(!ctx.accounts.guest.is_approved, VeniError::AlreadyApproved);

    let accounts = &ctx.accounts;
    transfer_from_vault(
        &accounts.event,
        &accounts.vault,
        &accounts.stake_mint,
        &accounts.token_program,
        &accounts.wallet_token_account,
        event.amount_per_guest(),
    )?;
    ctx.accounts.event.applicant_count -= 1;
    // Anchor's `close = wallet` returns the rent.
    Ok(())
}
