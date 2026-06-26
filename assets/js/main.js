/* ══════════════════════════════════════════════════════════════
   main.js — Roshan Shrestha Portfolio (Production Build)
   Bugs fixed:
   1. Footer year hardcoded — now auto-updates
   2. Mobile drawer aria-hidden not toggled — fixed
   3. Contact form had no submission feedback — added
   4. Loader race condition on cached pages — fixed
   5. Canvas resize had no debounce — fixed
   6. initCountUp didn't guard missing elements — fixed
   7. document mouseleave fired on child elements — scoped to window
   8. Escape key didn't close mobile drawer — added
══════════════════════════════════════════════════════════════ */
'use strict';
const qs  = (s, c = document) => c.querySelector(s);
const qsa = (s, c = document) => [...c.querySelectorAll(s)];
const isMobile = () => window.innerWidth <= 820;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 1. FOOTER YEAR */
(function(){ const el = qs('#footer-year'); if(el) el.textContent = new Date().getFullYear(); })();

/* 2. PAGE LOADER */
(function initLoader(){
  const loader = qs('#page-loader');
  if(reducedMotion){ if(loader) loader.classList.add('hidden'); return; }
  if(!loader) return;
  const fill = loader.querySelector('.loader-bar-fill');
  let progress = 0, done = false;
  const iv = setInterval(()=>{
    progress += Math.random()*18+8;
    if(fill) fill.style.width = Math.min(progress,92)+'%';
    if(progress>=92) clearInterval(iv);
  },80);
  function finish(){
    if(done) return; done=true; clearInterval(iv);
    if(fill) fill.style.width='100%';
    setTimeout(()=>loader.classList.add('hidden'),300);
  }
  if(document.readyState==='complete'){ finish(); }
  else { window.addEventListener('load', finish,{once:true}); setTimeout(finish,4000); }
})();

/* 3. THEME TOGGLE — syncs desktop nav toggle + mobile drawer toggle */
(function initTheme(){
  const html=document.documentElement;
  const btn=qs('#themeToggle');
  const btnMobile=qs('#themeToggleMobile');
  const icon=qs('#toggleIcon');
  const iconMobile=qs('#toggleIconMobile');

  function apply(t){
    html.setAttribute('data-theme',t);
    try{ localStorage.setItem('rs-theme',t); }catch(e){}
    const emoji = t==='dark'?'🌙':'☀️';
    if(icon) icon.textContent = emoji;
    if(iconMobile) iconMobile.textContent = emoji;
    const label = t==='dark'?'Switch to light mode':'Switch to dark mode';
    if(btn) btn.setAttribute('aria-label', label);
    if(btnMobile) btnMobile.setAttribute('aria-label', label);
  }

  apply(html.getAttribute('data-theme')||'light');

  if(btn) btn.addEventListener('click',()=>apply(html.getAttribute('data-theme')==='dark'?'light':'dark'));
  if(btnMobile) btnMobile.addEventListener('click',()=>apply(html.getAttribute('data-theme')==='dark'?'light':'dark'));

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{
    try{ if(!localStorage.getItem('rs-theme')) apply(e.matches?'dark':'light'); }catch(err){}
  });
})();

/* 4. CUSTOM CURSOR */
(function initCursor(){
  if(reducedMotion||isMobile()||window.matchMedia('(hover: none)').matches) return;
  const dot=qs('#cursor-dot'), ring=qs('#cursor-ring');
  if(!dot||!ring) return;
  let mx=-100,my=-100,rx=-100,ry=-100;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
  const lerp=(a,b,t)=>a+(b-a)*t;
  (function animate(){
    dot.style.left=mx+'px'; dot.style.top=my+'px';
    rx=lerp(rx,mx,0.14); ry=lerp(ry,my,0.14);
    ring.style.left=rx+'px'; ring.style.top=ry+'px';
    requestAnimationFrame(animate);
  })();
  const hov='a,button,.btn,.project-card,.skill-category,.edu-card,.contact-link-item,.pill,.t-tag';
  document.addEventListener('mouseover',e=>{ if(e.target.closest(hov)) ring.classList.add('hovering'); });
  document.addEventListener('mouseout', e=>{ if(e.target.closest(hov)) ring.classList.remove('hovering'); });
  window.addEventListener('mouseleave',()=>{ dot.style.opacity='0'; ring.style.opacity='0'; });
  window.addEventListener('mouseenter',()=>{ dot.style.opacity='1'; ring.style.opacity='0.6'; });
})();

