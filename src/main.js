import './style.css';
import { FlightWorld } from './world.js';
import { installInspector } from './inspector.js';
import { createIcons, Leaf, Activity, Pause, Play, RotateCcw, Maximize2, Wind, ChevronDown, Download, MoveVertical, Eye, BrainCircuit, Cpu, ShieldCheck, X, FlaskConical, BookOpen, ArrowUpRight } from 'lucide';

const iconSet={Leaf,Activity,Pause,Play,RotateCcw,Maximize2,Wind,ChevronDown,Download,MoveVertical,Eye,BrainCircuit,Cpu,ShieldCheck,X,FlaskConical,BookOpen,ArrowUpRight};
const icon=(name)=>`<i data-lucide="${name}"></i>`;
const $=(id)=>document.getElementById(id);
const fmt=(n)=>Number(n).toLocaleString('en-US');
const renderIcons=()=>createIcons({icons:iconSet});
document.querySelector('#app').innerHTML=`
  <header class="topbar">
    <div class="brand"><img src="/favicon.svg" alt="" />flybrain<em>FLIGHT LAB</em></div>
    <nav class="nav" aria-label="Main navigation"><button class="active" id="flight-tab">Flight lab</button><button id="journal-tab">Field notes</button></nav>
    <div class="status"><span id="connection-dot" class="dot offline"></span><span id="connection-text">Connecting to simulator</span></div>
  </header>
  <main>
    <section class="intro">
      <div><div class="eyebrow"><span class="tag">MALECNS v1.0</span> CONNECTOME FLIGHT SIMULATOR</div><h1>Follow every flap.</h1><p>A connectome-based controller pilots the fly.<br>Inspect its activity, decisions, and training as it flies.</p></div>
      <div class="intro-side"><div class="stat"><b id="neuron-count">—</b><span>NEURONS</span></div><div class="stat"><b id="edge-count">—</b><span>CONNECTIONS</span></div><div class="stat"><b>01</b><span>CONTROLLER</span></div></div>
    </section>
    <section class="workspace" aria-label="Autonomous fly experiment">
      <div class="flight-wrap">
        <div class="flight" id="flight-scene">
          <div id="world"></div><div class="scene-vignette"></div>
          <div class="scene-top"><div class="world-label">${icon('leaf')}<div><span id="world-name">THE MEADOW</span><small>THIRD-PERSON OBSERVATION</small></div></div><div class="live-badge"><span class="dot"></span><span id="live-label">SCENE PREVIEW</span></div></div>
          <div class="scoreboard"><strong id="score">00</strong><span>GATES CLEARED</span></div>
          <div class="scene-notice" id="scene-notice"><strong>Connecting to simulator</strong><p>Waiting for the local simulator to start.</p></div>
          <div class="scene-bottom"><div><div class="run-label" id="run-label">AUTONOMOUS FLIGHT</div><div class="pilot-name">${icon('brain-circuit')}<span id="pilot-name">MaleCNS · full connectome</span></div><span class="run-detail" id="run-detail">Neural activity → decoder → flap</span></div><div class="scene-tools"><button class="icon-btn" id="pause" aria-label="Pause simulation" title="Pause simulation" disabled>${icon('pause')}</button><button class="icon-btn" id="restart" aria-label="Start a new flight" title="Start a new flight" disabled>${icon('rotate-ccw')}</button><button class="icon-btn" id="fullscreen" aria-label="Fullscreen flight view" title="Fullscreen">${icon('maximize-2')}</button></div></div>
        </div>
        <div class="flight-toolbar"><div class="mode-switch" aria-label="Learning mode"><button id="watch" class="active" disabled>${icon('eye')}Watch it fly</button><button id="adapt" disabled>${icon('flask-conical')}Let it learn</button></div><span class="autonomy">${icon('shield-check')}Autonomous control</span></div>
      </div>
      <aside class="lab" aria-label="Live brain and training panels">
        <section class="card"><div class="card-heading"><h2>Inside the fly</h2><span class="mini-label"><span class="dot"></span>NEURAL ACTIVITY</span></div><div class="brain-area"><canvas id="brain" aria-label="Anatomical sample of neurons, colored by live simulated activity"></canvas><span class="brain-annotation" id="brain-caption">Anatomical soma sample · loading</span></div><div class="neural-stats"><div><b id="active-neurons">—</b>ACTIVE NEURONS</div><div><b id="flap-probability">—</b>FLAP SIGNAL</div><div><b id="compute-ms">—</b>MS / UPDATE</div></div><div class="signal-line"><span>Sensory input</span><span class="signal-track"><i id="signal-fill"></i></span><span>Motor readout</span></div></section>
        <section class="card"><div class="card-heading"><h2>Flight scores</h2>${icon('activity')}</div><div class="chart-info"><strong id="eval-score">—<small>gates / flight</small></strong><span class="growth" id="improvement">EVALUATING</span></div><div class="chart-wrap"><canvas id="learning-chart" aria-label="Measured autonomous flight scores across training episodes"></canvas><div class="chart-axis"><span>UNTRAINED</span><span id="chart-end">TRAINED</span></div></div><div class="chart-caption" id="chart-caption">Training results will appear here.</div></section>
        <section class="card controls-card"><div class="card-heading"><h2>Course settings</h2>${icon('wind')}</div><div class="controls-body"><div class="control-label"><span>STARTING CHECKPOINT</span><span id="checkpoint-label">—</span></div><div class="select-wrap"><select id="checkpoint" aria-label="Starting brain checkpoint" disabled><option value="trained">Trained fly</option><option value="untrained">Untrained fly</option><option value="saved" id="saved-option" disabled>Saved learning</option></select>${icon('chevron-down')}</div><div class="conditions" aria-label="Environment"><button id="meadow" class="active" title="Meadow course" disabled>${icon('leaf')}Calm</button><button id="wind" title="Variable wind" disabled>${icon('wind')}Gusts</button><button id="narrow" title="Narrow pipe gaps" disabled>${icon('move-vertical')}Narrow</button></div></div><button class="save-button" id="save" disabled>${icon('download')}Save learning checkpoint</button></section>
        <div class="resource">${icon('cpu')}<span id="compute-policy">1 worker · 30 FPS cap</span></div>
      </aside>
    </section>
    <section class="under" aria-label="How this experiment works">
      <article><span class="stepnum">01</span><div><h3>Read the world</h3><p>Height, velocity, and gate position drive 14 input channels in the rate model.</p><div class="value" id="sensory-detail">14 modeled sensory channels</div></div></article>
      <article><span class="stepnum">02</span><div><h3>Choose an action</h3><p>The network updates its activity. A trained decoder reads it and requests a flap.</p><div class="value" id="decision-detail">Full network · every decision</div></div></article>
      <article><span class="stepnum">03</span><div><h3>Learn from each flight</h3><p>A flight coach corrects the decoder during training. Watch mode flies with frozen weights.</p><div class="value" id="learning-detail">Coach-guided learning · saved progress</div></div></article>
    </section>
  </main>
  <footer><span>Built on MaleCNS v1.0 · Google Research, HHMI Janelia & collaborators</span><a href="#methods" id="methods-link">Model and results ↗</a></footer>
  <dialog id="dialog"><div class="modal-head"><h2 id="dialog-title"></h2><button id="close-dialog" aria-label="Close dialog">${icon('x')}</button></div><div id="dialog-content"></div></dialog>
  <div class="toast" id="toast" role="status"></div>
`;
const inspector=installInspector(send);
renderIcons();

