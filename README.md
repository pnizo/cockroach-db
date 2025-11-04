This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Setup

This project supports multiple environments: **Development**, **Staging**, and **Production**.

### 1. Environment Configuration Files

The project includes the following environment template files:

- `.env.example` - Main template with all required variables
- `.env.local.example` - Template for local development
- `.env.staging.example` - Template for staging environment
- `.env.production.example` - Template for production environment

### 2. Setting Up Your Local Environment

For local development:

```bash
# Copy the local environment template
cp .env.local.example .env.local

# Edit .env.local and fill in your actual values
# Make sure to configure:
# - DATABASE_URL: Your local CockroachDB connection string
# - GMAIL_USER & GMAIL_APP_PASSWORD: For email features
# - GOOGLE_* variables: For calendar integration
```

### 3. Environment Variables

Key environment variables:

- `NODE_ENV` - Node environment (development | production)
- `NEXT_PUBLIC_APP_ENV` - Application environment (development | staging | production)
- `DATABASE_URL` - CockroachDB connection string
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` - Gmail SMTP configuration
- `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` - Google Calendar API
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` - Basic authentication
- `CRON_SECRET` - Vercel cron job secret

### 4. Running Different Environments

```bash
# Development (default)
npm run dev

# Staging environment locally
npm run dev:staging

# Production environment locally
npm run dev:production
```

### 5. Building for Different Environments

```bash
# Development build
npm run build

# Staging build
npm run build:staging

# Production build
npm run build:production
```

### 6. Starting the Production Server

```bash
# Start with default environment
npm run start

# Start for staging
npm run start:staging

# Start for production
npm run start:production
```

### 7. Environment Detection

The application uses `lib/config.ts` to manage environment-specific configuration. You can import and use it in your code:

```typescript
import { config, getEnvironment } from '@/lib/config';

// Check current environment
if (config.isProduction) {
  // Production-specific code
}

// Access configuration
console.log(config.database.url);
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
