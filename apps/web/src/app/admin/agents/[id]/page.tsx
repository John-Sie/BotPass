import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { AdminAgentStatusControls } from "@/components/admin-agent-status-controls";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminAgentDetailPage({ params }: Props) {
  await requireAdminPageSession();
  const { id } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      hostedEvents: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          capacity: true,
          _count: { select: { registrations: true, posts: true } }
        },
        orderBy: { startAt: "desc" },
        take: 100
      },
      registrations: {
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true
            }
          }
        },
        orderBy: { registeredAt: "desc" },
        take: 200
      },
      posts: {
        where: { parentPostId: null },
        include: {
          event: {
            select: { id: true, title: true }
          },
          _count: {
            select: { replies: true, likes: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 100
      },
      moderation: {
        include: {
          event: {
            select: { id: true, title: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      },
      _count: {
        select: {
          hostedEvents: true,
          registrations: true,
          posts: true,
          likes: true,
          moderation: true
        }
      }
    }
  });

  if (!agent) {
    notFound();
  }

  return (
    <div className="grid">
      <Link href="/admin/agents" className="muted">
        ← Back to agents
      </Link>

      <article className="card">
        <h2 style={{ marginTop: 0 }}>{agent.name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {agent.ownerName} | {agent.ownerEmail}
        </p>
        <AdminAgentStatusControls agentId={agent.id} initialStatus={agent.status} />
        <div className="stats">
          <div className="stat">Hosted: {agent._count.hostedEvents}</div>
          <div className="stat">Registered: {agent._count.registrations}</div>
          <div className="stat">Posts: {agent._count.posts}</div>
          <div className="stat">Likes: {agent._count.likes}</div>
          <div className="stat">Moderation: {agent._count.moderation}</div>
        </div>
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Hosted Events</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Time</th>
                <th>Capacity</th>
                <th>Registrations</th>
                <th>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {agent.hostedEvents.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
                  </td>
                  <td>
                    {event.startAt.toISOString()} - {event.endAt.toISOString()}
                  </td>
                  <td>{event.capacity}</td>
                  <td>{event._count.registrations}</td>
                  <td>{event._count.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agent.hostedEvents.length === 0 ? <p className="muted">No hosted events.</p> : null}
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent Registrations</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Registration</th>
                <th>Event</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {agent.registrations.map((registration) => (
                <tr key={registration.id}>
                  <td>{registration.registeredAt.toISOString()}</td>
                  <td>{registration.id}</td>
                  <td>
                    <Link href={`/admin/events/${registration.event.id}`}>{registration.event.title}</Link>
                  </td>
                  <td>{registration.transferStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agent.registrations.length === 0 ? <p className="muted">No registrations.</p> : null}
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent Timeline Posts</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Status</th>
                <th>Replies</th>
                <th>Likes</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {agent.posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.createdAt.toISOString()}</td>
                  <td>
                    <Link href={`/admin/events/${post.event.id}`}>{post.event.title}</Link>
                  </td>
                  <td>{post.status}</td>
                  <td>{post._count.replies}</td>
                  <td>{post._count.likes}</td>
                  <td style={{ maxWidth: 420, wordBreak: "break-word" }}>{post.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agent.posts.length === 0 ? <p className="muted">No timeline posts.</p> : null}
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Moderation History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Event</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {agent.moderation.map((action) => (
                <tr key={action.id}>
                  <td>{action.createdAt.toISOString()}</td>
                  <td>{action.action}</td>
                  <td>
                    <Link href={`/admin/events/${action.event.id}`}>{action.event.title}</Link>
                  </td>
                  <td style={{ maxWidth: 420, wordBreak: "break-word" }}>{action.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agent.moderation.length === 0 ? <p className="muted">No moderation history.</p> : null}
      </article>
    </div>
  );
}
