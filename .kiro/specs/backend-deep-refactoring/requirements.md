# Requirements Document

## Introduction

This specification defines a comprehensive deep refactoring of the Gelymar backend to eliminate code duplication, enforce proper separation of concerns, and ensure consistent dependency injection patterns throughout the codebase. This refactoring builds upon the 11 Quick Wins already completed and addresses systemic architectural issues that have accumulated over time.

## Glossary

- **Controller**: HTTP request/response handler that delegates to services
- **Service**: Business logic layer that interacts with databases and external systems
- **Dependency_Injection**: Pattern where dependencies are provided to components rather than created internally
- **Normalization_Function**: Utility function that transforms data into a consistent format
- **SQL_Query**: Direct database query executed via pool.query() or similar
- **Password_Service**: Centralized service for password hashing and updating
- **Utility_Module**: Shared helper functions in Backend/utils/
- **Container**: Awilix dependency injection container in Backend/config/container.js
- **Direct_Require**: Using require() to import database config directly in controllers

## Requirements

### Requirement 1: Move All SQL Queries from Controllers to Services

**User Story:** As a backend developer, I want all database queries to be in services, so that controllers remain thin and focused on HTTP concerns.

#### Acceptance Criteria

1. THE Backend SHALL have zero direct SQL queries in controller files
2. WHEN a controller needs database access, THE Backend SHALL delegate to a service method
3. THE auth.controller.js SHALL move 6 pool.query() calls to auth.service.js
4. THE vendedor.controller.js SHALL move 1 pool.query() call to vendedor.service.js
5. THE customer.controller.js SHALL move 2 pool.query() calls to customer.service.js
6. THE cronConfig.controller.js SHALL move 2 pool.query() calls to cronConfig.service.js
7. THE auth2fa.controller.js SHALL move 2 pool.query() calls to auth2fa.service.js
8. FOR ALL moved queries, THE Backend SHALL maintain identical functionality and error handling

### Requirement 2: Consolidate RUT Normalization Functions

**User Story:** As a backend developer, I want a single RUT normalization utility, so that RUT handling is consistent across the entire codebase.

#### Acceptance Criteria

1. THE Backend SHALL use Backend/utils/rut.util.js for all RUT normalization
2. THE Backend SHALL remove duplicate normalizeRut implementations from customer.service.js (3 instances)
3. THE Backend SHALL remove duplicate normalizeRut implementations from order.service.js (1 instance)
4. THE Backend SHALL remove duplicate normalizeRut implementations from documentFile.service.js (1 instance)
5. THE Backend SHALL remove inline RUT normalization from customer.controller.js (2 instances)
6. THE Backend SHALL remove inline RUT normalization from directory.controller.js (2 instances)
7. THE Backend SHALL remove inline RUT normalization from documentFile.controller.js (1 instance)
8. FOR ALL files using RUT normalization, THE Backend SHALL import from Backend/utils/rut.util.js
9. THE Backend SHALL maintain backward compatibility with existing RUT formats

### Requirement 3: Consolidate OC Normalization Functions

**User Story:** As a backend developer, I want a single OC normalization utility, so that order code handling is consistent across the entire codebase.

#### Acceptance Criteria

1. THE Backend SHALL create Backend/utils/oc.util.js with normalizeOc and normalizeOcForCompare functions
2. THE Backend SHALL remove duplicate normalizeOcForCompare from order.service.js
3. THE Backend SHALL remove duplicate normalizeOcForCompare from orderDetail.service.js
4. THE Backend SHALL remove duplicate normalizeOcForCompare from item.service.js
5. THE Backend SHALL remove duplicate normalizeOcForCompare from file.service.js
6. THE Backend SHALL remove duplicate normalizeOcForCompare from documentFile.service.js
7. THE Backend SHALL remove duplicate normalizeOcForCompare from checkOrderReception.service.js
8. THE Backend SHALL remove duplicate normalizeOcForCompare from checkDefaultFiles.service.js
9. THE Backend SHALL remove duplicate normalizeOcForCompare from backfill-order-files.js
10. FOR ALL files using OC normalization, THE Backend SHALL import from Backend/utils/oc.util.js
11. THE Backend SHALL maintain identical normalization logic (uppercase, remove spaces/hyphens/parentheses)

### Requirement 4: Create Centralized Password Service

**User Story:** As a backend developer, I want a single password service, so that password hashing and updating logic is not duplicated across controllers.

#### Acceptance Criteria

1. THE Backend SHALL create Backend/services/password.service.js
2. THE Password_Service SHALL provide changePassword(userId, currentPassword, newPassword) method
3. THE Password_Service SHALL provide resetPassword(userId, newPassword) method
4. THE Password_Service SHALL provide validatePasswordStrength(password) method
5. THE Password_Service SHALL hash passwords using bcrypt with salt rounds of 10
6. THE Password_Service SHALL update users table with hashed password and set change_pw = 1
7. THE auth.controller.js SHALL use Password_Service for changePassword and resetPassword
8. THE vendedor.controller.js SHALL use Password_Service for changeVendedorPassword
9. THE customer.controller.js SHALL use Password_Service for changeCustomerPassword
10. FOR ALL password operations, THE Backend SHALL maintain identical validation and error handling

### Requirement 5: Enforce Dependency Injection for Database Access

**User Story:** As a backend developer, I want all database access to use dependency injection, so that controllers never directly require database configuration.

#### Acceptance Criteria

