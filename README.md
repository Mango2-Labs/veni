<p align="center"><img src="web/src/app/icon.svg" width="72" alt="Veni"></p>

# Veni

**Find crypto events near you, or host one and fill the room.**

Free sign-ups are easy to ignore, and hosts end up with empty seats. On Veni, guests stake a few dollars to sign up. They show up, scan the door, and get it back with a share of what the no-shows staked.

## How it works

1. **Sign up.** The guest stakes a few dollars in USDC, plus the ticket at a paid event. The money sits in a vault the program controls, not with the host, and can't be withdrawn before the event.
2. **Check in.** The host's door screen shows a code signed by the event's door key. The guest scans it and signs with their wallet. Codes expire after a minute, so a photo of one doesn't work.
3. **Get paid.** When check-in closes, everyone who came gets their stake back plus an equal share of the no-shows' stakes. Veni keeps 10% of what no-shows lose. If the host cancels or nobody checks in, everyone gets everything back.

Also:

- **Approval events:** guests apply with their stake and the host picks who comes. Anyone not approved is refunded.
- **Paid events:** the host gets the ticket money 24 hours after check-in closes, and stakes are capped at $5. Veni takes nothing from tickets.
- **Automatic payouts:** a crank settles each event and pays everyone. Nobody has to claim.
- **Stamps:** every event a guest attends adds one to their stamp count, an account on Solana that nothing can delete. Each stamp is logged with its event and host.
- **Usernames:** people pick a username, signed by their wallet, so nobody has to read wallet addresses.

## Try it on devnet

Veni runs on Solana devnet with test dollars, so switch your wallet to devnet first:

- **Seed Vault Wallet** (built into Seeker): choose Devnet as the network in its settings.
- **Phantom:** Settings → Developer Settings → turn on Testnet Mode → Solana → Devnet.
- **Solflare:** Settings → Network → Devnet.

Then tap **Get test funds** on Veni for 50 test dollars and a little SOL.

## What's here

| Folder | What it is |
| --- | --- |
| `programs/veni` | The Anchor program |
| `clients/veni` | TypeScript client, generated from the program with Codama |
| `sdk` | Talks to the program: the RPC client, reading events and sign-ups, check-in codes, payout rules |
| `crank` | Settles events, pays guests and hosts, closes events |
| `web` | The Next.js site and the API behind it |
| `tests` | LiteSVM tests for the program and crank |

## Instructions

### Hosts

- [`create_event`](programs/veni/src/instructions/create_event.rs) - Creates an event with its stake, ticket, capacity, deadlines and door key.
- [`approve_application`](programs/veni/src/instructions/approve_application.rs) - Approves an application.
- [`cancel_event`](programs/veni/src/instructions/cancel_event.rs) - Cancels the event while sign-ups are open and refunds everyone.

### Guests

- [`sign_up`](programs/veni/src/instructions/sign_up.rs) - Signs up, moving the stake and any ticket into the event's vault.
- [`remove_application`](programs/veni/src/instructions/remove_application.rs) - Withdraws an application, or lets the host decline it, with a full refund.
- [`check_in_with_code`](programs/veni/src/instructions/check_in_with_code.rs) - Checks in by scanning the code on the door screen.

### Door

- [`check_in_guest`](programs/veni/src/instructions/check_in_guest.rs) - Checks a guest in with the door key's signature.

### Payouts

- [`settle_event`](programs/veni/src/instructions/settle_event.rs) - Counts who came once check-in closes and sends Veni's 10% of no-show stakes to the treasury.
- [`close_guest`](programs/veni/src/instructions/close_guest.rs) - Pays or refunds one guest and returns their account rent. An attendee also gets a stamp.
- [`close_event`](programs/veni/src/instructions/close_event.rs) - Pays the host for tickets once the 24-hour hold ends, then closes the vault and the event.

## State

- [`Event`](programs/veni/src/state.rs#L78) - An event's terms, details and counts: going, applying, checked in and paid.
- [`Guest`](programs/veni/src/state.rs#L129) - One wallet's sign-up: approved, and whether they checked in.
- [`StampCount`](programs/veni/src/state.rs#L142) - How many events a wallet came to. Never closed.
- [`Stamped`](programs/veni/src/state.rs#L150) - Logged for each stamp: the wallet, event, host, check-ins and new count.

## Tests

The tests cover every instruction's success and failure cases, an upgrade from the last devnet program, random events checked against the payout rules, and compute limits. To run them, build the program with Anchor, then run the tests with Bun:

```sh
bun install
anchor build
bun test
```

`bun test` also runs the web server's tests. The random-event tests use a fixed seed; set `VENI_RANDOM_SEED` and `VENI_RANDOM_RUNS` to try more events.

For the program's Rust unit tests:

```sh
cargo test
```

## Status

Devnet only, with test dollars. The program hasn't been audited.