let world;
try { world=new FlightWorld($('world')); }
catch(error) { $('scene-notice').innerHTML='<strong>3D needs WebGL.</strong><p>Enable hardware acceleration in your browser,<br>then reload to see the flight.</p>';console.error(error); }
let socket, state=null, info=null, anatomy=[], connected=false, lastMessage=0, lastChartEpisode=-1;
const controls=['pause','restart','watch','adapt','checkpoint','meadow','wind','narrow','save'];
function setConnected(value) {
  connected=value;
  controls.forEach(id=>$(id).disabled=!value);
  $('connection-dot').className=`dot ${value?'connected':'offline'}`;
  $('connection-text').textContent=value?'Simulator connected':'Reconnecting to simulator';
  if(!value) {
    inspector.offline();
    $('live-label').textContent='CONNECTION PAUSED';
    notice('Simulator disconnected','The local simulator is offline.<br>Flight and neural activity are paused.');
    if(world)world.paused=true;
    loadProgress();
  }
}
async function loadProgress() {
  if(connected)return;
  try {
    const r=await fetch('/api/training-progress');if(!r.ok)return;
    const progress=await r.json();if(!progress.training||progress.training.status==='Complete')return;
    info={...info,...progress};
    const h=progress.training.history,last=h.at(-1),m=progress.manifest;
    if(m){$('neuron-count').textContent=fmt(m.neurons);$('edge-count').textContent=`${(m.edges/1e6).toFixed(1)}m`;}
    $('live-label').textContent='TRAINING IN BACKGROUND';
    notice('Training in progress',`${progress.training.status}<br>${h.length} recorded runs · 1 low-priority CPU worker`);
    if(last){$('eval-score').innerHTML=`${last.score}<small>gates · latest run</small>`;$('improvement').textContent='TRAINING';}
    $('chart-caption').textContent='Measured training runs. Frozen evaluation is still in progress.';
    drawChart();
  }catch{}
}
function send(action,value) { if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({action,value})); }
function notice(title,body) { $('scene-notice').innerHTML=`<strong>${title}</strong><p>${body}</p>`;$('scene-notice').classList.remove('hidden'); }
let toastTimer;
function toast(text) { $('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000); }
async function loadInfo() {
  try {
    const response=await fetch('/api/status'); if(!response.ok)return;
    info=await response.json();
    const m=info.manifest;
    $('neuron-count').textContent=fmt(m.neurons);
    $('edge-count').textContent=`${(m.edges/1e6).toFixed(1)}m`;
    $('sensory-detail').textContent=`${fmt(m.inputNeurons)} sensory neurons · 14 channels`;
    $('saved-option').disabled=!info.saved;
    const e=info.evaluation;
    if(e) {
      $('eval-score').innerHTML=`${e.trained.meanScore.toFixed(1)}<small>gates / flight</small>`;
      $('improvement').textContent=`+${(e.trained.meanScore-e.baseline.meanScore).toFixed(1)} vs untrained`;
      $('chart-caption').innerHTML=`<span>${e.trained.completed}/${e.trained.episodes} unseen courses completed.</span><br>Frozen weights · ${e.gateCap}-gate evaluation cap.`;
    }
    drawChart();
  }catch{ /* Keep the connection status visible if the request fails. */ }
}
function connect() {
  socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
  socket.onopen=()=>{setConnected(true);loadInfo();};
  socket.onmessage=(event)=>{
    try { state=JSON.parse(event.data);lastMessage=performance.now();update(state); }catch(error){console.error(error);}
  };
  socket.onclose=()=>{setConnected(false);setTimeout(connect,2500);};
  socket.onerror=()=>socket.close();
}
function update(packet) {
  world?.receive(packet);
  const g=packet.game,l=packet.lab,b=packet.brain;
  inspector.update(packet);
  $('flight-scene').classList.toggle('is-paused',l.paused);
  const decoderLabel=l.mode==='watch'&&l.checkpoint==='Adapting'?'Learned':l.checkpoint;
  $('score').textContent=String(g.score).padStart(2,'0');
  $('live-label').textContent=l.paused?'PAUSED':`LIVE · ${l.simSpeed.toFixed(2)}× GAME TIME`;
  $('run-label').textContent=l.muted?'NEURAL OUTPUT DISCONNECTED':`FLIGHT ${String(l.episode).padStart(3,'0')} · ${l.mode==='adapt'?'LEARNING':'AUTONOMOUS'}`;
  $('pilot-name').textContent='Pilot: fly connectome';
  $('run-detail').textContent=l.muted?'Learning held · commands cannot reach the fly':l.mode==='adapt'?`Coach-guided · ${fmt(l.updates)} decoder updates`:`${decoderLabel} decoder · best ${l.best} gates`;
  $('active-neurons').textContent=`${(b.active/1000).toFixed(1)}k`;
  $('flap-probability').textContent=`${Math.round(l.probability*100)}%`;
  $('compute-ms').textContent=b.stepMs.toFixed(0);
  $('signal-fill').style.width=`${Math.round(l.probability*100)}%`;
  $('checkpoint-label').textContent=decoderLabel.toUpperCase();
  $('watch').classList.toggle('active',l.mode==='watch');$('adapt').classList.toggle('active',l.mode==='adapt');
  for(const c of ['meadow','wind','narrow'])$(c).classList.toggle('active',l.course===c);
  $('world-name').textContent={meadow:'THE MEADOW',wind:'GUSTS',narrow:'NARROW GAPS'}[l.course];
  const pauseLabel=l.paused?'Resume simulation':'Pause simulation';
  if($('pause').getAttribute('aria-label')!==pauseLabel){$('pause').setAttribute('aria-label',pauseLabel);$('pause').title=pauseLabel;$('pause').innerHTML=icon(l.paused?'play':'pause');renderIcons();}
  $('compute-policy').textContent=`1 worker · 45% duty target · 30 FPS cap`;
  $('decision-detail').textContent=`${fmt(info?.manifest.edges??25582938)} connections per update`;
  $('learning-detail').textContent=l.muted?'Learning held · neural output disconnected':l.mode==='adapt'?`Weight change ${l.weightChange.toFixed(3)} · loss ${l.loss.toFixed(3)}`:'Weights frozen · independent flight';
  if(l.muted){$('chart-caption').textContent=`Learning held while output is disconnected · ${fmt(l.updates)} updates`;}else if(l.mode==='adapt') {
    $('chart-caption').innerHTML=`<span>Live correction loss ${l.loss.toFixed(3)}.</span><br>${fmt(l.updates)} updates · weight change ${l.weightChange.toFixed(3)}`;
  }else if(info?.evaluation){const e=info.evaluation;$('chart-caption').innerHTML=`<span>${e.trained.completed}/${e.trained.episodes} unseen courses completed.</span><br>Frozen weights · ${e.gateCap}-gate evaluation cap.`;}
  if(l.lastSaved){$('saved-option').disabled=false;}
  if(l.paused)notice('Inspect this decision.',`#${packet.decision?.id??'—'} · ${packet.decision?.outcome??'Ready'}<br>Use Step one decision to follow the next signal.`);
  else if(g.done)notice(g.reason==='Course complete'?'Course complete':'Flight ended',`${g.score} gates cleared · ${g.reason.toLowerCase()}<br>A new flight begins in a moment.`);
  else $('scene-notice').classList.add('hidden');
  if(lastChartEpisode!==l.history.length){lastChartEpisode=l.history.length;drawChart();}
}

$('pause').onclick=()=>send('pause');
$('restart').onclick=()=>send('restart');
$('watch').onclick=()=>send('mode','watch');
$('adapt').onclick=()=>{send('mode','adapt');toast('Online decoder training enabled.');};
$('checkpoint').onchange=(event)=>{send('checkpoint',event.target.value);toast('Starting a new flight with this checkpoint.');};
for(const c of ['meadow','wind','narrow'])$(c).onclick=()=>{send('course',c);toast(c==='meadow'?'Back to calm air.':c==='wind'?'Gusts enabled.':'The gaps are narrower now.');};
let saveRequestedAt=null;
$('save').onclick=()=>{saveRequestedAt=state?.lab.lastSaved??'';send('save');};
setInterval(()=>{if(saveRequestedAt!==null&&state?.lab.lastSaved!==saveRequestedAt){toast('Learning checkpoint saved locally.');saveRequestedAt=null;}},400);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.workspace').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser panel.');}};
$('flight-tab').onclick=()=>{$('dialog').close();$('flight-scene').scrollIntoView({behavior:'smooth',block:'center'});};
$('close-dialog').onclick=()=>$('dialog').close();
$('dialog').onclick=(event)=>{if(event.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('dialog').close();}};

