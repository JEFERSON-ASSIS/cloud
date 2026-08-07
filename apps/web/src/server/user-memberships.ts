export function canAssignOrganizationRole(actorRole: string | null, targetRole: string) {
  return targetRole !== "SUPER_ADMIN" || actorRole === "SUPER_ADMIN";
}

export function resolveManagedOrganizationId(input: {
  actorRole: string | null;
  sessionOrganizationId: string | null;
  requestedOrganizationId?: string | null | undefined;
}) {
  return input.actorRole === "SUPER_ADMIN" && input.requestedOrganizationId
    ? input.requestedOrganizationId
    : input.sessionOrganizationId;
}

export function shouldDeactivateUser(remainingMemberships: number) {
  return remainingMemberships === 0;
}