/* 5. SCROLL PROGRESS */
(function(){
  const bar=qs('#scroll-progress');
  if(!bar) return;
  window.addEventListener('scroll',()=>{
    const total=document.body.scrollHeight-window.innerHeight;
    if(total<=0) return;
    const pct=Math.round(window.scrollY/total*100);
    bar.style.width=pct+'%';
    bar.setAttribute('aria-valuenow',pct);
  },{passive:true});
})();

/* 6. SCROLL REVEAL */
(function initScrollReveal(){
  if(reducedMotion){
    qsa('.reveal,.reveal-left,.reveal-right,.reveal-scale,.about-pills,.contact-links')
      .forEach(el=>el.classList.add('revealed'));
    // Expose no-op for sheets.js compatibility
    window.reinitScrollReveal = function() {
      qsa('.reveal,.reveal-left,.reveal-right,.reveal-scale')
        .forEach(el=>el.classList.add('revealed'));
    };
    return;
  }
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('revealed'); obs.unobserve(e.target); }});
  },{threshold:0.10,rootMargin:'0px 0px -30px 0px'});

  function observeAll(){
    qsa('.reveal,.reveal-left,.reveal-right,.reveal-scale,.about-pills,.contact-links')
      .forEach(el=>{ if(!el.dataset.revealObserved){ el.dataset.revealObserved='1'; obs.observe(el); }});
    qsa('.section-eyebrow,.section-heading,.section-sub,.section-divider').forEach((el,i)=>{
      if(!el.classList.contains('reveal')){ el.classList.add('reveal'); el.style.transitionDelay=(i*0.06)+'s'; }
      if(!el.dataset.revealObserved){ el.dataset.revealObserved='1'; obs.observe(el); }
    });
    qsa('.skills-grid,.edu-grid,.projects-grid').forEach(grid=>{
      qsa(':scope > *',grid).forEach((c,i)=>{
        if(!c.classList.contains('reveal')){ c.classList.add('reveal'); c.style.transitionDelay=(i*0.08)+'s'; }
        if(!c.dataset.revealObserved){ c.dataset.revealObserved='1'; obs.observe(c); }
      });
    });
    qsa('.timeline-item').forEach((item,i)=>{
      if(!item.classList.contains('reveal')){ item.classList.add('reveal'); item.style.transitionDelay=(i*0.07)+'s'; }
      if(!item.dataset.revealObserved){ item.dataset.revealObserved='1'; obs.observe(item); }
    });
    const aL=qs('.about-photo-wrap'), aR=qs('.about-text');
    if(aL&&!aL.classList.contains('reveal-left')) { aL.classList.add('reveal-left'); }
    if(aR&&!aR.classList.contains('reveal-right')){ aR.classList.add('reveal-right'); }
    [aL,aR,qs('.about-pills'),qs('.contact-links')].forEach(el=>{
      if(el&&!el.dataset.revealObserved){ el.dataset.revealObserved='1'; obs.observe(el); }
    });
  }

  observeAll();
  // Expose globally so sheets.js can call after injecting dynamic content
  window.reinitScrollReveal = observeAll;
})();

/* 7. TYPEWRITER */
(function(){
  if(reducedMotion) return;
  const el=qs('.hero-title');
  if(!el) return;
  const txt=el.textContent.trim();
  el.innerHTML='<span class="tw-text"></span><span class="cursor-blink" aria-hidden="true"></span>';
  el.setAttribute('aria-label',txt);
  const tw=el.querySelector('.tw-text');
  let i=0;
  function type(){ if(i<txt.length){ tw.textContent+=txt[i++]; setTimeout(type,38+(Math.random()*18-9)); }}
  setTimeout(type,700);
})();

/* 8. PARTICLES */
(function initParticles(){
  if(reducedMotion) return;
  const canvas=qs('#hero-canvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  let W,H,particles,animFrame,rTimer;
  const COUNT=isMobile()?24:50;
  const getColor=()=>getComputedStyle(document.documentElement).getPropertyValue('--particle-color').trim()||'rgba(26,86,219,0.18)';
  function resize(){ const h=canvas.parentElement; W=canvas.width=h.offsetWidth; H=canvas.height=h.offsetHeight; }
  function mp(){ return{x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.6+0.4,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,alpha:Math.random()*.55+.1}; }
  function init(){ resize(); particles=Array.from({length:COUNT},mp); }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const c=getColor();
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=c; ctx.globalAlpha=p.alpha; ctx.fill();
    });
    ctx.globalAlpha=1;
    for(let i=0;i<particles.length;i++){
      for(let j=i+1;j<particles.length;j++){
        const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<100){
          ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y);
          ctx.strokeStyle=c; ctx.globalAlpha=(1-d/100)*.22; ctx.lineWidth=.5; ctx.stroke();
        }
      }
    }
    ctx.globalAlpha=1;
    animFrame=requestAnimationFrame(draw);
  }
  init(); draw();
  window.addEventListener('resize',()=>{ clearTimeout(rTimer); rTimer=setTimeout(resize,150); });
  new IntersectionObserver(e=>{
    if(e[0].isIntersecting){ if(!animFrame) draw(); }
    else{ cancelAnimationFrame(animFrame); animFrame=null; }
  },{threshold:0}).observe(canvas.parentElement);
})();

