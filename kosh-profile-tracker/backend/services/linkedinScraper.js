const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeProfile(profileUrl) {
  let browser;
  
  try {
    // Clean and validate URL
    let url = profileUrl;
    if (!url.startsWith('http')) {
      // Extract username from various formats
      const username = url.replace(/^.*\/in\//, '').replace(/\/$/, '').split('/')[0].split('?')[0];
      url = `https://www.linkedin.com/in/${username}`;
    }

    console.log(`🔍 Scraping LinkedIn profile: ${url}`);

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to profile
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll to load more content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Extract profile data
    const profileData = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };

      const getAll = (selector) => {
        return Array.from(document.querySelectorAll(selector)).map(el => el.textContent.trim());
      };

      // Try multiple selectors for robustness
      const name = getText('h1.text-heading-xlarge') || 
                   getText('h1') || 
                   getText('.pv-text-details__left-panel h1') ||
                   getText('[class*="profile-info"] h1');
                   
      const headline = getText('.text-body-medium') || 
                      getText('.pv-text-details__left-panel .text-body-medium') ||
                      getText('[class*="headline"]');
                      
      const location = getText('.text-body-small.inline.t-black--light.break-words') ||
                      getText('[class*="location"]') ||
                      getText('.pv-text-details__left-panel .pb2 .text-body-small');
                      
      const about = getText('#about ~ div .inline-show-more-text') ||
                   getText('[class*="about"] [class*="display-flex"]') ||
                   getText('.pv-about__summary-text');

      // Try to get experience
      const experiences = [];
      const expSections = document.querySelectorAll('#experience ~ div li, [id*="experience"] li');
      
      expSections.forEach((item) => {
        try {
          const titleEl = item.querySelector('[class*="profile-section-card__title"], [class*="t-bold"] span:first-child');
          const companyEl = item.querySelector('[class*="profile-section-card__subtitle"], [class*="t-normal"]');
          const durationEl = item.querySelector('[class*="date-range"], .pvs-entity__caption-wrapper');
          
          const title = titleEl ? titleEl.textContent.trim() : '';
          const company = companyEl ? companyEl.textContent.trim() : '';
          const duration = durationEl ? durationEl.textContent.trim() : '';
          
          if (title && title.length > 0) {
            experiences.push({ title, company, duration });
          }
        } catch (e) {
          // Skip this entry
        }
      });

      // Try to get skills
      const skills = [];
      const skillElements = document.querySelectorAll(
        '#skills ~ div [class*="skill"] span[aria-hidden="true"],' +
        '[id*="skill"] [class*="entity__title"],' +
        '.pv-skill-category-entity__name'
      );
      
      skillElements.forEach(el => {
        const skill = el.textContent.trim();
        if (skill && skill.length > 0 && !skill.includes('•') && skill.length < 50) {
          skills.push(skill);
        }
      });

      // Get connections (if visible)
      const connectionsText = getText('[class*="link-without-visited-state"] span') ||
                             getText('.pv-top-card--list li') ||
                             '500+';

      // Get profile photo
      const profileImage = document.querySelector('img.pv-top-card-profile-picture__image, img[class*="profile-photo"]')?.src || '';

      return {
        name: name || 'N/A',
        headline: headline || 'No headline',
        location: location || 'Not specified',
        about: about || 'No about section',
        connections: connectionsText,
        experiences: experiences.slice(0, 10),
        skills: Array.from(new Set(skills)).slice(0, 20),
        profileUrl: window.location.href,
        profileImage: profileImage
      };
    });

    // Validate that we got meaningful data
    if (!profileData.name || profileData.name === 'N/A') {
      throw new Error('Unable to extract profile data - profile may be private or LinkedIn blocked the request');
    }

    console.log(`✅ LinkedIn scraping successful - Found ${profileData.experiences.length} experiences, ${profileData.skills.length} skills`);
    return profileData;

  } catch (error) {
    console.error('❌ LinkedIn scraping error:', error.message);
    
    // Return minimal data instead of throwing
    return {
      name: 'LinkedIn Profile',
      handle: profileUrl,
      headline: 'Unable to access full profile',
      location: 'LinkedIn restricts automated access',
      about: 'LinkedIn requires authentication to view full profiles. This limitation is expected.',
      connections: 'N/A',
      experiences: [],
      skills: [],
      profileUrl: profileUrl,
      profileImage: '',
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeProfile };