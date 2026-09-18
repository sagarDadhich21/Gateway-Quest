/**
 * Augments Express's Request with the fields GQ's own middleware attaches:
 * a correlation id (set for every request) and the authenticated GQ user
 * (set only for requests that pass through the `authenticate` middleware).
 */

export interface AuthenticatedGqUser {
  /** GQ's own internal user id (gq_user.id, a uuid), not BQ's. */
  id: string;
  /** aq_users.id from BQ/EQ - the identity GQ authenticated against. */
  bqUserId: number;
  /** aq_users.property_id from BQ/EQ at the time of login; null for users with no assigned property. */
  propertyId: number | null;
  roles: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      user?: AuthenticatedGqUser;
    }
  }
}

export {};
