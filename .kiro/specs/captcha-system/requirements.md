# Requirements Document

## Introduction

Replace the current single-provider Google reCAPTCHA v2 captcha with a configurable multi-captcha system. Each portal (admin, seller, client) can independently choose between a self-hosted puzzle slider captcha or Google reCAPTCHA v2, or disable captcha entirely. A global kill-switch (`enable: 0`) disables captcha across all portals.

## Glossary

- **Captcha_System**: The configurable captcha subsystem that determines which captcha type to render and validate per portal.
- **Portal**: One of three application contexts: `admin`, `seller`, or `client`.
- **Self_Hosted_Captcha**: A puzzle slider captcha where the backend generates a background image with a cut-out piece at a random position, and the user drags the piece to the correct position via a slider.
- **Google_Captcha**: The existing Google reCAPTCHA v2 checkbox/image challenge integration.
- **Captcha_Config**: The `setRecapchaLogin` parameter stored in `param_config`, containing global enable flag and per-portal settings.
- **Auth_View**: One of the three authentication forms: Sign In (`FormSignIn.astro`), Forgot Password (`FormForgotPassword.astro`), Reset Password (`FormResetPassword.astro`).
- **Puzzle_Image**: A server-generated image pair consisting of a background with a missing piece and the puzzle piece itself.
- **Tolerance_Margin**: The acceptable pixel deviation when validating the user's slider position against the expected position.

## Requirements

### Requirement 1: Global Captcha Configuration

**User Story:** As an administrator, I want a global enable/disable switch for captcha, so that I can turn off captcha across all portals with a single setting.

#### Acceptance Criteria

1. WHEN `enable` is set to `0` in the Captcha_Config, THE Captcha_System SHALL disable captcha for all portals regardless of individual portal settings.
2. WHEN `enable` is set to `1` in the Captcha_Config, THE Captcha_System SHALL evaluate each portal's individual `active` and `type` settings.
3. THE Captcha_Config SHALL store the configuration in the `setRecapchaLogin` parameter using the new JSON structure with `enable` and `portal` fields.

### Requirement 2: Per-Portal Captcha Configuration

**User Story:** As an administrator, I want to configure captcha type and activation independently for each portal, so that different portals can use different captcha strategies.

#### Acceptance Criteria

1. WHILE `enable` is `1` in the Captcha_Config, WHEN a portal's `active` is set to `1`, THE Captcha_System SHALL enable captcha for that portal using the specified `type`.
2. WHILE `enable` is `1` in the Captcha_Config, WHEN a portal's `active` is set to `0`, THE Captcha_System SHALL disable captcha for that portal.
3. THE Captcha_Config SHALL support `type` values of `"self-hosted"` and `"captcha-google"` for each portal.
4. IF a portal entry is missing from the Captcha_Config, THEN THE Captcha_System SHALL treat that portal as having captcha disabled.

### Requirement 3: Self-Hosted Puzzle Slider Captcha — Backend Generation

**User Story:** As a developer, I want the backend to generate puzzle slider captcha challenges, so that the system operates without external captcha dependencies.

#### Acceptance Criteria

1. WHEN a self-hosted captcha challenge is requested, THE Captcha_System SHALL generate a Puzzle_Image consisting of a background image and a puzzle piece cut out at a random position.
2. WHEN a self-hosted captcha challenge is generated, THE Captcha_System SHALL store the expected puzzle piece X-position in a server-side session or token.
3. THE Captcha_System SHALL generate a new random position for each captcha challenge request.
4. THE Captcha_System SHALL return the background image, the puzzle piece image, and a challenge token to the frontend.

### Requirement 4: Self-Hosted Puzzle Slider Captcha — Frontend Rendering

**User Story:** As a user, I want to see a puzzle slider captcha where I drag a piece to the correct position, so that I can prove I am human.

#### Acceptance Criteria

1. WHEN the Auth_View receives a `"self-hosted"` captcha type configuration, THE Captcha_System SHALL render the puzzle background image with the puzzle piece overlay and a horizontal slider control.
2. WHEN the user drags the slider, THE Captcha_System SHALL move the puzzle piece horizontally to match the slider position.
3. WHEN the user releases the slider, THE Captcha_System SHALL submit the final X-position and the challenge token to the backend for validation.

### Requirement 5: Self-Hosted Puzzle Slider Captcha — Backend Validation

**User Story:** As a developer, I want the backend to validate puzzle slider submissions, so that only correct solutions are accepted.

#### Acceptance Criteria

1. WHEN a self-hosted captcha validation request is received, THE Captcha_System SHALL compare the submitted X-position against the stored expected position.
2. WHEN the difference between the submitted position and the expected position is within the Tolerance_Margin, THE Captcha_System SHALL accept the captcha as valid.
3. WHEN the difference exceeds the Tolerance_Margin, THE Captcha_System SHALL reject the captcha as invalid.
4. WHEN a challenge token is used for validation, THE Captcha_System SHALL invalidate that token to prevent reuse.

### Requirement 6: Auth View Portal Detection and Captcha Rendering

**User Story:** As a developer, I want the auth views to detect the current portal and render the appropriate captcha, so that each portal shows the correct captcha type.

#### Acceptance Criteria

1. WHEN an Auth_View loads, THE Captcha_System SHALL determine the current portal using the existing `PUBLIC_APP_CONTEXT` environment variable or URL-based detection logic.
2. WHEN the portal is determined, THE Captcha_System SHALL fetch the captcha configuration for that specific portal from the `GET /api/config/recaptcha-login` endpoint with a `portal` query parameter.
3. WHEN the captcha type is `"captcha-google"`, THE Auth_View SHALL render the existing Google reCAPTCHA v2 widget.
4. WHEN the captcha type is `"self-hosted"`, THE Auth_View SHALL render the puzzle slider captcha component.
5. WHEN captcha is disabled (globally or for the portal), THE Auth_View SHALL render no captcha element.

### Requirement 7: Backend Auth Endpoint Captcha Validation

**User Story:** As a developer, I want the backend auth endpoints to validate the correct captcha type based on portal configuration, so that each portal's captcha is properly enforced.

#### Acceptance Criteria

1. WHEN a login, recoverPassword, or resetPassword request is received, THE Captcha_System SHALL read the Captcha_Config and determine the requesting portal.
2. WHILE the captcha type for the portal is `"captcha-google"`, THE Captcha_System SHALL validate the request using Google reCAPTCHA v2 verification.
3. WHILE the captcha type for the portal is `"self-hosted"`, THE Captcha_System SHALL validate the request using the puzzle slider position and challenge token.
4. WHILE captcha is disabled (globally or for the portal), THE Captcha_System SHALL skip captcha validation entirely.
5. IF captcha validation fails, THEN THE Captcha_System SHALL reject the auth request with an appropriate error message.

### Requirement 8: Public Captcha Config Endpoint

**User Story:** As a frontend developer, I want the public config endpoint to return portal-specific captcha configuration, so that the frontend can render the correct captcha type.

#### Acceptance Criteria

1. WHEN the `GET /api/config/recaptcha-login` endpoint receives a `portal` query parameter, THE Captcha_System SHALL return the captcha configuration for that specific portal.
2. WHEN the `portal` query parameter is missing, THE Captcha_System SHALL return the full configuration object for backward compatibility.
3. WHEN `enable` is `0`, THE Captcha_System SHALL return a response indicating captcha is disabled regardless of the portal parameter.
4. IF the specified portal does not exist in the configuration, THEN THE Captcha_System SHALL return a response indicating captcha is disabled for that portal.
