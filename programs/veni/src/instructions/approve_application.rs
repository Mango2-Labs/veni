use anchor_lang::prelude::*;

use crate::{
    errors::VeniError,
    state::{Event, Guest},
};

/// The organizer approves an application while sign-ups are open. The
/// applicant becomes a guest and takes a spot.
#[derive(Accounts)]
pub struct ApproveApplication<'info> {
    pub organizer: Signer<'info>,
    #[account(mut, has_one = organizer @ VeniError::NotOrganizer)]
    pub event: Account<'info, Event>,
    #[account(mut, has_one = event @ VeniError::GuestNotInEvent)]
    pub guest: Account<'info, Guest>,
}

pub fn handle_approve_application(ctx: Context<ApproveApplication>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;

    require!(!event.is_cancelled, VeniError::EventCancelled);
    require!(now < event.terms.rsvp_ends_at, VeniError::ApprovalClosed);
    require!(!ctx.accounts.guest.is_approved, VeniError::AlreadyApproved);
    require!(event.guest_count < event.terms.capacity, VeniError::EventFull);

    ctx.accounts.guest.is_approved = true;
    ctx.accounts.event.applicant_count -= 1;
    ctx.accounts.event.guest_count += 1;
    Ok(())
}
