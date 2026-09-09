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
  const [sending, setSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    if (!subject || !body) {
      alert("Subject and body are required");
      return;
    }
    try {
      const data = await admin.previewEmail("custom", undefined, subject, body);
      setPreviewHtml(data.html);
    } catch (err) {
      alert("Preview failed");
      console.error(err);
    }
  }, [admin, subject, body]);

  const handleDryRun = useCallback(async () => {
    if (!subject || !body) {
      alert("Subject and body are required");
      return;
    }
    try {
      const result = await admin.sendEmails(segment, "custom", true, subject, body);
      alert(`Dry run: Would send to ${result.sent_count} users\n\nRecipients:\n${
        result.recipients.map((r: { email: string }) => r.email).join("\n")
      }`);
    } catch (err) {
      alert("Dry run failed");
      console.error(err);
    }
  }, [admin, segment, subject, body]);

  const handleSend = useCallback(async () => {
    if (!subject || !body) {
      alert("Subject and body are required");
      return;
    }
    const count = segments?.[segment]?.count ?? 0;
    if (!confirm(`Send custom email to ${count} users in "${segment}" segment?`)) {
      return;
    }

    setSending(true);
    try {
      const result = await admin.sendEmails(segment, "custom", false, subject, body);
      onSent(`✅ Custom email sent to ${result.sent_count} users`);
      setSubject("");
      setBody("");
    } catch (err) {
      alert("Send failed. Check console.");
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
            <span className={styles.composerLabel}>Body</span>
            <textarea
              className={styles.composerTextarea}
              placeholder={`Hey {name},\n\nYour message here...\n\n— Jay, builder of Tarang`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              id="custom-email-body"
            />
            <span className={styles.composerHint}>
              Placeholders: {"{name}"} → user&apos;s first name, {"{credit_balance}"} → their credit balance
            </span>
          </div>

          {/* Actions */}
          <div className={styles.composerActions}>
            <button
              className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
              onClick={handlePreview}
              disabled={!subject || !body}
              id="custom-email-preview"
            >
              Preview
            </button>
            <button
              className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
              onClick={handleDryRun}
              disabled={!subject || !body}
              id="custom-email-dryrun"
            >
              Dry Run
            </button>
            <button
              className={`${adminStyles.btn} ${adminStyles.btnPrimary}`}
              onClick={handleSend}
              disabled={sending || !subject || !body}
              id="custom-email-send"
            >
              {sending ? "Sending..." : `Send to ${segments?.[segment]?.count ?? 0} users`}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewHtml && (
        <PreviewModal
          html={previewHtml}
          onClose={() => setPreviewHtml(null)}
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


// ── Preview Modal ──

function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  return (
    <div className={adminStyles.modalOverlay} onClick={onClose}>
      <div
        className={adminStyles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(640px, 95vw)", maxHeight: "85vh" }}
      >
        <h3 className={adminStyles.modalTitle}>Email Preview</h3>
        <div className={styles.previewFrame}>
          <iframe
            ref={iframeRef}
            title="Email Preview"
            sandbox="allow-same-origin"
            style={{ width: "100%", minHeight: "450px", border: "none", borderRadius: "8px" }}
          />
        </div>
        <div className={adminStyles.modalActions}>
          <button className={`${adminStyles.btn} ${adminStyles.btnSecondary}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
