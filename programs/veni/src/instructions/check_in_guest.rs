use anchor_lang::prelude::*;

use crate::{
    constants::*,
    errors::VeniError,
    signature::require_door_signature,
    state::{Event, Guest},
};

/// The host checks a guest in, for when the guest can't scan. Anyone can send
/// it: it counts because of the organizer's or door key's signature over
/// `check_in_message` in the previous instruction.
#[derive(Accounts)]
pub struct CheckInGuest<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(mut, has_one = event @ VeniError::GuestNotInEvent)]
    pub guest: Account<'info, Guest>,
    /// CHECK: the instructions sysvar, checked by address.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

pub fn handle_check_in_guest(ctx: Context<CheckInGuest>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;
    let guest = &ctx.accounts.guest;

    require!(!event.is_cancelled, VeniError::EventCancelled);
    require!(now < event.terms.check_in_ends_at, VeniError::CheckInClosed);
    require!(guest.is_approved, VeniError::NotApproved);
    require!(!guest.has_attended, VeniError::AlreadyCheckedIn);
    require_door_signature(
        event,
        &ctx.accounts.instructions.to_account_info(),
        &check_in_message(&event.key(), &guest.wallet),
    )?;

    ctx.accounts.guest.has_attended = true;
    ctx.accounts.event.attended_count += 1;
    Ok(())
}

/// What the organizer or door key signs to check in one guest.
pub fn check_in_message(event: &Pubkey, wallet: &Pubkey) -> Vec<u8> {
    [CHECK_IN_MESSAGE_PREFIX, event.as_ref(), wallet.as_ref()].concat()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_message_is_the_prefix_then_the_event_then_the_wallet() {
        let event = Pubkey::new_from_array([1; 32]);
        let wallet = Pubkey::new_from_array([2; 32]);
        let message = check_in_message(&event, &wallet);
        assert_eq!(&message[..CHECK_IN_MESSAGE_PREFIX.len()], CHECK_IN_MESSAGE_PREFIX);
        assert_eq!(&message[CHECK_IN_MESSAGE_PREFIX.len()..][..32], event.as_ref());
        assert_eq!(&message[CHECK_IN_MESSAGE_PREFIX.len() + 32..], wallet.as_ref());
    }
}
