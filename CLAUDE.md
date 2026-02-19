# CLAUDE.md — Peerzle Development Guide

## What is Peerzle?

Peerzle is a peer-to-peer support platform that connects people with trained peers who understand their experiences. It serves as a crisis detection and peer messaging application that identifies when someone may be in distress and facilitates supportive connections. The platform targets multiple communities including First Responders, Healthcare workers, Veterans, Higher Education, and Employee Wellness programs.

This is a deeply personal project connected to the founder's brother's story. Treat the mission with the weight it deserves — this platform saves lives.

## Tech Stack

- **Frontend:** React PWA with Vite, CSS with CSS Variables (dynamic theming per community)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL (hosted on Railway)
- **Real-time:** Socket.io for chat
- **AI:** Claude/Anthropic API for PeerBot (AI companion), moderation pipeline, and crisis detection
- **Auth:** JWT-based authentication
- **Push:** Web Push API with VAPID keys
- **Deployment:** Railway (main app + PostgreSQL), Vercel (marketing website at peerzle-website repo)
- **Repo:** github.com/mtrotta31/peerzle

## Project Structure

```
peerzle/
├── client/           # React PWA frontend (Vite + CSS Variables)
├── server/           # Node.js/Express backend
├── database/
│   ├── schema.sql    # Base database schema
│   ├── migrations/   # Sequential migration files (001-017+)
│   └── seeds/        # Community seed data
├── .env.example      # Environment variable template
└── CLAUDE.md         # This file
```

## Current State

- **Live at:** peerzle-production.up.railway.app
- **Database migration:** 020 (always check for the latest before creating new ones)
- **Tier 1:** COMPLETE — 12 core features + community join flow, helper verification, helper training module, password reset, TOS acceptance
- **Tier 2:** COMPLETE — All 5 phases shipped. Matching algorithm with weighted scoring, connection cards with match percentages, mood checks, compliment badges, coaching tips, dynamic suggestions, admin stats summary
- **Tier 3:** COMPLETE — All 5 phases shipped
- **Tier 4:** COMPLETE — Daily Mood Check-Ins + Admin Mood Trend Analytics
- **Settings Page:** COMPLETE — 5 sections (Account, Profile, Notifications, Emergency Contact, Privacy)
- **Bottom Navigation:** COMPLETE — All 4 waves shipped (see below)
- **Communities:** 5 live communities running

### Tier 3 Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Organization Layer | ✅ Complete |
| 2 | Push Notifications | ✅ Complete |
| 3 | Community & Org Admin Creation Tool | ✅ Complete |
| 4 | Crisis Webhook Dispatcher | ✅ Complete (HMAC signing + retry logic) |
| 5 | User Profile Enhancements | ✅ Complete (name fields, emergency contacts, admin safety integration) |

### Bottom Navigation Status

| Wave | Feature | Status |
|------|---------|--------|
| 1 | Bottom Nav Component + CommunityLayout wrapper | ✅ Complete |
| 2 | Messages Tab (Active + Past conversations) | ✅ Complete |
| 3 | Check-In Tab (mood check-in + history + badge indicator) | ✅ Complete |
| 4 | Cleanup + Resources Migration to Settings | ✅ Complete |

## Architecture Decisions (Don't Change These)

- **PWA over Native:** The app is text-based chat. PWA gives us single codebase, instant updates, no app store approval. iOS push limitations are accepted.
- **PostgreSQL over Firestore:** Relational queries are essential for the community/membership model. Socket.io handles real-time.
- **Railway over AWS:** Simplicity. One platform for app + database. Good for current scale.
- **CSS Variables for theming:** Each community has its own branding colors applied dynamically via CSS variables. Don't hardcode community-specific colors.
- **Anonymous by default:** Users get generated display names (e.g., "CommittedArmadillo51") and avatars. Real names are only visible to org admins in safety contexts, NEVER in conversations.

## Database Conventions

