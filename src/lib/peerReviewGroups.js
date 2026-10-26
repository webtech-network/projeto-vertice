import { listGroupCategoryGroups, listGroupUsers } from './canvasClient';

// Groups of one group set with their member ids, `[{ id, name, memberIds }]`.
// Shared by the peer-reviews page (default set, server-side) and the
// group-categories/[categoryId]/groups route (set switched client-side).
// Sequential on purpose — never Promise.all on Canvas calls (concurrent
// refresh race, see canvas-api.md).
export async function loadGroupsWithMembers(client, categoryId) {
  const groups = await listGroupCategoryGroups(client, categoryId);
  const result = [];
  for (const group of groups) {
    const users = await listGroupUsers(client, group.id);
    result.push({ id: group.id, name: group.name, memberIds: users.map((u) => u.id) });
  }
  return result;
}
