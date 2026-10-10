// Veni's brand (brand.md), for styles Uniwind classes can't set, like fonts.
export const colors = {
  ink: '#14223F',
  ink2: '#46566F',
  muted: '#5B6B86',
  line: '#DCE5F0',
  paper: '#FFFFFF',
  sky: '#EAF2FB',
  lineDk: '#C5D3E5',
  skyDk: '#D6E5F6',
  orange: '#F26B3A',
  orangeDk: '#DD5A2B',
  orangeText: '#B2431A',
  orangeSoft: '#FDE8DF',
  orangeInk: '#5E2A15',
  teal: '#13A89E',
  tealText: '#0E7C74',
  tealSoft: '#DDF4F1',
  gold: '#FFC83D',
  goldSoft: '#FFF3CC',
  goldInk: '#6B4A00',
} as const

export const fonts = {
  display: 'Unbounded_800ExtraBold',
  displayBold: 'Unbounded_700Bold',
  body: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
} as const

/** Text styles, from brand.md: Unbounded for headlines, Plus Jakarta Sans for text. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -1.2, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.7, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.4, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink2 },
  strong: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
} as const

/** Corner radii from brand.md, set as styles: buttons and fields, cards, the profile cover, chips. */
export const radius = { button: 14, card: 22, cover: 26, chip: 9 } as const
