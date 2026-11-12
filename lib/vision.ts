const VISION_PATTERN =
  /(llama-4|llama_4|pixtral|gpt-4o|gpt-4\.1|gpt-5|gemini|vision|-vl-|vl-|qwen.*vl|internvl|claude|glm-4|o3\b|o4\b|mistral.*(vision|large))/i;

export function supportsVision(modelId: string | null | undefined): boolean {
  if (!modelId) return true;
  return VISION_PATTERN.test(modelId);
}
