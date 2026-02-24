const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const NEWS_SOURCES = require('./sources');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsScraper/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'news.json');
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_ARTICLES_PER_FEED = 5;
const MAX_ARTICLES_PER_CATEGORY = 8;
const MAX_AGE_DAYS = 30;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(data, stats) {
  try {
    ensureCacheDir();
    const payload = {
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString(),
      stats,
      categories: data,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return payload;
  } catch (err) {
    console.error('Failed to write cache:', err.message);
    return { timestamp: Date.now(), lastUpdated: new Date().toISOString(), stats, categories: data };
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFeedWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const feed = await parser.parseURL(url);
      return { ok: true, feed };
    } catch (err) {
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`  Retry ${attempt + 1}/${retries} for ${url} in ${delay}ms...`);
        await sleep(delay);
      } else {
        return { ok: false, error: err.message, url };
      }
    }
  }
}

function processArticles(articles) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  return Array.from(new Map(articles.map((a) => [a.link, a])).values())
    .filter((item) => {
      if (!item.pubDate) return false;
      try {
        return new Date(item.pubDate) >= cutoff;
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      try {
        return new Date(b.pubDate) - new Date(a.pubDate);
      } catch {
        return 0;
      }
    })
    .slice(0, MAX_ARTICLES_PER_CATEGORY);
}

async function fetchAllNews({ force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) {
      console.log(`Serving cached news from ${cached.lastUpdated}`);
      return cached;
    }
  }

  console.log('Fetching fresh news from all sources...');
  const startTime = Date.now();
  const allNews = {};
  let totalSuccess = 0;
  let totalFailed = 0;
  const errors = [];

  const categoryEntries = Object.entries(NEWS_SOURCES);

  // Fetch all feeds across all categories in parallel
  const feedJobs = [];
  for (const [category, feeds] of categoryEntries) {
    for (const url of feeds) {
      feedJobs.push({ category, url });
    }
  }

  const results = await Promise.allSettled(
    feedJobs.map((job) => fetchFeedWithRetry(job.url).then((r) => ({ ...r, category: job.category })))
  );

  // Group results by category
  const categoryArticles = {};
  for (const entry of categoryEntries) {
    categoryArticles[entry[0]] = [];
  }

  for (const result of results) {
    if (result.status === 'rejected') {
      totalFailed++;
      errors.push({ error: result.reason?.message || 'Unknown error' });
      continue;
    }
    const { ok, feed, error, url, category } = result.value;
    if (!ok) {
      totalFailed++;
      errors.push({ category, url, error });
      continue;
    }
    totalSuccess++;
    const articles = feed.items.slice(0, MAX_ARTICLES_PER_FEED).map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: item.source || extractSource(item.title),
      description: item.contentSnippet || item.content || '',
    }));
    categoryArticles[category].push(...articles);
  }

  for (const [category] of categoryEntries) {
    allNews[category] = processArticles(categoryArticles[category]);
  }

  const elapsed = Date.now() - startTime;
  const stats = {
    fetchTimeMs: elapsed,
    feedsTotal: feedJobs.length,
    feedsSucceeded: totalSuccess,
    feedsFailed: totalFailed,
    errors: errors.length > 0 ? errors : undefined,
  };

  console.log(`Fetch complete in ${elapsed}ms — ${totalSuccess}/${feedJobs.length} feeds OK`);
  if (errors.length > 0) {
    console.warn('Feed errors:', errors);
  }

  const payload = writeCache(allNews, stats);
  return payload;
}

function extractSource(title) {
  if (!title) return 'Google News';
  const match = title.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : 'Google News';
}

function getCacheInfo() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return { exists: false };
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cached = JSON.parse(raw);
    const age = Date.now() - cached.timestamp;
    return {
      exists: true,
      lastUpdated: cached.lastUpdated,
      ageMs: age,
      ageHours: Math.round((age / (1000 * 60 * 60)) * 10) / 10,
      isStale: age >= CACHE_TTL,
      stats: cached.stats,
    };
  } catch {
    return { exists: false };
  }
}

module.exports = { fetchAllNews, getCacheInfo, NEWS_SOURCES, CACHE_TTL };
