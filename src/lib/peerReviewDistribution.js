// Peer-review distribution across groups — see
// specs/capabilities/peer-review-distribution.md and ADR-0013. Pure
// functions (no Canvas calls), shared by the page's preview and apply steps.
//
// A participant is `{ userId, submissionId, groupId }` — only students who
// actually submitted. `groupId` null/undefined means "not in any group of the
// chosen set": such a student becomes a one-person group (can review and be
// reviewed by anyone else), never silently merged into someone else's.

const GREEDY_ATTEMPTS = 25;

// mulberry32 — tiny seeded PRNG, so "Redistribuir" is a new seed and the
// same seed always reproduces the same preview.
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function effectiveGroupId(participant) {
  return participant.groupId != null ? String(participant.groupId) : `solo:${participant.userId}`;
}

function groupParticipants(participants) {
  const groups = new Map();
  for (const participant of participants) {
    const groupId = effectiveGroupId(participant);
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(participant);
  }
  return groups;
}

function toPair(reviewer, reviewee) {
  return { reviewerId: reviewer.userId, revieweeId: reviewee.userId, submissionId: reviewee.submissionId };
}

// Groups laid out as contiguous blocks on a circle of size n; with m the
// largest block, any two positions at circular distance in [m, n - m] are in
// different blocks. Reviewer i takes i+m … i+m+k-1, which stays in that range
// whenever k <= n - 2m + 1 — everyone gives and receives exactly k.
function circularPlan(groups, k, random) {
  const sequence = shuffle([...groups.values()], random).flatMap((members) => shuffle(members, random));
  const n = sequence.length;
  const m = Math.max(...[...groups.values()].map((members) => members.length));
  const pairs = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < k; j += 1) {
      pairs.push(toPair(sequence[i], sequence[(i + m + j) % n]));
    }
  }
  return pairs;
}

// Fallback when one group is too large for the circular layout: per round,
// each reviewee (most constrained — largest group — first) gets the
// least-loaded eligible reviewer. Never breaks the group rule; whatever can't
// be filled is reported as a deficit.
function greedyPlan(participants, k, random) {
  const groupOf = new Map(participants.map((p) => [p.userId, effectiveGroupId(p)]));
  const groupSize = new Map();
  for (const groupId of groupOf.values()) groupSize.set(groupId, (groupSize.get(groupId) || 0) + 1);

  const given = new Map(participants.map((p) => [p.userId, 0]));
  const reviewersOf = new Map(participants.map((p) => [p.userId, new Set()]));
  const pairs = [];

  for (let round = 0; round < k; round += 1) {
    const reviewees = shuffle(participants, random).sort(
      (a, b) => groupSize.get(groupOf.get(b.userId)) - groupSize.get(groupOf.get(a.userId))
    );
    for (const reviewee of reviewees) {
      const taken = reviewersOf.get(reviewee.userId);
      const candidates = shuffle(participants, random).filter(
        (reviewer) =>
          reviewer.userId !== reviewee.userId &&
          groupOf.get(reviewer.userId) !== groupOf.get(reviewee.userId) &&
          !taken.has(reviewer.userId) &&
          given.get(reviewer.userId) < k
      );
      if (candidates.length === 0) continue;
      const reviewer = candidates.reduce((best, c) => (given.get(c.userId) < given.get(best.userId) ? c : best));
      taken.add(reviewer.userId);
      given.set(reviewer.userId, given.get(reviewer.userId) + 1);
      pairs.push(toPair(reviewer, reviewee));
    }
  }
  return pairs;
}

function computeDeficits(participants, pairs, k) {
  const given = new Map(participants.map((p) => [p.userId, 0]));
  const received = new Map(participants.map((p) => [p.userId, 0]));
  for (const pair of pairs) {
    given.set(pair.reviewerId, given.get(pair.reviewerId) + 1);
    received.set(pair.revieweeId, received.get(pair.revieweeId) + 1);
  }
  return participants
    .filter((p) => given.get(p.userId) < k || received.get(p.userId) < k)
    .map((p) => ({ userId: p.userId, given: given.get(p.userId), received: received.get(p.userId) }));
}

function totalShortfall(deficits, k) {
  return deficits.reduce((sum, d) => sum + (k - d.given) + (k - d.received), 0);
}

/**
 * Plans who reviews whom. Returns `{ pairs, deficits, method, groupCount }`
 * where each pair is `{ reviewerId, revieweeId, submissionId }` and
 * `method` is 'circular' (exact k each way) or 'greedy' (best effort).
 */
export function planPeerReviews({ participants, k, seed = 1 }) {
  const groups = groupParticipants(participants);
  const n = participants.length;
  if (n < 2 || k < 1) {
    return { pairs: [], deficits: k < 1 ? [] : computeDeficits(participants, [], k), method: 'none', groupCount: groups.size };
  }

  const m = Math.max(...[...groups.values()].map((members) => members.length));
  const random = createRandom(seed);

  if (k <= n - 2 * m + 1) {
    const pairs = circularPlan(groups, k, random);
    return { pairs, deficits: [], method: 'circular', groupCount: groups.size };
  }

  let best = null;
  for (let attempt = 0; attempt < GREEDY_ATTEMPTS; attempt += 1) {
    const pairs = greedyPlan(participants, k, random);
    const deficits = computeDeficits(participants, pairs, k);
    const shortfall = totalShortfall(deficits, k);
    if (!best || shortfall < best.shortfall) best = { pairs, deficits, shortfall };
    if (shortfall === 0) break;
  }
  return { pairs: best.pairs, deficits: best.deficits, method: 'greedy', groupCount: groups.size };
}

function pairKey(reviewerId, revieweeId) {
  return `${reviewerId}:${revieweeId}`;
}

/**
 * "Refazer do zero" as a diff: the end state equals `planned`, but only what
 * differs is touched. `existing` are Canvas PeerReview objects
 * (`assessor_id` = reviewer, `user_id` = reviewee, `asset_id` = submission).
 */
export function diffPeerReviews(existing, planned) {
  const plannedKeys = new Set(planned.map((p) => pairKey(p.reviewerId, p.revieweeId)));
  const existingKeys = new Set(existing.map((r) => pairKey(r.assessor_id, r.user_id)));

  const toDelete = existing
    .filter((r) => !plannedKeys.has(pairKey(r.assessor_id, r.user_id)))
    .map((r) => ({
      reviewerId: r.assessor_id,
      revieweeId: r.user_id,
      submissionId: r.asset_id,
      completed: r.workflow_state === 'completed',
    }));
  const toCreate = planned.filter((p) => !existingKeys.has(pairKey(p.reviewerId, p.revieweeId)));
  const keep = planned.filter((p) => existingKeys.has(pairKey(p.reviewerId, p.revieweeId)));

  return { toDelete, toCreate, keep };
}
