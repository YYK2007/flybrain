const $=id=>document.getElementById(id);
const signed=n=>`${n>=0?'+':''}${n.toFixed(2)}`;
const names=['Sensory','Optic lobes','Visual projection','Central brain','Descending','Ventral cord'];
const groups=[[0,14],[14,24],[24,32],[32,48],[48,56],[56,64]];
const colors=['#89dfcf','#97b9ed','#c1b0ed','#e5bc81','#e59f9f','#b6d98a'];
export function installInspector(send) {
  const old=$('brain').closest('.card');
  old.classList.add('neuro-card');
  old.innerHTML=`<div class="neuro-heading"><div><span class="scope-label">LIVE CONTROLLER</span><h2>Controller activity</h2></div><span class="neuro-live" id="neuro-live">CONNECTING</span></div>
    <div class="brain-view-switch"><button id="activity-view" class="active">Activity</button><button id="change-view">Activity changes</button></div><div class="brain-area"><canvas id="brain" aria-label="Actual sampled fly neurons colored by current modeled activity"></canvas><div class="brain-legend"><span id="brain-scale-low">LOW</span><i></i><span id="brain-scale-high">ACTIVITY × 5</span></div><span class="brain-annotation" id="brain-caption">Loading anatomy</span></div>
    <div class="neuron-inspect" id="neuron-inspect">Select a dot to inspect its neuron ID and modeled activity.</div>
    <div class="neural-stats"><div><b id="active-neurons">—</b>ACTIVE NEURONS</div><div><b id="flap-probability">—</b>FLAP SIGNAL</div><div><b id="compute-ms">—</b>MS / UPDATE</div></div>
    <div class="contribution-title"><span>DECODER CONTRIBUTIONS</span><small>← coast · flap →</small></div>
    <div id="contributions">${names.map((n,i)=>`<div class="contribution"><span>${n}</span><div class="balance"><i id="contribution-${i}"></i></div><b id="contribution-value-${i}">—</b></div>`).join('')}</div>
    <div class="decision-equation" id="decision-equation">Waiting for the first decision.</div>
    <div class="last-flap" id="last-flap">Waiting for the next neural flap.</div><div class="neuro-foot">Exact decoder contributions, including activity changes. The wiring stays fixed during learning.</div>`;
  $('flight-scene').insertAdjacentHTML('beforeend',`<div class="pilot-hud" id="pilot-hud"><span class="scope-label">NEURAL OUTPUT → FLIGHT</span><div><b id="action-label">CONNECTING</b><span id="action-prob">—</span></div><div class="threshold"><i id="signal-fill"></i><span></span></div><small id="action-reason">Awaiting live decisions</small><button id="catch-hud" disabled>Inspect next flap ↗</button></div><div id="fly-callout" class="fly-callout">↑ NEURAL FLAP</div>`);
  $('flight-scene').insertAdjacentHTML('beforebegin',`<div class="pilot-strip"><span><i class="dot"></i><span id="pilot-status">FLY BRAIN IN CONTROL</span></span><b id="decision-clock">Waiting for live stream</b></div>`);
  document.querySelector('.flight-toolbar').insertAdjacentHTML('afterend',`<section class="causal-panel"><div class="causal-heading"><h2>Decision trace</h2><span id="trace-clock">LIVE SIGNALS</span></div>
    <div class="causal-chain"><div><span>01 · SENSE</span><b id="sense-gap">—</b><small id="sense-motion">World → 14 sensory channels</small></div><div><span>02 · COMPUTE</span><b id="chain-signal">—</b><small>Neural activity → learned decoder</small></div><div><span>03 · MOVE</span><b id="move-velocity">—</b><small id="move-reason">Decoder → vertical velocity</small></div></div>
    <details class="sensory-inputs"><summary>Inspect the 14 sensory inputs</summary><p>Seven game measurements drive 14 paired inputs in the rate model. The controller receives game state rather than rendered images.</p><div class="sensory-pairs">${["Gap height","Vertical speed","Gate distance","Fly height","Following gap","Wind","Gap width"].map((n,i)=>`<div><span>${n}</span><div class="paired-drive"><i id="input-plus-${i}"></i><i id="input-minus-${i}"></i></div><small id="input-value-${i}">—</small></div>`).join('')}</div></details><div class="trace-heading"><span>NEURAL ACTIVITY → FLAP SIGNAL → MOVEMENT</span><span>Recent decisions · up to 8s</span></div><canvas id="activity-trace" aria-label="Live neural population activity heatmap, flap probability, applied flaps and vertical velocity on a shared time axis"></canvas>
    <div class="inspect-controls"><button id="slow" disabled>Slow observation</button><button id="catch" disabled>Catch a flap</button><button id="step" disabled>Step one decision</button><button id="mute" disabled>Disconnect output</button></div>
    <p id="intervention-note">Pause, then step through the loop. Disconnect output to see what changes when neural commands cannot reach the fly.</p>
    <p class="rate-note">Color shows modeled activity rates, not biological spikes. Brightness gain: anatomy ×5, heatmap ×3, changes ×80. Gold ticks mark actual flaps. All panels share the same decision clock.</p></section>`);
  for(const id of ['slow','step','mute','catch'])$(id).onclick=()=>send(id);
  $('catch-hud').onclick=()=>send('catch');
  return new Inspector();
}
class Inspector {
  constructor(){this.history=[];this.lastId=null;this.seed=null;this.packet=null;}
  offline(){ $('pilot-status').textContent='CONTROLLER OFFLINE';$('neuro-live').textContent='OFFLINE';$('action-label').textContent='OFFLINE';$('action-reason').textContent='No new neural commands';$('pilot-hud').dataset.action='OFFLINE';$('decision-clock').textContent='Stream disconnected';$('fly-callout').classList.remove('firing');for(const id of ['slow','step','mute','catch','catch-hud'])$(id).disabled=true; }
  update(packet){
    const d=packet.decision,l=packet.lab;this.packet=packet;
    $('pilot-status').textContent=l.muted?'NEURAL OUTPUT DISCONNECTED':l.paused?'BRAIN & FLIGHT PAUSED':'FLY BRAIN IN CONTROL';
    $('catch-hud').disabled=l.muted||packet.game.done;$('catch-hud').textContent=l.catchFlap?'Waiting for flap…':'Inspect next flap ↗';$('catch').disabled=l.muted||packet.game.done;$('catch').textContent=l.catchFlap?'Waiting for flap…':'Catch a flap';$('catch').classList.toggle('active',l.catchFlap);
    $('slow').disabled=false;$('mute').disabled=false;$('step').disabled=!l.paused||packet.game.done;
    $('slow').classList.toggle('active',l.slow);$('slow').textContent=l.slow?'Normal observation':'Slow observation';
    $('mute').classList.toggle('active',l.muted);$('mute').textContent=l.muted?'Reconnect output':'Disconnect output';
    $('neuro-live').textContent=l.paused?'PAUSED':l.muted?'OUTPUT CUT':'LIVE';
    $('pilot-hud').dataset.action=l.paused?'PAUSED':l.muted?'DISCONNECTED':d?.outcome??'WAIT';
    $('intervention-note').textContent=l.muted?'Output disconnected. The brain still computes, but no flap reaches the fly. Learning is held. Reconnect to restore control.':l.paused?'Paused at one decision. Step advances the brain and flight together by 50 ms.':'The fly selects every action. Slow observation makes each neural decision easier to follow.';
    if(this.seed!==packet.game.seed||(d&&this.lastId!==null&&d.id<this.lastId)){this.history=[];this.seed=packet.game.seed;this.lastId=null;$('last-flap').textContent='Waiting for the next neural flap.';}
    if(!d){for(const id of ['sense-gap','sense-motion','chain-signal','move-velocity','move-reason','action-prob','action-reason'])$(id).textContent='—';$('signal-fill').style.width='0%';$('decision-equation').textContent='Waiting for the first decision.';for(let i=0;i<6;i++){$(`contribution-${i}`).style.width='0%';$(`contribution-value-${i}`).textContent='—';} $('action-label').textContent='READY';$('decision-clock').textContent='New flight · waiting for decision';$('fly-callout').classList.remove('firing');this.drawTrace();return;}
    d.observation.forEach((v,i)=>{const c=Math.max(-1.5,Math.min(1.5,v)),plus=.7+.42*c,minus=.7-.42*c;$(`input-plus-${i}`).style.width=`${plus/1.4*100}%`;$(`input-minus-${i}`).style.width=`${minus/1.4*100}%`;$(`input-value-${i}`).textContent=`+ ${plus.toFixed(3)} / − ${minus.toFixed(3)}`;});
    const fresh=d.id!==this.lastId;
    if(fresh&&d.applied)$('last-flap').textContent=`LAST FLAP · #${d.id} at ${d.time.toFixed(2)}s · ${(l.probability*100).toFixed(1)}% signal → ${signed(d.afterVy)} m/s`;
    if(fresh){this.history.push({p:l.probability,activity:packet.brain.pools,flap:d.applied,vy:d.afterVy,t:d.time});if(this.history.length>160)this.history.shift();this.lastId=d.id;}
    $('decision-clock').textContent=`DECISION ${d.id.toLocaleString()} · ${d.time.toFixed(2)}s`;
    $('trace-clock').textContent=l.paused?'FROZEN AT THIS DECISION':`DECISION ${d.id.toLocaleString()}`;
    $('action-label').textContent=l.muted||d.muted?'OUTPUT CUT':d.outcome;
    $('action-prob').textContent=`${(l.probability*100).toFixed(1)}%`;
    $('action-reason').textContent=l.muted||d.muted?'Neural commands blocked at this decision':d.applied?'Threshold crossed → lift applied':d.requested?'Flap requested · wing cooldown':'Below 50% threshold → no flap';
    $('fly-callout').classList.toggle('firing',!l.muted&&d.applied);
    $('fly-callout').textContent=`↑ FLAP · #${d.id}`;
    $('sense-gap').textContent=`Opening ${Math.abs(d.before.gap).toFixed(2)} m ${d.before.gap>=0?'above':'below'}`;
    $('sense-motion').textContent=`${d.before.distance.toFixed(1)} m ahead · wind ${signed(d.before.wind)}`;
    $('chain-signal').textContent=`${(l.probability*100).toFixed(1)}% flap signal`;
    $('move-velocity').textContent=`${signed(d.before.vy)} → ${signed(d.afterVy)} m/s`;
    $('move-reason').textContent=d.muted?'Output blocked · gravity + wind':d.applied?'Flap sets +6.70 m/s, then gravity + wind':d.requested?'Cooldown blocks flap · gravity + wind':'Coast · gravity + wind';
    const max=Math.max(1,...d.contributions.map(x=>Math.abs(x.value)));
    d.contributions.forEach((c,i)=>{const bar=$(`contribution-${i}`);bar.style.width=`${Math.abs(c.value)/max*50}%`;bar.style.left=c.value>=0?'50%':`${50-Math.abs(c.value)/max*50}%`;bar.style.background=c.value>=0?'#95dfb1':'#eeaf85';$(`contribution-value-${i}`).textContent=signed(c.value);});
    const sum=d.contributions.reduce((a,c)=>a+c.value,0);
    $('decision-equation').textContent=`${signed(sum)} activity ${signed(d.bias)} bias = ${signed(d.logit)} → ${(l.probability*100).toFixed(1)}%`;
    if(fresh)this.drawTrace();
  }
  drawTrace(){
    const c=$('activity-trace'),r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.25);c.width=r.width*dpr;c.height=r.height*dpr;
    const ctx=c.getContext('2d');ctx.scale(dpr,dpr);const left=89,w=r.width-left-12,cell=w/Math.max(1,this.history.length-1);
    ctx.font='9px "DM Sans", sans-serif';ctx.fillStyle='#819d97';ctx.textAlign='left';
    groups.forEach(([a,b],g)=>{ctx.fillStyle=colors[g];ctx.fillText(names[g],2,15+g*16);});
    this.history.forEach((s,i)=>{const x=left+i*cell;for(let g=0;g<6;g++){const[a,b]=groups[g];for(let j=a;j<b;j++){const rate=s.activity[j];ctx.fillStyle=`rgba(132,225,197,${Math.min(1,rate*3)})`;ctx.fillRect(x,5+g*16+(j-a)/(b-a)*13,Math.min(Math.ceil(cell),r.width-12-x),Math.max(1,13/(b-a)));}}
      if(s.flap){ctx.fillStyle='#ebc375';ctx.fillRect(x,108,Math.max(2,cell),40);}});
    ctx.fillStyle='#91dfc7';ctx.fillText('Flap signal',2,122);ctx.fillStyle='#91bce8';ctx.fillText('Vertical speed',2,172);
    ctx.strokeStyle='#54736c';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(left,130);ctx.lineTo(r.width-12,130);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#78988f';ctx.fillText('50%',left+3,127);
    for(const [key,color,base,scale]of [['p','#9aefc8',146,32],['vy','#98c8f2',179,1.7]]){ctx.beginPath();this.history.forEach((s,i)=>{const x=left+i*cell,y=base-s[key]*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();}
    ctx.fillStyle='#8ea79f';ctx.fillText(this.history.length?`${this.history[0].t.toFixed(2)}s`:'Waiting for live data',left,208);ctx.textAlign='right';ctx.fillText(this.history.length?`${this.history.at(-1).t.toFixed(2)}s →`: '',r.width-12,208);
  }
}
