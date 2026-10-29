/* Espace Maty : liste des commandes en direct et suivi (paiement reçu, préparation, livraison).
   L'accès est réservé par les règles Firestore (firestore.rules) : même si quelqu'un ouvre
   cette page, il ne voit rien sans être connecté avec l'adresse Gmail de Maty. */
const C = window.BOUTIQUE;
const cfg = window.CHEZMATY_FIREBASE || {};
const READY = !!(cfg.apiKey && cfg.projectId && cfg.authDomain);
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';

const STATUTS = {
  en_attente_paiement: 'Paiement à vérifier',
  a_payer_livraison: 'À encaisser à la livraison',
  payee: 'Payée',
  preparation: 'En préparation',
  livraison: 'Chez le livreur',
  livree: 'Livrée',
  annulee: 'Annulée'
};
const FILTRES = [
  { id: 'verifier', nom: 'À vérifier', statuts: ['en_attente_paiement'] },
  { id: 'livraison', nom: 'Paiement à la livraison', statuts: ['a_payer_livraison'] },
  { id: 'encours', nom: 'En cours', statuts: ['payee', 'preparation', 'livraison'] },
  { id: 'livrees', nom: 'Livrées', statuts: ['livree'] },
  { id: 'annulees', nom: 'Annulées', statuts: ['annulee'] },
  { id: 'toutes', nom: 'Toutes', statuts: null }
];
// Actions possibles selon le statut : [nouveau statut, libellé, style]
const ACTIONS = {
  en_attente_paiement: [['payee', 'Paiement reçu ✓', 'primary'], ['annulee', 'Pas reçu : annuler', 'ghost']],
  a_payer_livraison: [['preparation', 'Préparer la commande', 'primary'], ['annulee', 'Annuler', 'ghost']],
  payee: [['preparation', 'En préparation', 'primary']],
  preparation: [['livraison', 'Remise au livreur', 'primary']],
  livraison: [['livree', 'Livrée ✓', 'primary']],
  livree: [],
  annulee: []
};
// Message WhatsApp proposé à la cliente après chaque étape
const MESSAGES = {
  payee: (o) => 'Bonjour ' + o.nom + ', votre paiement de ' + fmt(o.total) + ' pour la commande ' + o.no + ' est bien reçu. Merci ! Nous préparons votre colis.',
  preparation: (o) => 'Bonjour ' + o.nom + ', votre commande ' + o.no + ' est en préparation chez Chez Maty.',
  livraison: (o) => 'Bonjour ' + o.nom + ', votre commande ' + o.no +  ' est chez le livreur. Il vous appellera avant d\'arriver.' + (o.paiement && o.paiement.mode === 'livraison' ? ' Montant à régler à la réception : ' + fmt(o.total) + '.' : ''),
  livree: (o) => 'Bonjour ' + o.nom + ', votre commande ' + o.no + ' a été livrée. Merci pour votre confiance, à bientôt chez Chez Maty !',
  annulee: (o) => o.paiement && o.paiement.mode === 'livraison'
    ? 'Bonjour ' + o.nom + ', votre commande ' + o.no + ' a été annulée. Contactez-nous si vous souhaitez la reprendre.'
    : 'Bonjour ' + o.nom + ', nous n\'avons pas trouvé votre paiement pour la commande ' + o.no + '. Pouvez-vous nous envoyer la capture de votre reçu ?'
};

let fb = null;
let user = null;
let commandes = [];
let filtre = 'verifier';
let aConfirmer = '';        // "no|statut" en attente d'un second clic (annulation)
let erreur = '';
let stopEcoute = null;

const byId = {};
C.produits.forEach((p) => { byId[p.id] = p; });

// Total recalculé avec les vrais prix de config.js, pour repérer un prix trafiqué
function totalAttendu(o) {
  let st = 0;
  for (const a of o.articles || []) {
    const p = byId[a.id];
    if (!p) return null;
    st += (p.prix + (a.prenom && p.personnalisable ? (p.prixPerso || 0) : 0)) * (Number(a.qty) || 0);
  }
  const liv = C.livraison[0] ? C.livraison[0].prix : 0;
  return st + (C.livraisonGratuiteDes && st >= C.livraisonGratuiteDes ? 0 : liv);
}

function quand(o) {
  const t = o.creeLe;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}
function telWa(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  return d.startsWith('225') ? d : '225' + d;
}

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
}

async function load() {
  if (fb || !READY) return fb;
  const [appM, authM, fsM] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
  ]);
  const app = appM.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
  const auth = authM.getAuth(app); auth.languageCode = 'fr';
  fb = { authM, fsM, auth, db: fsM.getFirestore(app) };
  authM.onAuthStateChanged(auth, (u) => {
    user = u;
    if (stopEcoute) { stopEcoute(); stopEcoute = null; }
    commandes = []; erreur = '';
    if (u && estMaty()) ecouter();
    render();
  });
  return fb;
}

