import React from "react";

export function StatusBadge({ status, label }) {
  if (!status) return null;

  const normalized = status.toString().toUpperCase();
  let badgeClass = "badge-neutral";
  let displayLabel = label || normalized;

  switch (normalized) {
    case "OPEN":
    case "ACTIVE":
    case "ALLOCATED":
    case "ELIGIBLE":
    case "PUBLISHED":
      badgeClass = "badge-allocated";
      break;

    case "DRAFT":
    case "UPCOMING":
    case "PENDING":
    case "PENDING_PUBLICATION":
      badgeClass = "badge-draft";
      break;

    case "CLOSED":
    case "INACTIVE":
    case "UNALLOCATED":
    case "INELIGIBLE":
      badgeClass = "badge-unallocated";
      break;

    case "SUBMITTED":
    case "COMPLETED":
      badgeClass = "badge-submitted";
      break;

    default:
      badgeClass = "badge-neutral";
      break;
  }

  return <span className={`badge ${badgeClass}`}>{displayLabel}</span>;
}
