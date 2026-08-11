"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useAdmin } from "@/hooks/useAdmin";
import styles from "./admin.module.css";

// ── Types ──

interface AdminUser {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
  plan_type: string;
  credit_balance: number;
  credit_limit: number;
  is_admin: boolean;
  created_at: string;
}

interface ConfigEntry {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string | null;
}

type TabKey = "users" | "config" | "insights";


// ── Main Page ──

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const isAdmin = (user?.publicMetadata as Record<string, unknown>)?.role === "admin";

  if (!isLoaded) {
    return <div className={styles.loadingState}>Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessDeniedIcon}>🔒</div>
        <h2 className={styles.accessDeniedTitle}>Access Denied</h2>
        <p className={styles.accessDeniedText}>
          You need admin privileges to view this page.
        </p>
      </div>
    );
  }

  return <AdminDashboard />;
}

// ── Dashboard Content ──

function AdminDashboard() {
  const admin = useAdmin();
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [overview, setOverview] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    admin.getOverview().then(setOverview).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.adminPage}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.subtitle}>Manage users, credits, and platform configuration</p>
        </div>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className={styles.statsGrid}>
          <StatCard label="Total Users" value={overview.total_users} />
          <StatCard label="Active Users" value={overview.active_users} />
          <StatCard
            label="Credits Issued"
            value={overview.total_credits_issued?.toLocaleString()}
          />
          <StatCard
            label="Credits Used"
            value={overview.total_credits_used?.toLocaleString()}
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        {(["users", "config", "insights"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "users" ? "User Management" : tab === "config" ? "App Config" : "Insights"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "users" && <UsersTab admin={admin} />}
      {activeTab === "config" && <ConfigTab admin={admin} />}
      {activeTab === "insights" && <InsightsTab admin={admin} />}
    </div>
  );
}

// ── Stat Card ──

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

// ── Users Tab ──

