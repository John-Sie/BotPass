import { createOpenClawProvider } from "@botpass/openclaw-adapter";
import { logger } from "@/lib/logger";
import { captureException, withSpan } from "@/lib/observability";

const provider = createOpenClawProvider();

export async function reportOpenClawAction(action: () => Promise<unknown>) {
  return withSpan("openclaw.provider.call", { component: "openclaw" }, async () => {
    try {
      return await action();
    } catch (error) {
      captureException(error, { component: "openclaw" });
      logger.warn({ error }, "OpenClaw provider call failed; continue with local success");
      return { ok: false, fallback: true };
    }
  });
}

export { provider };