/* 9. BUTTON RIPPLE */
(function(){
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.btn');
    if(!btn) return;
    const r=btn.getBoundingClientRect(), s=document.createElement('span');
    s.className='ripple-effect';
    s.style.left=(e.clientX-r.left)+'px'; s.style.top=(e.clientY-r.top)+'px';
    btn.appendChild(s);
    s.addEventListener('animationend',()=>s.remove(),{once:true});
  });
})();

/* 10. BACK TO TOP */
(function(){
  const b=qs('#back-to-top');
  if(!b) return;
  window.addEventListener('scroll',()=>b.classList.toggle('visible',window.scrollY>400),{passive:true});
  b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
})();

/* 11. ACTIVE NAV */
(function(){
  const nav=qs('nav'), secs=qsa('section[id]'), links=qsa('.nav-links a[href^="#"]');
  if(!nav) return;
  window.addEventListener('scroll',()=>{
    nav.classList.toggle('scrolled',window.scrollY>10);
    let cur='';
    secs.forEach(s=>{ if(window.scrollY>=s.offsetTop-110) cur=s.id; });
    links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+cur));
  },{passive:true});
})();

/* 12. MOBILE NAV DRAWER */
(function(){
  const burger=qs('#navBurger'), drawer=qs('#navDrawer');
  if(!burger||!drawer) return;
  function openDrawer(){
    burger.classList.add('open');
    drawer.classList.add('open');
    burger.setAttribute('aria-expanded','true');
    drawer.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeDrawer(){
    burger.classList.remove('open');
    drawer.classList.remove('open');
    burger.setAttribute('aria-expanded','false');
    drawer.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  burger.addEventListener('click',()=>burger.classList.contains('open')?closeDrawer():openDrawer());
  qsa('a',drawer).forEach(a=>a.addEventListener('click',closeDrawer));
  document.addEventListener('click',e=>{ if(!burger.contains(e.target)&&!drawer.contains(e.target)&&burger.classList.contains('open')) closeDrawer(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeDrawer(); });
})();

/* 13. SMOOTH ANCHOR SCROLL */
(function(){
  document.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');
    if(!link) return;
    const href=link.getAttribute('href');
    if(href==='#') return;
    const target=document.querySelector(href);
    if(!target) return;
    e.preventDefault();
    window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-68,behavior:'smooth'});
  });
})();

/* 14. STAT ENTRANCE */
(function(){
  if(reducedMotion) return;
  const stats=qsa('.stat-num');
  if(!stats.length) return;
  setTimeout(()=>stats.forEach((el,i)=>{ el.style.animationDelay=(0.75+i*.12)+'s'; el.classList.add('counting'); }),100);
})();