function UsersTab({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  // Bulk reassign state
  const [bulkLimit, setBulkLimit] = useState("");
  const [bulkMaxUsers, setBulkMaxUsers] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      if (search.trim()) {
        const data = await admin.searchUsers(search.trim());
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(1);
      } else {
        const data = await admin.listUsers(page);
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.total_pages);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [admin, page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBulkReassign = useCallback(async () => {
    const limit = parseInt(bulkLimit);
    if (isNaN(limit) || limit < 0) return;
    const maxUsers = bulkMaxUsers ? parseInt(bulkMaxUsers) : undefined;

    setBulkLoading(true);
    try {
      const result = await admin.bulkReassign(limit, maxUsers);
      alert(`Updated ${result.users_updated} of ${result.users_scanned} users to ${limit} credit limit.`);
      fetchUsers();
    } catch (err) {
      alert("Bulk reassign failed. Check console.");
      console.error(err);
    } finally {
      setBulkLoading(false);
    }
  }, [admin, bulkLimit, bulkMaxUsers, fetchUsers]);

  return (
    <>
      {/* Search + Bulk */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Users ({total})</span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              id="admin-search-input"
            />
          </div>

          {/* Bulk Reassign */}
          <div style={{ marginTop: "1rem" }}>
            <p className={styles.statLabel} style={{ marginBottom: "0.5rem" }}>
              Bulk Reassign Credits
            </p>
            <div className={styles.bulkPanel}>
              <div className={styles.configItem}>
                <span className={styles.configKey}>New Credit Limit</span>
                <input
                  className={styles.configInput}
                  type="number"
                  placeholder="2000"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(e.target.value)}
                  id="admin-bulk-limit"
                />
              </div>
              <div className={styles.configItem}>
                <span className={styles.configKey}>Max Users (optional)</span>
                <input
                  className={styles.configInput}
                  type="number"
                  placeholder="200"
                  value={bulkMaxUsers}
                  onChange={(e) => setBulkMaxUsers(e.target.value)}
                  id="admin-bulk-max"
                />
              </div>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleBulkReassign}
                disabled={bulkLoading || !bulkLimit}
                id="admin-bulk-btn"
              >
                {bulkLoading ? "Updating..." : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className={styles.section}>
        {loading ? (
          <div className={styles.loadingState}>Loading users...</div>
        ) : users.length === 0 ? (
          <div className={styles.emptyState}>No users found.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Credits</th>
                    <th>Plan</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const used = u.credit_limit - u.credit_balance;
                    const pct = u.credit_limit > 0 ? (u.credit_balance / u.credit_limit) * 100 : 0;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div>{u.name || "—"}</div>
                          <div className={styles.userEmail}>{u.email}</div>
                        </td>
                        <td>
                          <div className={styles.creditBarInline}>
                            <span>
                              {u.credit_balance.toLocaleString()} / {u.credit_limit.toLocaleString()}
                            </span>
                            <div className={styles.miniProgress}>
                              <div
                                className={styles.miniProgressFill}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${u.is_admin ? styles.badgeAdmin : styles.badgeFree}`}>
                            {u.is_admin ? "Admin" : u.plan_type}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                            onClick={() => setEditUser(u)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Credit Modal */}
      {editUser && (
        <EditCreditModal
          user={editUser}
          admin={admin}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            fetchUsers();
          }}
        />
      )}
    </>
  );
}

// ── Edit Credit Modal ──

function EditCreditModal({
  user,
  admin,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  admin: ReturnType<typeof useAdmin>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newLimit, setNewLimit] = useState(String(user.credit_limit));
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const limit = parseInt(newLimit);
    if (isNaN(limit) || limit < 0) return;

    setSaving(true);
    try {
      const result = await admin.updateCreditLimit(user.id, limit);
      alert(
        `Credit limit updated: ${result.old_limit} → ${result.new_limit}\nNew balance: ${result.credit_balance}`
      );
      onSaved();
    } catch (err) {
      alert("Failed to update credit limit.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [admin, user.id, newLimit, onSaved]);

  const parsedLimit = parseInt(newLimit || "0");
  const delta = parsedLimit - user.credit_limit;
  const projected = delta >= 0 ? user.credit_balance + delta : parsedLimit;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Edit Credit Limit</h3>

        <div className={styles.modalField}>
          <span className={styles.modalLabel}>User</span>
          <span style={{ color: "var(--foreground)", fontSize: "0.875rem" }}>
            {user.name || user.email}
          </span>
        </div>

        <div className={styles.modalField}>
          <span className={styles.modalLabel}>Current Balance / Limit</span>
          <span style={{ color: "var(--foreground)", fontSize: "0.875rem" }}>
            {user.credit_balance.toLocaleString()} / {user.credit_limit.toLocaleString()}
          </span>
        </div>

        <div className={styles.modalField}>
          <span className={styles.modalLabel}>New Credit Limit</span>
          <input
            className={styles.modalInput}
            type="number"
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
            min={0}
            id="edit-credit-limit-input"
          />
        </div>

        {!isNaN(delta) && delta !== 0 && (
          <div className={styles.modalField}>
            <span className={styles.modalLabel}>Preview</span>
            <span style={{ color: delta > 0 ? "hsl(140 60% 55%)" : "hsl(35 90% 55%)", fontSize: "0.875rem" }}>
              Balance: {user.credit_balance.toLocaleString()} → {projected.toLocaleString()} ({delta > 0 ? `+${delta}` : "Reset to new limit"})
            </span>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSave}
            disabled={saving || isNaN(parseInt(newLimit))}
            id="edit-credit-save-btn"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Config Tab ──

function ConfigTab({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    admin
      .getConfig()
      .then((data: { configs: ConfigEntry[] }) => {
        setConfigs(data.configs);
        const vals: Record<string, string> = {};
        data.configs.forEach((c: ConfigEntry) => {
          vals[c.key] = c.value;
        });
        setEditValues(vals);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(
    async (key: string) => {
      try {
        await admin.updateConfig(key, editValues[key]);
        alert(`Config "${key}" updated to ${editValues[key]}`);
      } catch (err) {
        alert("Failed to update config.");
        console.error(err);
      }
    },
    [admin, editValues]
  );

  if (loading) return <div className={styles.loadingState}>Loading config...</div>;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Application Configuration</span>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.configGrid}>
          {configs.map((c) => (
            <div key={c.key} className={styles.configItem}>
              <span className={styles.configKey}>
                {c.key.replace(/_/g, " ")}
              </span>
              <div className={styles.configValue}>
                <input
                  className={styles.configInput}
                  type="text"
                  value={editValues[c.key] ?? c.value}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [c.key]: e.target.value }))
                  }
                  id={`config-input-${c.key}`}
                />
                <button
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                  onClick={() => handleSave(c.key)}
                  disabled={editValues[c.key] === c.value}
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Insights Tab ──

function InsightsTab({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  const [topSpenders, setTopSpenders] = useState<AdminUser[]>([]);
  const [serviceUsage, setServiceUsage] = useState<
    { service: string; total_credits: number; num_transactions: number }[]
  >([]);
  const [idleUsers, setIdleUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      admin.getTopSpenders(),
      admin.getServiceUsage(),
      admin.getIdleUsers(),
    ])
      .then(([spenders, usage, idle]) => {
        setTopSpenders(spenders.users || []);
        setServiceUsage(usage.services || []);
        setIdleUsers(idle.users || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className={styles.loadingState}>Loading insights...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Service Usage */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Service Usage</span>
        </div>
        <div className={styles.sectionBody}>
          {serviceUsage.length === 0 ? (
            <div className={styles.emptyState}>No usage data yet.</div>
          ) : (
            <div className={styles.insightsList}>
              {serviceUsage.map((s) => (
                <div key={s.service} className={styles.insightRow}>
                  <span className={styles.insightLabel}>
                    {s.service === "unknown" ? "Legacy (untagged)" : s.service}
                  </span>
                  <span className={styles.insightValue}>
                    {s.total_credits.toLocaleString()} credits · {s.num_transactions} txns
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Spenders */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Top Spenders</span>
        </div>
        <div className={styles.sectionBody}>
          {topSpenders.length === 0 ? (
            <div className={styles.emptyState}>No spender data yet.</div>
          ) : (
            <div className={styles.insightsList}>
              {topSpenders.slice(0, 10).map((u: any) => (
                <div key={u.id} className={styles.insightRow}>
                  <span className={styles.insightLabel}>
                    {u.name || u.email}
                  </span>
                  <span className={styles.insightValue}>
                    {u.credits_used?.toLocaleString()} used ({u.usage_pct}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Idle Users */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            Idle Users (&lt;10% usage, 14+ days old)
          </span>
        </div>
        <div className={styles.sectionBody}>
          {idleUsers.length === 0 ? (
            <div className={styles.emptyState}>No idle users found — great engagement!</div>
          ) : (
            <div className={styles.insightsList}>
              {idleUsers.slice(0, 15).map((u: any) => (
                <div key={u.id} className={styles.insightRow}>
                  <span className={styles.insightLabel}>
                    {u.name || u.email}
                  </span>
                  <span className={styles.insightValue}>
                    {u.credit_balance.toLocaleString()} / {u.credit_limit.toLocaleString()} ({u.usage_pct}% used)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