function showDialog(title,content) {$('dialog-title').textContent=title;$('dialog-content').innerHTML=content;$('dialog').showModal();renderIcons();}
$('journal-tab').onclick=()=>{
  const events=state?.lab.events??[];
  showDialog('Field notes.',`<p>Events from the running simulator.</p>${events.length?events.map(e=>`<div class="journal-event"><span class="dot"></span>${e.text}<small>${e.time.toFixed(1)}s</small></div>`).join(''):'<p>Waiting for simulator events.</p>'}<h3>What is adapting?</h3><p>“Let it learn” uses coach-supervised corrections to update the decoder that turns neural activity into flaps. The fly still takes every action itself. Switching to “Watch it fly” freezes learning so you can observe the result independently.</p><p>To watch learning from the beginning, choose <b>Untrained fly</b>, then <b>Let it learn</b>. Use <b>Trained fly</b> to return to the evaluated checkpoint.</p>`);
};
$('methods-link').onclick=(event)=>{
  event.preventDefault();
  const m=info?.manifest,e=info?.evaluation;
  const rows=e?['baseline','trained','perturbations','silenced','shuffled'].map(key=>`<tr><td>${{baseline:'Untrained decoder',trained:'Trained · unseen seeds',perturbations:'Wind / narrow gaps',silenced:'Neural activity silenced',shuffled:'Presynaptic IDs shuffled'}[key]}</td><td>${e[key].meanScore.toFixed(2)}</td><td>${e[key].completed} / ${e[key].episodes}</td></tr>`).join(''):'';
  showDialog('Model and results',`
    <p>This experiment uses the <a href="https://male-cns.janelia.org/" target="_blank" rel="noreferrer">MaleCNS v1.0 connectome</a> from HHMI Janelia, Google Research and collaborators. ${m?`${fmt(m.neurons)} annotated neurons and ${fmt(m.edges)} directed edges (${fmt(m.synapticContacts)} synaptic contacts) are retained.`:'The simulator is connecting.'} Every retained neuron is updated at each decision.</p>
    <h3>Rate model</h3><p>The wiring is biological data. The activity model is an engineered, rectified-tanh rate reservoir, with normalized connection weights and simplified neurotransmitter signs. It is not the published Shiu spiking model, a reconstructed living fly, or a model of biological flight mechanics.</p>
    <p>Game height, velocity, gap position and wind are encoded into 14 artificial sensory channels. A logistic decoder reads 64 neural population averages and their changes. No game observation bypasses the neural state to enter that decoder. Sensory populations are included in its readout. The little fly and meadow are original procedural game artwork; the dots above use actual sampled neuron soma coordinates, colored by modeled activity.</p>
    <h3>What training changes</h3><p>Coach demonstrations and on-policy corrections (DAgger) train the <b>decoder weights</b>. All connectome edge weights remain fixed. This demonstrates an engineered controller learning to use connectome activity, not that a biological fly has learned this game. A topology advantage has not been established.</p>
    <h3>Measured results</h3>${e?`<table><thead><tr><th>Condition</th><th>Mean gates</th><th>Completed</th></tr></thead><tbody>${rows}</tbody></table><p>Each run is capped at ${e.gateCap} gates. ${fmt(e.trainingSamples)} training observations; evaluation seeds are disjoint from training. Evaluation has no teacher actions and no weight updates. Shuffling tests the same learned decoder, not a separately retrained shuffled baseline.</p>`:'<p>Evaluation has not yet been loaded.</p>'}
    <h3>Compute limits</h3><p>One CPU simulation worker, one numeric-library thread, 45% target worker duty cycle, low OS priority and at most 10 updates per wall second. Rendering is capped at 30 FPS with a 1.25× pixel-ratio limit. Game time slows to fit this budget. No GPU training. The simulation idles when no viewers are connected.</p>
    <p><a href="https://male-cns.janelia.org/download/" target="_blank" rel="noreferrer">Data and CC-BY attribution</a> · <a href="https://github.com/philshiu/Drosophila_brain_model" target="_blank" rel="noreferrer">Related Shiu reference model</a></p>`);
};

