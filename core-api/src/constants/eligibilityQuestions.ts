// data-model.md §6 — must be byte-for-byte identical to
// bloodlink-mobile/src/constants/eligibilityQuestions.ts. The backend
// re-validates submitted answers against this copy; never trust a client-sent
// `passed` boolean.
export interface EligibilityQuestionOption {
  value: string;
  label: string;
  disqualifies: boolean;
}

export interface EligibilityQuestion {
  id: string;
  text: string;
  options: EligibilityQuestionOption[];
}

export const ELIGIBILITY_QUESTIONS: EligibilityQuestion[] = [
  {
    id: "age",
    text: "Are you between 18 and 60 years old?",
    options: [
      { value: "yes", label: "Yes", disqualifies: false },
      { value: "no", label: "No", disqualifies: true },
    ],
  },
  {
    id: "weight",
    text: "Do you weigh at least 50kg (110lbs)?",
    options: [
      { value: "yes", label: "Yes", disqualifies: false },
      { value: "no", label: "No", disqualifies: true },
    ],
  },
  {
    id: "recent_illness",
    text: "Have you had a major illness, surgery, or infection in the last 6 months?",
    options: [
      { value: "no", label: "No", disqualifies: false },
      { value: "yes", label: "Yes", disqualifies: true },
    ],
  },
  {
    id: "pregnancy",
    text: "Are you currently pregnant, or have you given birth in the last 6 months?",
    options: [
      { value: "no", label: "No / Not applicable", disqualifies: false },
      { value: "yes", label: "Yes", disqualifies: true },
    ],
  },
  {
    id: "malaria_travel",
    text: "Have you traveled to a malaria-risk area in the last 12 months?",
    options: [
      { value: "no", label: "No", disqualifies: false },
      { value: "yes", label: "Yes", disqualifies: true },
    ],
  },
];
