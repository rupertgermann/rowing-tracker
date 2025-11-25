# AI Coach Chat Memory & Document Upload Feature

> **Status: IMPLEMENTED** ✅
> 
> Completed: November 25, 2025

## Overview

Implement persistent document storage (images, PDFs) for the AI coach chat that can be accessed across all chat sessions. This creates a "knowledge base" the AI can reference when providing coaching advice.

---

## Architecture Summary

### Current State
- **Chat Storage**: `ChatStorageService` in `src/lib/chatStorage.ts` - localStorage-based session/message persistence
- **AI Service**: `CloudAIService` in `src/lib/cloudAI.ts` - OpenAI API integration with tool calls
- **Chat Hook**: `useChat` in `src/hooks/useChat.ts` - React state management
- **Chat UI**: `src/app/chat/page.tsx` - Full chat interface

### Proposed Addition
A new **Memory Store** that stores documents independently from chat sessions, making them available to all conversations.

---

## Implementation Plan

### Phase 1: Memory Storage Service

**File**: `src/lib/memoryStorage.ts`

#### 1.1 Define Types
```typescript
export interface MemoryDocument {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  mimeType: string;
  size: number;
  uploadedAt: Date;
  description?: string;        // User-provided context
  extractedText?: string;      // OCR/PDF text extraction
  base64Data?: string;         // For smaller files (<5MB)
  tags?: string[];             // User-defined tags
}

export interface MemoryStore {
  documents: MemoryDocument[];
  totalSize: number;
  lastUpdated: Date;
}
```

#### 1.2 Storage Strategy
- **Small files** (< 2MB): Store base64 in localStorage
- **Large files**: Store in IndexedDB with reference in localStorage
- **Quota management**: Enforce max total storage (e.g., 50MB)

#### 1.3 Core Methods
```typescript
class MemoryStorageService {
  // CRUD
  addDocument(file: File, description?: string): Promise<MemoryDocument>
  getDocument(id: string): MemoryDocument | null
  getAllDocuments(): MemoryDocument[]
  updateDocument(id: string, updates: Partial<MemoryDocument>): void
  deleteDocument(id: string): void
  
  // Search & Filter
  searchDocuments(query: string): MemoryDocument[]
  filterByType(type: 'image' | 'pdf'): MemoryDocument[]
  filterByTags(tags: string[]): MemoryDocument[]
  
  // Storage Management
  getTotalSize(): number
  getRemainingQuota(): number
  exportMemory(): Promise<Blob>
  importMemory(data: Blob): Promise<boolean>
}
```

---

### Phase 2: Document Processing

**File**: `src/lib/documentProcessor.ts`

#### 2.1 Image Processing
- Generate thumbnail for preview
- Resize large images before storage
- Extract metadata (dimensions, format)
- Optional: OCR text extraction (via OpenAI Vision API)

#### 2.2 PDF Processing
- Extract text content using `pdf.js` library
- Generate first-page thumbnail
- Extract metadata (page count, title)

#### 2.3 Dependencies
```json
{
  "pdfjs-dist": "^4.x"
}
```

---

### Phase 3: AI Integration

**File**: Update `src/lib/cloudAI.ts`

#### 3.1 New Tool Definition
```typescript
const memoryTool = {
  type: "function",
  name: "get_memory_documents",
  description: "Retrieve documents from the user's coaching memory. Use this to access training plans, technique guides, screenshots, or any reference material the user has uploaded.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: ["string", "null"],
        description: "Search query to filter documents by name, description, or extracted text"
      },
      type: {
        type: ["string", "null"],
        enum: ["image", "pdf", null],
        description: "Filter by document type"
      },
      includeContent: {
        type: ["boolean", "null"],
        description: "Include full extracted text content (default: false, only summaries)"
      }
    },
    required: ["query", "type", "includeContent"],
    additionalProperties: false
  },
  strict: true
};
```

#### 3.2 Tool Executor
```typescript
private async executeTool(name: string, args: any): Promise<any> {
  if (name === 'get_memory_documents') {
    const { memoryStorage } = await import('@/lib/memoryStorage');
    const docs = memoryStorage.getAllDocuments();
    
    // Apply filters
    let filtered = docs;
    if (args.query) {
      filtered = memoryStorage.searchDocuments(args.query);
    }
    if (args.type) {
      filtered = filtered.filter(d => d.type === args.type);
    }
    
    // Return summaries or full content
    return filtered.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      description: doc.description,
      uploadedAt: doc.uploadedAt,
      text: args.includeContent ? doc.extractedText : doc.extractedText?.slice(0, 200)
    }));
  }
  // ... existing tools
}
```

