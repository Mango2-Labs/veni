use anchor_lang::prelude::*;

use crate::{
    constants::*,
    errors::VeniError,
    signature::require_door_signature,
    state::{Event, Guest},
};

/// A guest checks in by scanning the door code, signed by the door key. A code
/// works once, retires older codes and expires after a minute. The guest's
/// wallet signs, so nobody can check in someone else.
#[derive(Accounts)]
pub struct CheckInWithCode<'info> {
    pub wallet: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [GUEST_SEED, event.key().as_ref(), wallet.key().as_ref()],
        bump = guest.bump,
    )]
    pub guest: Account<'info, Guest>,
    /// CHECK: the instructions sysvar, checked by address.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

pub fn handle_check_in_with_code(
    ctx: Context<CheckInWithCode>,
    code: u64,
    shown_at: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = &ctx.accounts.event;

    require!(!event.is_cancelled, VeniError::EventCancelled);
    require!(now < event.terms.check_in_ends_at, VeniError::CheckInClosed);
    require!(ctx.accounts.guest.is_approved, VeniError::NotApproved);
    require!(!ctx.accounts.guest.has_attended, VeniError::AlreadyCheckedIn);
    require_door_signature(
        event,
        &ctx.accounts.instructions.to_account_info(),
        &check_in_code_message(&event.key(), code, shown_at),
    )?;
    // The door's clock can run a little ahead of the chain's.
    let latest_shown_at = now.saturating_add(MAX_CHECK_IN_CODE_CLOCK_AHEAD_SECONDS);
    require!(shown_at <= latest_shown_at, VeniError::CheckInCodeFromTheFuture);
    require!(now.saturating_sub(shown_at) <= MAX_CHECK_IN_CODE_AGE_SECONDS, VeniError::CheckInCodeExpired);
    // Codes only go up, so using one retires older codes. Writes to this event
    // run one at a time, so two guests can't share a code.
    require!(code > event.last_check_in_code, VeniError::CheckInCodeUsed);

    ctx.accounts.event.last_check_in_code = code;
    ctx.accounts.guest.has_attended = true;
    ctx.accounts.event.attended_count += 1;
    Ok(())
}

/// What the door key signs for each code it shows.
pub fn check_in_code_message(event: &Pubkey, code: u64, shown_at: i64) -> Vec<u8> {
    [CHECK_IN_CODE_MESSAGE_PREFIX, event.as_ref(), &code.to_le_bytes(), &shown_at.to_le_bytes()].concat()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_message_is_the_prefix_then_the_event_code_and_time() {
        let event = Pubkey::new_from_array([1; 32]);
        let message = check_in_code_message(&event, 7, 1_791_000_000);
        let rest = &message[CHECK_IN_CODE_MESSAGE_PREFIX.len()..];
        assert_eq!(&message[..CHECK_IN_CODE_MESSAGE_PREFIX.len()], CHECK_IN_CODE_MESSAGE_PREFIX);
        assert_eq!(&rest[..32], event.as_ref());
        assert_eq!(&rest[32..40], &7u64.to_le_bytes());
        assert_eq!(&rest[40..], &1_791_000_000i64.to_le_bytes());
    }

    #[test]
    fn a_check_in_code_never_matches_a_host_check_in() {
        // One prefix starts the other, but the lengths always differ.
        let event = Pubkey::new_from_array([1; 32]);
        let host_check_in = crate::instructions::check_in_message(&event, &Pubkey::new_from_array([2; 32]));
        let check_in_code = check_in_code_message(&event, 7, 1_791_000_000);
        assert_ne!(host_check_in.len(), check_in_code.len());
    }
}
