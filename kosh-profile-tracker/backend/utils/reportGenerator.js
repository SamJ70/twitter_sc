function generateReport(profileData, platform) {
  const timestamp = new Date().toISOString();
  
  if (platform === 'twitter') {
    return generateTwitterReport(profileData, timestamp);
  } else if (platform === 'linkedin') {
    return generateLinkedInReport(profileData, timestamp);
  }
  
  return null;
}

function generateTwitterReport(data, timestamp) {
  // Deep analysis of tweets
  const tweetAnalysis = analyzeTweetsInDepth(data.tweets);
  
  // Behavioral analysis
  const behaviorAnalysis = analyzeBehavior(data, tweetAnalysis);
  
  // Engagement analysis
  const engagementAnalysis = analyzeEngagement(data.tweets, data.followers);
  
  // Suspicious activity detection
  const suspiciousActivity = detectSuspiciousActivity(data, tweetAnalysis);
  
  // Content analysis
  const contentAnalysis = analyzeContent(data.tweets);
  
  // Account health score
  const healthScore = calculateAccountHealth(data, tweetAnalysis, suspiciousActivity);
  
  return {
    platform: 'Twitter',
    timestamp: timestamp,
    profile: {
      name: data.name,
      handle: data.handle,
      bio: data.bio,
      location: data.location,
      website: data.website,
      joinDate: data.joinDate,
      verified: data.verified,
      accountAge: calculateAccountAge(data.joinDate)
    },
    statistics: {
      followers: parseInt(data.followers) || 0,
      following: parseInt(data.following) || 0,
      tweetsAnalyzed: data.tweets.length,
      followersFollowingRatio: calculateRatio(data.followers, data.following),
      avgEngagementPerTweet: engagementAnalysis.avgEngagement,
      totalEngagement: engagementAnalysis.totalEngagement
    },
    accountHealth: {
      overallScore: healthScore.score,
      rating: healthScore.rating,
      factors: healthScore.factors
    },
    behaviorAnalysis: {
      accountType: behaviorAnalysis.accountType,
      activityPattern: behaviorAnalysis.activityPattern,
      postingFrequency: behaviorAnalysis.postingFrequency,
      peakActivityTimes: behaviorAnalysis.peakTimes,
      consistencyScore: behaviorAnalysis.consistencyScore
    },
    contentAnalysis: {
      primaryTopics: contentAnalysis.topics,
      sentimentDistribution: contentAnalysis.sentiment,
      contentTypes: contentAnalysis.types,
      hashtagUsage: contentAnalysis.hashtagStats,
      mentionPattern: contentAnalysis.mentionStats,
      linkSharingBehavior: contentAnalysis.linkStats
    },
    engagementAnalysis: {
      averageLikes: engagementAnalysis.avgLikes,
      averageRetweets: engagementAnalysis.avgRetweets,
      averageReplies: engagementAnalysis.avgReplies,
      averageViews: engagementAnalysis.avgViews,
      engagementRate: engagementAnalysis.engagementRate,
      viralityScore: engagementAnalysis.viralityScore,
      topPerformingTweets: engagementAnalysis.topTweets
    },
    suspiciousActivity: {
      hasSuspiciousPatterns: suspiciousActivity.hasSuspicious,
      riskLevel: suspiciousActivity.riskLevel,
      flags: suspiciousActivity.flags,
      details: suspiciousActivity.details
    },
    recentActivity: {
      tweets: data.tweets.slice(0, 10).map(t => ({
        content: t.text,
        timestamp: t.time,
        engagement: {
          likes: t.likes,
          retweets: t.retweets,
          replies: t.replies,
          views: t.views
        },
        metadata: {
          hasImage: t.hasImage,
          hasVideo: t.hasVideo,
          hasLink: t.hasLink,
          isReply: t.isReply,
          isRetweet: t.isRetweet,
          hashtags: t.hashtags,
          mentions: t.mentions
        }
      })),
      summary: tweetAnalysis.summary
    },
    insights: generateDetailedInsights(data, tweetAnalysis, behaviorAnalysis, suspiciousActivity, healthScore),
    recommendations: generateActionableRecommendations(data, tweetAnalysis, behaviorAnalysis, suspiciousActivity, healthScore),
    warnings: suspiciousActivity.flags.length > 0 ? suspiciousActivity.details : []
  };
}

