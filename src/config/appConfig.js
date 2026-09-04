// Non-secret app config injected at build time by vite.config.js from .env.
// The Jira API token never reaches the browser — it lives in the dev-server proxy.
export const CFG = __APP_CONFIG__

export const APP_NAME = 'jiramage'
// From package.json via vite: full versions show clean ("v0.1.7"); pre-release
// versions carry the build hash ("v0.1.8-beta.1+a3f9c2d").
export const APP_VERSION = __APP_VERSION__
export const APP_CREDIT = 'by MpLab'
export const APP_COPYRIGHT = `© ${new Date().getFullYear()} MpLab`
