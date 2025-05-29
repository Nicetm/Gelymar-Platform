
export const SITE_TITLE = 'Gelymar Panel';

export const { API_URL, SITE, BASE_URL } = import.meta.env;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
export const REMOTE_ASSETS_BASE_URL = import.meta.env.REMOTE_ASSETS_BASE_URL ?? '/assets';

export const RANDOMIZE = Boolean(import.meta.env.RANDOMIZE) || true;

