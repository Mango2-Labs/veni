import { getBase64Decoder, getBase64Encoder, getUtf8Encoder, type Address } from '@solana/kit'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { PHOTO_SIZE, photoMessage, sha256Hex } from '@veni/sdk'
import { savePhoto } from './api'

type SignMessages = (messages: Uint8Array[]) => Promise<Uint8Array[]>

/** Picks a photo, squares it to 256×256, and saves it signed by the wallet. Undefined if nothing was picked. */
export async function pickAndSavePhoto(wallet: Address, signMessages: SignMessages) {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] })
  if (picked.canceled) return undefined
  const { uri, width, height } = picked.assets[0]
  const side = Math.min(width, height)
  const square = await ImageManipulator.manipulate(uri)
    .crop({ originX: (width - side) / 2, originY: (height - side) / 2, width: side, height: side })
    .resize({ width: PHOTO_SIZE, height: PHOTO_SIZE })
    .renderAsync()
  const { base64 } = await square.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true })
  if (!base64) throw new Error("Couldn't read that photo.")
  const image = new Uint8Array(getBase64Encoder().encode(base64))
  const photo = { wallet, sha256: await sha256Hex(image), signedAt: new Date().toISOString() }
  let signed: Uint8Array
  try {
    ;[signed] = await signMessages([getUtf8Encoder().encode(photoMessage(photo)) as Uint8Array])
  } catch {
    throw new Error("You didn't sign, so your photo wasn't saved.")
  }
  // The wallet returns the message with its 64-byte signature at the end.
  return savePhoto({ ...photo, image: base64, signature: getBase64Decoder().decode(signed.slice(-64)) })
}
