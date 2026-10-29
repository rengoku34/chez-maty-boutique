/* Compte client : connexion avec Google via Firebase.
   Pas de mot de passe stocké chez nous. Chaque cliente ne peut lire
   que ses propres données (voir firestore.rules). */
const cfg = window.CHEZMATY_FIREBASE || {};
const READY = !!(cfg.apiKey && cfg.projectId && cfg.authDomain);
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';

let fb = null;
let user = null;
let profile = { nom: '', tel: '', adresse: '' };
let orders = [];
let view = 'main';     // main | delete
let busy = false;
let message = '';
let gate = false;      // true : la cliente doit se connecter pour finaliser sa commande

async function load() {
  if (fb || !READY) return fb;
  const [appM, authM, fsM] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  const app = appM.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
  const auth = authM.getAuth(app);
  auth.languageCode = 'fr';
  const db = fsM.getFirestore(app);
  fb = { authM, fsM, auth, db };
  authM.onAuthStateChanged(auth, async (u) => {
    user = u;
    if (u) await loadAccount(); else { profile = { nom: '', tel: '', adresse: '' }; orders = []; }
    document.body.classList.toggle('cm-logged', !!u);
    updateHeader(); render();
    if (u) document.dispatchEvent(new CustomEvent('cm:profile', { detail: Object.assign({ email: u.email || '' }, profile) }));
    if (u && gate) {
      gate = false;
      const dlg = $('#account');
      if (dlg.open) dlg.close();
      document.dispatchEvent(new CustomEvent('cm:resume-checkout'));
    }
  });
  return fb;
}

async function loadAccount() {
  const { fsM, db } = fb;
  try {
    const ref = fsM.doc(db, 'users', user.uid);
    const snap = await fsM.getDoc(ref);
    if (snap.exists()) profile = Object.assign({ nom: '', tel: '', adresse: '' }, snap.data());
    else {
      profile = { nom: clean(user.displayName, 60), tel: '', adresse: '' };
      await fsM.setDoc(ref, Object.assign({}, profile, { creeLe: fsM.serverTimestamp() }));
    }
    // Commandes de la cliente (triées ici pour éviter un index Firestore)
    const q = fsM.query(fsM.collection(db, 'commandes'), fsM.where('uid', '==', user.uid), fsM.limit(50));
    orders = (await fsM.getDocs(q)).docs.map((d) => d.data())
      .sort((a, b) => quand(b) - quand(a)).slice(0, 20);
  } catch (e) {
    message = 'Impossible de charger votre compte. Vérifiez votre connexion internet.';
  }
}

async function signIn() {
  if (busy) return;
  busy = true; message = ''; render();
  try {
    const f = await load();
    const provider = new f.authM.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await f.authM.signInWithPopup(f.auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await f.authM.signInWithRedirect(f.auth, provider);
      else throw e;
    }
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      message = 'La connexion n\'a pas abouti. Réessayez, ou commandez sans compte.';
    }
  }
  busy = false; render();
}

async function saveProfile(form) {
  const data = {
    nom: clean(form.querySelector('#acc-nom').value, 60),
    tel: clean(form.querySelector('#acc-tel').value, 20),
    adresse: clean(form.querySelector('#acc-adr').value, 120)
  };
  if (data.tel && !/^\+?[0-9 ]{8,16}$/.test(data.tel)) { message = 'Le numéro de téléphone doit contenir au moins 8 chiffres.'; render(); return; }
  try {
    await fb.fsM.setDoc(fb.fsM.doc(fb.db, 'users', user.uid), data, { merge: true });
    profile = Object.assign(profile, data);
    message = 'Vos informations sont enregistrées.';
    document.dispatchEvent(new CustomEvent('cm:profile', { detail: Object.assign({ email: user.email || '' }, profile) }));
  } catch (e) { message = 'Enregistrement impossible. Vérifiez votre connexion internet.'; }
  render();
}

async function signOut() {
  await fb.authM.signOut(fb.auth);
  message = ''; view = 'main';
}

async function deleteAccount() {
  const { fsM, db, authM } = fb;
  try {
    const docs = await fsM.getDocs(fsM.collection(db, 'users', user.uid, 'commandes'));
    await Promise.all(docs.docs.map((d) => fsM.deleteDoc(d.ref)));
    await fsM.deleteDoc(fsM.doc(db, 'users', user.uid));
    await authM.deleteUser(user);
    view = 'main'; message = 'Votre compte et vos données ont été supprimés.';
  } catch (e) {
    message = e.code === 'auth/requires-recent-login'
      ? 'Par sécurité, déconnectez-vous puis reconnectez-vous, et recommencez la suppression.'
      : 'Suppression impossible pour le moment. Réessayez plus tard.';
    view = 'main';
  }
  render();
}

