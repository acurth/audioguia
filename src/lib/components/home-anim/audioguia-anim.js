/* audioguia.io: animación "Cómo funciona" (loop de 30 s). Sin dependencias.
   Adaptada del paquete original: en vez de correr sola al cargar la página,
   exporta start(wrap), que devuelve { stop, setPaused }. Así Svelte la arranca
   al montar el Inicio y la limpia al salir, sin dejar listeners colgados. */
// The package code is plain ES5 with no types; checking it would mean rewriting it.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export function start(wrap){
  var DUR = 30000;
  var $ = function(id){ return wrap.querySelector('#'+id); };
  var stage = $('ag-stage');
  function fit(){ var s = wrap.clientWidth/1080; stage.style.transform = 'scale('+s+')'; }
  var ro = new ResizeObserver(fit); ro.observe(wrap); fit();

  var clamp = function(v,a,b){ return v<a?a:(v>b?b:v); };
  var ease = function(p){ return p<.5 ? 2*p*p : -1+(4-2*p)*p; };
  var easeOut = function(p){ return 1-Math.pow(1-p,3); };
  var easeIn = function(p){ return p*p*p; };
  // progress 0..1 from a to b
  var seg = function(t,a,b){ return clamp((t-a)/(b-a),0,1); };
  // visibility envelope: fade in [a,b], hold, fade out [c,d]
  var env = function(t,a,b,c,d){ if(t<a||t>d) return 0; if(t<b) return easeOut(seg(t,a,b)); if(t>c) return 1-easeIn(seg(t,c,d)); return 1; };
  var setO = function(el,o){ el.style.opacity = o; el.style.visibility = o<=0.001?'hidden':'visible'; };

  // Icons (inline stroke SVG)
  var ICONS = {
    bird: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a7440" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a7440" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a7440" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="#c0641c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
  };
  var pinSvg = function(x,y,id){
    return '<g id="'+id+'" transform="translate('+x+','+y+')">'+
      '<path d="M0 6 C -22 -20, -22 -46, 0 -46 C 22 -46, 22 -20, 0 6 Z" fill="#2a7440"/>'+
      '<circle cx="0" cy="-30" r="14" fill="#fff"/>'+
      '<path d="M-5 -34 h4 l5 -5 v18 l-5 -5 h-4 z" fill="#2a7440"/>'+
      '<path d="M7 -35 a7 7 0 0 1 0 10" fill="none" stroke="#2a7440" stroke-width="2" stroke-linecap="round"/>'+
      '</g>';
  };

  // Audio points along the trail (as fraction of length)
  var POINTS = [
    {f:0.22, icon:'bird', title:'Los sonidos de las aves', sub:'Aprender de las aves que se pueden escuchar', warn:false},
    {f:0.50, icon:'book', title:'Leyendas del entorno', sub:'Y lo que hay que saber del lugar', warn:false},
    {f:0.78, icon:'warn', title:'Raíces en el camino', sub:'Aviso de obstáculo', warn:true}
  ];

  var trail = $('ag-trail'), trailDone = $('ag-trailDone');
  var L = trail.getTotalLength();
  trailDone.setAttribute('stroke-dasharray', L+' '+L);
  var pins = $('ag-pins'); var html='';
  POINTS.forEach(function(p,i){ var pt = trail.getPointAtLength(p.f*L); p.x=pt.x; p.y=pt.y; html += pinSvg(pt.x, pt.y-8, 'ag-pin'+i); });
  pins.innerHTML = html;
  var pinEls = POINTS.map(function(p,i){ return $('ag-pin'+i); });

  var gps=$('ag-gps'), r1=$('ag-gpsRing1'), r2=$('ag-gpsRing2'), trigA=$('ag-trigA'), trigB=$('ag-trigB');
  var L1=$('ag-L1'), LH=$('ag-LH'), LM=$('ag-LM'), LP=$('ag-LP'), LC=$('ag-LC');
  var introT=$('ag-introT'), endT=$('ag-endT'), endS=$('ag-endS');
  var dlBtn=$('ag-dlBtn'), dlFill=$('ag-dlFill'), dlLabel=$('ag-dlLabel'), tapRing2=$('ag-tapRing2'), dlState='';
  var mapCard=$('ag-mapCard'), startBtn=$('ag-startBtn'), tapRing=$('ag-tapRing'), audioCard=$('ag-audioCard');
  var audioIcon=$('ag-audioIcon'), audioTitle=$('ag-audioTitle'), audioSub=$('ag-audioSub');
  var waveBars = Array.prototype.slice.call(wrap.querySelectorAll('#ag-wave i'));
  var capT=$('ag-capT'), capS=$('ag-capS'), stepN=$('ag-stepN'), stepT=$('ag-stepT');
  var pw=[$('ag-pw1'),$('ag-pw2'),$('ag-pw3')];

  // Timeline (ms)
  var T = {
    s1In:0, s1Hold:1550, s1Out:2000,
    mapIn:2000, mapUp:2700,
    dlTap:3200, dlDone:4500,
    approach:5000, atStart:6200,
    btnIn:5800, tap:6700,
    walkStart:7500, walkEnd:23300,
    pairIn:23500, pairOut:26500,
    s5In:26600, s5Out:29300, s5End:30000
  };
  var CAPS = [
    {a:2100,b:5000, t:'Primero, descargá el recorrido', s:'Así funciona aunque no haya señal en el sendero', n:1, pill:'Descargá el recorrido'},
    {a:5000,b:7500, t:'Cerca del primer punto, iniciás', s:'Tocás Iniciar recorrido y empezás a caminar', n:2, pill:'Iniciá en el comienzo'},
    {a:7500,b:10800, t:'Tu posición GPS activa los audios', s:'Sin tocar la pantalla: solo caminás y escuchás', n:3, pill:'Caminá y escuchá'},
    {a:10800,b:15200, t:'Los sonidos de las aves', s:'Cada relato dura cerca de 1 minuto', n:3, pill:'Caminá y escuchá'},
    {a:15200,b:19600, t:'Leyendas y naturaleza', s:'Leyendas e información sobre lugares, plantas, animales y paisajes', n:3, pill:'Caminá y escuchá'},
    {a:19600,b:23500, t:'Avisos de obstáculos', s:'Raíces, escalones, puentes y cruces en el camino', n:4, pill:'Con avisos'},
    {a:23500,b:26600, t:'Se camina acompañado', s:'Imágenes para quien acompaña, audio para quien escucha', n:5, pill:'Acompañados'}
  ];
  var curCap=-1;

  function render(t){
    t = ((t % DUR) + DUR) % DUR;

    // ---- Intro (0 .. 2 s) and closing (26.6 .. 30 s): big centered text
    var oI = env(t, 0, 450, T.s1Hold, T.s1Out);
    var oE = env(t, T.s5In, T.s5In+600, T.s5Out, T.s5End);
    setO(L1, Math.max(oI, oE));
    introT.style.opacity = oI;
    introT.style.transform = 'scale('+(0.94 + 0.06*easeOut(seg(t,0,700)))+')';
    var oE1 = env(t, T.s5In, T.s5In+600, T.s5Out, T.s5End);
    endT.style.opacity = oE1; endT.style.transform = 'translateY('+(24*(1-oE1))+'px)';
    var oE2 = env(t, T.s5In+500, T.s5In+1100, T.s5Out, T.s5End);
    endS.style.opacity = oE2; endS.style.transform = 'translateY('+(24*(1-oE2))+'px)';

    // ---- Header
    var oH = env(t, T.mapIn, T.mapUp, T.pairOut, T.s5In);
    setO(LH, oH);

    // ---- Map card
    var oM = env(t, T.mapIn, T.mapUp, T.pairIn-400, T.pairIn);
    setO(LM, oM);
    var mUp = easeOut(seg(t, T.mapIn, T.mapUp));
    mapCard.style.transform = 'translateY('+(60*(1-mUp))+'px)';

    // Start button + tap
    var oBtn = env(t, T.btnIn, T.btnIn+500, T.tap+500, T.tap+900);
    setO(startBtn, oBtn);
    var press = t>T.tap && t<T.tap+250 ? 0.94 : 1;
    startBtn.style.transform = 'scale('+press+')';
    var tp = seg(t, T.tap, T.tap+700);
    var tr = tp>0 && tp<1 ? 1 : 0;
    tapRing.style.width = tapRing.style.height = (240*easeOut(tp))+'px';
    tapRing.style.opacity = tr*(1-tp);

    // Walk
    var wp = seg(t, T.walkStart, T.walkEnd);
    var pos = trail.getPointAtLength(wp*L);
    if(t < T.atStart){ var ap = ease(seg(t, T.approach, T.atStart)); pos = {x: 40 + (pos.x-40)*ap, y: 470 + (pos.y-470)*ap}; }
    gps.setAttribute('transform', 'translate('+pos.x+','+pos.y+')');
    trailDone.setAttribute('stroke-dashoffset', L*(1-wp));
    setO(gps, env(t, T.approach, T.approach+400, T.pairIn-400, T.pairIn));

    // Download button: tap, progress, done
    var oDl = env(t, T.mapIn+400, T.mapIn+900, T.dlDone+300, T.approach);
    setO(dlBtn, oDl);
    dlBtn.style.transform = 'scale('+(t>T.dlTap && t<T.dlTap+250 ? 0.95 : 1)+')';
    var dp = seg(t, T.dlTap+150, T.dlDone);
    dlFill.style.width = (100*dp)+'%';
    var st = t>=T.dlDone ? 'done' : (t>=T.dlTap+150 ? 'prog' : 'idle');
    if(st!==dlState){
      dlState = st;
      dlBtn.className = 'ag-abs' + (st==='done' ? ' ag-done' : '');
      var ic = st==='done'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="#2a7440" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
      var tx = st==='done' ? 'Listo para usar sin conexión' : (st==='prog' ? 'Descargando audios…' : 'Descargar recorrido');
      dlLabel.innerHTML = ic + '<span>' + tx + '</span>';
    }
    var tp2 = seg(t, T.dlTap, T.dlTap+700);
    tapRing2.style.width = tapRing2.style.height = (240*easeOut(tp2))+'px';
    tapRing2.style.opacity = (tp2>0 && tp2<1) ? (1-tp2) : 0;
    // breathing rings on the gps dot
    var b1 = ((t/1400)%1), b2 = (((t/1400)+0.5)%1);
    r1.setAttribute('r', 20+40*b1); r1.setAttribute('opacity', 0.6*(1-b1));
    r2.setAttribute('r', 20+40*b2); r2.setAttribute('opacity', 0.6*(1-b2));

    // Pins pop in after tap
    POINTS.forEach(function(p,i){
      var pp = easeOut(seg(t, T.tap+700+i*180, T.tap+1100+i*180));
      var reached = wp*L >= p.f*L - 1;
      var bounce = reached ? 1 : 1;
      pinEls[i].setAttribute('transform', 'translate('+p.x+','+(p.y-8)+') scale('+(pp*bounce)+')');
      pinEls[i].setAttribute('opacity', pp);
    });

    // Trigger rings + audio card when passing a point
    var active = -1, tHit = 0;
    POINTS.forEach(function(p,i){
      var hit = T.walkStart + p.f*(T.walkEnd-T.walkStart);
      if(t>=hit-200 && t<hit+3600){ active=i; tHit=hit; }
    });
    if(active>=0){
      var p = POINTS[active];
      var q = seg(t, tHit, tHit+900);
      trigA.setAttribute('cx',p.x); trigA.setAttribute('cy',p.y-8); trigA.setAttribute('r', 10+70*easeOut(q)); trigA.setAttribute('opacity', (1-q)*0.9);
      var q2 = seg(t, tHit+300, tHit+1200);
      trigB.setAttribute('cx',p.x); trigB.setAttribute('cy',p.y-8); trigB.setAttribute('r', 10+70*easeOut(q2)); trigB.setAttribute('opacity', (1-q2)*0.9);
      var oC = env(t, tHit+150, tHit+550, tHit+3100, tHit+3500);
      setO(audioCard, oC);
      audioCard.style.transform = 'translateY('+(30*(1-easeOut(seg(t,tHit+150,tHit+550))))+'px)';
      if(audioCard.dataset.p != String(active)){
        audioCard.dataset.p = String(active);
        audioIcon.innerHTML = ICONS[p.icon];
        audioTitle.textContent = p.title; audioSub.textContent = p.sub;
        audioCard.className = 'ag-abs' + (p.warn ? ' ag-warn' : '');
      }
      // waveform
      var ph = (t - tHit)/1000;
      waveBars.forEach(function(b,i){
        var h = 14 + 44*Math.abs(Math.sin(ph*4.2 + i*0.9)) * (0.5+0.5*Math.abs(Math.sin(ph*1.3+i*0.4)));
        b.style.height = h+'px';
      });
    } else {
      trigA.setAttribute('opacity',0); trigB.setAttribute('opacity',0);
      setO(audioCard, 0);
    }

    // ---- Pair scene
    var oP = env(t, T.pairIn, T.pairIn+600, T.pairOut-400, T.pairOut);
    setO(LP, oP);
    var pw0 = (t - T.pairIn)/1000;
    pw.forEach(function(w,i){ var s = 0.4+0.6*Math.abs(Math.sin(pw0*2.4 - i*0.7)); w.setAttribute('opacity', 0.25+0.75*s); });

    // ---- Captions
    var ci=-1; for(var i=0;i<CAPS.length;i++){ if(t>=CAPS[i].a && t<CAPS[i].b){ ci=i; break; } }
    if(ci>=0){
      var c = CAPS[ci];
      if(curCap!==ci){ curCap=ci; capT.textContent=c.t; capS.textContent=c.s; stepN.textContent=c.n; stepT.textContent=c.pill; }
      var oc = env(t, c.a, c.a+350, c.b-300, c.b);
      setO(LC, oc);
      LC.style.transform = 'translateY('+(16*(1-easeOut(seg(t,c.a,c.a+350))))+'px)';
    } else { setO(LC, 0); curCap=-1; }
  }

  // Reloj: pausa si la animación no se ve o la pestaña está oculta.
  // Con "reducir movimiento" activado muestra un fotograma fijo.
  var STILL_MS = 12500;
  var fixed = null, elapsed = 0, last = null, onScreen = true, raf = null, paused = false;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches:false };
  function running(){ return fixed===null && !paused && onScreen && !document.hidden && !reduce.matches; }
  function loop(now){
    raf = null;
    if(!running()){ last = null; return; }
    if(last!==null) elapsed += now - last;
    last = now; render(elapsed);
    raf = requestAnimationFrame(loop);
  }
  function kick(){
    if(reduce.matches && fixed===null){ render(STILL_MS); return; }
    if(running() && raf===null){ last = null; raf = requestAnimationFrame(loop); }
  }
  var io = null;
  if('IntersectionObserver' in window){
    io = new IntersectionObserver(function(e){ onScreen = e[0].isIntersecting; kick(); });
    io.observe(wrap);
  }
  document.addEventListener('visibilitychange', kick);
  if(reduce.addEventListener) reduce.addEventListener('change', kick);
  window.__agSeek = function(ms){ fixed = ms; render(ms); };
  render(reduce.matches ? STILL_MS : 0);
  kick();

  return {
    setPaused: function(p){ paused = p; kick(); },
    stop: function(){
      if(raf!==null) cancelAnimationFrame(raf);
      raf = null; ro.disconnect(); if(io) io.disconnect();
      document.removeEventListener('visibilitychange', kick);
      if(reduce.removeEventListener) reduce.removeEventListener('change', kick);
      delete window.__agSeek;
    }
  };
}