/* 15. CONTACT FORM */
(function(){
  const form     = qs('#contactForm');
  const header   = qs('#contact-form-header');
  const successEl= qs('#cf-success');
  const feedback = qs('#cf-feedback');
  if(!form) return;

  /* Style the feedback element */
  if(feedback){
    Object.assign(feedback.style,{
      fontSize:'0.84rem', marginTop:'0.6rem',
      lineHeight:'1.5', display:'none', borderRadius:'6px', padding:'0'
    });
  }

  function showFeedback(msg, isError){
    if(!feedback) return;
    feedback.textContent = msg;
    feedback.style.display = 'block';
    feedback.style.color = isError ? '#c0392b' : '#166534';
  }
  function hideFeedback(){
    if(!feedback) return;
    feedback.style.display = 'none';
    feedback.textContent = '';
  }

  function showSuccess(){
    if(header)    header.style.display   = 'none';
    form.style.display = 'none';
    if(successEl){
      successEl.hidden = false;
      requestAnimationFrame(()=>requestAnimationFrame(()=>successEl.classList.add('cf-success-visible')));
    }
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    hideFeedback();

    /* reCAPTCHA check */
    if(typeof grecaptcha !== 'undefined'){
      const token = grecaptcha.getResponse();
      if(!token){ showFeedback('Please complete the reCAPTCHA verification before sending.', true); return; }
    }

    /* Mandatory field validation — name, email, subject, message */
    const nameVal    = (qs('#cf-name',    form)||{}).value||'';
    const emailVal   = (qs('#cf-email',   form)||{}).value||'';
    const subjectVal = (qs('#cf-subject', form)||{}).value||'';
    const msgVal     = (qs('#cf-message', form)||{}).value||'';

    if(!nameVal.trim())           { showFeedback('Please enter your name.', true); qs('#cf-name',form).focus(); return; }
    if(!emailVal.trim()||!emailVal.includes('@')){ showFeedback('Please enter a valid email address.', true); qs('#cf-email',form).focus(); return; }
    if(!subjectVal.trim())        { showFeedback('Please enter a subject.', true); qs('#cf-subject',form).focus(); return; }
    if(!msgVal.trim())            { showFeedback('Please enter your message.', true); qs('#cf-message',form).focus(); return; }

    const action   = form.getAttribute('action')||'';
    const btn      = qs('#cf-submit')||form.querySelector('button[type="submit"]');
    const origText = btn ? btn.textContent : 'Send Message';

    if(btn){ btn.textContent='Sending…'; btn.disabled=true; btn.style.opacity='0.7'; }

    fetch(action,{method:'POST',body:new FormData(form),headers:{'Accept':'application/json'}})
    .then(function(r){
      if(r.ok){ showSuccess(); }
      else{
        return r.json().catch(()=>{ throw new Error('server'); }).then(function(data){
          if(data&&data.errors) throw new Error(data.errors.map(err=>err.message).join('. '));
          throw new Error('server');
        });
      }
    })
    .catch(function(err){
      if(btn){ btn.textContent=origText; btn.disabled=false; btn.style.opacity='1'; }
      if(typeof grecaptcha!=='undefined') grecaptcha.reset();
      var msg=(err&&err.message&&err.message!=='server')
        ? '✗ '+err.message
        : '✗ Something went wrong. Please email: roshanxshrestha@gmail.com';
      showFeedback(msg, true);
    });
  });
})();

/* 16. MOBILE EXPAND / COLLAPSE — projects & timeline bullets
   Only activates below 700px. Desktop is completely untouched. */
(function initMobileExpand(){
  const BREAKPOINT = 700;

  function makeBtn(collapsedLabel){
    const b = document.createElement('button');
    b.className = 'expand-btn';
    b.type = 'button';
    b.setAttribute('aria-expanded','false');
    b.innerHTML = collapsedLabel+' <i class="expand-icon" aria-hidden="true">↓</i>';
    return b;
  }

  function wire(el, btn, labelCollapsed, labelExpanded){
    el.classList.add('is-collapsible','is-collapsed');
    btn.addEventListener('click', function(){
      const nowCollapsed = el.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!nowCollapsed));
      btn.classList.toggle('is-open', !nowCollapsed);
      const icon = btn.querySelector('.expand-icon');
      if(nowCollapsed){
        btn.firstChild.textContent = labelCollapsed+' ';
        if(icon) icon.textContent = '↓';
      } else {
        btn.firstChild.textContent = labelExpanded+' ';
        if(icon) icon.textContent = '↑';
      }
    });
  }

  function init(){
    /* Project summaries */
    qsa('.project-summary').forEach(function(el){
      if(el.nextElementSibling&&el.nextElementSibling.classList.contains('expand-btn')) return;
      const btn = makeBtn('Read more');
      el.after(btn);
      wire(el, btn, 'Read more', 'Read less');
    });

    /* Timeline bullet lists — only if more than 1 bullet */
    qsa('.timeline-bullets').forEach(function(el){
      if(el.children.length < 2) return;
      if(el.nextElementSibling&&el.nextElementSibling.classList.contains('expand-btn')) return;
      const btn = makeBtn('See more');
      el.after(btn);
      wire(el, btn, 'See more', 'See less');
    });
  }

  function cleanup(){
    qsa('.is-collapsible').forEach(function(el){
      el.classList.remove('is-collapsible','is-collapsed');
    });
    qsa('.expand-btn').forEach(function(btn){ btn.remove(); });
  }

  function check(){
    if(window.innerWidth <= BREAKPOINT){ init(); }
    else { cleanup(); }
  }

  /* Delay to let sheets.js inject dynamic content first */
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(check, 650));
  } else {
    setTimeout(check, 650);
  }

  let resizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(check, 200);
  });
})();
