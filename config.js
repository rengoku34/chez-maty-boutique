/* =========================================================
   CONFIGURATION DE LA BOUTIQUE
   C'est le SEUL fichier à modifier pour changer les produits,
   les prix, les numéros Wave / Orange Money, etc.
   ========================================================= */
var BOUTIQUE = {
  nom: "Chez Maty",
  slogan: "Des petits bonheurs pour grands moments",
  ville: "Abidjan",
  pays: "Côte d'Ivoire",

  // Numéro WhatsApp de la vendeuse : indicatif + numéro, sans "+" ni espaces.
  // Les commandes arrivent sur ce numéro.
  whatsapp: "2250709109224",
  instagram: "chez_maty",      // nom du compte Instagram ("" pour cacher)
  facebook: "Chez Maty",       // nom de la page Facebook ("" pour cacher)

  // ---- PAIEMENT EN LIGNE CINETPAY (vérification automatique) ----
  // Mettre actif: true quand le compte CinetPay est prêt ET que les clés
  // CINETPAY_APIKEY et CINETPAY_SITE_ID sont enregistrées sur Netlify (voir LISEZ-MOI.md).
  // Si les clés ne sont pas encore sur Netlify, le site repasse tout seul au paiement manuel ci-dessous.
  // actif: false = toujours le paiement manuel (Wave / Orange Money + référence).
  cinetpay: {
    actif: false
  },

  // ---- PAIEMENT À LA LIVRAISON ----
  // Proposé seulement si la commande ne contient AUCUN article personnalisé (prénom) :
  // un article au prénom ne peut pas être revendu, il doit être payé avant.
  paiementLivraison: {
    actif: true
  },

  // ---- ESPACE MATY (page maty.html) ----
  // Adresse(s) Gmail qui peuvent ouvrir l'espace Maty. À recopier aussi dans firestore.rules.
  admins: ["aboubakarnabaloum741@gmail.com"],

  // ---- PAIEMENT MANUEL : l'argent va directement sur ces comptes ----
  wave: {
    actif: true,
    numero: "07 09 10 92 24",   // numéro Wave de Maty (À CONFIRMER)
    nomCompte: "Maty",
    // Lien de paiement Wave Business (facultatif). Laisser "" si vous n'en avez pas.
    lien: ""
  },
  orangeMoney: {
    actif: true,
    numero: "07 09 10 92 24",   // numéro Orange Money de Maty (À CONFIRMER)
    nomCompte: "Maty",
    codeMenu: "#144#"            // code du menu Orange Money dans votre pays
  },

  // ---- LIVRAISON ----
  // Livraison uniquement par livreur, partout en Côte d'Ivoire
  livraison: [
    { id: "livreur", nom: "Livraison par livreur", detail: "Colis reçu en 24 h", prix: 1500 }
  ],
  // Livraison offerte à partir de ce montant (0 = jamais)
  livraisonGratuiteDes: 25000,

  // ---- CATÉGORIES ----
  categories: [
    { id: "coffrets",  nom: "Coffrets naissance" },
    { id: "brode",     nom: "Brodé au prénom" },
    { id: "ballons",   nom: "Ballons cadeaux" },
    { id: "packs",     nom: "Packs Bienvenue bébé" },
    { id: "tetines",   nom: "Tétines & accessoires" }
  ],

  // Tailles bébé proposées par défaut
  tailles: ["Naissance", "0-3 mois", "3-6 mois", "6-12 mois", "12-18 mois", "18-24 mois"],

  // ---- PRODUITS ----
  // image : mettre la photo dans le dossier "images" puis écrire "images/nom.jpg"
  // personnalisable: true  -> le client écrit le prénom à broder (+ prixPerso)
  // tailles: true          -> le client choisit une taille
  // badge: "Nouveau", "Populaire" ou ""   |   ancienPrix > 0 = article en promo
  // ⚠️ PRIX À CONFIRMER AVEC MATY
  produits: [
    { id: "coffret-brode-prenom", nom: "Coffret naissance brodé au prénom", categorie: "brode", prix: 30000, ancienPrix: 0,
      emoji: "🧸", couleur: "sky", image: "images/coffret-brode-prenom.jpg", badge: "Populaire", tailles: false, personnalisable: true, prixPerso: 0,
      description: "Doudou ourson brodé avec initiales et prénom, coussin bébé brodé au prénom, attache-tétine en perles au prénom, tétine et bavoir brodé. Livré dans une boîte cadeau Chez Maty. La broderie est comprise dans le prix." },
    { id: "tetine-personnalisee", nom: "Tétine et attache-tétine au prénom", categorie: "tetines", prix: 6000, ancienPrix: 0,
      emoji: "🍼", couleur: "mint", image: "images/tetine-personnalisee.jpg", badge: "Nouveau", tailles: false, personnalisable: true, prixPerso: 0,
      persoTitre: "Prénom sur les perles", persoMax: 10, couleurTitre: "Couleur des perles", couleurMot: "perles",
      description: "Attache-tétine en perles de silicone avec le prénom de bébé en lettres, clip cœur et tétine assortie. Sûre et sans BPA. Présentée sur sa carte cadeau Chez Maty. Le prénom est compris dans le prix." },
    { id: "attache-tetine-rose", nom: "Attache-tétine rose « I love mummy » au prénom", categorie: "tetines", prix: 5000, ancienPrix: 0,
      emoji: "🎀", couleur: "blush", image: "images/attache-tetine-rose.jpg", badge: "Nouveau", tailles: false, personnalisable: true, prixPerso: 0,
      persoTitre: "Prénom sur les perles", persoMax: 10, couleurTitre: "Couleur des perles", couleurMot: "perles",
      description: "Attache-tétine en perles de silicone roses avec le prénom de bébé, cœur « I love mummy », perle fleurie et clip cœur. Sûre et sans BPA. Présentée sur sa carte cadeau Chez Maty. Le prénom est compris dans le prix." },
    { id: "tetine-koala-bleue", nom: "Tétine koala bleue avec prénom", categorie: "tetines", prix: 7000, ancienPrix: 0,
      emoji: "🐨", couleur: "sky", image: "images/tetine-koala-bleue.jpg", badge: "Nouveau", tailles: false, personnalisable: true, prixPerso: 0,
      persoTitre: "Prénom sur la tétine et les perles", persoMax: 10, couleurTitre: "Couleur des perles", couleurMot: "perles",
      description: "Tétine avec le prénom de bébé et une couronne, attache-tétine en perles au prénom, clip et breloque koala. Sûre et sans BPA. Plusieurs modèles et couleurs possibles. Présentée sur sa carte cadeau Chez Maty." },
    { id: "coffret-prince", nom: "Coffret naissance Prince", categorie: "coffrets", prix: 25000, ancienPrix: 0,
      emoji: "🎁", couleur: "sky", image: "images/coffret-prince.jpg", badge: "Nouveau", tailles: true, personnalisable: true, prixPerso: 2000,
      description: "Ours en peluche, coussin anti-tête plate brodé « Prince », body, pyjama, bonnet, chaussettes, tétine et attache-tétine. Présenté dans une boîte kraft avec sa corde à linge décorée." },
    { id: "ballon-robe-fleurie", nom: "Ballon cadeau robe fleurie et doudou lapin", categorie: "ballons", prix: 20000, ancienPrix: 0,
      emoji: "🎈", couleur: "blush", image: "images/ballon-robe-fleurie.jpg", badge: "Nouveau", tailles: true, personnalisable: false, prixPerso: 0,
      description: "Robe fleurie et doudou lapin présentés dans une grande bulle transparente, avec nœud en satin rose et socle. Un cadeau de naissance ou d'anniversaire qui fait son effet." },
    { id: "caisse-welcome-baby", nom: "Caisse Welcome Baby au prénom", categorie: "packs", prix: 40000, ancienPrix: 0,
      emoji: "🧸", couleur: "blush", image: "images/caisse-welcome-baby.jpg", badge: "Populaire", tailles: true, personnalisable: true, prixPerso: 0,
      description: "Caisse en bois avec le prénom de bébé et sa guirlande « Welcome Baby », bulle de ballons personnalisée au prénom, ourson blanc, bavoir brodé, pyjama, body et chaussettes. La personnalisation est comprise dans le prix." },
    { id: "pack-baby-boy", nom: "Pack Bienvenue Baby Boy", categorie: "packs", prix: 35000, ancienPrix: 0,
      emoji: "🎈", couleur: "sky", image: "images/pack-baby-boy.jpg", badge: "Nouveau", tailles: true, personnalisable: true, prixPerso: 0,
      description: "Gâteau de couches décoré, coffret de vêtements brodés au prénom (bodies, bonnet, moufles), bouquet de ballons « Baby Boy » et plaque « Bienvenue Bébé ». La broderie est comprise dans le prix." }
  ],

  // ---- BANNIÈRES D'ACCUEIL ----
  // Le titre et le texte de la 1re servent de titre d'accueil. Les photos (3 max) s'affichent à côté.
  bannieres: [
    { titre: "Des cadeaux de naissance à son prénom", texte: "Coffrets, tétines et ballons personnalisés, préparés à la commande et livrés en 24 h partout en Côte d'Ivoire.", produit: "coffret-brode-prenom", image: "images/coffret-brode-prenom.jpg" },
    { titre: "Coffret Prince", produit: "coffret-prince", image: "images/coffret-prince.jpg" },
    { titre: "Ballon robe fleurie", produit: "ballon-robe-fleurie", image: "images/ballon-robe-fleurie.jpg" }
  ],

  // ---- AVIS CLIENTS ----
  // Mettre ici uniquement de VRAIS avis de clientes. La section reste cachée tant que la liste est vide.
  // Exemple : { nom: "Awa", ville: "Yopougon", texte: "Très joli body, broderie soignée !", note: 5 }
  avis: []
};

// Lu par le site (navigateur) ET par le serveur de paiement (fonctions Netlify),
// pour que les prix soient toujours recalculés côté serveur.
if (typeof window !== 'undefined') window.BOUTIQUE = BOUTIQUE;
if (typeof module !== 'undefined') module.exports = BOUTIQUE;
