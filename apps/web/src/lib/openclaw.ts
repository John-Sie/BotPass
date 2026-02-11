import { createOpenClawProvider, getOpenClawProviderConfig } from "@botpass/openclaw-adapter";
import { logger } from "@/lib/logger";
import { captureException, withSpan } from "@/lib/observability";

const providerConfig = getOpenClawProviderConfig();
const provider = createOpenClawProvider();

if (providerConfig.mode === "real") {
  logger.info(
    {
      mode: providerConfig.mode,
      endpoint: providerConfig.endpoint,
      timeout_ms: providerConfig.timeoutMs,
      max_retries: providerConfig.maxRetries,
      fallback_to_mock: providerConfig.fallbackToMockOnError,
      base_path: providerConfig.basePath
    },
    "OpenClaw provider configured"
  );
} else {
  logger.info({ mode: providerConfig.mode }, "OpenClaw provider running in mock mode");
}

export async function reportOpenClawAction(action: () => Promise<unknown>) {
  return withSpan(
    "openclaw.provider.call",
    {
      component: "openclaw",
      provider_mode: providerConfig.mode,
      fallback_to_mock: providerConfig.fallbackToMockOnError
    },
    async () => {
      try {
        return await action();
      } catch (error) {
        captureException(error, { component: "openclaw", mode: providerConfig.mode });
        if (providerConfig.fallbackToMockOnError) {
          logger.warn({ error }, "OpenClaw provider call failed; continue with local success");
          return { ok: false, fallback: true };
        }

        logger.error({ error }, "OpenClaw provider call failed; strict mode enabled");
        throw error;
      }
    }
  );
}

export { provider };
