# Feature Spec: Daily Mood Check-Ins + Admin Mood Trend Analytics

## Overview

This feature adds two connected capabilities to Peerzle:

1. **Daily Mood Check-Ins** — A standalone mood check that users complete outside of conversations, triggered by a daily push notification. This creates a habit loop, normalizes app usage, and generates continuous wellness data.

2. **Admin Mood Trend Analytics** — A dashboard view for org admins and super-admins that visualizes mood data over time (both conversation-triggered and standalone check-ins), identifies concerning trends, and enables early intervention before crises occur.

Together, these transform Peerzle from a reactive support tool into a proactive early warning system — the single most important capability for B2B sales.

---

## Why This Matters

- Current mood checks only happen during conversations, meaning data is only collected when someone is already in distress
- Daily check-ins generate data continuously, even from users who never start a conversation
- Admins currently have no visibility into emotional trends across their organization
- The sales pitch shifts from "here's a support tool" to "here's a real-time wellness pulse for your entire team"
- NAMI research: peer support reduces hospitalization by 40%. Daily check-ins let us demonstrate engagement and early detection to buyers with hard data.

---

## Implementation Plan

### This is a two-wave build. Complete Wave 1 fully before starting Wave 2.

---

## Wave 1: Daily Mood Check-Ins

### Database (Migration 018)

New table: `mood_checkins`

```sql
CREATE TABLE mood_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  community_id UUID NOT NULL REFERENCES communities(id),
  organization_id UUID REFERENCES organizations(id),
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  -- 1 = Much Worse, 2 = Slightly Down, 3 = Neutral, 4 = Okay, 5 = Good
  source VARCHAR(20) NOT NULL DEFAULT 'standalone',
  -- 'standalone' = daily check-in, 'conversation' = existing pre-conversation mood check
  note TEXT,
  -- Optional: short text the user can add ("rough day at work", etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mood_checkins_user ON mood_checkins(user_id, created_at DESC);
CREATE INDEX idx_mood_checkins_org ON mood_checkins(organization_id, created_at DESC);
CREATE INDEX idx_mood_checkins_community ON mood_checkins(community_id, created_at DESC);
```

**Important:** Also backfill existing conversation mood checks into this table with source = 'conversation' so that all mood data lives in one place. Write the backfill as part of the migration.

### Backend

**New API Routes:**

- `POST /api/mood-checkins` — Submit a standalone mood check-in
  - Body: `{ mood_score: 1-5, note?: string, community_id: uuid }`
  - Auto-populates user_id from JWT, organization_id from membership
  - Returns: `{ id, mood_score, created_at }`

- `GET /api/mood-checkins/me` — Get current user's mood history
  - Query params: `?days=30` (default 30, max 90)
  - Returns: array of check-ins with date and score
  - Used to show the user their own trend

- `GET /api/mood-checkins/streak` — Get current user's check-in streak
  - Returns: `{ current_streak: number, longest_streak: number }`
  - Encourages daily engagement

**Update Existing Code:**

- Update the existing conversation mood check flow to ALSO write to the `mood_checkins` table with `source = 'conversation'` so all data is unified

**Push Notification Scheduler:**

- New cron job or scheduled task that sends a daily push notification
- Notification content: "How are you feeling today? Quick 10-second check-in 💙" (no PII)
- Configurable per community/organization (some orgs may want morning, others evening)
- Default time: 9:00 AM in the user's timezone (or fallback to organization timezone)
- Respect user preferences: users can disable daily check-in notifications in settings
- Do NOT send if the user already submitted a check-in today

**Smart Follow-Up (PeerBot Nudge):**

- If a user checks in as "Much Worse" (1) for 3 consecutive days, trigger a PeerBot message:
  - "Hey — you've been having a tough stretch. No pressure, but if you want to talk to someone who gets it, I can help you connect. 💙"
  - This is a push notification + in-app message, not an automatic conversation start
  - The user chooses whether to engage — no forced interactions

### Frontend

**New Screen: Standalone Mood Check-In**

