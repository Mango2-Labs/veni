pub mod constants;
pub mod errors;
pub mod instructions;
pub mod signature;
pub mod stamps;
pub mod state;
pub mod vault;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7oLjHhpFXGq48fGWLWBPwysQJBvbEAyiGF489tXW8kao");

#[program]
pub mod veni {
    use super::*;

    pub fn create_event(
        ctx: Context<CreateEvent>,
        event_id: u64,
        terms: EventTerms,
        details: EventDetails,
    ) -> Result<()> {
        instructions::create_event::handle_create_event(ctx, event_id, terms, details)
    }

    pub fn sign_up(ctx: Context<SignUp>) -> Result<()> {
        instructions::sign_up::handle_sign_up(ctx)
    }

    pub fn approve_application(ctx: Context<ApproveApplication>) -> Result<()> {
        instructions::approve_application::handle_approve_application(ctx)
    }

    pub fn remove_application(ctx: Context<RemoveApplication>) -> Result<()> {
        instructions::remove_application::handle_remove_application(ctx)
    }

    pub fn check_in_guest(ctx: Context<CheckInGuest>) -> Result<()> {
        instructions::check_in_guest::handle_check_in_guest(ctx)
    }

    pub fn check_in_with_code(
        ctx: Context<CheckInWithCode>,
        code: u64,
        shown_at: i64,
    ) -> Result<()> {
        instructions::check_in_with_code::handle_check_in_with_code(ctx, code, shown_at)
    }

    pub fn cancel_event(ctx: Context<CancelEvent>) -> Result<()> {
        instructions::cancel_event::handle_cancel_event(ctx)
    }

    pub fn settle_event(ctx: Context<SettleEvent>) -> Result<()> {
        instructions::settle_event::handle_settle_event(ctx)
    }

    pub fn close_guest(ctx: Context<CloseGuest>) -> Result<()> {
        instructions::close_guest::handle_close_guest(ctx)
    }

    pub fn close_event(ctx: Context<CloseEvent>) -> Result<()> {
        instructions::close_event::handle_close_event(ctx)
    }
}
