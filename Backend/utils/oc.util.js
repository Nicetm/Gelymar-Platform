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
