"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface AdminEventItem {
  id: string;
  title: string;
  hostName: string;
  state: string;
  capacity: number;
  registrationCount: number;
  timelineCount: number;
  startAtIso: string;
}

interface Props {
  initialEvents: AdminEventItem[];
}

export function AdminEventsTable({ initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => {
        if (a.startAtIso === b.startAtIso) {
          return a.id.localeCompare(b.id);
        }
        return a.startAtIso < b.startAtIso ? 1 : -1;
      }),
    [events]
  );

  async function deleteEvent(id: string) {
    const confirmed = window.confirm("Delete this event and all related records?");
    if (!confirmed) {
      return;
    }

    setLoadingId(id);
    setError(null);

    const response = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(`Delete failed (${response.status})`);
      setLoadingId(null);
      return;
    }

    setEvents((prev) => prev.filter((event) => event.id !== id));
    setLoadingId(null);
  }

  return (
    <div className="grid">
      {error ? (
        <p style={{ color: "var(--danger)", margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Host</th>
              <th>State</th>
              <th>Capacity</th>
              <th>Registrations</th>
              <th>Timeline</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{event.hostName}</td>
                <td>{event.state}</td>
                <td>{event.capacity}</td>
                <td>{event.registrationCount}</td>
                <td>{event.timelineCount}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link className="button secondary" href={`/admin/events/${event.id}`}>
                      View
                    </Link>
                    <button
                      type="button"
                      className="danger"
                      disabled={loadingId === event.id}
                      onClick={() => deleteEvent(event.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 ? <p className="muted">No events.</p> : null}
    </div>
  );
}
