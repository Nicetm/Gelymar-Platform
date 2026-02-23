# Design Document: Backend Deep Refactoring

## Overview

This design document outlines a comprehensive refactoring of the Gelymar backend to eliminate code duplication, enforce proper separation of concerns, and establish consistent dependency injection patterns. The refactoring addresses systemic architectural issues while maintaining 100% backward compatibility with existing APIs.

### Goals

1. **Eliminate SQL queries from controllers**: Move all database access logic to service layer
2. **Consolidate duplicate utilities**: Create centralized RUT and OC normalization functions
3. **Establish password service**: Centralize password hashing, validation, and update logic
4. **Enforce dependency injection**: Remove direct requires of database config from controllers
5. **Create authentication service**: Extract authentication logic from controllers
6. **Maintain backward compatibility**: Ensure all existing APIs continue to work identically

### Non-Goals

- Changing API contracts or response formats
- Modifying database schema
- Altering authentication mechanisms (JWT, 2FA)
- Changing frontend integration points

### Success Criteria

- Zero SQL queries in controller files
- Single source of truth for RUT and OC normalization
- All password operations use centralized service
- All controllers use dependency injection for database access
- All existing integration tests pass without modification
- 80%+ code coverage for new services


## Architecture

### Current Architecture Issues

The current backend has several architectural problems that this refactoring addresses:

1. **Controllers contain SQL queries**: Controllers directly execute `pool.query()` calls, violating separation of concerns
2. **Duplicate normalization functions**: RUT and OC normalization logic is duplicated across 15+ files
3. **Password logic scattered**: Password hashing and validation exists in multiple controllers
4. **Direct database imports**: Controllers directly `require('../config/db')` instead of using dependency injection
5. **Missing service abstractions**: Authentication and password operations lack dedicated services

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Controllers                          │
│  (HTTP Request/Response, Validation, Delegation Only)       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                          Services                            │
│  (Business Logic, Database Access, External Systems)        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Auth       │  │  Password    │  │  CronConfig  │     │
│  │  Service     │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Customer    │  │    Order     │  │     User     │     │
│  │  Service     │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Utilities Layer                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  rut.util.js │  │  oc.util.js  │  │ jwt.util.js  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │    MySQL     │              │  SQL Server  │            │
│  │  (poolPromise)│              │  (getSqlPool)│            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Injection Flow

All dependencies flow through the Awilix container:

```javascript
// Container registration
container.register({
  // Database connections
  mysqlPoolPromise: asValue(poolPromise),
  getSqlPoolFn: asValue(getSqlPool),
  
  // New services
  passwordService: asValue(passwordService),
  authService: asValue(authService),
  auth2faService: asValue(auth2faService),
  
  // Existing services
  userService: asValue(userService),
  customerService: asValue(customerService),
  // ... other services
});

// Controller resolution
const { passwordService, authService } = container.resolve({
  passwordService: 'passwordService',
  authService: 'authService'
});
```


## Components and Interfaces

### 1. Password Service (Backend/services/password.service.js)

**Purpose**: Centralize all password-related operations including hashing, validation, and database updates.

**Interface**:

