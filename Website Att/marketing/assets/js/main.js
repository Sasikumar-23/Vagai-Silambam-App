/**
 * Vagai Silambam Marketing Website
 * Interactive behaviors, scroll animations, counters, tabs, and pricing toggle
 */

document.addEventListener('DOMContentLoaded', () => {
  initScrollProgress();
  initNavbar();
  initScrollReveal();
  initHeroCounters();
  initProductShowcaseTabs();
  initAttendanceDemo();
  initPricingToggle();
  initFaqAccordion();
});

/* 1. Scroll Progress Bar */
function initScrollProgress() {
  const progressBar = document.getElementById('scrollProgressBar');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  }, { passive: true });
}

/* 2. Sticky Navbar & Mobile Menu */
function initNavbar() {
  const header = document.querySelector('.site-header');
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('siteNavMenu');
  const MOBILE_BREAKPOINT = 768;

  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  if (!mobileToggle || !navMenu) return;

  // The mobile dropdown is position:fixed so it can cover the viewport. In this engine,
  // a position:sticky ancestor (.site-header) breaks that: the panel gets confined to the
  // header's own small box instead of the full screen, instead of being viewport-relative.
  // Moving the menu to be a direct child of <body> while open sidesteps that, then it is
  // moved back to its original spot (inside .site-header) on close so desktop layout -
  // where it is a normal flex item next to the logo - is untouched.
  const originalParent = navMenu.parentNode;

  const openMenu = () => {
    document.body.appendChild(navMenu);
    mobileToggle.setAttribute('aria-expanded', 'true');
    mobileToggle.classList.add('open');
    navMenu.classList.add('open');
    document.body.classList.add('menu-open');
  };

  const closeMenu = () => {
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.classList.remove('open');
    navMenu.classList.remove('open');
    document.body.classList.remove('menu-open');
    originalParent.appendChild(navMenu);
  };

  mobileToggle.addEventListener('click', () => {
    if (navMenu.classList.contains('open')) closeMenu(); else openMenu();
  });

  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Rotating a tablet past the mobile breakpoint while the menu is open must not leave
  // it fixed-positioned and reparented underneath a desktop-width layout.
  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_BREAKPOINT && navMenu.classList.contains('open')) {
      closeMenu();
    }
  });
}

/* 3. Scroll Reveal System using IntersectionObserver */
function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
      el.classList.add('revealed');
    });
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        
        // If element has counters inside, trigger them
        const counters = entry.target.querySelectorAll('.counter[data-target]');
        counters.forEach(c => runCounter(c));

        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.15
  });

  document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    observer.observe(el);
  });
}

/* 4. Number Counters */
function runCounter(el) {
  if (el.dataset.counted === 'true') return;
  el.dataset.counted = 'true';

  const target = parseFloat(el.getAttribute('data-target'));
  const prefix = el.getAttribute('data-prefix') || '';
  const suffix = el.getAttribute('data-suffix') || '';
  const duration = 1400; // ms
  const frameRate = 1000 / 60;
  const totalFrames = Math.round(duration / frameRate);
  let frame = 0;

  const timer = setInterval(() => {
    frame++;
    const progress = easeOutExpo(frame / totalFrames);
    const current = Math.round(progress * target);

    el.textContent = `${prefix}${current.toLocaleString('en-IN')}${suffix}`;

    if (frame === totalFrames) {
      clearInterval(timer);
      el.textContent = `${prefix}${target.toLocaleString('en-IN')}${suffix}`;
    }
  }, frameRate);
}

function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/* 5. Live SaaS Dashboard Counter Updates (Hero Simulation) */
function initHeroCounters() {
  const studentCard = document.getElementById('heroStudentCount');
  const attendanceCard = document.getElementById('heroAttendanceRate');
  const liveTicker = document.getElementById('heroLiveTicker');

  if (!studentCard || !attendanceCard) return;

  // After 2.6s, simulate real-time check-in
  setTimeout(() => {
    if (studentCard) {
      studentCard.classList.add('updating');
      studentCard.textContent = '249';
      setTimeout(() => studentCard.classList.remove('updating'), 800);
    }
    
    if (attendanceCard) {
      attendanceCard.classList.add('updating');
      attendanceCard.textContent = '94%';
      setTimeout(() => attendanceCard.classList.remove('updating'), 800);
    }

    if (liveTicker) {
      liveTicker.innerHTML = `<span class="ticker-pulse"></span> <span class="tamil-text">கவின் ராஜ்</span> marked <strong class="badge-present">Present ✓</strong> at 06:14 AM (Morning Batch)`;
      liveTicker.classList.add('flash');
      setTimeout(() => liveTicker.classList.remove('flash'), 1200);
    }
  }, 2600);
}