function quand(o) {
  const t = o.creeLe;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : (Number(t) || 0);
}

// Libellés du suivi de commande
const STATUTS = {
  en_attente_paiement: 'Paiement en vérification',
  a_payer_livraison: 'À payer à la livraison',
  payee: 'Paiement confirmé ✓',
  preparation: 'En préparation',
  livraison: 'Chez le livreur',
  livree: 'Livrée ✓',
  annulee: 'Annulée'
};

// Enregistre la commande (et la référence de paiement, utilisable une seule fois) en une seule opération.
// detail = { commande, done(erreur) } ; erreur = null | 'reference_deja_utilisee' | 'non_connectee' | 'reseau'
document.addEventListener('cm:save-order', async (e) => {
  const { commande, done } = e.detail;
  if (!fb || !user) { done('non_connectee'); return; }
  const { fsM, db } = fb;
  try {
    const c = Object.assign({}, commande, {
      uid: user.uid,
      email: clean(user.email, 80),
      creeLe: fsM.serverTimestamp(),
      majLe: fsM.serverTimestamp()
    });
    const batch = fsM.writeBatch(db);
    if (c.statut === 'en_attente_paiement') {
      batch.set(fsM.doc(db, 'references', c.paiement.refId), { no: c.no, uid: user.uid, creeLe: fsM.serverTimestamp() });
    }
    batch.set(fsM.doc(db, 'commandes', c.no), c);
    await batch.commit();
    orders.unshift(Object.assign({}, c, { creeLe: Date.now() }));
    done(null);
  } catch (err) {
    // Une référence déjà enregistrée rend l'écriture interdite par les règles
    done(err && err.code === 'permission-denied' ? 'reference_deja_utilisee' : 'reseau');
  }
});

function updateHeader() {
  const label = $('#acc-label');
  if (!label) return;
  label.textContent = user ? (clean((profile.nom || user.displayName || '').split(' ')[0], 12) || 'Mon compte') : 'Compte';
}