- **Migrations are sequential:** Files in `database/migrations/` are numbered (001, 002, ... 019). Always check the latest migration number before creating a new one.
- **Manual migration in production:** Automated deployment doesn't always handle schema changes reliably. Run migrations manually against the Railway PostgreSQL using the public DATABASE_URL.
- **JSONB for flexible config:** Community and organization settings use JSONB columns for branding, topics, onboarding settings, etc.
- **UUID primary keys:** All tables use UUID for `id`.

### Key Tables

- `users` — Platform-level accounts (email, password_hash, first_name, last_name, mood_checkin_notifications, helper_match_notifications)
- `communities` — Industry verticals (First Responders, Healthcare, etc.) with config JSONB
- `organizations` — Specific orgs within communities (Cincinnati IAFF, etc.) with settings JSONB
- `memberships` — Links users to communities and organizations, tracks role (seeker/helper/admin)
- `conversations` — Chat sessions between seekers and helpers (or PeerBot)
- `messages` — Individual messages within conversations
- `push_subscriptions` — Web Push subscription data (no PII in notification payloads)
- `webhook_configs` — Crisis webhook endpoints per community/organization
- `emergency_contacts` — Optional emergency contact info (always optional for users)
- `mood_checkins` — Daily mood scores (1-5) per user, source (standalone/conversation)
- `mood_checkin_notification_log` — Tracks reminder notifications sent to users
- `mood_nudge_log` — Tracks follow-up nudges for disengaged users

### Hierarchy

```
Platform (Peerzle)
└── Community (e.g., First Responders)
    └── Organization (e.g., Cincinnati IAFF Local 48)
        └── Members (seekers and helpers)
```

- Matching defaults to org-internal, expandable via setting
- Org admins see only their data; community admins see all orgs
- Peerzle team are super-admins across everything

## API Conventions

- All API routes are prefixed with `/api`
- Authentication via JWT tokens in Authorization header
- Error responses use consistent format: `{ error: "message" }`
- Role-based access: routes check membership role (seeker, helper, admin, super-admin)
- Safety alerts and crisis detection happen server-side in the moderation pipeline

## Frontend Conventions

- Components live in `client/src/components/`
- Pages/views in `client/src/pages/`
- API calls through a centralized service layer
- Inline styles with CSS variables for all styling — global styles in `index.css`
- Mobile-first design is critical — most users access on phones
- Community theming: colors come from community config, applied dynamically

### Bottom Navigation Architecture

- **CommunityLayout** (`client/src/components/CommunityLayout.tsx`) wraps all community-scoped pages
- **BottomNav** (`client/src/components/BottomNav.tsx`) renders the fixed bottom navigation bar
- Bottom nav appears ONLY inside a community — hidden on login, signup, onboarding, chat, admin, and training pages
- Tab count is role-based: seekers get 4 tabs, helpers/admins get 5 tabs (includes Helper tab)
- Community accent color from config is used for active tab highlighting
- Badge indicators (red dots) can be added to tabs via props (e.g., `needsCheckIn` for Check-In tab)

### Key Routes (Community-Scoped)

| Route | Page | Bottom Nav Tab |
|-------|------|----------------|
| `/community/:slug` | CommunityDashboard | Home |
| `/community/:slug/messages` | MessagesPage | Messages |
| `/community/:slug/check-in` | MoodCheckInPage | Check-In |
| `/community/:slug/helper-dashboard` | HelperDashboard | Helper (helpers only) |
| `/settings` | SettingsPage | Settings |

## Critical Safety Rules

This is a mental health platform. Safety is non-negotiable.

- **Crisis detection:** The AI moderation pipeline monitors messages for crisis-level content. Risk levels: `safe`, `mild_concern`, `moderate_concern`, `crisis`. When `moderate_concern` or `crisis` detected, multiple safety actions fire.
- **PeerBot crisis support:** When concerning content is detected, PeerBot sends a warm, supportive message IN the conversation with crisis resources. Community-specific resources (Veterans get 988 Press 1). 5-minute cooldown prevents message spam. Helpers see a subtle notification when resources are shared. See `server/src/services/crisis-support.ts`.
- **Crisis resources:** Defined in `server/src/data/crisis-resources.ts`. Default: 988 Lifeline + Crisis Text Line. Veterans: Veterans Crisis Line (988 Press 1).
- **No PII in webhooks by default:** Webhook payloads do NOT include user PII unless the org admin has explicitly opted in.
- **No PII in push notifications:** Notification content is always generic ("Someone in your community needs support").
- **Anonymous conversations:** Display names only. Real names are NEVER visible in chat contexts.
- **Emergency contacts are always optional:** Never force users to provide emergency contact info. Use warm framing.
- **Webhook security:** All webhook payloads use HMAC signing. Retry logic: 3 attempts with exponential backoff.
- **Mood analytics privacy:** Admin mood endpoints require minimum 5 users for aggregation. Individual mood scores are never exposed to admins — only aggregate averages and anonymous alert patterns (display names only).

