import { listGroupCategoryGroups, listGroupUsers } from './canvasClient';
import { mapWithConcurrency } from './concurrency';

const MEMBERS_CONCURRENCY = 4;

// Groups of one group set with their member ids, `[{ id, name, memberIds }]`.
// Shared by the peer-reviews page (default set, server-side) and the
// group-categories/[categoryId]/groups route (set switched client-side).
// Member lists are fetched with bounded concurrency (ADR-0016: the token
// refresh is single-flight, so parallel reads no longer race it).
export async function loadGroupsWithMembers(client, categoryId) {
  const groups = await listGroupCategoryGroups(client, categoryId);
  return mapWithConcurrency(groups, MEMBERS_CONCURRENCY, async (group) => {
    const users = await listGroupUsers(client, group.id);
    return { id: group.id, name: group.name, memberIds: users.map((u) => u.id) };
  });
}