const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function render() {
  const body = $('#acc-body');
  if (!body) return;
  const msg = message ? '<p class="acc-msg" role="status">' + esc(message) + '</p>' : '';
  if (!READY) {
    body.innerHTML = '<div class="co"><h3 id="acc-title">Mon compte</h3>' +
      '<p class="muted">La connexion avec Google sera bientôt disponible. Vous pouvez déjà commander sans compte : votre commande part sur WhatsApp.</p>' +
      '<button class="btn primary block" type="button" data-acc-close>Continuer mes achats</button></div>';
    return;
  }
  if (!user) {
    body.innerHTML = '<div class="co"><h3 id="acc-title">' + (gate ? 'Connectez-vous pour commander' : 'Se connecter ou créer un compte') + '</h3>' +
      (gate ? '<p class="acc-msg">Pour payer votre commande, connectez-vous avec Google. Votre panier est gardé, vous reprenez juste après.</p>' : '') +
      '<p class="muted">Avec votre compte Google, en un seul geste, sans mot de passe à retenir. Si c\'est votre première fois, votre compte est créé automatiquement.</p>' +
      '<ul class="acc-perks"><li>Vos coordonnées remplies automatiquement</li><li>L\'historique de vos commandes</li><li>Le même compte sur téléphone et ordinateur</li></ul>' +
      msg +
      '<div class="actions">' +
        '<button class="btn sso google block" type="button" data-signin="google"' + (busy ? ' disabled' : '') + '>' + G_LOGO + 'Continuer avec Google</button>' +
      '</div>' +
      '<p class="acc-small">Nous recevons seulement votre nom et votre adresse e-mail. Un compte est nécessaire pour commander : il permet à Maty de vous retrouver et à vous de suivre vos commandes.</p></div>';
    return;
  }
  if (view === 'delete') {
    body.innerHTML = '<div class="co"><h3 id="acc-title">Supprimer mon compte ?</h3>' +
      '<p>Vos informations personnelles seront effacées définitivement. Les commandes déjà passées restent enregistrées chez Chez Maty pour la livraison et la comptabilité.</p>' +
      '<div class="actions"><button class="btn danger block" type="button" data-acc="delete-yes">Oui, supprimer mon compte</button>' +
      '<button class="btn ghost block" type="button" data-acc="delete-no">Annuler</button></div></div>';
    return;
  }
  const photo = user.photoURL && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(user.photoURL)
    ? '<img class="acc-photo" src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer">'
    : '<span class="acc-photo acc-initial" aria-hidden="true">' + esc((profile.nom || user.email || '?').charAt(0).toUpperCase()) + '</span>';
  const list = orders.length
    ? orders.map((o) => '<li class="acc-order"><div><b>' + esc(o.no) + '</b>' +
        '<span class="statut st-' + esc(o.statut) + '">' + esc(STATUTS[o.statut] || 'Commande reçue') + '</span>' +
        '<small>' + esc(new Date(quand(o) || Date.now()).toLocaleDateString('fr-FR')) + ' · ' + esc((o.articles || []).map((a) => a.qty + ' × ' + a.nom).join(', ')) + '</small></div>' +
        '<span class="mono">' + fmt(o.total || 0) + '</span></li>').join('')
    : '<li class="muted">Aucune commande pour le moment.</li>';
  body.innerHTML = '<div class="co">' +
    '<div class="acc-who">' + photo + '<div><h3 id="acc-title">' + esc(profile.nom || user.displayName || 'Mon compte') + '</h3><small class="muted">' + esc(user.email || '') + '</small></div></div>' +
    msg +
    '<form class="acc-form" id="acc-form" novalidate><p class="foot-title acc-sec">Mes informations de livraison</p>' +
      '<label class="field" for="acc-nom"><span>Nom et prénom</span><input class="input" id="acc-nom" maxlength="60" autocomplete="name" value="' + esc(profile.nom) + '"></label>' +
      '<label class="field" for="acc-tel"><span>Téléphone</span><input class="input" id="acc-tel" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="07 00 00 00 00" value="' + esc(profile.tel) + '"></label>' +
      '<label class="field" for="acc-adr"><span>Adresse : ville, quartier, repère</span><input class="input" id="acc-adr" maxlength="120" autocomplete="street-address" value="' + esc(profile.adresse) + '"></label>' +
      '<button class="btn primary block" type="submit">Enregistrer</button></form>' +
    '<p class="foot-title acc-sec">Mes commandes</p><ul class="acc-orders">' + list + '</ul>' +
    '<div class="actions"><button class="btn ghost block" type="button" data-acc="logout">Se déconnecter</button>' +
    '<button class="link-btn" type="button" data-acc="delete">Supprimer mon compte</button></div></div>';
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'btn-account' || t.hasAttribute('data-open-account')) {
    message = ''; view = 'main'; render();
    const dlg = $('#account');
    if (!dlg.open) dlg.showModal();
    if (READY) load().catch(() => { message = 'Connexion impossible pour le moment. Vérifiez votre connexion internet.'; render(); });
  } else if (t.dataset.signin) signIn();
  else if (t.dataset.acc === 'logout') signOut();
  else if (t.dataset.acc === 'delete') { view = 'delete'; render(); }
  else if (t.dataset.acc === 'delete-no') { view = 'main'; render(); }
  else if (t.dataset.acc === 'delete-yes') deleteAccount();
  else if (t.hasAttribute('data-acc-close')) $('#account').close();
});
// Le panier demande une connexion avant le paiement
document.addEventListener('cm:need-login', () => {
  gate = true; message = ''; view = 'main'; render();
  const dlg = $('#account');
  if (!dlg.open) dlg.showModal();
  load().then(() => {
    // déjà connectée (session restaurée) : on reprend directement
    if (user && gate) { gate = false; dlg.close(); document.dispatchEvent(new CustomEvent('cm:resume-checkout')); }
  }).catch(() => { message = 'Connexion impossible pour le moment. Vérifiez votre connexion internet.'; render(); });
});
document.getElementById('account').addEventListener('close', () => { gate = false; });

document.addEventListener('submit', (e) => {
  if (e.target.id === 'acc-form') { e.preventDefault(); saveProfile(e.target); }
});

// Restaure la session au chargement (et termine une connexion par redirection)
if (READY) load().then((f) => f && f.authM.getRedirectResult(f.auth)).catch(() => {});
document.body.classList.add(READY ? 'cm-auth' : 'cm-noauth');
render();
