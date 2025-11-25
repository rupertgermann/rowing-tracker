'use client';

import { useState, useRef, useCallback } from 'react';
import { useMemory } from '@/hooks/useMemory';
import { MemoryDocument, MemoryDocumentType, MEMORY_CONFIG } from '@/lib/memoryStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Brain,
  Lightbulb,
  StickyNote,
  Trash2,
  Download,
  Search,
  X,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  Calendar,
} from 'lucide-react';

// ============================================================================
// Document Type Icons & Labels
// ============================================================================

const documentTypeConfig: Record<MemoryDocumentType, { icon: React.ElementType; label: string; color: string }> = {
  image: { icon: ImageIcon, label: 'Image', color: 'bg-blue-500/10 text-blue-500' },
  pdf: { icon: FileText, label: 'PDF', color: 'bg-red-500/10 text-red-500' },
  training_plan: { icon: Brain, label: 'Training Plan', color: 'bg-purple-500/10 text-purple-500' },
  insight: { icon: Lightbulb, label: 'Insight', color: 'bg-yellow-500/10 text-yellow-500' },
  note: { icon: StickyNote, label: 'Note', color: 'bg-green-500/10 text-green-500' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

// ============================================================================
// Document Card Component
// ============================================================================

interface DocumentCardProps {
  document: MemoryDocument;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}

function DocumentCard({ document, onDelete, onView }: DocumentCardProps) {
  const config = documentTypeConfig[document.type];
  const Icon = config.icon;

  return (
    <div className="group relative flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      {/* Icon */}
      <div className={`flex-shrink-0 p-2 rounded-lg ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{document.name}</h4>
          {document.status === 'active' && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
              Active
            </Badge>
          )}
        </div>
        
        {document.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {document.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(document.uploadedAt)}
          </span>
          <span>•</span>
          <span>{formatBytes(document.size)}</span>
          <span>•</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {document.source === 'user' ? 'Uploaded' : 'System'}
          </Badge>
        </div>

        {document.tags && document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {document.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {document.source === 'user' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onView(document.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(document.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Storage Quota Bar
// ============================================================================

interface StorageQuotaProps {
  used: number;
  total: number;
}

function StorageQuota({ used, total }: StorageQuotaProps) {
  const percentage = Math.min((used / total) * 100, 100);
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="h-4 w-4" />
          Storage
        </span>
        <span className={isCritical ? 'text-destructive' : isWarning ? 'text-yellow-500' : ''}>
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isCritical ? 'bg-destructive' : isWarning ? 'bg-yellow-500' : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Upload Dropzone
// ============================================================================

interface UploadDropzoneProps {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  progress: number | null;
}

function UploadDropzone({ onUpload, isUploading, progress }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onUpload(files);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onUpload(files);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onUpload]);

  const acceptedTypes = [
    ...MEMORY_CONFIG.supportedImageTypes,
    ...MEMORY_CONFIG.supportedPdfTypes,
  ].join(',');

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      {isUploading ? (
        <div className="space-y-3">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Uploading... {progress !== null && `${progress}%`}
          </p>
        </div>
      ) : (
        <>
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">
            Drop files here or{' '}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Supports JPEG, PNG, GIF, WebP, PDF (max {MEMORY_CONFIG.maxFileSize / 1024 / 1024}MB)
          </p>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main Memory Manager Component
// ============================================================================

interface MemoryManagerProps {
  onClose?: () => void;
}

export function MemoryManager({ onClose }: MemoryManagerProps) {
  const {
    documents,
    isLoading,
    error,
    uploadProgress,
    storageStats,
    uploadDocuments,
    deleteDocument,
    getDocumentUrl,
    exportMemory,
    clearError,
  } = useMemory();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MemoryDocumentType | 'all'>('all');
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  // Handle file upload
  const handleUpload = async (files: File[]) => {
    await uploadDocuments(files);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(id);
    }
  };

  // Handle view
  const handleView = async (id: string) => {
    const url = await getDocumentUrl(id);
    if (url) {
      setViewingDocId(id);
      setViewingUrl(url);
    }
  };

  // Close preview
  const closePreview = () => {
    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl);
    }
    setViewingDocId(null);
    setViewingUrl(null);
  };

  // Handle export
  const handleExport = async () => {
    const blob = await exportMemory();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rowing-memory-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Coach Memory
            </CardTitle>
            <CardDescription>
              Documents and knowledge accessible to your AI coach
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4 pt-4">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearError}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Storage Quota */}
        {storageStats && (
          <StorageQuota
            used={storageStats.totalSize}
            total={MEMORY_CONFIG.maxTotalStorage}
          />
        )}

        {/* Upload Zone */}
        <UploadDropzone
          onUpload={handleUpload}
          isUploading={uploadProgress !== null}
          progress={uploadProgress}
        />

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MemoryDocumentType | 'all')}
            className="h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="pdf">PDFs</option>
            <option value="training_plan">Training Plans</option>
            <option value="insight">Insights</option>
            <option value="note">Notes</option>
          </select>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No documents yet</p>
              <p className="text-sm mt-1">
                Upload PDFs or images to add to your coach&apos;s memory
              </p>
            </div>
          ) : (
            filteredDocuments.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={handleDelete}
                onView={handleView}
              />
            ))
          )}
        </div>

        {/* Footer Actions */}
        {documents.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </span>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        )}
      </CardContent>

      {/* Document Preview Modal */}
      {viewingUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full bg-background rounded-lg overflow-hidden">
            <div className="absolute top-2 right-2 z-10">
              <Button variant="secondary" size="icon" onClick={closePreview}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {viewingDocId && documents.find(d => d.id === viewingDocId)?.type === 'image' ? (
              <img
                src={viewingUrl}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <iframe
                src={viewingUrl}
                className="w-full h-[80vh]"
                title="Document Preview"
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default MemoryManager;