let brainFrame=0, selectedNeuron=null, projectedNeurons=[], brainView='activity';
for(const mode of ['activity','change'])$(mode+'-view').onclick=()=>{brainView=mode;$('activity-view').classList.toggle('active',mode==='activity');$('change-view').classList.toggle('active',mode==='change');$('brain').closest('.brain-area').classList.toggle('change-mode',mode==='change');$('brain-scale-low').textContent=mode==='change'?'FALLING':'LOW';$('brain-scale-high').textContent=mode==='change'?'RISING · Δ × 80':'ACTIVITY × 5';};
$('brain').onclick=event=>{const r=$('brain').getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;let best=12;for(const n of projectedNeurons){const d=Math.hypot(n.x-x,n.y-y);if(d<best){best=d;selectedNeuron=n.index;}}};
function drawBrain(now) {
  requestAnimationFrame(drawBrain);
  if(document.hidden||now-brainFrame<100)return;brainFrame=now;
  const canvas=$('brain'),rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.25);
  if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
  if(!anatomy.length)return;
  const activity=connected&&performance.now()-lastMessage<1800?state?.brain.activity:null;
  // Sampled EM soma coordinates with a fixed projection.
  const angle=.24,ca=Math.cos(angle),sa=Math.sin(angle);
  const scale=Math.min(rect.width*.69,rect.height*.88);
  const dots=anatomy.map((n,i)=>{
    const [x,y,z]=n.xyz;
    return {index:i,x:rect.width/2+(x*ca+z*sa)*scale,y:rect.height*.46+(y*.9-z*.20)*scale,z,activity:activity?.[i]??0,change:activity?state?.brain.change?.[i]??0:0};
  });
  dots.sort((a,b)=>a.z-b.z);projectedNeurons=dots;
  if(selectedNeuron!==null){const n=anatomy[selectedNeuron];$('neuron-inspect').textContent=`Neuron ${n.id} · ${n.group.replaceAll('_',' ')} · activity ${(activity?.[selectedNeuron]??0).toFixed(3)} · Δ ${(state?.brain.change?.[selectedNeuron]??0).toFixed(4)}`;}
  for(const dot of dots){
    const a=Math.min(1,brainView==='change'?Math.abs(dot.change)*80:dot.activity*5);
    ctx.fillStyle=brainView==='change'&&dot.change<0?`rgba(239,153,153,${.15+a*.85})`:`rgba(${Math.round(80+a*157)},${Math.round(125+a*100)},${Math.round(132-a*30)},${.18+a*.82})`;
    ctx.beginPath();ctx.arc(dot.x,dot.y,.8+a*1.3,0,Math.PI*2);ctx.fill();
    if(a>.65){ctx.fillStyle=`rgba(175,239,171,${a*.13})`;ctx.beginPath();ctx.arc(dot.x,dot.y,3.4,0,Math.PI*2);ctx.fill();}
    if(dot.index===selectedNeuron){ctx.strokeStyle='#fff3bb';ctx.lineWidth=1;ctx.beginPath();ctx.arc(dot.x,dot.y,5,0,Math.PI*2);ctx.stroke();}

  }
}
function drawChart() {
  const canvas=$('learning-chart'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.5);
  canvas.width=r.width*dpr;canvas.height=r.height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const offline=info?.training?.history?.filter(h=>h.stage==='Autonomous + corrections')??[];
  const values=[info?.evaluation?.baseline?.meanScore??0,...offline.map(h=>h.score),...(state?.lab.history??[]).map(h=>h.score)];
  const max=Math.max(info?.evaluation?.gateCap??15,...values,1);
  const left=5,right=r.width-5,top=8,bottom=r.height-7;
  ctx.strokeStyle='#e5eadd';ctx.lineWidth=.75;ctx.setLineDash([3,4]);
  for(let i=0;i<3;i++){const y=top+(bottom-top)*i/2;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
  ctx.setLineDash([]);
  if(values.length<2)return;
  const points=values.map((v,i)=>[left+i/(values.length-1)*(right-left),bottom-v/max*(bottom-top)]);
  const grad=ctx.createLinearGradient(0,top,0,bottom);grad.addColorStop(0,'#adbf814f');grad.addColorStop(1,'#dbe5c900');
  ctx.beginPath();ctx.moveTo(left,bottom);for(const [x,y]of points)ctx.lineTo(x,y);ctx.lineTo(right,bottom);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();for(let i=0;i<points.length;i++){const[x,y]=points[i];if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle='#879e5e';ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.stroke();
  const [x,y]=points.at(-1);ctx.fillStyle='#75934b';ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();
  $('chart-end').textContent=state?.lab.history.length?'LIVE FLIGHTS':'TRAINING FLIGHTS';
}
fetch('/brain.json').then(r=>r.ok?r.json():[]).then(data=>{anatomy=data;$('brain-caption').textContent=`${fmt(data.length)} sampled somas · modeled activity`;}).catch(()=>{});
new ResizeObserver(()=>inspector.drawTrace()).observe($('activity-trace'));
new ResizeObserver(drawChart).observe($('learning-chart'));
setInterval(()=>{if(connected&&performance.now()-lastMessage>4000){setConnected(false);socket?.close();}},1500);
setInterval(loadProgress,4000);
window.flightLab={get state(){return state;},get info(){return info;},get connected(){return connected;},get renderer(){return world?.renderer;}};
requestAnimationFrame(drawBrain);
loadInfo();connect();
