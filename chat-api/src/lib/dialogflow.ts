import { env } from "../config/env";
import { logger } from "./logger";

export interface DialogflowResult {
  responseText: string;
  matchedIntent: string | null;
}

// decisions-log F1-F3 — Dialogflow ES, intent-based matching, routed through this
// backend so credentials never touch the client. When DIALOGFLOW_PROJECT_ID/
// DIALOGFLOW_CREDENTIALS_JSON are absent (not provisioned this session), every
// call takes the same canned-fallback path the contract already defines for a
// genuine Dialogflow timeout/error (api-contract.md §4) — chat.service.ts
// doesn't need a separate "not configured" branch.
export async function queryDialogflow(_userId: string, _message: string): Promise<DialogflowResult> {
  if (!env.dialogflowProjectId || !env.dialogflowCredentialsJson) {
    throw new Error("Dialogflow not configured");
  }

  // Real integration: @google-cloud/dialogflow's SessionsClient, one session
  // per userId, credentials from DIALOGFLOW_CREDENTIALS_JSON. Not wired yet —
  // credentials weren't available this session; see TASKS.md handoff log.
  const { SessionsClient } = await import("@google-cloud/dialogflow");
  const credentials = JSON.parse(env.dialogflowCredentialsJson);
  const client = new SessionsClient({ credentials });
  const sessionPath = client.projectAgentSessionPath(env.dialogflowProjectId, _userId);

  const [response] = await client.detectIntent({
    session: sessionPath,
    queryInput: { text: { text: _message, languageCode: "en" } },
  });

  const result = response.queryResult;
  if (!result?.fulfillmentText) {
    logger.warn({ userId: _userId }, "Dialogflow returned no fulfillment text");
    throw new Error("Dialogflow returned no response");
  }

  return {
    responseText: result.fulfillmentText,
    matchedIntent: result.intent?.displayName ?? null,
  };
}
