/**
 * RFC 4122 version 4 identifier. The cryptographic source is preferred and the
 * platform fallback exists only for non-secure LAN origins where
 * `crypto.randomUUID` is not exposed; identifier collisions in that degraded
 * mode are astronomically unlikely at this ledger's row counts.
 */
export const newId = (prefix: string = ''): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const nativeUuid = crypto.randomUUID();
    return prefix ? `${prefix}-${nativeUuid}` : nativeUuid;
  }

  const randomBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let index = 0; index < randomBytes.length; index += 1) {
      randomBytes[index] = Math.floor(Math.random() * 256);
    }
  }

  randomBytes[6] = (randomBytes[6]! & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8]! & 0x3f) | 0x80;

  const hexDigest = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const assembledUuid = [
    hexDigest.slice(0, 8),
    hexDigest.slice(8, 12),
    hexDigest.slice(12, 16),
    hexDigest.slice(16, 20),
    hexDigest.slice(20),
  ].join('-');

  return prefix ? `${prefix}-${assembledUuid}` : assembledUuid;
};

/**
 * Unguessable capability string embedded in client-facing portal links. The
 * dashed UUID is stripped so the token stays a single URL path segment.
 */
export const newPortalToken = (): string => {
  return newId().replace(/-/g, '');
};
