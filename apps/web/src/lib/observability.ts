import * as Sentry from "@sentry/nextjs";
import { diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode, trace } from "@opentelemetry/api";
import { BasicTracerProvider, BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";

let initialized = false;

export function initObservability() {
  if (initialized) {
    return;
  }

  const debug = process.env.OTEL_DEBUG === "true";
  if (debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const provider = new BasicTracerProvider();

  if (process.env.OTEL_CONSOLE_EXPORTER !== "false") {
    provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
  }
  provider.register();

  if (process.env.SENTRY_DSN) {
    const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
      environment: process.env.NODE_ENV ?? "development"
    });
  }

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  }
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>
) {
  initObservability();
  const tracer = trace.getTracer("botpass");

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      captureException(error, { span: name, ...attributes });
      throw error;
    } finally {
      span.end();
    }
  });
}
