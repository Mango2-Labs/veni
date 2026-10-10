use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account, transfer_checked, CloseAccount, Mint, Token, TokenAccount, TransferChecked,
};

use crate::{constants::EVENT_SEED, state::Event};

/// Moves tokens out of the event's vault, signing as the event.
pub fn transfer_from_vault<'info>(
    event: &Account<'info, Event>,
    vault: &Account<'info, TokenAccount>,
    stake_mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    destination: &impl ToAccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let event_id = event.event_id.to_le_bytes();
    let event_seeds: &[&[u8]] = &[EVENT_SEED, event.organizer.as_ref(), &event_id, &[event.bump]];
    let transfer = TransferChecked {
        from: vault.to_account_info(),
        mint: stake_mint.to_account_info(),
        to: destination.to_account_info(),
        authority: event.to_account_info(),
    };
    transfer_checked(
        CpiContext::new_with_signer(token_program.key(), transfer, &[event_seeds]),
        amount,
        stake_mint.decimals,
    )
}

/// Closes the event's empty vault and sends its rent to `rent_destination`.
pub fn close_vault<'info>(
    event: &Account<'info, Event>,
    vault: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    rent_destination: &impl ToAccountInfo<'info>,
) -> Result<()> {
    let event_id = event.event_id.to_le_bytes();
    let event_seeds: &[&[u8]] = &[EVENT_SEED, event.organizer.as_ref(), &event_id, &[event.bump]];
    let close = CloseAccount {
        account: vault.to_account_info(),
        destination: rent_destination.to_account_info(),
        authority: event.to_account_info(),
    };
    close_account(CpiContext::new_with_signer(token_program.key(), close, &[event_seeds]))
}
