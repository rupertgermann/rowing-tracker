/**
 * Migration script to update achievement image prompts in the database
 * Replaces hardcoded colors with {colors} placeholder
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAchievementPrompts() {
  console.log('Starting achievement prompt migration...');

  try {
    // Get all users with settings
    const users = await prisma.userSettings.findMany({
      select: {
        userId: true,
        aiConfig: true,
      },
    });

    console.log(`Found ${users.length} user settings to check`);

    let updatedCount = 0;

    for (const user of users) {
      if (!user.aiConfig) continue;

      const aiConfig = user.aiConfig as any;
      
      // Check if achievementImagePrompt exists and has old colors
      if (aiConfig.achievementImagePrompt && 
          typeof aiConfig.achievementImagePrompt === 'string' &&
          aiConfig.achievementImagePrompt.includes('deep blues, golds, and whites')) {
        
        // Replace the old hardcoded colors with {colors} placeholder
        const updatedPrompt = aiConfig.achievementImagePrompt.replace(
          /Use a color palette of deep blues, golds, and whites/gi,
          'Use a color palette of {colors}'
        );

        aiConfig.achievementImagePrompt = updatedPrompt;

        // Update the database
        await prisma.userSettings.update({
          where: { userId: user.userId },
          data: { aiConfig: aiConfig },
        });

        console.log(`✓ Updated prompt for user ${user.userId}`);
        updatedCount++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`Updated ${updatedCount} user(s)`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateAchievementPrompts()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
