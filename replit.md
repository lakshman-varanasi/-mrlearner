# LearnAI - AI-Powered Learning Platform

## Overview

LearnAI is a full-stack web application that helps users build consistent study habits using AI. It includes adaptive learning, exam prediction, test mode, analytics, and an AI-powered planner.

## Tech Stack

- **Frontend**: React 19, Vite 6, TailwindCSS 4, React Router 7
- **Backend**: Express (TypeScript via tsx), served from `server.ts`
- **AI**: Google Gemini API (`@google/genai`)
- **Auth & Database**: Firebase (Firestore + Firebase Auth)
- **Build System**: npm, tsx for TypeScript execution

## Project Structure

```
├── server.ts              # Express server (API + Vite middleware in dev)
├── vite.config.ts         # Vite configuration
├── firebase-applet-config.json  # Firebase project config
├── firestore.rules        # Firestore security rules
├── src/
│   ├── App.tsx            # Root React component with routing
│   ├── main.tsx           # React entry point
│   ├── firebase.ts        # Firebase initialization
│   ├── types.ts           # TypeScript types
│   ├── index.css          # Global styles
│   ├── components/        # Shared components (Layout, FirebaseProvider, etc.)
│   ├── pages/             # Route-level pages
│   └── lib/               # Utility functions (AI, chat, Firestore helpers)
```

## Development

- **Start**: `npm run dev` → runs `tsx server.ts`
- **Port**: 5000 (combined frontend + API server)
- **Host**: `0.0.0.0` (required for Replit proxy)

## API Routes

- `POST /api/auth/forgot-password` — sends OTP for password reset
- `POST /api/auth/verify-otp` — verifies OTP
- `POST /api/auth/reset-password` — resets password via Firebase Admin

## Environment Variables

- `GEMINI_API_KEY` — Required for Gemini AI features (set as Replit secret)
- `EMAIL_USER` / `EMAIL_PASS` — Optional, for real OTP email sending via Gmail
- `NODE_ENV` — Controls dev vs production mode

## Firebase

Firebase project: `gen-lang-client-0290964520`
Firestore DB: `ai-studio-7430df4a-c4ac-44b2-916f-7650551e54e9`

## Deployment

Configured for autoscale deployment:
- Build: `npm run build`
- Run: `node --import tsx/esm server.ts`
- Production mode serves built `dist/` folder statically

## Notes

- `intelligence-utils.ts` lazily initializes the GoogleGenAI client to avoid crashes when `GEMINI_API_KEY` is not set
- All other Gemini usages are inside async functions (safe)
- Firebase Admin is initialized in `server.ts` for password reset functionality

## Firebase: Authorized Domains (IMPORTANT)

Google Sign-In requires the Replit dev domain to be whitelisted in Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com) → Authentication → Settings → Authorized Domains
2. Add: `6cab7a76-9ce9-464c-ba7a-7dd6f8c1bd71-00-cb1szwnkk2ro.sisko.replit.dev`
3. For production deployment, also add the `.replit.app` domain

The app handles this error gracefully — if the domain isn't authorized, a clear error message and link to Firebase Console is shown. Email/password auth works without this step.

## UI Architecture (Updated)

- **NextStepCard**: Smart contextual CTA shown at top of Dashboard — analyzes pending tasks, exam dates, and plan progress to surface the most relevant next action
- **Dashboard**: Shows NextStepCard → Today's Tasks → Mr. Planner → Recommendations → AI Prediction
- **Layout**: Simplified navigation — primary nav (Dashboard, Exams, Mr. Learner, Mr. Tester, Analytics) + secondary (Exam Prediction, Settings)
- **Recommendations**: "Recommended for you / Based on your progress" section dynamically built from user data
