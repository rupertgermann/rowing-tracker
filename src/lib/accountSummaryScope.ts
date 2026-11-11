/** Shared disclosure for the account summary download and its artifact. */
export const accountSummaryScope = {
  restoreSupported: false,
  warning: 'This is a limited summary, not a backup. It cannot restore your account. Deleting your account permanently removes data that this download omits. Keep original files separately before deleting anything.',
  included: {
    user: 'Profile: ID, email, name, role, verification date and creation/update dates',
    settings: 'Server-saved settings',
    rowingSessions: 'Rowing session records, with selected stroke fields: timestamp, stroke index, split, power, stroke rate, distance and heart rate',
    personalRecords: 'Personal records',
    earnedAwards: 'Earned awards',
    trainingPlans: 'Training plans, weeks, sessions and workout links',
    chatSessions: 'Chat titles, categories and dates, with message role, content and timestamp',
    aiInsights: 'AI insights',
    generatedAchievements: 'Achievement IDs, stories, image URLs/availability and dates; image files are not included',
    memoryDocuments: 'Memory document IDs, names, types, sizes, extracted text and upload dates',
    statistics: 'Counts of sessions, personal records, awards, plans and chat messages; total distance and duration',
  },
  excluded: [
    'Mocap sessions, pose streams, video, posture metrics and faults',
    'Uploaded files, original workout files, avatars and achievement image files; URLs are references only and may stop working after deletion',
    'Other memory fields, including structured content, descriptions, tags, source, MIME type, status and file paths',
    'Other stroke fields: IDs, time, work, average power, average split and stroke length',
    'Other profile and chat/message metadata and related records not listed above',
    'Credentials, API keys and authentication records',
    'Browser-only data and preferences that have not been saved to the server',
  ],
};
