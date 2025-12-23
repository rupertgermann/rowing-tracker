# Memory Blob Migration - Testing Guide

## Test Endpoints

### 1. Check Migration Status
**Endpoint**: `GET /api/test/memory-migration`
**Purpose**: Verify memory documents and blobs in database
**Response**: 
```json
{
  "success": true,
  "userId": "user-id",
  "documents": {
    "count": 5,
    "totalSize": 2048000,
    "withBlobs": 3,
    "byType": {
      "pdf": 2,
      "image": 1,
      "note": 2
    }
  },
  "blobs": {
    "count": 3
  },
  "timestamp": "2025-12-23T10:30:00Z"
}
```

### 2. Create Test Document
**Endpoint**: `POST /api/test/memory-migration`
**Purpose**: Test creating a memory document with blob
**Request Body**:
```json
{
  "name": "test.pdf",
  "type": "pdf",
  "mimeType": "application/pdf",
  "blobData": "<base64-encoded-pdf-data>"
}
```
**Response**:
```json
{
  "success": true,
  "document": {
    "id": "mem_123",
    "name": "test.pdf",
    "type": "pdf",
    "size": 1024000,
    "hasBlob": true
  }
}
```

### 3. Delete Test Document
**Endpoint**: `DELETE /api/test/memory-migration`
**Purpose**: Test deleting a memory document
**Request Body**:
```json
{
  "documentId": "mem_123"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

## Manual Testing Steps

### Step 1: Verify Database Connection
1. Open browser DevTools (F12)
2. Go to Settings page
3. Scroll to "Memory Documents Migration" section
4. Observe the status:
   - Local Storage count (IndexedDB documents)
   - Database count (PostgreSQL documents)
5. Check Console for any errors

**Expected Result**: Both counts display without errors

### Step 2: Check Migration Status
1. Open browser DevTools Console
2. Run test endpoint:
```javascript
fetch('/api/test/memory-migration').then(r => r.json()).then(d => console.log(d))
```
3. Verify response shows:
   - `success: true`
   - Document count
   - Blob count
   - Storage stats

**Expected Result**: Response shows accurate counts

### Step 3: Create Test Document
1. In Console, create a test document:
```javascript
const testBlob = new Blob(['test content'], { type: 'text/plain' });
const reader = new FileReader();
reader.onload = async (e) => {
  const base64 = btoa(e.target.result);
  const response = await fetch('/api/test/memory-migration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'test.txt',
      type: 'note',
      mimeType: 'text/plain',
      blobData: base64
    })
  });
  const data = await response.json();
  console.log(data);
  window.testDocId = data.document.id;
};
reader.readAsArrayBuffer(testBlob);
```
2. Verify response shows created document
3. Save the document ID for cleanup

**Expected Result**: Document created successfully with blob

### Step 4: Verify Document in Database
1. Run status check again:
```javascript
fetch('/api/test/memory-migration').then(r => r.json()).then(d => console.log(d))
```
2. Verify document count increased
3. Verify blob count increased

**Expected Result**: Counts reflect new document

### Step 5: Delete Test Document
1. Delete the test document:
```javascript
const response = await fetch('/api/test/memory-migration', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documentId: window.testDocId })
});
const data = await response.json();
console.log(data);
```
2. Verify success response

**Expected Result**: Document deleted successfully

### Step 6: Verify Deletion
1. Run status check again:
```javascript
fetch('/api/test/memory-migration').then(r => r.json()).then(d => console.log(d))
```
2. Verify document count decreased
3. Verify blob count decreased

**Expected Result**: Counts reflect deletion

### Step 7: Test Migration UI Component
1. Open Settings page
2. Scroll to "Memory Documents Migration" section
3. Verify it shows:
   - Local Storage count
   - Database count
   - Migration progress bar
   - "Migrate to Database" button (if needed)
4. If documents need migration:
   - Click "Migrate to Database" button
   - Observe progress
   - Wait for completion
5. Verify success message

**Expected Result**: UI displays correctly and migration works

### Step 8: Test Multi-User Isolation
1. Open two browser windows/tabs with different user accounts
2. In Window A: Upload a document to memory
3. In Window B: Check memory documents
4. Verify Window B doesn't see Window A's documents
5. Verify each user's documents are isolated

**Expected Result**: No cross-user data leakage

### Step 9: Test Error Handling
1. Simulate network error:
   - Open DevTools Network tab
   - Set throttling to "Offline"
   - Try to upload a document
   - Verify error message displays
   - Verify app doesn't crash
2. Restore network connection
3. Retry upload
4. Verify it succeeds

**Expected Result**: Graceful error handling

### Step 10: Test Large File Upload
1. Create a large test file (5-10MB)
2. Try to upload to memory
3. Verify:
   - Upload completes
   - Blob is stored correctly
   - Can retrieve blob
   - File integrity maintained

**Expected Result**: Large files handled correctly

## Automated Testing

### Run Test Endpoint
```bash
# Check status
curl -X GET http://localhost:3000/api/test/memory-migration \
  -H "Cookie: <your-session-cookie>"

