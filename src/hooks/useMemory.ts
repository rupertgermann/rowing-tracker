import { useState, useEffect, useCallback } from 'react';
import { 
  memoryStorage, 
  MemoryDocument, 
  MemoryDocumentType,
  MEMORY_CONFIG 
} from '@/lib/memoryStorage';
import { processDocument, processPDF, processImage } from '@/lib/documentProcessor';
import { trainingPlans } from '@/lib/trainingPlans';

export interface MemoryState {
  documents: MemoryDocument[];
  isLoading: boolean;
  error: string | null;
  uploadProgress: number | null;
}

export interface StorageStats {
  totalSize: number;
  remainingQuota: number;
  documentCount: number;
  byType: Record<MemoryDocumentType, number>;
}

export function useMemory() {
  const [state, setState] = useState<MemoryState>({
    documents: [],
    isLoading: true,
    error: null,
    uploadProgress: null,
  });

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const documents = await memoryStorage.getAllDocuments();
      const stats = await memoryStorage.getStorageStats();
      
      setState(prev => ({
        ...prev,
        documents,
        isLoading: false,
      }));
      setStorageStats(stats);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load documents',
      }));
    }
  }, []);

  // Upload a document
  const uploadDocument = useCallback(async (
    file: File,
    options?: { description?: string; tags?: string[] }
  ): Promise<MemoryDocument | null> => {
    setState(prev => ({ ...prev, uploadProgress: 0, error: null }));

    try {
      // Validate file size
      if (file.size > MEMORY_CONFIG.maxFileSize) {
        throw new Error(`File too large. Maximum size is ${MEMORY_CONFIG.maxFileSize / 1024 / 1024}MB`);
      }

      setState(prev => ({ ...prev, uploadProgress: 20 }));

      // Process the document (resize images, extract text)
      let extractedText: string | undefined;
      
      if (file.type === 'application/pdf') {
        setState(prev => ({ ...prev, uploadProgress: 40 }));
        const processed = await processPDF(file);
        extractedText = processed.extractedText;
      } else if (file.type.startsWith('image/')) {
        setState(prev => ({ ...prev, uploadProgress: 40 }));
        const processed = await processImage(file);
        extractedText = processed.extractedText;
      }

      setState(prev => ({ ...prev, uploadProgress: 60 }));

      // Add to storage
      const document = await memoryStorage.addDocument(file, options);

      // Update extracted text if we have it
      if (extractedText) {
        await memoryStorage.updateDocument(document.id, { extractedText });
        document.extractedText = extractedText;
      }

      setState(prev => ({ ...prev, uploadProgress: 100 }));

      // Reload documents
      await loadDocuments();

      setState(prev => ({ ...prev, uploadProgress: null }));

      return document;
    } catch (error) {
      setState(prev => ({
        ...prev,
        uploadProgress: null,
        error: error instanceof Error ? error.message : 'Failed to upload document',
      }));
      return null;
    }
  }, [loadDocuments]);

  // Upload multiple documents
  const uploadDocuments = useCallback(async (
    files: File[],
    options?: { description?: string; tags?: string[] }
  ): Promise<MemoryDocument[]> => {
    const results: MemoryDocument[] = [];

    for (const file of files) {
      const doc = await uploadDocument(file, options);
      if (doc) {
        results.push(doc);
      }
    }

    return results;
  }, [uploadDocument]);

  // Delete a document
  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await memoryStorage.deleteDocument(id);
      if (success) {
        await loadDocuments();
      }
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete document',
      }));
      return false;
    }
  }, [loadDocuments]);

  // Update a document
  const updateDocument = useCallback(async (
    id: string,
    updates: Partial<Pick<MemoryDocument, 'name' | 'description' | 'tags'>>
  ): Promise<MemoryDocument | null> => {
    try {
      const updated = await memoryStorage.updateDocument(id, updates);
      if (updated) {
        await loadDocuments();
      }
      return updated;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update document',
      }));
      return null;
    }
  }, [loadDocuments]);

  // Search documents
  const searchDocuments = useCallback(async (query: string): Promise<MemoryDocument[]> => {
    if (!query.trim()) {
      return state.documents;
    }
    return memoryStorage.searchDocuments(query);
  }, [state.documents]);

  // Filter by type
  const filterByType = useCallback(async (type: MemoryDocumentType): Promise<MemoryDocument[]> => {
    return memoryStorage.filterByType(type);
  }, []);

  // Filter by source
  const filterBySource = useCallback(async (source: 'user' | 'system'): Promise<MemoryDocument[]> => {
    return memoryStorage.filterBySource(source);
  }, []);

  // Get document blob (for viewing/downloading)
  const getDocumentBlob = useCallback(async (id: string): Promise<Blob | null> => {
    const arrayBuffer = await memoryStorage.getDocumentBlob(id);
    if (!arrayBuffer) return null;

    const doc = await memoryStorage.getDocument(id);
    if (!doc) return null;

    return new Blob([arrayBuffer], { type: doc.mimeType });
  }, []);

  // Get document URL for preview
  const getDocumentUrl = useCallback(async (id: string): Promise<string | null> => {
    const blob = await getDocumentBlob(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [getDocumentBlob]);

  // Export memory
  const exportMemory = useCallback(async (): Promise<Blob> => {
    return memoryStorage.exportMemory();
  }, []);

  // Import memory
  const importMemory = useCallback(async (data: Blob): Promise<{ success: boolean; imported: number }> => {
    const result = await memoryStorage.importMemory(data);
    if (result.success) {
      await loadDocuments();
    }
    return result;
  }, [loadDocuments]);

  // Clear all documents
  const clearAll = useCallback(async (): Promise<void> => {
    await memoryStorage.clearAll();
    await loadDocuments();
  }, [loadDocuments]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Check if a document is orphaned (source data no longer exists)
  const isOrphanedDocument = useCallback((doc: MemoryDocument): boolean => {
    if (doc.source !== 'system') return false;

    // For training plans, we can't check synchronously anymore since getPlans is async
    // Mark them as not orphaned by default - they'll be cleaned up manually if needed
    if (doc.type === 'training_plan') {
      return false;
    }

    // For insights, we can't easily check if they're orphaned without
    // accessing the insights storage, so we'll mark old ones (>30 days)
    if (doc.type === 'insight') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(doc.uploadedAt) < thirtyDaysAgo;
    }

    return false;
  }, []);

  // Get orphaned documents
  const getOrphanedDocuments = useCallback((): MemoryDocument[] => {
    return state.documents.filter(isOrphanedDocument);
  }, [state.documents, isOrphanedDocument]);

  // Computed values
  const userDocuments = state.documents.filter(d => d.source === 'user');
  const systemDocuments = state.documents.filter(d => d.source === 'system');
  const activeTrainingPlan = state.documents.find(
    d => d.type === 'training_plan' && d.status === 'active'
  );
  const orphanedDocuments = getOrphanedDocuments();

  return {
    // State
    ...state,
    storageStats,

    // Actions
    loadDocuments,
    uploadDocument,
    uploadDocuments,
    deleteDocument,
    updateDocument,
    searchDocuments,
    filterByType,
    filterBySource,
    getDocumentBlob,
    getDocumentUrl,
    exportMemory,
    importMemory,
    clearAll,
    clearError,

    // Computed
    userDocuments,
    systemDocuments,
    activeTrainingPlan,
    orphanedDocuments,
    isOrphanedDocument,
    hasDocuments: state.documents.length > 0,
    isQuotaExceeded: storageStats 
      ? storageStats.remainingQuota < MEMORY_CONFIG.maxFileSize 
      : false,
  };
}
