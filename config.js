// 1) Replace with your Supabase project values (Project Settings > API)
const SUPABASE_URL = 'https://ajlwtfngshxmmheuhwev.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ec7s85u_DIvdJt8Jsl-7rA_fFgQ8w8t';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMPTY_SETTINGS = { shop_name: '', shop_name_ur: '', easypaisa_no: '', easypaisa_title: '', jazzcash_no: '', jazzcash_title: '' };

async function getSettings() {
  const { data } = await db.from('kisan_vet_settings').select('*').order('id').limit(1).maybeSingle();
  return data || { ...EMPTY_SETTINGS };
}

const shopNames = s => ({ en: ((s && s.shop_name) || '').trim(), ur: ((s && s.shop_name_ur) || '').trim() });

async function ok(q) { const r = await q; if (r.error) throw r.error; return r.data; }
const rs = n => 'Rs ' + Number(n || 0).toLocaleString('en-PK');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, good = true) {
  const d = document.createElement('div');
  d.className = 'toast-msg ' + (good ? 'good' : 'bad'); d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
}

// ---------- LOGIN GUARD ----------
let _authPromise = null;
function requireLogin() {
  if (!_authPromise) _authPromise = _requireLogin();
  return _authPromise;
}
async function _requireLogin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    location.replace('auth.html');
    return new Promise(() => {});
  }
  let s = await getSettings();
  if (!s.id) {
    const m = session.user.user_metadata || {};
    const row = { ...EMPTY_SETTINGS, shop_name: m.shop_name || '', shop_name_ur: m.shop_name_ur || '' };
    const { data } = await db.from('kisan_vet_settings').insert(row).select().single();
    if (data) s = data;
  }
  applyShop(s);
  document.body.style.visibility = '';
  return s;
}

function applyShop(s) {
  const n = shopNames(s);
  const main = document.getElementById('navShopEn'), sub = document.getElementById('navShopUr');
  if (main) {
    main.textContent = n.en || n.ur || 'Meri Dukan';
    main.classList.toggle('urdu', !n.en && !!n.ur);
  }
  if (sub) {
    sub.textContent = n.ur;
    sub.style.display = (n.en && n.ur) ? '' : 'none';
  }
  document.title = document.title.split(' - ')[0] + ' - ' + (n.en || n.ur || 'Dukan');
}

async function logout() {
  await db.auth.signOut();
  location.replace('auth.html');
}

async function openGlobalShopModal() {
  const s = await getSettings();
  document.getElementById('glob_shop_en').value = s.shop_name || '';
  document.getElementById('glob_shop_ur').value = s.shop_name_ur || '';
  
  document.getElementById('old_pw').value = '';
  document.getElementById('new_pw').value = '';
  document.getElementById('new_pw_confirm').value = '';

  const m = new bootstrap.Modal(document.getElementById('globalShopModal'));
  m.show();
}

