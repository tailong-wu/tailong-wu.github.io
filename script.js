/**
 * Main JavaScript for Tailong Wu's Portfolio
 * Inspired by ericwu.me design style
 */

// =====================================================
// Internationalization (i18n) System
// =====================================================
const translations = {
    en: {
        // Page Title
        pageTitle: 'Tailong Wu - Robotics Researcher',
        metaDescription: 'Personal website and portfolio of Tailong Wu - Robotics researcher focused on Vision-Language-Action (VLA) and Agents. Mathematical modeling competition award winner.',
        
        // Tab Navigation
        tabAll: 'All',
        tabAbout: 'About',
        tabProjects: 'Projects',
        tabContact: 'Contact',
        
        // Avatar Card
        statusBadge: 'Available for work',
        greeting: `Hey! I'm <span class="name-highlight">Tailong Wu</span>, I work on robotics, and I'm currently focused on research in Vision-Language-Action (VLA) and Agents. I also have experience in mathematical modeling competitions, with several awards to my name.`,
        
        // Tech Stack Card
        techStack: 'Tech Stack',
        techHTML: 'HTML',
        techCSS: 'CSS',
        techJS: 'JavaScript',
        techPython: 'Python',
        techGit: 'Git',
        techReact: 'React',
        
        // Location Card
        locationLabel: 'Based in',
        locationValue: 'Hangzhou, China',
        
        // Stats Card
        statRepos: 'Repositories',
        statCommits: 'Commits',
        viewGithub: 'View GitHub Profile',
        
        // Projects
        projectPortfolioTitle: 'Personal Portfolio',
        projectPortfolioDesc: "This website you're looking at!",
        projectWebAppsTitle: 'Web Applications',
        projectWebAppsDesc: 'Various web projects',
        viewSource: 'View Source',
        explore: 'Explore',
        
        // Current Focus
        focusLabel: 'Currently focused on',
        focusTitle: 'Vision-Language-Action (VLA) & Agents',
        focusDesc: 'Researching at the intersection of robotics, vision-language models, and intelligent agent systems.',
        
        // Contact Card
        contactTitle: 'Get in Touch',
        contactText: 'Feel free to reach out for collaborations, opportunities, or just a friendly chat!',
        
        // Awards
        awardsTitle: 'Awards & Achievements',
        award1Title: 'First Prize',
        award1Event: 'China Graduate Mathematical Modeling Contest - Garden Aesthetics Modeling',
        award2Title: 'First Prize (Meritorious Winner)',
        award2Event: 'MCM/ICM - Used Sailboat Price Prediction and Regional Impact Factors',
        award3Title: 'Second Prize (Honorable Mention)',
        award3Event: 'MCM/ICM - Stock & Gold/Bitcoin Investment Strategy Research',
        award4Title: 'First Prize',
        award4Event: 'China University Risk Control Challenge - Corporate Bankruptcy Risk Prediction',
        
        // Footer
        footer: '&copy; 2024 Tailong Wu. Built with passion.'
    },
    zh: {
        // 页面标题
        pageTitle: '吴泰龙 - 机器人研究者',
        metaDescription: '吴泰龙的个人网站和作品集 - 专注于视觉-语言-动作(VLA)和智能体研究的机器人研究者。数学建模竞赛获奖者。',
        
        // 标签导航
        tabAll: '全部',
        tabAbout: '关于',
        tabProjects: '项目',
        tabContact: '联系',
        
        // 头像卡片
        statusBadge: '求职中',
        greeting: '你好！我是<span class="name-highlight">吴泰龙</span>，我从事机器人研究，目前专注于视觉-语言-动作(VLA)和智能体方向的研究。我在数学建模竞赛方面也有丰富经验，曾获得多个奖项。',
        
        // 技术栈卡片
        techStack: '技术栈',
        techHTML: 'HTML',
        techCSS: 'CSS',
        techJS: 'JavaScript',
        techPython: 'Python',
        techGit: 'Git',
        techReact: 'React',
        
        // 位置卡片
        locationLabel: '所在地',
        locationValue: '中国杭州',
        
        // 统计卡片
        statRepos: '代码仓库',
        statCommits: '提交次数',
        viewGithub: '查看 GitHub 主页',
        
        // 项目
        projectPortfolioTitle: '个人作品集',
        projectPortfolioDesc: '你正在浏览的这个网站！',
        projectWebAppsTitle: 'Web 应用',
        projectWebAppsDesc: '各类 Web 项目',
        viewSource: '查看源码',
        explore: '探索更多',
        
        // 当前焦点
        focusLabel: '当前研究方向',
        focusTitle: '视觉-语言-动作 (VLA) 与智能体',
        focusDesc: '在机器人、视觉语言模型和智能体系统的交叉领域进行研究。',
        
        // 联系卡片
        contactTitle: '联系我',
        contactText: '欢迎就合作、机会或友好交流与我联系！',
        
        // 奖项
        awardsTitle: '荣誉奖项',
        award1Title: '一等奖',
        award1Event: '中国研究生数学建模竞赛 - 园林美学建模',
        award2Title: '一等奖 (Meritorious Winner)',
        award2Event: 'MCM/ICM - 二手帆船价格预测与区域影响因素',
        award3Title: '二等奖 (Honorable Mention)',
        award3Event: 'MCM/ICM - 股票与黄金/比特币投资策略研究',
        award4Title: '一等奖',
        award4Event: '中国大学生风险控制挑战赛 - 企业破产风险预测',
        
        // 页脚
        footer: '&copy; 2024 吴泰龙. 用心构建。'
    }
};

