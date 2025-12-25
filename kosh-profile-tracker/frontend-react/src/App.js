import React, { useState } from 'react';
import './App.css';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

function App() {
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const analyzeProfile = async () => {
    if (!handle.trim()) {
      showNotification('Please enter a profile handle or URL', 'error');
      return;
    }

    setLoading(true);
    setReport(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze`, {
        handle: handle.trim(),
        platform: selectedPlatform
      });

      if (response.data.success) {
        setReport(response.data.report);
        setPdfUrl(response.data.pdfUrl);
        showNotification('✅ Comprehensive report generated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification(
        error.response?.data?.message || 'Failed to analyze profile. Please try again.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      analyzeProfile();
    }
  };

  const downloadPdf = () => {
    if (pdfUrl) {
      window.open(`${API_BASE_URL}${pdfUrl}`, '_blank');
    }
  };

  const getPlaceholder = () => {
    return selectedPlatform === 'twitter'
      ? 'e.g., @elonmusk or elonmusk'
      : 'e.g., linkedin.com/in/username or username';
  };

  return (
    <div className="App">
      <div className="stars"></div>
      
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="container">
        <header className="header">
          <div className="logo-container">
            <div className="logo-3d">
              <span className="logo-text">K</span>
            </div>
            <h1 className="title">Kosh Profile Tracker</h1>
          </div>
          <p className="subtitle">Advanced Social Media Intelligence & Deep Analysis</p>
        </header>

        <div className="main-content">
          <div className="input-section glass-card">
            <h2 className="section-title">🔍 Profile Deep Scan</h2>

            <div className="platform-selector">
              <button
                className={`platform-btn ${selectedPlatform === 'twitter' ? 'active' : ''}`}
                onClick={() => setSelectedPlatform('twitter')}
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Twitter
              </button>
              <button
                className={`platform-btn ${selectedPlatform === 'linkedin' ? 'active' : ''}`}
                onClick={() => setSelectedPlatform('linkedin')}
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </button>
            </div>

            <div className="input-group">
              <label htmlFor="profileHandle" className="input-label">
                Profile Handle / URL
              </label>
              <input
                type="text"
                id="profileHandle"
                className="profile-input"
                placeholder={getPlaceholder()}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>

            <button
              className="analyze-btn"
              onClick={analyzeProfile}
              disabled={loading}
            >
              <span className="btn-text">
                {loading ? '🔄 Analyzing...' : '🚀 Generate Deep Report'}
              </span>
              <span className="btn-icon">→</span>
            </button>

            {loading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p className="loading-text">Performing deep analysis...</p>
                <p className="loading-subtext">Scraping profile, analyzing behavior, detecting patterns...</p>
              </div>
            )}
          </div>

          {report && (
            <div className="report-section">
              <div className="report-header glass-card">
                <div>
                  <h2 className="report-title">📊 Comprehensive Analysis Report</h2>
                  <p className="report-subtitle">Generated {new Date(report.timestamp).toLocaleString()}</p>
                </div>
                <button className="download-btn" onClick={downloadPdf}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  Download PDF Report
                </button>
              </div>

              <div className="report-content">
                {/* Profile Overview */}
                <ProfileCard profile={report.profile} />

                {/* Account Health Score */}
                {report.accountHealth && (
                  <HealthScoreCard health={report.accountHealth} />
                )}

                {/* Suspicious Activity Warning */}
                {report.suspiciousActivity && report.suspiciousActivity.hasSuspiciousPatterns && (
                  <SuspiciousActivityCard activity={report.suspiciousActivity} />
                )}

                {/* Statistics */}
                <StatisticsCard stats={report.statistics} />

                {/* Behavior Analysis */}
                {report.behaviorAnalysis && (
                  <BehaviorAnalysisCard behavior={report.behaviorAnalysis} />
                )}

                {/* Content Analysis */}
                {report.contentAnalysis && (
                  <ContentAnalysisCard content={report.contentAnalysis} />
                )}

                {/* Engagement Analysis */}
                {report.engagementAnalysis && (
                  <EngagementAnalysisCard engagement={report.engagementAnalysis} />
                )}

                {/* Recent Activity */}
                {report.recentActivity?.tweets && (
                  <RecentActivityCard activity={report.recentActivity} />
                )}

                {/* Experience (LinkedIn) */}
                {report.experience && (
                  <ExperienceCard experiences={report.experience} />
                )}

                {/* Skills (LinkedIn) */}
                {report.skills && report.skills.length > 0 && (
                  <SkillsCard skills={report.skills} />
                )}

                {/* Key Insights */}
                <InsightsCard title="🎯 Key Insights" items={report.insights} type="insight" />

                {/* Recommendations */}
                <InsightsCard title="💡 Recommendations" items={report.recommendations} type="recommendation" />

                {/* Warnings */}
                {report.warnings && report.warnings.length > 0 && (
                  <InsightsCard title="⚠️ Warnings" items={report.warnings} type="warning" />
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="footer">
          <p>© 2024 Kosh Profile Tracker | Educational & Research Use Only</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7 }}>
            Deep behavioral analysis • Suspicious activity detection • Engagement metrics
          </p>
        </footer>
      </div>
    </div>
  );
}

// Enhanced Components

function ProfileCard({ profile }) {
  return (
    <div className="report-card glass-card highlight-card">
      <div className="card-header">
        <h3>👤 Profile Overview</h3>
        {profile.verified && <span className="verified-badge">✓ Verified</span>}
      </div>
      <div className="info-grid">
        <InfoItem label="Name" value={profile.name} />
        <InfoItem label="Handle" value={profile.handle} />
        <InfoItem label="Location" value={profile.location} />
        <InfoItem label="Website" value={profile.website} />
        <InfoItem label="Joined" value={profile.joinDate} />
        <InfoItem label="Account Age" value={profile.accountAge} />
      </div>
      {profile.bio && (
        <div className="bio-section">
          <div className="info-label">Bio</div>
          <p className="bio-text">{profile.bio}</p>
        </div>
      )}
    </div>
  );
}

function HealthScoreCard({ health }) {
  const getScoreColor = (score) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#fb923c';
    return '#ef4444';
  };

  return (
    <div className="report-card glass-card health-card">
      <h3>🏆 Account Health Score</h3>
      <div className="health-score-container">
        <div className="score-circle" style={{ '--score-color': getScoreColor(health.overallScore) }}>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={getScoreColor(health.overallScore)}
              strokeWidth="8"
              strokeDasharray={`${health.overallScore * 2.827} 283`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="score-text">
            <div className="score-number">{health.overallScore}</div>
            <div className="score-label">{health.rating}</div>
          </div>
        </div>
        <div className="health-factors">
          <h4>Score Breakdown:</h4>
          <ul>
            {health.factors.map((factor, idx) => (
              <li key={idx}>{factor}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SuspiciousActivityCard({ activity }) {
  const getRiskColor = (level) => {
    if (level === 'High') return '#ef4444';
    if (level === 'Medium') return '#fbbf24';
    return '#4ade80';
  };

  return (
    <div className="report-card glass-card warning-card" style={{ borderLeft: `5px solid ${getRiskColor(activity.riskLevel)}` }}>
      <h3>⚠️ Suspicious Activity Detection</h3>
      <div className="risk-level" style={{ color: getRiskColor(activity.riskLevel) }}>
        Risk Level: <strong>{activity.riskLevel}</strong>
      </div>
      <div className="flags-container">
        <h4>🚩 Detected Flags ({activity.flags.length}):</h4>
        <ul className="flags-list">
          {activity.flags.map((flag, idx) => (
            <li key={idx} className="flag-item">{flag}</li>
          ))}
        </ul>
      </div>
      <div className="details-container">
        <h4>📋 Detailed Analysis:</h4>
        <ul className="details-list">
          {activity.details.map((detail, idx) => (
            <li key={idx}>{detail}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatisticsCard({ stats }) {
  return (
    <div className="report-card glass-card">
      <h3>📈 Key Statistics</h3>
      <div className="stats-grid">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="stat-item">
            <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="stat-label">{formatKey(key)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BehaviorAnalysisCard({ behavior }) {
  return (
    <div className="report-card glass-card">
      <h3>🎭 Behavioral Analysis</h3>
      <div className="behavior-grid">
        <div className="behavior-item">
          <span className="behavior-icon">👤</span>
          <div>
            <div className="behavior-label">Account Type</div>
            <div className="behavior-value">{behavior.accountType}</div>
          </div>
        </div>
        <div className="behavior-item">
          <span className="behavior-icon">📊</span>
          <div>
            <div className="behavior-label">Activity Pattern</div>
            <div className="behavior-value">{behavior.activityPattern}</div>
          </div>
        </div>
        <div className="behavior-item">
          <span className="behavior-icon">⏰</span>
          <div>
            <div className="behavior-label">Peak Activity</div>
            <div className="behavior-value">{behavior.peakActivityTimes}</div>
          </div>
        </div>
        <div className="behavior-item">
          <span className="behavior-icon">🎯</span>
          <div>
            <div className="behavior-label">Consistency</div>
            <div className="behavior-value">{behavior.consistencyScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentAnalysisCard({ content }) {
  return (
    <div className="report-card glass-card">
      <h3>📝 Content Analysis</h3>
      
      <div className="content-section">
        <h4>Content Types Distribution</h4>
        <div className="content-types">
          {Object.entries(content.contentTypes).map(([type, count]) => (
            <div key={type} className="content-type-item">
              <span>{formatKey(type)}</span>
              <span className="count-badge">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="content-section">
        <h4>Sentiment Analysis</h4>
        <div className="sentiment-bars">
          <div className="sentiment-bar">
            <span>😊 Positive</span>
            <div className="bar-container">
              <div className="bar positive" style={{ width: content.sentimentDistribution.positive }}></div>
              <span className="percentage">{content.sentimentDistribution.positive}</span>
            </div>
          </div>
          <div className="sentiment-bar">
            <span>😐 Neutral</span>
            <div className="bar-container">
              <div className="bar neutral" style={{ width: content.sentimentDistribution.neutral }}></div>
              <span className="percentage">{content.sentimentDistribution.neutral}</span>
            </div>
          </div>
          <div className="sentiment-bar">
            <span>😞 Negative</span>
            <div className="bar-container">
              <div className="bar negative" style={{ width: content.sentimentDistribution.negative }}></div>
              <span className="percentage">{content.sentimentDistribution.negative}</span>
            </div>
          </div>
        </div>
      </div>

      {content.hashtagUsage && content.hashtagUsage.topHashtags.length > 0 && (
        <div className="content-section">
          <h4>Top Hashtags</h4>
          <div className="tag-cloud">
            {content.hashtagUsage.topHashtags.map((tag, idx) => (
              <span key={idx} className="tag-item">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {content.mentionPattern && content.mentionPattern.topMentions.length > 0 && (
        <div className="content-section">
          <h4>Most Mentioned</h4>
          <div className="tag-cloud">
            {content.mentionPattern.topMentions.map((mention, idx) => (
              <span key={idx} className="tag-item mention">{mention}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EngagementAnalysisCard({ engagement }) {
  return (
    <div className="report-card glass-card">
      <h3>💬 Engagement Analysis</h3>
      
      <div className="engagement-stats">
        <div className="engagement-stat">
          <div className="stat-icon">❤️</div>
          <div className="stat-info">
            <div className="stat-number">{engagement.averageLikes.toLocaleString()}</div>
            <div className="stat-description">Avg Likes</div>
          </div>
        </div>
        <div className="engagement-stat">
          <div className="stat-icon">🔁</div>
          <div className="stat-info">
            <div className="stat-number">{engagement.averageRetweets.toLocaleString()}</div>
            <div className="stat-description">Avg Retweets</div>
          </div>
        </div>
        <div className="engagement-stat">
          <div className="stat-icon">💬</div>
          <div className="stat-info">
            <div className="stat-number">{engagement.averageReplies.toLocaleString()}</div>
            <div className="stat-description">Avg Replies</div>
          </div>
        </div>
        <div className="engagement-stat">
          <div className="stat-icon">👁️</div>
          <div className="stat-info">
            <div className="stat-number">{engagement.averageViews.toLocaleString()}</div>
            <div className="stat-description">Avg Views</div>
          </div>
        </div>
      </div>

      <div className="engagement-metrics">
        <div className="metric">
          <span className="metric-label">Engagement Rate:</span>
          <span className="metric-value highlight">{engagement.engagementRate}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Virality Score:</span>
          <span className="metric-value">{engagement.viralityScore}</span>
        </div>
      </div>

      {engagement.topPerformingTweets && engagement.topPerformingTweets.length > 0 && (
        <div className="top-tweets">
          <h4>🔥 Top Performing Tweets</h4>
          {engagement.topPerformingTweets.map((tweet, idx) => (
            <div key={idx} className="top-tweet">
              <p className="tweet-text">{tweet.text}</p>
              <div className="tweet-metrics">
                <span>❤️ {tweet.likes}</span>
                <span>🔁 {tweet.retweets}</span>
                <span>💬 {tweet.replies}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentActivityCard({ activity }) {
  return (
    <div className="report-card glass-card">
      <h3>📱 Recent Activity</h3>
      <p className="activity-summary">{activity.summary}</p>
      <div className="tweets-list">
        {activity.tweets.map((tweet, idx) => (
          <div key={idx} className="tweet-card">
            <p className="tweet-content">{tweet.content}</p>
            <div className="tweet-footer">
              <span className="tweet-time">
                🕒 {new Date(tweet.timestamp).toLocaleString()}
              </span>
              <div className="tweet-engagement">
                <span>❤️ {tweet.engagement.likes}</span>
                <span>🔁 {tweet.engagement.retweets}</span>
                <span>💬 {tweet.engagement.replies}</span>
                {tweet.engagement.views !== '0' && <span>👁️ {tweet.engagement.views}</span>}
              </div>
            </div>
            {tweet.metadata && (
              <div className="tweet-metadata">
                {tweet.metadata.hasImage && <span className="badge">🖼️ Image</span>}
                {tweet.metadata.hasVideo && <span className="badge">🎥 Video</span>}
                {tweet.metadata.hasLink && <span className="badge">🔗 Link</span>}
                {tweet.metadata.isReply && <span className="badge">💬 Reply</span>}
                {tweet.metadata.isRetweet && <span className="badge">🔁 Retweet</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExperienceCard({ experiences }) {
  return (
    <div className="report-card glass-card">
      <h3>💼 Professional Experience</h3>
      {experiences.map((exp, idx) => (
        <div key={idx} className="experience-item">
          <div className="exp-title">{exp.title}</div>
          <div className="exp-company">{exp.company}</div>
          <div className="exp-duration">{exp.duration}</div>
        </div>
      ))}
    </div>
  );
}

function SkillsCard({ skills }) {
  return (
    <div className="report-card glass-card">
      <h3>🛠️ Skills</h3>
      <div className="skills-cloud">
        {skills.map((skill, idx) => (
          <span key={idx} className="skill-tag">{skill}</span>
        ))}
      </div>
    </div>
  );
}

function InsightsCard({ title, items, type }) {
  return (
    <div className={`report-card glass-card ${type}-card`}>
      <h3>{title}</h3>
      <ul className="insights-list">
        {items.map((item, idx) => (
          <li key={idx} className="insight-item">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <div className="info-label">{label}</div>
      <div className="info-value">{value || 'N/A'}</div>
    </div>
  );
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export default App;