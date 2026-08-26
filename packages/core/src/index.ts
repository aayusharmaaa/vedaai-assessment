/**
 * @veda/core — the assessment engine.
 *
 * Everything here is pure TypeScript with no React, Next or DOM dependency, so
 * it can be exercised directly by `node --test` and reused by anything that is
 * not a browser. The web app consumes it through this entry point.
 *
 * The boundary is deliberate: the parts most worth testing (label matching,
 * page stitching, model-output coercion, API failover) are the parts with no
 * UI attached.
 */

export type {
  AnswerBlock,
  AssessmentResult,
  BBox,
  ExtractedQuestion,
  Grade,
  MappedResult,
  MappingMethod,
  MappingStatus,
  OverallSummary,
  PageImage,
  ProgressState,
  Region,
  Stage,
  UnmatchedAnswer,
} from "./types.ts";

export {
  buildResults,
  matchByLabel,
  normalizeLabel,
  numericPart,
  stitchBlocks,
  subPart,
  type LabelMatchOutcome,
  type SemanticMatch,
} from "./mapping.ts";

export {
  boxToBBox,
  normalizeBlocks,
  normalizeQuestions,
  qualifySubPart,
} from "./normalize.ts";

export {
  ANSWER_SYSTEM,
  answerPrompt,
  GRADING_SYSTEM,
  gradingPrompt,
  MAPPING_SYSTEM,
  mappingPrompt,
  QUESTION_PROMPT,
  QUESTION_SYSTEM,
} from "./prompts.ts";

export {
  apiKeys,
  callGemini,
  dataUrlToInline,
  DEFAULT_MODEL,
  GeminiError,
  hasApiKey,
  isDailyQuotaError,
  isModelUnavailable,
  MODEL_CHAIN,
  parseJson,
  pool,
  takeUsage,
  type TokenUsage,
} from "./gemini.ts";
