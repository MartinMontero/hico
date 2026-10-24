// The seed refuses to run against anything but a local database (brief item 9).

const FORBIDDEN_FLAGS = ['--remote', '--preview', '--env', '-e', '--persist-to', '--config', '-c', '--database-id'];

export function assertLocalOnly(args: string[], env: Record<string, string | undefined>): void {
  for (const arg of args) {
    const name = arg.split('=')[0] ?? arg;
    if (FORBIDDEN_FLAGS.includes(name)) {
      throw new Error(`Refusing to seed: argument ${name} could point at a non-local database.`);
    }
    if (arg !== '--local') {
      throw new Error(`Refusing to seed: unexpected argument ${arg}. Only --local is accepted.`);
    }
  }
  // Credentials in the environment are a sign this shell is set up for a remote account.
  if (env['CLOUDFLARE_API_TOKEN'] || env['CLOUDFLARE_API_KEY']) {
    throw new Error('Refusing to seed: Cloudflare credentials are set in this shell. Unset them to seed locally.');
  }
}
