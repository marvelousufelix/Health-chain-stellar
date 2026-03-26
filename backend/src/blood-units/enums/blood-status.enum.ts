/**
 * Blood unit lifecycle status.
 * Synchronized with Soroban contract blood unit statuses.
 *
 * Valid transitions follow this flow:
 * Available -> Reserved -> InTransit -> Delivered
 *         \-> Expired (can happen at any stage)
 *         \-> Compromised (temperature violations trigger this)
 */
export enum BloodStatus {
  /** Available for reservation - initial state after donation processing */
  AVAILABLE = 'AVAILABLE',
  /** Reserved for a specific request but not yet shipped */
  RESERVED = 'RESERVED',
  /** Currently being transported to destination */
  IN_TRANSIT = 'IN_TRANSIT',
  /** Successfully delivered to recipient/hospital */
  DELIVERED = 'DELIVERED',
  /** Expired and no longer usable (typically after 42 days for whole blood) */
  EXPIRED = 'EXPIRED',
  /** Compromised due to temperature violations - unsafe for use */
  COMPROMISED = 'COMPROMISED',
  /** Formally disposed of after expiry or compromise — permanent end-of-life */
  DISPOSED = 'DISPOSED',
}
