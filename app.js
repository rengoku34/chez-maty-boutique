/* Logique de la boutique : catalogue, favoris, panier, commande.
   Aucune donnée bancaire ni code secret ne passe par ce site :
   le client paie dans son application Wave / Orange Money,
   puis la commande est envoyée à la vendeuse sur WhatsApp. */
(function () {
  'use strict';

  var C = window.BOUTIQUE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- Outils ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F'; }
  function clean(s, max) {
    // Enlève les caractères de contrôle et limite la longueur
    return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };
  var byId = {};
  C.produits.forEach(function (p) { byId[p.id] = p; });
  var tints = { mint: 'var(--mint)', sun: 'var(--sun)', sky: 'var(--sky)', blush: 'var(--blush)' };
  var threads = [
    { id: 'rose', nom: 'Rose', css: '#d9536f' },
    { id: 'bleu', nom: 'Bleu', css: '#3c7dd9' },
    { id: 'dore', nom: 'Doré', css: '#c08a1e' },
    { id: 'vert', nom: 'Vert', css: '#2f9a6a' },
    { id: 'gris', nom: 'Gris', css: '#6b7385' }
  ];

  var PH = '<span class="ph" aria-hidden="true"><img src="images/logo-chez-maty.png" alt=""><small>Photo à venir</small></span>';
  function visual(p, cls) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.nom) + '" loading="lazy">';
    return PH;
  }

  // ---------- État ----------
  var state = {
    cat: 'tout',
    q: '',
    sort: 'pop',
    onlyFavs: false,
    favs: store.get('pn_favs', []).filter(function (id) { return byId[id]; }),
    // Les prix sont toujours recalculés depuis config.js (jamais depuis le stockage)
    cart: store.get('pn_cart', []).filter(function (l) { return l && byId[l.id] && l.qty > 0 && l.qty < 100; })
  };
  function save() { store.set('pn_cart', state.cart); store.set('pn_favs', state.favs); }

  function unitPrice(line) {
    var p = byId[line.id];
    return p.prix + (line.prenom && p.personnalisable ? (p.prixPerso || 0) : 0);
  }
  function subtotal() { return state.cart.reduce(function (s, l) { return s + unitPrice(l) * l.qty; }, 0); }
  function itemCount() { return state.cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  // ---------- Textes de la boutique ----------
  var heroNames = ['Aya', 'Kouadio', 'Aïcha', 'Yao', 'Adjoua', 'Moussa'];
  function fillShopInfo() {
    $$('[data-shop-name]').forEach(function (el) { el.textContent = C.nom; });
    $$('[data-shop-slogan]').forEach(function (el) { el.textContent = C.slogan; });
    $$('[data-shop-city]').forEach(function (el) { el.textContent = C.ville; });
    document.title = C.nom;
    $('#year').textContent = new Date().getFullYear();
    $('#foot-wa').textContent = C.whatsapp.replace(/^225/, '').replace(/(\d{2})(?=\d)/g, '$1 ');
    if (C.instagram) { var ig = $('#foot-ig'); ig.hidden = false; ig.querySelector('a').href = 'https://www.instagram.com/' + encodeURIComponent(C.instagram) + '/'; ig.querySelector('a').textContent = '@' + C.instagram; }
    if (C.facebook) { var fb = $('#foot-fb'); fb.hidden = false; fb.querySelector('span').textContent = C.facebook; }
    $('#wa-float').href = 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent('Bonjour ' + C.nom + ', j\'ai une question :');
  }
  function rotateHeroName() {
    var i = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setInterval(function () { var el = $('#hero-name'); if (!el) return; i = (i + 1) % heroNames.length; el.textContent = heroNames[i]; }, 2600);
  }

  // ---------- Accueil ----------
  function renderBanners() {
    var list = C.bannieres || [];
    var first = list[0] || { titre: C.nom, texte: C.slogan };
    var photos = list.filter(function (b) { return b.image; }).slice(0, 3);
    $('#banners').innerHTML = '<div class="wrap hero-in">' +
      '<div class="hero-text">' +
        '<p class="script hero-script">bienvenue bébé</p>' +
        '<h1>' + esc(first.titre) + '</h1>' +
        '<p class="lead">' + esc(first.texte) + '</p>' +
        '<div class="hero-cta"><a class="btn primary" href="#boutique">Voir la boutique</a>' +
        '<a class="btn outline" href="https://wa.me/' + esc(C.whatsapp) + '?text=' + encodeURIComponent('Bonjour Chez Maty, je voudrais un cadeau personnalisé.') + '" target="_blank" rel="noopener">Demander sur WhatsApp</a></div>' +
      '</div>' +
      '<div class="hero-photos n' + photos.length + '">' + photos.map(function (b, i) {
        var target = b.produit && byId[b.produit] ? 'data-open="' + esc(b.produit) + '"' : 'data-cat-jump="' + esc(b.categorie || 'tout') + '"';
        var cap = i && b.titre ? b.titre : (b.produit && byId[b.produit] ? byId[b.produit].nom : b.titre);
        return '<button type="button" class="hp hp' + i + '" ' + target + '><img src="' + esc(b.image) + '" alt="' + esc(cap) + '"' + (i ? ' loading="lazy"' : '') + '><span class="hp-cap">' + esc(cap) + '</span></button>';
      }).join('') + '</div></div>';
  }

  function renderInsta() {
    if (!C.instagram) { $('.insta').hidden = true; return; }
    var url = 'https://www.instagram.com/' + encodeURIComponent(C.instagram) + '/';
    $('#insta-link').href = url; $('#insta-link').textContent = '@' + C.instagram;
    // on n'affiche que les photos qui existent vraiment (4 au maximum)
    var grid = $('#insta-grid');
    C.produits.filter(function (p) { return p.image; }).forEach(function (p) {
      var probe = new Image();
      probe.onload = function () {
        if (grid.children.length >= 4) return;
        grid.insertAdjacentHTML('beforeend', '<a class="insta-tile" href="' + url + '" target="_blank" rel="noopener"><img src="' + esc(p.image) + '" alt="' + esc(p.nom) + '"></a>');
      };
      probe.src = p.image;
    });
  }

  // ---------- Catalogue ----------
  function catName(id) { var c = C.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.nom : ''; }
  function renderChips() {
    var cats = [{ id: 'tout', nom: 'Tout' }].concat(C.categories);
    $('#catbar').innerHTML = cats.map(function (c) {
      return '<button class="cat-link" role="tab" type="button" data-cat="' + esc(c.id) + '" aria-selected="' + (state.cat === c.id && !state.onlyFavs) + '">' + esc(c.nom) + '</button>';
    }).join('') + (C.produits.some(function (p) { return p.ancienPrix; }) ? '<button class="cat-link" role="tab" type="button" data-cat="promo" aria-selected="' + (state.cat === 'promo' && !state.onlyFavs) + '">Promos</button>' : '');
  }

  function filtered() {
    var q = state.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    var list = C.produits.filter(function (p) {
      if (state.onlyFavs) return state.favs.indexOf(p.id) > -1;
      if (state.cat === 'promo') { if (!p.ancienPrix) return false; }
      else if (state.cat !== 'tout' && p.categorie !== state.cat) return false;
      if (!q) return true;
      var hay = (p.nom + ' ' + p.description).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return hay.indexOf(q) > -1;
    });
    if (state.sort === 'asc') list.sort(function (x, y) { return x.prix - y.prix; });
    else if (state.sort === 'desc') list.sort(function (x, y) { return y.prix - x.prix; });
    else if (state.sort === 'promo') list.sort(function (x, y) { return (y.ancienPrix ? 1 : 0) - (x.ancienPrix ? 1 : 0); });
    return list;
  }

  function priceHtml(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '<small>F</small>'; }

  function cardHtml(p) {
    var fav = state.favs.indexOf(p.id) > -1;
    var tag = p.ancienPrix ? '-' + Math.round((1 - p.prix / p.ancienPrix) * 100) + ' %' : p.badge === 'Nouveau' ? 'Nouveau' : '';
    var meta = p.personnalisable ? (p.prixPerso ? 'Personnalisable au prénom' : 'Prénom compris') : catName(p.categorie);
    return '<article class="card">' +
      '<div class="card-media">' +
        '<button class="thumb" type="button" data-open="' + esc(p.id) + '" aria-label="Voir ' + esc(p.nom) + '">' + visual(p) + '</button>' +
        (tag ? '<span class="tag' + (p.ancienPrix ? ' sale' : '') + '">' + tag + '</span>' : '') +
        '<button class="fav" type="button" data-fav="' + esc(p.id) + '" aria-pressed="' + fav + '" aria-label="' + (fav ? 'Retirer des favoris' : 'Ajouter aux favoris') + '">' +
          '<svg viewBox="0 0 24 24"><path d="M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6Z"/></svg></button>' +
        '<button class="quick" type="button" data-quick="' + esc(p.id) + '">' + (p.tailles || p.personnalisable ? 'Personnaliser' : 'Ajouter au panier') + '</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<button class="card-name" type="button" data-open="' + esc(p.id) + '">' + esc(p.nom) + '</button>' +
        '<span class="card-meta">' + esc(meta) + '</span>' +
        '<span class="price">' + fmt(p.prix) + (p.ancienPrix ? ' <s class="old">' + fmt(p.ancienPrix) + '</s>' : '') + '</span>' +
      '</div></article>';
  }

  function renderGrid() {
    var list = filtered();
    $('#grid').innerHTML = list.map(cardHtml).join('');
    $('#empty').hidden = list.length > 0;
    $('#empty').textContent = state.onlyFavs && !list.length ? 'Touchez le cœur d\'un article pour le garder ici.' : 'Aucun article ne correspond. Essayez un autre mot.';
    $('#shop-title').textContent = state.onlyFavs ? 'Mes favoris' : state.cat === 'promo' ? 'Promos' : state.cat === 'tout' ? 'Toute la boutique' : catName(state.cat);
    $('#result-count').textContent = list.length + ' article' + (list.length > 1 ? 's' : '');
  }

  function renderCounts() {
    var n = itemCount(), f = state.favs.length;
    var cc = $('#cart-count'), fc = $('#fav-count');
    cc.hidden = !n; cc.textContent = n;
    fc.hidden = !f; fc.textContent = f;
  }
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  function renderReviews() {
    if (!C.avis || !C.avis.length) return;
    $('#avis').hidden = false;
    $('#review-list').innerHTML = C.avis.map(function (a) {
      var n = Math.max(1, Math.min(5, a.note || 5));
      return '<figure class="review"><span class="stars" aria-label="' + n + ' sur 5">' + '★★★★★'.slice(0, n) + '</span>' +
        '<blockquote style="margin:0">' + esc(a.texte) + '</blockquote><figcaption class="muted">' + esc(a.nom) + (a.ville ? ', ' + esc(a.ville) : '') + '</figcaption></figure>';
    }).join('');
  }

  // ---------- Toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  // ---------- Favoris ----------
  function toggleFav(id) {
    var i = state.favs.indexOf(id);
    if (i > -1) state.favs.splice(i, 1); else { state.favs.push(id); toast('Ajouté à vos favoris ♥'); }
    save(); renderGrid(); renderCounts(); bump($('#btn-favs'));
  }

  // ---------- Fiche article ----------
  var pm = { p: null, taille: '', prenom: '', fil: threads[0].id, qty: 1 };

  function openProduct(id) {
    var p = byId[id]; if (!p) return;
    pm = { p: p, taille: p.tailles ? C.tailles[1] || C.tailles[0] : '', prenom: '', fil: threads[0].id, qty: 1 };
    renderProduct();
    $('#product-modal').showModal();
  }

  function renderProduct() {
    var p = pm.p;
    var thread = threads.filter(function (t) { return t.id === pm.fil; })[0];
    var total = (p.prix + (pm.prenom ? p.prixPerso || 0 : 0)) * pm.qty;
    $('#pm-body').innerHTML =
      '<div class="pm">' +
        '<div class="thumb" style="--tint:' + (tints[p.couleur] || tints.mint) + '">' + visual(p) +
          (p.personnalisable && !p.image ? '<span class="pm-name-preview" id="pm-preview" style="--thread:' + thread.css + '">' + esc(pm.prenom) + '</span>' : '') +
        '</div>' +
        '<div class="pm-in">' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
            '<h3 id="pm-title">' + esc(p.nom) + '</h3>' +
            '<span class="price">' + fmt(p.prix) + (p.ancienPrix ? '<span class="old">' + fmt(p.ancienPrix) + '</span>' : '') + '</span>' +
            '<p class="muted">' + esc(p.description) + '</p>' +
          '</div>' +
          (p.tailles ? '<fieldset class="field"><legend>Taille</legend><div class="opts">' + C.tailles.map(function (t) {
            return '<button type="button" class="opt" data-size="' + esc(t) + '" aria-pressed="' + (pm.taille === t) + '">' + esc(t) + '</button>';
          }).join('') + '</div></fieldset>' : '') +
          (p.personnalisable ?
            '<label class="field" for="pm-prenom"><span>' + esc(p.persoTitre || 'Prénom à broder') + ' <small>(facultatif' + (p.prixPerso ? ', +' + fmt(p.prixPerso) : ', compris dans le prix') + ')</small></span>' +
              '<input class="input" id="pm-prenom" maxlength="' + (p.persoMax || 15) + '" autocomplete="off" placeholder="Ex. : Jared" value="' + esc(pm.prenom) + '"></label>' +
              (p.image ? '<div class="name-chip" aria-live="polite">Aperçu : <span id="pm-preview" style="--thread:' + thread.css + '">' + esc(pm.prenom) + '</span></div>' : '') +
            '<fieldset class="field"><legend>' + esc(p.couleurTitre || 'Couleur du fil') + '</legend><div class="opts">' + threads.map(function (t) {
              return '<button type="button" class="swatch" data-thread="' + t.id + '" aria-pressed="' + (pm.fil === t.id) + '" aria-label="' + t.nom + '" style="background:' + t.css + '"></button>';
            }).join('') + '</div></fieldset>' : '') +
          '<div class="row"><div class="qty" aria-label="Quantité"><button type="button" data-pmqty="-1" aria-label="Moins">−</button><span id="pm-qty">' + pm.qty + '</span><button type="button" data-pmqty="1" aria-label="Plus">+</button></div>' +
          '<span class="price" id="pm-total">' + fmt(total) + '</span></div>' +
          '<button class="btn primary block" type="button" id="pm-add">Ajouter au panier</button>' +
        '</div>' +
      '</div>';
  }

  function updateProductTotals() {
    var p = pm.p;
    $('#pm-total').textContent = fmt((p.prix + (pm.prenom ? p.prixPerso || 0 : 0)) * pm.qty);
    $('#pm-qty').textContent = pm.qty;
    var prev = $('#pm-preview'); if (prev) prev.textContent = pm.prenom;
  }

  function addToCart(id, taille, prenom, fil, qty) {
    var key = [id, taille, prenom, prenom ? fil : ''].join('|');
    var found = state.cart.filter(function (l) { return l.key === key; })[0];
    if (found) found.qty = Math.min(99, found.qty + qty);
    else state.cart.push({ key: key, id: id, taille: taille, prenom: prenom, fil: prenom ? fil : '', qty: qty });
    save(); renderCounts(); bump($('#btn-cart'));
    toast('Ajouté au panier ✓');
  }

  // ---------- Panier ----------
  function threadName(id) { var t = threads.filter(function (x) { return x.id === id; })[0]; return t ? t.nom : ''; }
  function lineDetails(l) {
    var d = [];
    if (l.taille) d.push(l.taille);
    if (l.prenom) d.push('Prénom « ' + l.prenom + ' » ' + (byId[l.id].couleurMot || 'fil') + ' ' + threadName(l.fil).toLowerCase());
    return d.join(' · ');
  }

  function renderCart() {
    var body = $('#cs-body'), foot = $('#cs-foot');
    if (!state.cart.length) {
      body.innerHTML = '<div class="sheet-empty"><p>Votre panier est vide.</p><button class="btn ghost" type="button" data-close-cart>Découvrir les articles</button></div>';
      foot.innerHTML = '';
      return;
    }
    body.innerHTML = state.cart.map(function (l, i) {
      var p = byId[l.id];
      return '<div class="line"><div class="mini" style="--tint:' + (tints[p.couleur] || tints.mint) + '">' + visual(p, 'e') + '</div>' +
        '<div class="line-info"><b>' + esc(p.nom) + '</b><small>' + esc(lineDetails(l)) + '</small><span class="mono">' + fmt(unitPrice(l)) + '</span></div>' +
        '<div class="line-right"><div class="qty"><button type="button" data-lq="' + i + '" data-d="-1" aria-label="Moins">−</button><span>' + l.qty + '</span><button type="button" data-lq="' + i + '" data-d="1" aria-label="Plus">+</button></div>' +
        '<button class="link-btn" type="button" data-rm="' + i + '">Retirer</button></div></div>';
    }).join('');
    var st = subtotal(), goal = C.livraisonGratuiteDes;
    var goalHtml = '';
    if (goal) {
      var pct = Math.min(100, Math.round(st / goal * 100));
      goalHtml = '<div class="goal"><span>' + (st >= goal ? 'Livraison offerte sur cette commande 🎉' : 'Plus que ' + fmt(goal - st) + ' pour la livraison offerte') + '</span>' +
        '<div class="goal-bar"><i style="width:' + pct + '%"></i></div></div>';
    }
    foot.innerHTML = goalHtml +
      '<div class="total-row"><span>Sous-total</span><span>' + fmt(st) + '</span></div>' +
      '<button class="btn primary block" type="button" id="go-checkout">Commander</button>';
  }

  // ---------- Commande ----------
  var order = { step: 1, nom: '', tel: '', livraison: C.livraison[0].id, adresse: '', note: '', pay: '', ref: '', payTel: '', no: '' };
  try { var draft = store.get('pn_client', null); if (draft) { order.nom = draft.nom || ''; order.tel = draft.tel || ''; order.adresse = draft.adresse || ''; } } catch (e) { /* ignore */ }

  function shipCost() {
    var l = C.livraison.filter(function (x) { return x.id === order.livraison; })[0] || C.livraison[0];
    if (C.livraisonGratuiteDes && subtotal() >= C.livraisonGratuiteDes) return 0;
    return l.prix;
  }
  function grandTotal() { return subtotal() + shipCost(); }
  // Paiement en ligne CinetPay (vérification automatique) ou paiement manuel par référence
  var CP = !!(C.cinetpay && C.cinetpay.actif);
  // Paiement à la livraison : seulement si aucun article n'est personnalisé (un article au prénom se paie avant)
  function livraisonPossible() {
    return !!(C.paiementLivraison && C.paiementLivraison.actif) && state.cart.every(function (l) { return !l.prenom; });
  }
  function methods() {
    var m = [];
    if (C.wave.actif) m.push('wave');
    if (C.orangeMoney.actif) m.push('om');
    if (livraisonPossible()) m.push('livraison');
    return m;
  }
  var PAY_NOMS = { wave: 'Wave', om: 'Orange Money', livraison: 'À la livraison' };
  var PAY_COULEURS = { wave: 'var(--wave)', om: 'var(--orange)', livraison: 'var(--gold)' };

  function openCheckout() {
    // Connexion Google obligatoire avant de payer, dès que le module de connexion est actif (auth.js)
    var b = document.body.classList;
    if (b.contains('cm-auth') && !b.contains('cm-logged')) {
      $('#cart-sheet').close();
      document.dispatchEvent(new CustomEvent('cm:need-login'));
      return;
    }
    order.step = 1;
    if (!order.pay || methods().indexOf(order.pay) === -1) order.pay = methods()[0];
    $('#cart-sheet').close();
    renderCheckout();
    $('#checkout').showModal();
  }

  function setProgress() {
    $$('#co-progress li').forEach(function (li, i) { li.classList.toggle('on', i < order.step); });
  }

  function recapHtml() {
    var ship = shipCost();
    return '<div class="recap">' + state.cart.map(function (l) {
      return '<div class="row"><span>' + l.qty + ' × ' + esc(byId[l.id].nom) + '</span><span>' + fmt(unitPrice(l) * l.qty) + '</span></div>';
    }).join('') +
      '<div class="row"><span>Livraison</span><span>' + (ship ? fmt(ship) : 'Offerte') + '</span></div>' +
      '<div class="row grand"><span>Total à payer</span><span>' + fmt(grandTotal()) + '</span></div></div>';
  }

  function renderCheckout() {
    setProgress();
    var b = $('#co-body');
    if (order.step === 1) {
      b.innerHTML = '<form class="co" id="co-form" novalidate>' +
        '<h3 id="co-title">Vos coordonnées</h3>' +
        '<label class="field" for="co-nom"><span>Nom et prénom</span><input class="input" id="co-nom" required maxlength="60" autocomplete="name" value="' + esc(order.nom) + '"></label>' +
        '<label class="field" for="co-tel"><span>Téléphone (WhatsApp de préférence)</span><input class="input" id="co-tel" type="tel" required maxlength="20" inputmode="tel" autocomplete="tel" placeholder="07 00 00 00 00" value="' + esc(order.tel) + '"></label>' +
        '<fieldset class="field"><legend>Livraison</legend>' + C.livraison.map(function (l) {
          return '<label class="radio-card"><input type="radio" name="liv" value="' + esc(l.id) + '"' + (order.livraison === l.id ? ' checked' : '') + '>' +
            '<div><b>' + esc(l.nom) + '</b><small>' + esc(l.detail) + '</small></div><span class="mono">' + (l.prix ? fmt(l.prix) : 'Gratuit') + '</span></label>';
        }).join('') + (C.livraisonGratuiteDes && subtotal() >= C.livraisonGratuiteDes ? '<small class="muted">Livraison offerte : votre panier dépasse ' + fmt(C.livraisonGratuiteDes) + '.</small>' : '') + '</fieldset>' +
        '<label class="field" for="co-adr" id="adr-field"><span>Adresse de livraison : ville, quartier et point de repère</span><input class="input" id="co-adr" maxlength="120" autocomplete="street-address" placeholder="Ex. : Cocody Angré, près de la pharmacie…" value="' + esc(order.adresse) + '"></label>' +
        '<label class="field" for="co-note"><span>Message pour la vendeuse <small>(facultatif)</small></span><textarea class="input" id="co-note" rows="2" maxlength="300">' + esc(order.note) + '</textarea></label>' +
        '<p class="err-msg" id="co-err" hidden></p>' +
        '<button class="btn primary block" type="submit">Continuer vers le paiement</button>' +
      '</form>';
    } else if (order.step === 2 && CP) {
      b.innerHTML = '<form class="co" id="cp-form" novalidate>' +
        '<h3 id="co-title">Paiement</h3>' + recapHtml() +
        '<div class="pay-box"><b>Paiement sécurisé par CinetPay</b>' +
          '<p>Vous allez sur la page de paiement CinetPay, vous payez depuis votre téléphone, puis vous revenez ici automatiquement.</p>' +
          '<p class="pay-logos"><span><i style="background:var(--wave)"></i>Wave</span><span><i style="background:var(--orange)"></i>Orange Money</span><span><i style="background:#ffcc00"></i>MTN</span><span><i style="background:#0066b3"></i>Moov</span><span><i style="background:var(--ink)"></i>Carte bancaire</span></p>' +
        '</div>' +
        '<p class="note">Le paiement est vérifié automatiquement. Personne ne vous demandera votre code secret : vous le tapez seulement sur votre téléphone.</p>' +
        '<p class="err-msg" id="co-err" hidden></p>' +
        '<div class="actions"><button class="btn primary block" type="submit" id="cp-go">Payer ' + fmt(grandTotal()) + '</button>' +
        '<button class="btn ghost block" type="button" data-back>Retour</button></div>' +
      '</form>';
    } else if (order.step === 3 && order.cp) {
      b.innerHTML = cpResultHtml();
    } else if (order.step === 2) {
      var m = methods();
      var amount = fmt(grandTotal());
      var box = '';
      if (order.pay === 'wave') {
        box = '<div class="pay-box"><b>Payer avec Wave</b><ol>' +
          (C.wave.lien ? '<li>Touchez le bouton bleu ci-dessous : l\'application Wave s\'ouvre.</li>' : '<li>Ouvrez votre application Wave et choisissez « Envoyer ».</li>') +
          '<li>Envoyez exactement <b>' + amount + '</b> au numéro ci-dessous (' + esc(C.wave.nomCompte) + ').</li>' +
          '<li>Recopiez la référence de la transaction reçue par SMS ou dans l\'historique Wave.</li></ol>' +
          copyRow('Numéro Wave', C.wave.numero) + copyRow('Montant', String(grandTotal())) +
          (C.wave.lien ? '<a class="btn wave block" href="' + esc(C.wave.lien) + '" target="_blank" rel="noopener">Ouvrir Wave</a>' : '') + '</div>';
      } else if (order.pay === 'livraison') {
        box = '<div class="pay-box"><b>Payer à la livraison</b>' +
          '<p>Vous payez le livreur quand il vous remet le colis : par Wave, Orange Money ou en espèces.</p>' +
          '<p>Préparez <b>' + amount + '</b>. Maty vous appelle ou vous écrit pour confirmer la livraison.</p></div>';
      } else {
        box = '<div class="pay-box"><b>Payer avec Orange Money</b><ol>' +
          '<li>Composez <b>' + esc(C.orangeMoney.codeMenu) + '</b> sur votre téléphone, ou ouvrez l\'application Orange Money.</li>' +
          '<li>Choisissez « Transfert d\'argent » et envoyez <b>' + amount + '</b> au numéro ci-dessous (' + esc(C.orangeMoney.nomCompte) + ').</li>' +
          '<li>Validez avec votre code secret <b>sur votre téléphone uniquement</b>, puis recopiez la référence reçue par SMS.</li></ol>' +
          copyRow('Numéro Orange Money', C.orangeMoney.numero) + copyRow('Montant', String(grandTotal())) + '</div>';
      }
      b.innerHTML = '<form class="co" id="pay-form" novalidate>' +
        '<h3 id="co-title">Paiement</h3>' + recapHtml() +
        (m.length > 1 ? '<div class="pay-tabs n' + m.length + '">' + m.map(function (k) {
          return '<button type="button" class="pay-tab" data-pay="' + k + '" aria-pressed="' + (order.pay === k) + '"><span class="dot" style="background:' + PAY_COULEURS[k] + '"></span>' + PAY_NOMS[k] + '</button>';
        }).join('') + '</div>' : '') +
        (!livraisonPossible() && C.paiementLivraison && C.paiementLivraison.actif ? '<p class="muted" style="font-size:.85rem">Les articles personnalisés au prénom se paient avant la préparation.</p>' : '') +
        box +
        (order.pay === 'livraison' ? '' :
          '<label class="field" for="co-ref"><span>Référence de la transaction</span><input class="input" id="co-ref" required maxlength="40" autocomplete="off" placeholder="Ex. : T240512.1532.A12345" value="' + esc(order.ref) + '"></label>' +
          '<label class="field" for="co-paytel"><span>Numéro qui a payé</span><input class="input" id="co-paytel" type="tel" required maxlength="20" inputmode="tel" value="' + esc(order.payTel || order.tel) + '"></label>' +
          '<p class="note">Personne ne vous demandera jamais votre code secret. Ne le donnez à personne, même par téléphone. Chaque référence ne peut servir qu\'une seule fois.</p>') +
        '<p class="err-msg" id="co-err" hidden></p>' +
        '<div class="actions"><button class="btn primary block" type="submit" id="pay-go">' + (order.pay === 'livraison' ? 'Valider ma commande' : 'J\'ai payé, valider ma commande') + '</button>' +
        '<button class="btn ghost block" type="button" data-back>Retour</button></div>' +
      '</form>';
    } else {
      b.innerHTML = '<div class="co" style="align-items:center;text-align:center">' +
        '<div class="done-mark" aria-hidden="true">✓</div>' +
        '<h3 id="co-title">Dernière étape : envoyez votre commande</h3>' +
        '<p class="muted">Numéro de commande</p><p class="order-no">' + esc(order.no) + '</p>' +
        '<p>Touchez le bouton vert pour envoyer le détail à ' + esc(C.nom) + ' sur WhatsApp. ' +
          (order.pay === 'livraison'
            ? 'Préparez ' + fmt(grandTotal()) + ' pour le livreur, qui vous apporte le colis sous 24 h.'
            : 'Maty vérifie le paiement, puis un livreur vous apporte le colis sous 24 h.') +
          ' Suivez l\'avancement dans « Compte », puis « Mes commandes ».</p>' +
        '<div class="actions" style="width:100%"><a class="btn wa block" id="send-wa" href="' + waLink() + '" target="_blank" rel="noopener">Envoyer sur WhatsApp</a>' +
        '<p class="muted" style="font-size:.88rem">WhatsApp ne s\'ouvre pas ? Écrivez au <b class="mono">+' + esc(C.whatsapp) + '</b> en donnant le numéro de commande.</p>' +
        '<button class="btn ghost block" type="button" data-finish>Retour à la boutique</button></div>' +
      '</div>';
    }
  }

  // Codes CinetPay -> noms lisibles
  function moyenNom(code) {
    var c = String(code || '').toUpperCase();
    if (/WAVE/.test(c)) return 'Wave';
    if (/^OM|ORANGE/.test(c)) return 'Orange Money';
    if (/MOMO|MTN/.test(c)) return 'MTN Mobile Money';
    if (/FLOOZ|MOOV/.test(c)) return 'Moov Money';
    if (/CARD|VISA|MASTER/.test(c)) return 'carte bancaire';
    return c ? code : '';
  }

  function cpResultHtml() {
    var st = order.cp.statut;
    var head = '<div class="co" style="align-items:center;text-align:center">';
    var back = '<button class="btn ghost block" type="button" data-finish>Retour à la boutique</button>';
    if (st === 'verif') {
      return head + '<div class="spinner" aria-hidden="true"></div><h3 id="co-title">Vérification du paiement…</h3><p class="muted">Nous demandons à CinetPay si votre paiement est bien arrivé.</p></div>';
    }
    if (st === 'paye') {
      return head + '<div class="done-mark" aria-hidden="true">✓</div>' +
        '<h3 id="co-title">Paiement reçu, merci !</h3>' +
        '<p class="muted">Commande</p><p class="order-no">' + esc(order.no) + '</p>' +
        '<p>' + fmt(order.cp.montant || grandTotal()) + ' payés' + (order.cp.moyen ? ' par ' + esc(moyenNom(order.cp.moyen)) : '') + '. Maty prépare votre colis, un livreur vous l\'apporte sous 24 h.</p>' +
        '<div class="actions" style="width:100%"><a class="btn wa block" id="send-wa" href="' + waLink() + '" target="_blank" rel="noopener">Envoyer le détail à Maty sur WhatsApp</a>' + back + '</div></div>';
    }
    if (st === 'attente') {
      return head + '<h3 id="co-title">Paiement en attente</h3>' +
        '<p class="muted">Si vous venez de valider sur votre téléphone, patientez quelques secondes puis vérifiez à nouveau. Votre panier est gardé.</p>' +
        '<div class="actions" style="width:100%"><button class="btn primary block" type="button" data-cp-check>Vérifier à nouveau</button>' +
        '<button class="btn ghost block" type="button" data-cp-retry>Recommencer le paiement</button></div></div>';
    }
    if (st === 'echec') {
      return head + '<h3 id="co-title">Le paiement n\'a pas abouti</h3>' +
        '<p class="muted">Le paiement a été refusé ou annulé. Votre panier est gardé, vous pouvez réessayer.</p>' +
        '<div class="actions" style="width:100%"><button class="btn primary block" type="button" data-cp-retry>Réessayer le paiement</button>' + back + '</div></div>';
    }
    return head + '<h3 id="co-title">Vérification impossible pour le moment</h3>' +
      '<p class="muted">' + esc(order.cp.erreur || 'Vérifiez votre connexion internet.') + ' Si vous avez payé, gardez ce numéro : <b class="mono">' + esc(order.no) + '</b>.</p>' +
      '<div class="actions" style="width:100%"><button class="btn primary block" type="button" data-cp-check>Vérifier à nouveau</button>' +
      '<a class="btn ghost block" href="https://wa.me/' + esc(C.whatsapp) + '?text=' + encodeURIComponent('Bonjour Chez Maty, j\'ai payé la commande ' + order.no + ' mais le site n\'a pas pu le vérifier.') + '" target="_blank" rel="noopener">Écrire à Maty</a></div></div>';
  }

  function startCinetPay() {
    var btn = $('#cp-go');
    btn.disabled = true; btn.textContent = 'Connexion à CinetPay…';
    var client = { nom: order.nom, tel: order.tel, adresse: order.adresse, note: order.note, email: order.email || '' };
    var payload = {
      articles: state.cart.map(function (l) { return { id: l.id, qty: l.qty, taille: l.taille, prenom: l.prenom, fil: l.fil }; }),
      livraison: order.livraison, client: client
    };
    fetch('/.netlify/functions/paiement-creer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) {
        // Fonctions absentes (site publié sans elles) ou clés CinetPay pas encore enregistrées : on repasse au paiement manuel
        var json = /json/.test(r.headers.get('Content-Type') || '');
        if ([404, 405, 501, 503].indexOf(r.status) > -1 || !json) return { fallback: true };
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (x) {
        if (x.fallback) {
          CP = false; order.pay = methods()[0]; renderCheckout();
          toast('Paiement en ligne indisponible : payez par Wave ou Orange Money.');
          return;
        }
        if (!x.ok || !x.d.payment_url) throw new Error(x.d.erreur || 'Le paiement n\'a pas pu démarrer. Réessayez.');
        if (!/^https:\/\/([a-z0-9-]+\.)*cinetpay\.(com|net|co)\//.test(x.d.payment_url)) throw new Error('Adresse de paiement inattendue. Réessayez.');
        store.set('cm_pending', { no: x.d.no, client: client, livraison: order.livraison, cart: state.cart });
        window.location.href = x.d.payment_url;
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = 'Payer ' + fmt(grandTotal());
        showErr(e && e.message ? e.message : 'Le service de paiement ne répond pas. Réessayez.');
      });
  }

  // Paiement CinetPay confirmé : la commande est enregistrée avec la transaction comme référence unique
  function emitOrder() {
    order.pay = 'cinetpay'; order.ref = order.no; order.payTel = order.tel;
    var commande = commandeAEnregistrer();   // copie faite maintenant : le panier est vidé juste après
    var send = function () {
      document.dispatchEvent(new CustomEvent('cm:save-order', { detail: { commande: commande, done: function () {} } }));
    };
    if (document.body.classList.contains('cm-logged')) send();
    else document.addEventListener('cm:profile', function once() { document.removeEventListener('cm:profile', once); setTimeout(send, 0); });
  }

  function checkPayment() {
    order.cp = { statut: 'verif' }; renderCheckout();
    fetch('/.netlify/functions/paiement-verifier?id=' + encodeURIComponent(order.no))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        order.cp = { statut: d.statut || 'erreur', montant: d.montant, moyen: d.moyen, erreur: d.erreur };
        if (d.statut === 'paye') {
          store.set('cm_pending', null);
          emitOrder();
        }
        renderCheckout();
        // payé : le panier est vidé tout de suite (le message WhatsApp est déjà préparé)
        if (d.statut === 'paye') { state.cart = []; save(); renderCounts(); }
      })
      .catch(function () { order.cp = { statut: 'erreur' }; renderCheckout(); });
  }

  // Retour depuis la page CinetPay : /?paiement=CM...
  function handlePaymentReturn() {
    var m = /[?&]paiement=(CM\d{6}[A-F0-9]{6})(&|$)/.exec(location.search);
    if (!m) return;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    var p = store.get('cm_pending', null) || {};
    order.no = m[1];
    if (p.no === m[1]) {
      var c = p.client || {};
      ['nom', 'tel', 'adresse', 'note', 'email'].forEach(function (k) { if (c[k]) order[k] = clean(c[k], 300); });
      if (p.livraison) order.livraison = p.livraison;
      if (Array.isArray(p.cart)) {
        var saved = p.cart.filter(function (l) { return l && byId[l.id] && l.qty > 0 && l.qty < 100; });
        if (saved.length) state.cart = saved;
      }
    }
    order.step = 3;
    $('#checkout').showModal();
    checkPayment();
  }

  function copyRow(label, value) {
    return '<div class="copy-row"><div><small>' + esc(label) + '</small><span class="mono">' + esc(value) + '</span></div>' +
      '<button type="button" class="copy-btn" data-copy="' + esc(value) + '">Copier</button></div>';
  }

  function orderText() {
    var lines = [(order.cp && order.cp.statut === 'paye' ? '✅ *Commande PAYÉE ' : order.pay === 'livraison' ? '🛍️ *Nouvelle commande (paiement à la livraison) ' : '🛍️ *Nouvelle commande ') + order.no + '*', ''];
    state.cart.forEach(function (l) {
      var p = byId[l.id];
      lines.push('• ' + l.qty + ' × ' + p.nom + ' — ' + fmt(unitPrice(l) * l.qty));
      var d = lineDetails(l); if (d) lines.push('   ' + d);
    });
    var liv = C.livraison.filter(function (x) { return x.id === order.livraison; })[0];
    var ship = shipCost();
    lines.push('', 'Livraison : ' + liv.nom + ' (' + (ship ? fmt(ship) : 'offerte') + ')');
    if (order.cp && order.cp.statut === 'paye') {
      lines.push('*Total payé : ' + fmt(order.cp.montant || grandTotal()) + '*');
      lines.push('Paiement en ligne CinetPay vérifié' + (order.cp.moyen ? ' (' + moyenNom(order.cp.moyen) + ')' : '') + ', transaction ' + order.no + '. Visible dans votre espace CinetPay.');
    } else {
      if (order.pay === 'livraison') {
        lines.push('*Total à encaisser à la livraison : ' + fmt(grandTotal()) + '*');
      } else {
        lines.push('*Total payé : ' + fmt(grandTotal()) + '*');
        lines.push('Paiement : ' + PAY_NOMS[order.pay] + ', réf. ' + order.ref + ', depuis le ' + order.payTel);
        lines.push('⚠️ À vérifier dans votre application ' + PAY_NOMS[order.pay] + ' avant de livrer.');
      }
    }
    lines.push('', 'Client : ' + order.nom, 'Tél : ' + order.tel);
    if (order.email) lines.push('Compte Google : ' + order.email);
    lines.push('Adresse : ' + order.adresse);
    if (order.note) lines.push('Note : ' + order.note);
    return lines.join('\n');
  }
  function waLink() { return 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(orderText()); }

  function showErr(msg, field) {
    var e = $('#co-err'); e.textContent = msg; e.hidden = false;
    $$('.input.err').forEach(function (x) { x.classList.remove('err'); });
    if (field) { field.classList.add('err'); field.focus(); }
  }
  function validPhone(t) { return /^\+?[0-9 ]{8,16}$/.test(t); }

  function submitStep1() {
    order.nom = clean($('#co-nom').value, 60);
    order.tel = clean($('#co-tel').value, 20);
    order.adresse = clean($('#co-adr').value, 120);
    order.note = clean($('#co-note').value, 300);
    if (order.nom.length < 2) return showErr('Indiquez votre nom.', $('#co-nom'));
    if (!validPhone(order.tel)) return showErr('Indiquez un numéro de téléphone valide (8 chiffres minimum).', $('#co-tel'));
    if (order.adresse.length < 3) return showErr('Indiquez votre ville et votre quartier pour que le livreur vous trouve.', $('#co-adr'));
    store.set('pn_client', { nom: order.nom, tel: order.tel, adresse: order.adresse });
    order.step = 2; renderCheckout(); $('#checkout').scrollTop = 0;
  }
  // Référence normalisée : sert d'identifiant unique dans la base (une seule utilisation)
  // (seuls les lettres et chiffres comptent : « CI24.1532 A1 » et « ci24 1532-a1 » sont la même référence)
  function refId(ref) { return String(ref).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 60); }

  function commandeAEnregistrer() {
    var manuel = order.pay !== 'livraison';
    return {
      no: order.no, nom: order.nom, tel: order.tel, adresse: order.adresse, note: order.note || '',
      articles: state.cart.map(function (l) {
        return { id: l.id, nom: byId[l.id].nom, qty: l.qty, taille: l.taille || '', prenom: l.prenom || '', fil: l.fil || '', unit: unitPrice(l) };
      }),
      sousTotal: subtotal(), livraison: shipCost(), total: grandTotal(),
      paiement: manuel
        ? { mode: order.pay, ref: order.ref, refId: refId(order.ref), payTel: order.payTel }
        : { mode: 'livraison' },
      statut: manuel ? 'en_attente_paiement' : 'a_payer_livraison'
    };
  }

  // Enregistre la commande via auth.js (Firebase). Sans module de connexion actif, on continue sans base.
  function enregistrerCommande(cb) {
    if (!document.body.classList.contains('cm-auth')) { cb(null); return; }
    var fini = false;
    var t = setTimeout(function () { if (!fini) { fini = true; cb('reseau'); } }, 15000);
    document.dispatchEvent(new CustomEvent('cm:save-order', { detail: {
      commande: commandeAEnregistrer(),
      done: function (err) { if (fini) return; fini = true; clearTimeout(t); cb(err); }
    } }));
  }

  function submitStep2() {
    if (order.pay !== 'livraison') {
      order.ref = clean($('#co-ref').value, 40);
      order.payTel = clean($('#co-paytel').value, 20);
      if (refId(order.ref).length < 4) return showErr('Recopiez la référence de la transaction reçue par SMS.', $('#co-ref'));
      if (!validPhone(order.payTel)) return showErr('Indiquez le numéro qui a fait le paiement.', $('#co-paytel'));
    } else if (!livraisonPossible()) {
      order.pay = methods()[0]; renderCheckout(); return;
    }
    var d = new Date();
    order.no = 'CM-' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
    var btn = $('#pay-go'); var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Enregistrement de la commande…';
    enregistrerCommande(function (err) {
      if (err) {
        btn.disabled = false; btn.textContent = label;
        if (err === 'reference_deja_utilisee') return showErr('Cette référence a déjà été utilisée pour une commande. Vérifiez-la dans votre SMS de paiement.', $('#co-ref'));
        if (err === 'non_connectee') return showErr('Votre session a expiré. Fermez cette fenêtre et reconnectez-vous avec Google.');
        return showErr('La commande n\'a pas pu être enregistrée. Vérifiez votre connexion internet et réessayez.');
      }
      order.step = 3; renderCheckout(); $('#checkout').scrollTop = 0;
    });
  }
  function finishOrder() {
    state.cart = []; order.ref = ''; order.note = ''; order.step = 1; order.cp = null;
    save(); renderCounts();
    $('#checkout').close();
  }

  // Coordonnées du compte client (auth.js) : on pré-remplit sans écraser ce qui est déjà tapé
  document.addEventListener('cm:resume-checkout', function () { if (state.cart.length) openCheckout(); });
  document.addEventListener('cm:profile', function (e) {
    var p = e.detail || {};
    order.email = clean(p.email, 80);
    if (!order.nom && p.nom) order.nom = clean(p.nom, 60);
    if (!order.tel && p.tel) order.tel = clean(p.tel, 20);
    if (!order.adresse && p.adresse) order.adresse = clean(p.adresse, 120);
    var dlg = $('#checkout');
    if (dlg.open && order.step === 1) {
      ['nom', 'tel', 'adr'].forEach(function (k) {
        var el = $('#co-' + k), v = k === 'adr' ? order.adresse : order[k];
        if (el && !el.value) el.value = v;
      });
    }
  });

  // ---------- Copier ----------
  function copy(btn) {
    var v = btn.getAttribute('data-copy');
    var done = function () { btn.textContent = 'Copié ✓'; setTimeout(function () { btn.textContent = 'Copier'; }, 1600); };
    try {
      navigator.clipboard.writeText(v).then(done, function () { selectText(btn); });
    } catch (e) { selectText(btn); }
  }
  function selectText(btn) {
    var span = btn.parentNode.querySelector('.mono');
    var r = document.createRange(); r.selectNodeContents(span);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    toast('Numéro sélectionné, copiez-le avec un appui long');
  }

  // ---------- Événements ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a');
    if (!t) return;
    var d = t.dataset;
    if (d.cat) {
      state.onlyFavs = d.cat === 'favs';
      if (!state.onlyFavs) state.cat = d.cat;
      renderChips(); renderGrid(); $('#boutique').scrollIntoView();
    } else if (d.catJump) {
      state.cat = d.catJump; state.onlyFavs = false; renderChips(); renderGrid();
      $('#boutique').scrollIntoView();
    } else if (d.fav) toggleFav(d.fav);
    else if (d.open) openProduct(d.open);
    else if (d.quick) {
      var p = byId[d.quick];
      if (p.tailles || p.personnalisable) openProduct(p.id);
      else addToCart(p.id, '', '', '', 1);
    } else if (d.size) { pm.taille = d.size; $$('[data-size]').forEach(function (b) { b.setAttribute('aria-pressed', b === t); }); }
    else if (d.thread) {
      pm.fil = d.thread;
      $$('[data-thread]').forEach(function (b) { b.setAttribute('aria-pressed', b === t); });
      var prev = $('#pm-preview'); if (prev) prev.style.setProperty('--thread', threads.filter(function (x) { return x.id === pm.fil; })[0].css);
    } else if (d.pmqty) { pm.qty = Math.max(1, Math.min(20, pm.qty + Number(d.pmqty))); updateProductTotals(); }
    else if (t.id === 'pm-add') {
      addToCart(pm.p.id, pm.taille, pm.p.personnalisable ? pm.prenom : '', pm.fil, pm.qty);
      $('#product-modal').close();
    } else if (t.id === 'btn-search') {
      var row = $('#search-row'); row.hidden = !row.hidden;
      if (!row.hidden) $('#q').focus();
    } else if (t.id === 'btn-cart') { renderCart(); $('#cart-sheet').showModal(); }
    else if (t.id === 'btn-favs') {
      state.onlyFavs = true; renderChips(); renderGrid(); $('#boutique').scrollIntoView();
    } else if (d.lq) {
      var l = state.cart[Number(d.lq)];
      l.qty = Math.max(0, Math.min(99, l.qty + Number(d.d)));
      if (!l.qty) state.cart.splice(Number(d.lq), 1);
      save(); renderCart(); renderCounts();
    } else if (d.rm) { state.cart.splice(Number(d.rm), 1); save(); renderCart(); renderCounts(); }
    else if (d.closeCart !== undefined) $('#cart-sheet').close();
    else if (t.id === 'go-checkout') openCheckout();
    else if (d.pay) { order.ref = clean(($('#co-ref') || {}).value, 40); order.pay = d.pay; renderCheckout(); }
    else if (d.back !== undefined) { order.step = 1; renderCheckout(); }
    else if (d.copy) copy(t);
    else if (d.finish !== undefined) {
      if (order.cp && order.cp.statut !== 'paye') { order.cp = null; order.step = 1; $('#checkout').close(); }
      else finishOrder();
    }
    else if (d.cpCheck !== undefined) checkPayment();
    else if (d.cpRetry !== undefined) { order.cp = null; order.step = 2; renderCheckout(); }
    else if (t.id === 'send-wa') { setTimeout(function () { state.cart = []; save(); renderCounts(); }, 500); }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { state.q = e.target.value.slice(0, 40); renderGrid(); }
    else if (e.target.id === 'pm-prenom') { pm.prenom = clean(e.target.value, pm.p.persoMax || 15); updateProductTotals(); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'sort') { state.sort = e.target.value; renderGrid(); return; }
    if (e.target.name === 'liv') {
      order.livraison = e.target.value;
      $('#adr-field').hidden = order.livraison === 'retrait';
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'co-form') { e.preventDefault(); submitStep1(); }
    else if (e.target.id === 'pay-form') { e.preventDefault(); submitStep2(); }
    else if (e.target.id === 'cp-form') { e.preventDefault(); startCinetPay(); }
  });
  // Fermer une fenêtre en touchant le fond
  $$('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  });

  // Photo manquante : on affiche le monogramme Maty à la place
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG' || img.closest('.ph')) return;
    var tile = img.closest('.insta-tile, .hp');
    if (tile) { tile.remove(); return; }
    var tmp = document.createElement('div'); tmp.innerHTML = PH;
    img.replaceWith(tmp.firstChild);
  }, true);

  // ---------- Démarrage ----------
  fillShopInfo();
  renderBanners();
  renderInsta();
  rotateHeroName();
  renderChips();
  renderGrid();
  renderCounts();
  renderReviews();
  if (CP) handlePaymentReturn();
})();
