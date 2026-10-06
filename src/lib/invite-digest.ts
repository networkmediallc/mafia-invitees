import {
  listUndigestedInviteAdditions,
  markInviteAdditionsDigested,
} from "@/lib/invite-additions";

export type DigestResult =
  | { sent: false; reason: "disabled" | "none" | "misconfigured" }
  | { sent: true; count: number; events: number }
  | { sent: false; reason: "send_failed"; error: string };

function notifyConfigured() {
  const to = process.env.NOTIFY_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return Boolean(to && apiKey);
}

function personLabel(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim() || "Unnamed";
}

function eventLabel(name: string, eventDate: string | null) {
  if (!eventDate) return name;
  return `${name} (${eventDate})`;
}

/** Send one digest email for any undigested event invitee additions. No-op if none. */
export async function sendInviteAdditionDigest(): Promise<DigestResult> {
  if (!notifyConfigured()) {
    return { sent: false, reason: "misconfigured" };
  }

  const pending = await listUndigestedInviteAdditions();
  const rows = pending.filter((row) => row.listKind === "event");
  if (!rows.length) {
    return { sent: false, reason: "none" };
  }

  const byEvent = new Map<
    string,
    {
      label: string;
      entries: { name: string; addedBy: string }[];
    }
  >();

  for (const row of rows) {
    let bucket = byEvent.get(row.listId);
    if (!bucket) {
      bucket = {
        label: eventLabel(row.listName, row.eventDate),
        entries: [],
      };
      byEvent.set(row.listId, bucket);
    }
    bucket.entries.push({
      name: personLabel(row.firstName, row.lastName),
      addedBy: row.addedBy || "Someone",
    });
  }

  const total = rows.length;
  const eventCount = byEvent.size;
  const subject =
    eventCount === 1
      ? `${total} invitee${total === 1 ? "" : "s"} added to ${[...byEvent.values()][0].label}`
      : `${total} invitees added across ${eventCount} events`;

  const lines: string[] = [
    "New invitees were added to your event lists:",
    "",
  ];
  for (const group of byEvent.values()) {
    lines.push(group.label);
    for (const entry of group.entries) {
      lines.push(`  • ${entry.name} (added by ${entry.addedBy})`);
    }
    lines.push("");
  }
  lines.push("— Mafia Invite Desk");

  const htmlParts = [
    "<p>New invitees were added to your event lists:</p>",
  ];
  for (const group of byEvent.values()) {
    htmlParts.push(`<p><strong>${escapeHtml(group.label)}</strong></p><ul>`);
    for (const entry of group.entries) {
      htmlParts.push(
        `<li>${escapeHtml(entry.name)} <span style="color:#666">(added by ${escapeHtml(entry.addedBy)})</span></li>`,
      );
    }
    htmlParts.push("</ul>");
  }
  htmlParts.push('<p style="color:#888">— Mafia Invite Desk</p>');

  const to = process.env.NOTIFY_EMAIL!.trim();
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    "Mafia Invite Desk <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: lines.join("\n"),
      html: htmlParts.join("\n"),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      sent: false,
      reason: "send_failed",
      error: `Resend ${response.status}: ${detail.slice(0, 300)}`,
    };
  }

  await markInviteAdditionsDigested(rows.map((r) => r.id));
  return { sent: true, count: total, events: eventCount };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inviteDigestEnabled() {
  return notifyConfigured();
}
