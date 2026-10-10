use anchor_lang::prelude::*;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};
use solana_sdk_ids::ed25519_program;

use crate::{errors::VeniError, state::Event};

/// Checks that the previous instruction is the organizer's or door key's
/// Ed25519 signature over `expected_message`. The Ed25519 program has already
/// verified it, or the transaction would have failed.
pub fn require_door_signature(
    event: &Event,
    instructions: &AccountInfo,
    expected_message: &[u8],
) -> Result<()> {
    let current_index = load_current_index_checked(instructions)?;
    let previous_index =
        current_index.checked_sub(1).ok_or(VeniError::MissingCheckInSignature)?;
    let signature = load_instruction_at_checked(usize::from(previous_index), instructions)?;
    require_keys_eq!(signature.program_id, ed25519_program::ID, VeniError::MissingCheckInSignature);
    let (signer, message) =
        read_signed_message(&signature.data).ok_or(VeniError::MissingCheckInSignature)?;

    let is_organizer = signer == event.organizer.as_ref();
    let is_door_key = signer == event.terms.door_key.as_ref();
    require!(is_organizer || is_door_key, VeniError::WrongCheckInSigner);
    require!(message == expected_message, VeniError::WrongCheckInMessage);
    Ok(())
}

/// The signer and message of a one-signature Ed25519 instruction. Parts stored
/// in another instruction (index other than u16::MAX) are refused, so what we
/// read is exactly what was verified.
fn read_signed_message(data: &[u8]) -> Option<(&[u8], &[u8])> {
    const THIS_INSTRUCTION: u16 = u16::MAX;
    let read_u16 = |at: usize| data.get(at..at + 2).map(|bytes| u16::from_le_bytes([bytes[0], bytes[1]]));

    let signature_count = *data.first()?;
    let signature_instruction = read_u16(4)?;
    let public_key_offset = usize::from(read_u16(6)?);
    let public_key_instruction = read_u16(8)?;
    let message_offset = usize::from(read_u16(10)?);
    let message_size = usize::from(read_u16(12)?);
    let message_instruction = read_u16(14)?;

    // 0 verifies nothing; with more, the offsets above describe only the first.
    if signature_count != 1 {
        return None;
    }
    if [signature_instruction, public_key_instruction, message_instruction] != [THIS_INSTRUCTION; 3] {
        return None;
    }
    let public_key = data.get(public_key_offset..public_key_offset + 32)?;
    let message = data.get(message_offset..message_offset + message_size)?;
    Some((public_key, message))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PUBLIC_KEY: [u8; 32] = [7; 32];
    const SIGNATURE: [u8; 64] = [9; 64];

    /// The standard layout: header, offsets, public key, signature, message.
    fn ed25519_data(message: &[u8], instruction_indexes: [u16; 3]) -> Vec<u8> {
        let public_key_offset: u16 = 16;
        let signature_offset: u16 = public_key_offset + 32;
        let message_offset: u16 = signature_offset + 64;
        let [signature_instruction, public_key_instruction, message_instruction] = instruction_indexes;
        let offsets = [
            signature_offset,
            signature_instruction,
            public_key_offset,
            public_key_instruction,
            message_offset,
            message.len() as u16,
            message_instruction,
        ];
        let mut data = vec![1, 0];
        for value in offsets {
            data.extend_from_slice(&value.to_le_bytes());
        }
        data.extend_from_slice(&PUBLIC_KEY);
        data.extend_from_slice(&SIGNATURE);
        data.extend_from_slice(message);
        data
    }

    #[test]
    fn reads_the_signer_and_message() {
        let data = ed25519_data(b"hello", [u16::MAX; 3]);
        assert_eq!(read_signed_message(&data), Some((&PUBLIC_KEY[..], &b"hello"[..])));
    }

    #[test]
    fn refuses_parts_that_live_in_another_instruction() {
        for indexes in [[0, u16::MAX, u16::MAX], [u16::MAX, 0, u16::MAX], [u16::MAX, u16::MAX, 0]] {
            assert_eq!(read_signed_message(&ed25519_data(b"hello", indexes)), None);
        }
    }

    #[test]
    fn refuses_no_signatures_or_more_than_one() {
        for count in [0, 2] {
            let mut data = ed25519_data(b"hello", [u16::MAX; 3]);
            data[0] = count;
            assert_eq!(read_signed_message(&data), None);
        }
    }

    #[test]
    fn refuses_offsets_past_the_end_instead_of_panicking() {
        let mut data = ed25519_data(b"hello", [u16::MAX; 3]);
        data[12..14].copy_from_slice(&u16::MAX.to_le_bytes()); // message size
        assert_eq!(read_signed_message(&data), None);
        assert_eq!(read_signed_message(&data[..10]), None);
        assert_eq!(read_signed_message(&[]), None);
    }
}