- Accessible from: push notification tap, home screen quick action, navigation
- Reuse the existing mood check emoji scale UI (Much Worse → Good)
- Add optional note field below the emojis: "Want to add a quick note? (optional)"
  - Placeholder text: "e.g., rough shift, good day with family..."
  - Max 200 characters
- After submission: brief confirmation animation, then show streak count
  - "Day 5 check-in streak! 🔥" or "Thanks for checking in 💙"
- Mobile-first: this screen should be completable in under 10 seconds

**New Screen: My Mood History (User-Facing)**

- Simple line graph or dot chart showing the user's mood over the last 30 days
- Conversation-triggered check-ins and standalone check-ins both appear (labeled differently)
- Accessible from user profile/settings area
- This is for the USER to see their own patterns — not the admin view (that's Wave 2)

**Home Screen Addition:**

- Add a "How are you feeling today?" card to the home/dashboard screen
- If the user hasn't checked in today: show the emoji scale inline (tap to submit)
- If they already checked in today: show "Checked in today ✓" with their streak

### Verification (Wave 1)

After building, verify by doing the following:

1. Start the dev server and open the app on mobile viewport
2. Submit a standalone mood check-in — confirm it saves to the database
3. Submit a check-in via the normal conversation flow — confirm it ALSO writes to mood_checkins with source = 'conversation'
4. Check the user mood history screen — confirm both types appear
5. Submit check-ins for 3+ days — confirm streak counting works
6. Verify push notification sends correctly (test with a real device if possible)
7. Confirm that submitting a check-in today suppresses the next push notification
8. Test the PeerBot nudge by manually inserting 3 consecutive "Much Worse" records

---

## Wave 2: Admin Mood Trend Analytics

### Do not start Wave 2 until Wave 1 is fully verified and committed.

### Backend

**New Admin API Routes:**

- `GET /api/admin/mood-trends` — Aggregate mood data for admin dashboard
  - Query params: `?period=7d|30d|90d&organization_id=uuid`
  - Role check: org admins see only their org, community admins see all orgs, super-admins see everything
  - Returns:
    ```json
    {
      "summary": {
        "avg_mood_current": 3.2,
        "avg_mood_previous": 3.5,
        "trend": "declining",
        "total_checkins": 847,
        "participation_rate": 0.72,
        "critical_alerts": 3
      },
      "daily_averages": [
        { "date": "2026-02-15", "avg_mood": 3.4, "checkin_count": 45 },
        { "date": "2026-02-14", "avg_mood": 3.1, "checkin_count": 52 }
      ],
      "distribution": {
        "much_worse": 0.05,
        "slightly_down": 0.18,
        "neutral": 0.35,
        "okay": 0.28,
        "good": 0.14
      },
      "topic_correlation": [
        { "topic": "Burnout", "avg_mood": 2.1, "volume": 34 },
        { "topic": "Work-Life Balance", "avg_mood": 2.8, "volume": 22 }
      ]
    }
    ```

- `GET /api/admin/mood-alerts` — Users with concerning patterns
  - Returns users (by display name only, no PII unless org opted in) who have:
    - 3+ consecutive "Much Worse" check-ins
    - Significant mood decline over 7 days (drop of 1.5+ points in average)
    - No check-in for 7+ days after previously being active (disengagement signal)
  - This does NOT expose individual mood data — only flags patterns

**Privacy Constraints (Critical):**

- Admin endpoints NEVER return individual user mood scores
- All data is aggregated — minimum 5 users per data point to prevent identification
- If an organization has fewer than 5 active users, show "Not enough data for trends" instead of partial data
- Mood alerts show display names only (real names only if org has opted into PII visibility for safety)
- This follows the same privacy model as existing admin stats

### Frontend

**Admin Dashboard: Mood Trends Panel**

Add a new section to the existing admin dashboard. This is NOT a separate page — it integrates into the existing admin stats view.

Components:

- **Wellness Pulse Score** — Large number showing current average mood (e.g., "3.2 / 5.0") with trend arrow (↑ improving, ↓ declining, → stable) and comparison to previous period
- **Mood Trend Chart** — Line chart showing daily average mood over the selected period (7d / 30d / 90d toggle). Use a simple chart library or canvas — don't add a heavy dependency.
- **Participation Rate** — Percentage of members who have checked in at least once in the selected period. Shows engagement health.
- **Mood Distribution** — Horizontal bar chart or donut showing the percentage breakdown across the 5 mood levels for the period
- **Topic Correlation** — Table showing which conversation topics correlate with the lowest average mood scores. This tells admins what their people are struggling with most.
- **Attention Needed** — List of flagged patterns from the mood-alerts endpoint. Each item shows the display name, the pattern detected, and a subtle "This member may benefit from outreach" message. No individual scores.

**Period Selector:**

- Toggle between 7 days, 30 days, 90 days
- Default to 30 days

**Org Admin vs. Super Admin:**

- Org admins see data filtered to their organization only
- Super admins see a community-wide view with an organization dropdown to drill into specific orgs

### Verification (Wave 2)

After building, verify by doing the following:

1. Seed the database with 30 days of mock mood check-in data across multiple users and organizations (write a seed script)
2. Log in as an org admin — confirm you see ONLY your organization's data
3. Log in as a super admin — confirm you see community-wide data and can filter by org
4. Confirm the 5-user minimum privacy threshold: create an org with 3 users, verify it shows "Not enough data"
5. Verify the mood alerts correctly flag 3+ consecutive "Much Worse" patterns
6. Verify the trend chart renders correctly on mobile viewport
7. Switch between 7d / 30d / 90d and confirm data updates
8. Confirm no individual user mood scores are exposed in any admin API response

---

## What to Update After Shipping

- **CLAUDE.md:** Add `mood_checkins` to the Key Tables section. Note the privacy constraints for admin mood endpoints. Update Tier status.
- **Admin dashboard:** This is now the most important page for B2B demos. Make sure it loads fast and looks polished.
- **Website:** The mood trend analytics capability should be added to the "What You Get as an Organization" section on the /for-organizations page.

---

## Claude Code Session Structure

Following our best practices, here's how to run this in Claude Code:

### Session 1: Wave 1 — Backend + Database
```
Read CLAUDE.md first. Then read this feature spec (paste or reference file).

We're building Wave 1 of the Daily Mood Check-In feature. Start with:
1. Database migration 018 (check current migration number first)
2. New API routes for mood check-ins
3. Update existing conversation mood check to also write to the new table
4. Push notification scheduler for daily check-ins
5. PeerBot nudge logic for 3 consecutive "Much Worse" check-ins

Give me a plan before writing any code. Once I approve the plan,
implement it. After implementation, start the server and test every
endpoint with curl to verify they work.
```

### Session 2: Wave 1 — Frontend
```
Read CLAUDE.md first. Wave 1 backend for mood check-ins is complete.

Now build the frontend:
1. Standalone mood check-in screen (reuse existing emoji scale UI)
2. User mood history screen (simple trend visualization)
3. Home screen "How are you feeling?" card
4. Streak display after check-in submission

Give me a plan before writing any code. After implementation, start
the dev server and verify every screen on mobile viewport.
```

### Session 3: Wave 2 — Backend
```
Read CLAUDE.md first. Wave 1 (daily mood check-ins) is fully shipped.

Now build Wave 2 admin backend:
1. Admin mood trends API endpoint (aggregated data)
2. Admin mood alerts API endpoint (concerning patterns)
3. Privacy constraints: 5-user minimum, no individual scores, display names only
4. Seed script with 30 days of mock data for testing

Plan first. After implementation, test with curl as both org admin
and super admin to verify role-based filtering.
```

### Session 4: Wave 2 — Frontend
```
Read CLAUDE.md first. Wave 2 backend is complete.

Build the admin mood trends dashboard panel:
1. Wellness Pulse Score with trend indicator
2. Mood trend line chart (7d/30d/90d)
3. Participation rate, mood distribution, topic correlation
4. Attention Needed alerts list
5. Org admin vs super admin view switching

Plan first. After implementation, verify on mobile viewport.
Test with the seeded mock data.
```
