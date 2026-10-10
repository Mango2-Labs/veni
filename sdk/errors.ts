import { isSolanaError, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM } from "@solana/kit";
import { getVeniErrorMessage, type VeniError } from "@veni/client";

/** The program's own errors by name and message; anything else by its message. */
export function describeError(error: unknown): string {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (isSolanaError(cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM) && cause.context.code >= 6000) {
      return getVeniErrorMessage(cause.context.code as VeniError);
    }
  }
  return error instanceof Error ? error.message : String(error);
}
