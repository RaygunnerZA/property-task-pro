# Filla Security Documentation

## Overview

This document outlines security configurations and best practices for the Filla application.

---

## 1. Row-Level Security (RLS)

All database tables are protected by RLS policies that scope data access to the authenticated user's organization.

### Policy Pattern

All tables use the following pattern:

```sql
-- SELECT
USING (org_id IS NOT NULL AND org_id = current_org_id())

-- INSERT / UPDATE
WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id())
```

### Tables with RLS Policies

| Category | Tables |
|----------|--------|
| **Compliance** | `compliance_assignments`, `compliance_clauses`, `compliance_jobs`, `compliance_reviews`, `compliance_rules`, `compliance_rule_reviews`, `compliance_rule_versions`, `compliance_sources`, `org_compliance_summary`, `property_compliance_status`, `rule_categories` |
| **Tasks & Ops** | `tasks`, `subtasks`, `task_attachments`, `task_images`, `task_image_versions`, `task_image_actions`, `task_messages` |
| **Properties** | `properties`, `spaces` |
| **Communication** | `messages`, `conversations` |
| **Organization** | `organisations`, `organisation_members`, `signals`, `teams`, `contractor_task_access` |

---

## 2. Leaked Password Protection

**IMPORTANT**: Enable Supabase leaked password protection to prevent users from registering with passwords that have been exposed in known data breaches.

### How to Enable

1. Go to your Supabase Dashboard
2. Navigate to **Authentication → Providers → Email**
3. Enable **"Check password against breach database"**

This adds an automatic check against the HaveIBeenPwned database during password operations.

---

## 3. Client-Side Input Validation

All authentication forms implement Zod schema validation:

```typescript
const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
```

### Validation Requirements

- **Email**: Valid email format
- **Password**: Minimum 8 characters
- Errors are displayed inline under form fields
- Server-side Supabase errors are also displayed

---

## 4. JWT Token-Based Access Control

The application uses JWT tokens with organization claims for access control:

- `current_org_id()` function extracts `org_id` from JWT claims
- All RLS policies reference this function to scope data access
- Users can only access data belonging to their organization

### Token Refresh

After organization creation or metadata updates, the application calls `supabase.auth.refreshSession()` to ensure the JWT contains updated claims.

---

## 5. Security Best Practices

### Do's

- ✅ Always check authentication state before sensitive operations
- ✅ Use the data access layer (hooks/mutations) instead of direct Supabase calls
- ✅ Validate all user inputs on both client and server side
- ✅ Use proper error handling that doesn't expose sensitive information

### Don'ts

- ❌ Never store sensitive data in localStorage
- ❌ Never trust client-side admin checks
- ❌ Never expose API keys or secrets in client code
- ❌ Never bypass RLS policies with service role key in client code

---

## 6. Contractor Access

Contractors have limited access via special tokens:

- `contractor_task_access` table maps tasks to contractor tokens
- Tasks RLS allows access via either `org_id` match OR `contractor_token` match
- Contractor tokens are extracted from JWT claims via `current_contractor_token()`

---

## 7. Storage Security

The `task-images` storage bucket is private (not publicly accessible).

Access to stored files requires authenticated requests with valid session tokens.

---

## Reporting Security Issues

If you discover a security vulnerability, please report it immediately to the development team.
