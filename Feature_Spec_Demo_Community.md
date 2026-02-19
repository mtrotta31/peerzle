# Feature Spec: Demo Community

## The Problem

Peerzle has a chicken-and-egg problem for sales demos. Decision-makers (fire chiefs, HR directors, wellness coordinators) can't experience the platform without real helpers online. You can't show the matching flow, the chat experience, or the helper features without someone on the other end.

## The Solution

A **Demo Community** where anyone can sign up and experience the full Peerzle flow end-to-end. Instead of matching with a real human helper, the system routes all conversations to **PeerBot acting as a trained peer helper** — not as a "waiting room companion," but as if it were a real peer supporter having an authentic conversation.

The demo user goes through the exact same onboarding, topic selection, matching animation, and chat experience that a real user would. The only difference is who's on the other end.

---

## User Experience

### For the Demo User (Seeker)

1. **Sign up** — standard registration flow
2. **Join Demo Community** — open join (no invite code required), or use code `DEMO`
3. **Onboard** — same flow as any community: display name, avatar, topics, experience ratings
4. **Choose a topic** — same topic selection cards as production communities
5. **Matching animation plays** — "Finding your best match..." with the standard search animation
6. **After a short delay (3-5 seconds)** — "match found" animation plays
7. **Connection card appears** — shows a generated helper display name (e.g., "SupportiveSam42"), match percentage (randomized 78-95%), shared topics
8. **Chat opens** — PeerBot responds AS the helper, using the helper persona (not the "I'm PeerBot" persona)
9. **Full chat features work** — conversation starters, suggestions, Report button, End Session
10. **End session** — standard rating flow, mood check, compliment badges
11. **Demo banner visible throughout** — subtle but clear indicator this is a demo

### For the Demo User (Helper)

If someone chooses to be a helper in the demo community:
1. **Go available** — toggle works as normal
2. **Receive a simulated request** — after a short delay, a "pending request" appears from a demo seeker (actually PeerBot playing seeker role)
3. **Accept and chat** — PeerBot acts as a seeker sharing a concern related to the topic
4. **Experience the helper tools** — coaching tips, conversation starters, helper guide
5. **Session ends** — PeerBot gives a rating and compliment badge to the helper

---

## Technical Implementation

### Phase 1: Demo Community Setup + Seeker Flow (Build First)

#### 1A. Create Demo Community (Seed Data)

Add a new community to the seeds:

```
name: "Peerzle Demo"
slug: "demo"
description: "Experience Peerzle firsthand. This is a guided demo — you'll chat with our AI helper."
join_method: "open" (no invite code required) OR invite_code: "DEMO"
is_demo: true (new flag)
accent_color: Peerzle brand blue (#2B7CF6)
topics: ["Stress Management", "Work-Life Balance", "Burnout", "General Support", "Anxiety", "Feeling Overwhelmed"]
```

#### 1B. Database Changes

**Migration 021: Add demo flag to communities**

```sql
ALTER TABLE communities ADD COLUMN is_demo BOOLEAN DEFAULT false;
UPDATE communities SET is_demo = true WHERE slug = 'demo';
```

No other schema changes needed — the existing conversation, message, and membership tables handle everything.

#### 1C. Backend: Demo-Aware Matching

**File: `server/src/routes/conversations.ts`** (or wherever matching lives)

When a seeker starts a conversation in a demo community (`is_demo = true`):

1. **Skip the real matching algorithm entirely**
2. Create a conversation record with `status: 'active'` immediately
3. Set the helper to a system "DemoHelper" account (see below)
4. After a **3-5 second delay** (simulated matching), emit the "match found" socket event
5. Generate a fake connection card:
   - Display name: randomly generated (e.g., "CalmMountain88", "WarmOcean42")
   - Match percentage: random between 78-95%
   - Shared topics: pick 1-2 from the seeker's selected topics
6. PeerBot begins responding using the **Demo Helper Persona** (see below)

**System DemoHelper Account:**
- Create a special user account for demo conversations (like PeerBot has one)
- Display name rotates per conversation (not always "PeerBot")
- This account is never visible to real users outside demo community

#### 1D. PeerBot Demo Helper Persona

**New system prompt for demo mode** (distinct from the current PeerBot "waiting room" prompt):

```
You are a trained peer supporter on Peerzle, a peer-to-peer support platform. 
You are chatting with someone who selected the topic: {topic}.

Your role:
- Act as a warm, empathetic peer helper having a genuine conversation
- You are NOT an AI assistant — you are demonstrating what a real peer conversation feels like
- Use active listening, reflect feelings, ask open-ended questions
- Share brief, relatable experiences when appropriate (keep them generic and believable)
- Use the coaching tips naturally: validate feelings before offering solutions, ask before advising
- Keep responses conversational length (2-4 sentences typical, occasionally longer)
- If they seem to be testing the platform rather than sharing real concerns, gently play along and show the depth of conversation possible

Do NOT:
- Say you are an AI or a bot
- Say you are a demo
- Provide clinical advice or diagnoses  
- Break character as a peer supporter

Community: {community_name}
Topic: {topic}
Seeker's display name: {seeker_display_name}

Start by warmly greeting them and asking what's been on their mind.
```

