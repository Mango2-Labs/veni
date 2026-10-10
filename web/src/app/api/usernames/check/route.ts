import { describeError } from "@veni/sdk";
import { normalizeUsername, usernameProblem } from "@veni/sdk";
import { usernameUnavailableReason } from "@/lib/server/usernames";

/** Whether a wallet can pick a username: ?name=menor&wallet=… */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const username = normalizeUsername(params.get("name") ?? "");
  const problem = usernameProblem(username);
  if (problem) return Response.json({ username, available: false, problem });
  try {
    const reason = await usernameUnavailableReason(username, params.get("wallet") ?? undefined);
    return Response.json({ username, available: !reason, problem: reason });
  } catch (error) {
    return Response.json({ error: `Couldn't check that username: ${describeError(error)}` }, { status: 500 });
  }
}
