/* Recalcule une commande côté serveur à partir du catalogue (config.js).
   Le navigateur n'envoie que des identifiants et des quantités :
   les prix viennent toujours d'ici, jamais du client. */
'use strict';

const FILS = { rose: 'rose', bleu: 'bleu', dore: 'doré', vert: 'vert', gris: 'gris' };

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

function calculer(C, body) {
  const byId = {};
  C.produits.forEach((p) => { byId[p.id] = p; });

  const articles = Array.isArray(body && body.articles) ? body.articles : [];
  if (!articles.length || articles.length > 30) return { erreur: 'Votre panier est vide ou trop grand.' };

  const lignes = [];
  for (const a of articles) {
    const p = byId[a && a.id];
    if (!p) return { erreur: 'Un article de votre panier n\'existe plus. Rechargez la page.' };
    const qty = Number(a.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { erreur: 'Quantité invalide.' };
    const taille = p.tailles ? clean(a.taille, 20) : '';
    if (p.tailles && C.tailles.indexOf(taille) === -1) return { erreur: 'Choisissez une taille pour « ' + p.nom + ' ».' };
    const prenom = p.personnalisable ? clean(a.prenom, p.persoMax || 15) : '';
    const fil = prenom && FILS[a.fil] ? a.fil : '';
    const unit = p.prix + (prenom ? (p.prixPerso || 0) : 0);
    lignes.push({ id: p.id, nom: p.nom, qty, taille, prenom, fil, couleurMot: p.couleurMot || 'fil', unit, total: unit * qty });
  }

  const sousTotal = lignes.reduce((s, l) => s + l.total, 0);
  const liv = C.livraison.filter((l) => l.id === (body.livraison || C.livraison[0].id))[0];
  if (!liv) return { erreur: 'Mode de livraison inconnu.' };
  const livraison = C.livraisonGratuiteDes && sousTotal >= C.livraisonGratuiteDes ? 0 : liv.prix;

  const c = body.client || {};
  const client = {
    nom: clean(c.nom, 60),
    tel: clean(c.tel, 20),
    adresse: clean(c.adresse, 120),
    note: clean(c.note, 300),
    email: clean(c.email, 80)
  };
  if (client.nom.length < 2) return { erreur: 'Indiquez votre nom.' };
  if (!/^\+?[0-9 ]{8,16}$/.test(client.tel)) return { erreur: 'Numéro de téléphone invalide.' };
  if (client.adresse.length < 3) return { erreur: 'Indiquez votre adresse de livraison.' };
  if (client.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(client.email)) client.email = '';

  const total = sousTotal + livraison;
  const resume = [
    client.nom + ' | ' + client.tel + ' | ' + client.adresse,
    lignes.map((l) => {
      const d = [l.taille, l.prenom ? 'prénom ' + l.prenom + (l.fil ? ' ' + l.couleurMot + ' ' + FILS[l.fil] : '') : ''].filter(Boolean).join(', ');
      return l.qty + 'x ' + l.nom + (d ? ' (' + d + ')' : '');
    }).join(' ; '),
    'livraison ' + livraison + ' F' + (client.note ? ' | note : ' + client.note : '')
  ].join(' || ');

  return { lignes, sousTotal, livraison, total, client, resume: resume.slice(0, 900) };
}

function json(status, data) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data)
  };
}

const ID_RE = /^CM\d{6}[A-F0-9]{6}$/;

// ---------- API CinetPay v1 (panel.cinetpay.net) ----------
// Clé sk_test_... = Sandbox (api.cinetpay.net), clé sk_live_... = production (api.cinetpay.co).
function cinetpayBase() {
  return String(process.env.CINETPAY_API_KEY || '').startsWith('sk_live_') ? 'https://api.cinetpay.co' : 'https://api.cinetpay.net';
}
function cinetpayConfigure() {
  const k = process.env.CINETPAY_API_KEY || '';
  return /^sk_(test|live)_/.test(k) && !!process.env.CINETPAY_API_PASSWORD;
}

let jeton = null;            // jeton gardé en mémoire tant que la fonction reste chaude
let jetonExpire = 0;

async function appelCinetPay(method, path, body, token) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(cinetpayBase() + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { http: res.status, data };
  } finally { clearTimeout(t); }
}

async function jetonCinetPay(forcer) {
  if (!forcer && jeton && Date.now() < jetonExpire) return jeton;
  const r = await appelCinetPay('POST', '/v1/oauth/login', { api_key: process.env.CINETPAY_API_KEY, api_password: process.env.CINETPAY_API_PASSWORD });
  if (!r.data.access_token) throw new Error('Connexion à CinetPay refusée (clé ou mot de passe API).');
  jeton = r.data.access_token;
  jetonExpire = Date.now() + Math.min(Number(r.data.expires_in) || 86400, 82800) * 1000;
  return jeton;
}

// Appel authentifié, avec un nouvel essai si le jeton a expiré (code 1003)
async function appelAuthentifie(method, path, body) {
  let r = await appelCinetPay(method, path, body, await jetonCinetPay(false));
  if (r.data.code === 1003 || r.data.status === 'EXPIRED_TOKEN' || r.http === 401) {
    r = await appelCinetPay(method, path, body, await jetonCinetPay(true));
  }
  return r;
}

// Interroge CinetPay sur l'état réel d'une transaction (référence marchand CM...)
async function verifierChezCinetPay(id) {
  const r = await appelAuthentifie('GET', '/v1/payment/' + encodeURIComponent(id));
  const s = String(r.data.status || '').toUpperCase();
  let statut = 'attente';
  if (s === 'SUCCESS' || r.data.code === 100) statut = 'paye';
  else if (/FAILED|EXPIRED|CANCEL|REFUSED|INSUFFICIENT/.test(s)) statut = 'echec';
  const u = r.data.user || {};
  return { statut, statutCinetPay: s, telephone: clean(u.phone_number, 20) };
}

module.exports = { calculer, json, clean, ID_RE, cinetpayConfigure, appelAuthentifie, verifierChezCinetPay };
