"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AgentStatus = "active" | "suspended" | "blocked";

type ModerationActionType = "warn" | "throttle" | "suspend_request";

interface RiskActionItem {
  id: string;
  createdAtIso: string;
  action: ModerationActionType;
  reason: string;
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };
  event: {
    id: string;
    title: string;
  };
}

interface Props {
  initialActions: RiskActionItem[];
}

function riskLevelLabel(action: ModerationActionType) {
  if (action === "suspend_request") {
    return "high";
  }
  if (action === "throttle") {
    return "medium";
  }
  return "low";
}

export function AdminRiskTable({ initialActions }: Props) {
  const [actions, setActions] = useState(initialActions);
  const [loadingAgentId, setLoadingAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<"all" | ModerationActionType>("all");

  const filtered = useMemo(() => {
    if (actionFilter === "all") {
      return actions;
    }
    return actions.filter((item) => item.action === actionFilter);
  }, [actions, actionFilter]);

  function updateAgentStatusInRows(agentId: string, status: AgentStatus) {
    setActions((prev) =>
      prev.map((item) =>
        item.agent.id === agentId
          ? {
              ...item,
              agent: {
                ...item.agent,
                status
              }
            }
          : item
      )
    );
  }

  async function suspendAgent(agentId: string) {
    setLoadingAgentId(agentId);
    setError(null);

    const response = await fetch(`/api/admin/agents/${agentId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "suspended" })
    });

    if (!response.ok) {
      setError(`Suspend failed (${response.status})`);
      setLoadingAgentId(null);
      return;
    }

    updateAgentStatusInRows(agentId, "suspended");
    setLoadingAgentId(null);
  }

  async function blockAgent(agentId: string) {
    const confirmed = window.confirm("Block this agent?");
    if (!confirmed) {
      return;
    }

    setLoadingAgentId(agentId);
    setError(null);

    const response = await fetch(`/api/admin/agents/${agentId}/block`, {
      method: "POST"
    });

    if (!response.ok) {
      setError(`Block failed (${response.status})`);
      setLoadingAgentId(null);
      return;
    }

    updateAgentStatusInRows(agentId, "blocked");
    setLoadingAgentId(null);
  }

  return (
    <div className="grid">
      {error ? (
        <p style={{ color: "var(--danger)", margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      <label className="filter-field" style={{ maxWidth: 240 }}>
        <span>Action Type</span>
        <select
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value as "all" | ModerationActionType)}
        >
          <option value="all">all</option>
          <option value="warn">warn</option>
          <option value="throttle">throttle</option>
          <option value="suspend_request">suspend_request</option>
        </select>
      </label>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Risk</th>
              <th>Action</th>
              <th>Agent</th>
              <th>Status</th>
              <th>Event</th>
              <th>Reason</th>
              <th>Handle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>{item.createdAtIso}</td>
                <td>{riskLevelLabel(item.action)}</td>
                <td>{item.action}</td>
                <td>{item.agent.name}</td>
                <td>{item.agent.status}</td>
                <td>
                  <Link href={`/admin/events/${item.event.id}`}>{item.event.title}</Link>
                </td>
                <td style={{ maxWidth: 360, wordBreak: "break-word" }}>{item.reason}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="secondary"
                      disabled={loadingAgentId === item.agent.id || item.agent.status !== "active"}
                      onClick={() => suspendAgent(item.agent.id)}
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={loadingAgentId === item.agent.id || item.agent.status === "blocked"}
                      onClick={() => blockAgent(item.agent.id)}
                    >
                      Block
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? <p className="muted">No moderation actions found.</p> : null}
    </div>
  );
}
