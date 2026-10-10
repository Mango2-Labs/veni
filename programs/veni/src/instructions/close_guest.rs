use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::*,
    errors::VeniError,
    stamps::add_stamp,
    state::{Event, Guest, Stamped},
    vault::transfer_from_vault,
};

/// Pays or refunds one guest and returns their rent. Anyone can send it,
/// usually the crank. Attendees get their share and a stamp; everyone is
/// refunded if the event was cancelled or nobody came; unapproved applications
/// are refunded once sign-ups close. Ticket money stays for `close_event`.
#[event_cpi]
#[derive(Accounts)]
pub struct CloseGuest<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [GUEST_SEED, event.key().as_ref(), wallet.key().as_ref()],
        bump = guest.bump,
        close = wallet,
    )]
    pub guest: Account<'info, Guest>,
    /// CHECK: the wallet's stamp count. `add_stamp` creates it at their first
    /// stamp and checks it after that.
    #[account(mut, seeds = [STAMP_COUNT_SEED, wallet.key().as_ref()], bump)]
    pub stamp_count: UncheckedAccount<'info>,
    /// CHECK: the guest's wallet. Seeds the guest address and gets the rent.
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
    /// CHECK: the wallet's associated token account, derived here. It only has
    /// to exist when something is paid, so a no-show still gets their rent.
    #[account(
        mut,
        seeds = [wallet.key().as_ref(), token_program.key().as_ref(), stake_mint.key().as_ref()],
        seeds::program = associated_token::ID,
        bump,
    )]
    pub wallet_token_account: UncheckedAccount<'info>,
    /// Sends it. Pays only what a sign-up's deposit can't cover for a first
    /// stamp, which only happens if rent rose since sign-up.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_close_guest(ctx: Context<CloseGuest>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;

    if !ctx.accounts.guest.is_approved {
        // Never approved in time, so never a guest: a full refund.
        let has_rsvp_closed = now >= event.terms.rsvp_ends_at;
        require!(has_rsvp_closed || event.is_cancelled, VeniError::ApplicationPending);
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
        return Ok(());
    }

    require!(event.is_settled || event.is_cancelled, VeniError::NotSettled);

    // Cancelled, or nobody came: nothing is forfeited and no ticket is owed.
    let refunds_everyone = event.refunds_everyone();
    let is_attendee_payout = !refunds_everyone && ctx.accounts.guest.has_attended;
    let payout = if refunds_everyone {
        event.amount_per_guest()
    } else if is_attendee_payout {
        // Equal shares of what's left, minus pending applications and ticket
        // money. The last attendee takes the remainder, so the vault ends empty.
        let unpaid_attendee_count = event.attended_count - event.paid_count;
        let held_for_applicants = u64::from(event.applicant_count) * event.amount_per_guest();
        let held_for_organizer = event.ticket_revenue();
        (ctx.accounts.vault.amount - held_for_applicants - held_for_organizer) / u64::from(unpaid_attendee_count)
    } else {
        0
    };

    if payout > 0 {
        let accounts = &ctx.accounts;
        transfer_from_vault(
            &accounts.event,
            &accounts.vault,
            &accounts.stake_mint,
            &accounts.token_program,
            &accounts.wallet_token_account,
            payout,
        )?;
    }
    if is_attendee_payout {
        let accounts = &ctx.accounts;
        let count = add_stamp(
            &accounts.stamp_count,
            ctx.bumps.stamp_count,
            &accounts.wallet.key(),
            &accounts.guest,
            &accounts.payer,
            &accounts.system_program,
        )?;
        emit_cpi!(Stamped {
            wallet: accounts.wallet.key(),
            event: accounts.event.key(),
            organizer: accounts.event.organizer,
            attended_count: accounts.event.attended_count,
            count,
        });
        ctx.accounts.event.paid_count += 1;
    }
    ctx.accounts.event.closed_guest_count += 1;
    Ok(())
}
