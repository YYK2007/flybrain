import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
function random(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class FlightWorld {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dce4c4');
    this.scene.fog = new THREE.FogExp2('#dce4c4', .012);
    this.camera = new THREE.PerspectiveCamera(49, 1, .1, 280);
    this.renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .92;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Third-person 3D view of an autonomous fly navigating a meadow pipe course');
    this.scene.add(new THREE.HemisphereLight('#f9f7d7', '#768857', 1.7));
    const sun = new THREE.DirectionalLight('#fff0c6', 2.7);
    sun.position.set(-20, 36, -15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-25,right:25,top:36,bottom:-20,far:100});
    sun.shadow.normalBias = .08;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight('#dfe9c8', .15));
    this.pipes = [];
    this.scenery = new THREE.Group();
    this.scene.add(this.scenery);
    this.buildLandscape();
    this.nextScenery = this.scenery.clone();
    this.scene.add(this.nextScenery);
    this.buildPipes();
    this.buildFly();
    this.actual = { y:6.5, vy:0, z:0, time:0, gates:[] };
    this.visual = { y:6.5, z:0, vy:0 };
    this.connected = false;
    this.paused = true;
    this.lastFrame = 0;
    this.clock = 0;
    this.lastPacket = performance.now();
    this.flapPulse = 0;
    this.lastDecision = null;
    this.cameraY = 8;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }
  mat(color, options={}) {
    return new THREE.MeshStandardMaterial({ color, roughness:.86, metalness:0, ...options });
  }
  mesh(geometry, material, parent=this.scene) {
    const m = new THREE.Mesh(geometry, material);
    parent.add(m); return m;
  }
  buildLandscape() {
    const rng = random(311);
    const terrain = new THREE.PlaneGeometry(300, 360, 110, 120);
    terrain.rotateX(-Math.PI/2);
    const p = terrain.attributes.position;
    const colors = [];
    for (let i=0; i<p.count; i++) {
      const x=p.getX(i), z=p.getZ(i);
      const side=clamp((Math.abs(x)-5)/20,0,1);
      const h=side*(Math.sin(x*.08+z*.045)*2.7+Math.cos(z*.072-x*.12)*1.8+2.7)-.55;
      p.setY(i,h);
      const c=new THREE.Color().lerpColors(new THREE.Color('#7e9e54'),new THREE.Color('#b2bf78'),clamp((h+1)/10+Math.sin(z*.05)*.1,0,1));
      colors.push(c.r,c.g,c.b);
    }
    terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    terrain.computeVertexNormals();
    this.ground=this.mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
    this.ground.position.z=95;
    this.ground.receiveShadow=true;

    // A quiet ribbon of water under the flight path.
    const waterGeo=new THREE.PlaneGeometry(5.8,300,12,90);
    waterGeo.rotateX(-Math.PI/2);
    const wp=waterGeo.attributes.position;
    for(let i=0;i<wp.count;i++) wp.setX(i,wp.getX(i)+Math.sin(wp.getZ(i)*.035)*.7);
    waterGeo.computeVertexNormals();
    this.water=this.mesh(waterGeo,this.mat('#8aa788',{roughness:.27,metalness:.15,transparent:true,opacity:.78}));
    this.water.position.set(0,-.39,110);
    this.water.receiveShadow=true;

    const rockGeo=new THREE.IcosahedronGeometry(1,2);
    const rockMat=this.mat('#abb693');
    this.rocks=new THREE.InstancedMesh(rockGeo,rockMat,100);
    const obj=new THREE.Object3D();
    for(let i=0;i<100;i++) {
      const side=i%2 ? 1:-1;
      obj.position.set(side*(6+rng()*50),-.6, rng()*240-25);
      obj.scale.set(1+rng()*4,.5+rng()*3,1+rng()*4);
      obj.rotation.set(rng()*.5,rng()*Math.PI,rng()*.4);
      obj.updateMatrix(); this.rocks.setMatrixAt(i,obj.matrix);
      this.rocks.setColorAt(i,new THREE.Color().lerpColors(new THREE.Color('#8a9d77'),new THREE.Color('#c7cbaa'),rng()));
    }
    this.rocks.castShadow=true;this.rocks.receiveShadow=true;this.scenery.add(this.rocks);

    // Rounded distant limestone stacks give depth without expensive assets.
    const mountains=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,3),this.mat('#9baa88'),22);
    for(let i=0;i<22;i++) {
      const side=i%2 ? 1:-1;
      obj.position.set(side*(40+rng()*80),2,30+rng()*180);
      obj.scale.set(8+rng()*15,12+rng()*32,7+rng()*15);
      obj.rotation.set(rng()*.1,rng()*2,rng()*.1);
      obj.updateMatrix();mountains.setMatrixAt(i,obj.matrix);
    }
    this.scene.add(mountains);

    // Instanced clover leaves and reeds, kept off the collision lane.
    const leafGeo=new THREE.SphereGeometry(1,8,6);
    const leaves=new THREE.InstancedMesh(leafGeo,this.mat('#5e8541'),800);
    for(let i=0;i<800;i++) {
      const side=i%2?1:-1;
      const x=side*(4.1+rng()*18), z=rng()*220-20;
      obj.position.set(x,Math.max(0,Math.abs(x)-8)*.035+rng()*.8,z);
      obj.scale.set(.15+rng()*.5,.02+rng()*.025,.35+rng()*.8);
      obj.rotation.set(rng()*.4,rng()*6.28,side*(.2+rng()*.4));
      obj.updateMatrix();leaves.setMatrixAt(i,obj.matrix);
      leaves.setColorAt(i,new THREE.Color().lerpColors(new THREE.Color('#486e3c'),new THREE.Color('#b7c877'),rng()));
    }
    this.scenery.add(leaves);
    const grassPositions=[];
    for(let i=0;i<1600;i++) {
      const side=i%2?1:-1,x=side*(3.5+rng()*26),z=rng()*240-20,h=.25+rng()*.9;
      const y=Math.max(0,Math.abs(x)-8)*.025;
      grassPositions.push(x-.05,y,z,x+.05,y,z,x+.1,y+h,z+.05);
    }
    const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(grassPositions,3));grassGeo.computeVertexNormals();
    this.mesh(grassGeo,this.mat('#809d51',{side:THREE.DoubleSide}),this.scenery);

    const seedPositions=[];
    for(let i=0;i<80;i++)seedPositions.push((rng()-.5)*55,1+rng()*16,rng()*160-10);
    const seedsGeo=new THREE.BufferGeometry();seedsGeo.setAttribute('position',new THREE.Float32BufferAttribute(seedPositions,3));
    this.seeds=new THREE.Points(seedsGeo,new THREE.PointsMaterial({color:'#f4f1c3',size:.055,transparent:true,opacity:.65}));
    this.scene.add(this.seeds);

    // Sparse bank flowers, pale enough to remain part of the landscape.
    const blooms=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.16,1),this.mat('#e4deb0'),95);
    for(let i=0;i<95;i++) {
      obj.position.set((i%2?1:-1)*(4+rng()*10),.6+rng()*.4,rng()*170);
      obj.scale.setScalar(.5+rng());obj.rotation.set(0,0,0);obj.updateMatrix();blooms.setMatrixAt(i,obj.matrix);
    }
    this.scenery.add(blooms);
  }
  buildPipes() {
    const pipeMat=this.mat('#547e69',{roughness:.71});
    const lipMat=this.mat('#87a881',{roughness:.63});
    const darkMat=this.mat('#3f644e');
    const geo=new THREE.CylinderGeometry(1.15,1.15,1,48);
    const rimGeo=new THREE.CylinderGeometry(1.25,1.25,.32,48);
    const edgeGeo=new THREE.TorusGeometry(1.22,.025,6,48);edgeGeo.rotateX(Math.PI/2);
    for(let i=0;i<11;i++) {
      const group=new THREE.Group();
      const lower=this.mesh(geo,pipeMat,group),upper=this.mesh(geo,pipeMat,group);
      const bottomRim=this.mesh(rimGeo,lipMat,group),topRim=this.mesh(rimGeo,lipMat,group);
      const line1=this.mesh(edgeGeo,darkMat,group),line2=this.mesh(edgeGeo,darkMat,group);
      for(const m of [lower,upper,bottomRim,topRim]){m.castShadow=true;m.receiveShadow=true;}
      const badge=this.mesh(new THREE.TorusGeometry(.13,.018,5,24),new THREE.MeshBasicMaterial({color:'#d8e2ae'}),group);
      badge.position.set(0,0,-1.16);
      this.scene.add(group);this.pipes.push({group,lower,upper,bottomRim,topRim,line1,line2,badge});
    }
    this.previewGates=Array.from({length:11},(_,i)=>({id:i,z:28+i*23,y:6.4+Math.sin(i*2.3)*2.2,half:2.1}));
  }
  buildFly() {
    this.fly=new THREE.Group();this.scene.add(this.fly);
    const shell=this.mat('#253529',{roughness:.38,metalness:.22});
    const abdomen=this.mat('#39432c',{roughness:.53});
    const eye=this.mat('#863d25',{roughness:.3,metalness:.13});
    const sphere=new THREE.SphereGeometry(1,24,16);
    const body=this.mesh(sphere,shell,this.fly);body.scale.set(.29,.3,.39);body.castShadow=true;
    const tail=this.mesh(sphere,abdomen,this.fly);tail.position.set(0,-.02,-.47);tail.scale.set(.3,.25,.49);tail.castShadow=true;
    for(let i=0;i<4;i++) {
      const band=this.mesh(new THREE.TorusGeometry(.257-i*.025,.012,5,28),shell,this.fly);
      band.position.set(0,-.02,-.42-i*.105);band.scale.y=.85;
    }
    const head=this.mesh(sphere,shell,this.fly);head.position.set(0,.025,.36);head.scale.set(.28,.25,.24);
    for(const s of [-1,1]) {
      const e=this.mesh(sphere,eye,this.fly);e.position.set(s*.205,.045,.41);e.scale.set(.15,.205,.16);
      const antenna=this.mesh(new THREE.CylinderGeometry(.013,.009,.27,5),shell,this.fly);antenna.position.set(s*.11,.2,.55);antenna.rotation.x=.9;antenna.rotation.z=s*.3;
      const tip=this.mesh(sphere,shell,this.fly);tip.position.set(s*.12,.28,.66);tip.scale.setScalar(.032);
      for(let leg=0;leg<3;leg++) {
        const z=.22-leg*.23;
        const points=[new THREE.Vector3(s*.19,-.14,z),new THREE.Vector3(s*(.44+leg*.05),-.4,z-.13),new THREE.Vector3(s*(.49+leg*.07),-.67,z-.26)];
        const curve=new THREE.CatmullRomCurve3(points);
        this.mesh(new THREE.TubeGeometry(curve,7,.018,5,false),shell,this.fly);
      }
    }
    this.wings=[];
    for(const s of [-1,1]) {
      const pivot=new THREE.Group();pivot.position.set(s*.16,.19,.01);this.fly.add(pivot);
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.12,-.1,.5,-.26,1.02,-.15);shape.bezierCurveTo(1.55,.05,1.3,.45,.7,.42);shape.bezierCurveTo(.3,.35,.08,.1,0,0);
      const geom=new THREE.ShapeGeometry(shape,24);geom.rotateX(-Math.PI/2);geom.scale(s,1,1);
      this.mesh(geom,new THREE.MeshPhysicalMaterial({color:'#e9ecd4',transparent:true,opacity:.65,roughness:.25,metalness:.08,side:THREE.DoubleSide,depthWrite:false}),pivot);
      const veins=[];
      for(let i=0;i<4;i++) {
        veins.push(0,0,0,s*(.65+i*.16),0,-(.08+i*.08));
        veins.push(s*.4,0,-.1,s*(.8+i*.11),0,.08-i*.025);
      }
      const vgeo=new THREE.BufferGeometry();vgeo.setAttribute('position',new THREE.Float32BufferAttribute(veins,3));
      const line=new THREE.LineSegments(vgeo,new THREE.LineBasicMaterial({color:'#777e64',transparent:true,opacity:.33}));pivot.add(line);
      pivot.rotation.y=s*.1;pivot.rotation.x=.65;this.wings.push({pivot,s});
    }
    this.fly.scale.setScalar(1.2);
  }
  receive(packet) {
    const game=packet.game;
    if(game.z<this.actual.z-3){this.visual.z=game.z;this.visual.y=game.y;}
    this.actual=game;this.paused=packet.lab.paused;this.connected=true;this.lastPacket=performance.now();
    if(packet.decision?.id!==this.lastDecision){
      this.flapPulse=packet.decision?.applied?1:Math.max(0,this.flapPulse-.4);
      this.lastDecision=packet.decision?.id;
    }
  }
  resize() {
    const {width,height}=this.container.getBoundingClientRect();
    if(!width||!height)return;
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    this.renderer.setSize(width,height);
  }
  tick(now) {
    requestAnimationFrame(this.tick);
    if(document.hidden||now-this.lastFrame<1000/30)return;
    const dt=Math.min((now-this.lastFrame)/1000,.08);this.lastFrame=now;
    const running=this.connected&&!this.paused&&!this.actual.done&&now-this.lastPacket<1200;
    if(running)this.clock+=dt;
    const alpha=1-Math.exp(-dt*14);
    this.visual.y=mix(this.visual.y,this.actual.y,alpha);
    this.visual.z=mix(this.visual.z,this.actual.z,alpha);
    this.visual.vy=mix(this.visual.vy,this.actual.vy,alpha);
    this.fly.position.set(0,this.visual.y,0);
    this.fly.rotation.x=mix(this.fly.rotation.x,clamp(-this.visual.vy*.026,-.2,.22),.2);
    this.fly.rotation.z=running?Math.sin(this.clock*1.5)*.025:0;
    if(running)this.flapPulse=Math.max(0,this.flapPulse-dt*3);
    for(const {pivot,s} of this.wings)pivot.rotation.z=s*(.11+Math.sin(this.clock*57)*(.18+this.flapPulse*.5));
    this.cameraY=mix(this.cameraY,7.6+(this.visual.y-6.5)*.48,.045);
    this.camera.position.set(1.3,this.cameraY,-12.8);
    this.camera.lookAt(0,this.cameraY-1.3,21);
    const callout=document.getElementById('fly-callout');
    if(callout){const point=new THREE.Vector3(.6,this.visual.y-.7,0).project(this.camera);callout.style.left=`${(point.x+1)*50}%`;callout.style.top=`${(1-point.y)*50}%`;}
    const gates=this.actual.gates.length?this.actual.gates:this.previewGates;
    this.pipes.forEach((p,i)=>{
      const gate=gates[i];p.group.visible=!!gate;if(!gate)return;
      p.group.position.z=gate.z-this.visual.z;
      // Passed obstacles must not sit between the chase camera and the fly.
      p.group.visible=p.group.position.z>-2.5;
      const bottom=gate.y-gate.half,top=gate.y+gate.half;
      p.lower.scale.y=bottom+.5;p.lower.position.y=(bottom-.5)/2;
      p.upper.scale.y=18-top;p.upper.position.y=(18+top)/2;
      p.bottomRim.position.y=bottom-.08;p.topRim.position.y=top+.08;
      p.line1.position.y=bottom-.25;p.line2.position.y=top+.25;
      p.badge.position.y=bottom-.72;
    });
    this.scenery.position.z=-(this.visual.z%240);
    this.nextScenery.position.z=240-(this.visual.z%240);
    this.seeds.position.z=-(this.visual.z%40);
    this.renderer.render(this.scene,this.camera);
  }
}