// Current language
let currentLang = localStorage.getItem('lang') || 'en';

// =====================================================
// DOM Elements
// =====================================================
const themeToggle = document.getElementById('themeToggle');
const langToggle = document.getElementById('langToggle');
const tabs = document.querySelectorAll('.tab');
const bentoCards = document.querySelectorAll('.bento-card');
const statValues = document.querySelectorAll('.stat-value');

// =====================================================
// Language Toggle
// =====================================================
function initLanguage() {
    const savedLang = localStorage.getItem('lang');
    if (savedLang) {
        currentLang = savedLang;
    } else {
        // Default to English
        currentLang = 'en';
    }
    updateLanguage(currentLang);
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    localStorage.setItem('lang', currentLang);
    updateLanguage(currentLang);
}

function updateLanguage(lang) {
    const t = translations[lang];
    
    // Update page title
    document.title = t.pageTitle;
    
    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', t.metaDescription);
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    
    // Update tabs
    const tabAll = document.querySelector('[data-tab="all"]');
    const tabAbout = document.querySelector('[data-tab="about"]');
    const tabProjects = document.querySelector('[data-tab="projects"]');
    const tabContact = document.querySelector('[data-tab="contact"]');
    
    if (tabAll) tabAll.textContent = t.tabAll;
    if (tabAbout) tabAbout.textContent = t.tabAbout;
    if (tabProjects) tabProjects.textContent = t.tabProjects;
    if (tabContact) tabContact.textContent = t.tabContact;
    
    // Update status badge
    const statusBadge = document.querySelector('.status-badge span:last-child');
    if (statusBadge) statusBadge.textContent = t.statusBadge;
    
    // Update greeting
    const greeting = document.querySelector('.greeting');
    if (greeting) greeting.innerHTML = t.greeting;
    
    // Update tech stack title
    const techStackTitle = document.querySelector('.bento-card[data-category="about"] .card-header h3');
    if (techStackTitle) techStackTitle.textContent = t.techStack;
    
    // Update location
    const locationLabel = document.querySelector('.location-label');
    const locationValue = document.querySelector('.location-value');
    if (locationLabel) locationLabel.textContent = t.locationLabel;
    if (locationValue) locationValue.textContent = t.locationValue;
    
    // Update stats
    const statLabels = document.querySelectorAll('.stat-label');
    if (statLabels[0]) statLabels[0].textContent = t.statRepos;
    if (statLabels[1]) statLabels[1].textContent = t.statCommits;
    
    const githubLink = document.querySelector('.github-link span');
    if (githubLink) githubLink.textContent = t.viewGithub;
    
    // Update projects
    const projectTitles = document.querySelectorAll('.project-info h3');
    const projectDescs = document.querySelectorAll('.project-info p');
    
    if (projectTitles[0]) projectTitles[0].textContent = t.projectPortfolioTitle;
    if (projectDescs[0]) projectDescs[0].textContent = t.projectPortfolioDesc;
    if (projectTitles[1]) projectTitles[1].textContent = t.projectWebAppsTitle;
    if (projectDescs[1]) projectDescs[1].textContent = t.projectWebAppsDesc;
    
    const projectLinks = document.querySelectorAll('.project-link');
    if (projectLinks[0]) projectLinks[0].innerHTML = `${t.viewSource}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    if (projectLinks[1]) projectLinks[1].innerHTML = `${t.explore}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    
    // Update focus card
    const focusLabel = document.querySelector('.focus-label');
    const focusTitle = document.querySelector('.focus-title');
    const focusDesc = document.querySelector('.focus-desc');
    if (focusLabel) focusLabel.textContent = t.focusLabel;
    if (focusTitle) focusTitle.textContent = t.focusTitle;
    if (focusDesc) focusDesc.textContent = t.focusDesc;
    
    // Update contact
    const contactHeader = document.querySelector('.bento-card[data-category="contact"] .card-header h3');
    if (contactHeader) contactHeader.textContent = t.contactTitle;
    
    const contactText = document.querySelector('.contact-text');
    if (contactText) contactText.textContent = t.contactText;
    
    // Update awards
    const awardsTitle = document.querySelector('.awards-list').closest('.bento-card').querySelector('.card-header h3');
    if (awardsTitle) awardsTitle.textContent = t.awardsTitle;
    
    const awardTitles = document.querySelectorAll('.award-title');
    const awardEvents = document.querySelectorAll('.award-event');
    
    if (awardTitles[0]) awardTitles[0].textContent = t.award1Title;
    if (awardEvents[0]) awardEvents[0].textContent = t.award1Event;
    if (awardTitles[1]) awardTitles[1].textContent = t.award2Title;
    if (awardEvents[1]) awardEvents[1].textContent = t.award2Event;
    if (awardTitles[2]) awardTitles[2].textContent = t.award3Title;
    if (awardEvents[2]) awardEvents[2].textContent = t.award3Event;
    if (awardTitles[3]) awardTitles[3].textContent = t.award4Title;
    if (awardEvents[3]) awardEvents[3].textContent = t.award4Event;
    
    // Update footer
    const footer = document.querySelector('.footer p');
    if (footer) footer.innerHTML = t.footer;
    
    // Update language toggle button text
    const langText = document.querySelector('.lang-text');
    if (langText) {
        langText.textContent = lang === 'en' ? '中文' : 'EN';
    }
}

