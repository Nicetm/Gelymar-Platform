# Implementation Plan: Backend Deep Refactoring

## Overview

This implementation plan breaks down the comprehensive backend refactoring into discrete, manageable tasks. The refactoring eliminates code duplication, enforces proper separation of concerns, and establishes consistent dependency injection patterns while maintaining 100% backward compatibility.

The implementation follows a phased approach:
1. Create new services and utilities without breaking existing code
2. Refactor controllers one at a time with thorough testing
3. Consolidate duplicate utility functions across the codebase
4. Verify complete refactoring and run comprehensive tests

## Tasks

- [x] 1. Phase 1: Create New Services and Utilities
  - [x] 1.1 Create OC normalization utility
    - Create `Backend/utils/oc.util.js` with `normalizeOc()`, `normalizeOcForCompare()`, and `compareOcs()` functions
    - Implement exact logic: uppercase, remove spaces/hyphens/parentheses
    - Add JSDoc comments for all functions
    - _Requirements: 3.1, 3.2, 3.11_
  
  - [ ]* 1.2 Write unit tests for OC utility
    - **Property 3: OC normalization produces consistent results**
    - **Validates: Requirements 3.11**
    - Test uppercase conversion, space removal, hyphen removal, parentheses removal
    - Test edge cases: null, undefined, empty string, numbers
    - Test idempotence: normalizing twice produces same result
    - _Requirements: 3.11, 12.4_
  
  - [x] 1.3 Create Password Service
    - Create `Backend/services/password.service.js` with constructor accepting mysqlPoolPromise and logger
    - Implement `validatePasswordStrength()` method with exact validation rules (8+ chars, uppercase, lowercase, number)
    - Implement `hashPassword()` using bcrypt with 10 salt rounds
    - Implement `verifyPassword()` using bcrypt.compare
    - Implement `changePassword()` with current password verification
    - Implement `resetPassword()` without current password requirement
    - Add comprehensive logging to all methods (no sensitive data)
    - Add JSDoc comments for all methods
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10, 11.1_
  
  - [ ]* 1.4 Write unit tests for Password Service
    - **Property 4: Password strength validation is consistent**
    - **Property 5: Password hashing is verifiable**
    - **Property 6: Password changes update database correctly**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.10, 10.6**
    - Test validatePasswordStrength with valid and invalid passwords
    - Test hashPassword and verifyPassword round-trip
    - Test changePassword with correct and incorrect current password
    - Test resetPassword updates database correctly
    - Mock database for all tests
    - _Requirements: 4.10, 12.1, 12.5, 12.7_
  
  - [x] 1.5 Create Auth Service
    - Create `Backend/services/auth.service.js` with constructor accepting mysqlPoolPromise and logger
    - Implement `updateLoginAttempts()` with MAX_LOGIN_ATTEMPTS = 5
    - Implement `resetLoginAttempts()` to reset counter to 0
    - Implement `checkAccountBlocked()` to query bloqueado field
    - Implement `update2FASecret()` to update twoFASecret field
    - Implement `enable2FA()` to set twoFAEnabled = 1
    - Implement `disable2FA()` to set twoFAEnabled = 0 and clear secret
    - Add comprehensive logging to all methods
    - Add JSDoc comments for all methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.9, 11.2, 11.3_
  
  - [ ]* 1.6 Write unit tests for Auth Service
    - **Property 7: Authentication logic maintains security invariants**
    - **Validates: Requirements 6.9**
    - Test updateLoginAttempts increments counter on failure
    - Test updateLoginAttempts resets counter on success
    - Test account blocks after 5 failed attempts
    - Test checkAccountBlocked returns correct status
    - Test 2FA secret and enable/disable operations
    - Mock database for all tests
    - _Requirements: 6.9, 12.2, 12.5_
  
  - [x] 1.7 Create Auth2FA Service
    - Create `Backend/services/auth2fa.service.js` with constructor accepting mysqlPoolPromise and logger
    - Implement `get2FAConfig()` to retrieve twoFAEnabled and twoFASecret
    - Implement `update2FASecret()` to update twoFASecret field
    - Implement `enable2FA()` to set twoFAEnabled = 1
    - Implement `disable2FA()` to set twoFAEnabled = 0
    - Add comprehensive logging to all methods
    - Add JSDoc comments for all methods
    - _Requirements: 8.4, 11.3_
  
  - [ ]* 1.8 Write unit tests for Auth2FA Service
    - Test get2FAConfig returns correct configuration
    - Test update2FASecret updates database
    - Test enable2FA and disable2FA update database correctly
    - Mock database for all tests
    - _Requirements: 12.3, 12.5_
  
  - [x] 1.9 Register new services in container
    - Update `Backend/config/container.js` to import PasswordService, AuthService, Auth2FAService
    - Register passwordService as singleton with mysqlPoolPromise and logger dependencies
    - Register authService as singleton with mysqlPoolPromise and logger dependencies
    - Register auth2faService as singleton with mysqlPoolPromise and logger dependencies
    - Verify all services can be resolved from container
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6_

