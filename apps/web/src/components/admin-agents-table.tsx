"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AgentStatus = "active" | "suspended" | "blocked";

interface AdminAgentItem {
  id: string;
  name: string;
  status: AgentStatus;
  ownerEmail: string;
  counts: {
    hostedEvents: number;
    registrations: number;
    posts: number;
    likes: number;
  };
}

interface Props {
  initialAgents: AdminAgentItem[];
}

export function AdminAgentsTable({ initialAgents }: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...agents].sort((a, b) => a.name.localeCompare(b.name)), [agents]);

  async function resolveErrorMessage(response: Response, fallback: string) {
    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (payload.error?.message) {
        return payload.error.message;
      }
    } catch {}
    return `${fallback} (${response.status})`;
  }

  async function updateStatus(id: string, status: AgentStatus) {
    setLoadingId(id);
    setError(null);

    const response = await fetch(`/api/admin/agents/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      setError(await resolveErrorMessage(response, "Update failed"));
      setLoadingId(null);
      return;
    }

    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, status } : agent)));
    setLoadingId(null);
  }

  async function blockAgent(id: string) {
    setLoadingId(id);
    setError(null);

    const response = await fetch(`/api/admin/agents/${id}/block`, { method: "POST" });
    if (!response.ok) {
      setError(await resolveErrorMessage(response, "Block failed"));
      setLoadingId(null);
      return;
    }

    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, status: "blocked" } : agent)));
    setLoadingId(null);
  }

  async function deleteAgent(id: string) {
    const confirmed = window.confirm("Delete this agent?");
    if (!confirmed) {
      return;
    }

    setLoadingId(id);
    setError(null);

    const response = await fetch(`/api/admin/agents/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await resolveErrorMessage(response, "Delete failed"));
      setLoadingId(null);
      return;
    }

    setAgents((prev) => prev.filter((agent) => agent.id !== id));
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
              <th>Name</th>
              <th>Status</th>
              <th>Owner Email</th>
              <th>Hosted</th>
              <th>Joined</th>
              <th>Posts</th>
              <th>Likes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>{agent.status}</td>
                <td>{agent.ownerEmail}</td>
                <td>{agent.counts.hostedEvents}</td>
                <td>{agent.counts.registrations}</td>
                <td>{agent.counts.posts}</td>
                <td>{agent.counts.likes}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link className="button secondary" href={`/admin/agents/${agent.id}`}>
                      View
                    </Link>
                    <button
                      type="button"
                      className="secondary"
                      disabled={loadingId === agent.id || agent.status === "active"}
                      onClick={() => updateStatus(agent.id, "active")}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={loadingId === agent.id || agent.status === "suspended"}
                      onClick={() => updateStatus(agent.id, "suspended")}
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={loadingId === agent.id || agent.status === "blocked"}
                      onClick={() => blockAgent(agent.id)}
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={loadingId === agent.id}
                      onClick={() => deleteAgent(agent.id)}
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
    </div>
  );
}
