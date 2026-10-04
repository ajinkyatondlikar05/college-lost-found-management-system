/**
 * Report Card Presentation and Timeline Mapping Utilities
 *
 * Implements strict mapping rules for user-facing report cards:
 * 1. Single primary status: LOST, FOUND, or RECOVERED
 * 2. Activity timelines for:
 *    - Path A: Owner found own item (Reported Lost -> Active -> Owner Found Item -> OTP Verified -> Recovered)
 *    - Path B: Another student found item (Reported Lost -> Active -> Finder Reported -> Owner Confirmed Recovery -> OTP Verified -> Recovered)
 *    - Path C: Finder rejected by owner (Reported Lost -> Active -> Finder Reported -> Owner Rejected Finder -> Active / Available Again)
 * 3. Real timestamps formatting without invented dates.
 */

/**
 * Format a Date value into "DD MMM YYYY, hh:mm AM/PM" (e.g., "04 Oct 2026, 10:32 AM")
 * Returns null if the date is invalid or unavailable.
 */
export const formatTimelineDate = (dateVal) => {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHour = String(hours).padStart(2, '0');

    return `${day} ${month} ${year}, ${formattedHour}:${minutes} ${ampm}`;
  } catch (e) {
    return null;
  }
};

/**
 * Determine single, non-contradictory primary status of an item.
 * Never shows contradictory badges such as LOST + RESOLVED or LOST + CLAIM: RESOLVED.
 *
 * States:
 * - RECOVERED: Recovery completed (status is Resolved or Claimed)
 * - FOUND: Item currently awaiting owner recovery confirmation, or is an unresolved found report
 * - LOST: Item is actively lost with no active finder
 */
export const getItemPrimaryStatus = (item) => {
  if (!item) {
    return { label: 'LOST', state: 'lost', badgeClass: 'badge-lost' };
  }

  const isLost = (item.type || '').toLowerCase() === 'lost';
  const rawStatus = (item.status || 'Active').toLowerCase();
  const claims = Array.isArray(item.claims) ? item.claims : [];
  const activeClaim = claims.find((c) =>
    ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
  );

  // 1. Recovered / Resolved state
  if (rawStatus === 'resolved' || rawStatus === 'claimed') {
    return {
      label: 'RECOVERED',
      state: 'recovered',
      badgeClass: 'badge-recovered',
    };
  }

  // 2. Lost item with an active finder claim awaiting owner confirmation
  if (isLost && (item.foundBy || activeClaim)) {
    return {
      label: 'FOUND',
      state: 'found',
      badgeClass: 'badge-found',
    };
  }

  // 3. User-submitted found item report
  if (!isLost) {
    return {
      label: 'FOUND',
      state: 'found',
      badgeClass: 'badge-found',
    };
  }

  // 4. Default: Actively lost item (including after owner rejected finder)
  return {
    label: 'LOST',
    state: 'lost',
    badgeClass: 'badge-lost',
  };
};

/**
 * Build dynamic timeline steps based on actual backend data.
 *
 * Supported Paths:
 * - PATH A: Owner found own item
 * - PATH B: Another student found item
 * - PATH C: Finder report rejected by owner
 * - Default: Active lost item
 * - Found item: User reported finding an item
 */
