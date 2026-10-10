use anchor_lang::prelude::*;

use crate::constants::*;

/// Set by the organizer at creation and never changed.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct EventTerms {
    pub stake_amount: u64,
    /// Paid on top of the stake, or 0 for a free event. Held until `close_event`.
    pub ticket_price: u64,
    /// Sign-ups close when the event starts.
    pub rsvp_ends_at: i64,
    /// Anyone not checked in by then is a no-show.
    pub check_in_ends_at: i64,
    pub capacity: u16,
    /// Guests apply, and count only once the organizer approves them.
    pub requires_approval: bool,
    /// Signs check-ins like the organizer, so staff can run the door.
    pub door_key: Pubkey,
    #[max_len(MAX_TITLE_LENGTH)]
    pub title: String,
}

/// Shown by the app. The program only limits sizes.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct EventDetails {
    #[max_len(MAX_HOST_NAME_LENGTH)]
    pub host_name: String,
    #[max_len(MAX_CITY_LENGTH)]
    pub city: String,
    #[max_len(MAX_VENUE_LENGTH)]
    pub venue: String,
    /// Poster link, or empty.
    #[max_len(MAX_COVER_LENGTH)]
    pub cover: String,
    /// The path after "luma.com/", or empty.
    #[max_len(MAX_LUMA_SLUG_LENGTH)]
    pub luma_slug: String,
    /// Map pin, if any.
    pub location: Option<GeoPoint>,
}

/// In millionths of a degree, about 11 cm.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct GeoPoint {
    pub latitude: i32,
    pub longitude: i32,
}

impl GeoPoint {
    pub fn is_on_the_map(&self) -> bool {
        (-MAX_LATITUDE..=MAX_LATITUDE).contains(&self.latitude)
            && (-MAX_LONGITUDE..=MAX_LONGITUDE).contains(&self.longitude)
    }
}

//         rsvp_ends_at              check_in_ends_at         settle_event
//   OPEN ─────────────> STARTED ──────────────────> ENDED ─────────────> SETTLED ──> closed
//    │                     │                                                ^          ^
//    │                     └── everyone checked in: settle early ───────────┘          │
//    ├── cancel_event (the organizer, while sign-ups are open): CANCELLED ─────────────┤
//    └── nobody signed up: close_event skips settling ─────────────────────────────────┘
//        (the organizer any time, anyone once sign-ups close)
//
//   Check in: check_in_guest (the door signs) or check_in_with_code (the guest
//   scans the door), until check_in_ends_at.
//   Approval: sign_up makes an application, approve_application makes it a
//   guest, remove_application refunds it. close_guest refunds any left once
//   sign-ups close.
//   After SETTLED or CANCELLED: close_guest for every guest, then close_event.
//   close_guest also stamps each paid attendee: one more on their StampCount,
//   logged as Stamped.
//   Nobody checked in pays out like CANCELLED. Ticket money waits
//   TICKET_HOLD_SECONDS in close_event; stakes don't.

#[account]
#[derive(InitSpace)]
pub struct Event {
    pub organizer: Pubkey,
    pub event_id: u64,
    pub stake_mint: Pubkey,
    pub guest_count: u16,
    pub attended_count: u16,
    /// Attendees paid so far.
    pub paid_count: u16,
    pub closed_guest_count: u16,
    /// Pending applications. Payouts never touch their stakes.
    pub applicant_count: u16,
    /// Highest check-in code used. Only higher codes work.
    pub last_check_in_code: u64,
    pub is_settled: bool,
    pub is_cancelled: bool,
    pub bump: u8,
    // Variable length, so last: the fields above keep fixed offsets for filters.
    pub terms: EventTerms,
    pub details: EventDetails,
}

impl Event {
    /// Stake plus ticket.
    pub fn amount_per_guest(&self) -> u64 {
        self.terms.stake_amount + self.terms.ticket_price
    }

    /// Cancelled, or nobody checked in: everyone gets everything back.
    pub fn refunds_everyone(&self) -> bool {
        self.is_cancelled || self.attended_count == 0
    }

    /// Every ticket, no-shows' included, unless everyone is refunded.
    pub fn ticket_revenue(&self) -> u64 {
        if self.refunds_everyone() {
            0
        } else {
            u64::from(self.guest_count) * self.terms.ticket_price
        }
    }

    /// When ticket money can be paid, however early the event settled.
    pub fn ticket_hold_ends_at(&self) -> i64 {
        self.terms.check_in_ends_at + TICKET_HOLD_SECONDS
    }
}

/// One per wallet that signs up or applies. Its rent goes back to the wallet,
/// less the stamp count's deposit at their first stamp.
#[account]
#[derive(InitSpace)]
pub struct Guest {
    pub event: Pubkey,
    pub wallet: Pubkey,
    pub has_attended: bool,
    /// False while an application is pending.
    pub is_approved: bool,
    pub bump: u8,
}

/// One per wallet with a stamp: how many events they came to. Paid once, from
/// their first stamped sign-up's deposit, and never closed.
#[account]
#[derive(InitSpace)]
pub struct StampCount {
    pub bump: u8,
    pub count: u32,
}

/// Logged by `close_guest` for each stamp, so anyone can see which events a
/// stamp count is made of.
#[event]
pub struct Stamped {
    pub wallet: Pubkey,
    pub event: Pubkey,
    pub organizer: Pubkey,
    /// Guests checked in at the event.
    pub attended_count: u16,
    /// The wallet's stamp count, this stamp included.
    pub count: u32,
}