**Important nuance:** The demo banner on the UI already tells the user this is a demo. PeerBot doesn't need to remind them — it should feel as real as possible so they can evaluate the experience.

#### 1E. Frontend: Demo Banner

**Add to ChatPage.tsx and CommunityDashboard.tsx** when community `is_demo`:

```
┌─────────────────────────────────────────┐
│ 🎯 Demo Mode — Chatting with an AI     │
│ helper to show you how Peerzle works    │
└─────────────────────────────────────────┘
```

- Subtle blue/gray banner, not alarming
- Appears at top of chat and dashboard
- Ensures transparency without breaking immersion

#### 1F. Frontend: Community Selector

The Demo community should appear in the community selector with a distinct look:
- Badge or label: "Try It" or "Demo"
- Description: "Experience Peerzle — chat with our AI helper"
- Positioned prominently (first or last in the list)

---

### Phase 2: Helper Flow Simulation (Build Second)

#### 2A. Simulated Help Request

When a helper in the demo community toggles "Available":

1. After a **10-15 second delay**, generate a simulated pending request
2. The request shows:
   - Topic: randomly selected from community topics
   - Display name: randomly generated seeker name
   - Match score: random 70-90%
3. Helper accepts → conversation opens with PeerBot acting as the **Demo Seeker Persona**

#### 2B. PeerBot Demo Seeker Persona

```
You are someone seeking peer support on Peerzle. You selected the topic: {topic}.

Your role:
- Act as a person dealing with {topic}-related stress
- Share your concerns naturally, as a real person would
- Start somewhat hesitant, then open up as the helper responds well
- Respond to the helper's questions and reflect on their suggestions
- Be authentic but not dramatic — this is everyday stress, not crisis
- After 5-8 exchanges, express that the conversation has been helpful

Do NOT:
- Mention anything about being a demo or AI
- Express crisis-level distress (this is a demo, keep it moderate)
- Be overly complimentary in ways that feel fake

Topic: {topic}
Helper's display name: {helper_display_name}
```

#### 2C. Auto-Rating After Session

When a demo seeker conversation ends:
- PeerBot automatically submits a positive rating (4-5 stars)
- Selects 1-2 compliment badges relevant to the conversation
- This lets the helper immediately see the feedback/badge system working

---

### Phase 3: Polish + Sales Integration

#### 3A. Demo Analytics (Admin View)

Track demo usage for sales insights:
- How many people tried the demo
- Average demo session length
- Which topics were most selected
- Conversion: demo user → joined a real community

#### 3B. CTA After Demo Session

After a demo conversation ends, show a targeted prompt:

```
┌─────────────────────────────────────────┐
│ You just experienced Peerzle!           │
│                                         │
│ Want to bring this to your              │
│ organization?                           │
│                                         │
│ [Request a Demo Call]  [Learn More]     │
└─────────────────────────────────────────┘
```

- "Request a Demo Call" → opens email to matt.trotta31@gmail.com or Formspree form
- "Learn More" → links to peerzle.com/for-organizations

#### 3C. Shareable Demo Link

Create a direct URL path: `app.peerzle.com/demo` that:
1. If not logged in → redirects to signup with demo community pre-selected
2. If logged in but not in demo → auto-joins demo community
3. If already in demo → goes to demo dashboard

This gives you a single link to share in emails, on the website, and in meetings.

---

## Implementation Order

| Wave | What | Effort | Priority |
|------|------|--------|----------|
| **Wave 1** | Demo community seed + is_demo flag + demo-aware matching (skip real matching, instant PeerBot) | Medium | **Build first** |
| **Wave 2** | Demo Helper PeerBot persona + connection card generation + demo banner | Medium | **Build second** |
| **Wave 3** | Helper flow simulation (simulated requests + seeker persona) | Medium | Build third |
| **Wave 4** | Post-session CTA + /demo route + analytics | Light | Build last |

---

## Key Design Decisions

1. **PeerBot doesn't say it's AI in chat** — the UI banner handles transparency. The conversation should feel authentic so buyers can evaluate the actual experience.

2. **Open join, no invite code** — minimize friction. Anyone should be able to try it. Alternatively, use `DEMO` as a simple code if you want light gating.

3. **Real onboarding flow** — don't skip steps. The buyer needs to see the full experience including onboarding, topic selection, and matching animation.

4. **Simulated matching delay** — don't instant-match. The 3-5 second "finding your match" animation is part of the experience. It builds anticipation and shows the matching system exists.

5. **Generated helper names, not "PeerBot"** — the connection card should show a realistic display name, not "PeerBot." The banner already discloses it's a demo.

6. **Demo conversations don't count in real analytics** — filter `is_demo` communities from admin dashboards showing aggregate platform stats.

7. **Full feature access** — mood check-ins, compliment badges, conversation starters, helper tools all work in demo. Every feature should be testable.

---

## What This Unlocks

- **Self-serve demos**: Send anyone a link, they experience Peerzle themselves
- **Sales meetings**: "Try it right now" instead of showing slides
- **Website integration**: "Try Peerzle Free" button on peerzle.com
- **Conference booths**: Hand someone your phone, 2 minutes later they've experienced the product
- **Investor demos**: Show the product working without needing staged users
