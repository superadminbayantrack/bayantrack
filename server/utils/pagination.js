export function parsePagination(query = {}, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;
  const skip = (page - 1) * limit;
  const enabled = query.page !== undefined || query.limit !== undefined;
  return { page, limit, skip, enabled };
}

export function paginatedPayload({ items, total, page, limit }) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
