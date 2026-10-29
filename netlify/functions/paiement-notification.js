/* Adresse appelée par CinetPay quand un paiement est terminé (notify_url).
   On ne fait jamais confiance au contenu reçu : on redemande l'état à CinetPay.
   Le résultat apparaît dans Netlify > Logs > Functions. */
'use strict';
const { json, ID_RE, cinetpayConfigure, verifierChezCinetPay } = require('../lib/commande.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' || !cinetpayConfigure()) return json(200, { ok: true });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '');
  let data = {};
  try { data = JSON.parse(raw); } catch (e) { data = Object.fromEntries(new URLSearchParams(raw)); }
  const id = String(data.merchant_transaction_id || '');
  if (!ID_RE.test(id)) return json(200, { ok: true });
  try {
    const r = await verifierChezCinetPay(id);
    console.log('Notification CinetPay', id, r.statut, r.statutCinetPay, r.telephone);
  } catch (e) {
    console.log('Vérification impossible', id, e.message);
  }
  return json(200, { ok: true });
};