function analyzeTweetsInDepth(tweets) {
  if (!tweets || tweets.length === 0) {
    return {
      summary: 'No recent tweets available for analysis',
      topics: [],
      avgLength: 0,
      mediaUsage: 0,
      interactionRate: 0
    };
  }

  // Extract keywords and topics
  const allText = tweets.map(t => t.text.toLowerCase()).join(' ');
  const words = allText.split(/\s+/).filter(w => w.length > 4 && !w.startsWith('http'));
  
  const wordFreq = {};
  words.forEach(word => {
    const cleaned = word.replace(/[^a-z0-9]/g, '');
    if (cleaned.length > 4) {
      wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
    }
  });
  
  const topTopics = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Calculate averages
  const avgLength = tweets.reduce((sum, t) => sum + t.length, 0) / tweets.length;
  const mediaUsage = tweets.filter(t => t.hasImage || t.hasVideo).length;
  const mediaPercentage = (mediaUsage / tweets.length * 100).toFixed(1);
  
  // Interaction analysis
  const replies = tweets.filter(t => t.isReply).length;
  const retweets = tweets.filter(t => t.isRetweet).length;
  const original = tweets.length - replies - retweets;
  
  // Time analysis
  const timestamps = tweets.map(t => new Date(t.time)).filter(d => !isNaN(d));
  const hours = timestamps.map(d => d.getHours());
  const hourFreq = {};
  hours.forEach(h => hourFreq[h] = (hourFreq[h] || 0) + 1);
  const peakHour = Object.entries(hourFreq).sort((a, b) => b[1] - a[1])[0];

  return {
    summary: `Account shows ${original > tweets.length * 0.7 ? 'high' : 'moderate'} original content creation with ${mediaPercentage}% media usage`,
    topics: topTopics,
    avgLength: Math.round(avgLength),
    mediaUsage: mediaPercentage,
    interactionRate: {
      original: ((original / tweets.length) * 100).toFixed(1),
      replies: ((replies / tweets.length) * 100).toFixed(1),
      retweets: ((retweets / tweets.length) * 100).toFixed(1)
    },
    peakHour: peakHour ? `${peakHour[0]}:00` : 'Unknown',
    hashtagFrequency: tweets.filter(t => t.hashtags?.length > 0).length,
    linkSharingRate: tweets.filter(t => t.hasLink).length
  };
}

function analyzeBehavior(data, tweetAnalysis) {
  const followers = parseInt(data.followers) || 0;
  const following = parseInt(data.following) || 0;
  const ratio = following > 0 ? followers / following : followers;
  
  let accountType = 'Personal Account';
  if (data.verified) accountType = 'Verified Account';
  else if (followers > 1000000) accountType = 'Mega Influencer';
  else if (followers > 100000) accountType = 'Major Influencer';
  else if (followers > 10000) accountType = 'Micro Influencer';
  else if (followers > 1000) accountType = 'Active Community Member';
  else if (ratio > 10) accountType = 'Growing Influencer';
  
  const tweetCount = data.tweets.length;
  let activityPattern = 'Inactive';
  if (tweetCount >= 8) activityPattern = 'Very Active';
  else if (tweetCount >= 5) activityPattern = 'Active';
  else if (tweetCount >= 2) activityPattern = 'Moderate';
  else if (tweetCount >= 1) activityPattern = 'Low Activity';
  
  return {
    accountType,
    activityPattern,
    postingFrequency: `${tweetCount} tweets in recent timeline`,
    peakTimes: tweetAnalysis.peakHour,
    consistencyScore: calculateConsistency(data.tweets)
  };
}

