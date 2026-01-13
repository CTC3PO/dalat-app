# Handover: Email Auth + Organizer Mailing Lists

**Date:** January 13, 2026
**AI:** Claude Opus 4.5
**Commit:** `c7743df`

---

## Executive Summary

This feature adds two capabilities to dalat.app:
1. **Email/password authentication** as alternative to Google OAuth
2. **Organizer mailing lists** for bulk event invitations via Resend

Both features are **code-complete** but require **manual configuration** in Supabase and Resend dashboards.

---

## Architecture Decisions

### Why Resend over Novu for Email?

| Aspect | Novu (existing) | Resend (new) |
|--------|----------------|--------------|
| **Purpose** | Push notifications, in-app inbox | Email delivery |
| **Bulk sending** | 1-by-1 triggers | Batch API (100/request) |
| **Deliverability** | ~70% | ~95%+ |
| **Auth emails** | Not applicable | Custom SMTP for Supabase |

**Decision:** Keep Novu for push/inbox, use Resend for all email (auth + bulk invites).

### Why Supabase Email Auth?

- Already using Supabase Auth for Google OAuth
- Native support for email/password, magic links, password reset
- Just needs custom SMTP for reliable delivery (Resend)
- No new auth service = less complexity

---

## What Was Built

### Files Created

```
# Email Auth
components/auth/email-auth-form.tsx      # Login/signup form with mode toggle
app/[locale]/auth/forgot-password/       # Request password reset
app/[locale]/auth/reset-password/        # Set new password

# UI Components
components/ui/alert.tsx                  # Error/success messages
components/ui/alert-dialog.tsx           # Confirmation dialogs

# Mailing Lists
lib/resend.ts                            # Resend client + bulk email functions
components/tribe/contact-upload.tsx      # CSV upload with preview
components/tribe/contact-list.tsx        # Contact management UI

# API Routes
app/api/tribes/[slug]/contacts/route.ts           # CRUD for contacts
app/api/tribes/[slug]/contacts/bulk-invite/route.ts  # Send invites

# Database
supabase/migrations/20260212_001_tribe_contacts.sql  # Tables + RLS
```

### Files Modified

```
components/auth/oauth-buttons.tsx   # Added email option with divider
messages/en.json                    # Added auth + contacts translations
package.json                        # Added resend, @react-email/components
```

---

## Database Schema

### `tribe_contacts` Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tribe_id | uuid | FK to tribes (NULL if organizer contact) |
| organizer_id | uuid | FK to organizers (NULL if tribe contact) |
| email | text | Contact email |
| name | text | Optional name |
| phone | text | Optional phone |
| notes | text | Admin notes |
| status | text | active / unsubscribed / bounced |

**Constraints:**
- Must belong to EITHER tribe OR organizer (not both)
- Unique email per tribe/organizer

### `contact_invites` Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | FK to tribe_contacts |
| event_id | uuid | FK to events |
| invite_token | text | Unique token for tracking |
| sent_at | timestamptz | When email sent |
| opened_at | timestamptz | When email opened (future) |
| clicked_at | timestamptz | When link clicked (future) |
| status | text | sent / opened / clicked / bounced |

**Constraints:**
- Unique (contact_id, event_id) - can't invite same contact twice

### RLS Policies

- Tribe admins/leaders can manage their tribe's contacts
- Organizer owners can manage their organizer's contacts
- Platform admins can view all contacts
- Anyone can read invite by token (for invite landing page)

---

## Manual Setup Required

### 1. Supabase Dashboard - Enable Email Auth

1. Go to **Authentication** → **Providers** → **Email**
2. Toggle **Enable Email Provider** ON
3. Enable:
   - ✅ Confirm email
   - ✅ Secure email change

### 2. Supabase Dashboard - Custom SMTP (Resend)

1. Go to **Project Settings** → **Authentication** → **SMTP Settings**
2. Toggle **Enable Custom SMTP** ON
3. Configure:

| Field | Value |
|-------|-------|
| Sender email | `noreply@dalat.app` |
| Sender name | `Dalat Events` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `re_YOUR_API_KEY` |

### 3. Resend Setup