function estMaty() {
  return !!user && (C.admins || []).map((e) => e.toLowerCase()).indexOf(String(user.email || '').toLowerCase()) > -1;
}

function ecouter() {
  const { fsM, db } = fb;
  const q = fsM.query(fsM.collection(db, 'commandes'), fsM.orderBy('creeLe', 'desc'), fsM.limit(300));
  let premier = true;
  stopEcoute = fsM.onSnapshot(q, (snap) => {
    const avant = commandes.length;
    commandes = snap.docs.map((d) => d.data());
    if (!premier && commandes.length > avant) toast('Nouvelle commande reçue');
    premier = false;
    const n = commandes.filter((o) => o.statut === 'en_attente_paiement').length;
    document.title = (n ? '(' + n + ') ' : '') + 'Espace Maty';
    render();
  }, (e) => {
    erreur = e.code === 'permission-denied'
      ? 'Accès refusé par la base. Vérifiez que l\'adresse de ce compte est bien dans firestore.rules (fonction estMaty).'
      : 'Impossible de charger les commandes. Vérifiez votre connexion internet.';
    render();
  });
}

async function changerStatut(no, statut) {
  const o = commandes.find((c) => c.no === no);
  if (!o) return;
  try {
    await fb.fsM.updateDoc(fb.fsM.doc(fb.db, 'commandes', no), { statut, majLe: fb.fsM.serverTimestamp() });
    toast('Commande ' + no + ' : ' + STATUTS[statut]);
  } catch (e) {
    toast('Modification impossible : ' + (e.code === 'permission-denied' ? 'accès refusé.' : 'vérifiez internet.'));
  }
}

