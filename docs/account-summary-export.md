# Account summary download

Settings → Data Management → **Download account summary (JSON)** calls the authenticated `GET /api/user/export` endpoint. This is an explicitly limited summary, **not a backup or portable archive**. There is no account restore/import function. The separate settings import accepts settings only, not this account summary.

Before deleting an account or clearing data, keep original files separately. An exported summary cannot restore the account; deletion permanently removes information it omits. Image URLs in the download are references, not embedded images, and may stop working after deletion. The app currently has an account-deletion API but no account-deletion screen.

The response is an attachment named `rowing-tracker-summary-YYYY-MM-DD.json`. Its `exportFormat` identifies it as a limited summary, `exportedAt` records the export time, and `exportScope` lists included/excluded categories, a loss warning, and `restoreSupported: false`. It contains the authenticated user's server-saved records only; absent settings remain `null`, empty categories remain arrays. It is not an atomic snapshot across categories.

## Included JSON fields

| Category | Contents |
| --- | --- |
| `user` | `id`, `email`, `name`, `role`, `emailVerified`, `createdAt`, `updatedAt` |
| `settings` | All stored scalar/JSON `UserSettings` fields; no related user or API key records |
| `rowingSessions` | All stored scalar `RowingSession` fields, plus `strokeData` limited to `timestamp`, `strokeIndex`, `split`, `power`, `strokeRate`, `distance`, `heartRate` |
| `personalRecords` | All stored scalar `PersonalRecord` fields |
| `earnedAwards` | All stored scalar `EarnedAward` fields |
| `trainingPlans` | All stored scalar `TrainingPlan` fields and nested `weeks` (`TrainingWeek`), `sessions` (`TrainingSession`), and `actualSessionLinks` (`TrainingSessionLink`) scalar fields |
| `chatSessions` | `id`, `title`, `category`, `createdAt`, `updatedAt`; `messages` with `role`, `content`, `timestamp` |
| `aiInsights` | All stored scalar/JSON `AIInsight` fields |
| `generatedAchievements` | `id`, `awardId`, `story`, `imageUrl`, `hasImage`, `earnedAt`, `generatedAt` |
| `memoryDocuments` | `id`, `name`, `type`, `size`, `extractedText`, `uploadedAt` |
| `statistics` | `totalRowingSessions`, `totalDistance`, `totalDuration`, `totalPersonalRecords`, `totalAwards`, `totalTrainingPlans`, `totalChatMessages` |

“All stored scalar/JSON fields” refers to the corresponding model in `prisma/schema.prisma`; relations are excluded unless explicitly listed above. This summary follows the current application schema and is not a versioned restore format.

## Excluded

- All Mocap sessions, pose streams, videos, posture metrics and faults.
- File contents: uploads, original workout files, avatars and achievement images.
- Other memory fields: `userId`, `source`, `mimeType`, `filePath`, `description`, `tags`, `content`, `status`.
- Other stroke fields: `id`, `sessionId`, `time`, `work`, `avgPower`, `avgSplit`, `strokeLength`.
- Other chat/message metadata, related records not explicitly listed, credentials, API keys and authentication records.
- Browser-only records/preferences that have not been saved to the server.

`tests/accountSummaryExport.test.ts` executes the export route with populated database-boundary fixtures for every category and every schema scalar. It verifies transformed field sets, full-record categories, nested plans, statistics, attachment naming, user scoping and scope metadata. The browser test exercises the download disclosure and clear-data cancellation using intercepted APIs; it never deletes an account.