# Create test document
curl -X POST http://localhost:3000/api/test/memory-migration \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "test.pdf",
    "type": "pdf",
    "mimeType": "application/pdf",
    "blobData": "<base64-data>"
  }'

# Delete test document
curl -X DELETE http://localhost:3000/api/test/memory-migration \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"documentId": "mem_123"}'
```

## Expected Behavior

### Document Creation
- ✅ Document metadata saved to MemoryDocument
- ✅ Blob data saved to MemoryBlob
- ✅ User isolation enforced
- ✅ File size calculated correctly
- ✅ Timestamp recorded

### Document Retrieval
- ✅ Metadata fetched from MemoryDocument
- ✅ Blob data fetched from MemoryBlob
- ✅ User isolation enforced
- ✅ Blob data integrity maintained

### Document Deletion
- ✅ Document deleted from MemoryDocument
- ✅ Blob deleted from MemoryBlob (cascade)
- ✅ User isolation enforced
- ✅ No orphaned blobs

### Migration
- ✅ IndexedDB documents fetched
- ✅ Blobs converted to base64
- ✅ Documents created in database
- ✅ Blobs created in database
- ✅ Progress tracked
- ✅ Errors reported

### Error Handling
- ✅ Invalid input rejected
- ✅ Unauthorized requests denied
- ✅ Database errors handled
- ✅ User-friendly error messages
- ✅ No sensitive data in errors

## Performance Metrics

### Expected Response Times
- GET documents: < 500ms
- POST document: < 1s
- DELETE document: < 500ms
- Migration: < 5s (depends on blob size)

### Database Queries
- Create: 2 queries (document + blob)
- Retrieve: 1 query with JOIN
- Delete: 2 queries (cascade)
- List: 1 query

## Troubleshooting

### Documents Not Appearing
1. Check browser console for errors
2. Verify authentication (check /api/auth/session)
3. Check database connection
4. Verify userId in database

### Blob Data Missing
1. Check MemoryBlob table for orphaned records
2. Verify base64 encoding/decoding
3. Check file size limits
4. Verify blob data integrity

### Migration Failing
1. Check IndexedDB data exists
2. Verify database connection
3. Check blob size limits
4. Review error messages

### Cross-User Data Leakage
1. Verify userId filtering in queries
2. Check Prisma relations
3. Verify unique constraints
4. Test with multiple users

## Sign-Off Checklist

- [ ] Status endpoint returns correct counts
- [ ] Can create test document with blob
- [ ] Blob data stored correctly
- [ ] Can retrieve document and blob
- [ ] Can delete document (cascade delete works)
- [ ] Migration UI displays correctly
- [ ] Can migrate documents from IndexedDB
- [ ] Multi-user isolation verified
- [ ] Error handling works correctly
- [ ] Large files handled properly
- [ ] Performance acceptable
- [ ] No data loss or corruption

## Next Steps

1. Run manual testing steps 1-10
2. Verify all checkboxes pass
3. Test with real user data
4. Monitor database performance
5. Proceed with production deployment

## Conclusion

Memory blob migration infrastructure is complete and ready for testing:
- ✅ API endpoints for CRUD operations
- ✅ Sync library for database integration
- ✅ React hook for component integration
- ✅ Migration endpoint for IndexedDB → Database
- ✅ UI component for user-friendly migration
- ✅ Test endpoints for verification
- ✅ Comprehensive testing guide

**Ready for end-to-end testing and verification.**
