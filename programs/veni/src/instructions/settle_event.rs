use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, errors::VeniError, state::Event, vault::transfer_from_vault};

/// Anyone can send this after check-in. Takes Veni's fee from forfeited stakes;
/// attendees collect the rest in `close_guest`. If nobody checked in, nothing
/// is forfeited and everyone is refunded.
#[derive(Accounts)]
pub struct SettleEvent<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
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
        associated_token::authority = TREASURY,
        associated_token::token_program = token_program,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_settle_event(ctx: Context<SettleEvent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;
    let has_check_in_closed = now >= event.terms.check_in_ends_at;
    let has_rsvp_closed = now >= event.terms.rsvp_ends_at;
    let has_everyone_attended = event.attended_count == event.guest_count;
    // Once sign-ups close and everyone is in, nothing can change.
    let can_settle_early = has_rsvp_closed && has_everyone_attended;

    require!(!event.is_settled, VeniError::AlreadySettled);
    require!(!event.is_cancelled, VeniError::EventCancelled);
    require!(event.guest_count > 0, VeniError::NobodyRsvped);
    require!(has_check_in_closed || can_settle_early, VeniError::CheckInStillOpen);

    let has_somebody_attended = event.attended_count > 0;
    if has_somebody_attended {
        let no_show_count = event.guest_count - event.attended_count;
        let forfeited_amount = u64::from(no_show_count) * event.terms.stake_amount;
        let fee = basis_points_of(forfeited_amount, FEE_BPS);
        send_from_vault(ctx.accounts, &ctx.accounts.treasury_token_account, fee)?;
    }

    ctx.accounts.event.is_settled = true;
    Ok(())
}

fn send_from_vault<'info>(
    accounts: &SettleEvent<'info>,
    destination: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    transfer_from_vault(&accounts.event, &accounts.vault, &accounts.stake_mint, &accounts.token_program, destination, amount)
}
