GLOB ERP — PRIVACY + AI FIX (LOCAL CODE; NOT YET LIVE)

Replace/add EVERY file from security-ai-fix.zip at its exact GitHub path.
Do not paste one file into a differently named path.

Backend:
  backend/src/config/publicOrganization.js      NEW
  backend/src/routes/authRoutes.js               REPLACE
  backend/src/routes/settingsRoutes.js           REPLACE
  backend/src/routes/invoiceRoutes.js            REPLACE
  backend/src/routes/quotationRoutes.js          REPLACE
  backend/src/routes/aiAssistantRoutes.js        REPLACE
Frontend:
  frontend/src/pages/AIAssistant.jsx             REPLACE
  frontend/src/pages/Settings.jsx                REPLACE
  frontend/src/context/AuthContext.jsx           REPLACE
  frontend/vercel.json                           REPLACE

Why AI appears broken NOW (verified against live service):
  POST /api/ai/stream returns HTTP 404 on the deployed Render backend.
  POST /api/ai/chat works via a public third-party fallback.
  /api/ai/test reports the configured Groq key has HTTP 404 for its requested
  model. The new backend defaults GROQ_MODEL to openai/gpt-oss-20b; you can
  override GROQ_MODEL in Render if your account supports a different model.
  Frontend now remembers a 404 stream and uses /ai/chat directly thereafter.

Privacy changes:
  - Login/me never return SMTP passwords, API keys or bank details.
  - Settings hides stored credentials; blank password field preserves old value.
  - /settings/email-status returns a boolean, not the SMTP password.
  - Invoice/quotation documents only receive whitelisted printable org fields.
  - Old sensitive cached user data is purged from localStorage on load.
  - AI has organization-scoped READ-ONLY business tools; dangerous SQL, file
    editing, arbitrary table browsing, settings mutation and deploy are blocked.
  - Anonymous public AI is opt-in only: ALLOW_PUBLIC_AI=true enables it.
    Without a working private provider, live ERP metrics still work and
    general chat honestly says no model is configured.
  - Public registration is disabled by default (ALLOW_PUBLIC_REGISTRATION=true
    enables it, only if you intentionally need public sign-up).
  - Password reset OTP uses crypto-secure random numbers.
  - Vercel serves basic security/referrer/permissions headers.

IMPORTANT NEXT ACTIONS:
  1. Commit all files and wait for Render + Vercel deploys to finish.
  2. In Render Environment, check GROQ_API_KEY validity and test /api/ai/test
     as admin; set GROQ_MODEL=openai/gpt-oss-20b if needed. OR configure a
     valid GEMINI_API_KEY. Never put provider keys in VITE_* frontend variables.
  3. Rotate the current Gmail APP password in Google Account. Update the new
     value in Settings/Render after deploy. The old value was exposed to signed-in
     users by the previous login/email-status responses. Do NOT post keys here.
  4. Existing browser sessions may have cached old secrets; users should log out
     and back in after the deployment. Changing JWT_SECRET also invalidates
     existing JWTs but must be coordinated via Render environment settings.
  5. Test /api/ai/status as an admin; new response contains
     streamingSupported:true, privateMode:true and toolsAvailable:11.

No deployment was performed by this workspace. A build passing locally does
not mean GitHub/Render/Vercel is updated. Back up your repo before replacing.