- [ ] 2. Checkpoint - Verify Phase 1 completion
  - Ensure all new services can be instantiated
  - Ensure all unit tests pass
  - Ensure services are registered in container
  - Ask the user if questions arise

- [x] 3. Phase 2: Refactor Controllers (Move SQL to Services)
  - [x] 3.1 Refactor auth.controller.js
    - Add service resolution at top: resolve passwordService and authService from container
    - Remove direct require of '../config/db'
    - Replace login attempt SQL queries with authService.updateLoginAttempts()
    - Replace password reset SQL with passwordService.resetPassword()
    - Replace password change SQL with passwordService.changePassword()
    - Replace 2FA secret update SQL with authService.update2FASecret()
    - Verify all 6 SQL queries removed from controller
    - Maintain identical error messages and status codes
    - _Requirements: 1.1, 1.2, 1.3, 1.8, 5.1, 5.3, 5.8, 6.7, 10.1, 10.2_
  
  - [ ]* 3.2 Run integration tests for auth endpoints
    - **Property 1: Refactored endpoints maintain identical behavior**
    - **Property 8: API error responses are unchanged**
    - **Property 10: JWT token generation is unchanged**
    - **Validates: Requirements 1.8, 10.1, 10.2, 10.5**
    - Test POST /api/auth/login with valid credentials
    - Test POST /api/auth/login with invalid credentials
    - Test POST /api/auth/login with blocked account
    - Test POST /api/auth/change-password
    - Test POST /api/auth/reset
    - Verify response formats are identical
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  
  - [x] 3.3 Refactor auth2fa.controller.js
    - Add service resolution at top: resolve auth2faService from container
    - Remove direct require of '../config/db'
    - Replace 2FA config queries with auth2faService.get2FAConfig()
    - Replace 2FA updates with auth2faService methods
    - Verify all 2 SQL queries removed from controller
    - Maintain identical error messages and status codes
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 5.1, 5.7, 5.8, 6.8, 10.1, 10.2_
  
  - [ ]* 3.4 Run integration tests for 2FA endpoints
    - **Property 11: 2FA verification logic is preserved**
    - **Validates: Requirements 10.7**
    - Test GET /api/auth/2fa/setup
    - Test POST /api/auth/2fa/verify
    - Test POST /api/auth/2fa/enable
    - Test POST /api/auth/2fa/disable
    - Verify response formats are identical
    - _Requirements: 10.1, 10.2, 10.7_
  
  - [x] 3.5 Refactor vendedor.controller.js
    - Add service resolution at top: resolve passwordService from container
    - Remove direct require of '../config/db'
    - Replace password update SQL with passwordService.resetPassword()
    - Verify 1 SQL query removed from controller
    - Maintain identical error messages and status codes
    - _Requirements: 1.1, 1.2, 1.4, 1.8, 4.8, 5.1, 5.4, 5.8, 10.1, 10.2_
  
  - [ ]* 3.6 Run integration tests for vendedor endpoints
    - Test PUT /api/vendedores/:rut/password
    - Verify response format is identical
    - _Requirements: 10.1, 10.2_
  
  - [x] 3.7 Refactor customer.controller.js
    - Add service resolution at top: resolve passwordService from container
    - Remove direct require of '../config/db'
    - Replace password update SQL with passwordService.resetPassword()
    - Replace any other SQL queries with appropriate service calls
    - Verify all 2 SQL queries removed from controller
    - Maintain identical error messages and status codes
    - _Requirements: 1.1, 1.2, 1.5, 1.8, 4.9, 5.1, 5.5, 5.8, 10.1, 10.2_
  
  - [ ]* 3.8 Run integration tests for customer endpoints
    - Test PUT /api/customers/:rut/password
    - Verify response format is identical
    - _Requirements: 10.1, 10.2_
  
  - [x] 3.9 Refactor cronConfig.controller.js
    - Verify cronConfigService exists or create if needed
    - Add service resolution at top: resolve cronConfigService from container
    - Remove direct require of '../config/db'
    - Replace SQL queries with cronConfigService.getCronTasksConfig()
    - Replace SQL updates with cronConfigService.updateMultipleCronTasksConfig()
    - Verify all 2 SQL queries removed from controller
    - Maintain transaction support for atomic updates
    - Maintain identical error messages and status codes
    - _Requirements: 1.1, 1.2, 1.6, 1.8, 5.1, 5.6, 5.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 10.1, 10.2_
  
  - [ ]* 3.10 Run integration tests for cron config endpoints
    - **Property 12: Cron configuration updates are atomic**
    - **Validates: Requirements 7.6**
    - Test GET /api/cron/tasks-config
    - Test PUT /api/cron/tasks-config
    - Test transaction rollback on error
    - Verify response formats are identical
    - _Requirements: 7.6, 10.1, 10.2_

- [ ] 4. Checkpoint - Verify Phase 2 completion
  - Ensure all controllers have zero SQL queries
  - Ensure all controllers use dependency injection
  - Ensure all integration tests pass
  - Ask the user if questions arise

