/**
 * Main JavaScript for Tailong Wu's Portfolio
 * Inspired by ericwu.me design style
 */

// =====================================================
// DOM Elements
// =====================================================
const themeToggle = document.getElementById('themeToggle');
const tabs = document.querySelectorAll('.tab');
const bentoCards = document.querySelectorAll('.bento-card');
const statValues = document.querySelectorAll('.stat-value');

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
