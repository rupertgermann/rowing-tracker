import { openDB, DBSchema, IDBPDatabase } from 'idb';

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
 * Store an achievement image in IndexedDB
 */
export async function storeAchievementImage(awardId: string, imageData: string): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, {
      awardId,
      imageData,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to store achievement image:', error);
    throw error;
  }
}

/**
 * Retrieve an achievement image from IndexedDB
 */
export async function getAchievementImage(awardId: string): Promise<string | null> {
  try {
    const db = await getDB();
    const record = await db.get(STORE_NAME, awardId);
    return record?.imageData || null;
  } catch (error) {
    console.error('Failed to get achievement image:', error);
    return null;
  }
}

/**
 * Delete an achievement image from IndexedDB
 */
export async function deleteAchievementImage(awardId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, awardId);
  } catch (error) {
    console.error('Failed to delete achievement image:', error);
  }
}

/**
 * Get all stored achievement image IDs
 */
export async function getAllAchievementImageIds(): Promise<string[]> {
  try {
    const db = await getDB();
    return await db.getAllKeys(STORE_NAME);
  } catch (error) {
    console.error('Failed to get achievement image IDs:', error);
    return [];
  }
}

/**
 * Clear all achievement images from IndexedDB
 */
export async function clearAllAchievementImages(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Failed to clear achievement images:', error);
  }
}
