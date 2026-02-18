# Feature Spec: Bottom Navigation Bar + App Structure Refactor

## Why This Matters

Peerzle is a PWA used primarily on mobile by firefighters, nurses, and veterans. It currently feels like a mobile website, not a native app. The single biggest change to fix this is a bottom navigation bar — the universal pattern that makes mobile apps feel familiar and navigable.

This is a structural refactor that touches nearly every page inside a community. Execute wave by wave. Each wave ships, gets tested on mobile, and gets committed before the next one starts.

---

## Architecture Decisions

### Bottom Nav Scope
- **Community-scoped only.** The nav appears ONLY when the user is inside a community.
- Outside a community (login, community selector, onboarding) — no bottom nav.
- During active chat — bottom nav hides entirely.

### Tab Structure
**Seekers (4 tabs):**
| Tab | Icon | Destination | Purpose |
|-----|------|-------------|---------|
| Home | Inline SVG: house outline | Community dashboard | Topics, availability, community info |
| Messages | Inline SVG: chat bubble outline | Conversations list | Current + past conversations |
| Check-In | Inline SVG: heart or clipboard-check outline | Mood check-in | Daily mood + history + streak |
| Settings | Inline SVG: gear outline | Settings page | Profile, notifications, resources, emergency contact, privacy |

**Helpers / Both role (5 tabs):**
| Tab | Icon | Destination | Purpose |
|-----|------|-------------|---------|
| Home | Inline SVG: house outline | Community dashboard | Topics, availability, community info |
| Messages | Inline SVG: chat bubble outline | Conversations list | Current + past + pending requests |
| Check-In | Inline SVG: heart or clipboard-check outline | Mood check-in | Daily mood + history + streak |
| Helper | Inline SVG: star or shield outline | Helper dashboard | Stats, compliments, coaching tips |
| Settings | Inline SVG: gear outline | Settings page | Profile, notifications, resources, emergency contact, privacy |

### Role Detection
- Check the user's membership role for the current community
- `seeker` → 4 tabs
- `helper` or `both` → 5 tabs
- `admin` → 5 tabs (admins can help too)

### What Gets Removed
- The top tab row on CommunityDashboard (Home / Past Sessions / Helper Dashboard)
- "Past Sessions" moves into the Messages tab
- "Helper Dashboard" becomes the Helper bottom tab
- Resources page becomes a section inside Settings

### What Stays The Same
- Everything outside a community (login, signup, community selector, onboarding)
- The chat experience itself (ChatPage)
- Admin views (AdminStats, admin panels)
- The Settings page (already built)

---

## Wave 1: Bottom Nav Component + Layout Wrapper

**Goal:** Add the bottom nav bar. All existing pages stay exactly as they are — the nav just appears and links to them. Foundation only.

### Session 1: Backend
No backend changes needed for Wave 1.

### Session 2: Frontend

