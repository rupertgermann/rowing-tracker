# Plan: Ensure achievement image prompt sent to OpenAI includes server-side additions

## Goal
Guarantee that the OpenAI Images API receives the fully assembled prompt (base/custom prompt with placeholders replaced, + title visibility instruction, + optional story/background guidance). Also provide a way to verify the exact prompt being sent.

## Context (current flow)
- Frontend (`AchievementCard` / `AchievementGallery`) POSTs to `/api/achievements/image` with `title`, `description`, `customPrompt` (from settings), `model`, `quality`, `size`, optional `story`.
- API route (`src/app/api/achievements/image/route.ts`) builds `prompt` = (`customPrompt` or `defaultPrompt`) with `{title}`/`{description}` replacements, then appends title visibility text and story/background instructions before calling OpenAI.
- User currently only sees the request body JSON, not the final assembled prompt.

## Plan
1) Confirm where the request payload originates
   - Double-check `AchievementCard` and `AchievementGallery` fetch bodies to ensure they pass the intended custom prompt and story.

2) Expose/return the final assembled prompt for verification
   - Update the API response to include the exact prompt sent to OpenAI (e.g., `sentPrompt`) so clients/devtools can inspect it without extra logging.
   - Optionally add a minimal dev-only log guard (`if (process.env.NODE_ENV === 'development')`) to avoid leaking prompt content in production logs.

3) Keep OpenAI call unchanged aside from the additional response field
   - Ensure no change to image generation parameters; only surfacing the final prompt for visibility.

4) Testing
   - Generate an image with and without a story to verify `sentPrompt` contains the appended sections.
   - Verify that unsupported sizes still error early (size validation already present).

5) Cleanup (if needed)
   - Remove/guard existing `console.log` statements in the image route if they are no longer desired.

## Debug follow-up
- If story text is missing in `sentPrompt`, validate story flow end-to-end:
  - Log (dev-only) the incoming `story` value and its trimmed length in the API.
  - Confirm which client path is calling the endpoint (Card vs Gallery) and whether they attach `story`.
  - Add a short-term dev-only log of `sentPrompt` (already available via response) to compare with `story`.
