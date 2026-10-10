import Svg, { Circle, Path } from 'react-native-svg'
import { colors } from '@/lib/theme'

/** Two v's closing in on a dot: everyone heading to the same spot. */
export function LogoMark({ size = 40, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="12 9 40 45" accessibilityLabel="Veni">
      <Path
        d="M16 13.6 32 26.6l16-13M20.3 27.1 32 37.1l11.7-10"
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={32} cy={48.6} r={4.8} fill={colors.orange} />
    </Svg>
  )
}
