import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const LIMIT_OPTIONS = [20, 50, 100];

interface Props {
  searchParams: Promise<{
    q?: string;
    actor_type?: string;
    action?: string;
    page?: string;
    limit?: string;
  }>;
}

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseLimit(value?: string) {
  const parsed = Number.parseInt(value ?? String(DEFAULT_LIMIT), 10);
  if (LIMIT_OPTIONS.includes(parsed)) {
    return parsed;
  }
  return DEFAULT_LIMIT;
}

function buildAuditPath(input: {
  q: string;
  actorType: string;
  action: string;
  limit: number;
  page: number;
}) {
  const query = new URLSearchParams();
  if (input.q) {
    query.set("q", input.q);
  }
  if (input.actorType !== "all") {
    query.set("actor_type", input.actorType);
  }
  if (input.action !== "all") {
    query.set("action", input.action);
  }
  if (input.limit !== DEFAULT_LIMIT) {
    query.set("limit", String(input.limit));
  }
  if (input.page > 1) {
    query.set("page", String(input.page));
  }
  const queryString = query.toString();
  return queryString ? `/admin/audit-logs?${queryString}` : "/admin/audit-logs";
}

function renderDetail(detail: unknown) {
  if (detail === null || detail === undefined) {
    return "-";
  }
  const text = JSON.stringify(detail);
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 117)}...`;
}

export default async function AdminAuditLogsPage({ searchParams }: Props) {
  await requireAdminPageSession();
  const query = await searchParams;

  const q = query.q?.trim() ?? "";
  const actorType = query.actor_type?.trim() || "all";
  const action = query.action?.trim() || "all";
  const requestedPage = parsePage(query.page);
  const limit = parseLimit(query.limit);

  const where: {
    actorType?: string;
    action?: string;
    OR?: Array<{
      actorId?: { contains: string; mode: "insensitive" };
      target?: { contains: string; mode: "insensitive" };
      action?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (actorType !== "all") {
    where.actorType = actorType;
  }
  if (action !== "all") {
    where.action = action;
  }
  if (q) {
    where.OR = [
      { actorId: { contains: q, mode: "insensitive" } },
      { target: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } }
    ];
  }

  const [total, actorTypes, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      select: { actorType: true },
      distinct: ["actorType"],
      orderBy: { actorType: "asc" }
    }),
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
      take: 200
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(requestedPage, totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * limit,
    take: limit
  });

  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  const prevPath = buildAuditPath({ q, actorType, action, limit, page: currentPage - 1 });
  const nextPath = buildAuditPath({ q, actorType, action, limit, page: currentPage + 1 });

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>Audit Logs</h2>

      <form className="card filter-bar" method="get" action="/admin/audit-logs">
        <p className="filter-title">Filters</p>
        <div className="filter-grid">
          <label className="filter-field">
            <span>Search</span>
            <input name="q" defaultValue={q} placeholder="actor_id / action / target" />
          </label>

          <label className="filter-field">
            <span>Actor Type</span>
            <select name="actor_type" defaultValue={actorType}>
              <option value="all">all</option>
              {actorTypes.map((item) => (
                <option key={item.actorType} value={item.actorType}>
                  {item.actorType}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Action</span>
            <select name="action" defaultValue={action}>
              <option value="all">all</option>
              {actions.map((item) => (
                <option key={item.action} value={item.action}>
                  {item.action}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Per Page</span>
            <select name="limit" defaultValue={String(limit)}>
              {LIMIT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button type="submit">Apply</button>
            <Link href="/admin/audit-logs" className="button secondary">
              Reset
            </Link>
          </div>
        </div>
      </form>

      <p className="muted">Total: {total}</p>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor Type</th>
                <th>Actor ID</th>
                <th>Action</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.createdAt.toISOString()}</td>
                  <td>{log.actorType}</td>
                  <td>{log.actorId}</td>
                  <td>{log.action}</td>
                  <td>{log.target}</td>
                  <td style={{ maxWidth: 360, wordBreak: "break-all" }}>{renderDetail(log.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 ? <p className="muted">No audit logs found.</p> : null}
      </article>

      {hasPrevPage || hasNextPage ? (
        <div className="timeline-pagination">
          <p className="muted timeline-page-label">
            {["Page", String(currentPage), "/", String(totalPages)].join(" ")}
          </p>
          <div className="timeline-pagination-actions">
            {hasPrevPage ? (
              <Link className="button secondary" href={prevPath}>
                Previous
              </Link>
            ) : null}
            {hasNextPage ? (
              <Link className="button secondary" href={nextPath}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
