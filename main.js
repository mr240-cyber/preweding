document.addEventListener('DOMContentLoaded', async () => {
  const db = window.db;
  const auth = window.auth;

  async function syncDB(key) {
    if (!db) return;
    try {
      const doc = await db.collection('settings').doc(key).get();
      if (doc.exists) {
        localStorage.setItem(key, doc.data().data);
      }
    } catch (e) {
      console.error("Firebase sync error:", e);
    }
  }

  // Fetch all latest data from Firestore before rendering
  await syncDB('appMenus');
  await syncDB('appPackages');
  await syncDB('appContent');
  await syncDB('appPortfolio');
  await syncDB('validAccessCodes');

  // Sync client photos specifically for the logged-in user
  const currentClientPhone = localStorage.getItem('currentClientPhone');
  if (currentClientPhone && db) {
    try {
      // Sync Raw Photos
      let rawDoc = await db.collection('clientRawPhotos').doc(currentClientPhone).get();
      if (rawDoc.exists) {
        const rawMap = JSON.parse(localStorage.getItem('clientRawPhotos') || '{}');
        rawMap[currentClientPhone] = rawDoc.data().photos;
        localStorage.setItem('clientRawPhotos', JSON.stringify(rawMap));
      }

      // Sync Edited Photos
      let editedDoc = await db.collection('clientEditedPhotos').doc(currentClientPhone).get();
      if (editedDoc.exists) {
        const editedMap = JSON.parse(localStorage.getItem('clientEditedPhotos') || '{}');
        editedMap[currentClientPhone] = editedDoc.data().photos;
        localStorage.setItem('clientEditedPhotos', JSON.stringify(editedMap));
      }
    } catch (e) {
      console.error("Firebase photo sync error:", e);
    }
  }


  // Intersection Observer for scroll animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Select all elements to animate
  const animatedElements = document.querySelectorAll('.fade-up');
  animatedElements.forEach(el => observer.observe(el));

  // Navigation Active State and Dynamic Menus
  const currentLocation = location.pathname;
  const navLinksContainer = document.querySelector('.nav-links');

  if (navLinksContainer) {
    if (true) { // Force update
      const defaultMenus = [
        { name: 'Beranda', link: '/' },
        { name: 'Portofolio', link: '/portfolio.html' },
        { name: 'Client Area', link: '/client-login.html' }
      ];
      localStorage.setItem('appMenus', JSON.stringify(defaultMenus));
    }

    // Clear hardcoded menus
    navLinksContainer.innerHTML = '';

    // Render Menus
    const appMenus = JSON.parse(localStorage.getItem('appMenus') || '[]');
    appMenus.forEach(menu => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = menu.link;
      a.textContent = menu.name;

      // Determine active state
      if (currentLocation === menu.link || (currentLocation === '/' && menu.link === '/index.html')) {
        a.classList.add('active');
      }
      // Special case for root
      if (currentLocation === '/index.html' && menu.link === '/') {
        a.classList.add('active');
      }

      li.appendChild(a);
      navLinksContainer.appendChild(li);
    });

    // Add Logout menu and Auth Guard
    if (auth) {
      auth.onAuthStateChanged((user) => {
        if (user) {
          const logoutLi = document.createElement('li');
          const logoutBtn = document.createElement('a');
          logoutBtn.href = '#';
          logoutBtn.textContent = 'Logout';
          logoutBtn.style.color = 'var(--primary-color)';
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = '/');
          });
          logoutLi.appendChild(logoutBtn);
          navLinksContainer.appendChild(logoutLi);
        }

        // Auth Guard for Booking page
        if (currentLocation === '/booking.html' || currentLocation.includes('booking.html')) {
          const authContainer = document.getElementById('authContainer');
          const bookingContainer = document.getElementById('bookingContainer');

          if (!user) {
            if (authContainer) authContainer.style.display = 'block';
            if (bookingContainer) bookingContainer.style.display = 'none';
          } else {
            if (authContainer) authContainer.style.display = 'none';
            if (bookingContainer) bookingContainer.style.display = 'block';

            const emailInput = document.getElementById('email');
            const nameInput = document.getElementById('name');
            if (emailInput) {
              emailInput.value = user.email;
              emailInput.readOnly = true;
            }
            if (nameInput && user.displayName && !nameInput.value) {
              nameInput.value = user.displayName;
            }
          }
        }
      });
    }
  }

  // Simple Booking Form Submission
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = bookingForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      btn.textContent = 'Memproses...';
      btn.disabled = true;

      // Ambil data form
      const bookingData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        date: document.getElementById('date').value,
        location: document.getElementById('location').value,
        packageId: document.getElementById('package').value,
        message: document.getElementById('message').value,
        bookingDate: new Date().toLocaleDateString('id-ID')
      };


      // Simpan ke localStorage untuk ditampilkan di invoice
      localStorage.setItem('recentBooking', JSON.stringify(bookingData));

      // Save directly to Firestore allBookings
      if (db) {
        try {
          const docRef = await db.collection('settings').doc('allBookings').get();
          let bookings = [];
          if (docRef.exists) bookings = JSON.parse(docRef.data().data);
          bookings.push(bookingData);
          await db.collection('settings').doc('allBookings').set({ data: JSON.stringify(bookings) });
        } catch (e) {
          console.error("Error saving booking to Firestore", e);
        }
      }

      // Simulate API call and redirect

      setTimeout(() => {
        window.location.href = '/invoice.html?type=dp';
      }, 1000);
    });
  }

  // ========== DYNAMIC PORTFOLIO RENDER ==========
  const galleryGrid = document.querySelector('.gallery-grid:not(#clientGalleryGrid)');
  if (galleryGrid) {
    const isHomePage = (currentLocation === '/' || currentLocation === '/index.html');

    let appPortfolio = JSON.parse(localStorage.getItem('appPortfolio'));
    if (!appPortfolio) {
      appPortfolio = [
        { url: '/assets/portfolio_1.png', title: 'Sunset Romance' },
        { url: '/assets/portfolio_2.png', title: 'Urban ber.kesaan' },
        { url: '/assets/hero.png', title: 'Mountain Love' },
        { url: '/assets/portfolio_1.png', title: 'Vintage Vibes' },
        { url: '/assets/portfolio_2.png', title: 'Studio Session' },
        { url: '/assets/hero.png', title: 'Beach Prewedding' }
      ];
      localStorage.setItem('appPortfolio', JSON.stringify(appPortfolio));
    }

    galleryGrid.innerHTML = '';

    // limit to 3 if homepage
    const itemsToRender = isHomePage ? appPortfolio.slice(0, 3) : appPortfolio;

    itemsToRender.forEach((photo, index) => {
      // Calculate a slight delay for fade-up animation
      const delay = (index % 3) * 0.2;

      const div = document.createElement('div');
      div.className = 'gallery-item fade-up';
      div.style.transitionDelay = `${delay}s`;
      div.innerHTML = `
        <img src="${photo.url}" alt="${photo.title}">
        <div class="gallery-overlay">
          <span>${photo.title}</span>
        </div>
      `;
      galleryGrid.appendChild(div);
      // Observe the new element for animation
      observer.observe(div);
    });
  }

  // ========== DYNAMIC PACKAGES RENDER ==========
  // Load Default Packages if not exist
  let appPackages = JSON.parse(localStorage.getItem('appPackages'));
  if (!appPackages) {
    appPackages = [
      { id: 'basic', name: 'Basic Package', price: 3500000, features: ['Sesi 4 Jam', '1 Lokasi (Outdoor)', '50 Foto Edit', 'Semua File Original'] },
      { id: 'premium', name: 'Premium Package', price: 7000000, features: ['Sesi Seharian (8 Jam)', '2 Lokasi (Indoor & Outdoor)', '100 Foto Edit', 'Cetak Album Kolase 20 Halaman', 'Semua File Original'] },
      { id: 'cinematic', name: 'Cinematic Package', price: 12000000, features: ['Sesi Seharian (12 Jam)', '3 Lokasi Bebas', 'Semua Foto Edit Resolusi Tinggi', 'Cetak Album Premium Eksklusif', 'Video Cinematic 3 Menit', 'Semua File Original'] }
    ];
    localStorage.setItem('appPackages', JSON.stringify(appPackages));
  }

  // 1. Render to Booking Form Select Options
  const packageSelect = document.querySelector('select[name="package"]');
  if (packageSelect) {
    packageSelect.innerHTML = '<option value="">Pilih Paket...</option>';
    appPackages.forEach(pkg => {
      const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(pkg.price);
      const option = document.createElement('option');
      option.value = `${pkg.name} - ${formattedPrice}`;
      option.textContent = `${pkg.name} - ${formattedPrice}`;
      packageSelect.appendChild(option);
    });
  }

  // 2. Render to Services Grid (Homepage)
  const servicesGrid = document.querySelector('.services-grid');
  if (servicesGrid) {
    servicesGrid.innerHTML = '';
    appPackages.forEach((pkg, index) => {
      const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(pkg.price);
      const delay = index * 0.2;

      const featuresHTML = pkg.features.map(f => `<li>${f}</li>`).join('');

      const div = document.createElement('div');
      div.className = 'service-card fade-up';
      div.style.transitionDelay = `${delay}s`;
      div.innerHTML = `
        <h3>${pkg.name}</h3>
        <p class="price">${formattedPrice}</p>
        <ul class="features">
          ${featuresHTML}
        </ul>
        <a href="/booking.html?package=${pkg.id}" class="btn">Pilih Paket</a>
      `;
      servicesGrid.appendChild(div);
      observer.observe(div);
    });
  }

  // ========== DYNAMIC CONTENT CMS RENDER ==========
  let appContent = JSON.parse(localStorage.getItem('appContent'));
  if (!appContent) {
    appContent = {
      heroTitle: 'Abadikan Kisah Cinta Anda',
      heroSubtitle: 'Fotografi prewedding eksklusif untuk momen yang tak terlupakan. Kami merangkai setiap senyuman dan pandangan menjadi mahakarya visual.',
      feature1Title: 'Konsep Eksklusif',
      feature1Desc: 'Setiap pasangan memiliki cerita unik. Kami merancang konsep foto yang secara personal mencerminkan perjalanan cinta Anda.',
      feature2Title: 'Fotografer Profesional',
      feature2Desc: 'Tim ahli kami berpengalaman menangkap emosi nyata dan momen candid dengan kualitas sinematik tertinggi.',
      feature3Title: 'Directing & Styling',
      feature3Desc: 'Tidak perlu khawatir jika tidak terbiasa di depan kamera. Kami akan mengarahkan pose dan gaya agar terlihat natural.',
      footerDesc: 'Premium Prewedding Photography Studio',
      footerCopyright: '© 2026 ber.kesaan Photography. All rights reserved.'
    };
    localStorage.setItem('appContent', JSON.stringify(appContent));
  }

  // Inject into Hero (if exists)
  const heroTitle = document.querySelector('.hero-content h1');
  const heroSubtitle = document.querySelector('.hero-content p');
  if (heroTitle) heroTitle.textContent = appContent.heroTitle;
  if (heroSubtitle) heroSubtitle.textContent = appContent.heroSubtitle;

  // Inject into Features (if exists)
  const featureCards = document.querySelectorAll('.features-grid .feature-card');
  if (featureCards.length >= 3) {
    featureCards[0].querySelector('h3').textContent = appContent.feature1Title;
    featureCards[0].querySelector('p').textContent = appContent.feature1Desc;
    featureCards[1].querySelector('h3').textContent = appContent.feature2Title;
    featureCards[1].querySelector('p').textContent = appContent.feature2Desc;
    featureCards[2].querySelector('h3').textContent = appContent.feature3Title;
    featureCards[2].querySelector('p').textContent = appContent.feature3Desc;
  }

  // Inject into Footer
  const footerDesc = document.querySelector('footer .footer-content p:first-of-type');
  const footerCopy = document.querySelector('footer .footer-bottom p');
  if (footerDesc) footerDesc.textContent = appContent.footerDesc;
  if (footerCopy) footerCopy.innerHTML = appContent.footerCopyright;

  // ========== MOBILE HAMBURGER MENU ==========
  const nav = document.querySelector('nav');
  const navLinks = document.querySelector('.nav-links');
  if (nav && navLinks) {
    const hamburger = document.createElement('div');
    hamburger.className = 'hamburger-menu';
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    nav.insertBefore(hamburger, navLinks.nextSibling);

    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      hamburger.classList.toggle('active');
    });
  }

});
