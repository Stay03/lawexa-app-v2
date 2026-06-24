/*
 * Lawexa Ambassadors — thin same-origin integration layer.
 *
 * This page is served statically at lawexa.com/ambassadors. Sharing the origin
 * with the main app lets it read the logged-in session directly. Flow:
 *   1. Logged out / guest  -> "Sign in / Create account" gate.
 *   2. Logged in           -> a "Continue with Lawexa" account card showing the
 *                             user's profile, with Continue / Change account.
 *   3. Continue            -> a slim form that only asks for what the account
 *                             doesn't already have; submit fills the rest from
 *                             the account. Existing application -> status card.
 *
 * The marketing page and the wizard UI are untouched; we just hide the fields
 * we already know and orchestrate the gating.
 */
(function () {
  'use strict';

  // The API lives on a sibling host (the app calls it the same way, with a
  // bearer token — no cookies — so cross-origin is already CORS-allowed).
  function apiBase() {
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000/api';
    return 'https://prod-api.lawexa.com/api';
  }
  var API = apiBase();
  var RETURN_TO = '/ambassadors';
  var cachedUser = null; // populated from /auth/me, used to fill the submit body

  // The app persists auth via zustand under localStorage["lawexa-auth"]:
  //   { state: { user, token, isAuthenticated, isGuest, ... }, version }
  function getSession() {
    try {
      var raw = localStorage.getItem('lawexa-auth');
      if (!raw) return null;
      var s = JSON.parse(raw).state;
      return s && s.token ? s : null;
    } catch (e) {
      return null;
    }
  }

  // Forward any incoming referral/utm params into the signup flow so the
  // 10-free-messages reward can be attributed when a friend signs up.
  function forwardedParams() {
    var inc = new URLSearchParams(location.search);
    var keep = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'referral_code'];
    var out = '';
    keep.forEach(function (k) {
      var v = inc.get(k);
      if (v) out += '&' + k + '=' + encodeURIComponent(v);
    });
    return out;
  }
  function loginUrl() { return '/login?redirect=' + encodeURIComponent(RETURN_TO) + forwardedParams(); }
  function registerUrl() { return '/register?redirect=' + encodeURIComponent(RETURN_TO) + forwardedParams(); }

  function authedFetch(path, opts) {
    opts = opts || {};
    var s = getSession();
    var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(API + path, Object.assign({}, opts, { headers: headers }));
  }

  // ---- DOM helpers ----
  function esc(s) {
    return ('' + (s == null ? '' : s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function hideField(inputId) {
    var el = document.getElementById(inputId);
    if (!el) return;
    var field = el.closest('.field') || el.closest('.chips-field');
    if (field) {
      field.style.display = 'none';
      field.removeAttribute('data-required'); // so the wizard won't validate a hidden field
    }
  }
  function initials(name) {
    var parts = ('' + (name || '')).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || 'L';
  }

  // ---- Cards rendered into the form card ----
  function formCard() {
    var form = document.getElementById('ambForm');
    return (form && form.parentElement) || document.querySelector('.formcard');
  }
  function clearInjected() {
    ['ambGate', 'ambAccount'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function showGate(title, msg, primary, secondary) {
    var form = document.getElementById('ambForm');
    var success = document.getElementById('success');
    if (form) form.style.display = 'none';
    if (success) success.classList.remove('show');
    var card = formCard();
    if (!card) return;
    clearInjected();
    var btns = '';
    if (primary) btns += '<a href="' + primary.href + '" class="btn btn-gold btn-lg" style="margin:6px">' + esc(primary.label) + '</a>';
    if (secondary) btns += '<a href="' + secondary.href + '" class="btn btn-ghost btn-lg" style="margin:6px">' + esc(secondary.label) + '</a>';
    var box = document.createElement('div');
    box.id = 'ambGate';
    box.style.cssText = 'text-align:center;padding:34px 8px;';
    box.innerHTML =
      '<h3 style="font-family:var(--font-display);font-weight:700;color:var(--ink-black);font-size:28px;margin:0 0 10px">' + esc(title) + '</h3>' +
      '<p style="font-size:16px;color:var(--ink-700);max-width:440px;margin:0 auto 20px;line-height:1.6">' + msg + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:center">' + btns + '</div>';
    card.appendChild(box);
  }

  // Returns true if an existing application gates the form (hides it).
  function showStatus(app) {
    if (app.status === 'rejected') return false; // allow a fresh application
    var title = app.status === 'approved' ? 'You’re in!' : 'Application received';
    var msg = app.status === 'approved'
      ? 'Your ambassador application has been <b>approved</b>. Our team will reach out with next steps — keep an eye on your inbox.'
      : 'Your application is <b>' + esc(app.status_label || 'pending') + '</b> and under review. We review weekly, so you’ll hear from us by email soon.';
    showGate(title, msg, null, null);
    return true;
  }

  // The "Continue with Lawexa" account card.
  function renderAccountCard(user) {
    var card = formCard();
    if (!card) return;
    var form = document.getElementById('ambForm');
    if (form) form.style.display = 'none';
    clearInjected();

    var p = user.profile || {};
    var details = [];
    if (p.country) details.push(esc(p.country));
    if (p.university) details.push(esc(p.university));
    var detailLine = details.length
      ? '<p style="font-size:13.5px;color:var(--ink-500);margin:14px 0 0">We’ll use these from your Lawexa account: <b style="color:var(--ink-700)">' + details.join(' · ') + '</b></p>'
      : '';

    var unverified = user.auth_provider === 'email' && user.is_verified === false;

    var avatar = user.avatar_url
      ? '<img src="' + esc(user.avatar_url) + '" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none">'
      : '<div style="width:56px;height:56px;border-radius:50%;background:var(--gold);color:var(--ink-black);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:22px;flex:none">' + esc(initials(user.name)) + '</div>';

    var action = unverified
      ? '<a href="/check-email" class="btn btn-gold btn-lg" style="width:100%;margin-top:22px">Verify your email to apply</a>' +
        '<p style="font-size:13px;color:var(--ink-500);margin:12px 0 0;text-align:center">Your email isn’t verified yet — verify it, then come back to apply.</p>'
      : '<button type="button" id="ambContinue" class="btn btn-gold btn-lg" style="width:100%;margin-top:22px">Continue as ' + esc((user.name || '').split(' ')[0] || 'me') + '</button>';

    var box = document.createElement('div');
    box.id = 'ambAccount';
    box.innerHTML =
      '<p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-deep);margin:0 0 14px">Applying with Lawexa</p>' +
      '<div style="display:flex;align-items:center;gap:14px">' +
        avatar +
        '<div style="min-width:0">' +
          '<div style="font-family:var(--font-display);font-weight:700;font-size:20px;color:var(--ink-black);line-height:1.2">' + esc(user.name || 'Your account') + '</div>' +
          '<div style="font-size:14px;color:var(--ink-500);overflow:hidden;text-overflow:ellipsis">' + esc(user.email || '') + '</div>' +
        '</div>' +
      '</div>' +
      detailLine +
      action +
      '<p style="text-align:center;margin:16px 0 0;font-size:14px;color:var(--ink-500)">Not you? ' +
        '<button type="button" id="ambSwitch" style="background:none;border:none;padding:0;color:var(--gold-deep);font-weight:700;cursor:pointer;font-size:14px">Change account</button></p>';
    card.appendChild(box);

    var cont = document.getElementById('ambContinue');
    if (cont) cont.addEventListener('click', onContinue);
    var sw = document.getElementById('ambSwitch');
    if (sw) sw.addEventListener('click', changeAccount);
  }

  function onContinue() {
    var acc = document.getElementById('ambAccount');
    if (acc) acc.remove();
    var form = document.getElementById('ambForm');
    if (form) {
      form.style.display = '';
      var first = form.querySelector('.fpanel.show input,.fpanel.show select,.fpanel.show textarea');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function changeAccount() {
    // Full sign-out of Lawexa, then back to login to choose another account.
    var done = function () {
      try { localStorage.removeItem('lawexa-auth'); } catch (e) {}
      window.location.href = loginUrl();
    };
    authedFetch('/auth/logout', { method: 'POST' }).then(done, done);
  }

  // ---- Submit: collected fields + account values -> API payload ----
  function submit(formData) {
    var get = function (k) { var v = formData.get(k); return v == null ? '' : ('' + v).trim(); };
    var u = cachedUser || {};
    var p = u.profile || {};
    var payload = {
      name: u.name,                                   // from the account
      email: u.email,                                 // from the account
      phone: get('phone'),
      country: get('country') || p.country || undefined,       // asked only if profile lacks it
      university: get('university') || p.university || undefined,
      law_school: p.law_school || undefined,
      faculty: get('faculty') || undefined,
      level: get('level') || undefined,               // always collected
      motivation: get('why'),
      growth_plan: get('grow'),
      leadership_experience: get('experience') || undefined,
      social_handle: get('social') || undefined,
      heard_from: get('hear') || undefined,
    };
    return authedFetch('/ambassadors/apply', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (res.ok) return body.data || body;
          throw { status: res.status, message: body.message || 'Submission failed.', errors: body.errors || null };
        });
      });
  }

  function handleSubmitError(err) {
    err = err || {};
    if (err.status === 422 && err.errors) {
      var msgs = [];
      Object.keys(err.errors).forEach(function (k) {
        (err.errors[k] || []).forEach(function (m) { msgs.push(m); });
      });
      alert(msgs.join('\n') || 'Please check your answers and try again.');
    } else if (err.status === 403) {
      alert('Your email needs to be verified before you can apply. Please verify it, then try again.');
    } else if (err.status === 409) {
      alert('You already have an ambassador application in progress.');
      init();
    } else if (err.status === 401) {
      window.location.href = loginUrl();
    } else {
      alert(err.message || 'Something went wrong. Please try again, or email ambassadors@lawexa.com.');
    }
  }

  // Hide the fields we already know so the slim form only asks for the rest.
  function trimForm(user) {
    var p = user.profile || {};
    hideField('fname');                 // name -> from account
    hideField('email');                 // email -> from account
    if (p.country) hideField('country');     // only ask if the profile lacks it
    if (p.university) hideField('uni');
    // Faculty/department only makes sense for non-law students. Law students
    // have area_of_study === 'Law' (set at onboarding); anyone without a real
    // non-law area of study has it hidden (faculty is law / N/A for them).
    var aos = (p.area_of_study || '').trim().toLowerCase();
    if (aos === '' || aos === 'law') hideField('faculty');
    // phone, level, motivation, growth_plan (+ optionals) stay.
  }

  // ---- Init: gate -> account card -> slim form ----
  function init() {
    var s = getSession();
    if (!s) {
      showGate(
        'Sign in to apply',
        'The ambassador program is open to Lawexa users. Sign in or create your free account to continue — we’ll use the details we already have.',
        { href: loginUrl(), label: 'Sign in to apply' },
        { href: registerUrl(), label: 'Create account' }
      );
      return;
    }
    if (s.isGuest) {
      showGate(
        'Use a full account',
        'You’re browsing as a guest. Please sign in with a full Lawexa account to apply.',
        { href: loginUrl(), label: 'Sign in' },
        { href: registerUrl(), label: 'Create account' }
      );
      return;
    }

    authedFetch('/auth/me')
      .then(function (res) {
        if (res.status === 401) {
          showGate('Sign in to apply', 'Your session has expired. Please sign in again to continue.', { href: loginUrl(), label: 'Sign in' }, null);
          return null;
        }
        return res.json().catch(function () { return null; });
      })
      .then(function (me) {
        if (!me) return;
        cachedUser = (me.data && me.data.user) || me.data || s.user || {};
        authedFetch('/ambassadors/my-application')
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (body) {
            var app = body && body.data;
            if (app && showStatus(app)) return;
            trimForm(cachedUser);
            renderAccountCard(cachedUser);
          });
      })
      .catch(function () {
        // Network hiccup: fall back to the stored user so the page still works.
        cachedUser = s.user || {};
        trimForm(cachedUser);
        renderAccountCard(cachedUser);
      });
  }

  // ---- Share / invite ----
  var SHARE_TEXT = 'Join me as a Lawexa Campus Ambassador. Sign up here and get 10 free messages to start:';
  function shareUrl() {
    return location.origin + '/ambassadors?utm_source=ambassador&utm_medium=referral&utm_campaign=ambassador-10-free';
  }
  function showShareFallback(url, copied) {
    var note = document.getElementById('shareNote');
    if (note && copied) note.innerHTML = 'Link copied! Paste it anywhere, or share via:';
    var box = document.getElementById('shareFallback');
    if (!box) return;
    var full = encodeURIComponent(SHARE_TEXT + ' ' + url);
    box.innerHTML =
      '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + full + '" style="margin:4px">WhatsApp</a>' +
      '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(SHARE_TEXT) + '&url=' + encodeURIComponent(url) + '" style="margin:4px">X</a>';
    box.style.display = 'block';
  }
  function wireShare() {
    var btn = document.getElementById('shareBtn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', function () {
      var url = shareUrl();
      if (navigator.share) {
        navigator.share({ title: 'Lawexa Campus Ambassador', text: SHARE_TEXT + ' ', url: url }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(SHARE_TEXT + ' ' + url).then(
          function () { showShareFallback(url, true); },
          function () { showShareFallback(url, false); }
        );
      } else {
        showShareFallback(url, false);
      }
    });
  }

  window.LawexaAmb = { init: init, submit: submit, handleSubmitError: handleSubmitError };

  function boot() { wireShare(); init(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
