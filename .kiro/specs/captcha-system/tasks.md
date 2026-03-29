# Implementation Plan: Captcha System

## Overview

Replace the single-provider Google reCAPTCHA with a configurable multi-captcha system. Each portal (admin, seller, client) independently selects between self-hosted puzzle slider, Google reCAPTCHA v2, or disabled. Implementation follows: backend service → controller/routes → frontend component → auth form integration → wiring.

## Tasks

- [x] 1. Backend captcha service and config resolution
  - [x] 1.1 Create `Backend/services/captcha.service.js` with config resolution logic
    - Implement `resolvePortalCaptchaConfig(portal)` — reads `setRecapchaLogin` from `param_config`, returns `{ active, type }` for the portal
    - When `enable` is `0`, return `{ active: 0 }` for any portal
    - When `enable` is `1`, return the portal's `{ active, type }` or `{ active: 0 }` if portal missing
    - Only accept `type` values `"self-hosted"` and `"captcha-google"`; treat others as disabled
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Implement puzzle challenge generation in `Backend/services/captcha.service.js`
    - `generateChallenge(portal)` — uses `sharp` to pick a random background from `Backend/public/captcha-backgrounds/`, cuts a puzzle piece at random (x, y), returns `{ background, piece, token, pieceY }`
    - Store `{ expectedX, createdAt }` in an in-memory `Map` keyed by UUID token
    - Add TTL cleanup: 60s interval, 120s expiry
    - Return 503 if no background images found
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Implement puzzle verification in `Backend/services/captcha.service.js`
    - `verifyChallenge(token, submittedX)` — compares submitted X against stored expectedX within tolerance (default 10px)
    - On success: generate a `verificationToken` UUID, store it in a verified tokens set (TTL 120s), return `{ success: true, verificationToken }`
    - On failure: return `{ success: false }`
    - Always invalidate the challenge token after one attempt (success or failure)
    - `validateVerificationToken(verificationToken)` — checks and invalidates the verification token (single-use)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 1.4 Write property tests for config resolution (Properties 1-4)
    - **Property 1: Global kill-switch disables all portals** — generate random configs with `enable=0`, random portal names → all resolve to disabled
    - **Validates: Requirements 1.1, 8.3**
    - **Property 2: Per-portal config resolution** — generate random configs with `enable=1`, random portal entries → resolved state matches config
    - **Validates: Requirements 1.2, 2.1, 2.2, 2.4, 8.1, 8.4**
    - **Property 3: Config serialization round-trip** — generate random config objects → JSON.stringify then JSON.parse produces equivalent object
    - **Validates: Requirements 1.3**
    - **Property 4: Valid captcha type enforcement** — generate random type strings → only `"self-hosted"` and `"captcha-google"` accepted
    - **Validates: Requirements 2.3**

  - [ ]* 1.5 Write property tests for challenge generation and verification (Properties 5-9)
    - **Property 5: Challenge response completeness** — call generateChallenge → all responses have background, piece, token, pieceY
    - **Validates: Requirements 3.1, 3.4**
    - **Property 6: Challenge position randomness** — generate 10+ challenges → not all X positions identical
    - **Validates: Requirements 3.3**
    - **Property 7: Verification accepts within tolerance** — generate challenge, submit X within tolerance → succeeds
    - **Validates: Requirements 5.1, 5.2**
    - **Property 8: Verification rejects outside tolerance** — generate challenge, submit X outside tolerance → fails
    - **Validates: Requirements 5.3**
    - **Property 9: Challenge token single-use** — generate challenge, verify once, verify again → second fails
    - **Validates: Requirements 5.4**

- [x] 2. Register captcha service and add background images
  - [x] 2.1 Register `captchaService` in `Backend/config/container.js` via Awilix
    - Require and register the new captcha service
    - _Requirements: 3.1_

  - [x] 2.2 Create `Backend/public/captcha-backgrounds/` directory with placeholder background images
    - Add 3-5 simple generated background images (~800x400px) for puzzle captcha
    - _Requirements: 3.1_

  - [x] 2.3 Write SQL UPDATE for `param_config` to migrate `setRecapchaLogin` to new JSON format
    - Create `Backend/scripts/migrate-captcha-config.sql` with UPDATE statement
    - New format: `{ "enable": 1, "portal": { "admin": { "active": 1, "type": "self-hosted" }, "seller": { "active": 1, "type": "captcha-google" }, "client": { "active": 0, "type": "self-hosted" } } }`
    - _Requirements: 1.3_

