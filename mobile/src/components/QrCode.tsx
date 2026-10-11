import { useMemo } from 'react'
import { View } from 'react-native'
import { encode } from 'uqr'
import { colors } from '@/lib/theme'

/** A QR code drawn as one view per run of dark modules, so it needs no native code. */
export function QrCode({ text, size }: { text: string; size: number }) {
  const { data } = useMemo(() => encode(text, { ecc: 'M', border: 0 }), [text])
  const cell = Math.floor(size / data.length)
  const runs = useMemo(
    () =>
      data.flatMap((row, y) => {
        const found: { x: number; y: number; length: number }[] = []
        row.forEach((dark, x) => {
          if (!dark) return
          const last = found[found.length - 1]
          if (last && last.x + last.length === x) last.length += 1
          else found.push({ x, y, length: 1 })
        })
        return found
      }),
    [data],
  )
  return (
    <View accessibilityRole="image" accessibilityLabel="Check-in code" style={{ width: cell * data.length, height: cell * data.length }}>
      {runs.map(({ x, y, length }) => (
        <View
          key={`${x}-${y}`}
          style={{ position: 'absolute', left: x * cell, top: y * cell, width: length * cell, height: cell, backgroundColor: colors.ink }}
        />
      ))}
    </View>
  )
}
