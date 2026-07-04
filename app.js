
// ---------------------------------------------------------------
// Data prep
// ---------------------------------------------------------------
const CATEGORY_ORDER = [
  "I. Signalisation routière","II. Intersections","III. Règles de priorité",
  "IV. Limitation de vitesse","V. Arrêt et stationnement","La route",
  "ENVIRONNEMENT ET CONDUITE RESPONSABLE","MÉCANIQUE & ÉQUIPEMENTS","Sujets officiels"
];
const CATEGORY_LABEL = {
  "I. Signalisation routière":"Signalisation routière",
  "II. Intersections":"Intersections",
  "III. Règles de priorité":"Règles de priorité",
  "IV. Limitation de vitesse":"Limitation de vitesse",
  "V. Arrêt et stationnement":"Arrêt et stationnement",
  "La route":"La route (types de voies, météo)",
  "ENVIRONNEMENT ET CONDUITE RESPONSABLE":"Environnement & éco-conduite",
  "MÉCANIQUE & ÉQUIPEMENTS":"Mécanique & équipements",
  "Sujets officiels":"Sujets blancs (banque officielle)"
};
const CATEGORY_ICON = {
  "I. Signalisation routière":"tri",
  "II. Intersections":"cross",
  "III. Règles de priorité":"circ-red",
  "IV. Limitation de vitesse":"circ-blue",
  "V. Arrêt et stationnement":"rect",
  "La route":"road",
  "ENVIRONNEMENT ET CONDUITE RESPONSABLE":"leaf",
  "MÉCANIQUE & ÉQUIPEMENTS":"gauge",
  "Sujets officiels":"doc"
};

// ---------------------------------------------------------------
// Road sign catalogue — real pictograms extracted from the official
// reference PDF "Les signaux routiers réglementaires" (édition 2009).
// SIGNS_DATA is injected at build time: { CODE: {desc, family, img, w, h} }
// ---------------------------------------------------------------

const SIGN_ORDER = ['AB4','AB3a','AB1','AB6','AB7','AB25','B1','B3','B34','B14','B33','B16','B6a1','B6d','C12','A1a','A1b','A3','A4','A7','A13b','C20a','A14','A15a1','A17','A21','A24'];
const SIGN_CAT_ORDER = ['Danger','Priorité aux intersections','Interdiction','Obligation','Fin de prescription','Indication','Services','Agglomération','Localisation','Passage à niveau','Balises','Panonceaux (compléments)','Signalisation de direction','Autre'];

// keyword matching rules — specific phrases first so they win over generic ones
const SIGN_RULES = [
  [["fin d'interdiction de dépasser","fin d’interdiction de dépasser"], 'B34'],
  [["interdiction de dépasser"], 'B3'],
  [["fin de limitation"], 'B33'],
  [["limitation de vitesse"], 'B14'],
  [["fin de route prioritaire","fin du caractère prioritaire"], 'AB7'],
  [["route prioritaire"], 'AB6'],
  [["cédez le passage","céder le passage","cédez-le-passage"], 'AB3a'],
  [["priorité à droite"], 'AB1'],
  [["giratoire","rond-point"], 'AB25'],
  [["stop"], 'AB4'],
  [["sens interdit"], 'B1'],
  [["sens unique"], 'C12'],
  [["klaxon","avertisseur sonore"], 'B16'],
  [["arrêt et stationnement"], 'B6d'],
  [["stationnement interdit"], 'B6a1'],
  [["virage à droite"], 'A1a'],
  [["virage à gauche"], 'A1b'],
  [["chaussée rétrécie"], 'A3'],
  [["chaussée glissante"], 'A4'],
  [["passage à niveau"], 'A7'],
  [["passage piéton"], 'A13b'],
  [["animaux"], 'A15a1'],
  [["feux tricolores","feu tricolore"], 'A17'],
  [["cyclistes"], 'A21'],
  [["vent latéral"], 'A24'],
];
function matchSigns(q){
  const text = (q.question + ' ' + Object.values(q.options).join(' ')).toLowerCase();
  const results = [];
  for(const [kws,id] of SIGN_RULES){
    if(!SIGNS_DATA[id]) continue;
    if(kws.some(k=>text.includes(k)) && !results.includes(id)) results.push(id);
    if(results.length>=2) break;
  }
  return results;
}

