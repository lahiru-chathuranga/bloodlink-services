import { ELIGIBILITY_QUESTIONS } from "../constants/eligibilityQuestions";
import { ApiError } from "../lib/errors";
import { signEligibilityToken } from "../lib/jwt";
import { getDriveOrThrow } from "./drives.service";

export interface EligibilityAnswerInput {
  questionId: string;
  value: string;
}

export interface EligibilityCheckResult {
  passed: boolean;
  reason: string | null;
  eligibilityToken: string | null;
}

// Backend re-validates every answer against its own copy of the hardcoded
// question list — the client never sends a `passed` boolean (api-contract.md §2.5).
export async function checkEligibility(
  userId: string,
  driveId: string,
  answers: EligibilityAnswerInput[],
): Promise<EligibilityCheckResult> {
  await getDriveOrThrow(driveId);

  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));

  for (const question of ELIGIBILITY_QUESTIONS) {
    const value = answerMap.get(question.id);
    if (value === undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", `Missing answer for question "${question.id}".`, [
        { field: "answers", message: `Missing answer for question "${question.id}".` },
      ]);
    }
    const option = question.options.find((o) => o.value === value);
    if (!option) {
      throw new ApiError(400, "VALIDATION_ERROR", `Invalid answer "${value}" for question "${question.id}".`, [
        { field: "answers", message: `Invalid answer "${value}" for question "${question.id}".` },
      ]);
    }
    if (option.disqualifies) {
      return { passed: false, reason: question.text, eligibilityToken: null };
    }
  }

  const answersRecord: Record<string, string> = Object.fromEntries(answerMap);
  const eligibilityToken = signEligibilityToken({ userId, driveId, passed: true, answers: answersRecord });
  return { passed: true, reason: null, eligibilityToken };
}
