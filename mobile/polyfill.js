// Before anything else loads: Buffer, and WebCrypto from react-native-quick-crypto,
// which Kit uses for program addresses (SHA-256) and the door key (Ed25519).
import { Buffer } from 'buffer'
global.Buffer = Buffer

import { install } from 'react-native-quick-crypto'
install()

// Before Kit sends anything: see the file.
import './abort-signal'

// The generated program client's modules import each other: harmless, and only noted in
// development. Set here, before those modules load.
import { LogBox } from 'react-native'
LogBox.ignoreLogs(['Require cycle:'])
