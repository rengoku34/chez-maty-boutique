/* POST /.netlify/functions/paiement-creer
   Crée un paiement CinetPay (API v1) pour le panier envoyé et renvoie l'adresse de la page de paiement.
   La clé et le mot de passe API restent ici, sur le serveur : ils n'apparaissent jamais dans le site. */
'use strict';
const crypto = require('crypto');
const C = require('../../config.js');
const { calculer, json, cinetpayConfigure, appelAuthentifie } = require('../lib/commande.js');

function telInternational(tel) {
  const d = String(tel).replace(/\D/g, '');
  if (d.startsWith('225')) return '+' + d;
  return '+225' + d;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { erreur: 'Méthode non autorisée.' });
  if (!cinetpayConfigure()) return json(503, { erreur: 'Le paiement en ligne n\'est pas encore activé.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { erreur: 'Requête invalide.' }); }
  const cmd = calculer(C, body);
  if (cmd.erreur) return json(400, cmd);
  if (cmd.total < 100) return json(400, { erreur: 'Montant trop faible pour un paiement en ligne.' });

  const d = new Date();
  const id = 'CM' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
    crypto.randomBytes(3).toString('hex').toUpperCase();
  const base = (process.env.URL || '').replace(/\/$/, '');
  const mots = cmd.client.nom.split(' ').filter(Boolean);
  const prenom = (mots[0] || 'Client').padEnd(2, '.');
  const nom = (mots.slice(1).join(' ') || prenom).padEnd(2, '.');

  const payload = {
    currency: 'XOF',
    merchant_transaction_id: id,
    amount: cmd.total,
    lang: 'fr',
    designation: 'Commande Chez Maty ' + id,
    client_email: cmd.client.email || 'client@chezmaty.ci',
    client_first_name: prenom,
    client_last_name: nom,
    client_phone_number: telInternational(cmd.client.tel),
    success_url: base + '/?paiement=' + id,
    failed_url: base + '/?paiement=' + id,
    notify_url: base + '/.netlify/functions/paiement-notification',
    channel: 'PUSH'
  };

  try {
    const r = await appelAuthentifie('POST', '/v1/payment', payload);
    if (!r.data.payment_url || !/^https:\/\//.test(r.data.payment_url)) {
      console.log('CinetPay refuse la création', id, r.http, r.data.code, r.data.status, r.data.description || r.data.message);
      return json(502, { erreur: 'Le paiement n\'a pas pu être créé. Réessayez dans un instant.' });
    }
    // Détail de la commande dans les journaux Netlify (Logs > Functions), en plus du message WhatsApp
    console.log('Paiement créé', id, cmd.total + ' F', cmd.resume);
    return json(200, { no: id, total: cmd.total, payment_url: r.data.payment_url });
  } catch (e) {
    console.log('CinetPay injoignable ou refus de connexion', e.message);
    return json(502, { erreur: 'Le service de paiement ne répond pas. Réessayez dans un instant.', diagnostic: e.diagnostic || 'erreur_inconnue' });
  }
};
