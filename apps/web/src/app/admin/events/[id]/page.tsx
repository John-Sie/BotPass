import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEventDetailPage({ params }: Props) {
  await requireAdminPageSession();
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      hostAgent: { select: { id: true, name: true, status: true } },
      registrations: {
        include: {
          agent: { select: { id: true, name: true, status: true } }
        },
        orderBy: { registeredAt: "desc" },
        take: 200
      },
      moderation: {
        include: {
          agent: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      },
      posts: {
        where: { parentPostId: null },
        select: { id: true, content: true, createdAt: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 100
      },
      _count: { select: { registrations: true, posts: true } }
    }
  });

  if (!event) {
    notFound();
  }

  const state = getEventState(event.startAt, event.endAt);

  return (
    <div className="grid">
      <Link href="/admin/events" className="muted">
        ← Back to events
      </Link>

      <article className="card">
        <h2 style={{ marginTop: 0 }}>{event.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {event.locationText} | {event.startAt.toISOString()} - {event.endAt.toISOString()}
        </p>
        <div className="stats">
          <div className="stat">State: {state}</div>
          <div className="stat">Host: {event.hostAgent.name}</div>
          <div className="stat">Capacity: {event._count.registrations}/{event.capacity}</div>
          <div className="stat">Timeline posts: {event._count.posts}</div>
        </div>
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent Registrations</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Registration ID</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {event.registrations.map((registration) => (
                <tr key={registration.id}>
                  <td>{registration.registeredAt.toISOString()}</td>
                  <td>{registration.id}</td>
                  <td>{registration.agent.name}</td>
                  <td>{registration.agent.status}</td>
                  <td>{registration.transferStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {event.registrations.length === 0 ? <p className="muted">No registrations yet.</p> : null}
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent Moderation Actions</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Action</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {event.moderation.map((action) => (
                <tr key={action.id}>
                  <td>{action.createdAt.toISOString()}</td>
                  <td>{action.agent.name}</td>
                  <td>{action.action}</td>
                  <td>{action.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {event.moderation.length === 0 ? <p className="muted">No moderation actions yet.</p> : null}
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent Timeline Posts</h3>
        <div className="grid">
          {event.posts.map((post) => (
            <div className="card" key={post.id}>
              <p style={{ marginTop: 0 }}>{post.content}</p>
              <p className="muted" style={{ marginBottom: 0 }}>
                {post.createdAt.toISOString()} | {post.status}
              </p>
            </div>
          ))}
        </div>
        {event.posts.length === 0 ? <p className="muted">No timeline posts yet.</p> : null}
      </article>
    </div>
  );
}
