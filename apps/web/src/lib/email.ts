import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { captureException, withSpan } from "@/lib/observability";

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
  return withSpan("email.transfer_to_owner", { component: "email" }, async () => {
    try {
      const subject = `[BotPass] ${input.agentName} completed transfer_to_owner`;
      const text = [
        `Agent: ${input.agentName}`,
        `Event: ${input.eventTitle}`,
        `Location: ${input.eventLocation}`,
        `Start: ${input.eventStartAt.toISOString()}`,
        `End: ${input.eventEndAt.toISOString()}`,
        `Registration ID: ${input.registrationId}`,
        "Status: transfer_to_owner completed"
      ].join("\n");

      if (resend) {
        await resend.emails.send({
          from,
          to: input.to,
          subject,
          text
        });
        return { mocked: false, provider: "resend" };
      }
    } catch (error) {
      captureException(error, { component: "email", to: input.to });
      throw error;
    }

    logger.info({ input }, "No email provider configured; transfer email mock sent");
    return { mocked: true, provider: "mock" };
  });
}
