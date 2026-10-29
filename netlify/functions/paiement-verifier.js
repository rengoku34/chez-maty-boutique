/* GET /.netlify/functions/paiement-verifier?id=CM...
   Demande à CinetPay si la transaction est réellement payée.
   Le site n'affiche « Paiement reçu » que si CinetPay répond SUCCESS. */
'use strict';
const { json, ID_RE, cinetpayConfigure, verifierChezCinetPay } = require('../lib/commande.js');

exports.handler = async (event) => {
  const id = String((event.queryStringParameters || {}).id || '');
  if (!ID_RE.test(id)) return json(400, { erreur: 'Numéro de paiement invalide.' });
  if (!cinetpayConfigure()) return json(503, { erreur: 'Le paiement en ligne n\'est pas encore activé.' });
  try {
    const r = await verifierChezCinetPay(id);
    return json(200, { no: id, statut: r.statut });
  } catch (e) {
    return json(502, { erreur: 'Impossible de vérifier le paiement pour le moment.' });
  }
};
