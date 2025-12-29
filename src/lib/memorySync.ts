/**
 * Memory Document Synchronization with Database
 * Provides async methods to fetch and save memory documents from/to the database API
 */

export interface MemoryDocumentData {
  id: string;
  name: string;
  type: string;
  source: string;
  mimeType: string;
  size: number;
  description?: string;
  extractedText?: string;
  tags?: string[];
  content?: Record<string, unknown>;
  status?: string;
  uploadedAt: Date;
  blobData?: string; // Base64 encoded blob data
}

/**
 * Fetch all memory documents from database
 */
export async function fetchMemoryDocumentsFromDB(): Promise<MemoryDocumentData[] | null> {
  try {
    const response = await fetch('/api/memory', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to fetch memory documents:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.documents || null;
  } catch (error) {
    console.error('Error fetching memory documents from database:', error);
    return null;
  }
}

/**
 * Save memory documents to database
 */
export async function saveMemoryDocumentsToDB(documents: MemoryDocumentData[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });

    if (!response.ok) {
      console.error('Failed to save memory documents:', response.statusText);
      return { success: false, count: 0, error: response.statusText };
    }

    const data = await response.json();
    return { success: true, count: data.count || 0 };
  } catch (error) {
    console.error('Error saving memory documents to database:', error);
    return { success: false, count: 0, error: String(error) };
  }
}

/**
 * Delete a memory document from database
 */
export async function deleteMemoryDocumentFromDB(documentId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    });

    if (!response.ok) {
      console.error('Failed to delete memory document:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting memory document from database:', error);
    return false;
  }
}

/**
 * Migrate memory documents from IndexedDB to database
 * Fetches all documents from IndexedDB, converts blobs to base64, and saves to database
 */
export async function migrateMemoryDocumentsToDatabase(
  memoryStorage: any
): Promise<{ success: boolean; migrated: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let migrated = 0;
  let failed = 0;

  try {
    // Fetch all documents from IndexedDB
    const documents = await memoryStorage.getAllDocuments();

    if (!documents || documents.length === 0) {
      return { success: true, migrated: 0, failed: 0, errors: [] };
    }

    const documentsToMigrate: MemoryDocumentData[] = [];

    for (const doc of documents) {
      try {
        // Get blob data if it's a user document
        let blobData: string | undefined;
        if (doc.source === 'user') {
          const blob = await memoryStorage.getDocumentBlob(doc.id);
          if (blob) {
            // Convert ArrayBuffer to base64
            blobData = arrayBufferToBase64(blob);
          }
        }

        documentsToMigrate.push({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          source: doc.source,
          mimeType: doc.mimeType,
          size: doc.size,
          description: doc.description,
          extractedText: doc.extractedText,
          tags: doc.tags,
          content: doc.content,
          status: doc.status,
          uploadedAt: new Date(doc.uploadedAt),
          blobData,
        });
      } catch (error) {
        failed++;
        errors.push(`Document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Save to database
    if (documentsToMigrate.length > 0) {
      const result = await saveMemoryDocumentsToDB(documentsToMigrate);
      if (result.success) {
        migrated = result.count;
      } else {
        failed += documentsToMigrate.length;
        errors.push(`Database save failed: ${result.error}`);
      }
    }

    return { success: errors.length === 0, migrated, failed, errors };
  } catch (error) {
    console.error('Error migrating memory documents:', error);
    return {
      success: false,
      migrated,
      failed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Helper function to convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper function to convert base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
