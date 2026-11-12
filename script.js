/* =========================================================
   script.js · camada interativa genérica (Vanilla JS)
   Cada módulo sai em silêncio se o HTML não tiver seus ganchos.
   ========================================================= */
(function () {
  'use strict';

  const ACCORDION_SINGLE_OPEN = true;
  const CAROUSEL_AUTOPLAY_MS = 6000; // 0 desliga o autoplay

  const root = document.documentElement;
  root.classList.add('js');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  const headerHeight = () => {
    const header = document.querySelector('[data-header]');
    return header ? header.offsetHeight : 0;
  };

  /* ---------- 1. Header inteligente ---------- */
  function initHeader() {
    const header = document.querySelector('[data-header]');
    if (!header) return;

    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const menuOpen = document.body.classList.contains('menu-open');
      header.classList.toggle('is-scrolled', y > 10);
      if (!menuOpen && y > 80 && y > lastY + 4) {
        header.classList.add('is-hidden');
      } else if (y < lastY - 4 || y <= 80 || menuOpen) {
        header.classList.remove('is-hidden');
      }
      lastY = y;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- 2. Menu mobile ---------- */
  function initMenu() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const menu = document.querySelector('[data-menu]');
    if (!toggle || !menu) return;

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

    toggle.addEventListener('click', () => setOpen(!isOpen()));

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (isOpen() && !menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });

    // Volta ao estado fechado ao passar para o layout desktop
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  /* ---------- 3. Scroll reveal ---------- */
  function initReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    // Stagger automático para irmãos dentro de grids
    items.forEach((el) => {
      let delay = Number(el.dataset.revealDelay || 0);
      if (!el.dataset.revealDelay && el.parentElement) {
        const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
        if (siblings.length > 2) delay = (siblings.indexOf(el) % 4) * 90;
      }
      el.style.setProperty('--reveal-delay', delay + 'ms');
    });

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    items.forEach((el) => observer.observe(el));
  }

  /* ---------- 4. Âncoras + scrollspy ---------- */
  function initAnchors() {
    const links = document.querySelectorAll('a[href^="#"]');
    if (!links.length) return;

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        event.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight() + 1;
        window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        history.replaceState(null, '', id);
        if (target.id === 'conteudo') {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      });
    });

    const navLinks = document.querySelectorAll('[data-menu] a[href^="#"]');
    const sections = Array.from(navLinks)
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- 5. FAQ (accordion) ---------- */
  function initAccordion() {
    document.querySelectorAll('[data-accordion]').forEach((accordion) => {
      const triggers = Array.from(accordion.querySelectorAll('button[aria-controls]'));
      if (!triggers.length) return;

      const animate = (panel, open) => {
        if (reducedMotion.matches) {
          panel.hidden = !open;
          return;
        }
        // Lê offsetHeight entre as duas alturas para o navegador registrar o ponto de partida
        if (open) {
          panel.hidden = false;
          const h = panel.scrollHeight;
          panel.style.height = '0px';
          void panel.offsetHeight;
          panel.style.height = h + 'px';
        } else {
          panel.style.height = panel.scrollHeight + 'px';
          void panel.offsetHeight;
          panel.style.height = '0px';
        }
        panel.addEventListener('transitionend', function done(event) {
          if (event.propertyName !== 'height') return;
          panel.removeEventListener('transitionend', done);
          if (panel.style.height === '0px') panel.hidden = true;
          panel.style.height = '';
        });
      };

      const setState = (trigger, open) => {
        const panel = document.getElementById(trigger.getAttribute('aria-controls'));
        if (!panel) return;
        trigger.setAttribute('aria-expanded', String(open));
        animate(panel, open);
      };

      triggers.forEach((trigger, index) => {
        trigger.addEventListener('click', () => {
          const open = trigger.getAttribute('aria-expanded') !== 'true';
          if (open && ACCORDION_SINGLE_OPEN) {
            triggers.forEach((other) => {
              if (other !== trigger && other.getAttribute('aria-expanded') === 'true') setState(other, false);
            });
          }
          setState(trigger, open);
        });

        trigger.addEventListener('keydown', (event) => {
          const keys = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: triggers.length - 1 };
          if (!(event.key in keys)) return;
          event.preventDefault();
          const next = (keys[event.key] + triggers.length) % triggers.length;
          triggers[next].focus();
        });
      });
    });
  }

  /* ---------- 6. Carrossel ---------- */
  function initCarousel() {
    document.querySelectorAll('[data-carousel]').forEach((carousel) => {
      const track = carousel.querySelector('[data-carousel-track]');
      if (!track) return;
      const slides = Array.from(track.children);
      if (!slides.length) return;

      const prev = carousel.querySelector('[data-carousel-prev]');
      const next = carousel.querySelector('[data-carousel-next]');
      const dotsWrap = carousel.querySelector('[data-carousel-dots]');
      let dots = [];

      slides.forEach((slide, i) => {
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', (i + 1) + ' de ' + slides.length);
      });

      const step = () => slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
      const perView = () => Math.max(1, Math.round(track.clientWidth / step()));
      const pageCount = () => Math.max(1, slides.length - perView() + 1);
      const current = () => Math.round(track.scrollLeft / step());

      const goTo = (index) => {
        const max = pageCount() - 1;
        const i = index > max ? 0 : index < 0 ? max : index;
        track.scrollTo({ left: i * step(), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      };

      const buildDots = () => {
        if (!dotsWrap) return;
        dotsWrap.innerHTML = '';
        dots = [];
        const count = pageCount();
        dotsWrap.hidden = count < 2;
        for (let i = 0; i < count; i++) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'carousel__dot';
          dot.setAttribute('aria-label', 'Ir para avaliação ' + (i + 1));
          dot.addEventListener('click', () => goTo(i));
          dotsWrap.appendChild(dot);
          dots.push(dot);
        }
      };

      const sync = () => {
        const i = current();
        dots.forEach((dot, d) => dot.setAttribute('aria-current', String(d === i)));
        const single = pageCount() < 2;
        if (prev) prev.disabled = single;
        if (next) next.disabled = single;
      };

      if (prev) prev.addEventListener('click', () => goTo(current() - 1));
      if (next) next.addEventListener('click', () => goTo(current() + 1));

      let scrollTick = false;
      track.addEventListener('scroll', () => {
        if (scrollTick) return;
        scrollTick = true;
        requestAnimationFrame(() => { sync(); scrollTick = false; });
      }, { passive: true });

      carousel.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current() + 1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current() - 1); }
      });

      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { buildDots(); sync(); }, 150);
      });

      buildDots();
      sync();

      // Autoplay: pausa no hover/foco, desligado com reduced motion
      if (!CAROUSEL_AUTOPLAY_MS || reducedMotion.matches) return;
      let timer = null;
      const play = () => { stop(); timer = setInterval(() => goTo(current() + 1), CAROUSEL_AUTOPLAY_MS); };
      const stop = () => { if (timer) clearInterval(timer); timer = null; };
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', play);
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', (event) => { if (!carousel.contains(event.relatedTarget)) play(); });
      track.addEventListener('touchstart', stop, { passive: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : stop()), { threshold: 0.3 }).observe(carousel);
      } else {
        play();
      }
    });
  }

  /* ---------- 7a. Galeria: lightbox ---------- */
  function initLightbox() {
    const triggers = Array.from(document.querySelectorAll('[data-lightbox]'));
    const dialog = document.querySelector('dialog.lightbox');
    if (!triggers.length || !dialog || typeof dialog.showModal !== 'function') return;

    const icon = (d) => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
    dialog.innerHTML =
      '<figure class="lightbox__figure"><img class="lightbox__img" alt=""><figcaption class="lightbox__caption"></figcaption></figure>' +
      '<button type="button" class="lightbox__btn lightbox__close" aria-label="Fechar">' + icon('M18 6 6 18M6 6l12 12') + '</button>' +
      '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Foto anterior">' + icon('m15 18-6-6 6-6') + '</button>' +
      '<button type="button" class="lightbox__btn lightbox__next" aria-label="Próxima foto">' + icon('m9 18 6-6-6-6') + '</button>';

    const img = dialog.querySelector('.lightbox__img');
    const caption = dialog.querySelector('.lightbox__caption');
    let index = 0;
    let opener = null;

    const show = (i) => {
      index = (i + triggers.length) % triggers.length;
      const trigger = triggers[index];
      const source = trigger.tagName === 'IMG' ? trigger : trigger.querySelector('img');
      if (!source) return;
      img.src = source.currentSrc || source.src;
      img.alt = source.alt;
      const figcaption = trigger.closest('figure') && trigger.closest('figure').querySelector('figcaption');
      caption.textContent = (figcaption ? figcaption.textContent.trim() + ' · ' : '') + (index + 1) + ' de ' + triggers.length;
    };

    triggers.forEach((trigger, i) => {
      trigger.addEventListener('click', () => {
        opener = trigger;
        show(i);
        dialog.showModal();
        dialog.querySelector('.lightbox__close').focus();
      });
    });

    dialog.querySelector('.lightbox__close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.lightbox__prev').addEventListener('click', () => show(index - 1));
    dialog.querySelector('.lightbox__next').addEventListener('click', () => show(index + 1));

    // Clique no backdrop fecha
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') show(index + 1);
      if (event.key === 'ArrowLeft') show(index - 1);
      if (event.key === 'Tab') {
        const focusables = Array.from(dialog.querySelectorAll('button'));
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });

    dialog.addEventListener('close', () => {
      if (opener) opener.focus();
    });
  }

  /* ---------- 7b. Antes e depois ---------- */
  function initCompare() {
    document.querySelectorAll('[data-compare]').forEach((compare) => {
      let range = compare.querySelector('input[type="range"]');
      if (!range) {
        range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '100';
        range.value = '50';
        range.className = 'compare__range';
        range.setAttribute('aria-label', 'Arraste para comparar antes e depois');
        compare.appendChild(range);
      }
      if (!compare.querySelector('.compare__handle')) {
        const handle = document.createElement('span');
        handle.className = 'compare__handle';
        handle.setAttribute('aria-hidden', 'true');
        compare.appendChild(handle);
      }
      const update = () => compare.style.setProperty('--compare-pos', range.value + '%');
      range.addEventListener('input', update);
      update();
    });
  }

  /* ---------- 8. Contadores ---------- */
  function initCounters() {
    const counters = document.querySelectorAll('[data-count-to]');
    if (!counters.length) return;

    const format = (n) => n.toLocaleString('pt-BR');
    const finish = (el) => { el.textContent = format(Number(el.dataset.countTo)) + (el.dataset.countSuffix || ''); };

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      counters.forEach(finish);
      return;
    }

    const run = (el) => {
      const target = Number(el.dataset.countTo) || 0;
      const suffix = el.dataset.countSuffix || '';
      const duration = 1600;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(Math.round(target * eased)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach((el) => {
      el.textContent = '0' + (el.dataset.countSuffix || '');
      observer.observe(el);
    });
  }

  /* ---------- 9. Vídeos sob demanda ---------- */
  function initLazyVideos() {
    const videos = document.querySelectorAll('video[data-video-lazy]');
    if (!videos.length) return;

    const load = (video) => {
      if (video.dataset.loaded) return;
      video.querySelectorAll('source[data-src]').forEach((source) => { source.src = source.dataset.src; });
      if (video.dataset.src) video.src = video.dataset.src;
      video.load();
      video.dataset.loaded = 'true';
    };

    const tryPlay = (video) => {
      if (reducedMotion.matches) return;
      const promise = video.play();
      if (promise && promise.catch) promise.catch(() => {});
    };

    if (!('IntersectionObserver' in window)) {
      videos.forEach(load);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          load(video);
          tryPlay(video);
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { rootMargin: '150px 0px', threshold: 0.25 });

    videos.forEach((video) => observer.observe(video));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) videos.forEach((video) => video.pause());
    });
  }

  /* ---------- 10. Ano do rodapé ---------- */
  function initYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = year; });
  }

  /* ---------- 11. Micro-interações ---------- */
  function initMagnetic() {
    if (!canHover.matches || reducedMotion.matches) return;
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = 10;
      el.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * strength;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * strength;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- 12. Animação assinatura: linhas de velocidade no hero ---------- */
  function initSignature() {
    const canvas = document.querySelector('[data-signature]');
    if (!canvas || reducedMotion.matches || window.innerWidth < 768) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hero = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lines = [];
    let width = 0;
    let height = 0;
    let running = false;
    let visible = true;
    let frame = null;
    let last = 0;

    const resize = () => {
      width = hero.offsetWidth;
      height = hero.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (anywhere) => ({
      x: anywhere ? Math.random() * width : -300,
      y: Math.random() * height,
      len: 80 + Math.random() * 220,
      speed: 4 + Math.random() * 9,
      alpha: 0.05 + Math.random() * 0.18,
      green: Math.random() < 0.35
    });

    const count = () => Math.round(Math.min(46, width / 32));

    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 16) return; // teto de ~60fps
      last = now;
      ctx.clearRect(0, 0, width, height);
      const skew = 0.22; // inclinação das linhas, como o letreiro itálico
      lines.forEach((line, i) => {
        line.x += line.speed;
        if (line.x - line.len > width + 100) lines[i] = spawn(false);
        const gradient = ctx.createLinearGradient(line.x - line.len, 0, line.x, 0);
        const color = line.green ? '59, 225, 90' : '242, 245, 243';
        gradient.addColorStop(0, 'rgba(' + color + ', 0)');
        gradient.addColorStop(1, 'rgba(' + color + ', ' + line.alpha + ')');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = line.green ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(line.x - line.len, line.y + line.len * skew);
        ctx.lineTo(line.x, line.y);
        ctx.stroke();
      });
    };

    const start = () => {
      if (running || !visible || document.hidden) return;
      running = true;
      frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      if (frame) cancelAnimationFrame(frame);
    };

    resize();
    for (let i = 0; i < count(); i++) lines.push(spawn(true));

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        if (window.innerWidth < 768) { stop(); ctx.clearRect(0, 0, width, height); }
        else start();
      }, 200);
    });

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }).observe(hero);

    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initMenu();
    initReveal();
    initAnchors();
    initAccordion();
    initCarousel();
    initLightbox();
    initCompare();
    initCounters();
    initLazyVideos();
    initYear();
    initMagnetic();
    initSignature();
  });
})();