```javascript
/**
 * Password Service
 * Handles password hashing, validation, and updates
 */
class PasswordService {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
    this.SALT_ROUNDS = 10;
  }

  /**
   * Validates password strength
   * @param {string} password - Password to validate
   * @returns {Object} { valid: boolean, message?: string }
   */
  validatePasswordStrength(password) {
    if (typeof password !== 'string') {
      return { valid: false, message: 'Password must be a string' };
    }
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must include uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must include lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must include number' };
    }
    return { valid: true };
  }

  /**
   * Hashes a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verifies a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Changes user password (requires current password verification)
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} { success: boolean, message: string }
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // Get current user
      const pool = await this.pool;
      const [users] = await pool.query(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return { success: false, message: 'User not found' };
      }

      // Verify current password
      const validPassword = await this.verifyPassword(currentPassword, users[0].password);
      if (!validPassword) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update database
      await pool.query(
        'UPDATE users SET password = ?, change_pw = 1, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      );

      this.logger.info(`[PasswordService] Password changed for userId=${userId}`);
      return { success: true, message: 'Password updated successfully' };

    } catch (error) {
      this.logger.error(`[PasswordService] Error changing password: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resets user password (no current password required)
   * @param {number} userId - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} { success: boolean, message: string }
   */
  async resetPassword(userId, newPassword) {
    try {
      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update database
      const pool = await this.pool;
      const [result] = await pool.query(
        'UPDATE users SET password = ?, change_pw = 1, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      );

      if (result.affectedRows === 0) {
        return { success: false, message: 'User not found' };
      }

      this.logger.info(`[PasswordService] Password reset for userId=${userId}`);
      return { success: true, message: 'Password reset successfully' };

    } catch (error) {
      this.logger.error(`[PasswordService] Error resetting password: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PasswordService;
```

**Dependencies**:
- `mysqlPoolPromise`: MySQL connection pool
- `logger`: Logging utility
- `bcrypt`: Password hashing library

**Usage in Controllers**:

```javascript
// Before (in auth.controller.js)
const hashed = await bcrypt.hash(newPassword, 10);
const pool = await mysqlPoolPromise;
await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

// After
const result = await passwordService.changePassword(userId, currentPassword, newPassword);
if (!result.success) {
  return res.status(400).json({ message: result.message });
}
```


### 2. Auth Service (Backend/services/auth.service.js)

**Purpose**: Handle authentication-related database operations including login attempts, account blocking, and 2FA management.

**Interface**:

```javascript
/**
 * Auth Service
 * Handles authentication database operations
 */
class AuthService {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
    this.MAX_LOGIN_ATTEMPTS = 5;
  }

  /**
   * Updates login attempt counter and blocks account if needed
   * @param {number} userId - User ID
   * @param {boolean} success - Whether login was successful
   * @returns {Promise<Object>} { blocked: boolean, remainingAttempts: number }
   */
  async updateLoginAttempts(userId, success) {
    try {
      const pool = await this.pool;

      if (success) {
        // Reset attempts on successful login
        await pool.query(
          'UPDATE users SET intentos_fallidos = 0, updated_at = NOW() WHERE id = ?',
          [userId]
        );
        this.logger.info(`[AuthService] Login attempts reset for userId=${userId}`);
        return { blocked: false, remainingAttempts: this.MAX_LOGIN_ATTEMPTS };
      }

      // Increment failed attempts
      await pool.query(
        `UPDATE users
         SET intentos_fallidos = LEAST(COALESCE(intentos_fallidos, 0) + 1, 999),
             bloqueado = CASE
               WHEN COALESCE(intentos_fallidos, 0) + 1 >= ? THEN 1
               ELSE bloqueado
             END,
             updated_at = NOW()
         WHERE id = ?`,
        [this.MAX_LOGIN_ATTEMPTS, userId]
      );

      // Check if account is now blocked
      const [rows] = await pool.query(
        'SELECT intentos_fallidos, bloqueado FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return { blocked: false, remainingAttempts: 0 };
      }

      const blocked = Number(rows[0].bloqueado) === 1;
      const remainingAttempts = Math.max(
        0,
        this.MAX_LOGIN_ATTEMPTS - Number(rows[0].intentos_fallidos || 0)
      );

      this.logger.info(
        `[AuthService] Login attempt failed for userId=${userId}, ` +
        `blocked=${blocked}, remainingAttempts=${remainingAttempts}`
      );

      return { blocked, remainingAttempts };

    } catch (error) {
      this.logger.error(`[AuthService] Error updating login attempts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resets login attempts counter
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async resetLoginAttempts(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET intentos_fallidos = 0, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[AuthService] Login attempts reset for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error resetting login attempts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Checks if account is blocked
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if account is blocked
   */
  async checkAccountBlocked(userId) {
    try {
      const pool = await this.pool;
      const [rows] = await pool.query(
        'SELECT bloqueado FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return false;
      }

      return Number(rows[0].bloqueado) === 1;
    } catch (error) {
      this.logger.error(`[AuthService] Error checking account blocked: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates 2FA secret for user
   * @param {number} userId - User ID
   * @param {string} secret - 2FA secret (base32)
   * @returns {Promise<boolean>} Success status
   */
  async update2FASecret(userId, secret) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFASecret = ?, updated_at = NOW() WHERE id = ?',
        [secret, userId]
      );
      this.logger.info(`[AuthService] 2FA secret updated for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error updating 2FA secret: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enables 2FA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async enable2FA(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFAEnabled = 1, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[AuthService] 2FA enabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error enabling 2FA: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disables 2FA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async disable2FA(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFAEnabled = 0, twoFASecret = NULL, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[AuthService] 2FA disabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error disabling 2FA: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthService;
```

**Dependencies**:
- `mysqlPoolPromise`: MySQL connection pool
- `logger`: Logging utility

**Usage in Controllers**:

```javascript
// Before (in auth.controller.js)
await pool.query(
  `UPDATE users SET intentos_fallidos = LEAST(COALESCE(intentos_fallidos, 0) + 1, 999),
   bloqueado = CASE WHEN COALESCE(intentos_fallidos, 0) + 1 >= ? THEN 1 ELSE bloqueado END
   WHERE id = ?`,
  [MAX_LOGIN_ATTEMPTS, user.id]
);

// After
const result = await authService.updateLoginAttempts(user.id, false);
if (result.blocked) {
  return res.status(403).json({
    message: 'Account blocked due to failed attempts',
    error: 'ACCOUNT_BLOCKED'
  });
}
```


### 3. Auth2FA Service (Backend/services/auth2fa.service.js)

**Purpose**: Handle 2FA-specific database operations (separate from general auth operations).

**Interface**:

```javascript
/**
 * Auth2FA Service
 * Handles 2FA-specific database operations
 */
class Auth2FAService {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
  }

  /**
   * Gets 2FA configuration for user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} { twoFAEnabled, twoFASecret }
   */
  async get2FAConfig(userId) {
    try {
      const pool = await this.pool;
      const [rows] = await pool.query(
        'SELECT twoFAEnabled, twoFASecret FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return null;
      }

      return {
        twoFAEnabled: !!rows[0].twoFAEnabled,
        twoFASecret: rows[0].twoFASecret
      };
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error getting 2FA config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates 2FA secret
   * @param {number} userId - User ID
   * @param {string} secret - Base32 encoded secret
   * @returns {Promise<boolean>} Success status
   */
  async update2FASecret(userId, secret) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFASecret = ?, updated_at = NOW() WHERE id = ?',
        [secret, userId]
      );
      this.logger.info(`[Auth2FAService] 2FA secret updated for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error updating 2FA secret: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enables 2FA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async enable2FA(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFAEnabled = 1, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[Auth2FAService] 2FA enabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error enabling 2FA: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disables 2FA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async disable2FA(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFAEnabled = 0, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[Auth2FAService] 2FA disabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error disabling 2FA: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Auth2FAService;
```

### 4. OC Utility (Backend/utils/oc.util.js)

**Purpose**: Centralize OC (Order Code) normalization logic.

**Interface**:

```javascript
/**
 * OC (Order Code) Utilities
 * Consolidates OC normalization logic from multiple services
 */

/**
 * Normalizes an OC by converting to uppercase and removing spaces, hyphens, and parentheses
 * @param {string|number} oc - Order code to normalize
 * @returns {string} Normalized OC
 */
const normalizeOc = (oc) => {
  if (!oc) return '';
  return String(oc)
    .toUpperCase()
    .replace(/[\s()-]+/g, '');
};

/**
 * Normalizes an OC for comparison purposes
 * Alias for normalizeOc to maintain backward compatibility
 * @param {string|number} oc - Order code to normalize
 * @returns {string} Normalized OC
 */
const normalizeOcForCompare = (oc) => {
  return normalizeOc(oc);
};

/**
 * Compares two OCs for equality after normalization
 * @param {string|number} oc1 - First OC
 * @param {string|number} oc2 - Second OC
 * @returns {boolean} True if OCs are equal after normalization
 */
const compareOcs = (oc1, oc2) => {
  return normalizeOc(oc1) === normalizeOc(oc2);
};

module.exports = {
  normalizeOc,
  normalizeOcForCompare,
  compareOcs
};
```

**Usage**:

```javascript
// Before (duplicated in multiple files)
const normalizeOcForCompare = (oc) => {
  return String(oc || '').toUpperCase().replace(/[\s()-]+/g, '');
};

// After (import from utility)
const { normalizeOc, normalizeOcForCompare } = require('../utils/oc.util');

const normalized = normalizeOc(orderCode);
const isEqual = compareOcs(oc1, oc2);
```


## Data Models

### Password Service Data Flow

```
┌─────────────────┐
│   Controller    │
│  (HTTP Layer)   │
└────────┬────────┘
         │ { userId, currentPassword, newPassword }
         ▼
┌─────────────────┐
│ Password Service│
│  1. Validate    │
│  2. Hash        │
│  3. Update DB   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MySQL: users   │
│  - password     │
│  - change_pw    │
│  - updated_at   │
└─────────────────┘
```

### Auth Service Data Flow

```
┌─────────────────┐
│   Controller    │
│  (Login Logic)  │
└────────┬────────┘
         │ { userId, success: boolean }
         ▼
┌─────────────────┐
│  Auth Service   │
│  1. Update      │
│     attempts    │
│  2. Check block │
│  3. Return      │
│     status      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MySQL: users   │
│  - intentos_    │
│    fallidos     │
│  - bloqueado    │
│  - updated_at   │
└─────────────────┘
```

### Service Dependencies

```javascript
// Password Service
{
  mysqlPoolPromise: MySQL connection pool,
  logger: Winston logger instance
}

// Auth Service
{
  mysqlPoolPromise: MySQL connection pool,
  logger: Winston logger instance
}

// Auth2FA Service
{
  mysqlPoolPromise: MySQL connection pool,
  logger: Winston logger instance
}

// All services follow the same dependency pattern
```

### Database Schema (Relevant Tables)

```sql
-- users table (existing, no changes)
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rut VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  twoFASecret VARCHAR(255),
  twoFAEnabled BOOLEAN DEFAULT FALSE,
  change_pw TINYINT DEFAULT 0,
  bloqueado TINYINT DEFAULT 0,
  intentos_fallidos INT DEFAULT 0,
  online TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rut (rut),
  INDEX idx_role (role_id)
);
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Refactored endpoints maintain identical behavior

*For any* API request (method, path, headers, body) that was valid before refactoring, the response (status code, body structure, data) should be identical after refactoring.

**Validates: Requirements 1.8, 10.1, 10.4**

### Property 2: RUT normalization produces consistent results

*For any* RUT value, normalizing it with the centralized `normalizeRut` function should produce the same result as the old duplicate implementations.

**Validates: Requirements 2.9**

### Property 3: OC normalization produces consistent results

*For any* OC (Order Code) value, normalizing it with the centralized `normalizeOc` function should produce the same result as the old duplicate implementations (uppercase, spaces/hyphens/parentheses removed).

**Validates: Requirements 3.11**

### Property 4: Password strength validation is consistent

*For any* password string, the `validatePasswordStrength` method should return the same validation result (valid/invalid and reason) as the existing inline validation logic.

**Validates: Requirements 4.4, 4.10**

### Property 5: Password hashing is verifiable

*For any* plain text password, after hashing with `hashPassword`, the `verifyPassword` method should return true when given the original password and the hash.

**Validates: Requirements 4.5, 10.6**

### Property 6: Password changes update database correctly

*For any* valid password change operation (userId, currentPassword, newPassword), after calling `changePassword`, querying the database should show the password field updated and `change_pw = 1`.

**Validates: Requirements 4.6**

### Property 7: Authentication logic maintains security invariants

*For any* login attempt, the authentication logic should maintain these invariants:
- Failed attempts increment counter
- Counter resets on successful login
- Account blocks after MAX_LOGIN_ATTEMPTS failures
- Blocked accounts reject all login attempts

**Validates: Requirements 6.9**

### Property 8: API error responses are unchanged

*For any* error condition (invalid input, unauthorized access, not found), the error response format (status code, message structure) should be identical before and after refactoring.

**Validates: Requirements 10.2**

### Property 9: Validation logic is preserved

*For any* input to a validated endpoint, the validation result (pass/fail and error messages) should be identical before and after refactoring.

**Validates: Requirements 10.3**

### Property 10: JWT token generation is unchanged

*For any* user data (id, rut, role), the JWT token structure and claims should be identical before and after refactoring.

**Validates: Requirements 10.5**

### Property 11: 2FA verification logic is preserved

*For any* 2FA code and secret combination, the verification result should be identical before and after refactoring.

**Validates: Requirements 10.7**

### Property 12: Cron configuration updates are atomic

*For any* cron configuration update operation, either all changes are applied or none are applied (no partial updates on failure).

**Validates: Requirements 7.6**


## Error Handling

### Error Handling Patterns

All services follow consistent error handling patterns:

#### 1. Service Layer Error Handling

```javascript
// Pattern: Try-catch with logging and re-throw
async methodName(params) {
  try {
    // Business logic
    const result = await someOperation();
    this.logger.info(`[ServiceName] Operation successful: ${details}`);
    return result;
  } catch (error) {
    this.logger.error(`[ServiceName] Error in methodName: ${error.message}`);
    throw error; // Re-throw for controller to handle
  }
}
```

#### 2. Controller Layer Error Handling

```javascript
// Pattern: Catch service errors and return appropriate HTTP response
async controllerMethod(req, res) {
  try {
    const result = await service.methodName(params);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[ControllerName] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
```

#### 3. Validation Error Handling

```javascript
// Pattern: Return structured error response
const validation = service.validateSomething(input);
if (!validation.valid) {
  return res.status(400).json({
    success: false,
    message: validation.message
  });
}
```

### Error Types and HTTP Status Codes

| Error Type | HTTP Status | Example |
|------------|-------------|---------|
| Validation Error | 400 Bad Request | Invalid password strength |
| Authentication Error | 401 Unauthorized | Invalid credentials |
| Authorization Error | 403 Forbidden | Account blocked |
| Not Found Error | 404 Not Found | User not found |
| Server Error | 500 Internal Server Error | Database connection failed |

### Backward Compatibility Requirements

All error responses must maintain the same format as before refactoring:

```javascript
// Success response (unchanged)
{
  "success": true,
  "data": { ... }
}

// Error response (unchanged)
{
  "success": false,
  "message": "Error description"
}

// Error with additional context (unchanged)
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "remainingAttempts": 3
}
```

### Database Error Handling

```javascript
// Pattern: Handle connection and query errors
try {
  const pool = await this.pool;
  const [result] = await pool.query(sql, params);
  
  if (result.affectedRows === 0) {
    // Handle no rows affected
    return { success: false, message: 'No records updated' };
  }
  
  return { success: true, data: result };
} catch (error) {
  // Log database errors with context
  this.logger.error(`[ServiceName] Database error: ${error.message}`, {
    sql: sql.substring(0, 100), // Log first 100 chars of SQL
    params: params
  });
  throw error;
}
```

### Transaction Handling (CronConfig Service)

```javascript
// Pattern: Use transactions for atomic updates
async updateMultipleCronTasksConfig(tasks) {
  const pool = await this.pool;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    for (const [taskName, isEnabled] of Object.entries(tasks)) {
      await connection.query(
        'UPDATE cron_tasks_config SET is_enabled = ? WHERE task_name = ?',
        [isEnabled, taskName]
      );
    }
    
    await connection.commit();
    this.logger.info('[CronConfigService] Multiple tasks updated successfully');
    return true;
  } catch (error) {
    await connection.rollback();
    this.logger.error(`[CronConfigService] Transaction failed: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}
```


## Testing Strategy

### Dual Testing Approach

This refactoring requires both unit tests and integration tests to ensure correctness:

- **Unit tests**: Verify specific service methods, edge cases, and error conditions
- **Integration tests**: Verify API endpoints maintain identical behavior before/after refactoring
- Both are complementary and necessary for comprehensive coverage

### Unit Testing

#### Password Service Tests (Backend/tests/services/password.service.test.js)

```javascript
describe('PasswordService', () => {
  describe('validatePasswordStrength', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const result = passwordService.validatePasswordStrength('Short1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8 characters');
    });

    it('should reject passwords without uppercase', () => {
      const result = passwordService.validatePasswordStrength('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should reject passwords without lowercase', () => {
      const result = passwordService.validatePasswordStrength('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('lowercase');
    });

    it('should reject passwords without numbers', () => {
      const result = passwordService.validatePasswordStrength('NoNumbers');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('number');
    });

    it('should accept valid strong passwords', () => {
      const result = passwordService.validatePasswordStrength('ValidPass123');
      expect(result.valid).toBe(true);
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash password and verify correctly', async () => {
      const password = 'TestPassword123';
      const hash = await passwordService.hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      
      const isValid = await passwordService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const hash = await passwordService.hashPassword(password);
      
      const isValid = await passwordService.verifyPassword('WrongPassword123', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      // Test with mocked database
      const result = await passwordService.changePassword(1, 'OldPass123', 'NewPass123');
      expect(result.success).toBe(true);
    });

    it('should reject when current password is incorrect', async () => {
      const result = await passwordService.changePassword(1, 'WrongPass', 'NewPass123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('incorrect');
    });

    it('should reject weak new password', async () => {
      const result = await passwordService.changePassword(1, 'OldPass123', 'weak');
      expect(result.success).toBe(false);
      expect(result.message).toContain('8 characters');
    });
  });
});
```

#### Auth Service Tests (Backend/tests/services/auth.service.test.js)

```javascript
describe('AuthService', () => {
  describe('updateLoginAttempts', () => {
    it('should reset attempts on successful login', async () => {
      const result = await authService.updateLoginAttempts(1, true);
      expect(result.blocked).toBe(false);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should increment attempts on failed login', async () => {
      const result = await authService.updateLoginAttempts(1, false);
      expect(result.remainingAttempts).toBeLessThan(5);
    });

    it('should block account after max attempts', async () => {
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.updateLoginAttempts(1, false);
      }
      
      const result = await authService.updateLoginAttempts(1, false);
      expect(result.blocked).toBe(true);
      expect(result.remainingAttempts).toBe(0);
    });
  });

  describe('checkAccountBlocked', () => {
    it('should return true for blocked account', async () => {
      const blocked = await authService.checkAccountBlocked(1);
      expect(typeof blocked).toBe('boolean');
    });
  });

  describe('update2FASecret', () => {
    it('should update 2FA secret successfully', async () => {
      const result = await authService.update2FASecret(1, 'NEWSECRET123');
      expect(result).toBe(true);
    });
  });
});
```

#### OC Utility Tests (Backend/tests/utils/oc.util.test.js)

```javascript
describe('OC Utilities', () => {
  describe('normalizeOc', () => {
    it('should convert to uppercase', () => {
      expect(normalizeOc('abc123')).toBe('ABC123');
    });

    it('should remove spaces', () => {
      expect(normalizeOc('ABC 123')).toBe('ABC123');
    });

    it('should remove hyphens', () => {
      expect(normalizeOc('ABC-123')).toBe('ABC123');
    });

    it('should remove parentheses', () => {
      expect(normalizeOc('ABC(123)')).toBe('ABC123');
    });

    it('should handle combined formatting', () => {
      expect(normalizeOc('abc-123 (456)')).toBe('ABC123456');
    });

    it('should handle empty string', () => {
      expect(normalizeOc('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(normalizeOc(null)).toBe('');
      expect(normalizeOc(undefined)).toBe('');
    });
  });

  describe('compareOcs', () => {
    it('should return true for equivalent OCs', () => {
      expect(compareOcs('ABC-123', 'abc 123')).toBe(true);
      expect(compareOcs('ABC(123)', 'ABC123')).toBe(true);
    });

    it('should return false for different OCs', () => {
      expect(compareOcs('ABC123', 'DEF456')).toBe(false);
    });
  });
});
```

### Integration Testing

#### API Endpoint Tests

```javascript
describe('POST /api/auth/login', () => {
  it('should maintain identical response format', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'TestPass123' });
    
    // Verify response structure unchanged
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('customersWithoutAccount');
  });

  it('should maintain identical error responses', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('incorrecta');
  });
});

describe('POST /api/auth/change-password', () => {
  it('should change password successfully', async () => {
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('actualizada');
  });
});
```

### Property-Based Testing Configuration

For property-based tests, use a JavaScript PBT library like `fast-check`:

```javascript
const fc = require('fast-check');

describe('Property: Password hashing round-trip', () => {
  it('should verify any hashed password correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 50 }),
        async (password) => {
          // Add complexity to password to meet requirements
          const complexPassword = password + 'A1';
          
          const hash = await passwordService.hashPassword(complexPassword);
          const isValid = await passwordService.verifyPassword(complexPassword, hash);
          
          return isValid === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: OC normalization is idempotent', () => {
  it('should produce same result when applied twice', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (oc) => {
          const normalized1 = normalizeOc(oc);
          const normalized2 = normalizeOc(normalized1);
          return normalized1 === normalized2;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Tag format: `Feature: backend-deep-refactoring, Property {number}: {property_text}`

### Test Coverage Goals

- **New services**: Minimum 80% code coverage
- **Refactored controllers**: Maintain existing coverage
- **Integration tests**: All API endpoints must pass

### Testing Checklist

- [ ] All unit tests for new services pass
- [ ] All integration tests pass without modification
- [ ] Property-based tests verify round-trip properties
- [ ] Error handling paths are tested
- [ ] Edge cases (null, empty, invalid input) are tested
- [ ] Database transaction rollback is tested
- [ ] Logging output is verified in tests


## Migration Strategy

### Phase 1: Create New Services and Utilities

**Goal**: Establish new service layer without breaking existing code.

**Steps**:

1. **Create OC utility** (Backend/utils/oc.util.js)
   - Implement `normalizeOc`, `normalizeOcForCompare`, `compareOcs`
   - Add unit tests
   - No existing code changes yet

2. **Create Password Service** (Backend/services/password.service.js)
   - Implement all methods
   - Add unit tests
   - Register in container

3. **Create Auth Service** (Backend/services/auth.service.js)
   - Implement all methods
   - Add unit tests
   - Register in container

4. **Create Auth2FA Service** (Backend/services/auth2fa.service.js)
   - Implement all methods
   - Add unit tests
   - Register in container

5. **Update Container** (Backend/config/container.js)
   ```javascript
   const PasswordService = require('../services/password.service');
   const AuthService = require('../services/auth.service');
   const Auth2FAService = require('../services/auth2fa.service');
   
   container.register({
     // ... existing registrations
     passwordService: asFunction(() => new PasswordService({
       mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
       logger: container.resolve('logger')
     })).singleton(),
     authService: asFunction(() => new AuthService({
       mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
       logger: container.resolve('logger')
     })).singleton(),
     auth2faService: asFunction(() => new Auth2FAService({
       mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
       logger: container.resolve('logger')
     })).singleton()
   });
   ```

**Validation**: All new services can be instantiated and unit tests pass.

### Phase 2: Refactor Controllers (One at a Time)

**Goal**: Move SQL queries from controllers to services while maintaining API compatibility.

**Order of Refactoring**:

1. **auth.controller.js** (6 queries → authService, passwordService)
2. **auth2fa.controller.js** (2 queries → auth2faService)
3. **vendedor.controller.js** (1 query → passwordService)
4. **customer.controller.js** (2 queries → passwordService)
5. **cronConfig.controller.js** (2 queries → cronConfigService)

**Refactoring Pattern for Each Controller**:

```javascript
// Step 1: Add service resolution at top of file
const { container } = require('../config/container');
const passwordService = container.resolve('passwordService');
const authService = container.resolve('authService');

// Step 2: Remove direct database imports
// DELETE: const { poolPromise } = require('../config/db');

// Step 3: Replace SQL queries with service calls
// BEFORE:
const pool = await poolPromise;
await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

// AFTER:
const result = await passwordService.resetPassword(userId, newPassword);
if (!result.success) {
  return res.status(400).json({ message: result.message });
}

// Step 4: Run integration tests
// Step 5: Commit changes for this controller
```

**Validation After Each Controller**:
- [ ] All integration tests pass
- [ ] API responses are identical
- [ ] Error messages are unchanged
- [ ] No direct SQL queries remain in controller

### Phase 3: Consolidate Utility Functions

**Goal**: Replace duplicate normalization functions with centralized utilities.

**Steps**:

1. **Update services to use rut.util.js**:
   ```javascript
   // Files to update:
   // - Backend/services/customer.service.js (3 instances)
   // - Backend/services/order.service.js (1 instance)
   // - Backend/services/documentFile.service.js (1 instance)
   
   // BEFORE:
   const normalizeRut = (rut) => {
     return String(rut || '').trim().replace(/C$/i, '');
   };
   
   // AFTER:
   const { normalizeRut } = require('../utils/rut.util');
   ```

2. **Update services to use oc.util.js**:
   ```javascript
   // Files to update:
   // - Backend/services/order.service.js
   // - Backend/services/orderDetail.service.js
   // - Backend/services/item.service.js
   // - Backend/services/file.service.js
   // - Backend/services/documentFile.service.js
   // - Backend/services/checkOrderReception.service.js
   // - Backend/services/checkDefaultFiles.service.js
   // - Backend/scripts/backfill-order-files.js
   
   // BEFORE:
   const normalizeOcForCompare = (oc) => {
     return String(oc || '').toUpperCase().replace(/[\s()-]+/g, '');
   };
   
   // AFTER:
   const { normalizeOcForCompare } = require('../utils/oc.util');
   ```

3. **Update controllers to use utilities**:
   ```javascript
   // Files to update:
   // - Backend/controllers/customer.controller.js (2 instances)
   // - Backend/controllers/directory.controller.js (2 instances)
   // - Backend/controllers/documentFile.controller.js (1 instance)
   
   // BEFORE:
   const normalizedRut = rut.trim().replace(/C$/i, '');
   
   // AFTER:
   const { normalizeRut } = require('../utils/rut.util');
   const normalizedRut = normalizeRut(rut);
   ```

**Validation After Each File**:
- [ ] All tests pass
- [ ] Behavior is identical
- [ ] No duplicate function definitions remain

### Phase 4: Verification and Cleanup

**Goal**: Ensure complete refactoring and no regressions.

**Steps**:

1. **Code Search for Violations**:
   ```bash
   # Search for direct database imports in controllers
   grep -r "require.*config/db" Backend/controllers/
   grep -r "require.*config/sqlserver" Backend/controllers/
   
   # Search for pool.query in controllers
   grep -r "pool.query" Backend/controllers/
   
   # Search for duplicate normalization functions
   grep -r "const normalizeRut" Backend/
   grep -r "const normalizeOcForCompare" Backend/
   ```

2. **Run Full Test Suite**:
   ```bash
   npm test
   npm run test:integration
   npm run test:coverage
   ```

3. **Manual API Testing**:
   - Test all authentication endpoints
   - Test password change/reset flows
   - Test 2FA setup and verification
   - Test cron configuration updates
   - Verify error responses

4. **Performance Testing**:
   - Verify no performance degradation
   - Check database connection pool usage
   - Monitor response times

**Success Criteria**:
- [ ] Zero SQL queries in controllers
- [ ] Zero direct database imports in controllers
- [ ] Zero duplicate normalization functions
- [ ] All tests pass
- [ ] 80%+ coverage on new services
- [ ] API responses identical to before refactoring

### Rollback Plan

If issues are discovered:

1. **Immediate Rollback**: Revert to previous commit
2. **Partial Rollback**: Revert specific controller changes
3. **Service Isolation**: New services don't affect existing code until controllers are updated

### Deployment Strategy

1. **Development**: Complete all phases, verify tests
2. **Staging**: Deploy and run integration tests
3. **Production**: Deploy during low-traffic window
4. **Monitoring**: Watch logs for errors, monitor response times
5. **Validation**: Run smoke tests on production


## API Contracts (Must Be Maintained)

### Critical Requirement: Zero Breaking Changes

All API endpoints must maintain **100% backward compatibility**. This means:

- Request formats remain unchanged
- Response formats remain unchanged
- HTTP status codes remain unchanged
- Error messages remain unchanged
- Validation rules remain unchanged

### Authentication Endpoints

#### POST /api/auth/login

**Request**:
```json
{
  "email": "user@example.com",
  "username": "12345678-9",
  "password": "Password123",
  "otp": "123456",
  "captchaResponse": "..."
}
```

**Success Response** (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customersWithoutAccount": 5
}
```

**Error Responses**:
- 400: `{ "message": "Captcha verification failed" }`
- 401: `{ "message": "Usuario o clave incorrecta" }`
- 401 (2FA required): `{ "message": "twofa_required", "requires2FA": true, "twoFAToken": "..." }`
- 401 (invalid 2FA): `{ "message": "Código de autenticación inválido" }`
- 403 (blocked): `{ "message": "Tu cuenta ha sido bloqueada...", "error": "ACCOUNT_BLOCKED" }`

**Refactoring Impact**:
- SQL queries moved to `authService.updateLoginAttempts()`
- Password verification logic unchanged
- Response format unchanged
- Cookie setting unchanged

#### POST /api/auth/change-password

**Request**:
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass123"
}
```

**Success Response** (200):
```json
{
  "message": "Contraseña actualizada correctamente"
}
```

**Error Responses**:
- 400: `{ "message": "Faltan datos requeridos" }`
- 400: `{ "message": "La contraseña debe tener al menos 8 caracteres..." }`
- 401: `{ "message": "Contraseña actual incorrecta" }`
- 404: `{ "message": "Usuario no encontrado" }`

**Refactoring Impact**:
- Password validation moved to `passwordService.validatePasswordStrength()`
- Password hashing moved to `passwordService.hashPassword()`
- Database update moved to `passwordService.changePassword()`
- Response format unchanged

#### POST /api/auth/reset

**Request**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewPass123",
  "captchaResponse": "..."
}
```

**Success Response** (200):
```json
{
  "message": "Contraseña actualizada correctamente"
}
```

**Error Responses**:
- 400: `{ "message": "Faltan datos" }`
- 400: `{ "message": "La contraseña debe tener al menos 8 caracteres..." }`
- 400: `{ "message": "Token inválido o expirado" }`
- 404: `{ "message": "Usuario no encontrado" }`

**Refactoring Impact**:
- Password validation moved to `passwordService.validatePasswordStrength()`
- Database update moved to `passwordService.resetPassword()`
- Response format unchanged

#### GET /api/auth/2fa/setup

**Headers**:
```
X-2FA-Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response** (200):
```json
{
  "qr": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

**Error Responses**:
- 401: `{ "message": "Autenticación 2FA requerida" }`
- 403: `{ "message": "Token 2FA inválido" }`

**Refactoring Impact**:
- Database update moved to `authService.update2FASecret()`
- QR generation logic unchanged
- Response format unchanged

### Vendedor Endpoints

#### PUT /api/vendedores/:rut/password

**Request**:
```json
{
  "newPassword": "NewPass123"
}
```

**Success Response** (200):
```json
{
  "message": "Contraseña actualizada correctamente"
}
```

**Refactoring Impact**:
- Password hashing moved to `passwordService.hashPassword()`
- Database update moved to `passwordService.resetPassword()`
- Response format unchanged

### Customer Endpoints

#### PUT /api/customers/:rut/password

**Request**:
```json
{
  "newPassword": "NewPass123"
}
```

**Success Response** (200):
```json
{
  "message": "Contraseña actualizada correctamente"
}
```

**Refactoring Impact**:
- Password hashing moved to `passwordService.hashPassword()`
- Database update moved to `passwordService.resetPassword()`
- Response format unchanged

### Cron Config Endpoints

#### GET /api/cron/tasks-config

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "check_client_access": true,
    "check_default_files": false
  }
}
```

**Refactoring Impact**:
- Database query moved to `cronConfigService.getCronTasksConfig()`
- Response format unchanged

#### PUT /api/cron/tasks-config

**Request**:
```json
{
  "check_client_access": true,
  "check_default_files": true
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Configuración actualizada"
}
```

**Refactoring Impact**:
- Database updates moved to `cronConfigService.updateMultipleCronTasksConfig()`
- Transaction handling maintained
- Response format unchanged

### Validation Rules (Must Be Preserved)

#### Password Strength Validation

```javascript
// Current validation (must be preserved exactly)
const isStrongPassword = (value) => {
  if (typeof value !== 'string') return false;
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
};

// Error message (must be preserved exactly)
"La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número"
```

#### RUT Normalization (Must Be Preserved)

```javascript
// Current behavior (must be preserved)
const normalizeRut = (rut) => {
  return String(rut || '').trim().replace(/C$/i, '');
};

// Examples:
// "12345678-9C" → "12345678-9"
// "12345678-9" → "12345678-9"
// "  12345678-9  " → "12345678-9"
```

#### OC Normalization (Must Be Preserved)

```javascript
// Current behavior (must be preserved)
const normalizeOcForCompare = (oc) => {
  return String(oc || '').toUpperCase().replace(/[\s()-]+/g, '');
};

// Examples:
// "abc-123" → "ABC123"
// "ABC (123)" → "ABC123"
// "abc 123" → "ABC123"
```

### JWT Token Structure (Must Be Preserved)

```javascript
// Token payload structure (must be preserved)
{
  id: user.id,
  rut: user.rut,
  username: user.username || null,
  role: normalizedRole,
  roleId: user.role_id,
  cardCode: user.cardCode || null,
  iat: 1234567890,
  exp: 1234571490
}

// Token expiration: 1 hour (must be preserved)
// Cookie settings (must be preserved):
{
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 1000
}
```

### 2FA Verification (Must Be Preserved)

```javascript
// Speakeasy configuration (must be preserved)
speakeasy.totp.verify({
  secret: user.twoFASecret,
  encoding: 'base32',
  token: otp,
  window: 1  // Accept tokens from 1 time step before/after
});
```

### Login Attempt Tracking (Must Be Preserved)

```javascript
// Constants (must be preserved)
const MAX_LOGIN_ATTEMPTS = 5;

// Behavior (must be preserved):
// - Failed login increments intentos_fallidos
// - Successful login resets intentos_fallidos to 0
// - Account blocks when intentos_fallidos >= MAX_LOGIN_ATTEMPTS
// - Blocked accounts return 403 with error: "ACCOUNT_BLOCKED"
// - Failed login returns remainingAttempts in response
```


## Logging Patterns

### Logging Requirements

All new services must follow the existing logging patterns established in the codebase.

### Service-Level Logging

```javascript
class ServiceName {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
  }

  async methodName(params) {
    try {
      // Log operation start (optional, for complex operations)
      this.logger.info(`[ServiceName] Starting methodName with params=${JSON.stringify(params)}`);
      
      // Business logic
      const result = await someOperation();
      
      // Log success
      this.logger.info(`[ServiceName] methodName completed successfully for ${identifier}`);
      
      return result;
    } catch (error) {
      // Log error with full context
      this.logger.error(`[ServiceName] Error in methodName: ${error.message}`, {
        params: params,
        stack: error.stack
      });
      throw error;
    }
  }
}
```

### Password Service Logging

```javascript
// Log password changes (without sensitive data)
this.logger.info(`[PasswordService] Password changed for userId=${userId}`);
this.logger.info(`[PasswordService] Password reset for userId=${userId}`);

// Log validation failures
this.logger.warn(`[PasswordService] Weak password rejected for userId=${userId}`);

// Log errors
this.logger.error(`[PasswordService] Error changing password: ${error.message}`);
```

### Auth Service Logging

```javascript
// Log login attempts
this.logger.info(
  `[AuthService] Login attempt failed for userId=${userId}, ` +
  `blocked=${blocked}, remainingAttempts=${remainingAttempts}`
);

// Log successful resets
this.logger.info(`[AuthService] Login attempts reset for userId=${userId}`);

// Log 2FA operations
this.logger.info(`[AuthService] 2FA secret updated for userId=${userId}`);
this.logger.info(`[AuthService] 2FA enabled for userId=${userId}`);
this.logger.info(`[AuthService] 2FA disabled for userId=${userId}`);

// Log errors
this.logger.error(`[AuthService] Error updating login attempts: ${error.message}`);
```

### Controller-Level Logging

```javascript
// Log incoming requests (for important operations)
logger.info(`Intento de login para: ${identifier}`);
logger.info(`recoverPassword request for ${email || 'unknown'} from ${req.ip || 'unknown-ip'}`);

// Log successful operations
logger.info(`Login exitoso para usuario ${user.rut || user.username || 'undefined'}`);
logger.info(`Contraseña actualizada para ${email}`);

// Log warnings
logger.warn(`Usuario no encontrado: ${identifier}`);
logger.warn(`Contraseña incorrecta para usuario: ${identifier}`);
logger.warn(`Usuario bloqueado: ${identifier}`);

// Log errors
logger.error(`Error en login: ${err.message}`);
logger.error(`Error en changePassword: ${err.message}`);
```

### Security Logging

Use the specialized `logSecurity` function for security-related events:

```javascript
const { logSecurity } = require('../utils/logger');

// Log authentication attempts
logSecurity('LOGIN_ATTEMPT', {
  ip: req.ip,
  user: identifier,
  success: true,
  timestamp: new Date().toISOString()
});

// Log account blocking
logSecurity('ACCOUNT_BLOCKED', {
  userId: user.id,
  rut: user.rut,
  reason: 'MAX_LOGIN_ATTEMPTS_EXCEEDED',
  timestamp: new Date().toISOString()
});

// Log password changes
logSecurity('PASSWORD_CHANGED', {
  userId: userId,
  changedBy: req.user.id,
  timestamp: new Date().toISOString()
});

// Log 2FA operations
logSecurity('2FA_ENABLED', {
  userId: user.id,
  timestamp: new Date().toISOString()
});
```

### Log Format Standards

```javascript
// Service logs: [ServiceName] Message
this.logger.info(`[PasswordService] Password changed for userId=${userId}`);

// Controller logs: Message (no prefix)
logger.info(`Login exitoso para usuario ${user.rut}`);

// Include relevant identifiers
logger.info(`[AuthService] Operation for userId=${userId}, rut=${rut}`);

// Include operation results
logger.info(`[PasswordService] Validation result: ${validation.valid}, message: ${validation.message}`);

// Include error context
logger.error(`[ServiceName] Error: ${error.message}`, {
  operation: 'methodName',
  params: sanitizedParams,
  stack: error.stack
});
```

### What NOT to Log

```javascript
// ❌ NEVER log sensitive data
logger.info(`Password: ${password}`); // NEVER
logger.info(`Token: ${token}`); // NEVER
logger.info(`Secret: ${twoFASecret}`); // NEVER

// ❌ NEVER log full user objects (may contain sensitive data)
logger.info(`User: ${JSON.stringify(user)}`); // NEVER

// ✅ DO log identifiers only
logger.info(`[ServiceName] Operation for userId=${userId}`);
logger.info(`[ServiceName] User ${user.rut} performed action`);
```

### Log Levels

```javascript
// INFO: Normal operations, successful completions
this.logger.info(`[ServiceName] Operation completed successfully`);

// WARN: Recoverable issues, validation failures, not found
this.logger.warn(`[ServiceName] User not found: ${identifier}`);

// ERROR: Exceptions, database errors, system failures
this.logger.error(`[ServiceName] Database error: ${error.message}`);

// DEBUG: Detailed debugging information (not used in production)
this.logger.debug(`[ServiceName] Intermediate state: ${JSON.stringify(state)}`);
```

### Existing Logger Utility

The logger is already configured in `Backend/utils/logger.js`:

```javascript
const { logger, logSecurity, logAudit, logCronJob } = require('../utils/logger');

// General logging
logger.info('message');
logger.warn('message');
logger.error('message');

// Security events
logSecurity('EVENT_TYPE', { context });

// Audit trail
logAudit('ACTION', { user, resource, changes });

// Cron job logging
logCronJob('jobName', 'STATUS', { details });
```

All new services must use the existing logger instance resolved from the container.


## Dependency Injection Details

### Container Registration Pattern

All new services must be registered in `Backend/config/container.js` following the established pattern:

```javascript
const { createContainer, asValue, asFunction } = require('awilix');

// Import new services
const PasswordService = require('../services/password.service');
const AuthService = require('../services/auth.service');
const Auth2FAService = require('../services/auth2fa.service');

const container = createContainer();

container.register({
  // Existing registrations
  mysqlPoolPromise: asValue(poolPromise),
  sqlModule: asValue(sql),
  getSqlPoolFn: asValue(getSqlPool),
  logger: asValue(logger),
  
  // New service registrations
  passwordService: asFunction(() => new PasswordService({
    mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
    logger: container.resolve('logger')
  })).singleton(),
  
  authService: asFunction(() => new AuthService({
    mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
    logger: container.resolve('logger')
  })).singleton(),
  
  auth2faService: asFunction(() => new Auth2FAService({
    mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
    logger: container.resolve('logger')
  })).singleton(),
  
  // Existing services (unchanged)
  userService: asValue(userService),
  customerService: asValue(customerService),
  // ... other services
});

module.exports = { container };
```

### Service Resolution in Controllers

Controllers must resolve services from the container, not import database config directly:

```javascript
// ❌ BEFORE (Direct imports - WRONG)
const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');

exports.changePassword = async (req, res) => {
  const pool = await poolPromise;
  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
};

// ✅ AFTER (Container resolution - CORRECT)
const { container } = require('../config/container');
const passwordService = container.resolve('passwordService');

exports.changePassword = async (req, res) => {
  const result = await passwordService.changePassword(userId, currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }
  res.json({ message: result.message });
};
```

### Service Constructor Pattern

All new services must follow this constructor pattern:

```javascript
class ServiceName {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Promise} dependencies.mysqlPoolPromise - MySQL connection pool
   * @param {Object} dependencies.logger - Winston logger instance
   */
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
    // Initialize any constants
    this.CONSTANT_NAME = value;
  }
  
  // Methods...
}

module.exports = ServiceName;
```

### Dependency Resolution Order

1. **Database connections** are registered first (asValue)
2. **Utilities** (logger, mappers) are registered next (asValue)
3. **Services** are registered last (asFunction with singleton)

This ensures all dependencies are available when services are instantiated.

### Singleton Pattern

All services are registered as singletons to ensure:
- Single instance per application lifecycle
- Shared state (if needed)
- Efficient resource usage
- Consistent behavior across requests

```javascript
// Singleton registration
passwordService: asFunction(() => new PasswordService({
  mysqlPoolPromise: container.resolve('mysqlPoolPromise'),
  logger: container.resolve('logger')
})).singleton()

// This ensures the same instance is returned every time
const service1 = container.resolve('passwordService');
const service2 = container.resolve('passwordService');
// service1 === service2 (same instance)
```

### Testing with Dependency Injection

Dependency injection makes testing easier by allowing mock injection:

```javascript
// In tests
const mockPool = {
  query: jest.fn().mockResolvedValue([{ id: 1 }])
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
};

const passwordService = new PasswordService({
  mysqlPoolPromise: Promise.resolve(mockPool),
  logger: mockLogger
});

// Test with mocked dependencies
await passwordService.changePassword(1, 'old', 'new');
expect(mockPool.query).toHaveBeenCalled();
expect(mockLogger.info).toHaveBeenCalled();
```

### Service Dependencies Graph

```
┌─────────────────────────────────────────────────────────┐
│                    Container                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  mysqlPoolPromise ──┐                                   │
│                     │                                    │
│  logger ────────────┼────────┐                          │
│                     │        │                           │
│                     ▼        ▼                           │
│              ┌──────────────────────┐                   │
│              │  PasswordService     │                   │
│              └──────────────────────┘                   │
│                     │        │                           │
│                     ▼        ▼                           │
│              ┌──────────────────────┐                   │
│              │   AuthService        │                   │
│              └──────────────────────┘                   │
│                     │        │                           │
│                     ▼        ▼                           │
│              ┌──────────────────────┐                   │
│              │  Auth2FAService      │                   │
│              └──────────────────────┘                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

All services depend on the same two core dependencies:
- `mysqlPoolPromise`: Database access
- `logger`: Logging functionality

This creates a flat dependency graph with no circular dependencies.


## Implementation Checklist

### Phase 1: Create New Services and Utilities

- [ ] Create `Backend/utils/oc.util.js`
  - [ ] Implement `normalizeOc()`
  - [ ] Implement `normalizeOcForCompare()`
  - [ ] Implement `compareOcs()`
  - [ ] Add JSDoc comments
  - [ ] Create unit tests

- [ ] Create `Backend/services/password.service.js`
  - [ ] Implement constructor with DI
  - [ ] Implement `validatePasswordStrength()`
  - [ ] Implement `hashPassword()`
  - [ ] Implement `verifyPassword()`
  - [ ] Implement `changePassword()`
  - [ ] Implement `resetPassword()`
  - [ ] Add logging to all methods
  - [ ] Add JSDoc comments
  - [ ] Create unit tests

- [ ] Create `Backend/services/auth.service.js`
  - [ ] Implement constructor with DI
  - [ ] Implement `updateLoginAttempts()`
  - [ ] Implement `resetLoginAttempts()`
  - [ ] Implement `checkAccountBlocked()`
  - [ ] Implement `update2FASecret()`
  - [ ] Implement `enable2FA()`
  - [ ] Implement `disable2FA()`
  - [ ] Add logging to all methods
  - [ ] Add JSDoc comments
  - [ ] Create unit tests

- [ ] Create `Backend/services/auth2fa.service.js`
  - [ ] Implement constructor with DI
  - [ ] Implement `get2FAConfig()`
  - [ ] Implement `update2FASecret()`
  - [ ] Implement `enable2FA()`
  - [ ] Implement `disable2FA()`
  - [ ] Add logging to all methods
  - [ ] Add JSDoc comments
  - [ ] Create unit tests

- [ ] Update `Backend/config/container.js`
  - [ ] Import new services
  - [ ] Register `passwordService` as singleton
  - [ ] Register `authService` as singleton
  - [ ] Register `auth2faService` as singleton
  - [ ] Verify all services can be resolved

### Phase 2: Refactor Controllers

#### auth.controller.js
- [ ] Add service resolution at top
- [ ] Remove direct database imports
- [ ] Replace login attempt SQL with `authService.updateLoginAttempts()`
- [ ] Replace password reset SQL with `passwordService.resetPassword()`
- [ ] Replace password change SQL with `passwordService.changePassword()`
- [ ] Replace 2FA secret update with `authService.update2FASecret()`
- [ ] Verify all 6 SQL queries removed
- [ ] Run integration tests
- [ ] Verify API responses unchanged

#### auth2fa.controller.js
- [ ] Add service resolution at top
- [ ] Remove direct database imports
- [ ] Replace 2FA config queries with `auth2faService.get2FAConfig()`
- [ ] Replace 2FA updates with `auth2faService` methods
- [ ] Verify all 2 SQL queries removed
- [ ] Run integration tests
- [ ] Verify API responses unchanged

#### vendedor.controller.js
- [ ] Add service resolution at top
- [ ] Remove direct database imports
- [ ] Replace password update SQL with `passwordService.resetPassword()`
- [ ] Verify 1 SQL query removed
- [ ] Run integration tests
- [ ] Verify API responses unchanged

#### customer.controller.js
- [ ] Add service resolution at top
- [ ] Remove direct database imports
- [ ] Replace password update SQL with `passwordService.resetPassword()`
- [ ] Replace any other SQL queries with service calls
- [ ] Verify all 2 SQL queries removed
- [ ] Run integration tests
- [ ] Verify API responses unchanged

#### cronConfig.controller.js
- [ ] Verify `cronConfigService` exists
- [ ] Add service resolution at top
- [ ] Remove direct database imports
- [ ] Replace SQL queries with `cronConfigService` methods
- [ ] Verify all 2 SQL queries removed
- [ ] Run integration tests
- [ ] Verify API responses unchanged

### Phase 3: Consolidate Utility Functions

#### Update Services - RUT Normalization
- [ ] `Backend/services/customer.service.js`
  - [ ] Import `normalizeRut` from utils
  - [ ] Remove 3 duplicate implementations
  - [ ] Run tests
  
- [ ] `Backend/services/order.service.js`
  - [ ] Import `normalizeRut` from utils
  - [ ] Remove 1 duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/documentFile.service.js`
  - [ ] Import `normalizeRut` from utils
  - [ ] Remove 1 duplicate implementation
  - [ ] Run tests

#### Update Services - OC Normalization
- [ ] `Backend/services/order.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/orderDetail.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/item.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/file.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/documentFile.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/checkOrderReception.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/services/checkDefaultFiles.service.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run tests
  
- [ ] `Backend/scripts/backfill-order-files.js`
  - [ ] Import from `oc.util.js`
  - [ ] Remove duplicate implementation
  - [ ] Run script test

#### Update Controllers - RUT Normalization
- [ ] `Backend/controllers/customer.controller.js`
  - [ ] Import `normalizeRut` from utils
  - [ ] Replace 2 inline normalizations
  - [ ] Run tests
  
- [ ] `Backend/controllers/directory.controller.js`
  - [ ] Import `normalizeRut` from utils
  - [ ] Replace 2 inline normalizations
  - [ ] Run tests
  
- [ ] `Backend/controllers/documentFile.controller.js`
  - [ ] Import `normalizeRut` from utils
  - [ ] Replace 1 inline normalization
  - [ ] Run tests

### Phase 4: Verification

- [ ] Code Search Verification
  - [ ] No `require('../config/db')` in controllers
  - [ ] No `require('../config/sqlserver')` in controllers
  - [ ] No `pool.query` in controllers
  - [ ] No duplicate `normalizeRut` functions
  - [ ] No duplicate `normalizeOcForCompare` functions

- [ ] Test Suite
  - [ ] All unit tests pass
  - [ ] All integration tests pass
  - [ ] All property-based tests pass
  - [ ] Code coverage ≥ 80% for new services

- [ ] API Testing
  - [ ] POST /api/auth/login works
  - [ ] POST /api/auth/change-password works
  - [ ] POST /api/auth/reset works
  - [ ] GET /api/auth/2fa/setup works
  - [ ] PUT /api/vendedores/:rut/password works
  - [ ] PUT /api/customers/:rut/password works
  - [ ] GET /api/cron/tasks-config works
  - [ ] PUT /api/cron/tasks-config works

- [ ] Response Format Verification
  - [ ] All success responses match original format
  - [ ] All error responses match original format
  - [ ] All status codes match original
  - [ ] All error messages match original

- [ ] Performance Testing
  - [ ] No performance degradation
  - [ ] Database connection pool usage normal
  - [ ] Response times within acceptable range

### Phase 5: Documentation

- [ ] Update API documentation if needed
- [ ] Update service documentation
- [ ] Update README if needed
- [ ] Document new utility functions
- [ ] Update architecture diagrams

### Phase 6: Deployment

- [ ] Create pull request
- [ ] Code review
- [ ] Deploy to staging
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Run smoke tests on production


## Risk Assessment and Mitigation

### High-Risk Areas

#### 1. Authentication Flow Changes

**Risk**: Breaking login functionality affects all users.

**Mitigation**:
- Refactor auth.controller.js first with extensive testing
- Test all authentication paths: normal login, 2FA, blocked accounts
- Verify error messages are identical
- Test with multiple user roles (admin, client, seller)
- Keep rollback plan ready

#### 2. Password Operations

**Risk**: Users unable to change/reset passwords.

**Mitigation**:
- Maintain exact bcrypt configuration (10 salt rounds)
- Preserve password strength validation rules exactly
- Test password change with valid/invalid current passwords
- Test password reset with valid/expired tokens
- Verify database updates (password field and change_pw flag)

#### 3. Database Connection Pool

**Risk**: Connection pool exhaustion or configuration changes.

**Mitigation**:
- Do not modify pool configuration
- Verify connection pool is properly passed through DI
- Monitor connection pool usage during testing
- Test under load to ensure no connection leaks

#### 4. API Response Format Changes

**Risk**: Frontend breaks due to response format changes.

**Mitigation**:
- Document all current response formats
- Create integration tests that verify exact response structure
- Use JSON schema validation in tests
- Test error responses as thoroughly as success responses

### Medium-Risk Areas

#### 1. Utility Function Consolidation

**Risk**: Normalization behavior changes subtly.

**Mitigation**:
- Create comprehensive unit tests for normalization functions
- Test with edge cases (null, undefined, empty string, special characters)
- Verify behavior matches old implementations exactly
- Use property-based testing for normalization idempotence

#### 2. Service Dependency Resolution

**Risk**: Services fail to instantiate due to missing dependencies.

**Mitigation**:
- Test container resolution in isolation
- Verify all dependencies are registered before services
- Add startup validation that resolves all services
- Use TypeScript or JSDoc for dependency documentation

#### 3. Transaction Handling

**Risk**: Cron config updates leave database in inconsistent state.

**Mitigation**:
- Maintain transaction support in cronConfigService
- Test rollback scenarios
- Verify atomic updates (all or nothing)
- Add integration tests for transaction failures

### Low-Risk Areas

#### 1. Logging Changes

**Risk**: Missing or incorrect log messages.

**Mitigation**:
- Follow existing logging patterns
- Verify logs in tests
- Review logs during manual testing
- Ensure no sensitive data is logged

#### 2. Code Organization

**Risk**: Import paths break or circular dependencies.

**Mitigation**:
- Use consistent import patterns
- Avoid circular dependencies (services don't import controllers)
- Test that all files can be required without errors

### Rollback Strategy

#### Immediate Rollback (Critical Issues)

If critical issues are discovered in production:

1. **Revert to previous commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Redeploy previous version**:
   ```bash
   cd docker
   docker compose down
   docker compose up -d
   ```

3. **Verify rollback**:
   - Test login functionality
   - Test password operations
   - Check error logs

#### Partial Rollback (Specific Controller Issues)

If issues are isolated to one controller:

1. **Revert specific controller**:
   ```bash
   git checkout HEAD~1 -- Backend/controllers/auth.controller.js
   git commit -m "Rollback auth.controller.js"
   ```

2. **Keep new services** (they don't affect existing code)

3. **Redeploy**

#### Forward Fix (Minor Issues)

For non-critical issues:

1. **Create hotfix branch**
2. **Fix issue**
3. **Test thoroughly**
4. **Deploy fix**

### Monitoring and Alerts

#### Metrics to Monitor

- **Error rate**: Should not increase after deployment
- **Response time**: Should remain consistent
- **Login success rate**: Should remain consistent
- **Database connection pool**: Should not show exhaustion
- **Memory usage**: Should remain stable

#### Alert Thresholds

- Error rate increase > 5%: Investigate immediately
- Response time increase > 20%: Investigate
- Login failures > 10% of attempts: Critical alert
- Database connection pool > 80% usage: Warning

#### Log Monitoring

Watch for these patterns in logs:

```bash
# Error patterns to watch
grep "Error in" logs/app.log
grep "Database error" logs/app.log
grep "ACCOUNT_BLOCKED" logs/app.log

# Success patterns to verify
grep "Login exitoso" logs/app.log
grep "Password changed" logs/app.log
grep "2FA enabled" logs/app.log
```

### Testing in Production

#### Smoke Tests

After deployment, run these smoke tests:

1. **Login Test**:
   ```bash
   curl -X POST http://production-url/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"TestPass123"}'
   ```

2. **Password Change Test** (with test account):
   ```bash
   curl -X POST http://production-url/api/auth/change-password \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"currentPassword":"Old123","newPassword":"New123"}'
   ```

3. **2FA Setup Test**:
   ```bash
   curl -X GET http://production-url/api/auth/2fa/setup \
     -H "X-2FA-Token: Bearer $TOKEN"
   ```

#### Canary Deployment (Optional)

For extra safety, consider canary deployment:

1. Deploy to 10% of servers
2. Monitor for 1 hour
3. If no issues, deploy to 50%
4. Monitor for 1 hour
5. Deploy to 100%

This allows catching issues before they affect all users.


## Summary

This design document provides a comprehensive blueprint for refactoring the Gelymar backend to eliminate code duplication, enforce proper separation of concerns, and establish consistent dependency injection patterns.

### Key Deliverables

1. **New Services**:
   - `password.service.js`: Centralized password operations
   - `auth.service.js`: Authentication database operations
   - `auth2fa.service.js`: 2FA-specific operations

2. **New Utilities**:
   - `oc.util.js`: Centralized OC normalization

3. **Refactored Controllers**:
   - `auth.controller.js`: 6 SQL queries moved to services
   - `auth2fa.controller.js`: 2 SQL queries moved to services
   - `vendedor.controller.js`: 1 SQL query moved to services
   - `customer.controller.js`: 2 SQL queries moved to services
   - `cronConfig.controller.js`: 2 SQL queries moved to services

4. **Consolidated Utilities**:
   - 15+ files updated to use centralized RUT normalization
   - 9+ files updated to use centralized OC normalization

### Success Metrics

- ✅ Zero SQL queries in controller files
- ✅ Zero direct database imports in controllers
- ✅ Zero duplicate normalization functions
- ✅ 100% backward compatibility maintained
- ✅ 80%+ code coverage for new services
- ✅ All integration tests pass without modification

### Implementation Timeline

**Estimated effort**: 3-5 days

- **Day 1**: Create new services and utilities (Phase 1)
- **Day 2**: Refactor controllers (Phase 2)
- **Day 3**: Consolidate utility functions (Phase 3)
- **Day 4**: Verification and testing (Phase 4)
- **Day 5**: Documentation and deployment (Phase 5-6)

### Next Steps

1. Review and approve this design document
2. Create implementation tasks from checklist
3. Begin Phase 1: Create new services and utilities
4. Follow migration strategy step-by-step
5. Verify at each phase before proceeding

### Design Approval

This design is ready for implementation once approved. All requirements from the requirements document are addressed, and the migration strategy ensures zero breaking changes while achieving all refactoring goals.