// ---- rendering for a sign (real pictogram, base64 PNG from the official PDF) ----
function signImg(code, size){
  size = size || 44;
  const d = SIGNS_DATA[code];
  if(!d) return '';
  return `<img src="data:image/png;base64,${d.img}" width="${size}" height="${size}" alt="Panneau ${code}" style="object-fit:contain;background:#fff;border-radius:${Math.round(size*0.18)}px;padding:${Math.round(size*0.08)}px;flex-shrink:0;" loading="lazy">`;
}

function signChipsHTML(ids){
  if(!ids || !ids.length) return '';
  return `<div class="q-signs">${ids.map(code=>{
    const d = SIGNS_DATA[code];
    if(!d) return '';
    return `<div class="sign-chip" title="${d.desc.replace(/"/g,'&quot;')}">${signImg(code,26)}<span class="sc-code">${code}</span><span class="sc-name">${d.desc}</span></div>`;
  }).join('')}</div>`;
}

const byCategory = {};
QUESTIONS.forEach(q=>{ (byCategory[q.category] = byCategory[q.category]||[]).push(q); });

const sujets = {};
QUESTIONS.forEach(q=>{
  if(q.category==="Sujets officiels"){
    const n = q.source.replace("Sujet ","").trim();
    (sujets[n] = sujets[n]||[]).push(q);
  }
});
const sujetNumbers = Object.keys(sujets).map(Number).sort((a,b)=>a-b);

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let state = {
  screen:'home',
  session:null, // {title, questions, index, selected:{}, validated:{}, correctCount, wrongIds:[]}
  errorBank:[], // question objects answered wrong at least once, this session
};

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function pick(arr,n){ return shuffle(arr).slice(0, Math.min(n, arr.length)); }

// ---------------------------------------------------------------
// Icons (small inline SVG / shape helpers)
// ---------------------------------------------------------------
function shapeIcon(kind){
  switch(kind){
    case 'tri': return `<div class="icon-box sign-tri" style="width:36px;height:36px;">!</div>`;
    case 'circ-red': return `<div class="icon-box sign-circ-red" style="width:36px;height:36px;">P</div>`;
    case 'circ-blue': return `<div class="icon-box sign-circ-blue" style="width:36px;height:36px;">50</div>`;
    case 'rect': return `<div class="icon-box sign-rect" style="width:36px;height:36px;">P</div>`;
    case 'road': return `<div class="icon-box sign-rect" style="width:36px;height:36px;background:var(--asphalt-4);border-color:var(--text-3);">≡</div>`;
    case 'leaf': return `<div class="icon-box sign-circ-blue" style="width:36px;height:36px;background:var(--sign-green);">✓</div>`;
    case 'gauge': return `<div class="icon-box sign-circ-red" style="width:36px;height:36px;">⚙</div>`;
    case 'cross': return `<div class="icon-box sign-tri" style="width:36px;height:36px;">+</div>`;
    case 'doc': return `<div class="icon-box sign-rect" style="width:36px;height:36px;">▤</div>`;
    default: return '';
  }
}

// ---------------------------------------------------------------
// Render
// ---------------------------------------------------------------
const app = document.getElementById('app');
function render(){
  if(state.screen==='home') return renderHome();
  if(state.screen==='themes') return renderThemeList();
  if(state.screen==='sujets') return renderSujetList();
  if(state.screen==='count') return renderCountPicker(state.pendingMode);
  if(state.screen==='quiz') return renderQuiz();
  if(state.screen==='result') return renderResult();
  if(state.screen==='reperes') return renderReperes();
  if(state.screen==='signs') return renderSigns();
}

function headerBar(title){
  return `
  <div class="topbar">
    <div class="brand" style="cursor:pointer" onclick="goHome()">
      <div class="brand-badge">CR</div>
      <div class="brand-name">Code de la Route<small>Permis B — Bénin</small></div>
    </div>
    ${title ? `<button class="nav-btn" onclick="goHome()">← Accueil</button>` : ''}
  </div>`;
}

function renderHome(){
  const total = QUESTIONS.length;
  const nThemes = CATEGORY_ORDER.length - 1;
  const nSujets = sujetNumbers.length;
  app.innerHTML = `
    ${headerBar(false)}
    <div class="hero">
      <span class="eyebrow">Préparation à l'examen théorique</span>
      <h1>Révise le <span>Code&nbsp;de&nbsp;la&nbsp;Route</span> du Bénin réaliser par Adé ADJIBADE le goat</h1>
      <p>${total} questions à réponses multiples, tirées d'une banque de 50 sujets blancs et de fiches thématiques (signalisation, priorités, vitesse, mécanique, éco-conduite...). Coche toutes les réponses justes, comme le jour de l'examen.</p>
      <div class="stats-row">
        <div class="stat"><b>${total}</b><span>Questions</span></div>
        <div class="stat"><b>${nSujets}</b><span>Sujets blancs</span></div>
        <div class="stat"><b>${nThemes}</b><span>Thèmes</span></div>
        <div class="stat"><b>70%</b><span>Seuil indicatif *</span></div>
      </div>
    </div>
    <div class="lane"></div>
    <div class="modes">
      <button class="mode-card" onclick="openSujets()">
        <span class="tag">20 questions</span>
        ${shapeIcon('doc')}
        <h3>Examen blanc</h3>
        <p>Choisis un sujet (1 à ${nSujets}) et compose comme le jour J, dans les conditions réelles.</p>
      </button>
      <button class="mode-card" onclick="openThemes()">
        <span class="tag">au choix</span>
        ${shapeIcon('tri')}
        <h3>Révision par thème</h3>
        <p>Cible un chapitre précis : signalisation, priorités, vitesse, mécanique...</p>
      </button>
      <button class="mode-card" onclick="openCountPicker('random')">
        <span class="tag">10 à 50</span>
        ${shapeIcon('road')}
        <h3>Session aléatoire</h3>
        <p>Un tirage mélangé dans toute la banque, pour un entraînement rapide.</p>
      </button>
      <button class="mode-card" onclick="openErrorReview()">
        <span class="tag">${state.errorBank.length}</span>
        ${shapeIcon('circ-red')}
        <h3>Mes erreurs</h3>
        <p>Retravaille uniquement les questions ratées pendant cette session.</p>
      </button>
    </div>
    <div class="lane"></div>
    <div class="modes">
      <button class="mode-card" onclick="goSigns()">
        ${shapeIcon('tri')}
        <h3>Panneaux illustrés</h3>
        <p>Plus de 300 panneaux officiels avec leur code (ex. B3, AB4...), triés par famille, illustrés à partir du pictogramme réel.</p>
      </button>
      <button class="mode-card" onclick="goReperes()">
        ${shapeIcon('circ-blue')}
        <h3>Repères clés</h3>
        <p>Vitesses, priorités, équipements obligatoires — l'essentiel à connaître par cœur avant l'examen.</p>
      </button>
    </div>
    <p class="note" style="margin-top:16px;text-align:center;">* Seuil de réussite indicatif (≈14/20) selon les retours d'auto-écoles béninoises — vérifie la note exacte exigée auprès de ton auto-école ANaTT, le Code de la route étant en cours de réforme.</p>
  `;
}

function goHome(){ state.screen='home'; render(); }
function goReperes(){ state.screen='reperes'; render(); }
function goSigns(){ state.screen='signs'; render(); }

function renderSigns(){
  const legend = [
    ['Triangle, bord rouge','Danger — prudence'],
    ['Cercle, bord rouge','Interdiction'],
    ['Cercle bleu plein','Obligation'],
    ['Carré / rectangle bleu','Indication'],
    ['Losange jaune','Caractère prioritaire'],
    ['Octogone rouge','Arrêt obligatoire (STOP)'],
  ];
  const legendHtml = legend.map(([name,role])=>
    `<div class="legend-item"><div class="lg-txt"><b>${name}</b><span>${role}</span></div></div>`
  ).join('');

  // "Les plus fréquents dans le QCM" — curated shortlist
  const topCards = SIGN_ORDER.filter(code=>SIGNS_DATA[code]).map(code=>{
    const d = SIGNS_DATA[code];
    return `<div class="sign-card">${signImg(code,46)}<div class="sc-txt"><div class="sc-code">${code}</div><div class="sc-desc">${d.desc}</div></div></div>`;
  }).join('');

  // Full catalogue, grouped by family
  const byFamily = {};
  Object.keys(SIGNS_DATA).sort().forEach(code=>{
    const fam = SIGNS_DATA[code].family || 'Autre';
    (byFamily[fam] = byFamily[fam]||[]).push(code);
  });
  const total = Object.keys(SIGNS_DATA).length;
  const catalogueHtml = SIGN_CAT_ORDER.filter(f=>byFamily[f]).map(fam=>{
    const cards = byFamily[fam].map(code=>{
      const d = SIGNS_DATA[code];
      return `<div class="sign-card">${signImg(code,42)}<div class="sc-txt"><div class="sc-code">${code}</div><div class="sc-desc">${d.desc}</div></div></div>`;
    }).join('');
    return `<div class="sign-section"><h3>${fam} <span style="color:var(--text-3);font-weight:400;">(${byFamily[fam].length})</span></h3><div class="sign-grid">${cards}</div></div>`;
  }).join('');

  app.innerHTML = `
    ${headerBar(true)}
    <div class="panel">
      <h2>Panneaux illustrés</h2>
      <p style="color:var(--text-3);font-size:13px;margin-top:4px;">
        Forme et couleur donnent le premier indice sur un panneau — avant même de lire le pictogramme. Pictogrammes officiels tirés de la référence "Les signaux routiers réglementaires" (édition 2009), ${total} panneaux au total.
      </p>
      <div class="legend-grid">${legendHtml}</div>
    </div>
    <div class="panel">
      <h2 style="font-size:17px;">Les plus cités dans le QCM</h2>
      <div class="sign-grid" style="margin-top:12px;">${topCards}</div>
    </div>
    ${catalogueHtml}
    <p class="note" style="text-align:center;margin-top:18px;">Ces panneaux apparaissent aussi automatiquement sous les questions qui les concernent, pendant tes sessions de révision.</p>
  `;
}

function renderThemeList(){
  const items = CATEGORY_ORDER.map(cat=>{
    const qs = byCategory[cat]||[];
    return `<div class="list-item">
      <div style="display:flex;align-items:center;gap:12px;">
        ${shapeIcon(CATEGORY_ICON[cat])}
        <div>
          <div class="li-title">${CATEGORY_LABEL[cat]}</div>
          <div class="li-sub">${qs.length} questions</div>
        </div>
      </div>
      <button class="li-go" onclick="startTheme('${cat.replace(/'/g,"\\'")}')">Réviser</button>
    </div>`;
  }).join('');
  app.innerHTML = `
    ${headerBar(true)}
    <div class="panel">
      <h2>Révision par thème</h2>
      <p style="color:var(--text-3);font-size:13px;margin-top:4px;">Choisis un chapitre du cours de circulation routière.</p>
      ${items}
    </div>
  `;
}
function openThemes(){ state.screen='themes'; render(); }

function renderSujetList(){
  const chips = sujetNumbers.map(n=>`<button class="sujet-chip" onclick="startSujet(${n})">N°${String(n).padStart(2,'0')}</button>`).join('');
  app.innerHTML = `
    ${headerBar(true)}
    <div class="panel">
      <h2>Examens blancs</h2>
      <p style="color:var(--text-3);font-size:13px;margin-top:4px;">${sujetNumbers.length} sujets officiels de 20 questions chacun. Choisis un numéro, ou tente ta chance avec un sujet aléatoire.</p>
      <div style="margin-top:12px;">
        <button class="li-go" onclick="startSujet('random')">🎲 Sujet aléatoire</button>
      </div>
      <div class="grid-sujets">${chips}</div>
    </div>
  `;
}
function openSujets(){ state.screen='sujets'; render(); }

function renderCountPicker(mode){
  app.innerHTML = `
    ${headerBar(true)}
    <div class="panel">
      <h2>Session aléatoire</h2>
      <p style="color:var(--text-3);font-size:13px;margin-top:4px;">Combien de questions veux-tu réviser ?</p>
      <div class="count-row">
        ${[10,20,30,50].map(n=>`<button class="count-btn" onclick="startRandom(${n})">${n}</button>`).join('')}
      </div>
    </div>
  `;
}
function openCountPicker(mode){ state.pendingMode = mode; state.screen='count'; render(); }

// ---------------------------------------------------------------
// Session starters
// ---------------------------------------------------------------
function newSession(title, questions){
  state.session = {
    title,
    questions,
    index:0,
    selected:{},   // qid -> Set of letters currently toggled
    validated:{},  // qid -> true once validated
    correctCount:0,
  };
  state.screen='quiz';
  render();
}
function startTheme(cat){
  const qs = shuffle(byCategory[cat]||[]);
  newSession(CATEGORY_LABEL[cat] || cat, qs);
}
function startSujet(n){
  let num = n;
  if(n==='random'){ num = sujetNumbers[Math.floor(Math.random()*sujetNumbers.length)]; }
  const qs = sujets[num];
  newSession(`Sujet blanc N°${String(num).padStart(2,'0')}`, shuffle(qs));
}
function startRandom(n){
  const qs = pick(QUESTIONS, n);
  newSession(`Session aléatoire — ${n} questions`, qs);
}
function openErrorReview(){
  if(state.errorBank.length===0){ return; }
  newSession(`Mes erreurs (${state.errorBank.length})`, shuffle(state.errorBank));
}

// ---------------------------------------------------------------
// Quiz screen
// ---------------------------------------------------------------
function currentQ(){
  const s = state.session;
  return s.questions[s.index];
}
function toggleOption(letter){
  const s = state.session;
  const q = currentQ();
  if(s.validated[q.id]) return;
  const sel = s.selected[q.id] || new Set();
  if(sel.has(letter)) sel.delete(letter); else sel.add(letter);
  s.selected[q.id] = sel;
  render();
}
function validateCurrent(){
  const s = state.session;
  const q = currentQ();
  if(s.validated[q.id]) return;
  const sel = s.selected[q.id] || new Set();
  const correct = new Set(q.answers);
  const isCorrect = sel.size===correct.size && [...sel].every(l=>correct.has(l));
  s.validated[q.id] = true;
  if(isCorrect){
    s.correctCount++;
  } else {
    if(!state.errorBank.find(e=>e.id===q.id)) state.errorBank.push(q);
  }
  render();
}
function nextQuestion(){
  const s = state.session;
  if(s.index < s.questions.length-1){
    s.index++;
    render();
  } else {
    state.screen='result';
    render();
  }
}
function exitQuiz(){
  state.session=null;
  state.screen='home';
  render();
}

function renderQuiz(){
  const s = state.session;
  const q = currentQ();
  const sel = s.selected[q.id] || new Set();
  const validated = !!s.validated[q.id];
  const correctSet = new Set(q.answers);
  const pct = Math.round(((s.index)/(s.questions.length))*100);

  const optsHtml = ['A','B','C','D'].filter(l=>q.options[l]!==undefined).map(letter=>{
    let cls = 'opt';
    if(!validated){
      if(sel.has(letter)) cls += ' selected';
    } else {
      if(correctSet.has(letter) && sel.has(letter)) cls += ' correct';
      else if(correctSet.has(letter) && !sel.has(letter)) cls += ' missed correct';
      else if(!correctSet.has(letter) && sel.has(letter)) cls += ' wrong';
    }
    return `<div class="${cls}" onclick="toggleOption('${letter}')">
      <div class="box">${sel.has(letter) || (validated && correctSet.has(letter)) ? '✓' : ''}</div>
      <span class="letter">${letter}</span>
      <span>${q.options[letter]}</span>
    </div>`;
  }).join('');

  const multi = q.answers.length>1;

  app.innerHTML = `
    <div class="quiz-head">
      <button class="quiz-exit" onclick="exitQuiz()" title="Quitter">✕</button>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div class="quiz-count">${s.index+1}/${s.questions.length}</div>
    </div>
    <div class="q-card">
      <div class="q-meta">
        <span class="q-badge">${q.source || CATEGORY_LABEL[q.category] || q.category}</span>
        <span class="q-badge multi">${multi ? 'Plusieurs réponses' : '1 réponse'}</span>
      </div>
      <div class="q-text">${q.question}</div>
      ${signChipsHTML(matchSigns(q))}
      <div class="opts">${optsHtml}</div>
      ${validated ? `<div class="explain">${
        (sel.size===correctSet.size && [...sel].every(l=>correctSet.has(l)))
          ? '✅ Bonne réponse ! Réponse(s) correcte(s) : ' + q.answers.join(', ')
          : '❌ Pas tout à fait. Réponse(s) correcte(s) : ' + q.answers.join(', ')
      }</div>` : ''}
      <div class="q-actions">
        ${!validated
          ? `<button class="btn btn-primary" ${sel.size===0?'disabled':''} onclick="validateCurrent()">Valider</button>`
          : `<button class="btn btn-primary" onclick="nextQuestion()">${s.index<s.questions.length-1?'Question suivante →':'Voir le résultat →'}</button>`
        }
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------
function renderResult(){
  const s = state.session;
  const total = s.questions.length;
  const correct = s.correctCount;
  const pct = Math.round((correct/total)*100);
  const pass = pct>=70;

  // category breakdown
  const catStats = {};
  s.questions.forEach(q=>{
    const key = q.category==='Sujets officiels' ? 'Sujets officiels' : q.category;
    if(!catStats[key]) catStats[key] = {ok:0,total:0};
    catStats[key].total++;
    const sel = s.selected[q.id] || new Set();
    const correctSet = new Set(q.answers);
    const isCorrect = sel.size===correctSet.size && [...sel].every(l=>correctSet.has(l));
    if(isCorrect) catStats[key].ok++;
  });
  const catRows = Object.keys(catStats).map(cat=>{
    const st = catStats[cat];
    const p = Math.round((st.ok/st.total)*100);
    return `<div class="cat-row">
      <div class="cat-name">${CATEGORY_LABEL[cat]||cat}</div>
      <div class="cat-bar"><i style="width:${p}%;background:${p>=70?'var(--sign-green)':p>=40?'var(--line-yellow)':'var(--sign-red)'}"></i></div>
      <div class="cat-val">${st.ok}/${st.total}</div>
    </div>`;
  }).join('');

  const missed = s.questions.filter(q=>{
    const sel = s.selected[q.id] || new Set();
    const correctSet = new Set(q.answers);
    return !(sel.size===correctSet.size && [...sel].every(l=>correctSet.has(l)));
  });

  const missedHtml = missed.length ? `
    <div class="review-list">
      <h3 style="font-size:15px;text-transform:uppercase;color:var(--text-2);">À revoir (${missed.length})</h3>
      ${missed.map(q=>{
        const sel = s.selected[q.id] || new Set();
        const correctSet = new Set(q.answers);
        const opts = ['A','B','C','D'].filter(l=>q.options[l]!==undefined).map(letter=>{
          let cls='opt';
          if(correctSet.has(letter) && sel.has(letter)) cls+=' correct';
          else if(correctSet.has(letter) && !sel.has(letter)) cls+=' missed correct';
          else if(!correctSet.has(letter) && sel.has(letter)) cls+=' wrong';
          return `<div class="${cls}"><div class="box">${(sel.has(letter)||correctSet.has(letter))?'✓':''}</div><span class="letter">${letter}</span><span>${q.options[letter]}</span></div>`;
        }).join('');
        return `<div class="review-item">
          <div class="q-text">${q.question}</div>
          <div class="opts">${opts}</div>
        </div>`;
      }).join('')}
    </div>
  ` : `<p class="note" style="text-align:center;margin-top:18px;">Sans faute ! 🎉 Aucune question à revoir sur cette session.</p>`;

  app.innerHTML = `
    ${headerBar(true)}
    <div class="result-hero">
      <div class="score-ring" style="--pct:${pct}"><b>${pct}%</b><span>${correct}/${total}</span></div>
      <div class="result-verdict ${pass?'pass':'fail'}">${pass?'Admis(e) sur cette session':'À retravailler'}</div>
      <div class="result-sub">${s.title}</div>
    </div>
    <div class="panel cat-breakdown">
      <h2 style="font-size:16px;">Résultat par thème</h2>
      ${catRows}
    </div>
    ${missedHtml}
    <div class="result-actions">
      <button class="btn btn-ghost" onclick="goHome()">Accueil</button>
      <button class="btn btn-primary" onclick="restartSame()">Refaire cette session</button>
    </div>
  `;
}
function restartSame(){
  const s = state.session;
  newSession(s.title, shuffle(s.questions));
}

