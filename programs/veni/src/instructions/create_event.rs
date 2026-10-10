use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::*,
    errors::VeniError,
    state::{Event, EventDetails, EventTerms},
};

#[derive(Accounts)]
#[instruction(event_id: u64)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Event::INIT_SPACE,
        seeds = [EVENT_SEED, organizer.key().as_ref(), &event_id.to_le_bytes()],
        bump,
    )]
    pub event: Account<'info, Event>,
    #[account(
        constraint = ALLOWED_STAKE_MINTS.contains(&stake_mint.key()) @ VeniError::StakeMintNotAllowed,
    )]
    pub stake_mint: Account<'info, Mint>,
    /// Holds stakes and tickets. Only the event can move them.
    #[account(
        init,
        payer = organizer,
        associated_token::mint = stake_mint,
        associated_token::authority = event,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_event(
    ctx: Context<CreateEvent>,
    event_id: u64,
    terms: EventTerms,
    details: EventDetails,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let duration_seconds = terms.check_in_ends_at.saturating_sub(now);
    let one_token = 10u64.pow(u32::from(ctx.accounts.stake_mint.decimals));
    let max_stake_amount = MAX_STAKE_TOKENS * one_token;

    require!(terms.title.len() <= MAX_TITLE_LENGTH, VeniError::TitleTooLong);
    require!(details.host_name.len() <= MAX_HOST_NAME_LENGTH, VeniError::HostNameTooLong);
    require!(details.city.len() <= MAX_CITY_LENGTH, VeniError::CityTooLong);
    require!(details.venue.len() <= MAX_VENUE_LENGTH, VeniError::VenueTooLong);
    require!(details.cover.len() <= MAX_COVER_LENGTH, VeniError::CoverTooLong);
    require!(details.luma_slug.len() <= MAX_LUMA_SLUG_LENGTH, VeniError::LumaSlugTooLong);
    require!(
        details.location.is_none_or(|location| location.is_on_the_map()),
        VeniError::LocationOffTheMap
    );
    require!(terms.stake_amount > 0, VeniError::StakeIsZero);
    require!(terms.stake_amount <= max_stake_amount, VeniError::StakeTooLarge);
    require!(terms.ticket_price <= MAX_TICKET_PRICE_TOKENS * one_token, VeniError::TicketPriceTooLarge);
    if terms.ticket_price > 0 {
        require!(
            terms.stake_amount <= MAX_PAID_EVENT_STAKE_TOKENS * one_token,
            VeniError::StakeTooLargeForPaidEvent
        );
    }
    require!(terms.capacity > 0, VeniError::NoCapacity);
    require!(terms.rsvp_ends_at > now, VeniError::RsvpEndsInPast);
    require!(terms.rsvp_ends_at <= terms.check_in_ends_at, VeniError::RsvpEndsAfterCheckIn);
    require!(duration_seconds >= MIN_DURATION_SECONDS, VeniError::EventTooShort);
    require!(duration_seconds <= MAX_DURATION_SECONDS, VeniError::EventTooLong);

    ctx.accounts.event.set_inner(Event {
        organizer: ctx.accounts.organizer.key(),
        event_id,
        stake_mint: ctx.accounts.stake_mint.key(),
        guest_count: 0,
        attended_count: 0,
        paid_count: 0,
        closed_guest_count: 0,
        applicant_count: 0,
        last_check_in_code: 0,
        is_settled: false,
        is_cancelled: false,
        bump: ctx.bumps.event,
        terms,
        details,
    });
    Ok(())
}