1. THE Backend SHALL remove all direct require('../config/db') from controllers
2. THE Backend SHALL remove all direct require('../config/sqlserver') from controllers
3. THE auth.controller.js SHALL use mysqlPoolPromise from container instead of direct require
4. THE vendedor.controller.js SHALL use mysqlPoolPromise from container instead of direct require
5. THE customer.controller.js SHALL use mysqlPoolPromise from container instead of direct require
6. THE cronConfig.controller.js SHALL use mysqlPoolPromise from container instead of direct require
7. THE auth2fa.controller.js SHALL use mysqlPoolPromise from container instead of direct require
8. FOR ALL controllers, THE Backend SHALL resolve dependencies via container.resolve()
9. THE Backend SHALL maintain connection pooling and timeout configurations

### Requirement 6: Create Auth Service for Authentication Logic

**User Story:** As a backend developer, I want authentication logic in a dedicated service, so that auth.controller.js focuses only on HTTP concerns.

#### Acceptance Criteria

1. THE Backend SHALL create Backend/services/auth.service.js
2. THE Auth_Service SHALL provide updateLoginAttempts(userId, success) method
3. THE Auth_Service SHALL provide resetLoginAttempts(userId) method
4. THE Auth_Service SHALL provide checkAccountBlocked(userId) method
5. THE Auth_Service SHALL provide update2FASecret(userId, secret) method
6. THE Auth_Service SHALL provide enable2FA(userId) method
7. THE auth.controller.js SHALL delegate all database operations to Auth_Service
8. THE auth2fa.controller.js SHALL delegate all database operations to Auth_Service
9. FOR ALL authentication operations, THE Backend SHALL maintain identical security logic

### Requirement 7: Create CronConfig Service

**User Story:** As a backend developer, I want cron configuration logic in a service, so that cronConfig.controller.js is thin and testable.

#### Acceptance Criteria

1. THE Backend SHALL create Backend/services/cronConfig.service.js if it doesn't exist
2. THE CronConfig_Service SHALL provide getCronTasksConfig() method
3. THE CronConfig_Service SHALL provide updateCronTaskConfig(taskName, isEnabled) method
4. THE CronConfig_Service SHALL provide updateMultipleCronTasksConfig(tasks) method
5. THE cronConfig.controller.js SHALL delegate all database operations to CronConfig_Service
6. FOR ALL cron configuration operations, THE Backend SHALL maintain transaction support

### Requirement 8: Register New Services in Container

**User Story:** As a backend developer, I want all new services registered in the DI container, so that they can be resolved consistently.

#### Acceptance Criteria

1. THE Backend SHALL register passwordService in Backend/config/container.js
2. THE Backend SHALL register authService in Backend/config/container.js
3. THE Backend SHALL register cronConfigService in Backend/config/container.js (if not already registered)
4. THE Backend SHALL register auth2faService in Backend/config/container.js
5. FOR ALL new services, THE Backend SHALL use asValue() or asFunction().singleton() registration
6. THE Backend SHALL ensure services can resolve their dependencies from container

### Requirement 9: Update All Imports to Use Centralized Utils

**User Story:** As a backend developer, I want all files to use centralized utilities, so that there are no orphaned duplicate functions.

#### Acceptance Criteria

1. THE Backend SHALL update all services to import normalizeRut from Backend/utils/rut.util.js
2. THE Backend SHALL update all services to import normalizeOc functions from Backend/utils/oc.util.js
3. THE Backend SHALL update all controllers to import normalizeRut from Backend/utils/rut.util.js
4. THE Backend SHALL update all scripts to import normalization functions from utils
5. FOR ALL updated files, THE Backend SHALL remove local function definitions
6. THE Backend SHALL verify no duplicate normalization functions remain in codebase

### Requirement 10: Maintain Backward Compatibility

**User Story:** As a backend developer, I want the refactoring to maintain API compatibility, so that frontend and cron jobs continue working without changes.

#### Acceptance Criteria

1. THE Backend SHALL maintain identical API request/response formats
2. THE Backend SHALL maintain identical error messages and status codes
3. THE Backend SHALL maintain identical validation logic
4. THE Backend SHALL maintain identical database query results
5. THE Backend SHALL maintain identical JWT token generation
6. THE Backend SHALL maintain identical password hashing (bcrypt, 10 rounds)
7. THE Backend SHALL maintain identical 2FA verification logic
8. FOR ALL refactored endpoints, THE Backend SHALL pass existing integration tests

### Requirement 11: Add Comprehensive Logging

**User Story:** As a backend developer, I want consistent logging in new services, so that debugging and monitoring are easier.

#### Acceptance Criteria

1. THE Password_Service SHALL log all password change attempts with userId
2. THE Auth_Service SHALL log all login attempt updates with userId and success status
3. THE Auth_Service SHALL log all 2FA operations with userId
4. THE CronConfig_Service SHALL log all configuration changes with taskName and new value
5. FOR ALL service methods, THE Backend SHALL log errors with full error messages
6. THE Backend SHALL use existing logger utility from Backend/utils/logger.js
7. THE Backend SHALL follow existing log format patterns

### Requirement 12: Create Comprehensive Tests

**User Story:** As a backend developer, I want tests for all new services, so that refactoring doesn't introduce regressions.

#### Acceptance Criteria

1. THE Backend SHALL create Backend/tests/services/password.service.test.js
2. THE Backend SHALL create Backend/tests/services/auth.service.test.js
3. THE Backend SHALL create Backend/tests/services/cronConfig.service.test.js
4. THE Backend SHALL create Backend/tests/utils/oc.util.test.js
5. THE Backend SHALL test all public methods of new services
6. THE Backend SHALL test error handling paths
7. THE Backend SHALL test password strength validation
8. THE Backend SHALL test RUT and OC normalization edge cases
9. FOR ALL tests, THE Backend SHALL use existing test framework and patterns
10. THE Backend SHALL achieve minimum 80% code coverage for new services
