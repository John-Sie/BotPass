import { createOpenClawProvider } from "@botpass/openclaw-adapter";
import { logger } from "@/lib/logger";

const provider = createOpenClawProvider();

export async function reportOpenClawAction(action: () => Promise<unknown>) {
  try {
    return await action();
  } catch (error) {
    logger.warn({ error }, "OpenCLAW provider call failed; continue with local success");
    return { ok: false, fallback: true };
  }
}

export { provider };