#### 3.3 System Prompt Update
Add to chat system prompt:
```
MEMORY DOCUMENTS:
The user may upload documents (PDFs, images) to their coaching memory.
- Use get_memory_documents to search for and retrieve these documents.
- Reference uploaded training plans, technique guides, or screenshots when relevant.
- If the user asks about something they've uploaded, search their memory first.
```

---

### Phase 4: UI Components

#### 4.1 Memory Manager Component
**File**: `src/components/MemoryManager.tsx`

Features:
- Document list view with thumbnails
- Upload dropzone (drag & drop)
- Search/filter interface
- Document details panel
- Delete/edit functionality
- Storage quota indicator

#### 4.2 Chat Upload Integration
**File**: Update `src/app/chat/page.tsx`

Add to chat input area:
- Paperclip icon button for file upload
- Support for drag & drop onto chat area
- Preview of uploaded files before sending
- Option to "Add to Memory" for permanent storage

#### 4.3 Memory Sidebar/Modal
- Accessible from chat page via "Memory" button
- Shows all stored documents
- Quick search functionality

---

### Phase 5: React Hook

**File**: `src/hooks/useMemory.ts`

```typescript
export function useMemory() {
  const [documents, setDocuments] = useState<MemoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  return {
    documents,
    isLoading,
    error,
    
    // Actions
    uploadDocument,
    deleteDocument,
    updateDocument,
    searchDocuments,
    
    // Computed
    totalSize,
    remainingQuota,
    documentsByType
  };
}
```

---

## File Structure

```
src/
├── lib/
│   ├── memoryStorage.ts      # Storage service (new)
│   ├── documentProcessor.ts  # File processing (new)
│   └── cloudAI.ts            # Update with memory tool
├── hooks/
│   └── useMemory.ts          # Memory hook (new)
├── components/
│   ├── MemoryManager.tsx     # Full memory manager (new)
│   ├── DocumentUpload.tsx    # Upload component (new)
│   └── DocumentCard.tsx      # Document display (new)
└── app/
    └── chat/
        └── page.tsx          # Update with upload UI
```

---

## Implementation Order

| Step | Task | Est. Time |
|------|------|-----------|
| 1 | Define types and interfaces (including system document types) | 30 min |
| 2 | Implement `MemoryStorageService` (localStorage + IndexedDB) | 2 hrs |
| 3 | Implement `DocumentProcessor` (image resize, PDF extraction) | 2 hrs |
| 4 | Add `get_memory_documents` tool to `cloudAI.ts` | 1 hr |
| 5 | Update system prompt with memory instructions | 30 min |
| 6 | Create `useMemory` hook | 1 hr |
| 7 | Build `MemoryManager` component | 2 hrs |
| 8 | Integrate upload UI into chat page | 1.5 hrs |
| 9 | Integrate Training Plan → Memory sync | 1 hr |
| 10 | Integrate AI Insights → Memory sync | 1 hr |
| 11 | Testing & polish | 1.5 hrs |

**Total**: ~14 hours

---

## Technical Considerations

### Storage Limits
- **localStorage**: ~5-10MB limit
- **IndexedDB**: Much larger (browser-dependent, typically 50MB+)
- Implement hybrid: metadata in localStorage, large blobs in IndexedDB

### Image Handling for OpenAI Vision
- When user asks about an image, send it via the Vision API
- Requires base64 encoding or URL
- Consider lazy loading of image content for API calls

### PDF Text Extraction
- Use `pdf.js` for client-side extraction
- Fallback: Send first few pages to OpenAI for summarization
- Store extracted text for search/reference

### Privacy
- All data stays local (browser storage)
- No server upload unless explicitly using OpenAI API
- Add clear storage management UI

### Error Handling
- Graceful degradation if storage quota exceeded
- Clear error messages for unsupported file types
- Retry logic for API calls

---

## Phase 6: Cross-Module Memory Integration

The memory system should be a **shared knowledge layer** across all AI features, not just user uploads.

### 6.1 Memory Document Types

Extend the `MemoryDocument` type to support system-generated content:

```typescript
export type MemoryDocumentType = 
  | 'image'           // User-uploaded image
  | 'pdf'             // User-uploaded PDF
  | 'training_plan'   // Generated by Training Plan module
  | 'insight'         // Generated by AI Insights module
  | 'note';           // User-created text note

export interface MemoryDocument {
  id: string;
  name: string;
  type: MemoryDocumentType;
  source: 'user' | 'system';  // Who created it
  // ... rest of fields
}
```

### 6.2 Training Plan Integration

**File**: Update training plan generation logic

When a training plan is generated:
1. Auto-save to memory with `type: 'training_plan'`
2. Mark previous active plan as `status: 'archived'`
3. Include plan details: duration, goals, weekly structure

```typescript
// After plan generation
memoryStorage.addSystemDocument({
  type: 'training_plan',
  name: `Training Plan - ${planGoal}`,
  content: {
    goal: planGoal,
    duration: '8 weeks',
    weeklyStructure: [...],
    startDate: new Date(),
    status: 'active'
  }
});
```

**Chat can then:**
- See the active training plan
- Reference specific workouts
- Track progress against plan goals

### 6.3 AI Insights Integration

**File**: Update `src/hooks/useAIInsights.ts` and insights generation

When insights are generated:
1. Auto-save current insights to memory with `type: 'insight'`
2. Include timestamp and session context
3. Replace previous insights (keep only latest)

```typescript
// After insights generation
memoryStorage.addSystemDocument({
  type: 'insight',
  name: `Insights - ${formatDate(new Date())}`,
  content: {
    insights: generatedInsights,
    basedOnSessions: sessionIds,
    generatedAt: new Date()
  }
});
```

**Chat can then:**
- Reference current dashboard insights
- Discuss specific recommendations
- Track if user followed suggestions

### 6.4 Updated AI Tool

Expand `get_memory_documents` tool to filter by source and type:

```typescript
const memoryTool = {
  type: "function",
  name: "get_memory_documents",
  description: "Retrieve documents from the user's coaching memory. Includes user uploads AND system-generated content like training plans and insights.",
  parameters: {
    type: "object",
    properties: {
      query: { type: ["string", "null"] },
      type: {
        type: ["string", "null"],
        enum: ["image", "pdf", "training_plan", "insight", "note", null],
        description: "Filter by document type"
      },
      source: {
        type: ["string", "null"],
        enum: ["user", "system", null],
        description: "Filter by source (user uploads vs system-generated)"
      },
      activeOnly: {
        type: ["boolean", "null"],
        description: "For training plans: only return active plan"
      }
    },
    // ...
  }
};
```

### 6.5 System Prompt Update

Add to chat system prompt:
```
MEMORY SYSTEM:
You have access to a shared memory that contains:
- User uploads: PDFs, images, notes the user has added
- Training Plans: The user's active and past training plans
- Insights: Recent AI-generated insights from the dashboard

ALWAYS check memory when:
- User asks about their training plan
- User references uploaded documents
- User asks about recent insights or recommendations
- User wants to track progress against goals

Use get_memory_documents with appropriate filters:
- type: 'training_plan', activeOnly: true → Get current plan
- type: 'insight' → Get recent insights
- source: 'user' → Get user uploads only
```

### 6.6 Memory Sync Points

| Module | Writes to Memory | When |
|--------|------------------|------|
| Training Plan Generator | `training_plan` | On plan creation/update |
| AI Insights | `insight` | On insights generation |
| Chat | `note` | When user explicitly saves |
| Upload UI | `image`, `pdf` | On file upload |

---

## Future Enhancements

1. **Cloud Sync**: Optional cloud backup for memory documents
2. **OCR**: Automatic text extraction from images using OpenAI Vision
3. **Categories**: Organize documents into folders/categories
4. **Sharing**: Export/import memory between devices
5. **Smart Tagging**: AI-suggested tags based on content
6. **Version History**: Track changes to documents
7. **Memory Timeline**: Visual timeline of all memory entries

---

## Configuration (Decided)

| Setting | Value |
|---------|-------|
| Max file size per document | **10MB** |
| Max total storage | **50MB** |
| Supported formats | **JPEG, PNG, GIF, WebP, PDF** |
| Save behavior | **Auto-save to memory** on upload |
| Document expiration | Keep until manually deleted |

---

## Commit Message Template

```
feat(chat): add document memory system for AI coach

- Add MemoryStorageService with localStorage + IndexedDB hybrid storage
- Implement DocumentProcessor for image/PDF handling
- Add get_memory_documents tool to cloudAI
- Create MemoryManager UI component
- Integrate file upload into chat interface
- Support image and PDF uploads with text extraction
```