**Create: `client/src/components/BottomNav.tsx`**
- Fixed position at bottom of screen
- Height: 60px + safe area inset (for iPhone notch)
- Background: white with subtle top border or shadow
- 4 or 5 tabs based on user role in current community
- Active tab highlighted with community accent color
- Each tab: icon + label text (small, below icon)
- Icons: use simple inline SVG icons — outline style, 24x24 viewbox, stroke-based (no external icon library, no emoji). Define each icon as a small React component or inline SVG within BottomNav.
- Hide when: 
  - Not inside a community (no communitySlug in URL)
  - On an active chat page (/community/:slug/chat/:id)
  - On admin pages (/community/:slug/admin/*)

**Create: `client/src/components/CommunityLayout.tsx`**
- Wrapper component that renders children + BottomNav
- Passes communitySlug and userRole to BottomNav
- Adds bottom padding to content area so nothing hides behind the nav
- Used by all community-scoped pages

**Modify: `client/src/App.tsx`**
- Wrap community routes in CommunityLayout
- Routes that should NOT have bottom nav: ChatPage, admin pages, login, signup, onboarding

**Styling:**
- Inline styles with CSS variables (existing pattern)
- Mobile-first — this IS the mobile experience
- z-index high enough to stay above page content
- Safe area padding: `padding-bottom: env(safe-area-inset-bottom)` for iPhone

### Verification
1. Open app on mobile viewport (375px)
2. Navigate into a community — bottom nav appears
3. Tap each tab — navigates to correct page
4. Go to login/signup — no bottom nav
5. Open a chat — bottom nav hides
6. Check with seeker account — 4 tabs
7. Check with helper account — 5 tabs
8. Bottom nav doesn't overlap content (padding correct)

### Commit
```
git add . && git commit -m "Wave 1: Bottom navigation bar component and community layout wrapper"
```

---

## Wave 2: Messages Tab

**Goal:** Consolidate current and past conversations into a single Messages page. Remove "Past Sessions" from the old top tab row.

### Session 1: Frontend

**Create: `client/src/pages/MessagesPage.tsx`**
- Two sub-tabs at top: "Active" and "Past"
- Active tab: shows current/pending conversations (pull from existing ConversationsList logic)
- Past tab: shows completed conversations (pull from existing PastSessions logic)
- Each conversation row shows: peer display name, topic, last message preview, timestamp
- For helpers: pending requests appear at top of Active with visual distinction
- Empty states: "No active conversations" / "No past conversations"
- Tap a conversation → navigates to ChatPage (bottom nav hides)

**Modify: `client/src/App.tsx`**
- Add route: `/community/:slug/messages` → MessagesPage

**Modify: `client/src/components/BottomNav.tsx`**
- Messages tab links to `/community/:slug/messages`

**Modify: `client/src/pages/CommunityDashboard.tsx`**
- Remove "Past Sessions" from the top tab row
- Keep "Home" and "Helper Dashboard" tabs for now (Helper Dashboard moves in Wave 4)

### Verification
1. Open Messages tab — see active conversations
2. Switch to Past sub-tab — see completed conversations
3. Tap a conversation — opens chat, bottom nav hides
4. Back from chat — returns to Messages, bottom nav reappears
5. Helper account: pending requests visible at top
6. Mobile viewport looks clean

### Commit
```
git add . && git commit -m "Wave 2: Messages tab consolidating active and past conversations"
```

---

## Wave 3: Check-In Tab

**Goal:** Wire the existing MoodCheckInPage into the nav and make it a complete standalone experience with history and streak.

### Session 1: Frontend

**Modify: `client/src/pages/MoodCheckInPage.tsx`**
- Should work as standalone page (already does)
- After submitting a check-in, show the mood history below (reuse MoodHistoryPage content)
- Show streak counter prominently
- If already checked in today, show history directly instead of check-in form
- Add "How you've been feeling" section with the dot chart from MoodHistoryPage

**Modify: `client/src/App.tsx`**
- Ensure route exists: `/community/:slug/check-in` → MoodCheckInPage

**Modify: `client/src/components/BottomNav.tsx`**
- Check-In tab links to `/community/:slug/check-in`
- If user hasn't checked in today, show a subtle badge/dot on the Check-In icon (daily habit nudge)

**Modify: `client/src/pages/CommunityDashboard.tsx`**
- Remove the inline "How are you feeling today?" card — it now lives in the Check-In tab
- Keep the dashboard focused on: topics, availability toggle, community info

### Verification
1. Open Check-In tab — see mood check-in form
2. Submit a check-in — form replaced by history view
3. Re-open Check-In tab — shows history (already checked in)
4. Streak counter visible
5. Badge/dot on Check-In icon when not checked in today
6. Home dashboard no longer has mood check-in card
7. Mobile viewport clean

### Commit
```
git add . && git commit -m "Wave 3: Check-In tab with mood history, streak, and daily badge indicator"
```

---

## Wave 4: Cleanup + Resources Migration

**Goal:** Remove the old top tab row, move Resources into Settings, clean up orphaned navigation.

### Session 1: Frontend

**Modify: `client/src/pages/CommunityDashboard.tsx`**
- Remove the top tab row entirely (Home / Past Sessions / Helper Dashboard)
- This page is now just "Home" — the clean community dashboard
- Content: welcome message, topic selection for matching, availability toggle, community announcements/info
- Any helper-specific content that was on the Helper Dashboard tab stays for now (moves to Helper tab in the next feature)

**Modify: `client/src/pages/SettingsPage.tsx`**
- Add a "Resources" collapsible section
- Move resource content (crisis hotlines, articles, community-specific resources) into this section
- Position it logically: Account, Profile, Notifications, Resources, Emergency Contact, Privacy

**Modify: `client/src/App.tsx`**
- Clean up any orphaned routes
- Ensure /community/:slug still routes to CommunityDashboard (now just Home)
- Remove standalone Resources route if it existed

**Modify: `client/src/components/BottomNav.tsx`**
- Settings tab links to `/community/:slug/settings` or `/settings` (whichever the SettingsPage uses)

### Verification
1. Home tab: clean dashboard, no top tab row
2. Settings: Resources section present with crisis hotlines
3. No broken links or orphaned routes
4. All 4 tabs (or 5 for helpers) work correctly
5. Full flow: Home → Messages → Check-In → Settings all functional
6. Active chat still hides bottom nav
7. Admin pages still accessible (separate nav)
8. Mobile viewport clean throughout

### Commit
```
git add . && git commit -m "Wave 4: Remove top tab row, migrate Resources to Settings, clean navigation"
```

---

## Post-Launch: Helper Tab (Separate Feature)

The Helper tab is a dedicated dashboard for helpers to see their impact. Build this AFTER the bottom nav is stable.

**Content for Helper tab:**
- Peers helped (total count)
- Compliment badges received (visual grid)
- Average conversation rating
- Response streak (consecutive days)
- Coaching tips
- Pending help requests

**This pulls from existing data** — Tier 2 already built compliment badges, coaching tips, and helper stats. The tab just gives them a dedicated, motivating home.

---

## Critical Reminders

- **Inline styles with CSS variables** — no Tailwind, no separate CSS files
- **Mobile-first** — test every change at 375px viewport width
- **Safe area insets** — iPhone notch and home indicator must not overlap nav
- **Community theming** — active tab color should use the community's accent color from config
- **Role detection** — check membership role, not user-level role (a user can be seeker in one community and helper in another)
- **Don't break admin** — admin pages should NOT have the bottom nav, keep their existing navigation
- **Smooth transitions** — when tapping tabs, page should feel instant (no full reload)
- **Active state clarity** — it must be immediately obvious which tab you're on
- **Touch targets** — each tab touch area should be at least 44px tall
- **Icon + label** — always show both (SVG icon above text label); icon-only nav is harder for non-tech-savvy users

---

## Testing Checklist (Run After Each Wave)

- [ ] Bottom nav appears inside community
- [ ] Bottom nav hidden outside community (login, selector, onboarding)
- [ ] Bottom nav hidden during active chat
- [ ] Bottom nav hidden on admin pages
- [ ] Correct number of tabs based on role (4 seeker, 5 helper)
- [ ] Active tab visually distinct
- [ ] All tabs navigate to correct pages
- [ ] Content not hidden behind bottom nav (padding correct)
- [ ] iPhone safe area handled (no overlap with home indicator)
- [ ] Works on 375px viewport
- [ ] Page transitions feel instant
- [ ] Back navigation works correctly from each tab
