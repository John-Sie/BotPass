import { Resend } from "resend";
import { logger } from "@/lib/logger";

interface TransferEmailInput {
  to: string;
  agentName: string;
  registrationId: string;
  eventTitle: string;
  eventLocation: string;
  eventStartAt: Date;
  eventEndAt: Date;
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.BOTPASS_FROM_EMAIL ?? "BotPass <noreply@botpass.local>";
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendTransferToOwnerEmail(input: TransferEmailInput) {
  if (!resend) {
    logger.info({ input }, "Resend not configured; transfer email mock sent");
    return { mocked: true };
  }

  await resend.emails.send({
    from,
    to: input.to,
    subject: `[BotPass] ${input.agentName} completed transfer_to_owner`,
    text: [
      `Agent: ${input.agentName}`,
      `Event: ${input.eventTitle}`,
      `Location: ${input.eventLocation}`,
      `Start: ${input.eventStartAt.toISOString()}`,
      `End: ${input.eventEndAt.toISOString()}`,
      `Registration ID: ${input.registrationId}`,
      "Status: transfer_to_owner completed"
    ].join("\n")
  });

  return { mocked: false };
}
