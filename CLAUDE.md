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
- **Deployment:** Railway (main app + PostgreSQL), Vercel (marketing website)
- **Domains:** app.peerzle.com (application), www.peerzle.com (marketing site)
- **Repo:** github.com/mtrotta31/peerzle

## Project Structure

```
peerzle/
├── client/           # React PWA frontend (Vite + CSS Variables)
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route-level page components
│       ├── hooks/        # Custom React hooks (e.g., usePWAInstallPrompt)
│       ├── services/     # API and service layer
│       └── context/      # React context providers
├── server/           # Node.js/Express backend
├── database/
│   ├── schema.sql    # Base database schema
│   ├── migrations/   # Sequential migration files (001-023+)
│   └── seeds/        # Community seed data
├── .env.example      # Environment variable template
└── CLAUDE.md         # This file
```

## Current State

- **Live at:** app.peerzle.com
- **Database migration:** 023 (always check for the latest before creating new ones)
- **Tier 1:** COMPLETE — 12 core features + community join flow, helper verification, helper training module, password reset, TOS acceptance
- **Tier 2:** COMPLETE — All 5 phases shipped. Matching algorithm with weighted scoring, connection cards with match percentages, mood checks, compliment badges, coaching tips, dynamic suggestions, admin stats summary
- **Tier 3:** COMPLETE — All 5 phases shipped
- **Tier 4:** COMPLETE — Daily Mood Check-Ins + Admin Mood Trend Analytics
- **Settings Page:** COMPLETE — 5 sections (Account, Profile, Notifications, Emergency Contact, Privacy)
- **Bottom Navigation:** COMPLETE — All 5 waves shipped (see below)
- **Demo Community:** COMPLETE — All 4 waves shipped (see below)
- **Communities:** 6 live communities running (including Demo)
- **PWA Install Prompt:** iOS Safari instructions + Android native beforeinstallprompt on login page

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
| 5 | Helper Tab (impact stats, badges, streak, coaching tips, pending requests) | ✅ Complete |

### Demo Community Status

| Wave | Feature | Status |
|------|---------|--------|
| 1 | Demo community with `is_demo` flag, bypass real matching, instant PeerBot connection | ✅ Complete |
| 2 | Demo helper persona (PeerBot acts as trained peer), demo banners, "Try Demo" badge | ✅ Complete |
| 3 | Helper flow simulation (simulated pending requests, PeerBot as seeker, auto-rating) | ✅ Complete |
| 4 | Post-session CTA ("Get in Touch", "Learn More"), `/demo` route with auto-join | ✅ Complete |

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
| `/community/:slug/helper` | HelperPage | Helper (helpers only) |
| `/community/:slug/helper-dashboard` | HelperDashboard | - (verification workflows) |
| `/community/:slug/settings` | SettingsPage | Settings |

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
- **Mood check-in notifications:** Daily reminders sent at 14:00 UTC (~11 AM EST). Scheduler runs every 15 minutes, checks for users who haven't checked in today and haven't been notified. See `server/src/services/mood-checkin-scheduler.ts`.

## Matching Algorithm

The matching system uses weighted scoring across multiple dimensions:

- Topic relevance (what the seeker needs help with)
- Helper availability and status
- Organization scope (match within org first, then community-wide if allowed)
- Historical interaction quality
- Helper specializations and training

When no human helpers are available AND cross-org matching is exhausted, fall back to PeerBot (AI companion). PeerBot is a supplement, not a replacement, for human connection.

## Demo Community

The Demo community (`slug: demo`, `is_demo: true`) provides a sandbox for users to experience Peerzle without affecting real users. Demo communities are sorted to appear first on the CommunitiesPage.

