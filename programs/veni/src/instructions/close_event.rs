use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    errors::VeniError,
    state::Event,
    vault::{close_vault, transfer_from_vault},
};

/// The last step: pays the organizer for tickets, sweeps the rest to the
/// treasury, and closes the vault and event, returning both rents.
#[derive(Accounts)]
pub struct CloseEvent<'info> {
    /// Usually the crank. If nobody signed up, only the organizer can close
    /// before sign-ups end.
    pub closer: Signer<'info>,
    #[account(mut, has_one = organizer, close = organizer)]
    pub event: Account<'info, Event>,
    /// CHECK: the event's organizer, who gets both rents back.
    #[account(mut)]
    pub organizer: UncheckedAccount<'info>,
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
    /// Where ticket money goes. Only needed when tickets are owed.
    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = organizer,
        associated_token::token_program = token_program,
    )]
    pub organizer_token_account: Option<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_close_event(ctx: Context<CloseEvent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;

    // Pending applications' stakes would otherwise be swept below.
    require!(event.applicant_count == 0, VeniError::ApplicantsStillOpen);

    if event.guest_count == 0 {
        // Nobody signed up: the organizer can close any time, others once sign-ups close.
        let is_organizer = ctx.accounts.closer.key() == event.organizer;
        let has_rsvp_closed = now >= event.terms.rsvp_ends_at;
        require!(is_organizer || has_rsvp_closed, VeniError::RsvpStillOpen);
    } else {
        // `close_guest` only runs after settling or cancelling, so everyone is paid or refunded.
        let has_every_guest_closed = event.closed_guest_count == event.guest_count;
        require!(has_every_guest_closed, VeniError::GuestsStillOpen);
    }

    // Tickets go to the organizer after the hold. Refunded events owe nothing.
    let ticket_revenue = event.ticket_revenue();
    let accounts = &ctx.accounts;
    if ticket_revenue > 0 {
        require!(now >= event.ticket_hold_ends_at(), VeniError::TicketsOnHold);
        let organizer_token_account =
            accounts.organizer_token_account.as_ref().ok_or(VeniError::HostTokenAccountMissing)?;
        transfer_from_vault(
            &accounts.event,
            &accounts.vault,
            &accounts.stake_mint,
            &accounts.token_program,
            organizer_token_account,
            ticket_revenue,
        )?;
    }

    // Anyone can send tokens to the vault, and it can't close until empty.
    let leftover_amount = ctx.accounts.vault.amount - ticket_revenue;
    if leftover_amount > 0 {
        transfer_from_vault(
            &accounts.event,
            &accounts.vault,
            &accounts.stake_mint,
            &accounts.token_program,
            &accounts.treasury_token_account,
            leftover_amount,
        )?;
    }
    close_vault(&accounts.event, &accounts.vault, &accounts.token_program, &accounts.organizer)?;
    // Anchor's `close = organizer` closes the event.
    Ok(())
}