- [x] 3. Checkpoint - Verify backend service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend captcha controller and routes
  - [x] 4.1 Create `Backend/controllers/captcha.controller.js`
    - `getChallenge(req, res)` — reads `portal` query param, calls `generateChallenge`, returns challenge JSON
    - `verifyChallenge(req, res)` — reads `{ token, x }` from body, calls `verifyChallenge`, returns result
    - _Requirements: 3.4, 5.1, 5.2, 5.3_

  - [x] 4.2 Create `Backend/routes/captcha.routes.js` and register in `Backend/app.js`
    - `GET /api/captcha/challenge` — public, rate-limited with `readLimiter`
    - `POST /api/captcha/verify` — public, rate-limited with `writeLimiter`
    - Register routes in `app.js` as public (no auth middleware)
    - _Requirements: 3.4, 5.1_

  - [x] 4.3 Update `Backend/controllers/config.controller.js` — `getRecaptchaLoginConfig`
    - Accept `?portal=` query param
    - When portal provided and `enable=1`: return that portal's `{ active, type }` config
    - When portal provided and `enable=0`: return `{ active: 0 }`
    - When no portal param: return full config object (backward compatibility)
    - When portal not found in config: return `{ active: 0 }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 5. Backend auth endpoint captcha validation
  - [x] 5.1 Update `Backend/controllers/auth.controller.js` — `login` method
    - Read `portal` from request body
    - Use `resolvePortalCaptchaConfig(portal)` to determine captcha type
    - If `type === "captcha-google"`: validate with existing `verifyRecaptcha` using `captchaResponse`
    - If `type === "self-hosted"`: validate using `captchaService.validateVerificationToken(captchaVerificationToken)` from request body
    - If captcha disabled: skip validation entirely
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.2 Update `Backend/controllers/auth.controller.js` — `recoverPassword` method
    - Same portal-aware captcha validation logic as login
    - Read `portal` and `captchaVerificationToken` from request body
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.3 Update `Backend/controllers/auth.controller.js` — `resetPassword` method
    - Same portal-aware captcha validation logic as login
    - Read `portal` and `captchaVerificationToken` from request body
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.4 Write property tests for auth captcha validation (Properties 10-11)
    - **Property 10: Auth skips validation when captcha disabled** — set config to disabled, send auth request without captcha → succeeds
    - **Validates: Requirements 7.4**
    - **Property 11: Auth rejects on failed captcha validation** — set config to enabled, send auth request with bad captcha → fails
    - **Validates: Requirements 7.5**

- [x] 6. Checkpoint - Verify backend endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend puzzle captcha component
  - [x] 7.1 Create `Frontend/public/js/puzzle-captcha.js`
    - Export `initPuzzleCaptcha(containerEl, { apiUrl, portal, onVerified })` function
    - Fetch challenge from `GET /api/captcha/challenge?portal=X`
    - Render background canvas, puzzle piece overlay, and horizontal slider input
    - Handle drag interaction: move puzzle piece horizontally to match slider position
    - On slider release: POST to `/api/captcha/verify` with `{ token, x }`
    - On success: call `onVerified(verificationToken)`
    - On failure: auto-fetch new challenge and show retry feedback
    - Support refresh button to get a new challenge
    - Use CSS custom properties for theme compatibility (dark/light)
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. Frontend auth form integration
  - [x] 8.1 Update `Frontend/src/modules/FormSignIn.astro`
    - Fetch config with `?portal=` param using `activeAppContext`
    - Conditionally render Google reCAPTCHA container OR puzzle captcha container based on config type
    - Pass `captchaType` and portal info to `initSignIn` via `define:vars`
    - Include `<script src="/js/puzzle-captcha.js">` when type is `self-hosted`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.2 Update `Frontend/public/js/sign-in.js` — `initSignIn`
    - Accept `captchaType` in config
    - When `captchaType === "self-hosted"`: initialize puzzle captcha, store `verificationToken` on success
    - On form submit: send `portal` and `captchaVerificationToken` in request body instead of `captchaResponse` when self-hosted
    - When `captchaType === "captcha-google"`: keep existing Google reCAPTCHA flow
    - When captcha disabled: skip captcha validation entirely
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 8.3 Update `Frontend/src/modules/FormForgotPassword.astro`
    - Fetch portal-specific config from `GET /api/config/recaptcha-login?portal=X`
    - Conditionally render Google reCAPTCHA or puzzle captcha container
    - Send `portal` and `captchaVerificationToken` in recover request body when self-hosted
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.4 Update `Frontend/src/modules/FormResetPassword.astro`
    - Fetch portal-specific config from `GET /api/config/recaptcha-login?portal=X`
    - Conditionally render Google reCAPTCHA or puzzle captcha container
    - Send `portal` and `captchaVerificationToken` in reset request body when self-hosted
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The self-hosted puzzle uses `sharp` (already installed) for image processing
- Background images go in `Backend/public/captcha-backgrounds/`
- Frontend puzzle component is vanilla JS (no framework dependency)
- Property tests use `fast-check` library
- Each auth form sends `portal` in the request body so the backend knows which captcha type to validate
