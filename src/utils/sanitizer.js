/**
 * UTILITY: sanitizeInput
 * Scrubs strings of HTML tags, trims whitespace, and enforces length.
 */
export const sanitizeInput = (input, maxLength = 280) => {
  if (typeof input !== 'string') return '';

  return input
    .replace(/<[^>]*>?/gm, '') // 1. Strip all HTML tags (XSS Prevention)
    .trim()                    // 2. Remove leading/trailing whitespace
    .substring(0, maxLength);   // 3. Hard-cap length (Defensive Layout)
};

/**
 * UTILITY: validateProfile
 * Specific rules for the User Identity protocol.
 */
export const validateProfile = (data) => {
  const errors = [];
  
  if (!data.displayName || data.displayName.length < 3) {
    errors.push("ID_TOO_SHORT: Min 3 chars");
  }
  
  if (data.displayName.match(/[^a-zA-Z0-9_ ]/)) {
    errors.push("ILLEGAL_CHARACTERS: Use alphanumeric only");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};