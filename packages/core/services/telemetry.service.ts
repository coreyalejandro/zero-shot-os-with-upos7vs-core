/**
 * Telemetry Service
 *
 * Handles OpenTelemetry initialization and tracing
 * Provides a wrapper around the OTel SDK
 */

import { BaseService } from './base.js';
import { UserConfig } from '../config.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, Tracer, Span } from '@opentelemetry/api';

export class TelemetryService extends BaseService {
    private sdk: NodeSDK | null = null;
    private tracer: Tracer | null = null;

    constructor(config: UserConfig) {
        super(
            {
                name: 'Telemetry',
                version: '1.0.0',
                description: 'OpenTelemetry observability service',
                dependencies: [],
                optional: true,
            },
            config
        );
    }

    async initialize(): Promise<void> {
        if (!this.shouldEnable()) {
            return;
        }

        try {
            // Initialize OTel SDK
            // For now, we use a Console Exporter for simplicity as requested
            // In production, this would be an OTLPTraceExporter
            const traceExporter = new ConsoleSpanExporter();

            this.sdk = new NodeSDK({
                resource: resourceFromAttributes({
                    [SEMRESATTRS_SERVICE_NAME]: 'upos-7-vs',
                    [SEMRESATTRS_SERVICE_VERSION]: '2.0.0',
                }),
                traceExporter,
                // Use SimpleSpanProcessor for immediate console output in CLI tools
                spanProcessor: new SimpleSpanProcessor(traceExporter),
            });

            this.sdk.start();

            this.tracer = trace.getTracer('upos-core');

            this.status.initialized = true;
            this.status.enabled = true;
            this.status.healthy = true;
            console.log('✓ Telemetry service initialized (OpenTelemetry)');
        } catch (error) {
            console.error('Failed to initialize telemetry:', error);
            this.status.healthy = false;
            this.status.lastError = String(error);
        }
    }

    async shutdown(): Promise<void> {
        if (this.sdk) {
            try {
                await this.sdk.shutdown();
                console.log('✓ Telemetry service shutdown');
            } catch (error) {
                console.error('Error shutting down telemetry:', error);
            }
        }
        this.status.initialized = false;
        this.status.enabled = false;
    }

    async healthCheck(): Promise<boolean> {
        return this.status.initialized && this.status.healthy;
    }

    protected shouldEnable(): boolean {
        // Enable by default if not explicitly disabled
        // In a real app, this might be controlled by a specific config flag
        return true;
    }

    /**
     * Start a new span
     */
    startSpan(name: string, attributes?: Record<string, any>): Span | null {
        if (!this.tracer) return null;

        const span = this.tracer.startSpan(name);
        if (attributes) {
            span.setAttributes(attributes);
        }
        return span;
    }

    /**
     * Get the global tracer
     */
    getTracer(): Tracer | null {
        return this.tracer;
    }
}
