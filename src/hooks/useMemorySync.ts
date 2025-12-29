import { useEffect, useState, useCallback } from 'react';
import { fetchMemoryDocumentsFromDB, saveMemoryDocumentsToDB, deleteMemoryDocumentFromDB, MemoryDocumentData } from '@/lib/memorySync';

/**
 * Hook for managing memory documents with database sync
 * Falls back to IndexedDB if database is unavailable
 */
export function useMemorySync() {
  const [documents, setDocuments] = useState<MemoryDocumentData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to fetch from database first
        const dbDocuments = await fetchMemoryDocumentsFromDB();
        
        if (dbDocuments) {
          setDocuments(dbDocuments);
        } else {
          // Fallback to IndexedDB if database unavailable
          console.warn('Database unavailable, falling back to IndexedDB');
          setError('Database unavailable, using local storage');
        }
      } catch (err) {
        console.error('Error loading memory documents:', err);
        setError('Failed to load memory documents');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  // Save documents to database
  const saveDocuments = useCallback(async (docs: MemoryDocumentData[]) => {
    try {
      setError(null);
      
      // Update local state immediately for better UX
      setDocuments(docs);

      // Save to database asynchronously
      const result = await saveMemoryDocumentsToDB(docs);
      if (!result.success) {
        setError('Failed to save memory documents to server');
      }
    } catch (err) {
      console.error('Error saving memory documents:', err);
      setError('Failed to save memory documents');
    }
  }, []);

  // Add a document
  const addDocument = useCallback(async (doc: MemoryDocumentData) => {
    const updated = documents ? [...documents, doc] : [doc];
    await saveDocuments(updated);
  }, [documents, saveDocuments]);

  // Update a document
  const updateDocument = useCallback(async (docId: string, updates: Partial<MemoryDocumentData>) => {
    if (!documents) return;
    
    const updated = documents.map(doc => 
      doc.id === docId ? { ...doc, ...updates } : doc
    );
    await saveDocuments(updated);
  }, [documents, saveDocuments]);

  // Delete a document
  const deleteDocument = useCallback(async (docId: string) => {
    try {
      setError(null);
      
      // Delete from database
      const success = await deleteMemoryDocumentFromDB(docId);
      
      if (success) {
        // Update local state
        setDocuments(documents ? documents.filter(doc => doc.id !== docId) : null);
      } else {
        setError('Failed to delete memory document');
      }
    } catch (err) {
      console.error('Error deleting memory document:', err);
      setError('Failed to delete memory document');
    }
  }, [documents]);

  return {
    documents,
    isLoading,
    error,
    addDocument,
    updateDocument,
    deleteDocument,
    saveDocuments,
  };
}
