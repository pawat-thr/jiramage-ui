// Non-secret app config injected at build time by vite.config.js from .env.
// The Jira API token never reaches the browser — it lives in the dev-server proxy.
export const CFG = __APP_CONFIG__

export const APP_NAME = 'jiramage'
export const APP_VERSION = 'v0.1.5'
export const APP_CREDIT = 'by MpLab'
export const APP_COPYRIGHT = `© ${new Date().getFullYear()} MpLab`
