// The host's door key: made on this phone on first use and named in each event's
// terms. It signs door codes, so guests check in without a wallet prompt per guest.
import * as SecureStore from 'expo-secure-store'
import { createKeyPairSignerFromPrivateKeyBytes, getBase16Codec, type Address } from '@solana/kit'

const hex = getBase16Codec()
const keyName = (organizer: Address) => `veni.doorKey.${organizer}`

/** This phone's door key for a host, made on first use. */
export async function doorKeyFor(organizer: Address) {
  const saved = await SecureStore.getItemAsync(keyName(organizer))
  if (saved) return createKeyPairSignerFromPrivateKeyBytes(hex.encode(saved))
  const seed = crypto.getRandomValues(new Uint8Array(32))
  await SecureStore.setItemAsync(keyName(organizer), hex.decode(seed))
  return createKeyPairSignerFromPrivateKeyBytes(seed)
}

/** The event's door key, if this phone is where its host made it. */
export async function findDoorKey(organizer: Address, doorKey: Address) {
  const saved = await SecureStore.getItemAsync(keyName(organizer))
  if (!saved) return undefined
  const signer = await createKeyPairSignerFromPrivateKeyBytes(hex.encode(saved))
  return signer.address === doorKey ? signer : undefined
}
