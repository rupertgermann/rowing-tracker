# Memory Blob Migration - IndexedDB to Database

## Overview
Migrate memory document blobs from IndexedDB to PostgreSQL database with proper encryption and user isolation.

## Status: 🟡 IN PROGRESS

## Architecture

### Before (IndexedDB)
```
Memory Storage (IndexedDB)
├── documents store (metadata)
└── blobs store (binary data)
```

### After (PostgreSQL)
```
Database
├── MemoryDocument (metadata)
│   ├── id, userId, name, type, source
│   ├── mimeType, size, description
│   ├── extractedText, tags, content
│   └── status, uploadedAt
└── MemoryBlob (binary data)
    ├── id, documentId
    └── data (Bytes)
```

## Implementation

### Backend Infrastructure

#### 1. API Endpoints

**`GET /api/memory`** - Fetch all documents
```json
{
  "documents": [
    {
      "id": "mem_123",
      "userId": "user_123",
      "name": "Training Plan.pdf",
      "type": "pdf",
      "source": "user",
      "mimeType": "application/pdf",
      "size": 1024000,
      "uploadedAt": "2025-12-23T10:00:00Z",
      "blob": {
        "id": "blob_123",
        "documentId": "mem_123",
        "data": "<binary>"
      }
    }
  ]
}
```

**`POST /api/memory`** - Save documents with blobs
```json
{
  "documents": [
    {
      "id": "mem_123",
      "name": "Training Plan.pdf",
      "type": "pdf",
      "source": "user",
      "mimeType": "application/pdf",
      "size": 1024000,
      "uploadedAt": "2025-12-23T10:00:00Z",
      "blobData": "<base64-encoded-binary>"
    }
  ]
}
```

**`DELETE /api/memory`** - Delete document
```json
{
  "documentId": "mem_123"
}
```

**`POST /api/memory/migrate`** - Migrate from IndexedDB
```json
{
  "documents": [
    {
      "id": "mem_123",
      "name": "Training Plan.pdf",
      "type": "pdf",
      "source": "user",
      "mimeType": "application/pdf",
      "size": 1024000,
      "uploadedAt": "2025-12-23T10:00:00Z",
      "blobData": "<base64-encoded-binary>"
    }
  ]
}
```

**`GET /api/memory/migrate`** - Get migration status
```json
{
  "success": true,
  "documentCount": 5,
  "blobCount": 3,
  "timestamp": "2025-12-23T10:30:00Z"
}
```

#### 2. Libraries

**`/lib/memorySync.ts`** - Memory API integration
- `fetchMemoryDocumentsFromDB()` - Fetch all documents
- `saveMemoryDocumentsToDB()` - Save documents with blobs
- `deleteMemoryDocumentFromDB()` - Delete document
- `migrateMemoryDocumentsToDatabase()` - Migrate from IndexedDB
- Helper functions for base64 conversion

#### 3. Hooks

**`/hooks/useMemorySync.ts`** - React hook for memory management
- `useMemorySync()` - Load, save, add, update, delete documents
- Database sync with IndexedDB fallback
- Error handling and loading states

### Database Schema

```prisma
model MemoryDocument {
  id            String   @id @default(cuid())
  userId        String
  name          String
  type          String
  source        String
  mimeType      String
  size          Int
  description   String?  @db.Text
  extractedText String?  @db.Text
  tags          String[]
  content       Json?
  status        String?
  uploadedAt    DateTime @default(now())

  user User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  blob MemoryBlob?

  @@index([userId])
  @@index([userId, type])
}

model MemoryBlob {
  id         String @id @default(cuid())
  documentId String @unique
  data       Bytes

  document MemoryDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
}
```

## Migration Process

### Step 1: Prepare for Migration
1. Ensure database is running and accessible
2. Verify Prisma migrations are up to date
3. Backup IndexedDB data (export from browser)

### Step 2: Migrate Documents
1. User opens settings page
2. Click "Migrate Memory Documents" button
3. System fetches all documents from IndexedDB
4. Converts blobs to base64
5. Sends to `/api/memory/migrate` endpoint
6. Database stores documents and blobs
7. Show migration progress and results

### Step 3: Verify Migration
1. Check migration status via `/api/memory/migrate` GET
2. Verify document count matches
3. Verify blob count matches
4. Test document retrieval

