// Turning referrer traffic into backlink candidates.

// Search engines, our own domain, and link-shortener hops aren't backlinks.
const NOT_A_BACKLINK = [
  "google.", "bing.com", "duckduckgo.com", "yahoo.", "yandex.", "baidu.com",
  "ecosia.org", "brave.com", "search.", "localhost", "asklys.com", "askparent.com",
  "t.co", "l.facebook.com", "lm.facebook.com", "out.reddit.com", "android-app",
];

export const isRealReferrer = (domain: string): boolean =>
  !!domain && !NOT_A_BACKLINK.some((x) => domain.includes(x));

// A pasted URL or bare hostname -> the hostname we store.
export const normaliseDomain = (input: string): string =>
  String(input).replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
