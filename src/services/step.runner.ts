import {
    markStarted,
    markCompleted,
    markFailed,
    findCompletedStep,
} from '../db/repos/integrationStep.repo';
import { log } from '../db/logger';

/**
 * Orquestra execução de um step de flow com:
 *   1. Resume: se o step já completou nessa execução (linha em integration_log_steps),
 *      pula a chamada de `fn()` e retorna o payload salvo.
 *   2. Persistência: registra started → completed/failed em integration_log_steps,
 *      salvando o output em `payload` (JSONB) pra o resume reaproveitar depois.
 *   3. Tentativa numerada: `attempt_number` é auto-calculado (MAX+1) — primeira execução
 *      é 1, primeiro resume é 2, e por aí.
 *
 * Importante: `fn` precisa retornar um valor JSON-serializável. Funções que produzem
 * efeito colateral sem output útil podem retornar `null` ou um pequeno marker.
 */
export class StepRunner {
    constructor(
        private readonly integrationId: number,
        private readonly piedCode: string,
    ) {}

    async run<T>(stepName: string, stepIndex: number, fn: () => Promise<T>): Promise<T> {
        // 1. Já completou em execução anterior? → resume (sem chamar fn)
        const existing = await findCompletedStep(this.integrationId, stepName);
        if (existing) {
            await log({
                level: 'info', source: 'step.runner', piedCode: this.piedCode,
                message: `Step '${stepName}' já completou — pulando (resume)`,
                context: {
                    integrationId: this.integrationId,
                    stepName,
                    stepIndex,
                    completedAttempt: existing.attempt_number,
                    completedAt: existing.finished_at,
                },
            });
            return existing.payload as T;
        }

        // 2. Inicia nova tentativa
        const { stepId, attemptNumber } = await markStarted(
            this.integrationId,
            stepName,
            stepIndex,
        );

        // 3. Executa e persiste resultado
        try {
            const result = await fn();
            await markCompleted(stepId, result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error
                ? `${err.message}\n${err.stack ?? ''}`
                : String(err);

            await markFailed(stepId, errorMessage);
            await log({
                level: 'error', source: 'step.runner', piedCode: this.piedCode,
                message: `Step '${stepName}' falhou (tentativa ${attemptNumber})`,
                context: {
                    integrationId: this.integrationId,
                    stepName,
                    stepIndex,
                    attemptNumber,
                    error: errorMessage,
                },
            });

            // re-throw — flow precisa parar nesse step
            throw err;
        }
    }
}