1. Create account at [resend.com](https://resend.com)
2. **Verify domain:**
   - Add `dalat.app`
   - Configure DNS records (TXT, MX, CNAME)
   - Wait for verification
3. **Get API key:**
   - Create key named `dalat-app-production`
   - Copy key (starts with `re_`)

### 4. Environment Variable

Add to `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

---

## Integration Points (Not Yet Built)

### 1. Tribe Dashboard Integration

The contact components need to be integrated into the tribe admin UI:

```tsx
// In tribe settings/admin page
import { ContactUpload } from "@/components/tribe/contact-upload";
import { ContactList } from "@/components/tribe/contact-list";

// Upload contacts
<ContactUpload onUpload={async (contacts) => {
  await fetch(`/api/tribes/${slug}/contacts`, {
    method: "POST",
    body: JSON.stringify({ contacts }),
  });
}} />

// List and manage contacts
<ContactList
  contacts={contacts}
  onDelete={handleDelete}
  onInvite={handleBulkInvite}
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
/>
```

### 2. Event Invite Flow

When organizer wants to invite contacts to an event:

```tsx
// Select contacts → select event → send
const response = await fetch(`/api/tribes/${slug}/contacts/bulk-invite`, {
  method: "POST",
  body: JSON.stringify({
    event_id: selectedEvent.id,
    contact_ids: selectedContactIds,
  }),
});
```

### 3. Invite Landing Page

Need to create `/invite/[token]` page that:
- Looks up invite by token
- Shows event details
- Allows RSVP without login
- Updates `contact_invites.clicked_at`

---

## Testing Checklist

### Email Auth

- [ ] Create account with email/password
- [ ] Receive confirmation email (via Resend)
- [ ] Click confirmation link → redirected to onboarding
- [ ] Login with email/password
- [ ] "Forgot password" flow works
- [ ] Reset password flow works
- [ ] Google OAuth still works alongside email

### Mailing Lists

- [ ] Upload CSV with valid emails → contacts created
- [ ] Upload CSV with invalid emails → shows errors
- [ ] Duplicate emails handled gracefully
- [ ] Delete contact works
- [ ] Bulk invite sends emails
- [ ] Already-invited contacts skipped
- [ ] Invite token generated correctly

---

## Known Limitations

1. **No Vietnamese/French translations** - Only English added for auth/contacts strings
2. **No invite landing page** - `/invite/[token]` route not created
3. **No open/click tracking** - Resend webhooks not integrated
4. **No unsubscribe handling** - Links not implemented
5. **Tribe UI not integrated** - Components exist but not wired to tribe dashboard

---

## Recommended Next Steps

### Priority 1: Configuration (Manual)
1. Set up Resend account and verify domain
2. Configure Supabase SMTP settings
3. Enable Supabase email provider
4. Add `RESEND_API_KEY` to production env

### Priority 2: Integration
1. Add contacts tab to tribe dashboard
2. Create invite landing page (`/invite/[token]`)
3. Add "Invite contacts" button to event management

### Priority 3: Enhancements
1. Add Vietnamese + French translations
2. Set up Resend webhooks for open/click tracking
3. Add unsubscribe links and handling
4. Add automated reminder sequences

---

## Useful Commands

```bash
# Check migration status
npx supabase migration list

# Push migrations (if needed)
npx supabase db push

# Type check
npx tsc --noEmit

# Run locally
npm run dev
```

---

## API Reference

### POST /api/tribes/[slug]/contacts

Upload contacts to a tribe's mailing list.

**Request:**
```json
{
  "contacts": [
    { "email": "john@example.com", "name": "John Doe", "phone": "+84123456789" },
    { "email": "jane@example.com", "name": "Jane Smith" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "inserted": 2,
  "total": 2
}
```

### GET /api/tribes/[slug]/contacts

List all contacts for a tribe.

**Response:**
```json
{
  "contacts": [
    { "id": "uuid", "email": "john@example.com", "name": "John Doe", "status": "active" }
  ]
}
```

### DELETE /api/tribes/[slug]/contacts?id=xxx

Delete a contact.

### POST /api/tribes/[slug]/contacts/bulk-invite

Send event invitations to selected contacts.

**Request:**
```json
{
  "event_id": "event-uuid",
  "contact_ids": ["contact-uuid-1", "contact-uuid-2"]
}
```

**Response:**
```json
{
  "success": true,
  "sent": 10,
  "failed": 0,
  "skipped": 2
}
```

---

## Agent & Skill Recommendations for Next AI

### For Integration Work

Use **Explore agent** to understand:
- Tribe dashboard structure: `app/[locale]/tribes/[slug]/**`
- Existing event management UI: `app/[locale]/events/[slug]/**`
- Current invite system: `components/events/invite-*.tsx`

### For Translations

Use **Grep** to find all translation keys:
```
grep -r "contacts\." messages/en.json
grep -r "auth\." messages/en.json
```

Then add matching keys to `messages/vi.json` and `messages/fr.json`.

### For Testing

Use **Bash** to:
1. Check database tables exist: `npx supabase db inspect`
2. Test API endpoints locally: `curl -X POST http://localhost:3000/api/...`

---

## Contact Points

- **Supabase Project:** `aljcmodwjqlznzcydyor.supabase.co`
- **GitHub:** `goldenfocus/dalat-app`
- **Main Branch:** `main`

---

*Generated by Claude Opus 4.5 on January 13, 2026*
