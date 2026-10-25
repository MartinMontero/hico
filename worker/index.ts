import { createApp } from './app.ts';
import { runPurge } from './purge.ts';

const app = createApp();

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  // The retention purge (06 §2), once a day (the Cron Trigger in wrangler.jsonc).
  scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runPurge(env, Math.floor(controller.scheduledTime / 1000)));
  },
} satisfies ExportedHandler<Env>;