export const buildReportTimeline = (item) => {
  if (!item) return [];

  const isLost = (item.type || '').toLowerCase() === 'lost';
  const rawStatus = (item.status || 'Active').toLowerCase();
  const isResolved = rawStatus === 'resolved' || rawStatus === 'claimed';
  const claims = Array.isArray(item.claims) ? item.claims : [];

  const resolvedClaim = claims.find((c) => c.status === 'resolved');
  const activeClaim = claims.find((c) =>
    ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
  );
  const rejectedClaim = claims.find((c) => c.status === 'rejected');

  if (isLost) {
    // PATH A: OWNER FOUND THEIR OWN ITEM
    // Conditions: Resolved, recoveryType === 'owner_found' OR (no resolved claim and no foundBy)
    if (isResolved && (item.recoveryType === 'owner_found' || (!resolvedClaim && !item.foundBy))) {
      return [
        {
          key: 'reported_lost',
          title: 'Reported Lost',
          date: formatTimelineDate(item.createdAt),
          status: 'completed',
        },
        {
          key: 'active',
          title: 'Active',
          date: formatTimelineDate(item.createdAt),
          status: 'completed',
        },
        {
          key: 'owner_found',
          title: 'Owner Found Item',
          date: formatTimelineDate(item.ownerConfirmedAt || item.resolvedAt),
          status: 'completed',
        },
        {
          key: 'otp_verified',
          title: 'OTP Verified',
          date: formatTimelineDate(item.ownerConfirmedAt || item.resolvedAt),
          status: 'completed',
        },
        {
          key: 'recovered',
          title: 'Recovered',
          date: formatTimelineDate(item.resolvedAt || item.ownerConfirmedAt),
          status: 'completed',
        },
      ];
    }

    // PATH B: ANOTHER STUDENT FOUND THE ITEM (Resolved or In-Progress)
    if (
      item.recoveryType === 'finder_found' ||
      resolvedClaim ||
      activeClaim ||
      item.foundBy
    ) {
      const isItemResolved = isResolved || (resolvedClaim && resolvedClaim.status === 'resolved');
      const claimToUse = resolvedClaim || activeClaim;
      const finderReportDate = claimToUse ? (claimToUse.submittedAt || claimToUse.createdAt) : null;
      const resolvedDate = item.resolvedAt || (resolvedClaim ? resolvedClaim.resolvedAt : null);
      const ownerConfirmedDate = item.ownerConfirmedAt || (resolvedClaim ? resolvedClaim.ownerConfirmedAt : null) || (isItemResolved ? (resolvedDate || finderReportDate) : null);

      return [
        {
          key: 'reported_lost',
          title: 'Reported Lost',
          date: formatTimelineDate(item.createdAt),
          status: 'completed',
        },
        {
          key: 'active',
          title: 'Active',
          date: formatTimelineDate(item.createdAt),
          status: 'completed',
        },
        {
          key: 'finder_reported',
          title: 'Finder Reported',
          date: formatTimelineDate(finderReportDate),
          status: 'completed',
        },
        {
          key: 'owner_confirmed',
          title: 'Owner Confirmed Recovery',
          date: formatTimelineDate(ownerConfirmedDate),
          status: (isItemResolved || ownerConfirmedDate) ? 'completed' : 'pending',
        },
        {
          key: 'otp_verified',
          title: 'OTP Verified',
          date: formatTimelineDate(ownerConfirmedDate || resolvedDate),
          status: (isItemResolved || ownerConfirmedDate || resolvedDate) ? 'completed' : 'pending',
        },
        {
          key: 'recovered',
          title: 'Recovered',
          date: formatTimelineDate(resolvedDate),
          status: isItemResolved ? 'completed' : 'pending',
        },
      ];
    }

    // PATH C: FINDER REPORT REJECTED BY OWNER (Active / Available again)
    if (!isResolved && !activeClaim && rejectedClaim) {
      return [
        {
          key: 'reported_lost',
          title: 'Reported Lost',
          date: formatTimelineDate(item.createdAt),
          status: 'completed',
        },
        {
          key: 'active_initial',
          title: 'Active',
          date: formatTimelineDate(item.createdAt),
          status: 'completed',
        },
        {
          key: 'finder_reported',
          title: 'Finder Reported',
          date: formatTimelineDate(rejectedClaim.submittedAt || rejectedClaim.createdAt),
          status: 'completed',
        },
        {
          key: 'owner_rejected',
          title: 'Owner Rejected Finder',
          date: formatTimelineDate(rejectedClaim.rejectedAt),
          status: 'completed',
        },
        {
          key: 'active_again',
          title: 'Active / Available Again',
          date: formatTimelineDate(rejectedClaim.rejectedAt || item.updatedAt),
          status: 'completed',
        },
      ];
    }

    // DEFAULT LOST ITEM (Newly reported / Active search)
    return [
      {
        key: 'reported_lost',
        title: 'Reported Lost',
        date: formatTimelineDate(item.createdAt),
        status: 'completed',
      },
      {
        key: 'active',
        title: 'Active',
        date: formatTimelineDate(item.createdAt),
        status: 'completed',
      },
      {
        key: 'finder_reported',
        title: 'Finder Reported',
        date: null,
        status: 'pending',
      },
      {
        key: 'owner_confirmed',
        title: 'Owner Confirmed Recovery',
        date: null,
        status: 'pending',
      },
      {
        key: 'otp_verified',
        title: 'OTP Verified',
        date: null,
        status: 'pending',
      },
      {
        key: 'recovered',
        title: 'Recovered',
        date: null,
        status: 'pending',
      },
    ];
  }

  // Found item reported by user
  const latestClaim = item.latestClaim || claims[0] || null;
  const isClaimedOrResolved = isResolved || (latestClaim && latestClaim.status === 'resolved');

  return [
    {
      key: 'reported_found',
      title: 'Reported Found',
      date: formatTimelineDate(item.createdAt),
      status: 'completed',
    },
    {
      key: 'active',
      title: 'Active',
      date: formatTimelineDate(item.createdAt),
      status: 'completed',
    },
    {
      key: 'owner_claim',
      title: 'Owner Claim Received',
      date: formatTimelineDate(latestClaim ? (latestClaim.submittedAt || latestClaim.createdAt) : null),
      status: latestClaim ? 'completed' : 'pending',
    },
    {
      key: 'otp_verified',
      title: 'OTP Verified',
      date: formatTimelineDate(item.ownerConfirmedAt || item.resolvedAt || (latestClaim ? latestClaim.ownerConfirmedAt : null)),
      status: (item.ownerConfirmedAt || item.resolvedAt || (latestClaim && latestClaim.ownerConfirmedAt)) ? 'completed' : 'pending',
    },
    {
      key: 'recovered',
      title: 'Recovered',
      date: formatTimelineDate(item.resolvedAt || (latestClaim ? latestClaim.resolvedAt : null)),
      status: isClaimedOrResolved ? 'completed' : 'pending',
    },
  ];
};
