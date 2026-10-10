import { createHash } from "node:crypto";
import {
  accountNode,
  bottomUpTransformerVisitor,
  bytesTypeNode,
  bytesValueNode,
  constantPdaSeedNodeFromString,
  fieldDiscriminatorNode,
  fixedSizeTypeNode,
  numberTypeNode,
  pdaLinkNode,
  pdaNode,
  pdaValueNode,
  programIdValueNode,
  rootNodeVisitor,
  setInstructionAccountDefaultValuesVisitor,
  structFieldTypeNode,
  structTypeNode,
} from "codama";

// Codama reads a constant's name as SCREAMING_SNAKE_CASE only when it has an
// underscore, so a one-word constant like TREASURY would be generated as
// T_R_E_A_S_U_R_Y. This gives such names back their one word.
export function oneWordConstantNames() {
  return bottomUpTransformerVisitor([
    {
      select: "[constantNode]",
      transform: (node) => (/^[a-z][A-Z0-9]+$/.test(node.name) ? { ...node, name: node.name.toLowerCase() } : node),
    },
  ]);
}

// The program creates StampCount by hand, so Anchor leaves it out of the IDL.
// This adds it back, so the client can read it. Its address comes from the
// stampCount PDA that Codama finds in close_guest's accounts.
export function stampCountAccount() {
  const discriminator = createHash("sha256").update("account:StampCount").digest().subarray(0, 8);
  return rootNodeVisitor((root) => ({
    ...root,
    program: {
      ...root.program,
      accounts: [
        ...root.program.accounts,
        accountNode({
          name: "stampCount",
          docs: ["How many events a wallet came to. Never closed."],
          data: structTypeNode([
            structFieldTypeNode({
              name: "discriminator",
              type: fixedSizeTypeNode(bytesTypeNode(), 8),
              defaultValue: bytesValueNode("base16", discriminator.toString("hex")),
              defaultValueStrategy: "omitted",
            }),
            structFieldTypeNode({ name: "bump", type: numberTypeNode("u8") }),
            structFieldTypeNode({ name: "count", type: numberTypeNode("u32") }),
          ]),
          discriminators: [fieldDiscriminatorNode("discriminator")],
          pda: pdaLinkNode("stampCount"),
          size: 13,
        }),
      ],
    },
  }));
}

// Anchor's IDL lists the accounts behind `emit_cpi!` without their addresses.
export function eventCpiDefaults() {
  return setInstructionAccountDefaultValuesVisitor([
    {
      account: "eventAuthority",
      defaultValue: pdaValueNode(pdaNode({ name: "eventAuthority", seeds: [constantPdaSeedNodeFromString("utf8", "__event_authority")] })),
    },
    { account: "program", defaultValue: programIdValueNode() },
  ]);
}