// ---------------------------------------------------------------
// Repères clés (reference page)
// ---------------------------------------------------------------
function renderReperes(){
  app.innerHTML = `
    ${headerBar(true)}
    <div class="panel">
      <h2>Repères clés</h2>
      <p style="color:var(--text-3);font-size:13px;margin-top:4px;">
        Quelques repères pour compléter tes révisions. Le Code de la route béninois est en cours de modernisation
        (projet de loi transmis à l'Assemblée nationale en 2025) : confirme toujours les valeurs exactes avec ton auto-école agréée ANaTT.
      </p>
    </div>

    <div class="repere-card">
      <h3>Vitesses indicatives</h3>
      <table class="speed">
        <tr><th>Type de route</th><th>Vitesse</th></tr>
        <tr><td>En agglomération</td><td>50 km/h</td></tr>
        <tr><td>Routes interurbaines</td><td>90 km/h</td></tr>
        <tr><td>Voies rapides / autoroutes</td><td>110 km/h (selon signalisation)</td></tr>
      </table>
      <p class="note">Ces valeurs sont des repères couramment enseignés par les auto-écoles béninoises ; elles doivent toujours céder devant la signalisation posée sur le terrain (zones scolaires, travaux, agglomération dense).</p>
    </div>

    <div class="repere-card">
      <h3>L'essentiel à ne jamais oublier</h3>
      <ul style="margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.8;color:var(--text-2);">
        <li>Ceinture de sécurité obligatoire pour le conducteur et tous les passagers équipés d'une ceinture.</li>
        <li>Casque obligatoire pour les conducteurs de zémidjans (moto-taxis) et leurs passagers.</li>
        <li>Priorité à droite par défaut, sauf signalisation contraire (STOP, cédez-le-passage, route prioritaire).</li>
        <li>Triangle de présignalisation + gilet réfléchissant en cas de panne ou d'arrêt d'urgence.</li>
        <li>La signalisation verticale (panneaux) prime sur le marquage au sol, sauf indication d'un agent de circulation.</li>
      </ul>
    </div>

    <div class="repere-card">
      <h3>Le jour de l'examen</h3>
      <p style="font-size:13.5px;color:var(--text-2);line-height:1.7;">
        L'épreuve théorique se compose désormais sur une application dématérialisée (tablette/smartphone à l'auto-école),
        avec un correctif affiché instantanément. Prévois environ 20 à 30 questions à choix multiples. Un score
        autour de 70% de bonnes réponses est généralement requis — vérifie le barème exact appliqué par ton centre d'examen ANaTT.
      </p>
      <p class="source-tag">Sources : ANaTT, auto-écoles agréées, presse béninoise (2025-2026).</p>
    </div>
  `;
}

render();
