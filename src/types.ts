export type PromptStyle = "numbered" | "cursor-only";

export type PromptOption = {
  readonly index: number;
  readonly label: string;
  readonly hasCursor: boolean;
};

export type PromptView = {
  readonly style: PromptStyle;
  readonly questionLine: string;
  readonly options: readonly PromptOption[];
  readonly contextLines: readonly string[];
  readonly fingerprint: string;
};

export type ResponsePlan =
  | { readonly kind: "digit"; readonly keys: readonly string[] }
  | { readonly kind: "arrows"; readonly keys: readonly string[] };

export type AutoAnswerState =
  | { readonly kind: "idle" }
  | { readonly kind: "candidate"; readonly prompt: PromptView; readonly stableCount: number }
  | { readonly kind: "waitClear"; readonly prompt: PromptView; readonly sentAt: number; readonly escalations: number };

export type AutoAnswerEvent =
  | { readonly kind: "scan"; readonly prompt: PromptView | null; readonly now: number };

export type AutoAnswerEffect =
  | { readonly kind: "sendKeys"; readonly keys: readonly string[]; readonly prompt: PromptView }
  | { readonly kind: "escalate"; readonly keys: readonly string[]; readonly prompt: PromptView }
  | { readonly kind: "escalationFailed"; readonly prompt: PromptView };

export type AutoAnswerReduceResult = {
  readonly state: AutoAnswerState;
  readonly effects: readonly AutoAnswerEffect[];
};
