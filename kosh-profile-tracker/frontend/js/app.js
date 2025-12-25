const API_BASE_URL = 'http://localhost:3000';

let selectedPlatform = 'twitter';
let currentPdfUrl = '';

// DOM Elements
const platformButtons = document.querySelectorAll('.platform-btn');
const profileInput = document.getElementById('profileHandle');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const reportSection = document.getElementById('reportSection');
const reportContent = document.getElementById('reportContent');
const downloadPdfBtn = document.getElementById('downloadPdf');

// Event Listeners
platformButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        platformButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPlatform = btn.dataset.platform;
        updatePlaceholder();
    });
});

analyzeBtn.addEventListener('click', analyzeProfile);

profileInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        analyzeProfile();
    }
});

downloadPdfBtn.addEventListener('click', () => {
    if (currentPdfUrl) {
        window.open(API_BASE_URL + currentPdfUrl, '_blank');
    }
});

// Functions
function updatePlaceholder() {
    if (selectedPlatform === 'twitter') {
        profileInput.placeholder = 'e.g., @elonmusk or elonmusk';
    } else {
        profileInput.placeholder = 'e.g., linkedin.com/in/username or username';
    }
}

async function analyzeProfile() {
    const handle = profileInput.value.trim();

    if (!handle) {
        showNotification('Please enter a profile handle or URL', 'error');
        return;
    }

    // Show loading
    analyzeBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');
    reportSection.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                handle: handle,
                platform: selectedPlatform
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            displayReport(data.report);
            currentPdfUrl = data.pdfUrl;
            showNotification('Report generated successfully!', 'success');
        } else {
            throw new Error(data.message || 'Failed to analyze profile');
        }

    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message || 'Failed to analyze profile. Please try again.', 'error');
    } finally {
        analyzeBtn.disabled = false;
        loadingIndicator.classList.add('hidden');
    }
}

function displayReport(report) {
    reportContent.innerHTML = '';

    // Profile Section
    const profileCard = createReportCard('Profile Information', report.profile);
    reportContent.appendChild(profileCard);

    // Statistics Section
    const statsCard = createReportCard('Statistics', report.statistics);
    reportContent.appendChild(statsCard);

    // Analysis Section
    const analysisCard = createReportCard('Analysis', report.analysis);
    reportContent.appendChild(analysisCard);

    // Recent Activity (Twitter only)
    if (report.recentActivity && report.recentActivity.tweets) {
        const activityCard = createActivityCard(report.recentActivity);
        reportContent.appendChild(activityCard);
    }

    // Experience (LinkedIn only)
    if (report.experience) {
        const experienceCard = createExperienceCard(report.experience);
        reportContent.appendChild(experienceCard);
    }

    // Skills (LinkedIn only)
    if (report.skills && report.skills.length > 0) {
        const skillsCard = createSkillsCard(report.skills);
        reportContent.appendChild(skillsCard);
    }

    // Insights Section
    const insightsCard = createListCard('Key Insights', report.insights, 'insight-list');
    reportContent.appendChild(insightsCard);

    // Recommendations Section
    const recommendationsCard = createListCard('Recommendations', report.recommendations, 'recommendation-list');
    reportContent.appendChild(recommendationsCard);

    // Show report section
    reportSection.classList.remove('hidden');
    reportSection.scrollIntoView({ behavior: 'smooth' });
}

function createReportCard(title, data) {
    const card = document.createElement('div');
    card.className = 'report-card glass-card';

    const heading = document.createElement('h3');
    heading.textContent = title;
    card.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'info-grid';

    Object.entries(data).forEach(([key, value]) => {
        if (typeof value !== 'object') {
            const item = createInfoItem(formatKey(key), value);
            grid.appendChild(item);
        }
    });

    card.appendChild(grid);
    return card;
}

function createInfoItem(label, value) {
    const item = document.createElement('div');
    item.className = 'info-item';

    const labelEl = document.createElement('div');
    labelEl.className = 'info-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'info-value';
    valueEl.textContent = value || 'N/A';

    item.appendChild(labelEl);
    item.appendChild(valueEl);

    return item;
}

