document.addEventListener('DOMContentLoaded', () => {
  const auth = window.auth;
  const db = window.db;
  const loginOverlay = document.getElementById('admin-login-overlay');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('loginError');

  auth.onAuthStateChanged(user => {
    if (user) {
      if(loginOverlay) loginOverlay.style.display = 'none';
      initAdminData();
    } else {
      if(loginOverlay) loginOverlay.style.display = 'flex';
    }
  });

  if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmail').value;
      const pass = document.getElementById('adminPassword').value;
      auth.signInWithEmailAndPassword(email, pass).catch(err => {
        loginError.textContent = 'Login gagal: ' + err.message;
        loginError.style.display = 'block';
      });
    });
  }

  // Wrapper to save data to Firestore
  async function saveToDB(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data)); // keep local cache updated synchronously
      await db.collection('settings').doc(key).set({ data: JSON.stringify(data) });
    } catch(e) {
      console.error('Error saving ' + key, e);
      throw e;
    }
  }

  // Wrapper to load data from Firestore
  async function loadFromDB(key) {
    try {
      if (key === 'clientRawPhotos' || key === 'clientEditedPhotos') {
        const snapshot = await db.collection(key).get();
        const dataMap = {};
        snapshot.forEach(doc => {
          dataMap[doc.id] = doc.data().data || doc.data().photos || [];
        });
        localStorage.setItem(key, JSON.stringify(dataMap));
        return dataMap;
      }

      const doc = await db.collection('settings').doc(key).get();
      if(doc.exists) {
        const dataStr = doc.data().data;
        localStorage.setItem(key, dataStr); // update cache
        return JSON.parse(dataStr);
      }
    } catch(e) {
      console.error('Error loading ' + key, e);
    }
    return JSON.parse(localStorage.getItem(key) || 'null');
  }

  async function initAdminData() {
    await loadFromDB('appPackages');
    await loadFromDB('appContent');
    await loadFromDB('appMenus');
    await loadFromDB('appPortfolio');
    await loadFromDB('allBookings');
    await loadFromDB('clientRawPhotos');
    await loadFromDB('clientEditedPhotos');
    await loadFromDB('clientSelectedPhotos');
    await loadFromDB('validAccessCodes');
    
    loadBookings();
    loadPackages();
    loadMenus();
    loadPortfolio();
    loadContentCMS();
  }

  // Logout function
  window.logoutAdmin = () => {
    auth.signOut();
  };

  
  // Tab Switching Logic
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.admin-section');
  const pageTitle = document.getElementById('page-title');

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove active class
      navBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.add('d-none'));

      // Add active class to clicked
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.remove('d-none');
      pageTitle.textContent = btn.textContent;
    });
  });

  // ========== BOOKINGS MANAGEMENT ==========
  const loadBookings = () => {
    const tbody = document.getElementById('bookings-table-body');
    const recentBookingStr = localStorage.getItem('recentBooking');
    const allBookings = localStorage.getItem('allBookings');
    
    let bookings = [];
    if(allBookings) bookings = JSON.parse(allBookings);
    
    // For demo: if there is a recent booking not in allBookings, add it
    if (recentBookingStr) {
      const recent = JSON.parse(recentBookingStr);
      // check if already exists by phone
      if(!bookings.find(b => b.phone === recent.phone)) {
        bookings.push(recent);
        saveToDB('allBookings', bookings);
      }
    }

    tbody.innerHTML = '';
    
    if(bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Belum ada booking.</td></tr>';
      return;
    }

    const validCodes = JSON.parse(localStorage.getItem('validAccessCodes') || '{}');

    bookings.forEach((booking, index) => {
      const code = validCodes[booking.phone] || '-';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${booking.name}</strong><br><small>${booking.phone}</small></td>
        <td>${booking.date}</td>
        <td>${booking.packageId}</td>
        <td><strong>${code}</strong></td>
        <td>
          <button class="btn-admin" style="background:#f39c12; margin-right:5px; margin-bottom:5px;" onclick="viewClientDetail('${booking.phone}')">Detail</button>
          <button class="btn-admin" style="background:#8e44ad; margin-right:5px; margin-bottom:5px;" onclick="openUploadModal('${booking.phone}', '${booking.name}')">Kelola Foto</button>
          <button class="btn-admin" style="background:#3498db; margin-right:5px; margin-bottom:5px;" onclick="viewClientSelections('${booking.phone}', '${booking.name}')">Lihat Pilihan</button><br>
          ${code === '-' ? `<button class="btn-admin success" onclick="generateCode('${booking.phone}')">Generate Code</button>` : `<button class="btn-admin" onclick="alert('Kode telah dibuat dan aktif')">Terkonfirmasi</button>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  // View Client Details
  window.viewClientDetail = (phone) => {
    const allBookings = JSON.parse(localStorage.getItem('allBookings') || '[]');
    const booking = allBookings.find(b => b.phone === phone);
    if(booking) {
      alert(`Detail Pelanggan:\n\nNama: ${booking.name}\nEmail: ${booking.email}\nNo HP: ${booking.phone}\nTanggal Sesi: ${booking.date}\nLokasi/Konsep: ${booking.location || '-'}\nPaket: ${booking.packageId}\nPesan: ${booking.message || '-'}`);
    }
  };

  // ========== CLIENT PHOTO UPLOAD ==========
  const uploadModal = document.getElementById('uploadModal');
  const uploadClientPhone = document.getElementById('uploadClientPhone');
  const uploadModalTitle = document.getElementById('uploadModalTitle');
  const currentClientLink = document.getElementById('currentClientLink');
  const clientPhotoForm = document.getElementById('clientPhotoForm');

  window.openUploadModal = (phone, name) => {
    uploadClientPhone.value = phone;
    uploadModalTitle.textContent = `Kelola Foto untuk ${name}`;
    renderClientPhotos(phone);
    uploadModal.classList.remove('d-none');
  };

  window.closeUploadModal = () => {
    uploadModal.classList.add('d-none');
  };

  const currentClientRawLink = document.getElementById('currentClientRawLink');
  const currentClientEditedLink = document.getElementById('currentClientEditedLink');

  const renderClientPhotos = (phone) => {
    const rawPhotos = JSON.parse(localStorage.getItem('clientRawPhotos') || '{}')[phone] || [];
    const editedPhotos = JSON.parse(localStorage.getItem('clientEditedPhotos') || '{}')[phone] || [];
    
    currentClientRawLink.innerHTML = '';
    currentClientEditedLink.innerHTML = '';
    
    if (rawPhotos.length === 0) {
      currentClientRawLink.innerHTML = '<em>Belum ada foto mentah.</em>';
    } else {
      rawPhotos.forEach((item, idx) => {
        const url = typeof item === 'string' ? item : item.url;
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
          <img src="${url}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
          <button onclick="deleteClientPhoto('${phone}', ${idx}, 'raw')" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px;">X</button>
        `;
        currentClientRawLink.appendChild(div);
      });
    }

    if (editedPhotos.length === 0) {
      currentClientEditedLink.innerHTML = '<em>Belum ada foto hasil edit.</em>';
    } else {
      editedPhotos.forEach((item, idx) => {
        const url = typeof item === 'string' ? item : item.url;
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
          <img src="${url}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
          <button onclick="deleteClientPhoto('${phone}', ${idx}, 'edited')" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px;">X</button>
        `;
        currentClientEditedLink.appendChild(div);
      });
    }
  };

  if(clientPhotoForm) {
    clientPhotoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = uploadClientPhone.value;
      const fileInput = document.getElementById('clientPhotoFile');
      const category = document.getElementById('clientPhotoCategory').value;
      const files = fileInput.files;
      const fileCount = files.length;
      if (fileCount === 0) return;

      const btn = document.getElementById('btnUploadClient');
      btn.textContent = `Mengupload ${fileCount} foto...`;
      btn.disabled = true;

      const storageKey = category === 'raw' ? 'clientRawPhotos' : 'clientEditedPhotos';
      const photosMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (!photosMap[phone]) photosMap[phone] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const base64 = await readFileAsBase64(file);
          photosMap[phone].push({
            url: base64,
            name: file.name
          });
        }
        
        // Simpan ke localStorage
        localStorage.setItem(storageKey, JSON.stringify(photosMap));
        
        // Simpan ke Firestore (Pisahkan per klien agar tidak melebihi limit 1MB per dokumen)
        await db.collection(storageKey).doc(phone).set({ photos: photosMap[phone] });
        
        fileInput.value = '';
        renderClientPhotos(phone);
        alert(`${fileCount} foto berhasil ditambahkan ke ${category === 'raw' ? 'Mentah' : 'Hasil Edit'}!`);
      } catch(err) {
        console.error(err);
        alert('Upload gagal! Gambar terlalu besar atau format tidak didukung. Coba unggah sedikit demi sedikit (maksimal 5 foto sekali upload).');
      } finally {
        btn.textContent = 'Upload Foto';
        btn.disabled = false;
      }
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Kompresi ketat agar tidak memakan storage berlebih (Maks 1000px)
          const MAX_SIZE = 1000;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert ke jpeg dengan kualitas 60%
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => reject(new Error("Format gambar tidak didukung"));
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.deleteClientPhoto = async (phone, idx, category) => {
    const storageKey = category === 'raw' ? 'clientRawPhotos' : 'clientEditedPhotos';
    const photosMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (photosMap[phone]) {
      photosMap[phone].splice(idx, 1);
      
      // Update lokal
      localStorage.setItem(storageKey, JSON.stringify(photosMap));
      
      // Update DB
      try {
        await db.collection(storageKey).doc(phone).set({ photos: photosMap[phone] });
      } catch(e) {
        console.error("Gagal menghapus dari DB", e);
      }
      
      renderClientPhotos(phone);
    }
  };

  // Selections Logic
  const selectionsModal = document.getElementById('selectionsModal');
  const selectionsGrid = document.getElementById('clientSelectionsGrid');
  const selectionsModalTitle = document.getElementById('selectionsModalTitle');

  window.viewClientSelections = (phone, name) => {
    selectionsModalTitle.textContent = `Pilihan Foto: ${name}`;
    
    // Fetch selected photos from allBookings
    const allBookings = JSON.parse(localStorage.getItem('allBookings') || '[]');
    const booking = allBookings.find(b => b.phone === phone);
    const selectedPhotos = (booking && booking.selections) ? booking.selections : [];
    
    selectionsGrid.innerHTML = '';
    
    if (selectedPhotos.length === 0) {
      selectionsGrid.innerHTML = '<p style="grid-column: 1/-1;">Klien belum memilih foto apa pun.</p>';
    } else {
      const rawPhotosMap = JSON.parse(localStorage.getItem('clientRawPhotos') || '{}');
      const rawPhotos = rawPhotosMap[phone] || [];
      
      selectedPhotos.forEach(item => {
        // Cari URL gambar asli berdasarkan namanya
        let url = item.url;
        if (!url) {
          const found = rawPhotos.find(p => (typeof p === 'string' ? p : p.name) === item.name);
          if (found) url = typeof found === 'string' ? found : found.url;
        }
        
        const div = document.createElement('div');
        div.style.border = '1px solid #ddd';
        div.style.padding = '10px';
        div.style.borderRadius = '4px';
        div.innerHTML = `
          <img src="${url || ''}" style="width:100%; height:150px; object-fit:cover; border-radius:4px; margin-bottom: 10px; background:#f0f0f0;">
          <div style="font-size: 0.9rem;">
            <strong>Nama File:</strong><br>
            ${item.name || '-'}
          </div>
        `;
        selectionsGrid.appendChild(div);
      });
    }
    
    selectionsModal.classList.remove('d-none');
  };

  window.closeSelectionsModal = () => {
    selectionsModal.classList.add('d-none');
  };

  // Expose to window so onclick can use it
  window.generateCode = (phone) => {
    const code = 'ELG-' + Math.floor(1000 + Math.random() * 9000);
    const validCodes = JSON.parse(localStorage.getItem('validAccessCodes') || '{}');
    validCodes[phone] = code;
    saveToDB('validAccessCodes', validCodes);
    loadBookings();
    alert(`Kode akses ${code} berhasil dibuat! Klien sekarang bisa login.`);
  };

  // ========== PACKAGES MANAGEMENT ==========
  const loadPackages = () => {
    const tbody = document.getElementById('packages-table-body');
    
    // Initialize default if empty
    if(!localStorage.getItem('appPackages')) {
      const defaultPackages = [
        { id: 'basic', name: 'Basic Package', price: 3500000, features: ['Sesi 4 Jam', '1 Lokasi (Outdoor)', '50 Foto Edit', 'Semua File Original'] },
        { id: 'premium', name: 'Premium Package', price: 7000000, features: ['Sesi Seharian (8 Jam)', '2 Lokasi (Indoor & Outdoor)', '100 Foto Edit', 'Cetak Album Kolase 20 Halaman', 'Semua File Original'] },
        { id: 'cinematic', name: 'Cinematic Package', price: 12000000, features: ['Sesi Seharian (12 Jam)', '3 Lokasi Bebas', 'Semua Foto Edit Resolusi Tinggi', 'Cetak Album Premium Eksklusif', 'Video Cinematic 3 Menit', 'Semua File Original'] }
      ];
      saveToDB('appPackages', defaultPackages);
    }

    const appPackages = JSON.parse(localStorage.getItem('appPackages'));
    tbody.innerHTML = '';
    
    if(appPackages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">Belum ada paket.</td></tr>';
      return;
    }

    appPackages.forEach((pkg, index) => {
      const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(pkg.price);
      tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${pkg.name}</strong></td>
        <td>${formattedPrice}</td>
        <td><small>${pkg.features.join(', ')}</small></td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-admin" style="background: #2ecc71; border-color: #2ecc71; padding: 6px 12px; font-size: 0.85rem;" onclick="editPackage(${index})">Edit</button>
            <button class="btn-admin danger" style="padding: 6px 12px; font-size: 0.85rem;" onclick="deletePackage(${index})">Hapus</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const addPackageForm = document.getElementById('addPackageForm');
  if(addPackageForm) {
    addPackageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('pkgName').value;
      const price = parseInt(document.getElementById('pkgPrice').value, 10);
      const featuresStr = document.getElementById('pkgFeatures').value;
      const features = featuresStr.split(',').map(f => f.trim()).filter(f => f);
      const pkgIndex = document.getElementById('pkgIndex').value;
      
      const appPackages = JSON.parse(localStorage.getItem('appPackages') || '[]');
      
      if(pkgIndex !== "") {
        // Edit mode
        appPackages[pkgIndex] = {
          ...appPackages[pkgIndex],
          name,
          price,
          features
        };
        alert('Paket berhasil diperbarui!');
      } else {
        // Add mode
        appPackages.push({ 
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'), 
          name, 
          price, 
          features 
        });
        alert('Paket berhasil ditambahkan!');
      }
      
      saveToDB('appPackages', appPackages);
      
      addPackageForm.reset();
      document.getElementById('pkgIndex').value = "";
      document.querySelector('#addPackageForm button[type="submit"]').textContent = "Simpan Paket";
      loadPackages();
    });
  }

  window.editPackage = (index) => {
    const appPackages = JSON.parse(localStorage.getItem('appPackages') || '[]');
    const pkg = appPackages[index];
    if(pkg) {
      document.getElementById('pkgIndex').value = index;
      document.getElementById('pkgName').value = pkg.name;
      document.getElementById('pkgPrice').value = pkg.price;
      document.getElementById('pkgFeatures').value = pkg.features.join(', ');
      
      document.querySelector('#addPackageForm button[type="submit"]').textContent = "Update Paket";
      
      // Scroll to form
      document.getElementById('addPackageForm').scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.deletePackage = (index) => {
    if(confirm('Yakin ingin menghapus paket ini?')) {
      const appPackages = JSON.parse(localStorage.getItem('appPackages') || '[]');
      appPackages.splice(index, 1);
      saveToDB('appPackages', appPackages);
      loadPackages();
    }
  };

  // ========== MENUS MANAGEMENT ==========
  const loadMenus = () => {
    const tbody = document.getElementById('menus-table-body');
    const appMenus = JSON.parse(localStorage.getItem('appMenus') || '[]');
    
    tbody.innerHTML = '';
    if(appMenus.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">Belum ada menu.</td></tr>';
      return;
    }

    appMenus.forEach((menu, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${menu.name}</td>
        <td>${menu.link}</td>
        <td>
          <button class="btn-admin danger" onclick="deleteMenu(${index})">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const addMenuForm = document.getElementById('addMenuForm');
  if(addMenuForm) {
    addMenuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('menuName').value;
      const link = document.getElementById('menuLink').value;
      
      const appMenus = JSON.parse(localStorage.getItem('appMenus') || '[]');
      appMenus.push({ name, link });
      saveToDB('appMenus', appMenus);
      
      addMenuForm.reset();
      loadMenus();
      alert('Menu berhasil ditambahkan! Silakan cek website utama.');
    });
  }

  window.deleteMenu = (index) => {
    if(confirm('Yakin ingin menghapus menu ini? (Hati-hati jika menghapus menu utama seperti Beranda)')) {
      const appMenus = JSON.parse(localStorage.getItem('appMenus') || '[]');
      appMenus.splice(index, 1);
      saveToDB('appMenus', appMenus);
      loadMenus();
    }
  };

  // ========== PORTFOLIO MANAGEMENT ==========
  const loadPortfolio = () => {
    const tbody = document.getElementById('portfolio-table-body');
    
    // Initialize default if empty
    if(!localStorage.getItem('appPortfolio')) {
      const defaultPortfolio = [
        { title: 'The Promise', url: '/assets/portfolio_1.png' },
        { title: 'Ocean Breeze', url: '/assets/portfolio_2.png' },
        { title: 'Golden Hour', url: '/assets/hero.png' },
        { title: 'Eternity', url: '/assets/portfolio_2.png' },
        { title: 'True Love', url: '/assets/hero.png' },
        { title: 'Forever', url: '/assets/portfolio_1.png' }
      ];
      saveToDB('appPortfolio', defaultPortfolio);
    }

    const appPortfolio = JSON.parse(localStorage.getItem('appPortfolio'));
    tbody.innerHTML = '';
    
    if(appPortfolio.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">Belum ada foto portofolio.</td></tr>';
      return;
    }

    appPortfolio.forEach((photo, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${photo.url}" alt="${photo.title}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;"></td>
        <td>${photo.title}</td>
        <td>${photo.url}</td>
        <td>
          <button class="btn-admin danger" onclick="deletePortfolio(${index})">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const addPortfolioForm = document.getElementById('addPortfolioForm');
  if(addPortfolioForm) {
    addPortfolioForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('portfolioTitle').value;
      const fileInput = document.getElementById('portfolioFile');
      const file = fileInput.files[0];
      if (!file) return;
      
      const btn = document.getElementById('btnUploadPortfolio');
      btn.textContent = 'Memproses...';
      btn.disabled = true;

      const reader = new FileReader();
      reader.onload = function(event) {
        const base64Url = event.target.result;
        try {
          const appPortfolio = JSON.parse(localStorage.getItem('appPortfolio') || '[]');
          appPortfolio.push({ title, url: base64Url });
          saveToDB('appPortfolio', appPortfolio);
          
          addPortfolioForm.reset();
          loadPortfolio();
          alert('Foto berhasil ditambahkan ke Portofolio!');
        } catch(err) {
          alert('Upload gagal! Browser storage penuh. Hapus beberapa foto lama.');
        } finally {
          btn.textContent = 'Tambah Foto';
          btn.disabled = false;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  window.deletePortfolio = (index) => {
    if(confirm('Yakin ingin menghapus foto ini dari Portofolio?')) {
      const appPortfolio = JSON.parse(localStorage.getItem('appPortfolio') || '[]');
      appPortfolio.splice(index, 1);
      saveToDB('appPortfolio', appPortfolio);
      loadPortfolio();
    }
  };

  // ========== CONTENT CMS MANAGEMENT ==========
  const loadContentCMS = () => {
    if(!localStorage.getItem('appContent')) {
      const defaultContent = {
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
      saveToDB('appContent', defaultContent);
    }
    
    const content = JSON.parse(localStorage.getItem('appContent'));
    document.getElementById('cms-heroTitle').value = content.heroTitle || '';
    document.getElementById('cms-heroSubtitle').value = content.heroSubtitle || '';
    document.getElementById('cms-feature1Title').value = content.feature1Title || '';
    document.getElementById('cms-feature1Desc').value = content.feature1Desc || '';
    document.getElementById('cms-feature2Title').value = content.feature2Title || '';
    document.getElementById('cms-feature2Desc').value = content.feature2Desc || '';
    document.getElementById('cms-feature3Title').value = content.feature3Title || '';
    document.getElementById('cms-feature3Desc').value = content.feature3Desc || '';
    document.getElementById('cms-footerDesc').value = content.footerDesc || '';
    document.getElementById('cms-footerCopyright').value = content.footerCopyright || '';
  };

  const contentForm = document.getElementById('contentForm');
  if(contentForm) {
    contentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = {
        heroTitle: document.getElementById('cms-heroTitle').value,
        heroSubtitle: document.getElementById('cms-heroSubtitle').value,
        feature1Title: document.getElementById('cms-feature1Title').value,
        feature1Desc: document.getElementById('cms-feature1Desc').value,
        feature2Title: document.getElementById('cms-feature2Title').value,
        feature2Desc: document.getElementById('cms-feature2Desc').value,
        feature3Title: document.getElementById('cms-feature3Title').value,
        feature3Desc: document.getElementById('cms-feature3Desc').value,
        footerDesc: document.getElementById('cms-footerDesc').value,
        footerCopyright: document.getElementById('cms-footerCopyright').value
      };
      saveToDB('appContent', content);
      alert('Konten website berhasil disimpan! Refresh halaman pelanggan untuk melihat perubahan.');
    });
  }



  // Admin Mobile Menu Toggle
  const adminHamburger = document.getElementById('admin-hamburger');
  const adminNav = document.querySelector('.admin-nav');
  if(adminHamburger && adminNav) {
    adminHamburger.addEventListener('click', () => {
      adminNav.classList.toggle('active');
    });
  }

});
