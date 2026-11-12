/** Personal BYOK is an explicit build-time opt-in; hosted AI remains unavailable. */
export function isPersonalAIEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_MODE === 'personal';
}
