# Admin Feature Documentation

## Overview

The Rowing Tracker now includes a master admin system that allows designated administrators to manage user accounts. Admin users have elevated permissions to view, modify, and delete user accounts.

## Features

### Admin Capabilities

- **View All Users** - See a complete list of all registered users
- **User Details** - View user statistics (sessions, plans, awards)
- **Reset Passwords** - Reset any user's password
- **Change User Roles** - Promote users to admin or demote to regular user
- **Delete Users** - Remove user accounts and all associated data

### Security Features

- **Role-Based Access Control** - Only users with `role: "admin"` can access admin features
- **Protected Routes** - Middleware prevents non-admin access to `/admin` routes
- **API Authorization** - All admin API endpoints verify admin role
- **Self-Protection** - Admins cannot delete themselves or other admins
- **Cascade Delete** - Deleting a user removes all their data (sessions, plans, etc.)

## Setup

### 1. Create Database Migration

Run the migration to add the `role` field to the User table:

```bash
npm run db:migrate
```

This will create a migration that adds `role String @default("user")` to the User model.

### 2. Promote First Admin User

After registering a user account, promote them to admin:

```bash
npm run admin:promote your-email@example.com
```

Example output:
```
✅ Successfully promoted your-email@example.com to admin
   User ID: clx1234567890
   Name: Your Name
```

### 3. Access Admin Dashboard

Once promoted, the admin user will see an "Admin Panel" link in the navigation bar. Click it to access the admin dashboard at `/admin`.

## Admin Dashboard

### User Management Table

The admin dashboard displays all users with:

- **User Info** - Name, email, user ID
- **Role Badge** - Visual indicator for admin/user roles
- **Verification Status** - Email verification indicator
- **Statistics** - Session count, training plans, awards
- **Created Date** - Account creation timestamp
- **Action Buttons**:
  - 🔑 **Reset Password** - Set a new password for the user
  - 👤 **Toggle Role** - Promote to admin or demote to user
  - 🗑️ **Delete User** - Remove user and all data

### Reset Password

1. Click the key icon (🔑) next to a user
2. Enter a new password (minimum 8 characters)
3. Click "Reset Password"
4. User can now log in with the new password

### Change User Role

1. Click the user settings icon (👤) next to a user
2. Confirm the role change
3. User role is updated immediately

**Note:** You cannot change your own role.

### Delete User

1. Click the trash icon (🗑️) next to a user
2. Confirm deletion (this is permanent!)
3. User and ALL associated data is deleted:
   - Rowing sessions
   - Training plans
   - Earned awards
   - Chat sessions
   - AI insights
   - Memory documents
   - All other user data

**Note:** You cannot delete admin users or yourself.

## API Endpoints

### List All Users
```
GET /api/admin/users
Authorization: Admin role required
```

Response:
```json
{
  "users": [
    {
      "id": "clx...",
      "email": "user@example.com",
      "name": "User Name",
      "role": "user",
      "emailVerified": "2025-01-01T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "_count": {
        "rowingSessions": 42,
        "trainingPlans": 3,
        "earnedAwards": 15
      }
    }
  ]
}
```

### Get User Details
```
GET /api/admin/users/[userId]
Authorization: Admin role required
```

### Update User
```
PATCH /api/admin/users/[userId]
Authorization: Admin role required
Content-Type: application/json

{
  "name": "New Name",           // optional
  "email": "new@example.com",   // optional
  "role": "admin",              // optional: "user" or "admin"
  "newPassword": "newpass123"   // optional: min 8 chars
}
```

### Delete User
```
DELETE /api/admin/users/[userId]
Authorization: Admin role required
```

## Database Schema

### User Model Changes

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  passwordHash  String?
  role          String    @default("user")  // NEW FIELD
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  // ... relations
}
```

Valid roles:
- `"user"` - Regular user (default)
- `"admin"` - Administrator with full access

## Security Considerations

### Best Practices

1. **Limit Admin Accounts** - Only promote trusted users to admin
2. **Strong Passwords** - Use strong passwords for admin accounts
3. **Regular Audits** - Periodically review admin access
4. **Secure Environment** - Keep `NEXTAUTH_SECRET` secure
5. **Production Email** - Use real email verification in production

### What Admins Can Do

✅ View all user accounts and data statistics  
✅ Reset any user's password  
✅ Promote/demote user roles  
✅ Delete regular user accounts  

### What Admins Cannot Do

❌ Delete other admin accounts  
❌ Delete their own account  
❌ Access user's actual session data (privacy protected)  
❌ View user's passwords (hashed with bcrypt)  

## Middleware Protection

The `/admin` routes are protected by middleware that:

1. Checks if user is authenticated
2. Verifies user has `role: "admin"`
3. Redirects non-admin users to `/dashboard`

```typescript
// src/middleware.ts
if (isAdminRoute && token?.role !== "admin") {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

## Troubleshooting

### "Admin Panel" link not showing

- Ensure you've promoted your user to admin
- Restart your dev server after promotion
- Check session includes role: `session.user.role === "admin"`

### Cannot access /admin route

- Verify user role in database: `SELECT role FROM User WHERE email = 'your@email.com'`
- Clear browser cookies and log in again
- Check middleware is running correctly

### Promotion script fails

```bash
# Ensure database is running
npm run db:start

# Generate Prisma client
npm run db:generate

# Try promotion again
npm run admin:promote your@email.com
```

## Migration from Previous Version

If upgrading from a version without roles:

1. Run database migration: `npm run db:migrate`
2. All existing users will have `role: "user"` by default
3. Promote your account: `npm run admin:promote your@email.com`
4. Restart dev server

## Production Deployment

### Environment Variables

Ensure these are set in production:

```bash
DATABASE_URL="your-production-database-url"
NEXTAUTH_SECRET="your-production-secret"
NEXTAUTH_URL="https://yourdomain.com"
```

### First Admin Setup

1. Deploy application
2. Register your admin account via UI
3. SSH into your server or use database console
4. Run promotion script or update database directly:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

## Future Enhancements

Potential features for future versions:

- [ ] Admin activity logs
- [ ] Bulk user operations
- [ ] User impersonation (for support)
- [ ] Advanced user search/filtering
- [ ] Export user data (GDPR compliance)
- [ ] Granular permissions (moderator role)
- [ ] Email notifications for admin actions

---

**Security Note:** Admin access is powerful. Only grant admin privileges to trusted users who need to manage the application.
