// backend/controllers/profileController.js
const path = require('path');
const fs = require('fs');
const twitterScraper = require('../services/twitterScraper');
const linkedinScraper = require('../services/linkedinScraper');
const reportGenerator = require('../utils/reportGenerator');
const pdfGenerator = require('../utils/pdfGenerator');

async function analyzeProfile(req, res) {
  try {
    const { handle, platform } = req.body;
    if (!handle || !platform) {
      return res.status(400).json({ error: 'Missing required fields', message: 'Please provide both handle and platform' });
    }

    console.log(`📊 Analyzing ${platform} profile: ${handle}`);

    let profileData;
    if (platform === 'twitter') {
      profileData = await twitterScraper.scrapeProfile(handle, { lookbackDays: 365, maxScrolls: 1000, timeoutMs: 600000, noNewThreshold: 8 });
    } else if (platform === 'linkedin') {
      profileData = await linkedinScraper.scrapeProfile(handle);
    } else {
      return res.status(400).json({ error: 'Invalid platform', message: 'Supported platforms: twitter, linkedin' });
    }

    if (!profileData.accountExists) {
      return res.status(200).json({
        success: false,
        reason: profileData.reason || 'Account not available',
        protected: !!profileData.protected,
        message: profileData.protected ? 'Account is protected/private; tweets cannot be scraped without auth.' : (profileData.reason || 'Account not found or suspended.')
      });
    }

    // try reportGenerator if present
    let initialReport = {};
    try {
      if (reportGenerator && typeof reportGenerator.generateReport === 'function') {
        initialReport = reportGenerator.generateReport(profileData, platform) || {};
      }
    } catch (e) {
      console.warn('reportGenerator threw; falling back to normalization.', e && e.message ? e.message : e);
      initialReport = {};
    }

    // Normalize / build report with safe defaults to avoid frontend crashes
    const now = Date.now();
    const tweets = Array.isArray(profileData.tweets) ? profileData.tweets : [];
    const tweetsAnalyzed = tweets.length;

    const totalEngagement = tweets.reduce((s, t) => s + (Number(t.likes || 0) + Number(t.retweets || 0) + Number(t.replies || 0)), 0);
    const avgEng = tweetsAnalyzed ? Math.round(totalEngagement / tweetsAnalyzed) : 0;

    const profile = {
      name: profileData.name || (initialReport.profile && initialReport.profile.name) || '',
      handle: profileData.handle || (initialReport.profile && initialReport.profile.handle) || `@${handle.replace('@','')}`,
      bio: profileData.bio || (initialReport.profile && initialReport.profile.bio) || '',
      location: profileData.location || (initialReport.profile && initialReport.profile.location) || '',
      website: profileData.website || (initialReport.profile && initialReport.profile.website) || '',
      joinDate: profileData.joinDate || (initialReport.profile && initialReport.profile.joinDate) || '',
      verified: !!profileData.verified || !!(initialReport.profile && initialReport.profile.verified),
      avatarPath: (initialReport.profile && initialReport.profile.avatarPath) || ''
    };

    // make sure the frontend fields exist (safe defaults)
    const safeContentAnalysis = (initialReport.contentAnalysis) ? initialReport.contentAnalysis : {
      contentTypes: initialReport.contentAnalysis?.contentTypes || { Original: 0, Replies: 0, Retweets: 0, WithMedia: 0, WithLinks: 0 },
      sentimentDistribution: initialReport.contentAnalysis?.sentimentDistribution || { positive: 0, neutral: 0, negative: 0 },
      hashtagUsage: initialReport.contentAnalysis?.hashtagUsage || { topHashtags: [] }
    };

    const report = {
      timestamp: now,
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      profile,
      statistics: Object.assign({
        followersRaw: Number(profileData.followers || 0),
        followingRaw: Number(profileData.following || 0),
        tweetsAnalyzed,
        avgEngagementPerTweet: avgEng,
        totalEngagement
      }, initialReport.statistics || {}),
      analysis: initialReport.analysis || {},
      contentAnalysis: safeContentAnalysis,
      engagementAnalysis: initialReport.engagementAnalysis || { averageLikes: 0, averageRetweets: 0, averageReplies: 0, averageViews: 0, engagementRate: '0%', viralityScore: 'Low' },
      behaviorAnalysis: initialReport.behaviorAnalysis || {},
      suspiciousActivity: initialReport.suspiciousActivity || { hasSuspiciousPatterns: false, flags: [], details: [] },
      insights: initialReport.insights || [],
      recommendations: initialReport.recommendations || [],
      tweets,
      topTweets: initialReport.topTweets || tweets.slice().sort((a,b) => ((b.likes||0)+(b.retweets||0)+(b.replies||0)) - ((a.likes||0)+(a.retweets||0)+(a.replies||0))).slice(0, 10),
      hidden: initialReport.hidden || {}
    };

    // ensure reports dir exists
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    // optional: download avatar image if present (non-blocking)
    if (profileData.profileImage) {
      try {
        const dest = path.join(reportsDir, `${profile.handle.replace('@','')}_avatar.jpg`);
        await downloadImage(profileData.profileImage, dest);
        report.profile.avatarPath = dest;
      } catch (e) {
        // continue without avatar
      }
    }

    // generate PDF (defensive)
    console.log('� Generating PDF report...');
    const pdfPath = await pdfGenerator.generatePDF(report, handle);
    console.log('✅ PDF generated:', path.basename(pdfPath));

    return res.json({ success: true, report, pdfUrl: `/reports/${path.basename(pdfPath)}` });

  } catch (error) {
    console.error('❌ Error analyzing profile:', error && (error.message || error));
    return res.status(500).json({ error: 'Analysis failed', message: error && (error.message || error), details: 'Please check if the profile exists and is public' });
  }
}

function downloadImage(url, dest) {
  // lazy-load to avoid circular require issues
  const http = require('http');
  const https = require('https');
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('No image URL'));
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = client.get(url, (res) => {
      if (res.statusCode >= 400) {
        file.close(); fs.unlink(dest, () => {}); return reject(new Error(`Failed to download image, status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    });
    req.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    req.setTimeout(15000, () => { req.abort(); fs.unlink(dest, () => {}); reject(new Error('Image download timeout')); });
  });
}

module.exports = { analyzeProfile };
