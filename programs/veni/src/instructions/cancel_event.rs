use anchor_lang::prelude::*;

use crate::{errors::VeniError, state::Event};

/// The organizer calls the event off while sign-ups are open. Every guest is
/// then refunded in full, with no fee.
#[derive(Accounts)]
pub struct CancelEvent<'info> {
    pub organizer: Signer<'info>,
    #[account(mut, has_one = organizer @ VeniError::NotOrganizer)]
    pub event: Account<'info, Event>,
}

pub fn handle_cancel_event(ctx: Context<CancelEvent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &mut ctx.accounts.event;

    require!(!event.is_cancelled, VeniError::EventCancelled);
    // Settling needs sign-ups closed, so this also means it isn't settled.
    require!(now < event.terms.rsvp_ends_at, VeniError::CancelTooLate);

    event.is_cancelled = true;
    Ok(())
}
