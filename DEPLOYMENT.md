# Deployment Guide

## Pre-deployment Checklist

### 1. Database Migration

Before deploying, run the database migration to add the User status column:

```bash
cd backend
npx prisma migrate deploy
```

Or manually apply the migration:
```bash
psql $DATABASE_URL -f backend/prisma/migrations/20251012160500_add_user_status/migration.sql
```

### 2. User Status Management

After deployment, existing users will have `PENDING` status by default. You need to manually approve users in the database:

```sql
-- Approve a user
UPDATE "User" SET status = 'APPROVED' WHERE email = 'user@example.com';

-- View all users and their status
SELECT id, email, status, "createdAt" FROM "User";

-- Reject a user
UPDATE "User" SET status = 'REJECTED' WHERE email = 'user@example.com';
```

### 3. Features Implemented

#### a. Password Security
- Passwords are already hashed using bcrypt on the backend
- Transmitted over HTTPS (ensure HTTPS is enabled in production)
- Never stored in plain text

#### b. User Approval Workflow
- New users register via `/signup` page
- Users start with `PENDING` status
- Login is blocked until admin approves (sets status to `APPROVED`)
- Status check happens at:
  - Login time ([auth.ts:55-61](backend/src/routes/auth.ts#L55-L61))
  - Every authenticated API request ([authentication.ts:40-56](backend/src/plugins/authentication.ts#L40-L56))

#### c. Real-time Mitosis Price
- Integrated Coingecko API for live MITO price
- Price cached for 5 minutes to avoid rate limiting
- Fallback to hardcoded price (0.14) if API fails
- Frontend automatically refreshes price every 5 minutes
- Price displayed on dashboard: [dashboard.tsx:133-143](frontend/src/pages/dashboard.tsx#L133-L143)

## Environment Variables

No new environment variables are required. The application uses existing configuration.

## Testing the New Features

### Test User Registration Flow
1. Navigate to `/signup`
2. Register a new account
3. Verify that login fails with "Your account is pending approval" message
4. Approve the user in database using SQL above
5. Login should now succeed

### Test Price Integration
1. Login to dashboard
2. Verify "Current MITO Price" card shows live price from Coingecko
3. Price should update automatically every 5 minutes
4. Check browser console for any API errors

## Rollback Plan

If issues occur, you can:

1. Rollback the database migration:
```sql
ALTER TABLE "User" DROP COLUMN status;
DROP TYPE "UserStatus";
```

2. Revert code changes by checking out previous commit

## Notes

- Ensure database is running before migration
- Backup database before deploying
- Test in staging environment first if available
