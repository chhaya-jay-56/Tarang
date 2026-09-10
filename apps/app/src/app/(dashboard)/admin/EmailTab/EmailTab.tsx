"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import styles from "./EmailTab.module.css";
import adminStyles from "../admin.module.css";

// ── Types ──

interface SegmentData {
  count: number;
  users: {
    id: string;
    email: string;
    name: string | null;
    credit_balance: number;
    credit_limit: number;
  }[];
}

interface HistoryEntry {
  campaign_id: string;
  email_type: string;
  send_count: number;
  sent_at: string;
  subject: string;
}

type EmailType = "onboarding_nudge" | "re_engagement" | "feedback_ask" | "credit_grant" | "custom";
type SegmentKey = "never_used" | "used_once" | "all";

const TEMPLATE_CONFIG: {
  type: EmailType;
  icon: string;
  name: string;
  segment: SegmentKey;
  desc: string;
}[] = [
  { type: "onboarding_nudge", icon: "🎙️", name: "Onboarding Nudge", segment: "never_used", desc: "Your credits are waiting — clone your voice" },
  { type: "re_engagement", icon: "🔄", name: "Re-engagement", segment: "used_once", desc: "Here's what else Tarang can do" },
  { type: "feedback_ask", icon: "💬", name: "Feedback Ask", segment: "all", desc: "What feature do you wish existed?" },
  { type: "credit_grant", icon: "🎁", name: "Credit Grant", segment: "all", desc: "You just got free credits" },
];

const SEGMENT_INFO: Record<SegmentKey, { icon: string; name: string; desc: string }> = {
  never_used: { icon: "🔴", name: "Never Used", desc: "Signed up, zero credits spent" },
  used_once: { icon: "🟡", name: "Used Once", desc: "Used credits, inactive 7+ days" },
  all: { icon: "🟢", name: "All Users", desc: "Everyone with credits allocated" },
};

// ── Main EmailTab Component ──

export default function EmailTab({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  const [segments, setSegments] = useState<Record<string, SegmentData> | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [segData, histData] = await Promise.all([
        admin.getEmailSegments(),
        admin.getEmailHistory(),
      ]);
      setSegments(segData.segments);
      setHistory(histData.history || []);
    } catch (err) {
      console.error("Failed to load email data:", err);
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className={adminStyles.loadingState}>Loading email dashboard...</div>;
  }

  return (
    <div className={styles.emailContainer}>
      {sendResult && (
        <div className={styles.statusSuccess}>{sendResult}</div>
      )}

      {/* Segment Overview */}
      <SegmentOverview segments={segments} />

      {/* Quick Send Templates */}
      <TemplateCards
        admin={admin}
        segments={segments}
        onSent={(msg) => { setSendResult(msg); fetchData(); }}
      />

      {/* Custom Composer */}
      <CustomComposer
        admin={admin}
        segments={segments}
        onSent={(msg) => { setSendResult(msg); fetchData(); }}
      />

      {/* Resend Audience Sync */}
      <AudienceSync admin={admin} />

      {/* Send History */}
      <EmailHistory history={history} />
    </div>
  );
}


// ── Segment Overview ──