## Matching Algorithm

The matching system uses weighted scoring across multiple dimensions:

- Topic relevance (what the seeker needs help with)
- Helper availability and status
- Organization scope (match within org first, then community-wide if allowed)
- Historical interaction quality
- Helper specializations and training

When no human helpers are available AND cross-org matching is exhausted, fall back to PeerBot (AI companion). PeerBot is a supplement, not a replacement, for human connection.

## Common Patterns and Gotchas

### Things Claude Code Gets Wrong (Add to this list!)

- **Keep styling consistent with existing patterns** — use inline styles with CSS variables as established in the codebase
- **Don't hardcode community-specific values** — everything should come from the community config JSONB
- **Don't skip mobile testing** — a recent comprehensive mobile UI overhaul fixed critical privacy violations and usability issues. Always check mobile layouts.
- **Don't modify migration files that have already been run** — create a new migration instead
- **Don't put PII in places it shouldn't be** — notifications, webhooks (unless opted in), public-facing components
- **Use PNG icons, never SVG, for PWA manifest and push notifications** — iOS does not support SVG icons. Always use peerzle-icon-192x192.png and peerzle-icon-512x512.png in client/public/
- **Always wrap the entire SW push handler in event.waitUntil()** — early returns before waitUntil cause iOS to kill the service worker before the notification displays
- **Always run migrations on production after deploying** — Railway auto-deploy does NOT run migrations automatically. Run them manually via `psql $DATABASE_URL -f database/migrations/XXX.sql`
- **Don't forget to update this CLAUDE.md** when you discover new patterns or fix recurring issues

### Development Workflow

1. **Plan first:** Use plan mode. Once the plan is good, the code is good.
2. **Work iteratively:** Focused waves, not giant sweeping changes. Each task gets full attention and context.
3. **Test end-to-end:** Especially for verification systems, reporting mechanisms, and the crisis pipeline.
4. **Commit often:** Consistent GitHub commits with descriptive messages.
5. **Check mobile:** Most users are on phones. Test every UI change at mobile breakpoints.

## Environment Variables

See `.env.example` for the full list. Key ones:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — For token signing
- `ANTHROPIC_API_KEY` — For AI features (PeerBot, safety monitoring, suggestions)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — For Web Push
- `VAPID_SUBJECT` — mailto:support@peerzle.com
- `NODE_ENV` — production/development
- `CLIENT_URL` — Frontend URL for CORS

## Related Repositories

- **peerzle** (this repo) — Main application
- **peerzle-website** (github.com/mtrotta31/peerzle-website) — Marketing site deployed on Vercel

## Community Configurations

Each community has specific requirements:

| Community | Verification | Helper Verification | Branding |
|-----------|-------------|-------------------|----------|
| First Responders | Invite code | Required (trained PSS) | Navy blue |
| Healthcare | Email domain | Optional | TBD |
| Veterans | Attestation | Optional | TBD |
| Higher Education | .edu email | Optional | TBD |
| Employee Wellness | Invite code | Training required | Custom |

## Running Locally

```bash
# Install dependencies (workspaces handle client + server)
npm install

# Set up environment
cp .env.example .env
# Fill in your local values

# Start development
npm run dev          # Starts both client and server
```

## Deploying

- Push to `main` branch triggers Railway deployment
- Run database migrations manually if schema changes are included
- Verify the deployment at peerzle-production.up.railway.app
- Marketing site deploys separately via Vercel from the peerzle-website repo
