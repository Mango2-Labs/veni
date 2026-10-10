use anchor_lang::prelude::*;

#[error_code]
pub enum VeniError {
    #[msg("The title is longer than 64 bytes")]
    TitleTooLong,
    #[msg("The host's name is longer than 40 bytes")]
    HostNameTooLong,
    #[msg("The city is longer than 32 bytes")]
    CityTooLong,
    #[msg("The venue is longer than 48 bytes")]
    VenueTooLong,
    #[msg("The cover link is longer than 100 bytes")]
    CoverTooLong,
    #[msg("The stake must be more than zero")]
    StakeIsZero,
    #[msg("The stake is over the 100-token limit")]
    StakeTooLarge,
    #[msg("This token can't be staked")]
    StakeMintNotAllowed,
    #[msg("An event needs room for at least one guest")]
    NoCapacity,
    #[msg("RSVPs must close in the future")]
    RsvpEndsInPast,
    #[msg("RSVPs must close before check-in does")]
    RsvpEndsAfterCheckIn,
    #[msg("Check-in closes sooner than the minimum")]
    EventTooShort,
    #[msg("Check-in must close within 1 year")]
    EventTooLong,
    #[msg("RSVPs have closed")]
    RsvpClosed,
    #[msg("The event is full")]
    EventFull,
    #[msg("The event was cancelled")]
    EventCancelled,
    #[msg("This isn't the token the event is staked in")]
    WrongStakeMint,
    #[msg("This guest isn't on this event's list")]
    GuestNotInEvent,
    #[msg("Check-in has closed")]
    CheckInClosed,
    #[msg("This guest has already checked in")]
    AlreadyCheckedIn,
    #[msg("A check-in needs the organizer's signature in the instruction right before it")]
    MissingCheckInSignature,
    #[msg("This check-in wasn't signed by the organizer or their door key")]
    WrongCheckInSigner,
    #[msg("This signature is for another event or guest")]
    WrongCheckInMessage,
    #[msg("Only the organizer can cancel the event")]
    NotOrganizer,
    #[msg("An event can only be cancelled while RSVPs are open")]
    CancelTooLate,
    #[msg("The event is already settled")]
    AlreadySettled,
    #[msg("Nobody RSVPed, so there's nothing to settle. Close the event instead")]
    NobodyRsvped,
    #[msg("Check-in is still open")]
    CheckInStillOpen,
    #[msg("The event isn't settled or cancelled yet")]
    NotSettled,
    #[msg("Only the organizer can close an event while RSVPs are open")]
    RsvpStillOpen,
    #[msg("Every guest's account has to be closed first")]
    GuestsStillOpen,
    #[msg("This check-in code was already used. Scan the new code on the door screen")]
    CheckInCodeUsed,
    #[msg("This check-in code has expired. Scan the code on the door screen now")]
    CheckInCodeExpired,
    #[msg("This check-in code is dated ahead of the chain's clock")]
    CheckInCodeFromTheFuture,
    #[msg("The location isn't on the map: latitude must be within 90° and longitude within 180°")]
    LocationOffTheMap,
    #[msg("The Luma link is longer than 64 bytes")]
    LumaSlugTooLong,
    #[msg("The organizer hosts the event, so they don't RSVP to it")]
    OrganizerCannotRsvp,
    #[msg("The host hasn't approved this guest")]
    NotApproved,
    #[msg("This guest is already approved")]
    AlreadyApproved,
    #[msg("Applications can only be approved while RSVPs are open")]
    ApprovalClosed,
    #[msg("Only the organizer or the applicant can take back an application")]
    NotOrganizerOrApplicant,
    #[msg("Every application has to be refunded first")]
    ApplicantsStillOpen,
    #[msg("This application is still waiting for the host. It's refunded once RSVPs close")]
    ApplicationPending,
    #[msg("A paid event's stake can be at most 5 tokens")]
    StakeTooLargeForPaidEvent,
    #[msg("The ticket price is over the 1,000-token limit")]
    TicketPriceTooLarge,
    #[msg("The host needs a token account for this token to be paid for tickets")]
    HostTokenAccountMissing,
    #[msg("The host's ticket money is held until 24 hours after check-in closes")]
    TicketsOnHold,
}
