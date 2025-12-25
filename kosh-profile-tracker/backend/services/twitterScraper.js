// backend/services/twitterScraper.js
// Multi-strategy robust Twitter scraper (desktop -> mobile -> nitter fallbacks)
// Exports: scrapeProfile(handle, options)
// Put this file in backend/services/twitterScraper.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
puppeteer.use(StealthPlugin());

/**
 * Options:
 * - lookbackDays: number (default 365)
 * - maxScrolls: number (default 1000)      -> maximum scroll iterations per mode
 * - timeoutMs: number (default 600000)     -> overall timeout across modes (ms)
 * - noNewThreshold: number (default 8)     -> stop if no new tweets for this many scrolls
 * - permalinkEnrichment: boolean (default false) -> if true, visits each tweet permalink to get exact counts/time
 * - nitterInstances: array (optional)      -> list of nitter base urls to try as fallback
 */
async function scrapeProfile(handle, options = {}) {
  const lookbackDays = options.lookbackDays ?? 365;
  const maxScrolls = options.maxScrolls ?? 1000;
  const timeoutMs = options.timeoutMs ?? 600000; // 10 minutes
  const noNewThreshold = options.noNewThreshold ?? 8;
  const permalinkEnrichment = options.permalinkEnrichment ?? false;
  const customNitter = Array.isArray(options.nitterInstances) ? options.nitterInstances : null;

  const DEBUG_DIR = path.join(__dirname, '../reports');
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  const NITTER_INSTANCES = customNitter || [
    'https://nitter.net',
    'https://nitter.snopyta.org',
    'https://nitter.1d4.us',
    'https://nitter.eu', // may or may not be live
  ];

  let browser;
  const startTime = Date.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Normalizes counts like "1,234" or "1.2K" into integer
  function normalizeCount(raw) {
    if (raw === null || raw === undefined) return 0;
    const s = String(raw).trim();
    if (!s) return 0;
    const cleaned = s.replace(/,/g, '').replace(/\s/g, '');
    const m = cleaned.match(/^([\d,.]+)([KMkMmBb])?$/);
    if (!m) {
      const digits = cleaned.replace(/[^\d.]/g, '');
      return digits ? Math.round(Number(digits)) : 0;
    }
    let num = parseFloat(m[1].replace(/,/g, ''));
    const suf = (m[2] || '').toUpperCase();
    if (suf === 'K') num *= 1e3;
    if (suf === 'M') num *= 1e6;
    if (suf === 'B') num *= 1e9;
    return Math.round(num);
  }

  // Save debug snapshot
  async function saveSnapshot(page, tag) {
    try {
      const html = await page.content();
      const file = path.join(DEBUG_DIR, `snapshot_${handle}_${tag}_${Date.now()}.html`);
      fs.writeFileSync(file, html, 'utf-8');
      console.log(`⚠️ Saved debug snapshot: ${file}`);
    } catch (e) { /* ignore */ }
  }

  // Helper to extract tweets from a page. It tries to be markup-agnostic:
  // finds anchors with /status/ and reads a containing element's text/time/metrics.
  async function extractBatchFromPage(page) {
    return await page.evaluate(() => {
      const out = [];
      const anchors = Array.from(document.querySelectorAll('a[href*="/status/"]'));
      const uniq = new Set();
      anchors.forEach(a => {
        const href = a.href || '';
        if (!href.includes('/status/')) return;
        if (uniq.has(href)) return;
        uniq.add(href);
        const container = a.closest('article') || a.closest('div') || a.parentElement;
        if (!container) return;
        const timeEl = container.querySelector('time') || document.querySelector('time');
        const time = timeEl ? timeEl.getAttribute('datetime') : '';
        const textEl = container.querySelector('[data-testid="tweetText"]') || container.querySelector('div[lang]') || container;
        const text = textEl ? (textEl.innerText || '').trim() : '';
        const replies = (container.querySelector('[data-testid="reply"]') || {}).textContent || '';
        const retweets = (container.querySelector('[data-testid="retweet"]') || {}).textContent || '';
        const likes = (container.querySelector('[data-testid="like"]') || {}).textContent || '';
        const views = (container.querySelector('[data-testid="views"]') || {}).textContent || '';
        const hasImage = !!container.querySelector('img[src*="/media/"], picture');
        const hasVideo = !!container.querySelector('video, [data-testid="videoPlayer"]');
        const placeAnchor = container.querySelector('a[href*="/maps"], a[href*="/places/"], a[href*="google.com/maps"]');
        const placeName = placeAnchor ? (placeAnchor.textContent || '').trim() : '';
        const coordLink = placeAnchor ? (placeAnchor.href || '') : '';
        const urls = Array.from(container.querySelectorAll('a[href^="http"]')).map(x => x.href);
        out.push({ permalink: href, text, time, replies, retweets, likes, views, hasImage, hasVideo, placeName, coordLink, urls });
      });
      return out;
    });
  }

  // Enrich a tweet by visiting its permalink (expensive). Used optionally when counts are missing.
  async function enrichTweetFromPermalink(page, tweet) {
    if (!tweet || !tweet.permalink) return tweet;
    try {
      await page.goto(tweet.permalink, { waitUntil: 'networkidle2', timeout: 30000 });
      // try to extract canonical metrics and timestamp
      const enriched = await page.evaluate(() => {
        const getText = s => document.querySelector(s) ? document.querySelector(s).textContent.trim() : '';
        const timeEl = document.querySelector('time');
        const time = timeEl ? timeEl.getAttribute('datetime') : '';
        const likes = getText('[data-testid="like"]') || getText('div[data-testid="like"]') || '';
        const retweets = getText('[data-testid="retweet"]') || getText('div[data-testid="retweet"]') || '';
        const replies = getText('[data-testid="reply"]') || getText('div[data-testid="reply"]') || '';
        return { time, likes, retweets, replies };
      });
      tweet.time = enriched.time || tweet.time;
      tweet.likes = normalizeCount(enriched.likes || tweet.likes || 0);
      tweet.retweets = normalizeCount(enriched.retweets || tweet.retweets || 0);
      tweet.replies = normalizeCount(enriched.replies || tweet.replies || 0);
    } catch (e) {
      // ignore permalink errors
    }
    return tweet;
  }

  // Core extraction loop for a single Puppeteer page (desktop or mobile or nitter)
  async function runExtractionOnPage(page, modeLabel = 'desktop', isNitter = false) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const seen = new Set();
    const tweets = [];
    let reachedCutoff = false;
    let scrolls = 0;
    let consecutiveNoNew = 0;
    let prevCount = 0;

    while (!reachedCutoff && scrolls < maxScrolls) {
      scrolls++;

      // global timeout
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`⏳ global timeout reached (${timeoutMs}ms) while scraping ${handle} on ${modeLabel}`);
        break;
      }

      // get a batch and process
      let batch = [];
      try {
        batch = await extractBatchFromPage(page);
      } catch (e) {
        batch = [];
      }

      // If no batch, try some alternative stimuli to load tweets
      if (!batch || batch.length === 0) {
        // various scroll/jump strategies
        try { await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8)); } catch(e){}
        await sleep(600);
        try { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); } catch(e){}
        await sleep(600);
        // re-evaluate batch after stimuli
        try { batch = await extractBatchFromPage(page); } catch(e){ batch = []; }
      }

      // process the batch items
      if (Array.isArray(batch) && batch.length) {
        for (const t of batch) {
          const key = t.permalink || (t.time + '|' + (t.text || '').slice(0, 80));
          if (seen.has(key)) continue;
          seen.add(key);

          // parse numbers
          const likes = normalizeCount(t.likes);
          const retweets = normalizeCount(t.retweets);
          const replies = normalizeCount(t.replies);
          const views = normalizeCount(t.views);

          // parse date
          let dateObj = null;
          try { dateObj = t.time ? new Date(t.time) : null; } catch(e) { dateObj = null; }

          // cutoff check
          if (dateObj && dateObj < cutoffDate) {
            reachedCutoff = true;
            continue;
          }

          // coords heuristics
          let coordinates = null;
          if (t.coordLink) {
            const m = t.coordLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (m) coordinates = { lat: Number(m[1]), lon: Number(m[2]), source: t.coordLink };
            else {
              const m2 = t.coordLink.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (m2) coordinates = { lat: Number(m2[1]), lon: Number(m2[2]), source: t.coordLink };
            }
          }

          tweets.push({
            id: t.permalink ? (t.permalink.match(/status\/(\d+)/) ? (t.permalink.match(/status\/(\d+)/)[1]) : t.permalink) : '',
            text: t.text || '',
            time: dateObj ? dateObj.toISOString() : (t.time || ''),
            likes, retweets, replies, views,
            hasImage: !!t.hasImage,
            hasVideo: !!t.hasVideo,
            coords: coordinates,
            placeName: t.placeName || '',
            urls: Array.isArray(t.urls) ? t.urls : [],
            permalink: t.permalink || ''
          });
        }
      }

      // new count detection
      const currCount = tweets.length;
      if (currCount > prevCount) {
        consecutiveNoNew = 0;
        prevCount = currCount;
      } else {
        consecutiveNoNew++;
      }

      console.log(`ℹ️ ${modeLabel} scroll #${scrolls} done — tweets collected so far: ${tweets.length} (noNew=${consecutiveNoNew})`);

      // save occasional snapshot for debugging
      if (scrolls % 12 === 0) {
        await saveSnapshot(page, `${modeLabel}_scroll${scrolls}`);
      }

      // stopping heuristics
      if (consecutiveNoNew >= noNewThreshold) {
        console.log(`ℹ️ No new tweets after ${consecutiveNoNew} scrolls on ${modeLabel} — stopping extraction`);
        break;
      }
      if (reachedCutoff) {
        console.log(`ℹ️ Reached date cutoff while scraping ${modeLabel}`);
        break;
      }

      // final polite scroll
      try { await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9)); } catch(e){}
      await sleep(700 + Math.floor(Math.random() * 400));
    } // end while

    return tweets;
  } // runExtractionOnPage

  // Try a single mode: open page, attempt to dismiss overlays (desktop), then run extraction
  async function tryMode(url, opts = {}) {
    const modeLabel = opts.label || url;
    const isNitter = !!opts.isNitter;
    const useMobile = !!opts.useMobile;
    let page;
    try {
      page = await browser.newPage();
      // mobile UA for mobile, else desktop UA
      if (useMobile) {
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 390, height: 844 });
      } else {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1200, height: 900 });
      }
      page.setDefaultNavigationTimeout(45000);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

      // Save initial snapshot for debugging
      await saveSnapshot(page, `${modeLabel}_initial`);

      // Try to dismiss overlays on desktop
      if (!useMobile && !isNitter) {
        try {
          await page.evaluate(() => {
            // remove dialog overlays and sticky cookie banners
            document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]').forEach(n => n.remove());
            document.querySelectorAll('div, section').forEach(el => {
              try {
                const style = window.getComputedStyle(el);
                if ((style.position === 'fixed' || style.position === 'sticky') && el.innerText && /cookie|log in|sign up|login|signup/i.test(el.innerText)) el.remove();
              } catch(e){}
            });
            // try to click "show more" buttons if exist
            document.querySelectorAll('div[role="button"], button').forEach(b => {
              try { if ((b.innerText||'').toLowerCase().includes('show more')) b.click(); } catch(e){}
            });
          });
        } catch (e) {}
      }

      // run extraction loop on this page
      const tweets = await runExtractionOnPage(page, modeLabel, isNitter);

      await page.close();
      return { tweets, success: true };
    } catch (err) {
      if (page) {
        try { await page.close(); } catch (e) {}
      }
      console.warn(`⚠️ tryMode ${modeLabel} failed: ${err && err.message ? err.message : err}`);
      return { tweets: [], success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  // Start scraping: open browser once, try desktop -> mobile -> nitter list
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const desktopUrl = `https://twitter.com/${handle.replace('@','')}`;
    const mobileUrl = `https://mobile.twitter.com/${handle.replace('@','')}`;

    // 1) Desktop
    console.log('ℹ️ Attempting desktop Twitter extraction (may hit login overlay)');
    const desktopRes = await tryMode(desktopUrl, { label: 'desktop', useMobile: false });
    if (!desktopRes.success) console.log('ℹ️ Desktop attempt failed; will try mobile and nitter.');

    // If desktop found many tweets, keep them; else try mobile
    let collected = (desktopRes.tweets || []);
    if (collected.length < 25) {
      console.log('ℹ️ Desktop extraction yielded few tweets -> trying mobile.twitter.com fallback (often more accessible)');
      const mobileRes = await tryMode(mobileUrl, { label: 'mobile', useMobile: true });
      if (mobileRes.success && (mobileRes.tweets || []).length > collected.length) {
        collected = mobileRes.tweets;
      }
    }

    // If still small or empty, try nitter instances
    if (!collected.length || collected.length < 50) {
      console.log('ℹ️ Trying Nitter fallbacks for better HTML-only scraping');
      for (const inst of NITTER_INSTANCES) {
        if (Date.now() - startTime > timeoutMs) break;
        try {
          const nitterUrl = `${inst.replace(/\/$/, '')}/${handle.replace('@','')}`;
          const nRes = await tryMode(nitterUrl, { label: `nitter:${inst}`, useMobile: false, isNitter: true });
          if (nRes.success && nRes.tweets && nRes.tweets.length > collected.length) {
            collected = nRes.tweets;
          }
          // if we've got a lot already, stop trying more nitter instances
          if (collected.length >= 200) break;
        } catch (e) {
          // ignore and try next instance
        }
      }
    }

    // If permalink enrichment requested, visit permalinks for missing counts (expensive)
    if (permalinkEnrichment && collected.length && Date.now() - startTime < timeoutMs) {
      console.log('ℹ️ Starting permalink enrichment (this is slower but fills exact counts)');
      const pagePerm = await browser.newPage();
      await pagePerm.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      for (let i = 0; i < collected.length; i++) {
        if (Date.now() - startTime > timeoutMs) break;
        const t = collected[i];
        if ((!t.likes || !t.retweets || !t.replies) && t.permalink) {
          try {
            await enrichTweetFromPermalink(pagePerm, t);
            // small polite wait
            await sleep(400 + Math.floor(Math.random()*300));
          } catch(e){}
        }
      }
      try { await pagePerm.close(); } catch(e){}
    }

    // Sort tweets by time desc then remove duplicates
    const uniqMap = new Map();
    for (const t of collected) {
      const key = t.permalink || (t.id || '') || (t.time + '|' + (t.text||'').slice(0,120));
      if (!uniqMap.has(key)) uniqMap.set(key, t);
    }
    const finalTweets = Array.from(uniqMap.values()).sort((a,b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });

    // DONE — try to fetch name/followers by a light separate page if possible
    let name = handle.replace('@',''), followers = 0, following = 0, profileImage = '';
    try {
      const p = await browser.newPage();
      await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      await p.goto(desktopUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const base = await p.evaluate(() => {
        const get = s => document.querySelector(s) ? document.querySelector(s).textContent.trim() : '';
        const img = (document.querySelector('img[src*="profile_images"]') || {}).src || '';
        return {
          name: get('[data-testid="UserName"] span') || get('h2[role="heading"]') || '',
          followersText: get('a[href$="/followers"] span') || get('a[href$="/followers"]') || '',
          followingText: get('a[href$="/following"] span') || get('a[href$="/following"]') || '',
          profileImage: img
        };
      });
      followers = normalizeCount(base.followersText || '0');
      following = normalizeCount(base.followingText || '0');
      name = base.name || name;
      profileImage = base.profileImage || '';
      try { await p.close(); } catch(e){}
    } catch (e) { /* ignore */ }

    return {
      name: name || handle.replace('@',''),
      handle: `@${handle.replace('@','')}`,
      bio: '',
      location: '',
      website: '',
      joinDate: '',
      following,
      followers,
      tweets: finalTweets,
      verified: !!profileImage,
      profileImage: profileImage || '',
      accountExists: true,
      protected: false,
      reason: ''
    };

  } catch (err) {
    console.error('❌ Scraper final error:', err && (err.message || err));
    throw new Error(`Failed to scrape Twitter profile: ${err && (err.message || err) || 'unknown'}`);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

module.exports = { scrapeProfile };