/* 6. Product Showcase Tabs */
function initProductShowcaseTabs() {
  const tabs = document.querySelectorAll('.showcase-tab-btn');
  const panels = document.querySelectorAll('.showcase-panel');

  if (!tabs.length || !panels.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

/* 7. Interactive Attendance Demo Simulator */
function initAttendanceDemo() {
  const demoButtons = document.querySelectorAll('.student-status-btn');
  const markAllBtn = document.getElementById('markAllPresentBtn');
  const presentCount = document.getElementById('demoPresentCount');
  const absentCount = document.getElementById('demoAbsentCount');
  const lateCount = document.getElementById('demoLateCount');
  const leaveCount = document.getElementById('demoLeaveCount');

  function updateCounts() {
    let p = 0, a = 0, l = 0, lv = 0;
    document.querySelectorAll('.demo-student-row').forEach(row => {
      const status = row.getAttribute('data-status');
      if (status === 'present') p++;
      else if (status === 'absent') a++;
      else if (status === 'late') l++;
      else if (status === 'leave') lv++;
    });

    if (presentCount) presentCount.textContent = (80 + p);
    if (absentCount) absentCount.textContent = (4 + a);
    if (lateCount) lateCount.textContent = (3 + l);
    if (leaveCount) leaveCount.textContent = (2 + lv);
  }

  demoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.demo-student-row');
      if (!row) return;

      const newStatus = btn.getAttribute('data-set-status');
      row.setAttribute('data-status', newStatus);

      row.querySelectorAll('.student-status-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateCounts();
    });
  });

  if (markAllBtn) {
    markAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.demo-student-row').forEach(row => {
        row.setAttribute('data-status', 'present');
        row.querySelectorAll('.student-status-btn').forEach(b => {
          if (b.getAttribute('data-set-status') === 'present') {
            b.classList.add('selected');
          } else {
            b.classList.remove('selected');
          }
        });
      });
      updateCounts();
      markAllBtn.textContent = '✓ All 40 Batch Students Present';
      markAllBtn.style.background = '#059669';
      setTimeout(() => {
        markAllBtn.textContent = 'Mark Whole Batch Present';
        markAllBtn.style.background = '';
      }, 2200);
    });
  }
}

/* 8. Pricing Toggle (Monthly / Annual) */
function initPricingToggle() {
  const toggle = document.getElementById('billingToggle');
  if (!toggle) return;

  const starterPrice = document.getElementById('price-starter');
  const standardPrice = document.getElementById('price-standard');
  const proPrice = document.getElementById('price-pro');
  const businessPrice = document.getElementById('price-biz');

  const starterPeriod = document.getElementById('period-starter');
  const standardPeriod = document.getElementById('period-standard');
  const proPeriod = document.getElementById('period-pro');
  const businessPeriod = document.getElementById('period-biz');

  const savingsNotes = document.querySelectorAll('.plan-savings-tag');

  toggle.addEventListener('change', () => {
    const isAnnual = toggle.checked;

    if (isAnnual) {
      if (starterPrice) starterPrice.textContent = '₹4,999';
      if (standardPrice) standardPrice.textContent = '₹9,999';
      if (proPrice) proPrice.textContent = '₹14,999';
      if (businessPrice) businessPrice.textContent = '₹24,999';

      [starterPeriod, standardPeriod, proPeriod, businessPeriod].forEach(p => {
        if (p) p.textContent = ' / year';
      });

      savingsNotes.forEach(tag => tag.style.opacity = '1');
    } else {
      if (starterPrice) starterPrice.textContent = '₹499';
      if (standardPrice) standardPrice.textContent = '₹999';
      if (proPrice) proPrice.textContent = '₹1,499';
      if (businessPrice) businessPrice.textContent = '₹2,499';

      [starterPeriod, standardPeriod, proPeriod, businessPeriod].forEach(p => {
        if (p) p.textContent = ' / month';
      });

      savingsNotes.forEach(tag => tag.style.opacity = '0');
    }
  });
}

/* 9. FAQ Accordion */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-accordion details');
  faqItems.forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        faqItems.forEach(other => {
          if (other !== item && other.open) {
            other.removeAttribute('open');
          }
        });
      }
    });
  });
}