function analyzeEngagement(tweets, followers) {
  if (tweets.length === 0) {
    return {
      avgEngagement: 0,
      totalEngagement: 0,
      avgLikes: 0,
      avgRetweets: 0,
      avgReplies: 0,
      avgViews: 0,
      engagementRate: '0%',
      viralityScore: 0,
      topTweets: []
    };
  }

  const totalLikes = tweets.reduce((sum, t) => sum + parseInt(t.likes || 0), 0);
  const totalRetweets = tweets.reduce((sum, t) => sum + parseInt(t.retweets || 0), 0);
  const totalReplies = tweets.reduce((sum, t) => sum + parseInt(t.replies || 0), 0);
  const totalViews = tweets.reduce((sum, t) => sum + parseInt(t.views || 0), 0);
  
  const avgLikes = Math.round(totalLikes / tweets.length);
  const avgRetweets = Math.round(totalRetweets / tweets.length);
  const avgReplies = Math.round(totalReplies / tweets.length);
  const avgViews = Math.round(totalViews / tweets.length);
  
  const totalEngagement = totalLikes + totalRetweets + totalReplies;
  const avgEngagement = Math.round(totalEngagement / tweets.length);
  
  const followerCount = parseInt(followers) || 1;
  const engagementRate = ((avgEngagement / followerCount) * 100).toFixed(3);
  
  // Find top performing tweets
  const sortedTweets = [...tweets]
    .sort((a, b) => {
      const scoreA = parseInt(a.likes || 0) + parseInt(a.retweets || 0) * 2 + parseInt(a.replies || 0) * 3;
      const scoreB = parseInt(b.likes || 0) + parseInt(b.retweets || 0) * 2 + parseInt(b.replies || 0) * 3;
      return scoreB - scoreA;
    })
    .slice(0, 3);
  
  const viralityScore = avgRetweets > 100 ? 'High' : avgRetweets > 10 ? 'Medium' : 'Low';
  
  return {
    avgEngagement,
    totalEngagement,
    avgLikes,
    avgRetweets,
    avgReplies,
    avgViews,
    engagementRate: engagementRate + '%',
    viralityScore,
    topTweets: sortedTweets.map(t => ({
      text: t.text.substring(0, 100) + '...',
      likes: t.likes,
      retweets: t.retweets,
      replies: t.replies
    }))
  };
}

function detectSuspiciousActivity(data, tweetAnalysis) {
  const flags = [];
  const details = [];
  
  const followers = parseInt(data.followers) || 0;
  const following = parseInt(data.following) || 0;
  const ratio = following > 0 ? followers / following : followers;
  
  // Check for bot-like behavior
  if (following > 5000 && ratio < 0.1) {
    flags.push('Unusual following pattern');
    details.push('⚠️ Following significantly more accounts than followers - potential bot behavior or spam account');
  }
  
  if (followers > 10000 && ratio > 1000) {
    flags.push('Suspicious follower ratio');
    details.push('⚠️ Extremely high follower-to-following ratio - possible bought followers or inactive account');
  }
  
  // Check for spam patterns
  const tweets = data.tweets;
  if (tweets.length >= 5) {
    const duplicateContent = tweets.filter((t, i, arr) => 
      arr.findIndex(x => x.text === t.text) !== i
    ).length;
    
    if (duplicateContent > tweets.length * 0.3) {
      flags.push('Repetitive content');
      details.push('⚠️ High percentage of duplicate tweets detected - possible spam or automation');
    }
    
    const linkHeavy = tweets.filter(t => t.hasLink).length;
    if (linkHeavy > tweets.length * 0.8) {
      flags.push('Link spam pattern');
      details.push('⚠️ Over 80% of tweets contain links - typical of spam or promotional accounts');
    }
    
    const allHashtags = tweets.reduce((sum, t) => sum + (t.hashtags?.length || 0), 0);
    if (allHashtags > tweets.length * 5) {
      flags.push('Hashtag spam');
      details.push('⚠️ Excessive hashtag usage - averaging 5+ hashtags per tweet indicates spam behavior');
    }
  }
  
  // Check account age vs followers
  const accountAge = calculateAccountAge(data.joinDate);
  if (accountAge !== 'Unknown' && followers > 10000) {
    const ageInDays = parseInt(accountAge);
    if (!isNaN(ageInDays) && ageInDays < 30 && followers > 10000) {
      flags.push('Rapid follower growth');
      details.push('⚠️ Very new account with large follower base - potential bought followers');
    }
  }
  
  const riskLevel = flags.length === 0 ? 'Low' : flags.length <= 2 ? 'Medium' : 'High';
  
  return {
    hasSuspicious: flags.length > 0,
    riskLevel,
    flags,
    details: details.length > 0 ? details : ['✅ No suspicious activity detected']
  };
}

