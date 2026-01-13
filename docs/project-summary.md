# Lawexa - Project Summary & Decisions

## What is Lawexa?

Lawexa is a legal content platform for Nigerian law cases, notes, and legal research materials with subscription-based monetization. The platform serves law students, legal assistants, and corporate legal teams.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| UI Components | shadcn/ui (customized) + custom components |
| Styling | Tailwind CSS |
| State (Server) | TanStack Query (React Query) |
| State (UI) | Zustand |
| Forms | React Hook Form + Zod |
| HTTP Client | Axios |
| Rich Text Editor | TipTap (for notes) |
| Fingerprinting | FingerprintJS |
| Backend | Laravel 11 API (separate project) |
| Payments | Paystack |

---

## User Roles & Hierarchy

| Role | Priority | Description |
|------|----------|-------------|
| Superadmin | 100 | Platform owner - full access + manage admins |
| Admin | 80 | Platform manager - manage content, users, approve creators |
| Researcher | 60 | Content creator - create/edit cases & notes |
| User | 40 | Registered user - view content (tier-limited), create personal notes |
| Guest | 20 | Anonymous visitor - limited free views (fingerprint tracked) |
| Bot | 10 | Automated system user |

- Single role per user
- Unverified email = guest-level access
- Admin approval required to become a Creator (for selling notes)

---

## Core Features

### Content Types
1. **Law Cases** - Court cases with metadata (court, citation, judges, principles)
2. **Notes** - User-created or official notes (can be sold in marketplace)
3. **Courses** - Organizational categories for cases

### Deferred Features (Noted for Future)
- AI Chat (LLM integration)
- Projects
- Folders
- Statutes
- In-app notifications
- Push notifications (mobile)

---

## Authentication

### Methods
- Email/Password with verification
- Google OAuth 2.0
- Guest Token (fingerprint-based)

### Features
- Email verification required for full access
- Password reset flow
- Session management (list, revoke)
- Configurable max concurrent sessions

---

## Subscription Plans

| Plan | Target User |
|------|-------------|
| Free | Default tier with limited views |
| Student | Law students |
| Assistant | Legal assistants |
| Corporate | Corporate legal teams (unlimited) |

- Payment intervals: Daily, Monthly, Annually, Biannually
- Paystack integration
- Mid-cycle upgrade with prorated billing
- Grace period before downgrade on failed payment

---

## View Tracking & Limits

- 30-minute deduplication window
- Calendar month reset (1st of each month)
- Hard block when limit exceeded + upgrade prompt (modal with suggested plan)
- Separate limits for: case views, note views, note creations, bookmarks, content requests

---

## UI/UX Decisions

### Theme
- Dark mode (default) + Light mode toggle in settings
- Color scheme: Brown/gold accents on dark background

### Layout
- Sidebar: Always visible on desktop, collapsible on mobile (hamburger)
- Mobile-first responsive design

### Authentication UX
- Modal-based (popup over current page)
- Dedicated pages (`/login`, `/register`, `/reset-password`)
- Both approaches available

### Guest Experience
- Simplified public view with prominent login/signup CTAs
- Limited sidebar navigation

### Greetings System
Time-based with weighted random selection:
| Time Period | Hours |
|-------------|-------|
| Early Morning | 5:00 AM - 8:59 AM |
| Late Morning | 9:00 AM - 11:59 AM |
| Afternoon | 12:00 PM - 4:59 PM |
| Evening | 5:00 PM - 8:59 PM |
| Night | 9:00 PM - 11:59 PM |
| Late Night | 12:00 AM - 4:59 AM |

Priority: Time-based (3) > Weekly (2) > Seasonal (1), Special occasions override all

### Loading States
- Skeleton loaders (preferred)
- Cache static content to avoid repeated skeletons

---

## URL Structure

```
/                        -> Welcome page (greeting + AI chat entry)
/login                   -> Login page
/register                -> Registration page
/reset-password          -> Password reset page
/cases                   -> Case list/browse
/cases/[slug]            -> Case detail
/notes                   -> Notes library
/notes/[slug]            -> Note detail
/dashboard               -> User dashboard (recent activity)
/creators                -> Creators dashboard (sales data)
/admin                   -> Admin dashboard
/pricing                 -> Subscription plans
/settings                -> User settings
/settings/general        -> General settings
/settings/account        -> Account settings
/settings/privacy        -> Privacy settings
/settings/billing        -> Billing settings
```

---

## Settings Pages

| Section | Features |
|---------|----------|
| General | Theme (dark/light), notifications preferences |
| Account | Profile info, name, avatar, password change |
| Privacy | Session management, data preferences |
| Billing | Subscription status, payment methods, bank details (creators) |

---

## Content Creation

| Content Type | Editor |
|--------------|--------|
| Notes | TipTap rich text editor with image uploads |
| Cases | Form-based input with structured fields |

---

## API Integration

### Base URL
- Local development: `http://localhost:8000`
- All endpoints prefixed with `/api`

### Response Format
```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors?: Record<string, string[]> | null;
}
```

### Rate Limiting
- Per IP address
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

---

## Development Phases

1. **Phase 1** - Project Setup
2. **Phase 2** - Authentication
3. **Phase 3** - Users
4. **Phase 4** - Courses
5. **Phase 5** - Cases
6. **Phase 6** - Notes
7. **Phase 7** - Bookmarks
8. **Phase 8** - Views & Limits
9. **Phase 9** - Subscriptions

---

## Design Philosophy

From the best practices docs:
- Explicitness over cleverness
- Simplicity over abstraction
- Consistency over novelty
- Mobile-first approach
- Modern, simple, sleek UI (better than reference)
