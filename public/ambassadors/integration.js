/*
 * Lawexa Ambassadors — thin same-origin integration layer.
 *
 * This page is served statically at lawexa.com/ambassadors. Because it shares
 * the origin with the main app, it can read the logged-in session directly.
 * This layer: gates the form to verified, full-account users; prefills from the
 * user's profile; surfaces an existing application's status; and submits to the
 * real API. The marketing page and the multi-step wizard UI are untouched.
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

  function loginUrl() { return '/login?redirect=' + encodeURIComponent(RETURN_TO); }
  function registerUrl() { return '/register?redirect=' + encodeURIComponent(RETURN_TO); }

  function authedFetch(path, opts) {
    opts = opts || {};
    var s = getSession();
    var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(API + path, Object.assign({}, opts, { headers: headers }));
  }

  // ---- DOM helpers ----
  function setVal(id, v) {
    var el = document.getElementById(id);
    if (el && v != null && v !== '') {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function setRadio(name, v) {
    if (!v) return;
    var all = document.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < all.length; i++) {
      if (all[i].value === v) {
        all[i].checked = true;
        all[i].dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }

  function showGate(title, msg, primary, secondary) {
    var form = document.getElementById('ambForm');
    var success = document.getElementById('success');
    if (form) form.style.display = 'none';
    if (success) success.classList.remove('show');
    var card = (form && form.parentElement) || document.querySelector('.formcard');
    if (!card) return;
    var prev = document.getElementById('ambGate');
    if (prev) prev.remove();
    var btns = '';
    if (primary) btns += '<a href="' + primary.href + '" class="btn btn-gold btn-lg" style="margin:6px">' + primary.label + '</a>';
    if (secondary) btns += '<a href="' + secondary.href + '" class="btn btn-ghost btn-lg" style="margin:6px">' + secondary.label + '</a>';
    var box = document.createElement('div');
    box.id = 'ambGate';
    box.style.cssText = 'text-align:center;padding:34px 8px;';
    box.innerHTML =
      '<h3 style="font-family:var(--font-display);font-weight:700;color:var(--ink-black);font-size:28px;margin:0 0 10px">' + title + '</h3>' +
      '<p style="font-size:16px;color:var(--ink-700);max-width:430px;margin:0 auto 20px;line-height:1.6">' + msg + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:center">' + btns + '</div>';
    card.appendChild(box);
  }

  // Returns true if the existing application gates the form (hides it).
  function showStatus(app) {
    if (app.status === 'rejected') return false; // allow a fresh application
    var title = app.status === 'approved' ? 'You’re in!' : 'Application received';
    var msg = app.status === 'approved'
      ? 'Your ambassador application has been <b>approved</b>. Our team will reach out with next steps — keep an eye on your inbox.'
      : 'Your application is <b>' + (app.status_label || 'pending') + '</b> and under review. We review weekly, so you’ll hear from us by email soon.';
    showGate(title, msg, null, null);
    return true;
  }

  function verifyBanner() {
    var form = document.getElementById('ambForm');
    if (!form || document.getElementById('ambVerify')) return;
    var b = document.createElement('div');
    b.id = 'ambVerify';
    b.style.cssText = 'background:#fff6e0;border:1px solid var(--gold);border-radius:12px;padding:13px 16px;margin:0 0 22px;font-size:14px;color:var(--ink-700);';
    b.innerHTML = 'Please <b>verify your email</b> before submitting. <a href="/check-email" style="color:var(--gold-deep);font-weight:700">Verify now</a>.';
    form.insertBefore(b, form.firstChild);
  }

  function prefill(user) {
    if (!user) return;
    setVal('fname', user.name);
    setVal('email', user.email);
    var p = user.profile || {};
    setVal('uni', p.university);
    setVal('country', p.country); // <select>; option text equals the country name
    setRadio('level', p.level);
  }

  // ---- Submit: map form fields -> API payload ----
  function submit(formData) {
    var get = function (k) { var v = formData.get(k); return v == null ? '' : ('' + v).trim(); };
    var payload = {
      name: get('fname'),
      email: get('email'),
      phone: get('phone'),
      country: get('country') || undefined,
      university: get('university') || undefined,
      faculty: get('faculty') || undefined,
      level: get('level') || undefined,
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

  // ---- Init: gate + prefill + existing-application check ----
  function init() {
    var s = getSession();
    if (!s) {
      showGate(
        'Sign in to apply',
        'The ambassador program is open to Lawexa users. Sign in or create your free account to continue — we’ll prefill what we already know.',
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
        var user = (me.data && me.data.user) || me.data || s.user || {};
        authedFetch('/ambassadors/my-application')
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (body) {
            var app = body && body.data;
            if (app && showStatus(app)) return;
            prefill(user);
            if (user.is_verified === false) verifyBanner();
          });
      })
      .catch(function () {
        // Network hiccup: keep the form usable; submit will surface any error.
        prefill(s.user);
      });
  }

  window.LawexaAmb = { init: init, submit: submit, handleSubmitError: handleSubmitError };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
