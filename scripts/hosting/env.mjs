/* Build environment as Vite sees it: .env files (mode production) overlaid by process.env, process.env winning. */
export async function loadBuildEnv(cwd = process.cwd(), processEnv = process.env) {
  const { loadEnv } = await import('vite') // lazy: only the CLIs need it
  return { ...loadEnv('production', cwd, ''), ...processEnv }
}