function analyzeContent(tweets) {
  if (tweets.length === 0) {
    return {
      topics: [],
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      types: {},
      hashtagStats: {},
      mentionStats: {},
      linkStats: {}
    };
  }

  // Content types
  const types = {
    original: tweets.filter(t => !t.isReply && !t.isRetweet).length,
    replies: tweets.filter(t => t.isReply).length,
    retweets: tweets.filter(t => t.isRetweet).length,
    withMedia: tweets.filter(t => t.hasImage || t.hasVideo).length,
    withLinks: tweets.filter(t => t.hasLink).length
  };

  // Hashtag analysis
  const allHashtags = tweets.flatMap(t => t.hashtags || []);
  const hashtagFreq = {};
  allHashtags.forEach(h => hashtagFreq[h] = (hashtagFreq[h] || 0) + 1);
  const topHashtags = Object.entries(hashtagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Mention analysis
  const allMentions = tweets.flatMap(t => t.mentions || []);
  const mentionFreq = {};
  allMentions.forEach(m => mentionFreq[m] = (mentionFreq[m] || 0) + 1);
  const topMentions = Object.entries(mentionFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Simple sentiment (keyword-based)
  const positiveWords = ['good', 'great', 'awesome', 'love', 'excellent', 'amazing', 'best', 'happy'];
  const negativeWords = ['bad', 'hate', 'worst', 'terrible', 'awful', 'sad', 'angry', 'disappointed'];
  
  let positive = 0, negative = 0, neutral = 0;
  tweets.forEach(t => {
    const text = t.text.toLowerCase();
    const hasPositive = positiveWords.some(w => text.includes(w));
    const hasNegative = negativeWords.some(w => text.includes(w));
    
    if (hasPositive && !hasNegative) positive++;
    else if (hasNegative && !hasPositive) negative++;
    else neutral++;
  });

  return {
    topics: [],
    sentiment: {
      positive: ((positive / tweets.length) * 100).toFixed(1) + '%',
      neutral: ((neutral / tweets.length) * 100).toFixed(1) + '%',
      negative: ((negative / tweets.length) * 100).toFixed(1) + '%'
    },
    types,
    hashtagStats: {
      total: allHashtags.length,
      unique: Object.keys(hashtagFreq).length,
      topHashtags: topHashtags.map(([tag, count]) => `${tag} (${count})`)
    },
    mentionStats: {
      total: allMentions.length,
      unique: Object.keys(mentionFreq).length,
      topMentions: topMentions.map(([mention, count]) => `${mention} (${count})`)
    },
    linkStats: {
      tweetsWithLinks: types.withLinks,
      percentage: ((types.withLinks / tweets.length) * 100).toFixed(1) + '%'
    }
  };
}

function calculateAccountHealth(data, tweetAnalysis, suspiciousActivity) {
  let score = 100;
  const factors = [];
  
  const followers = parseInt(data.followers) || 0;
  const following = parseInt(data.following) || 0;
  
  // Deduct points for suspicious activity
  score -= suspiciousActivity.flags.length * 15;
  if (suspiciousActivity.hasSuspicious) {
    factors.push(`-${suspiciousActivity.flags.length * 15} points: Suspicious activity detected`);
  }
  
  // Verified account bonus
  if (data.verified) {
    score += 10;
    factors.push('+10 points: Verified account');
  }
  
  // Activity bonus
  if (data.tweets.length >= 5) {
    score += 10;
    factors.push('+10 points: Active posting');
  } else if (data.tweets.length < 2) {
    score -= 10;
    factors.push('-10 points: Low activity');
  }
  
  // Engagement quality
  const avgEngagement = parseInt(tweetAnalysis.interactionRate?.original || 0);
  if (avgEngagement > 70) {
    score += 15;
    factors.push('+15 points: High original content ratio');
  }
  
  // Follower quality
  const ratio = following > 0 ? followers / following : followers;
  if (ratio > 2 && followers > 100) {
    score += 10;
    factors.push('+10 points: Healthy follower ratio');
  } else if (ratio < 0.5 && following > 1000) {
    score -= 10;
    factors.push('-10 points: Poor follower ratio');
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let rating = 'Poor';
  if (score >= 80) rating = 'Excellent';
  else if (score >= 60) rating = 'Good';
  else if (score >= 40) rating = 'Fair';
  
  return {
    score,
    rating,
    factors: factors.length > 0 ? factors : ['Standard account metrics']
  };
}

function generateDetailedInsights(data, tweetAnalysis, behaviorAnalysis, suspiciousActivity, healthScore) {
  const insights = [];
  
  insights.push(`📊 Account Type: ${behaviorAnalysis.accountType} with ${data.followers} followers`);
  insights.push(`📈 Activity Level: ${behaviorAnalysis.activityPattern} - Posts ${tweetAnalysis.interactionRate.original}% original content`);
  insights.push(`💬 Engagement: Average ${tweetAnalysis.avgLength} characters per tweet, ${tweetAnalysis.mediaUsage}% include media`);
  insights.push(`⏰ Peak Activity: Most active around ${tweetAnalysis.peakHour}`);
  insights.push(`🎯 Content Focus: Top topics include ${tweetAnalysis.topics.slice(0, 3).map(t => t.word).join(', ')}`);
  insights.push(`🏆 Account Health: ${healthScore.rating} (${healthScore.score}/100)`);
  
  if (data.verified) {
    insights.push(`✅ Verified Account - Authentic identity confirmed by Twitter`);
  }
  
  if (suspiciousActivity.hasSuspicious) {
    insights.push(`⚠️ Risk Level: ${suspiciousActivity.riskLevel} - ${suspiciousActivity.flags.length} suspicious pattern(s) detected`);
  } else {
    insights.push(`✅ No suspicious activity detected - Account appears legitimate`);
  }
  
  return insights;
}

function generateActionableRecommendations(data, tweetAnalysis, behaviorAnalysis, suspiciousActivity, healthScore) {
  const recommendations = [];
  
  if (healthScore.score < 60) {
    recommendations.push('🔧 Account needs improvement - Focus on authentic engagement and consistent posting');
  }
  
  if (behaviorAnalysis.activityPattern === 'Inactive' || behaviorAnalysis.activityPattern === 'Low Activity') {
    recommendations.push('📅 Increase posting frequency to at least 3-5 times per week for better visibility');
  }
  
  const originalRate = parseFloat(tweetAnalysis.interactionRate.original);
  if (originalRate < 50) {
    recommendations.push('✍️ Create more original content - Currently only ' + originalRate + '% of tweets are original');
  }
  
  if (parseFloat(tweetAnalysis.mediaUsage) < 30) {
    recommendations.push('📸 Add more visual content - Tweets with images/videos get 150% more engagement');
  }
  
  const ratio = calculateRatio(data.followers, data.following);
  if (ratio < 1 && parseInt(data.following) > 1000) {
    recommendations.push('👥 Review following list - Consider unfollowing inactive accounts to improve ratio');
  }
  
  if (suspiciousActivity.hasSuspicious) {
    recommendations.push('⚠️ Address suspicious patterns - ' + suspiciousActivity.flags[0]);
  } else {
    recommendations.push('✅ Maintain current engagement patterns - Account shows healthy activity');
  }
  
  recommendations.push('📊 Track analytics regularly to understand what content resonates with your audience');
  recommendations.push('🤝 Engage with followers through replies and mentions to build community');
  
  return recommendations;
}

// Helper functions
function calculateRatio(followers, following) {
  const f1 = parseInt(followers) || 0;
  const f2 = parseInt(following) || 1;
  return (f1 / f2).toFixed(2);
}

function calculateAccountAge(joinDate) {
  if (!joinDate || joinDate === 'Not specified') return 'Unknown';
  
  try {
    const joined = new Date(joinDate);
    const now = new Date();
    const diffTime = Math.abs(now - joined);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  } catch (e) {
    return 'Unknown';
  }
}

function calculateConsistency(tweets) {
  if (tweets.length < 2) return 'Insufficient data';
  
  const timestamps = tweets.map(t => new Date(t.time)).filter(d => !isNaN(d)).sort((a, b) => b - a);
  if (timestamps.length < 2) return 'Insufficient data';
  
  const gaps = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(timestamps[i - 1] - timestamps[i]);
  }
  
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);
  
  const consistencyRatio = stdDev / avgGap;
  
  if (consistencyRatio < 0.5) return 'Very Consistent';
  if (consistencyRatio < 1) return 'Consistent';
  if (consistencyRatio < 2) return 'Moderate';
  return 'Irregular';
}

function generateLinkedInReport(data, timestamp) {
  const professionalLevel = determineProfessionalLevel(data);
  const industryFocus = extractIndustry(data.headline);
  const careerStage = determineCareerStage(data.experiences);
  
  // Build meaningful insights
  const insights = [];
  insights.push(`Professional: ${data.name}`);
  insights.push(`Current Role: ${data.headline}`);
  
  if (data.experiences && data.experiences.length > 0) {
    insights.push(`${data.experiences.length} documented positions in career`);
    insights.push(`Career Stage: ${careerStage}`);
  } else {
    insights.push(`Limited experience data available - profile may be private`);
  }
  
  if (data.skills && data.skills.length > 0) {
    insights.push(`${data.skills.length} skills listed`);
    insights.push(`Key expertise: ${data.skills.slice(0, 3).join(', ')}`);
  }
  
  insights.push(`Network: ${data.connections} connections`);
  insights.push(`Location: ${data.location}`);
  
  if (data.error) {
    insights.push(`⚠️ Note: ${data.error}`);
  }
  
  // Build recommendations
  const recommendations = [];
  
  if (!data.experiences || data.experiences.length === 0) {
    recommendations.push('⚠️ Limited data available - LinkedIn restricts automated access to profiles');
    recommendations.push('💡 To get full analysis, consider: (1) Make profile public, (2) Provide manual data');
  } else {
    if (data.experiences.length < 3) {
      recommendations.push('Add more detailed work experience to strengthen profile');
    }
    
    if (!data.skills || data.skills.length < 10) {
      recommendations.push('Add more skills to increase profile visibility (aim for 10+)');
    }
    
    if (!data.about || data.about.length < 50) {
      recommendations.push('Enhance "About" section with detailed professional summary');
    }
    
    recommendations.push('Request recommendations from colleagues and supervisors');
    recommendations.push('Share industry-relevant content regularly to increase visibility');
    recommendations.push('Engage with your network through comments and posts');
  }
  
  return {
    platform: 'LinkedIn',
    timestamp: timestamp,
    profile: {
      name: data.name,
      headline: data.headline,
      location: data.location,
      about: data.about,
      profileUrl: data.profileUrl,
      connections: data.connections
    },
    statistics: {
      connections: data.connections,
      experienceCount: data.experiences?.length || 0,
      skillsCount: data.skills?.length || 0
    },
    accountHealth: {
      overallScore: calculateLinkedInHealth(data),
      rating: data.experiences?.length >= 3 ? 'Good' : data.experiences?.length >= 1 ? 'Fair' : 'Limited',
      factors: [
        `Profile Completeness: ${calculateProfileCompleteness(data)}%`,
        `Professional Experience: ${data.experiences?.length || 0} positions`,
        `Skills Listed: ${data.skills?.length || 0}`,
        `Network Size: ${data.connections}`
      ]
    },
    analysis: {
      professionalLevel: professionalLevel,
      industryFocus: industryFocus,
      careerStage: careerStage,
      profileCompleteness: `${calculateProfileCompleteness(data)}%`,
      networkStrength: data.connections.includes('+') ? 'Strong' : 'Growing'
    },
    experience: (data.experiences || []).map(exp => ({
      title: exp.title,
      company: exp.company,
      duration: exp.duration
    })),
    skills: data.skills || [],
    insights: insights,
    recommendations: recommendations,
    contentAnalysis: {
      contentTypes: {
        'Experience Entries': data.experiences?.length || 0,
        'Skills Listed': data.skills?.length || 0,
        'About Section': data.about && data.about.length > 50 ? 'Detailed' : 'Basic'
      },
      sentimentDistribution: {
        positive: '0%',
        neutral: '100%',
        negative: '0%'
      }
    }
  };
}

function calculateLinkedInHealth(data) {
  let score = 50; // Base score
  
  if (data.name && data.name !== 'N/A') score += 10;
  if (data.headline && data.headline.length > 10) score += 10;
  if (data.about && data.about.length > 100) score += 10;
  if (data.experiences && data.experiences.length > 0) score += 10;
  if (data.experiences && data.experiences.length >= 3) score += 5;
  if (data.skills && data.skills.length >= 5) score += 5;
  
  return Math.min(score, 100);
}

function calculateProfileCompleteness(data) {
  let completeness = 0;
  const totalFields = 7;
  
  if (data.name && data.name !== 'N/A') completeness++;
  if (data.headline && data.headline.length > 10) completeness++;
  if (data.about && data.about.length > 50) completeness++;
  if (data.location && data.location !== 'Not specified') completeness++;
  if (data.experiences && data.experiences.length > 0) completeness++;
  if (data.skills && data.skills.length >= 3) completeness++;
  if (data.profileImage) completeness++;
  
  return Math.round((completeness / totalFields) * 100);
}

function determineProfessionalLevel(data) {
  const expCount = data.experiences.length;
  if (expCount >= 5) return 'Senior Professional';
  if (expCount >= 3) return 'Mid-Level Professional';
  if (expCount >= 1) return 'Early Career Professional';
  return 'Entry Level / Student';
}

function extractIndustry(headline) {
  const industries = ['Technology', 'Finance', 'Marketing', 'Healthcare', 'Education', 'Engineering'];
  const headlineLower = headline.toLowerCase();
  
  for (const industry of industries) {
    if (headlineLower.includes(industry.toLowerCase())) {
      return industry;
    }
  }
  return 'Various Industries';
}

function determineCareerStage(experiences) {
  const totalExperiences = experiences.length;
  if (totalExperiences >= 5) return 'Experienced (5+ positions)';
  if (totalExperiences >= 3) return 'Mid-Career (3-4 positions)';
  if (totalExperiences >= 1) return 'Early Career (1-2 positions)';
  return 'Starting Career';
}

function generateLinkedInInsights(data) {
  return [
    `Professional with ${data.experiences.length} documented experience(s)`,
    `${data.skills.length} skills listed`,
    `Current focus: ${data.headline}`,
    `Network size: ${data.connections} connections`,
    `Location: ${data.location}`
  ];
}

function generateLinkedInRecommendations(data) {
  const recommendations = [];
  
  if (data.skills.length < 10) {
    recommendations.push('Add more skills to increase profile visibility');
  }
  
  if (!data.about || data.about.length < 50) {
    recommendations.push('Enhance "About" section with detailed professional summary');
  }
  
  recommendations.push('Request recommendations from colleagues');
  recommendations.push('Share industry-relevant content regularly');
  
  return recommendations;
}

module.exports = { generateReport };