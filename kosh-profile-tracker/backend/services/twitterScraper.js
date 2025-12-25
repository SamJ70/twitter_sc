// backend/services/twitterScraper.js
// IMPROVED Multi-strategy robust Twitter scraper with better tweet extraction
// Replace your current twitterScraper.js with this file

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
puppeteer.use(StealthPlugin());

/**
 * Enhanced scrapeProfile function with better tweet extraction
 * Options:
 * - lookbackDays: number (default 365)
 * - maxScrolls: number (default 1000)
 * - timeoutMs: number (default 600000)
 * - noNewThreshold: number (default 8)
 * - minTweets: number (default 50)
 */
async function scrapeProfile(handle, options = {}) {
  const lookbackDays = options.lookbackDays ?? 365;
  const maxScrolls = options.maxScrolls ?? 1000;
  const timeoutMs = options.timeoutMs ?? 600000; // 10 minutes
  const noNewThreshold = options.noNewThreshold ?? 8;
  const minTweets = options.minTweets ?? 50;

  const DEBUG_DIR = path.join(__dirname, '../reports');
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  // Updated Nitter instances (more reliable ones)
  const NITTER_INSTANCES = [
    'https://nitter.poast.org',
    'https://nitter.privacydev.net',
    'https://nitter.net',
    'https://nitter.unixfox.eu',
    'https://nitter.42l.fr'
  ];

  let browser;
  const startTime = Date.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Enhanced count normalization
  function normalizeCount(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    const s = String(raw).trim().toLowerCase();
    if (!s || s === '0') return 0;
    
    // Remove commas and spaces
    const cleaned = s.replace(/,/g, '').replace(/\s/g, '');
    
    // Handle K, M, B suffixes
    const match = cleaned.match(/^([\d,.]+)([kmb])?$/i);
    if (!match) {
      const digits = cleaned.replace(/[^\d.]/g, '');
      return digits ? Math.round(parseFloat(digits)) : 0;
    }
    
    let num = parseFloat(match[1]);
    const suffix = (match[2] || '').toLowerCase();
    
    if (suffix === 'k') num *= 1000;
    else if (suffix === 'm') num *= 1000000;
    else if (suffix === 'b') num *= 1000000000;
    
    return Math.round(num);
  }

  // Save debug snapshot
  async function saveSnapshot(page, tag) {
    try {
      const html = await page.content();
      const file = path.join(DEBUG_DIR, `snapshot_${handle}_${tag}_${Date.now()}.html`);
      fs.writeFileSync(file, html, 'utf-8');
      console.log(`📸 Saved snapshot: ${path.basename(file)}`);
    } catch (e) { /* ignore */ }
  }

  // ENHANCED tweet extraction with multiple selector strategies
  async function extractTweetsFromPage(page, source = 'twitter') {
    return await page.evaluate((src) => {
      const tweets = [];
      const seen = new Set();

      // Helper to safely get text
      const getText = (el, selector) => {
        if (!el) return '';
        const found = selector ? el.querySelector(selector) : el;
        return found ? (found.textContent || found.innerText || '').trim() : '';
      };

      // Helper to get attribute
      const getAttr = (el, selector, attr) => {
        if (!el) return '';
        const found = selector ? el.querySelector(selector) : el;
        return found ? (found.getAttribute(attr) || '') : '';
      };

      if (src === 'nitter') {
        // NITTER extraction (cleaner HTML structure)
        const tweetDivs = document.querySelectorAll('.timeline-item');
        
        tweetDivs.forEach(item => {
          try {
            // Get tweet link for ID
            const linkEl = item.querySelector('.tweet-link');
            const href = linkEl ? linkEl.href : '';
            if (!href || seen.has(href)) return;
            seen.add(href);

            // Extract data from Nitter's clean structure
            const textEl = item.querySelector('.tweet-content');
            const text = getText(textEl);
            
            const timeEl = item.querySelector('.tweet-date a');
            const timeStr = getAttr(timeEl, null, 'title') || getText(timeEl);
            
            // Stats from Nitter
            const stats = item.querySelectorAll('.icon-container');
            let replies = 0, retweets = 0, likes = 0;
            
            stats.forEach(stat => {
              const statText = getText(stat);
              const iconClass = stat.querySelector('[class*="icon-"]')?.className || '';
              
              if (iconClass.includes('comment')) replies = parseInt(statText.replace(/\D/g, '')) || 0;
              else if (iconClass.includes('retweet')) retweets = parseInt(statText.replace(/\D/g, '')) || 0;
              else if (iconClass.includes('heart')) likes = parseInt(statText.replace(/\D/g, '')) || 0;
            });

            // Media detection
            const hasImage = !!item.querySelector('.attachment.image, img.still-image');
            const hasVideo = !!item.querySelector('.attachment.video, video');
            
            // Location data
            const locationEl = item.querySelector('.tweet-geo');
            const placeName = locationEl ? getText(locationEl) : '';

            tweets.push({
              permalink: href,
              text: text,
              time: timeStr,
              replies: String(replies),
              retweets: String(retweets),
              likes: String(likes),
              views: '0',
              hasImage: hasImage,
              hasVideo: hasVideo,
              placeName: placeName,
              coordLink: '',
              urls: Array.from(item.querySelectorAll('a[href^="http"]')).map(a => a.href)
            });
          } catch (e) {
            console.error('Error extracting Nitter tweet:', e);
          }
        });

      } else {
        // TWITTER/X extraction with multiple strategies
        
        // Strategy 1: Article elements (most reliable for new Twitter)
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        
        articles.forEach(article => {
          try {
            // Get permalink
            const timeLink = article.querySelector('time')?.parentElement;
            const href = timeLink ? timeLink.href : '';
            if (!href || !href.includes('/status/') || seen.has(href)) return;
            seen.add(href);

            // Text content - try multiple selectors
            const textEl = article.querySelector('[data-testid="tweetText"]') ||
                          article.querySelector('[lang]') ||
                          article.querySelector('.css-1jxf684');
            const text = getText(textEl);

            // Time
            const timeEl = article.querySelector('time');
            const time = timeEl ? (timeEl.getAttribute('datetime') || getText(timeEl)) : '';

            // Engagement metrics with multiple fallback selectors
            const getMetric = (testId) => {
              const el = article.querySelector(`[data-testid="${testId}"]`);
              if (!el) return '0';
              const text = getText(el);
              // Extract just the number, ignoring labels
              const match = text.match(/[\d,.]+[KMB]?/i);
              return match ? match[0] : '0';
            };

            const replies = getMetric('reply');
            const retweets = getMetric('retweet');
            const likes = getMetric('like');
            const views = getMetric('views') || getMetric('analytics');

            // Media detection
            const hasImage = !!article.querySelector('[data-testid="tweetPhoto"], img[src*="media"]');
            const hasVideo = !!article.querySelector('[data-testid="videoPlayer"], video');

            // Links
            const urls = Array.from(article.querySelectorAll('a[href^="http"]'))
              .map(a => a.href)
              .filter(url => !url.includes('twitter.com') && !url.includes('x.com'));

            // Location/coordinates
            const locationLink = article.querySelector('a[href*="/maps"], a[href*="google.com/maps"]');
            const placeName = locationLink ? getText(locationLink) : '';
            const coordLink = locationLink ? locationLink.href : '';

            tweets.push({
              permalink: href,
              text: text,
              time: time,
              replies: replies,
              retweets: retweets,
              likes: likes,
              views: views,
              hasImage: hasImage,
              hasVideo: hasVideo,
              placeName: placeName,
              coordLink: coordLink,
              urls: urls
            });

          } catch (e) {
            console.error('Error extracting tweet from article:', e);
          }
        });

        // Strategy 2: Fallback for older Twitter HTML or mobile
        if (tweets.length === 0) {
          const tweetDivs = document.querySelectorAll('[data-testid="cellInnerDiv"]');
          
          tweetDivs.forEach(div => {
            try {
              const link = div.querySelector('a[href*="/status/"]');
              const href = link ? link.href : '';
              if (!href || seen.has(href)) return;
              seen.add(href);

              const text = getText(div.querySelector('[lang]') || div);
              const time = getAttr(div, 'time', 'datetime');
              
              tweets.push({
                permalink: href,
                text: text,
                time: time,
                replies: '0',
                retweets: '0',
                likes: '0',
                views: '0',
                hasImage: !!div.querySelector('img[src*="media"]'),
                hasVideo: !!div.querySelector('video'),
                placeName: '',
                coordLink: '',
                urls: []
              });

            } catch (e) {
              console.error('Error in fallback extraction:', e);
            }
          });
        }
      }

      return tweets;
    }, source);
  }

  // ENHANCED scroll and extraction loop
  async function runExtractionLoop(page, modeLabel = 'desktop', isNitter = false) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const seen = new Set();
    const tweets = [];
    let reachedCutoff = false;
    let scrollCount = 0;
    let consecutiveNoNew = 0;
    let prevCount = 0;

    console.log(`🔄 Starting extraction loop for ${modeLabel}...`);

    while (!reachedCutoff && scrollCount < maxScrolls && consecutiveNoNew < noNewThreshold) {
      scrollCount++;

      // Check global timeout
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`⏰ Global timeout reached at scroll ${scrollCount}`);
        break;
      }

      try {
        // Extract tweets
        const source = isNitter ? 'nitter' : 'twitter';
        const batch = await extractTweetsFromPage(page, source);

        // Process batch
        for (const t of batch) {
          const key = t.permalink || `${t.time}|${t.text.slice(0, 50)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // Normalize engagement numbers
          const likes = normalizeCount(t.likes);
          const retweets = normalizeCount(t.retweets);
          const replies = normalizeCount(t.replies);
          const views = normalizeCount(t.views);

          // Parse date
          let dateObj = null;
          try {
            if (t.time) {
              dateObj = new Date(t.time);
              if (isNaN(dateObj.getTime())) dateObj = null;
            }
          } catch (e) {
            dateObj = null;
          }

          // Check cutoff
          if (dateObj && dateObj < cutoffDate) {
            reachedCutoff = true;
            continue;
          }

          // Extract coordinates if available
          let coordinates = null;
          if (t.coordLink) {
            const coordMatch = t.coordLink.match(/[@?](-?\d+\.\d+),(-?\d+\.\d+)/);
            if (coordMatch) {
              coordinates = {
                lat: parseFloat(coordMatch[1]),
                lon: parseFloat(coordMatch[2]),
                source: t.coordLink
              };
            }
          }

          // Extract tweet ID
          let tweetId = '';
          if (t.permalink) {
            const idMatch = t.permalink.match(/status\/(\d+)/);
            if (idMatch) tweetId = idMatch[1];
          }

          tweets.push({
            id: tweetId,
            text: t.text || '',
            time: dateObj ? dateObj.toISOString() : (t.time || ''),
            likes,
            retweets,
            replies,
            views,
            hasImage: !!t.hasImage,
            hasVideo: !!t.hasVideo,
            coords: coordinates,
            placeName: t.placeName || '',
            urls: Array.isArray(t.urls) ? t.urls : [],
            permalink: t.permalink || ''
          });
        }

        // Check if we found new tweets
        const currCount = tweets.length;
        if (currCount > prevCount) {
          consecutiveNoNew = 0;
          prevCount = currCount;
          console.log(`📊 ${modeLabel} scroll ${scrollCount}: ${currCount} tweets collected (new: ${batch.length})`);
        } else {
          consecutiveNoNew++;
          console.log(`⚠️ ${modeLabel} scroll ${scrollCount}: No new tweets (${consecutiveNoNew}/${noNewThreshold})`);
        }

        // Save snapshot periodically
        if (scrollCount % 15 === 0) {
          await saveSnapshot(page, `${modeLabel}_s${scrollCount}`);
        }

        // Stop if we have enough tweets and hit threshold
        if (tweets.length >= minTweets && consecutiveNoNew >= noNewThreshold) {
          console.log(`✅ Collected ${tweets.length} tweets, stopping`);
          break;
        }

        if (reachedCutoff) {
          console.log(`📅 Reached date cutoff`);
          break;
        }

        // Scroll strategies
        try {
          // Random scroll amount for more natural behavior
          const scrollAmount = 600 + Math.floor(Math.random() * 400);
          await page.evaluate((amount) => {
            window.scrollBy(0, amount);
          }, scrollAmount);
          
          await sleep(800 + Math.floor(Math.random() * 400));

          // Occasionally scroll to bottom
          if (scrollCount % 5 === 0) {
            await page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await sleep(1000);
          }

        } catch (e) {
          console.warn(`Scroll error: ${e.message}`);
        }

      } catch (error) {
        console.error(`Error in extraction loop at scroll ${scrollCount}:`, error.message);
        await sleep(2000);
      }
    }

    console.log(`✅ ${modeLabel} extraction complete: ${tweets.length} tweets`);
    return tweets;
  }

  // Try a single mode (desktop/mobile/nitter)
  async function tryMode(url, opts = {}) {
    const modeLabel = opts.label || url;
    const isNitter = !!opts.isNitter;
    const useMobile = !!opts.useMobile;
    
    console.log(`🚀 Trying ${modeLabel}...`);
    
    let page;
    try {
      page = await browser.newPage();

      // Set user agent and viewport
      if (useMobile) {
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 390, height: 844, isMobile: true });
      } else {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 1024 });
      }

      // Enhanced page settings
      await page.setDefaultNavigationTimeout(60000);
      await page.setDefaultTimeout(30000);

      // Block unnecessary resources to speed up
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate
      console.log(`🌐 Navigating to ${url}...`);
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });

      await sleep(3000);

      // Save initial snapshot
      await saveSnapshot(page, `${modeLabel}_initial`);

      // Remove overlays and popups (Twitter specific)
      if (!isNitter) {
        try {
          await page.evaluate(() => {
            // Remove login modals and dialogs
            document.querySelectorAll('[role="dialog"], [aria-modal="true"]').forEach(el => el.remove());
            
            // Remove cookie banners
            document.querySelectorAll('[class*="cookie"], [class*="banner"]').forEach(el => {
              if (el.textContent.toLowerCase().includes('cookie') || 
                  el.textContent.toLowerCase().includes('accept')) {
                el.remove();
              }
            });

            // Remove sticky overlays
            document.querySelectorAll('div').forEach(el => {
              const style = window.getComputedStyle(el);
              if (style.position === 'fixed' && style.zIndex > 1000) {
                const text = el.textContent.toLowerCase();
                if (text.includes('log in') || text.includes('sign up') || text.includes('sign in')) {
                  el.remove();
                }
              }
            });

            // Enable body scroll if disabled
            document.body.style.overflow = 'auto';
          });

          console.log(`🧹 Cleaned up overlays`);
        } catch (e) {
          console.warn(`Could not remove overlays: ${e.message}`);
        }
      }

      // Run extraction
      const tweets = await runExtractionLoop(page, modeLabel, isNitter);

      await page.close();
      return { tweets, success: true };

    } catch (error) {
      console.error(`❌ ${modeLabel} failed:`, error.message);
      if (page) {
        try {
          await saveSnapshot(page, `${modeLabel}_error`);
          await page.close();
        } catch (e) {}
      }
      return { tweets: [], success: false, error: error.message };
    }
  }

  // MAIN EXECUTION
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 Starting enhanced Twitter scraping for @${handle}`);
    console.log(`📅 Looking back ${lookbackDays} days`);
    console.log(`⏱️ Timeout: ${timeoutMs/1000}s`);
    console.log(`${'='.repeat(60)}\n`);

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const cleanHandle = handle.replace('@', '');
    let allTweets = [];
    let bestResult = { tweets: [], success: false };

    // Strategy 1: Try Nitter instances first (most reliable, no auth needed)
    console.log(`\n📡 PHASE 1: Trying Nitter instances...\n`);
    
    for (const instance of NITTER_INSTANCES) {
      if (Date.now() - startTime > timeoutMs * 0.6) break;
      
      const nitterUrl = `${instance}/${cleanHandle}`;
      const result = await tryMode(nitterUrl, {
        label: `nitter:${new URL(instance).hostname}`,
        isNitter: true,
        useMobile: false
      });

      if (result.success && result.tweets.length > bestResult.tweets.length) {
        bestResult = result;
        console.log(`✨ New best result: ${result.tweets.length} tweets from Nitter`);
      }

      // If we got good results from Nitter, use them
      if (bestResult.tweets.length >= minTweets) {
        console.log(`✅ Nitter provided ${bestResult.tweets.length} tweets - using this data`);
        allTweets = bestResult.tweets;
        break;
      }

      await sleep(2000);
    }

    // Strategy 2: Try Twitter mobile if Nitter didn't work well
    if (allTweets.length < minTweets && Date.now() - startTime < timeoutMs * 0.8) {
      console.log(`\n📱 PHASE 2: Trying mobile Twitter...\n`);
      
      const mobileUrl = `https://mobile.twitter.com/${cleanHandle}`;
      const mobileResult = await tryMode(mobileUrl, {
        label: 'mobile-twitter',
        useMobile: true,
        isNitter: false
      });

      if (mobileResult.success && mobileResult.tweets.length > allTweets.length) {
        console.log(`✨ Mobile Twitter found ${mobileResult.tweets.length} tweets`);
        allTweets = mobileResult.tweets;
      }
    }

    // Strategy 3: Try desktop Twitter as last resort
    if (allTweets.length < minTweets && Date.now() - startTime < timeoutMs * 0.9) {
      console.log(`\n🖥️ PHASE 3: Trying desktop Twitter...\n`);
      
      const desktopUrl = `https://twitter.com/${cleanHandle}`;
      const desktopResult = await tryMode(desktopUrl, {
        label: 'desktop-twitter',
        useMobile: false,
        isNitter: false
      });

      if (desktopResult.success && desktopResult.tweets.length > allTweets.length) {
        console.log(`✨ Desktop Twitter found ${desktopResult.tweets.length} tweets`);
        allTweets = desktopResult.tweets;
      }
    }

    // Deduplicate and sort tweets
    const tweetMap = new Map();
    for (const tweet of allTweets) {
      const key = tweet.permalink || tweet.id || `${tweet.time}|${tweet.text.slice(0, 100)}`;
      if (!tweetMap.has(key)) {
        tweetMap.set(key, tweet);
      }
    }

    const finalTweets = Array.from(tweetMap.values())
      .sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;
        return timeB - timeA; // Newest first
      });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ SCRAPING COMPLETE`);
    console.log(`📊 Total unique tweets collected: ${finalTweets.length}`);
    console.log(`⏱️ Time taken: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`${'='.repeat(60)}\n`);

    // Fetch profile info
    let profileInfo = {
      name: cleanHandle,
      handle: `@${cleanHandle}`,
      bio: '',
      location: '',
      website: '',
      joinDate: '',
      following: 0,
      followers: 0,
      verified: false,
      profileImage: ''
    };

    // Try to get profile info from a working source
    try {
      console.log(`👤 Fetching profile information...`);
      const profilePage = await browser.newPage();
      await profilePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Try Twitter first
      try {
        await profilePage.goto(`https://twitter.com/${cleanHandle}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await sleep(3000);

        const info = await profilePage.evaluate(() => {
          const get = (sel) => {
            const el = document.querySelector(sel);
            return el ? el.textContent.trim() : '';
          };

          return {
            name: get('[data-testid="UserName"] span') || get('h2 span'),
            bio: get('[data-testid="UserDescription"]'),
            location: get('[data-testid="UserLocation"]') || get('[data-testid="UserLocation"] span'),
            website: get('[data-testid="UserUrl"] a'),
            followersText: get('a[href$="/verified_followers"] span, a[href$="/followers"] span'),
            followingText: get('a[href$="/following"] span'),
            profileImage: document.querySelector('img[src*="profile_images"]')?.src || '',
            verified: !!document.querySelector('[data-testid="icon-verified"], [aria-label*="Verified"]')
          };
        });

        if (info.name) {
          profileInfo.name = info.name;
          profileInfo.bio = info.bio;
          profileInfo.location = info.location;
          profileInfo.website = info.website;
          profileInfo.followers = normalizeCount(info.followersText);
          profileInfo.following = normalizeCount(info.followingText);
          profileInfo.profileImage = info.profileImage;
          profileInfo.verified = info.verified;
          console.log(`✅ Profile info fetched from Twitter`);
        }
      } catch (e) {
        console.log(`⚠️ Could not fetch from Twitter, trying Nitter...`);
        
        // Try Nitter for profile info
        for (const instance of NITTER_INSTANCES.slice(0, 2)) {
          try {
            await profilePage.goto(`${instance}/${cleanHandle}`, {
              waitUntil: 'domcontentloaded',
              timeout: 20000
            });
            await sleep(2000);

            const nitterInfo = await profilePage.evaluate(() => {
              const get = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.textContent.trim() : '';
              };

              return {
                name: get('.profile-card-fullname'),
                bio: get('.profile-bio'),
                location: get('.profile-location'),
                website: get('.profile-website'),
                followersText: get('.profile-stat-num[title*="Followers"]'),
                followingText: get('.profile-stat-num[title*="Following"]'),
                profileImage: document.querySelector('.profile-card-avatar')?.src || ''
              };
            });

            if (nitterInfo.name) {
              profileInfo.name = nitterInfo.name;
              profileInfo.bio = nitterInfo.bio;
              profileInfo.location = nitterInfo.location;
              profileInfo.website = nitterInfo.website;
              profileInfo.followers = normalizeCount(nitterInfo.followersText);
              profileInfo.following = normalizeCount(nitterInfo.followingText);
              profileInfo.profileImage = nitterInfo.profileImage;
              console.log(`✅ Profile info fetched from Nitter`);
              break;
            }
          } catch (e2) {
            continue;
          }
        }
      }

      await profilePage.close();
    } catch (e) {
      console.warn(`⚠️ Could not fetch complete profile info: ${e.message}`);
    }

    // Return complete profile data
    return {
      ...profileInfo,
      tweets: finalTweets,
      accountExists: true,
      protected: false,
      reason: ''
    };

  } catch (error) {
    console.error(`\n❌ FATAL ERROR:`, error.message);
    console.error(error.stack);
    throw new Error(`Failed to scrape Twitter profile: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log(`🔒 Browser closed`);
      } catch (e) {}
    }
  }
}

module.exports = { scrapeProfile };