function carte(o) {
  const attendu = totalAttendu(o);
  const incoherent = attendu !== null && attendu !== o.total;
  const perso = (o.articles || []).some((a) => a.prenom);
  const p = o.paiement || {};
  const date = quand(o) ? new Date(quand(o)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const msg = MESSAGES[o.statut];
  const actions = (ACTIONS[o.statut] || []).map(([st, lib, style]) => {
    const cle = o.no + '|' + st;
    const confirmer = st === 'annulee';
    const enAttente = aConfirmer === cle;
    return '<button class="btn ' + (enAttente ? 'danger' : style) + '" type="button" data-no="' + esc(o.no) + '" data-st="' + st + '"' + (confirmer ? ' data-confirm' : '') + '>' +
      esc(enAttente ? 'Confirmer : annuler la commande' : lib) + '</button>';
  }).join('');

  return '<article class="adm-card">' +
    '<div class="adm-head"><div><b class="order-no-sm">' + esc(o.no) + '</b><small class="muted">' + esc(date) + '</small></div>' +
      '<span class="statut st-' + esc(o.statut) + '">' + esc(STATUTS[o.statut] || o.statut) + '</span></div>' +

    (incoherent ? '<p class="adm-alert">⚠️ Total incohérent : la commande indique ' + fmt(o.total) + ' mais les prix de la boutique donnent ' + fmt(attendu) + '. Ne livrez pas sans vérifier.</p>' : '') +
    (perso && p.mode === 'livraison' ? '<p class="adm-alert">⚠️ Article personnalisé avec paiement à la livraison : demandez le paiement avant de préparer.</p>' : '') +

    '<div class="adm-grid">' +
      '<div><p class="adm-label">Cliente</p><p><b>' + esc(o.nom) + '</b></p>' +
        '<p><a href="tel:' + esc(o.tel) + '">' + esc(o.tel) + '</a> · <a href="https://wa.me/' + telWa(o.tel) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
        '<p>' + esc(o.adresse) + '</p>' + (o.email ? '<p class="muted">' + esc(o.email) + '</p>' : '') +
        (o.note ? '<p class="adm-note">« ' + esc(o.note) + ' »</p>' : '') + '</div>' +
      '<div><p class="adm-label">Articles</p><ul class="adm-items">' + (o.articles || []).map((a) =>
        '<li>' + a.qty + ' × ' + esc(a.nom) +
        ([a.taille, a.prenom ? 'prénom « ' + a.prenom + ' »' + (a.fil ? ', ' + a.fil : '') : ''].filter(Boolean).length
          ? '<small>' + esc([a.taille, a.prenom ? 'prénom « ' + a.prenom + ' »' + (a.fil ? ', couleur ' + a.fil : '') : ''].filter(Boolean).join(' · ')) + '</small>' : '') +
        '</li>').join('') + '</ul>' +
        '<p class="adm-total">Total : <b>' + fmt(o.total) + '</b> <small class="muted">(livraison ' + fmt(o.livraison) + ')</small></p></div>' +
      '<div><p class="adm-label">Paiement</p>' +
        (p.mode === 'livraison'
          ? '<p>À encaisser à la livraison : <b>' + fmt(o.total) + '</b></p>'
          : '<p>' + esc(p.mode === 'om' ? 'Orange Money' : p.mode === 'wave' ? 'Wave' : p.mode) + '</p>' +
            '<p>Réf. <b class="mono">' + esc(p.ref) + '</b></p><p>Depuis le <b class="mono">' + esc(p.payTel) + '</b></p>' +
            (o.statut === 'en_attente_paiement' ? '<p class="adm-check">Ouvrez votre application ' + esc(p.mode === 'om' ? 'Orange Money' : 'Wave') + ' et vérifiez : <b>' + fmt(o.total) + '</b> reçus, référence <b>' + esc(p.ref) + '</b>, depuis le <b>' + esc(p.payTel) + '</b>.</p>' : '')) +
      '</div>' +
    '</div>' +

    '<div class="adm-actions">' + actions +
      (msg ? '<a class="btn outline" href="https://wa.me/' + telWa(o.tel) + '?text=' + encodeURIComponent(msg(o)) + '" target="_blank" rel="noopener">Prévenir la cliente</a>' : '') +
    '</div>' +
  '</article>';
}

function render() {
  const body = $('#adm-body');
  const who = $('#adm-who');
  if (!READY) { body.innerHTML = '<p>La connexion Firebase n\'est pas configurée (firebase-config.js).</p>'; return; }
  if (!user) {
    who.innerHTML = '';
    body.innerHTML = '<div class="adm-login"><h1>Espace Maty</h1><p class="muted">Connectez-vous avec le compte Google de Maty pour voir les commandes.</p>' +
      '<button class="btn primary" type="button" id="adm-signin">Se connecter avec Google</button></div>';
    return;
  }
  who.innerHTML = '<span class="muted adm-mail">' + esc(user.email) + '</span><button class="link-btn" type="button" id="adm-out">Se déconnecter</button>';
  if (!estMaty()) {
    body.innerHTML = '<div class="adm-login"><h1>Accès réservé</h1><p>Ce compte (' + esc(user.email) + ') n\'a pas accès à l\'espace Maty.</p>' +
      '<p class="muted">Pour l\'autoriser, ajoutez cette adresse dans config.js (admins) et dans firestore.rules (fonction estMaty).</p></div>';
    return;
  }
  if (erreur) { body.innerHTML = '<p class="adm-alert">' + esc(erreur) + '</p>'; return; }

  const f = FILTRES.find((x) => x.id === filtre);
  const liste = commandes.filter((o) => !f.statuts || f.statuts.indexOf(o.statut) > -1);
  const compte = (x) => commandes.filter((o) => !x.statuts || x.statuts.indexOf(o.statut) > -1).length;
  const aEncaisser = commandes.filter((o) => ['payee', 'preparation', 'livraison', 'livree'].indexOf(o.statut) > -1).reduce((s, o) => s + (o.total || 0), 0);

  body.innerHTML =
    '<div class="adm-summary"><div><p class="adm-label">Paiements à vérifier</p><p class="adm-big">' + compte(FILTRES[0]) + '</p></div>' +
      '<div><p class="adm-label">Commandes en cours</p><p class="adm-big">' + compte(FILTRES[2]) + '</p></div>' +
      '<div><p class="adm-label">Ventes confirmées</p><p class="adm-big">' + fmt(aEncaisser) + '</p></div></div>' +
    '<div class="cats" role="tablist" aria-label="Filtrer les commandes">' + FILTRES.map((x) =>
      '<button class="cat-link" role="tab" type="button" data-filtre="' + x.id + '" aria-selected="' + (x.id === filtre) + '">' + esc(x.nom) + ' (' + compte(x) + ')</button>').join('') + '</div>' +
    (liste.length ? liste.map(carte).join('') : '<p class="empty">Aucune commande ici pour le moment.</p>');
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'adm-signin') {
    try {
      const f = await load();
      const provider = new f.authM.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await f.authM.signInWithPopup(f.auth, provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') toast('La connexion n\'a pas abouti. Réessayez.');
    }
  } else if (t.id === 'adm-out') {
    await fb.authM.signOut(fb.auth);
  } else if (t.dataset.filtre) {
    filtre = t.dataset.filtre; aConfirmer = ''; render();
  } else if (t.dataset.st) {
    const cle = t.dataset.no + '|' + t.dataset.st;
    if (t.hasAttribute('data-confirm') && aConfirmer !== cle) { aConfirmer = cle; render(); return; }
    aConfirmer = '';
    await changerStatut(t.dataset.no, t.dataset.st);
  }
});

if (READY) load().catch(() => { erreur = 'Impossible de charger la connexion. Vérifiez votre connexion internet.'; render(); });
render();
