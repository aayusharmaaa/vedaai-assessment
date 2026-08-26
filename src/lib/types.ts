/**
 * Core domain model for the assessment pipeline:
 * Question Extraction -> Answer Extraction -> Answer Mapping -> Grading
 */

/** A page of a source document, rasterised to an image on the client. */
export interface PageImage {
  /** 0-based index across the whole document set. */
  index: number;
  /** JPEG/PNG data URL used both for the model call and for on-screen display. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * A rectangle in *normalised* page space (0..1, origin top-left).
 * Normalised so it survives zooming and responsive layout without recomputation.
 */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A highlightable slice of the answer sheet. An answer may own several. */
export interface Region {
  /** 0-based page index within the answer sheet. */
  page: number;
  bbox: BBox;
}

export interface ExtractedQuestion {
  /** Stable internal id. */
  id: string;
  /**
   * The number exactly as printed on the paper, including sub-part.
   * e.g. "1", "11(a)", "11(b)", "Q3 (ii)"
   */
  number: string;
  /** Printed order, 0-based. Drives display order regardless of answer order. */
  order: number;
  text: string;
  /** Maximum marks if printed on the paper. */
  maxMarks: number | null;
  /** Parent number for a labelled sub-part, e.g. "11" for "11(a)". */
  parentNumber: string | null;
  /** Section heading if the paper is divided (e.g. "Section A"). */
  section: string | null;
  /** Question style, used to tune grading. */
  kind: "mcq" | "short" | "long" | "diagram" | "numerical" | "other";
}

/** A contiguous block of student writing detected on the answer sheet. */
export interface AnswerBlock {
  id: string;
  /**
   * The question label the student wrote next to the block, verbatim.
   * null when the student wrote no label.
   */
  writtenLabel: string | null;
  /** Transcribed text of the block. */
  text: string;
  /** Every region this block occupies; more than one when it spans pages. */
  regions: Region[];
  /** True when the block is a continuation of the previous page's block. */
  continuesFromPrevious: boolean;
  /**
   * True when the block runs off the bottom of its page unfinished. This is the
   * authoritative cross-page signal: the next page's first unlabelled block
   * continues it.
   */
  continuesOnNextPage: boolean;
  /** True when the block is a drawing/diagram rather than prose. */
  hasDiagram: boolean;
}

export type MappingStatus =
  | "answered"
  | "unanswered"
  /** Student wrote something but explicitly left it blank / struck it out. */
  | "blank";

export type MappingMethod =
  /** Student's written label matched the printed number exactly. */
  | "label"
  /** Label was fuzzy/misnumbered but resolvable. */
  | "label-fuzzy"
  /** No usable label; matched on content. */
  | "semantic"
  /** Filled by position after neighbours were pinned. */
  | "sequence"
  | "none";

export interface Grade {
  awarded: number;
  max: number;
  verdict: "correct" | "partial" | "incorrect" | "ungraded";
  feedback: string;
}

/** One row of the final result: a question plus whatever answered it. */
export interface MappedResult {
  questionId: string;
  answerBlockIds: string[];
  status: MappingStatus;
  method: MappingMethod;
  /** 0..1 — surfaced in the UI when the match is uncertain. */
  confidence: number;
  grade: Grade | null;
}

/** An answer block that could not be attributed to any printed question. */
export interface UnmatchedAnswer {
  answerBlockId: string;
  /** Why it could not be placed, in teacher-readable language. */
  reason: string;
}

export interface OverallSummary {
  totalAwarded: number;
  totalMax: number;
  answeredCount: number;
  unansweredCount: number;
  unmatchedCount: number;
  percentage: number;
  /** AI-written overall remark for the teacher. */
  remark: string;
  strengths: string[];
  improvements: string[];
}

export interface AssessmentResult {
  questions: ExtractedQuestion[];
  answerBlocks: AnswerBlock[];
  results: MappedResult[];
  unmatched: UnmatchedAnswer[];
  summary: OverallSummary;
  /** True when served from bundled sample data rather than a live model call. */
  isMock?: boolean;
}

export type Stage =
  | "idle"
  | "rendering"
  | "questions"
  | "answers"
  | "mapping"
  | "grading"
  | "done"
  | "error";

export interface ProgressState {
  stage: Stage;
  /** 0..100 */
  percent: number;
  label: string;
  detail?: string;
}
