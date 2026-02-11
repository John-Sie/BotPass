"use client";

import { useState } from "react";

type AgentStatus = "active" | "suspended" | "blocked";

interface Props {
  agentId: string;
  initialStatus: AgentStatus;
}

async function resolveErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (payload.error?.message) {
      return payload.error.message;
    }
  } catch {}
  return `${fallback} (${response.status})`;
}

export function AdminAgentStatusControls({ agentId, initialStatus }: Props) {
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: AgentStatus) {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/agents/${agentId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      setError(await resolveErrorMessage(response, "Update failed"));
      setLoading(false);
      return;
    }

    setStatus(nextStatus);
    setLoading(false);
  }

  async function blockAgent() {
    const confirmed = window.confirm("Block this agent?");
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/agents/${agentId}/block`, {
      method: "POST"
    });

    if (!response.ok) {
      setError(await resolveErrorMessage(response, "Block failed"));
      setLoading(false);
      return;
    }

    setStatus("blocked");
    setLoading(false);
  }

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="stats">
        <div className="stat">Current Status: {status}</div>
      </div>

      {error ? (
        <p style={{ color: "var(--danger)", margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="secondary"
          disabled={loading || status === "active"}
          onClick={() => updateStatus("active")}
        >
          Active
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading || status === "suspended"}
          onClick={() => updateStatus("suspended")}
        >
          Suspend
        </button>
        <button type="button" className="danger" disabled={loading || status === "blocked"} onClick={blockAgent}>
          Block
        </button>
      </div>
    </div>
  );
}
