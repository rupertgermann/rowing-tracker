import { openDB, DBSchema, IDBPDatabase } from 'idb';

// =============================================================================
// FILESYSTEM-BASED IMAGE STORAGE (New approach)
// Images are stored as real files in public/assets/awards/
// =============================================================================

/**
 * Get the public URL path for an award image
 */
export function getAwardImagePath(awardId: string): string {
  const safeAwardId = awardId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `/assets/awards/${safeAwardId}.png`;
}

/**
 * Store an achievement image to the filesystem via API
 */
export async function storeAchievementImage(awardId: string, imageData: string): Promise<string> {
  const response = await fetch('/api/achievements/image/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ awardId, imageData })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to save image');
  }

  const data = await response.json();
  return data.filePath;
}

/**
 * Check if an achievement image exists on the filesystem
 * Returns the image URL if it exists, null otherwise
 */
export async function getAchievementImage(awardId: string): Promise<string | null> {
  const imagePath = getAwardImagePath(awardId);
  
  try {
    // Check if the image exists by making a HEAD request
    const response = await fetch(imagePath, { method: 'HEAD' });
    if (response.ok) {
      return imagePath;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete an achievement image from the filesystem via API
 */
export async function deleteAchievementImage(awardId: string): Promise<void> {
  try {
    await fetch('/api/achievements/image/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awardId })
    });
  } catch (error) {
    console.error('Failed to delete achievement image:', error);
  }
}

// =============================================================================
// INDEXEDDB LEGACY STORAGE (For migration purposes only)
// These functions are kept to read existing images from IndexedDB during migration
// =============================================================================

interface AchievementImageDB extends DBSchema {
  images: {
    key: string; // awardId
    value: {
      awardId: string;
      imageData: string; // base64 data URL
      createdAt: Date;
    };
  };
}

const DB_NAME = 'rowing-achievement-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbPromise: Promise<IDBPDatabase<AchievementImageDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AchievementImageDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AchievementImageDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'awardId' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get an image from IndexedDB (legacy - for migration)
 */
export async function getAchievementImageFromIndexedDB(awardId: string): Promise<string | null> {
  try {
    const db = await getDB();
    const record = await db.get(STORE_NAME, awardId);
    return record?.imageData || null;
  } catch (error) {
    console.error('Failed to get achievement image from IndexedDB:', error);
    return null;
  }
}

/**
 * Get all stored achievement image IDs from IndexedDB (legacy - for migration)
 */
export async function getAllAchievementImageIdsFromIndexedDB(): Promise<string[]> {
  try {
    const db = await getDB();
    return await db.getAllKeys(STORE_NAME);
  } catch (error) {
    console.error('Failed to get achievement image IDs from IndexedDB:', error);
    return [];
  }
}

/**
 * Delete an image from IndexedDB (legacy - for migration cleanup)
 */
export async function deleteAchievementImageFromIndexedDB(awardId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, awardId);
  } catch (error) {
    console.error('Failed to delete achievement image from IndexedDB:', error);
  }
}

/**
 * Clear all achievement images from IndexedDB (legacy - for migration cleanup)
 */
export async function clearAllAchievementImagesFromIndexedDB(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Failed to clear achievement images from IndexedDB:', error);
  }
}

/**
 * Migrate all images from IndexedDB to filesystem
 * Returns the number of images migrated
 */
export async function migrateImagesFromIndexedDB(): Promise<{
  migrated: number;
  failed: string[];
  total: number;
}> {
  const awardIds = await getAllAchievementImageIdsFromIndexedDB();
  const failed: string[] = [];
  let migrated = 0;

  for (const awardId of awardIds) {
    try {
      const imageData = await getAchievementImageFromIndexedDB(awardId);
      if (imageData) {
        await storeAchievementImage(awardId, imageData);
        await deleteAchievementImageFromIndexedDB(awardId);
        migrated++;
      }
    } catch (error) {
      console.error(`Failed to migrate image for ${awardId}:`, error);
      failed.push(awardId);
    }
  }

  return { migrated, failed, total: awardIds.length };
}