### Step 4: Cleanup (Optional)
1. Clear IndexedDB after successful migration
2. Keep as backup for 30 days
3. Delete IndexedDB data

## Data Flow

### Migration Flow
```
IndexedDB
  ↓
memoryStorage.getAllDocuments()
  ↓
For each document:
  - Get metadata
  - Get blob (ArrayBuffer)
  - Convert blob to base64
  ↓
POST /api/memory/migrate
  ↓
For each document:
  - Create MemoryDocument
  - Create MemoryBlob (from base64)
  ↓
PostgreSQL Database
```

### Fetch Flow
```
useMemorySync Hook
  ↓
fetchMemoryDocumentsFromDB()
  ↓
GET /api/memory
  ↓
Prisma MemoryDocument.findMany()
  ↓
Include MemoryBlob relation
  ↓
Return to component
```

### Save Flow
```
User uploads document
  ↓
useMemorySync.addDocument()
  ↓
saveMemoryDocumentsToDB()
  ↓
POST /api/memory
  ↓
Create MemoryDocument
  ↓
Create MemoryBlob (from base64)
  ↓
PostgreSQL Database
```

## Security Features

### User Isolation
- ✅ All queries filtered by `userId`
- ✅ Users can only access their own documents
- ✅ Cascade delete on user deletion

### Blob Storage
- ✅ Blobs stored as `Bytes` in database
- ✅ Base64 encoding for transit
- ✅ No sensitive data in metadata

### Authentication
- ✅ NextAuth.js required on all endpoints
- ✅ Unauthorized requests return 401
- ✅ User ID verified from session

## Testing

### Manual Testing

#### Test 1: Fetch Documents
```bash
curl -X GET http://localhost:3000/api/memory \
  -H "Cookie: <session-cookie>"
```

Expected: Returns array of documents with blob data

#### Test 2: Save Document
```bash
curl -X POST http://localhost:3000/api/memory \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "documents": [{
      "id": "mem_test",
      "name": "test.pdf",
      "type": "pdf",
      "source": "user",
      "mimeType": "application/pdf",
      "size": 1024,
      "uploadedAt": "2025-12-23T10:00:00Z",
      "blobData": "<base64-data>"
    }]
  }'
```

Expected: Returns saved documents

#### Test 3: Migration Status
```bash
curl -X GET http://localhost:3000/api/memory/migrate \
  -H "Cookie: <session-cookie>"
```

Expected: Returns document and blob counts

#### Test 4: Migrate Documents
```bash
curl -X POST http://localhost:3000/api/memory/migrate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "documents": [...]
  }'
```

Expected: Returns migration results with counts

### Automated Testing

Create test file: `/src/app/api/test/memory-migration/route.ts`
- Test document creation
- Test blob storage
- Test retrieval
- Test deletion
- Test user isolation

## Performance Metrics

### Expected Response Times
- Fetch documents: < 500ms
- Save document: < 1s
- Delete document: < 500ms
- Migrate documents: < 5s (depends on blob size)

### Database Queries
- Fetch: 1 SELECT with JOIN
- Save: 2 INSERT/UPSERT (document + blob)
- Delete: 2 DELETE (cascade)
- Migrate: N INSERT operations

### Storage
- Document metadata: ~500 bytes per document
- Blob data: Variable (up to 10MB per file)
- Total quota: 50MB per user

## Rollback Plan

If migration fails:
1. Documents remain in IndexedDB
2. Database documents can be deleted
3. User can retry migration
4. No data loss

## Next Steps

### Immediate
1. ✅ Create API endpoints
2. ✅ Create sync library
3. ✅ Create React hook
4. ✅ Create migration endpoint
5. 🔄 Create UI for migration
6. 🔄 Test migration process
7. 🔄 Document migration guide

### Short-term
1. Monitor database performance
2. Verify blob storage efficiency
3. Test with large files
4. Implement cleanup after migration

### Long-term
1. Optimize blob storage (compression)
2. Implement blob versioning
3. Add blob encryption
4. Implement blob deduplication

## Conclusion

Memory blob migration infrastructure is ready:
- ✅ API endpoints for document and blob management
- ✅ Sync library for database integration
- ✅ React hook for component integration
- ✅ Migration endpoint for IndexedDB → Database
- ✅ Proper user isolation and security
- ✅ Comprehensive documentation

**Next: Create UI for migration and test the complete flow.**