function SegmentOverview({ segments }: { segments: Record<string, SegmentData> | null }) {
  if (!segments) return null;

  return (
    <div className={adminStyles.section}>
      <div className={adminStyles.sectionHeader}>
        <span className={adminStyles.sectionTitle}>📊 User Segments</span>
      </div>
      <div className={adminStyles.sectionBody}>
        <div className={styles.segmentGrid}>
          {(Object.keys(SEGMENT_INFO) as SegmentKey[]).map((key) => {
            const info = SEGMENT_INFO[key];
            const data = segments[key];
            return (
              <div key={key} className={styles.segmentCard}>
                <div className={styles.segmentIcon}>{info.icon}</div>
                <div className={styles.segmentName}>{info.name}</div>
                <div className={styles.segmentCount}>{data?.count ?? 0}</div>
                <div className={styles.segmentDesc}>{info.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ── Template Quick-Send Cards ──

function TemplateCards({
  admin,
  segments,
  onSent,
}: {
  admin: ReturnType<typeof useAdmin>;
  segments: Record<string, SegmentData> | null;
  onSent: (msg: string) => void;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const handlePreview = useCallback(async (emailType: EmailType) => {
    setPreviewing(emailType);
    try {
      const data = await admin.previewEmail(emailType);
      setPreviewHtml(data.html);
    } catch (err) {
      console.error("Preview failed:", err);
      alert("Failed to generate preview");
      setPreviewing(null);
    }
  }, [admin]);

  const handleSend = useCallback(async (emailType: EmailType, segment: SegmentKey) => {
    const count = segments?.[segment]?.count ?? 0;
    if (!confirm(`Send "${emailType.replace(/_/g, " ")}" email to ${count} users in "${segment}" segment?`)) {
      return;
    }

    setSending(emailType);
    try {
      const result = await admin.sendEmails(segment, emailType);
      onSent(`✅ Sent ${result.sent_count} emails (${result.skipped_count} skipped — already received)`);
    } catch (err) {
      alert("Failed to send emails. Check console.");
      console.error(err);
    } finally {
      setSending(null);
    }
  }, [admin, segments, onSent]);

  return (
    <>
      <div className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <span className={adminStyles.sectionTitle}>⚡ Quick Send Templates</span>
        </div>
        <div className={adminStyles.sectionBody}>
          <div className={styles.templateGrid}>
            {TEMPLATE_CONFIG.map((t) => (
              <div key={t.type} className={styles.templateCard}>
                <div className={styles.templateIcon}>{t.icon}</div>
                <div className={styles.templateName}>{t.name}</div>
                <div className={styles.templateSegment}>
                  Segment: {SEGMENT_INFO[t.segment].name} ({segments?.[t.segment]?.count ?? 0})
                </div>
                <div className={styles.templateActions}>
                  <button
                    className={`${adminStyles.btn} ${adminStyles.btnSecondary} ${adminStyles.btnSmall}`}
                    onClick={() => handlePreview(t.type)}
                    id={`preview-${t.type}`}
                  >
                    Preview
                  </button>
                  <button
                    className={`${adminStyles.btn} ${adminStyles.btnPrimary} ${adminStyles.btnSmall}`}
                    onClick={() => handleSend(t.type, t.segment)}
                    disabled={sending === t.type}
                    id={`send-${t.type}`}
                  >
                    {sending === t.type ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewing && previewHtml && (
        <PreviewModal
          html={previewHtml}
          onClose={() => { setPreviewing(null); setPreviewHtml(null); }}
        />
      )}
    </>
  );
}


// ── Custom Email Composer ──

function CustomComposer({
  admin,
  segments,
  onSent,
}: {
  admin: ReturnType<typeof useAdmin>;
  segments: Record<string, SegmentData> | null;
  onSent: (msg: string) => void;
}) {
  const [segment, setSegment] = useState<SegmentKey>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("jaychhaya3489@gmail.com");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    if (!body.trim()) {
      alert("Please enter body content or HTML to preview");
      return;
    }
    try {
      const data = await admin.previewEmail(
        "custom",
        undefined,
        subject.trim() || "Tarang Email Preview",
        body
      );
      setPreviewHtml(data.html);
    } catch (err: any) {
      alert(err?.message || "Preview failed");
      console.error(err);
    }
  }, [admin, subject, body]);

  const handleSendTest = useCallback(async () => {
    if (!body.trim()) {
      alert("Please enter email body or HTML before sending a test");
      return;
    }
    if (!testEmail || !testEmail.includes("@")) {
      alert("Please enter a valid test recipient email address");
      return;
    }
    setSendingTest(true);
    try {
      await admin.sendTestEmail(
        testEmail.trim(),
        "custom",
        subject.trim() || "Tarang Email Preview",
        body
      );
      alert(`✅ Test email successfully sent to ${testEmail}!\n\nPlease check your inbox to verify rendering, styling, and deliverability.`);
    } catch (err: any) {
      alert(`❌ Test send failed: ${err?.message || "Check console"}`);
      console.error(err);
    } finally {
      setSendingTest(false);
    }
  }, [admin, testEmail, subject, body]);

  const handleDryRun = useCallback(async () => {
    if (!body.trim()) {
      alert("Please enter email body or HTML before running a dry run");
      return;
    }
    try {
      const result = await admin.sendEmails(
        segment,
        "custom",
        true,
        subject.trim() || "Tarang Email",
        body,
        undefined,
        testEmail.trim()
      );

      let msg = "📋 DRY RUN & VERIFICATION REPORT\n\n";
      if (result.test_email?.sent) {
        msg += `✅ Real test email sent to: ${testEmail}\n(Check your inbox now to verify!)\n\n`;
      } else if (result.test_email && !result.test_email.sent) {
        msg += `⚠️ Test email send error: ${result.test_email.error}\n\n`;
      }
      msg += `Target segment: "${segment}" (${result.sent_count} users would receive this)\n\n`;
      if (result.recipients && result.recipients.length > 0) {
        msg += `Sample recipients:\n${result.recipients.slice(0, 8).map((r: { email: string }) => `• ${r.email}`).join("\n")}`;
        if (result.recipients.length > 8) {
          msg += `\n...and ${result.recipients.length - 8} more`;
        }
      }
      alert(msg);
    } catch (err: any) {
      alert(`Dry run failed: ${err?.message || "Check console"}`);
      console.error(err);
    }
  }, [admin, segment, subject, body, testEmail]);

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim()) {
      alert("Subject and body are required for sending a broadcast");
      return;
    }
    const count = segments?.[segment]?.count ?? 0;
    if (!confirm(`Send custom email to ${count} users in "${segment}" segment?\n\nMake sure you have tested with Dry Run first!`)) {
      return;
    }

    setSending(true);
    try {
      const result = await admin.sendEmails(segment, "custom", false, subject, body);
      onSent(`✅ Custom email sent to ${result.sent_count} users`);
      setSubject("");
      setBody("");
    } catch (err: any) {
      alert(`Send failed: ${err?.message || "Check console"}`);
      console.error(err);
    } finally {
      setSending(false);
    }
  }, [admin, segment, subject, body, segments, onSent]);

  return (
    <>
      <div className={adminStyles.section}>
        <div className={adminStyles.sectionHeader}>
          <span className={adminStyles.sectionTitle}>✍️ Custom Email</span>
        </div>
        <div className={adminStyles.sectionBody}>
          {/* Segment Picker */}
          <div className={styles.composerField}>
            <span className={styles.composerLabel}>Send To</span>
            <div className={styles.segmentPicker}>
              {(Object.keys(SEGMENT_INFO) as SegmentKey[]).map((key) => (
                <button
                  key={key}
                  className={`${styles.segmentChip} ${segment === key ? styles.segmentChipActive : ""}`}
                  onClick={() => setSegment(key)}
                >
                  {SEGMENT_INFO[key].icon} {SEGMENT_INFO[key].name} ({segments?.[key]?.count ?? 0})
                </button>
              ))}
            </div>
          </div>

          {/* Mode Toggle */}
          <div className={styles.composerField}>
            <span className={styles.composerLabel}>Mode</span>
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${!isHtmlMode ? styles.modeBtnActive : ""}`}
                onClick={() => setIsHtmlMode(false)}
              >
                📝 Plain Text
              </button>
              <button
                className={`${styles.modeBtn} ${isHtmlMode ? styles.modeBtnActive : ""}`}
                onClick={() => setIsHtmlMode(true)}
              >
                🧑‍💻 HTML
              </button>
            </div>
          </div>

          {/* Subject */}
          <div className={styles.composerField}>
            <span className={styles.composerLabel}>Subject</span>
            <input
              className={styles.composerInput}
              placeholder="e.g. 🎁 Big update from Tarang"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              id="custom-email-subject"
            />
          </div>

          {/* Body */}
          <div className={styles.composerField}>
            <span className={styles.composerLabel}>
              {isHtmlMode ? "HTML Body" : "Body"}
            </span>
            <textarea
              className={`${styles.composerTextarea} ${isHtmlMode ? styles.composerTextareaHtml : ""}`}
              placeholder={
                isHtmlMode
                  ? '<!DOCTYPE html>\n<html>\n<head>...</head>\n<body>\n  <h1>Hey {{first_name}}</h1>\n  <p>Your HTML here...</p>\n</body>\n</html>'
                  : `Hey {{first_name}},\n\nYour message here...\n\n— Jay, builder of Tarang`
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              id="custom-email-body"
              spellCheck={!isHtmlMode}
            />
            <span className={styles.composerHint}>
              {isHtmlMode
                ? "Paste your full HTML email. Placeholders: {{first_name}}, {{name}}, {{credit_balance}}, {{email}}. HTML is sent as-is with full responsive styling."
                : "Placeholders: {{first_name}} → first name, {{credit_balance}} → balance, {{email}} → email. Wrapped in mobile-friendly Tarang template."
              }
            </span>
          </div>

          {/* Test / Dry Run Email Address */}
          <div className={styles.composerField}>
            <span className={styles.composerLabel}>🧪 Dry Run &amp; Test Recipient</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <input
                className={styles.composerInput}
                style={{ maxWidth: "340px" }}
                placeholder="jaychhaya3489@gmail.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                id="custom-email-test-address"
              />
              <button
                type="button"
                className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
                onClick={handleSendTest}
                disabled={sendingTest || !body.trim()}
                id="custom-email-send-test-btn"
              >
                {sendingTest ? "Sending Test..." : `Send Test to Me`}
              </button>
            </div>
            <span className={styles.composerHint}>
              Sends a real test email via Resend to this address so you can inspect fonts, colors, and layout directly in your inbox.
            </span>
          </div>

          {/* Actions */}
          <div className={styles.composerActions}>
            <button
              className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
              onClick={handlePreview}
              disabled={!body.trim()}
              id="custom-email-preview"
            >
              👁️ Preview
            </button>
            <button
              className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
              onClick={handleDryRun}
              disabled={!body.trim()}
              id="custom-email-dryrun"
            >
              📋 Dry Run &amp; Verify
            </button>
            <button
              className={`${adminStyles.btn} ${adminStyles.btnPrimary}`}
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
              id="custom-email-send"
            >
              {sending ? "Sending Broadcast..." : `🚀 Send to ${segments?.[segment]?.count ?? 0} users`}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewHtml && (
        <PreviewModal
          html={previewHtml}
          subject={subject.trim() || "Tarang Email Preview"}
          onClose={() => setPreviewHtml(null)}
          onSendTest={handleSendTest}
        />
      )}
    </>
  );
}


// ── Email History ──

function EmailHistory({ history }: { history: HistoryEntry[] }) {
  const formatType = (type: string) => {
    return type.replace(/^custom_\w+$/, "custom").replace(/_/g, " ");
  };

  return (
    <div className={adminStyles.section}>
      <div className={adminStyles.sectionHeader}>
        <span className={adminStyles.sectionTitle}>📬 Send History</span>
      </div>
      <div className={adminStyles.sectionBody}>
        {history.length === 0 ? (
          <div className={adminStyles.emptyState}>No emails sent yet.</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((h) => (
              <div key={`${h.campaign_id}-${h.email_type}`} className={styles.historyRow}>
                <span className={styles.historyDate}>
                  {h.sent_at ? new Date(h.sent_at).toLocaleDateString() : "—"}
                </span>
                <span className={styles.historySubject}>
                  {h.subject || formatType(h.email_type)}
                </span>
                <span className={styles.historyType}>{formatType(h.email_type)}</span>
                <span className={styles.historyCount}>{h.send_count} sent</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Resend Audience Sync ──

function AudienceSync({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    synced: number;
    errors: number;
    total_users: number;
    audience_name: string;
  } | null>(null);

  const handleSync = useCallback(async () => {
    if (!confirm("Sync all active users to Resend Audience? This enables open/click tracking from the Resend dashboard.")) {
      return;
    }
    setSyncing(true);
    try {
      const data = await admin.syncAudience();
      setResult(data);
    } catch (err) {
      alert("Audience sync failed. Check console.");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }, [admin]);

  return (
    <div className={adminStyles.section}>
      <div className={adminStyles.sectionHeader}>
        <span className={adminStyles.sectionTitle}>📋 Resend Audience Sync</span>
      </div>
      <div className={adminStyles.sectionBody}>
        <p className={styles.syncDesc}>
          Push all active users to a Resend Audience for direct broadcasting from{" "}
          <a href="https://resend.com/audiences" target="_blank" rel="noopener noreferrer" className={styles.syncLink}>
            resend.com/audiences
          </a>.
          Enables open rate &amp; click tracking per email.
        </p>

        <button
          className={`${adminStyles.btn} ${adminStyles.btnPrimary}`}
          onClick={handleSync}
          disabled={syncing}
          id="sync-audience-btn"
        >
          {syncing ? "Syncing..." : "Sync Users to Resend"}
        </button>

        {result && (
          <div className={styles.syncResult}>
            ✅ Synced <strong>{result.synced}</strong> of {result.total_users} users to
            &ldquo;{result.audience_name}&rdquo;
            {result.errors > 0 && <span className={styles.syncErrors}> ({result.errors} errors)</span>}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Preview Modal ──

function PreviewModal({
  html,
  subject,
  onClose,
  onSendTest,
}: {
  html: string;
  subject?: string;
  onClose: () => void;
  onSendTest?: () => void;
}) {
  return (
    <div className={adminStyles.modalOverlay} onClick={onClose}>
      <div
        className={adminStyles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(680px, 95vw)", maxHeight: "90vh" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h3 className={adminStyles.modalTitle} style={{ margin: 0 }}>Email Preview</h3>
          {subject && (
            <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Subject: <strong>{subject}</strong>
            </span>
          )}
        </div>
        <div className={styles.previewFrame}>
          <iframe
            srcDoc={html}
            title="Email Preview"
            sandbox="allow-same-origin allow-popups"
            style={{ width: "100%", height: "520px", border: "none", borderRadius: "8px", background: "#ffffff" }}
          />
        </div>
        <div className={adminStyles.modalActions} style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          {onSendTest ? (
            <button
              type="button"
              className={`${adminStyles.btn} ${adminStyles.btnPrimary}`}
              onClick={onSendTest}
              id="preview-send-test-btn"
            >
              🧪 Send Test to Me
            </button>
          ) : <div />}
          <button
            type="button"
            className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