function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'report-card glass-card';

    const heading = document.createElement('h3');
    heading.textContent = 'Recent Activity';
    card.appendChild(heading);

    const summary = document.createElement('p');
    summary.textContent = activity.summary;
    summary.style.marginBottom = '1.5rem';
    summary.style.opacity = '0.9';
    card.appendChild(summary);

    activity.tweets.forEach(tweet => {
        const tweetDiv = document.createElement('div');
        tweetDiv.className = 'info-item';
        tweetDiv.style.marginBottom = '1rem';

        const content = document.createElement('p');
        content.textContent = tweet.content;
        content.style.marginBottom = '0.5rem';

        const meta = document.createElement('p');
        meta.style.fontSize = '0.85rem';
        meta.style.opacity = '0.7';
        meta.textContent = `Posted: ${new Date(tweet.timestamp).toLocaleDateString()} | ${tweet.metrics}`;

        tweetDiv.appendChild(content);
        tweetDiv.appendChild(meta);
        card.appendChild(tweetDiv);
    });

    return card;
}

function createExperienceCard(experiences) {
    const card = document.createElement('div');
    card.className = 'report-card glass-card';

    const heading = document.createElement('h3');
    heading.textContent = 'Professional Experience';
    card.appendChild(heading);

    experiences.forEach(exp => {
        const expDiv = document.createElement('div');
        expDiv.className = 'info-item';
        expDiv.style.marginBottom = '1rem';

        const title = document.createElement('div');
        title.style.fontWeight = '600';
        title.style.fontSize = '1.1rem';
        title.textContent = exp.title;

        const company = document.createElement('div');
        company.style.color = 'var(--accent)';
        company.style.marginTop = '0.3rem';
        company.textContent = exp.company;

        const duration = document.createElement('div');
        duration.style.fontSize = '0.9rem';
        duration.style.opacity = '0.7';
        duration.style.marginTop = '0.3rem';
        duration.textContent = exp.duration;

        expDiv.appendChild(title);
        expDiv.appendChild(company);
        expDiv.appendChild(duration);
        card.appendChild(expDiv);
    });

    return card;
}

function createSkillsCard(skills) {
    const card = document.createElement('div');
    card.className = 'report-card glass-card';

    const heading = document.createElement('h3');
    heading.textContent = 'Skills';
    card.appendChild(heading);

    const skillsContainer = document.createElement('div');
    skillsContainer.style.display = 'flex';
    skillsContainer.style.flexWrap = 'wrap';
    skillsContainer.style.gap = '0.8rem';

    skills.forEach(skill => {
        const skillTag = document.createElement('span');
        skillTag.style.padding = '0.5rem 1rem';
        skillTag.style.background = 'rgba(255, 255, 255, 0.1)';
        skillTag.style.borderRadius = '20px';
        skillTag.style.fontSize = '0.9rem';
        skillTag.textContent = skill;
        skillsContainer.appendChild(skillTag);
    });

    card.appendChild(skillsContainer);
    return card;
}

function createListCard(title, items, className) {
    const card = document.createElement('div');
    card.className = 'report-card glass-card';

    const heading = document.createElement('h3');
    heading.textContent = title;
    card.appendChild(heading);

    const list = document.createElement('ul');
    list.className = className;

    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });

    card.appendChild(list);
    return card;
}

function formatKey(key) {
    return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '1rem 1.5rem';
    notification.style.borderRadius = '10px';
    notification.style.color = 'white';
    notification.style.fontWeight = '600';
    notification.style.zIndex = '1000';
    notification.style.animation = 'fadeInDown 0.5s ease';
    notification.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';

    if (type === 'success') {
        notification.style.background = 'var(--success)';
    } else if (type === 'error') {
        notification.style.background = '#ef4444';
    } else {
        notification.style.background = 'var(--primary)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Initialize
updatePlaceholder();
console.log('🚀 Kosh Profile Tracker initialized');