// =====================================================
// Theme Toggle
// =====================================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// =====================================================
// Tab Navigation
// =====================================================
function initTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            // Filter cards
            const selectedTab = tab.dataset.tab;
            filterCards(selectedTab);
        });
    });
}

function filterCards(category) {
    bentoCards.forEach((card, index) => {
        const cardCategory = card.dataset.category;

        // Add staggered animation delay
        card.style.animationDelay = `${index * 0.05}s`;

        if (category === 'all' || cardCategory === category) {
            card.classList.remove('hidden');
            // Re-trigger animation
            card.style.animation = 'none';
            card.offsetHeight; // Trigger reflow
            card.style.animation = `fadeInUp 0.5s ease forwards ${index * 0.05}s`;
        } else {
            card.classList.add('hidden');
        }
    });
}

// =====================================================
// Counter Animation
// =====================================================
function animateCounters() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.dataset.count);
                animateValue(counter, 0, target, 1500);
                observer.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });

    statValues.forEach(counter => observer.observe(counter));
}

function animateValue(element, start, end, duration) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (end - start) * easeOutQuart);

        element.textContent = current + '+';

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// =====================================================
// Hover Effects
// =====================================================
function initHoverEffects() {
    const cards = document.querySelectorAll('.bento-card');

    cards.forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// =====================================================
// Smooth Scroll for Anchor Links
// =====================================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// =====================================================
// Parallax Effect for Cards (Subtle)
// =====================================================
function initParallax() {
    const cards = document.querySelectorAll('.bento-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// =====================================================
// Initialize
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguage();
    initTabs();
    animateCounters();
    initHoverEffects();
    initSmoothScroll();

    // Optional: Enable parallax effect (comment out if too heavy)
    // initParallax();
});

// Event Listeners
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

if (langToggle) {
    langToggle.addEventListener('click', toggleLanguage);
}

// =====================================================
// Keyboard Accessibility
// =====================================================
document.addEventListener('keydown', (e) => {
    // Tab navigation with arrow keys
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const activeTab = document.querySelector('.tab.active');
        const tabsArray = Array.from(tabs);
        const currentIndex = tabsArray.indexOf(activeTab);

        let newIndex;
        if (e.key === 'ArrowRight') {
            newIndex = (currentIndex + 1) % tabsArray.length;
        } else {
            newIndex = (currentIndex - 1 + tabsArray.length) % tabsArray.length;
        }

        tabsArray[newIndex].click();
        tabsArray[newIndex].focus();
    }
});
