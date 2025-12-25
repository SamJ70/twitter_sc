// backend/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function formatNumber(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '0';
  const num = Number(n);
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

function safeToString(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  return String(v);
}

// Returns a filesystem-safe filename component (Windows safe)
function safeFilenamePart(s) {
  if (!s) return '';
  // replace invalid filename characters with underscore
  return String(s).replace(/[:\/\\\?\<\>\|\*"\s]+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function analyzeHiddenPatterns(tweets) {
  const patterns = [];
  if (!tweets || tweets.length === 0) return patterns;

  const normalized = tweets.map(t => ({
    text: String(t.text || t.content || t.tweet || '').trim(),
    time: t.time || t.timestamp || t.created_at || '',
    likes: Number((t.engagement && t.engagement.likes) || t.likes || t.favorite_count || 0),
    retweets: Number((t.engagement && t.engagement.retweets) || t.retweets || t.retweet_count || 0),
    replies: Number((t.engagement && t.engagement.replies) || t.replies || t.reply_count || 0)
  })).filter(t => t.text.length > 0);

  if (normalized.length === 0) return patterns;

  // acrostic / first-letter
  try {
    const firstLetters = normalized.map(t => {
      const m = t.text.match(/\b([A-Za-z0-9])/);
      return m ? m[1] : '';
    }).filter(Boolean).join('');
    if (firstLetters.length >= 6) {
      const up = firstLetters.replace(/[^A-Z]/g, '');
      const words = up.match(/[A-Z]{3,}/g);
      if (words && words.length > 0) patterns.push(`🔍 First-letter pattern detected: "${words.join(', ')}" — possible hidden acrostic`);
    }
  } catch (e) {}

  // timing regularity
  try {
    const times = normalized
      .map(t => { const d = new Date(t.time); return isNaN(d.getTime()) ? null : d.getTime(); })
      .filter(Boolean).sort((a,b)=>a-b);
    if (times.length >= 5) {
      const intervals = [];
      for (let i=1;i<times.length;i++) intervals.push(times[i] - times[i-1]);
      const avg = intervals.reduce((s,x)=>s+x,0)/intervals.length;
      const variance = intervals.reduce((s,x)=>s+Math.pow(x-avg,2),0)/intervals.length;
      if (variance < avg * 0.05) patterns.push('⏰ Extremely regular posting pattern detected — possible automation or scheduling.');
      else if (variance < avg * 0.2) patterns.push('⏰ Noticeable regular timing — check scheduling tools.');
    }
  } catch (e) {}

  // repeated keywords
  try {
    const freq = {};
    normalized.forEach(t => {
      const words = t.text.toLowerCase().replace(/[^\w\s#@]/g, ' ').split(/\s+/).filter(Boolean);
      words.forEach(w => {
        if (w.length <= 3) return;
        if (w.startsWith('@') || w.startsWith('http')) return;
        freq[w] = (freq[w] || 0) + 1;
      });
    });
    const repeated = Object.entries(freq).filter(([_,c]) => c >= Math.max(3, Math.floor(normalized.length * 0.4))).sort((a,b)=>b[1]-a[1]);
    if (repeated.length > 0) patterns.push(`🔄 Repeated keywords: ${repeated.slice(0,5).map(x=>`${x[0]} (${x[1]})`).join(', ')}`);
  } catch (e) {}

  // emoji stuffing
  try {
    const emojiRegex = /[\p{Emoji}\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    let emojiCount = 0;
    normalized.forEach(t => { const m = (t.text.match(emojiRegex) || []); emojiCount += m.length; });
    if (emojiCount > normalized.length * 3) patterns.push(`😀 Excessive emoji usage (${(emojiCount/normalized.length).toFixed(1)} per tweet)`);
  } catch (e) {}

  // engagement outliers
  try {
    const eng = normalized.map(t => t.likes + t.retweets + t.replies);
    const avg = eng.reduce((s,x)=>s+x,0)/eng.length;
    const outliers = eng.filter(e=> e > avg * 5).length;
    if (outliers > 0) patterns.push(`🚀 ${outliers} high-engagement outliers — check for amplification`);
  } catch (e) {}

  return patterns;
}

async function generatePDF(reportData = {}, handle = 'report') {
  return new Promise((resolve, reject) => {
    try {
      reportData = reportData || {};
      const rawStamp = reportData.timestamp || new Date().toISOString();
      const stampPart = safeFilenamePart(String(rawStamp));
      const handlePart = safeFilenamePart(String(handle || 'report'));
      const filename = `${handlePart}_report_${stampPart}.pdf`;
      const reportsDir = path.join(__dirname, '../reports');

      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

      const filepath = path.join(reportsDir, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);

      // Ensure stream errors are handled
      stream.on('error', (err) => {
        return reject(err);
      });

      doc.pipe(stream);

      // HEADER
      doc.fontSize(22).fillColor('#2C3E50').text('🔍 Kosh Profile Tracker', { align: 'center' }).moveDown(0.3);
      doc.fontSize(16).fillColor('#3498DB').text('Deep Analysis Report', { align: 'center' }).moveDown(0.2);
      doc.fontSize(11).fillColor('#7F8C8D').text(`Generated: ${new Date(reportData.timestamp || Date.now()).toLocaleString()}`, { align: 'center' }).moveDown(1.2);

      // PROFILE SECTION
      const profile = reportData.profile || {};
      addSection(doc, '👤 Profile Information', '#E74C3C');
      addKeyValue(doc, 'Name', profile.name || 'N/A');
      addKeyValue(doc, 'Handle', profile.handle || handle);
      addKeyValue(doc, 'Bio', (profile.bio || '').substring(0, 200));
      addKeyValue(doc, 'Location', profile.location || 'Not specified');
      addKeyValue(doc, 'Website', profile.website || 'Not specified');
      addKeyValue(doc, 'Joined', profile.joinDate || 'Unknown');
      addKeyValue(doc, 'Account Age', profile.accountAge || reportData.accountAge || 'Unknown');
      addKeyValue(doc, 'Verified', profile.verified ? '✓ Yes' : '✗ No');
      doc.moveDown(0.9);

      // STATISTICS
      const stats = reportData.statistics || {};
      const tweetsAnalyzed = Number(stats.tweetsAnalyzed || (reportData.recentActivity && reportData.recentActivity.tweets && reportData.recentActivity.tweets.length) || (reportData.tweets && reportData.tweets.length) || 0);
      addSection(doc, '📊 Key Statistics', '#3498DB');
      addStatRow(doc, 'Followers', formatNumber(stats.followers || stats.followersRaw || 0));
      addStatRow(doc, 'Following', formatNumber(stats.following || stats.followingRaw || 0));
      addStatRow(doc, 'Tweets Analyzed', String(tweetsAnalyzed));
      addStatRow(doc, 'Average Engagement', formatNumber(stats.avgEngagementPerTweet || stats.avgEngagement || 0));
      addStatRow(doc, 'Total Engagement', formatNumber(stats.totalEngagement || 0));
      const followersNum = Number(stats.followers || stats.followersRaw || 0);
      const followingNum = Number(stats.following || stats.followingRaw || 1);
      const ratio = followingNum > 0 ? (followersNum / followingNum) : 0;
      addStatRow(doc, 'Follower Ratio', ratio ? ratio.toFixed(2) : '—');
      doc.moveDown(1);

      // ACCOUNT HEALTH
      if (reportData.accountHealth || reportData.health) {
        const health = reportData.accountHealth || reportData.health || {};
        addSection(doc, '🏆 Account Health Score', '#2ECC71');
        const score = health.overallScore || health.score || 0;
        const rating = health.rating || (score >= 80 ? 'Excellent' : (score >= 50 ? 'Fair' : 'Poor'));
        doc.fontSize(18).fillColor('#2C3E50').text(`${score}/100`, { continued: true }).fontSize(12).text(` - ${rating}`).moveDown(0.5);
        if (health.factors && Array.isArray(health.factors)) {
          health.factors.forEach(factor => { doc.fontSize(9).fillColor('#34495E').text(`• ${factor}`).moveDown(0.08); });
        }
        doc.moveDown(0.8);
      }

      // SUSPICIOUS ACTIVITY
      if (reportData.suspiciousActivity && reportData.suspiciousActivity.hasSuspiciousPatterns) {
        const suspicious = reportData.suspiciousActivity;
        addSection(doc, '⚠️ Suspicious Activity Detection', '#E74C3C');
        doc.fontSize(11).fillColor('#E74C3C').text(`Risk Level: ${suspicious.riskLevel || 'Unknown'}`).moveDown(0.4);
        if (suspicious.flags && suspicious.flags.length > 0) {
          doc.fontSize(10).fillColor('#2C3E50').text('Flags Detected:', { underline: true }).moveDown(0.2);
          suspicious.flags.forEach(flag => { doc.fontSize(9).fillColor('#E74C3C').text(`🚩 ${flag}`).moveDown(0.08); });
        }
        if (suspicious.details && suspicious.details.length > 0) {
          doc.moveDown(0.4);
          doc.fontSize(10).fillColor('#2C3E50').text('Details:', { underline: true }).moveDown(0.2);
          suspicious.details.forEach(detail => { doc.fontSize(9).fillColor('#34495E').text(detail).moveDown(0.08); });
        }
        doc.moveDown(0.8);
      }

      // BEHAVIOR / CONTENT / ENGAGEMENT sections (kept flexible)
      if (reportData.behaviorAnalysis) {
        const behavior = reportData.behaviorAnalysis;
        addSection(doc, '🎭 Behavioral Analysis', '#9B59B6');
        addKeyValue(doc, 'Account Type', behavior.accountType || 'Unknown');
        addKeyValue(doc, 'Activity Pattern', behavior.activityPattern || 'Unknown');
        addKeyValue(doc, 'Posting Frequency', behavior.postingFrequency || 'Unknown');
        addKeyValue(doc, 'Peak Activity', behavior.peakActivityTimes || behavior.peakActivity || 'Unknown');
        addKeyValue(doc, 'Consistency', behavior.consistencyScore || behavior.consistency || 'Unknown');
        doc.moveDown(0.8);
      }

      if (reportData.contentAnalysis) {
        const content = reportData.contentAnalysis;
        addSection(doc, '📝 Content Analysis', '#F39C12');
        if (content.contentTypes) {
          doc.fontSize(10).fillColor('#2C3E50').text('Content Distribution:', { underline: true }).moveDown(0.25);
          Object.entries(content.contentTypes).forEach(([type, count]) => { doc.fontSize(9).fillColor('#34495E').text(`  ${type}: ${count}`).moveDown(0.06); });
          doc.moveDown(0.4);
        }
        if (content.sentimentDistribution) {
          doc.fontSize(10).fillColor('#2C3E50').text('Sentiment Analysis:', { underline: true }).moveDown(0.25);
          doc.fontSize(9).fillColor('#34495E').text(`  Positive: ${content.sentimentDistribution.positive || content.sentimentDistribution.positivePct || 0}`)
             .text(`  Neutral: ${content.sentimentDistribution.neutral || content.sentimentDistribution.neutralPct || 0}`)
             .text(`  Negative: ${content.sentimentDistribution.negative || content.sentimentDistribution.negativePct || 0}`)
             .moveDown(0.4);
        }
        if (content.hashtagUsage && content.hashtagUsage.topHashtags) {
          doc.fontSize(10).fillColor('#2C3E50').text('Top Hashtags:', { underline: true }).moveDown(0.2);
          doc.fontSize(9).fillColor('#34495E').text((content.hashtagUsage.topHashtags || []).slice(0, 12).join(', ')).moveDown(0.4);
        }
        doc.moveDown(0.8);
      }

      if (reportData.engagementAnalysis) {
        const engagement = reportData.engagementAnalysis;
        addSection(doc, '💬 Engagement Metrics', '#16A085');
        addStatRow(doc, 'Average Likes', formatNumber(engagement.averageLikes || engagement.avgLikes || 0));
        addStatRow(doc, 'Average Retweets', formatNumber(engagement.averageRetweets || engagement.avgRetweets || 0));
        addStatRow(doc, 'Average Replies', formatNumber(engagement.averageReplies || engagement.avgReplies || 0));
        addStatRow(doc, 'Average Views', formatNumber(engagement.averageViews || engagement.avgViews || 0));
        addStatRow(doc, 'Engagement Rate', engagement.engagementRate || engagement.rate || '0%');
        addStatRow(doc, 'Virality Score', engagement.viralityScore || 'Low');
        doc.moveDown(0.8);
      }

      // TWEETS + HIDDEN PATTERNS
      const allTweets = reportData.recentActivity?.tweets || reportData.tweets || reportData.topTweets || [];
      if (allTweets.length > 0) {
        const hiddenPatterns = analyzeHiddenPatterns(allTweets);
        if (hiddenPatterns.length > 0) {
          addSection(doc, '🔍 Hidden Pattern Analysis', '#E67E22');
          hiddenPatterns.forEach(pattern => { doc.fontSize(9).fillColor('#E67E22').text(pattern).moveDown(0.12); });
          doc.moveDown(0.6);
        }

        addSection(doc, '📱 All Analyzed Tweets', '#3498DB');
        doc.fontSize(9).fillColor('#7F8C8D').text(`Total tweets analyzed: ${allTweets.length}`).moveDown(0.5);

        allTweets.forEach((tweet, idx) => {
          if (doc.y > 720) doc.addPage();
          doc.fontSize(10).fillColor('#2C3E50').text(`Tweet #${idx + 1}`).moveDown(0.12);
          const tweetText = String(tweet.content || tweet.text || tweet.tweet || '').replace(/\s+/g, ' ').trim();
          doc.fontSize(9).fillColor('#34495E').text(tweetText.substring(0, 400), { paragraphGap: 2 }).moveDown(0.12);
          const likes = (tweet.engagement && tweet.engagement.likes) || tweet.likes || tweet.favorite_count || 0;
          const retweets = (tweet.engagement && tweet.engagement.retweets) || tweet.retweets || tweet.retweet_count || 0;
          const replies = (tweet.engagement && tweet.engagement.replies) || tweet.replies || tweet.reply_count || 0;
          const views = (tweet.engagement && tweet.engagement.views) || tweet.views || 0;
          doc.fontSize(8).fillColor('#7F8C8D').text(`❤️ ${formatNumber(likes)}  🔁 ${formatNumber(retweets)}  💬 ${formatNumber(replies)}  👁️ ${formatNumber(views)}`).moveDown(0.12);
          const badges = [];
          if (tweet.hasImage || (tweet.metadata && tweet.metadata.hasImage)) badges.push('🖼️');
          if (tweet.hasVideo || (tweet.metadata && tweet.metadata.hasVideo)) badges.push('🎥');
          if (tweet.hasLink || (tweet.metadata && tweet.metadata.hasLink)) badges.push('🔗');
          if (tweet.isReply || (tweet.metadata && tweet.metadata.isReply)) badges.push('💬 Reply');
          if (tweet.isRetweet || (tweet.metadata && tweet.metadata.isRetweet)) badges.push('🔁 RT');
          if (badges.length > 0) { doc.fontSize(8).fillColor('#95A5A6').text(badges.join(' ')).moveDown(0.12); }
          const ts = tweet.timestamp || tweet.time || tweet.created_at || '';
          if (ts) { try { doc.fontSize(8).fillColor('#BDC3C7').text(`🕒 ${new Date(ts).toLocaleString()}`).moveDown(0.12); } catch (e) {} }
          doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.12);
        });
      }

      // INSIGHTS and RECOMMENDATIONS
      if (reportData.insights && reportData.insights.length > 0) {
        doc.addPage();
        addSection(doc, '🎯 Key Insights', '#16A085');
        reportData.insights.forEach((insight, idx) => { doc.fontSize(9).fillColor('#34495E').text(`${idx+1}. ${insight}`).moveDown(0.12); });
        doc.moveDown(0.6);
      }

      if (reportData.recommendations && reportData.recommendations.length > 0) {
        addSection(doc, '💡 Recommendations', '#27AE60');
        reportData.recommendations.forEach((rec, idx) => { doc.fontSize(9).fillColor('#34495E').text(`${idx+1}. ${rec}`).moveDown(0.12); });
        doc.moveDown(0.6);
      }

      // FOOTER
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#95A5A6')
         .text('Generated by Kosh Profile Tracker', { align: 'center' })
         .text('Advanced Social Media Intelligence & Analysis', { align: 'center' })
         .text('For educational and research purposes only', { align: 'center' });

      // finalize PDF
      doc.end();

      // wait for stream finish
      stream.on('finish', () => {
        console.log(`✅ Enhanced PDF generated: ${filename}`);
        resolve(filepath);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}

function addSection(doc, title, color) {
  doc.fontSize(12).fillColor(color).text(title, { underline: true }).moveDown(0.35);
}

function addKeyValue(doc, key, value) {
  doc.fontSize(9).fillColor('#34495E').text(`${key}: `, { continued: true })
     .fillColor('#7F8C8D').text(safeToString(value)).moveDown(0.12);
}

function addStatRow(doc, key, value) {
  doc.fontSize(9).fillColor('#34495E').text(`${key}: `, { continued: true })
     .fillColor('#2C3E50').text(String(value)).moveDown(0.12);
}

module.exports = { generatePDF };
