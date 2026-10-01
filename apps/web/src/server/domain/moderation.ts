export type ModerationState = "PENDING_AI" | "PENDING_HUMAN" | "PUBLISHED";
export function initialReviewState(isOwner: boolean, aiConfigured: boolean): ModerationState {
  return isOwner ? "PUBLISHED" : aiConfigured ? "PENDING_AI" : "PENDING_HUMAN";
}
export function canApplyReview(currentVersion: number, reviewedVersion: number, state: string, eligible: boolean) {
  return eligible && currentVersion === reviewedVersion && state === "PENDING_AI";
}
