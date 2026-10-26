// Nasaeem Libya company site: intro skip, scroll-in reveals, active nav link.
// The page is complete without this file; it only adds motion and conveniences.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Intro: the CSS timeline lifts it after ~2.8s; this lets people skip it sooner.
  var intro = document.getElementById('intro');
  if (intro && root.classList.contains('intro-on')) {
    var done = false;
    var remove = function () { root.classList.remove('intro-on'); intro.remove(); };
    var finish = function () {
      if (done) return;
      done = true;
      intro.classList.add('is-leaving');
      setTimeout(remove, 460);
      document.removeEventListener('keydown', onKey);
    };
    var onKey = function (e) { if (e.key === 'Escape') finish(); };
    intro.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);
    // The CSS animation already faded it out; no second fade is needed.
    intro.addEventListener('animationend', function (e) {
      if (e.target === intro && e.animationName === 'intro-lift' && !done) { done = true; remove(); }
    });
  } else if (intro) {
    intro.remove();
  }

  // Scroll-in: only for elements that start below the fold, so nothing visible ever blinks.
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal--in');
        entry.target.classList.remove('reveal--wait');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('reveal--wait');
        io.observe(el);
      }
    });
  }

  // Highlight the nav link of the section in view.
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  if ('IntersectionObserver' in window && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  // Keep the footer year current between rebuilds.
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
