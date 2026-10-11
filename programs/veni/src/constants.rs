use anchor_lang::prelude::*;

#[constant]
pub const EVENT_SEED: &[u8] = b"event";

#[constant]
pub const GUEST_SEED: &[u8] = b"guest";

#[constant]
pub const STAMP_COUNT_SEED: &[u8] = b"stamp_count";

#[constant]
pub const REWARDS_SEED: &[u8] = b"rewards";

#[constant]
pub const SEEKER_CLAIM_SEED: &[u8] = b"seeker_claim";

pub const MILESTONE_COUNT: usize = 5;

/// Max stake, in whole tokens.
#[constant]
pub const MAX_STAKE_TOKENS: u64 = 100;

/// Max stake at a paid event, in whole tokens. The ticket is commitment enough.
#[constant]
pub const MAX_PAID_EVENT_STAKE_TOKENS: u64 = 5;

/// Max ticket price, in whole tokens.
#[constant]
pub const MAX_TICKET_PRICE_TOKENS: u64 = 1_000;

/// Ticket money waits this long after check-in closes, so guests can report a
/// fake event. Stakes don't wait.
#[constant]
pub const TICKET_HOLD_SECONDS: i64 = 24 * 60 * 60;

/// Creation to check-in deadline. 1 minute on devnet; 1 day before mainnet.
#[constant]
pub const MIN_DURATION_SECONDS: i64 = 60;

#[constant]
pub const MAX_DURATION_SECONDS: i64 = 365 * 24 * 60 * 60; // 1 year

// In bytes. The app checks the same limits.
pub const MAX_TITLE_LENGTH: usize = 64;
pub const MAX_HOST_NAME_LENGTH: usize = 40;
pub const MAX_CITY_LENGTH: usize = 32;
pub const MAX_VENUE_LENGTH: usize = 48;
pub const MAX_COVER_LENGTH: usize = 100;
pub const MAX_LUMA_SLUG_LENGTH: usize = 64;

// In millionths of a degree.
pub const MAX_LATITUDE: i32 = 90_000_000;
pub const MAX_LONGITUDE: i32 = 180_000_000;

/// Signed for a check-in, then the event and wallet addresses. The prefix
/// keeps the signature meaningless outside Veni.
#[constant]
pub const CHECK_IN_MESSAGE_PREFIX: &[u8] = b"Veni check-in";

/// Signed for each door code, then the event address, code number and time
/// shown (little-endian).
#[constant]
pub const CHECK_IN_CODE_MESSAGE_PREFIX: &[u8] = b"Veni check-in code";

/// How long a door code works, so a forwarded photo expires.
#[constant]
pub const MAX_CHECK_IN_CODE_AGE_SECONDS: i64 = 60;

/// How far ahead of the chain's clock a door's clock may run.
#[constant]
pub const MAX_CHECK_IN_CODE_CLOCK_AHEAD_SECONDS: i64 = 30;

/// Veni's cut of forfeited stakes. The rest goes to the guests who came.
#[constant]
pub const FEE_BPS: u64 = 1_000; // 10%

/// 10,000 basis points make 100%.
pub const BPS_PER_WHOLE: u64 = 10_000;

/// Receives fees. A devnet keypair; a Squads multisig before mainnet.
#[constant]
pub const TREASURY: Pubkey = pubkey!("FoepXQr3sUTccoKWMizSKzvfu7TuugbpjtsMi9j5Pm5C");

/// Circle's devnet USDC. Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.
#[constant]
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

/// Devnet-only test dollar from the app's faucet. Remove before mainnet.
#[constant]
pub const TEST_USD_MINT: Pubkey = pubkey!("Ew1wjmQLdugoqQNFiMV7SV7VZksfGXSriZ8WoynVPMW3");

/// Classic SPL tokens without transfer fees, so payouts add up exactly.
pub const ALLOWED_STAKE_MINTS: [Pubkey; 2] = [USDC_MINT, TEST_USD_MINT];