- [ ] 5. Phase 3: Consolidate Utility Functions
  - [x] 5.1 Update services to use rut.util.js
    - Update `Backend/services/customer.service.js`: import normalizeRut, remove 3 duplicate implementations
    - Update `Backend/services/order.service.js`: import normalizeRut, remove 1 duplicate implementation
    - Update `Backend/services/documentFile.service.js`: import normalizeRut, remove 1 duplicate implementation
    - Run tests after each file update
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 2.9, 9.1, 9.5_
  
  - [ ]* 5.2 Verify RUT normalization consistency
    - **Property 2: RUT normalization produces consistent results**
    - **Validates: Requirements 2.9**
    - Test that centralized normalizeRut produces same results as old implementations
    - Test edge cases: null, undefined, empty string, with/without 'C' suffix
    - _Requirements: 2.9, 12.8_
  
  - [x] 5.3 Update services to use oc.util.js
    - Update `Backend/services/order.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/services/orderDetail.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/services/item.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/services/file.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/services/documentFile.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/services/checkOrderReception.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/services/checkDefaultFiles.service.js`: import from oc.util.js, remove duplicate
    - Update `Backend/scripts/backfill-order-files.js`: import from oc.util.js, remove duplicate
    - Run tests after each file update
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 9.2, 9.5_
  
  - [x] 5.4 Update controllers to use rut.util.js
    - Update `Backend/controllers/customer.controller.js`: import normalizeRut, replace 2 inline normalizations
    - Update `Backend/controllers/directory.controller.js`: import normalizeRut, replace 2 inline normalizations
    - Update `Backend/controllers/documentFile.controller.js`: import normalizeRut, replace 1 inline normalization
    - Run tests after each file update
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 9.1, 9.5_
  
  - [x] 5.5 Verify no duplicate functions remain
    - Search codebase for duplicate normalizeRut implementations
    - Search codebase for duplicate normalizeOcForCompare implementations
    - Verify all files import from centralized utilities
    - _Requirements: 2.8, 3.10, 9.5, 9.6_

- [ ] 6. Checkpoint - Verify Phase 3 completion
  - Ensure no duplicate normalization functions exist
  - Ensure all files use centralized utilities
  - Ensure all tests pass
  - Ask the user if questions arise

- [ ] 7. Phase 4: Comprehensive Verification
  - [x] 7.1 Code search verification
    - Search for `require('../config/db')` in controllers directory - should find zero
    - Search for `require('../config/sqlserver')` in controllers directory - should find zero
    - Search for `pool.query` in controllers directory - should find zero
    - Search for duplicate `normalizeRut` function definitions - should find zero
    - Search for duplicate `normalizeOcForCompare` function definitions - should find zero
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 5.2, 9.6_
  
  - [ ] 7.2 Run full test suite
    - Run all unit tests: `npm test`
    - Run all integration tests: `npm run test:integration`
    - Run code coverage: `npm run test:coverage`
    - Verify coverage ≥ 80% for new services
    - _Requirements: 10.8, 12.9, 12.10_
  
  - [ ]* 7.3 Run property-based tests
    - **Property 1: Refactored endpoints maintain identical behavior**
    - **Property 2: RUT normalization produces consistent results**
    - **Property 3: OC normalization produces consistent results**
    - **Property 4: Password strength validation is consistent**
    - **Property 5: Password hashing is verifiable**
    - **Property 9: Validation logic is preserved**
    - **Validates: Requirements 1.8, 2.9, 3.11, 4.4, 4.5, 10.3**
    - Run property tests with minimum 100 iterations each
    - Verify all properties hold
    - _Requirements: 10.3, 10.4, 10.9_
  
  - [ ] 7.4 Manual API testing
    - Test POST /api/auth/login with various scenarios (valid, invalid, blocked, 2FA)
    - Test POST /api/auth/change-password with valid and invalid passwords
    - Test POST /api/auth/reset with valid and expired tokens
    - Test GET /api/auth/2fa/setup and verify QR code generation
    - Test PUT /api/vendedores/:rut/password
    - Test PUT /api/customers/:rut/password
    - Test GET /api/cron/tasks-config
    - Test PUT /api/cron/tasks-config
    - Verify all error responses match original format
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [ ] 7.5 Performance verification
    - Verify no performance degradation in API response times
    - Check database connection pool usage is normal
    - Monitor memory usage during testing
    - Verify no connection leaks
    - _Requirements: 5.9_
  
  - [ ] 7.6 Logging verification
    - Verify all password operations log userId (no sensitive data)
    - Verify all auth operations log userId and success status
    - Verify all 2FA operations log userId
    - Verify all cron config changes log taskName and new value
    - Verify all errors log full error messages
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass
  - Ensure code coverage meets requirements
  - Ensure API responses are identical to before refactoring
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the refactoring
- Phase 2 refactors controllers one at a time to minimize risk
- Phase 3 consolidates utilities after controllers are stable
- Property tests validate universal correctness properties
- Integration tests validate API compatibility
- All refactoring maintains 100% backward compatibility
