import { editableCapabilities, type EditableCapability } from "./permissions";
export const featureKeys = editableCapabilities.filter(
  (key): key is Exclude<EditableCapability, "music.submit"> => key !== "music.submit",
);
export type FeatureKey = (typeof featureKeys)[number];
export function isFeatureKey(value: unknown): value is FeatureKey {
  return featureKeys.some((key) => key === value);
}