async function saveGlobalShopSettings() {
  const en = document.getElementById('glob_shop_en').value.trim();
  const ur = document.getElementById('glob_shop_ur').value.trim();
  if (!en && !ur) return toast('Dukan ka naam English ya Urdu mein likhein', false);

  try {
    const s = await getSettings();
    if (s && s.id) {
      await ok(db.from('kisan_vet_settings').update({ shop_name: en, shop_name_ur: ur }).eq('id', s.id));
    } else {
      await ok(db.from('kisan_vet_settings').insert([{ ...EMPTY_SETTINGS, shop_name: en, shop_name_ur: ur }]));
    }
    toast('Dukan ka naam tabdeel ho gaya!');
    const modalEl = document.getElementById('globalShopModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
    const updated = await getSettings();
    applyShop(updated);
  } catch (e) {
    toast('Error: ' + e.message, false);
  }
}

async function changePasswordSecurely() {
  const oldPw = document.getElementById('old_pw').value;
  const newPw = document.getElementById('new_pw').value;
  const newPwConf = document.getElementById('new_pw_confirm').value;

  if (!oldPw || !newPw || !newPwConf) {
    return toast('Tamam password fields bharein', false);
  }
  if (newPw.length < 6) {
    return toast('Naya password kam az kam 6 characters ka ho', false);
  }
  if (newPw !== newPwConf) {
    return toast('Naya password aur confirm password aik jaise nahi hain', false);
  }

  try {
    const { data: { user } } = await db.auth.getUser();
    if (!user || !user.email) return toast('User session nahi mila', false);

    const { error: signInErr } = await db.auth.signInWithPassword({
      email: user.email,
      password: oldPw
    });

    if (signInErr) {
      return toast('Purana password ghalat hai!', false);
    }

    const { error: updateErr } = await db.auth.updateUser({ password: newPw });
    if (updateErr) throw updateErr;

    toast('Password kamyabi se badal gaya!');
    document.getElementById('old_pw').value = '';
    document.getElementById('new_pw').value = '';
    document.getElementById('new_pw_confirm').value = '';

    const modalEl = document.getElementById('globalShopModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  } catch (e) {
    toast('Password change error: ' + e.message, false);
  }
}

function renderNav(active) {
  document.body.style.visibility = 'hidden';
  const L = [
    ['index.html', 'Naya Bill', 'receipt'],
    ['stock.html', 'Stock & Godown', 'box-seam'],
    ['khata.html', 'Kisaan Khata', 'journal-bookmark'],
    ['reports.html', 'Reports', 'graph-up'],
    ['orders.html', 'Stock Orders', 'truck']
  ];
  const st = document.createElement('style');
  st.textContent = `body{font-family:Inter,sans-serif;background:#f1f5f2}.urdu{font-family:'Noto Nastaliq Urdu',serif;line-height:2}
  .navbar{background:#064e3b}.navbar .nav-link{color:#d1fae5;border-radius:8px;padding:.5rem .9rem}.navbar .nav-link.active,.navbar .nav-link:hover{background:#047857;color:#fff}
  .btn-em{background:#047857;color:#fff;border:0}.btn-em:hover{background:#064e3b;color:#fff}.text-em{color:#047857}
  .card{border:1px solid #d1e7dd;border-radius:10px}.table thead th{background:#064e3b;color:#fff;white-space:nowrap}
  .pcard{cursor:pointer;border-left:4px solid #047857}.pcard:hover{background:#ecfdf5}
  .toast-msg{position:fixed;bottom:20px;right:20px;z-index:9999;padding:.8rem 1.2rem;border-radius:8px;color:#fff;box-shadow:0 4px 14px #0003}
  .toast-msg.good{background:#047857}.toast-msg.bad{background:#b91c1c}`;
  document.head.appendChild(st);
  
  document.body.insertAdjacentHTML('afterbegin', `
  <nav class="navbar navbar-expand-lg navbar-dark sticky-top no-print">
    <div class="container-fluid">
      <a class="navbar-brand d-flex flex-column py-0 cursor-pointer" href="javascript:void(0)" onclick="openGlobalShopModal()" title="Dukan Settings & Password">
        <span class="fw-bold fs-6"><i class="bi bi-heart-pulse"></i> <span id="navShopEn"></span> <i class="bi bi-gear-fill fs-7 opacity-75 ms-1"></i></span>
        <span class="urdu" id="navShopUr" style="font-size:.8rem;line-height:1.6;display:none"></span>
      </a>
      <button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#nv"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse" id="nv">
        <div class="navbar-nav ms-auto align-items-lg-center">
          ${L.map(l => `<a class="nav-link ${l[0] === active ? 'active' : ''}" href="${l[0]}"><i class="bi bi-${l[2]}"></i> ${l[1]}</a>`).join('')}
          <button class="nav-link btn btn-link text-start" onclick="openGlobalShopModal()"><i class="bi bi-gear"></i> Settings</button>
          <button class="btn btn-outline-light text-white ms-lg-2 my-2 my-lg-0 px-3 fw-semibold shadow-sm" onclick="logout()"><i class="bi bi-box-arrow-right"></i> Logout</button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Global Shop Name & Password Change Modal -->
  <div class="modal fade" id="globalShopModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title fw-bold"><i class="bi bi-sliders"></i> Dukan Settings &amp; Password</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <h6 class="fw-bold text-success border-bottom pb-1"><i class="bi bi-shop"></i> Dukan Ka Naam</h6>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Dukan Ka Naam (English)</label>
            <input type="text" id="glob_shop_en" class="form-control" placeholder="e.g. Kisan Veterinary Clinic">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">دکان کا نام (اردو)</label>
            <input type="text" id="glob_shop_ur" class="form-control" dir="rtl" style="font-family:'Noto Nastaliq Urdu',serif;text-align:right" placeholder="مثلاً کسان ویٹرنری کلینک">
          </div>
          <div class="text-end mb-4">
            <button type="button" class="btn btn-sm btn-em" onclick="saveGlobalShopSettings()"><i class="bi bi-save"></i> Dukan Ka Naam Save Karein</button>
          </div>

          <h6 class="fw-bold text-danger border-bottom pb-1"><i class="bi bi-shield-lock"></i> Password Tabdeel Karein</h6>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Purana Password (Jo abhi hai)</label>
            <input type="password" id="old_pw" class="form-control" placeholder="Purana password likhein">
          </div>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Naya Password</label>
            <input type="password" id="new_pw" class="form-control" placeholder="Kam az kam 6 characters">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Naya Password Dobara Likhein</label>
            <input type="password" id="new_pw_confirm" class="form-control" placeholder="Naya password dobara likhein">
          </div>
          <div class="text-end">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="changePasswordSecurely()"><i class="bi bi-key-fill"></i> Naya Password Set Karein</button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Band Karein</button>
        </div>
      </div>
    </div>
  </div>`);
  
  requireLogin();
}