### Demo Seeker Experience (Wave 1-2)
- When a seeker starts a conversation in demo community, matching is bypassed
- PeerBot instantly connects using the **demo helper persona** (acts as trained peer supporter, never says it's AI)
- Connection card shows generated helper name, random match score (78-95%), shared topics
- Demo banner appears: "Demo Mode — Chatting with an AI helper to show you how Peerzle works"

### Demo Helper Experience (Wave 3)
- When helper toggles "Available" in demo community, a simulated help request appears after 10-15 seconds
- Request has random topic, generated seeker name, match score (70-90%)
- PeerBot acts as the **demo seeker persona** (hesitant at first, opens up, expresses gratitude after 5-8 exchanges)
- When conversation ends, PeerBot auto-submits positive rating (4-5 stars) and 1-2 compliment badges

### Post-Session CTA + /demo Route (Wave 4)
- After demo conversation ends (seeker or helper), show CTA card instead of standard "What's Next?" card
- CTA includes: "Get in Touch" (mailto:matt.trotta31@gmail.com) and "Learn More" (www.peerzle.com/for-organizations)
- `/demo` route auto-joins demo community: unauthenticated users → login with returnTo → auto-join → redirect to /community/demo
- LoginPage and SignupPage support `returnTo` query parameter for post-auth redirects

### Key Implementation Details
- `communities.is_demo` — Flag that triggers demo behavior (migration 021)
- `conversations.is_demo_seeker` — Flag for helper-side demo (PeerBot is the seeker) (migration 022)
- `moderation_result.demo_helper` — Marks messages from demo helper persona
- `moderation_result.demo_seeker` — Marks messages from demo seeker persona
- Demo messages display with proper names (not "PeerBot") and no bot avatar
- `/demo` route: `DemoRedirect.tsx` handles auth check, auto-join, and redirect
- Post-session CTA: Conditional rendering in ChatPage "What's Next?" card based on `conversation.is_demo`

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
- **When generating AI responses for a new role, seed with context** — Empty message arrays cause the AI to default to helper behavior. Seed with a fake message from the other party so the AI knows its role (e.g., demo seeker needs a fake helper greeting first).
- **LEFT JOIN for nullable foreign keys** — When a column can be NULL (like `seeker_membership_id` for demo seeker conversations), use LEFT JOIN not INNER JOIN, and handle NULL in WHERE conditions (`column IS NULL OR column != value`).
- **Demo messages need special frontend handling** — Check `moderation_result.demo_helper` and `moderation_result.demo_seeker` flags to display proper names instead of "PeerBot" and hide the bot avatar.
- **Demo helper responses need `is_demo` flag** — When triggering PeerBot in demo communities, pass `{ isDemo: true }` to `generatePeerBotResponse` and set `demo_helper: true` in moderation_result so frontend displays helper persona name instead of "PeerBot".
- **API responses must include `is_demo` when needed** — The `endConversation` endpoint must return `is_demo` from the community so the frontend can show the demo CTA instead of the standard "What's Next?" card.
- **Same-origin deployment requires relative URLs** — In production, frontend and API are served from app.peerzle.com. The client uses `import.meta.env.PROD` to detect production builds and uses empty string for API baseURL (relative URLs like `/api/auth/login`). Never hardcode absolute URLs for API calls.
- **Marketing site requires www subdomain** — Links to the marketing site must use `www.peerzle.com` (not `peerzle.com`) for proper routing. The marketing site is a client-side SPA that requires the www subdomain.
- **PWA install prompt uses localStorage** — The `pwa-install-dismissed` key tracks if user dismissed the install prompt. The `usePWAInstallPrompt` hook handles platform detection (iOS Safari vs Android Chrome), standalone mode detection, and the `beforeinstallprompt` event for native Android install.
- **Seed files must explicitly set `is_active = true`** — Community seed files should include `is_active = true` in the INSERT. Many API routes filter by `is_active = true`, so communities without this flag won't work properly. The super-admin CommunityManagement page uses `getInviteCodes` which hits a non-super-admin route that filters by `is_active`.
- **Super-admin topic templates in SuperAdminPanel.tsx** — When adding new community types, add a topic template to `TOPIC_TEMPLATES` object and a corresponding `<TemplateButton>` in the Create Community modal. Current templates: First Responders, Healthcare, Veterans, Education, Employee Wellness, Epilepsy.

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
| Epilepsy | Open | Required | Purple (#7B2D8E) |
| **Peerzle Demo** | Open | Not required | Blue (#2B7CF6) |

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
- Verify the deployment at app.peerzle.com
- Marketing site deploys separately via Vercel from the peerzle-website repo

### Domain Setup

| Domain | Service | Purpose |
|--------|---------|---------|
| app.peerzle.com | Railway | Main application (frontend + API, same-origin) |
| www.peerzle.com | Vercel | Marketing website |
| peerzle.com | Redirects to www | Marketing site canonical URL |

### Same-Origin Architecture

The frontend and API are served from the same domain (app.peerzle.com):
- **Production:** API calls use relative URLs (`/api/...`) — no CORS needed
- **Development:** Vite proxy forwards `/api` to `localhost:3001`, or `VITE_API_URL` can be set
- **WebSockets:** Socket.io connects to same origin in production

This is configured in:
- `client/src/services/api.ts` — uses `import.meta.env.PROD` to detect production
- `client/src/services/socket.ts` — same pattern for WebSocket URL
- `server/src/app.ts` — helmet CSP configured to allow WebSocket connections
