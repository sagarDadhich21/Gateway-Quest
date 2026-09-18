/** Shape of the payload GQ signs into its own JWT after a successful BQ/EQ login. */
export interface GqTokenPayload {
  sub: string; // gq_user.id (uuid)
  bqUserId: number;
  propertyId: number | null;
  roles: string[];
}
