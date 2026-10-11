// Loaded first: Kit needs WebCrypto (SHA-256, Ed25519) and a newer AbortSignal than React Native's.
import { Buffer } from 'buffer'
global.Buffer = Buffer

import { install } from 'react-native-quick-crypto'
install()

import './abort-signal'

// The generated client's modules import each other: harmless.
import { LogBox } from 'react-native'
LogBox.ignoreLogs(['Require cycle:'])
