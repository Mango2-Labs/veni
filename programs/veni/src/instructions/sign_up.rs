use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    errors::VeniError,
    state::{Event, Guest},
};

#[derive(Accounts)]
pub struct SignUp<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(
        init,
        payer = wallet,
        space = 8 + Guest::INIT_SPACE,
        seeds = [GUEST_SEED, event.key().as_ref(), wallet.key().as_ref()],
        bump,
    )]
    pub guest: Account<'info, Guest>,
    // Otherwise anyone could "stake" a worthless token of their own.
    #[account(address = event.stake_mint @ VeniError::WrongStakeMint)]
    pub stake_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = wallet,
        associated_token::token_program = token_program,
    )]
    pub wallet_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = event,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_sign_up(ctx: Context<SignUp>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;

    // The organizer runs the event and doesn't stake for a spot.
    require!(ctx.accounts.wallet.key() != event.organizer, VeniError::OrganizerCannotRsvp);
    require!(!event.is_cancelled, VeniError::EventCancelled);
    require!(now < event.terms.rsvp_ends_at, VeniError::RsvpClosed);
    // Applications take no spot, but a full event takes no applications.
    require!(event.guest_count < event.terms.capacity, VeniError::EventFull);

    let stake = TransferChecked {
        from: ctx.accounts.wallet_token_account.to_account_info(),
        mint: ctx.accounts.stake_mint.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.wallet.to_account_info(),
    };
    // The stake plus any ticket, held in the vault.
    transfer_checked(
        CpiContext::new(ctx.accounts.token_program.key(), stake),
        event.amount_per_guest(),
        ctx.accounts.stake_mint.decimals,
    )?;

    // With approval required, this is an application until the organizer decides.
    let is_approved = !event.terms.requires_approval;
    if is_approved {
        ctx.accounts.event.guest_count += 1;
    } else {
        ctx.accounts.event.applicant_count += 1;
    }
    ctx.accounts.guest.set_inner(Guest {
        event: ctx.accounts.event.key(),
        wallet: ctx.accounts.wallet.key(),
        has_attended: false,
        is_approved,
        bump: ctx.bumps.guest,
    });
    Ok(())
}
