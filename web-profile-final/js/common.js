/* ==========================================================
   common.js — satu-satunya JavaScript di situs ini.
   Isi konten TIDAK ada di sini (semua teks ada di file .html).
   File ini hanya mengurus dua hal yang tidak bisa dilakukan HTML/CSS:
     1. Mengisi tahun otomatis di footer.
     2. Slideshow otomatis (Photograph & NFT): loop tanpa batas,
        tombol prev/next, titik, dan jeda saat kursor di atas slide.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- 1. Tahun di footer ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- NFT marquee: geser ke kiri terus-menerus, tanpa salinan.
     Kartu yang sudah keluar di kiri dipindah ke ujung kanan, jadi hanya
     kartu asli di HTML yang berputar. Kecepatan: ubah SPEED (px per detik). ---------- */
  document.querySelectorAll(".nft-marquee").forEach(function (box) {
    var track = box.querySelector(".nft-track");
    if (!track || track.children.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var SPEED = 40;
    var offset = 0, last = null, paused = false;
    var originals = Array.prototype.slice.call(track.children);
    track.classList.add("is-looping");

    // 4 kartu saja tidak cukup memenuhi layar, jadi urutan 1,2,3,4 diulang
    // otomatis sampai lebarnya melebihi layar + 1 kartu. Di HTML tetap 4 kartu.
    function fill() {
      var need = box.clientWidth + 2 * (originals[0].getBoundingClientRect().width + 16);
      var guard = 0;
      while (track.scrollWidth < need && guard++ < 40) {
        originals.forEach(function (card) {
          var c = card.cloneNode(true);
          c.setAttribute("aria-hidden", "true");
          c.querySelectorAll("a").forEach(function (a) { a.setAttribute("tabindex", "-1"); });
          track.appendChild(c);
        });
      }
    }
    fill();
    window.addEventListener("resize", fill);

    box.addEventListener("mouseenter", function () { paused = true; });
    box.addEventListener("mouseleave", function () { paused = false; });
    box.addEventListener("focusin", function () { paused = true; });
    box.addEventListener("focusout", function () { paused = false; });

    function frame(t) {
      if (last !== null && !paused && !document.hidden) {
        offset -= SPEED * Math.min(t - last, 100) / 1000;
        var first = track.firstElementChild;
        var step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
        while (-offset >= step) { track.appendChild(first); offset += step; first = track.firstElementChild; }
        track.style.transform = "translateX(" + offset + "px)";
      }
      last = t;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  /* ---------- 2. Slideshow ----------
     Di HTML cukup tulis:
       <div class="carousel" data-carousel data-interval="4500" aria-label="...">
         <div class="carousel-track">
           <figure class="carousel-slide ...">...</figure>  (satu per slide)
         </div>
       </div>
     Lalu kode di bawah menambahkan tombol, titik, bar progres, dan slide
     kloning di awal/akhir supaya putarannya mulus tanpa "rewind". */
  document.querySelectorAll("[data-carousel]").forEach(initCarousel);

  function initCarousel(root) {
    var interval = Number(root.getAttribute("data-interval")) || 4500;
    var SPEED = 800; // ms — samakan dengan transition .carousel-track di CSS
    var track = root.querySelector(".carousel-track");
    var slides = Array.prototype.slice.call(track.children);
    var n = slides.length;
    if (n < 2) return;

    var pos = 1; // posisi di track (0 dan n+1 adalah slide kloning)
    var timer = null, settleTimer = null;
    var paused = false, busy = false;

    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    slides.forEach(function (s, i) {
      s.setAttribute("data-i", i);
      s.setAttribute("role", "group");
      s.setAttribute("aria-label", (i + 1) + " of " + n);
    });

    // Kloning slide terakhir (di depan) dan slide pertama (di belakang)
    function clone(s) {
      var c = s.cloneNode(true);
      c.setAttribute("data-clone", "true");
      c.setAttribute("aria-hidden", "true");
      c.removeAttribute("role");
      c.removeAttribute("aria-label");
      return c;
    }
    track.insertBefore(clone(slides[n - 1]), slides[0]);
    track.appendChild(clone(slides[0]));
    var all = Array.prototype.slice.call(track.children);

    // Bungkus track + tambahkan kontrol
    var viewport = document.createElement("div");
    viewport.className = "carousel-viewport";
    root.insertBefore(viewport, track);
    viewport.appendChild(track);
    viewport.insertAdjacentHTML("beforeend",
      '<button class="carousel-btn prev" type="button" aria-label="Previous slide">&#8249;</button>' +
      '<button class="carousel-btn next" type="button" aria-label="Next slide">&#8250;</button>' +
      '<div class="carousel-progress" aria-hidden="true"><span></span></div>');

    var dotsWrap = document.createElement("div");
    dotsWrap.className = "carousel-dots";
    dotsWrap.innerHTML = slides.map(function (_, i) {
      return '<button type="button" class="dot" aria-label="Go to slide ' + (i + 1) + '"></button>';
    }).join("");
    root.appendChild(dotsWrap);

    var dots = dotsWrap.querySelectorAll(".dot");
    var bar = viewport.querySelector(".carousel-progress span");

    function realIndex() { return (pos - 1 + n) % n; }

    function restartProgress() {
      bar.style.animation = "none";
      void bar.offsetWidth; // reflow agar animasi mulai ulang
      bar.style.animation = "";
      bar.style.animationDuration = interval + "ms";
    }

    function paint(animate) {
      track.style.transition = animate ? "" : "none";
      track.style.transform = "translateX(" + (-pos * 100) + "%)";
      var cur = realIndex();
      all.forEach(function (s) {
        var active = Number(s.getAttribute("data-i")) === cur;
        s.classList.toggle("is-active", active);
        if (active && !s.hasAttribute("data-clone")) s.removeAttribute("inert");
        else s.setAttribute("inert", "");
      });
      dots.forEach(function (d, i) {
        if (i === cur) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
      restartProgress();
    }

    // Dari slide kloning → lompat tanpa animasi ke slide asli yang identik
    function settle() {
      if (pos === 0) pos = n;
      else if (pos === n + 1) pos = 1;
      else return;
      paint(false);
      void track.offsetWidth;
    }

    function move(target) {
      if (busy) return;
      busy = true;
      pos = target;
      paint(true);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { settle(); busy = false; }, SPEED + 30);
    }
    function next() { move(pos + 1); }
    function prev() { move(pos - 1); }

    function stop() { clearInterval(timer); timer = null; }
    function start() {
      stop();
      if (paused || document.hidden) return;
      timer = setInterval(next, interval);
      restartProgress();
    }

    viewport.querySelector(".prev").addEventListener("click", function () { prev(); start(); });
    viewport.querySelector(".next").addEventListener("click", function () { next(); start(); });
    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { move(i + 1); start(); });
    });

    // Jeda saat kursor di atas slideshow atau fokus keyboard di dalamnya
    root.addEventListener("mouseenter", function () { paused = true; root.classList.add("is-paused"); stop(); });
    root.addEventListener("mouseleave", function () { paused = false; root.classList.remove("is-paused"); start(); });
    root.addEventListener("focusin", function () { paused = true; root.classList.add("is-paused"); stop(); });
    root.addEventListener("focusout", function () { paused = false; root.classList.remove("is-paused"); start(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { prev(); start(); }
      if (e.key === "ArrowRight") { next(); start(); }
    });

    paint(false);
    start();
  }
})();
