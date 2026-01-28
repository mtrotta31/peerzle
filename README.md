# Peerzle

Multi-community peer support platform connecting people with trained peer supporters within industry-specific networks.

## Overview

Peerzle enables organizations (First Responder agencies, Healthcare systems, Veteran services, etc.) to provide anonymous peer support to their members. Each community has its own branding, terminology, topics, and verification requirements.

### Key Concepts

- **Community**: An industry-based peer support network (e.g., First Responders, Healthcare Workers, Veterans)
- **Seeker**: A community member looking for peer support
- **Helper**: A trained peer supporter providing support
- **Topics**: Support categories within a community (anxiety, burnout, PTSD, etc.)
- **Organization**: A partner organization that manages one or more communities

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (PWA)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15+
- **AI**: Claude API (Anthropic) for content moderation and helper assistance

## Project Structure

```
peerzle/
├── client/                 # React PWA frontend
│   ├── public/            # Static assets, PWA manifest
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level components
│       ├── hooks/         # Custom React hooks
│       ├── services/      # API client
│       ├── context/       # React context providers
│       ├── types/         # TypeScript definitions
│       └── utils/         # Helper functions
│
├── server/                 # Express API server
│   └── src/
│       ├── controllers/   # Route handlers
│       ├── middleware/    # Auth, validation, errors
│       ├── models/        # Database queries
│       ├── routes/        # API route definitions
│       ├── services/      # Business logic + Claude integration
│       ├── types/         # TypeScript definitions
│       └── config/        # Environment config
│
└── database/              # PostgreSQL schema
    ├── migrations/        # Versioned schema changes
    ├── seeds/             # Sample data
    └── schema.sql         # Core schema definition
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mtrotta31/peerzle.git
   cd peerzle
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Create database and run schema:
   ```bash
   createdb peerzle
   psql -d peerzle -f database/schema.sql
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

   This starts:
   - API server at http://localhost:3001
   - React dev server at http://localhost:5173

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `communities` | Industry-based peer support networks |
| `users` | Platform-level user accounts |
| `memberships` | User's role and profile within a community |
| `conversations` | Peer support sessions between seeker and helper |
| `messages` | Chat messages with AI moderation results |
| `organizations` | Partner orgs managing communities |

### Future Tables

| Table | Purpose |
|-------|---------|
| `alert_configurations` | Crisis/safety alert routing rules |
| `alert_events` | Record of triggered alerts |
| `events` | Analytics and ML training data |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server in development |
| `npm run dev:server` | Start only the API server |
| `npm run dev:client` | Start only the React client |
| `npm run build` | Build both client and server for production |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint on all workspaces |
| `npm run test` | Run tests in all workspaces |

## License

Proprietary - All rights reserved
