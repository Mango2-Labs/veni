use anchor_lang::{
    prelude::*,
    system_program::{allocate, assign, transfer, Allocate, Assign, Transfer},
};

use crate::{
    constants::STAMP_COUNT_SEED,
    state::{Guest, StampCount},
};

/// Adds a stamp to the wallet's count and returns the new count. The first
/// stamp creates the account, paid from the sign-up's deposit; `payer` covers
/// any shortfall, which only happens if rent rose since sign-up.
pub fn add_stamp<'info>(
    stamp_count: &UncheckedAccount<'info>,
    bump: u8,
    wallet: &Pubkey,
    guest: &Account<'info, Guest>,
    payer: &Signer<'info>,
    system_program: &Program<'info, System>,
) -> Result<u32> {
    if stamp_count.owner == &crate::ID {
        let mut data = stamp_count.try_borrow_mut_data()?;
        let mut stamps = StampCount::try_deserialize(&mut &data[..])?;
        stamps.count += 1;
        stamps.try_serialize(&mut &mut data[..])?;
        return Ok(stamps.count);
    }

    // Allocate and assign, unlike create_account, still work if someone sent
    // lamports here first. Every call comes before the sign-up's lamports move:
    // a call that saw only one side of that move would find them unbalanced.
    let space = 8 + StampCount::INIT_SPACE;
    let deposit = Rent::get()?
        .minimum_balance(space)
        .saturating_sub(stamp_count.lamports());
    let from_sign_up = deposit.min(guest.get_lamports());
    if deposit > from_sign_up {
        let accounts = Transfer {
            from: payer.to_account_info(),
            to: stamp_count.to_account_info(),
        };
        transfer(CpiContext::new(system_program.key(), accounts), deposit - from_sign_up)?;
    }
    let signer_seeds: &[&[&[u8]]] = &[&[STAMP_COUNT_SEED, wallet.as_ref(), &[bump]]];
    let accounts = Allocate {
        account_to_allocate: stamp_count.to_account_info(),
    };
    allocate(
        CpiContext::new_with_signer(system_program.key(), accounts, signer_seeds),
        space as u64,
    )?;
    let accounts = Assign {
        account_to_assign: stamp_count.to_account_info(),
    };
    assign(
        CpiContext::new_with_signer(system_program.key(), accounts, signer_seeds),
        &crate::ID,
    )?;
    StampCount { bump, count: 1 }.try_serialize(&mut &mut stamp_count.try_borrow_mut_data()?[..])?;
    guest.sub_lamports(from_sign_up)?;
    stamp_count.add_lamports(from_sign_up)?;
    Ok(1)
}
