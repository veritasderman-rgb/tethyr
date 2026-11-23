// Faerûn a Kara-Tur – 3D mapa Západních draků.
// Engine (terén, voda, nebe, kamera, ovládání, popisky, měření, sonda výšky, zvuky, výkonové úrovně, modely)
// převzatý a přepsaný z 3D mapy Desetiměstí (desetimesti.vercel.app); obsah z kroniky Tethyrské královské družiny.
// Souřadnice světa: 1 jednotka = 1 pixel podkladové mapy toril-east-west.jpg (2576 × 884), x na východ, z na jih, y nahoru.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ================================================================ pomůcky (šum z původní mapy)
function hash(ix, iy){ let h = Math.imul(ix,374761393) ^ Math.imul(iy,668265263); h = Math.imul(h ^ (h>>>13), 1274126177); h ^= h>>>16; return (h>>>0)/4294967295; }
function vnoise(x,y){ const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy; const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const a=hash(ix,iy), b=hash(ix+1,iy), c=hash(ix,iy+1), d=hash(ix+1,iy+1); return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy; }
function fbm(x,y,o=4){ let s=0,a=.5,f=1,n=0; for(let i=0;i<o;i++){ s+=a*vnoise(x*f,y*f); n+=a; a*=.5; f*=2.03; } return s/n; }
const smooth=(e0,e1,x)=>{ const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0))); return t*t*(3-2*t); };
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cz=(n,d=0)=>n.toLocaleString('cs-CZ',{minimumFractionDigits:d,maximumFractionDigits:d});
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const v3=(a)=>new THREE.Vector3(a[0],a[1],a[2]);
const WEB='../';                                            // kronika (mapa je ve složce /mapa3d/); staré kotvy #… přesměruje router kroniky na nové adresy

// ================================================================ výkon a přístupnost
const qs=new URLSearchParams(location.search);
const coarse=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
const QPREF=qs.get('q')||(()=>{ try{ return localStorage.getItem('mapa3d-q')||'auto'; }catch(e){ return 'auto'; } })();
const HQ = QPREF==='high' ? true : QPREF==='low' ? false : (!coarse && Math.min(innerWidth,innerHeight)>=600);
const REDUCED=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const PORTRAIT=()=>innerHeight>innerWidth;
const IN_FRAME=(()=>{ try{ return window.self!==window.top; }catch(e){ return true; } })();

// ================================================================ načítání
const ld={ el:$('loading'), bar:$('ldBar'), msg:$('ldMsg'), n:0, of:7 };
function prog(msg){ ld.n++; ld.bar.style.width=Math.min(100,ld.n/ld.of*100)+'%'; if(msg) ld.msg.textContent=msg; }
function fail(m){ $('err').hidden=false; $('errMsg').textContent=m; ld.el.classList.add('done'); }

async function getJSON(u){ const r=await fetch(u); if(!r.ok) throw new Error(u+' '+r.status); return r.json(); }
async function getBin(u){ const r=await fetch(u); if(!r.ok) throw new Error(u+' '+r.status); return r.arrayBuffer(); }
function getImg(u){ return new Promise((res,rej)=>{ const im=new Image(); im.decoding='async'; im.onload=()=>res(im); im.onerror=()=>rej(new Error(u)); im.src=u; }); }

let META, HB, CAMP, MASK, MAPIMG;
try{
  const t=document.createElement('canvas'); if(!(t.getContext('webgl2')||t.getContext('webgl'))) throw new Error('webgl');
}catch(e){ fail('Prohlížeč nepodporuje WebGL, 3D mapu nelze zobrazit.'); throw e; }
try{
  prog('Načítám výšky terénu…');
  [META, HB, CAMP, MASK, MAPIMG] = await Promise.all([
    getJSON('assets/terrain/meta.json'), getBin('assets/terrain/height.bin'), getJSON('data/campaign.json'),
    getImg('assets/terrain/mask.png'), getImg('assets/terrain/map.jpg') ]);
  prog('Skládám pohoří a moře…');
}catch(e){ fail('Nepodařilo se načíst data mapy ('+e.message+'). Spusťte mapu přes webový server.'); throw e; }

const W0=META.size[0], H0=META.size[1], GW=META.grid[0], GH=META.grid[1], HMIN=META.hmin, HMAX=META.hmax, MPU=META.milesPerUnit||2.6;
const CX=W0/2, CZ=H0/2, SX=W0/(GW-1), SZ=H0/(GH-1);
const H16=new Uint16Array(HB), HH=new Float32Array(GW*GH);
for(let i=0;i<HH.length;i++) HH[i]=H16[i]/65535*(HMAX-HMIN)+HMIN;
// okraje mapy se svažují do moře, aby terén nekončil útesem
for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){ const e=Math.min(i,j,GW-1-i,GH-1-j); if(e<6){ const k=j*GW+i, f=smooth(0,6,e); HH[k]=HH[k]*f+(-2.2)*(1-f); } }
// masky (les, poušť, hory, ledovec) pro výsadbu stromů a sondu
const MK=(()=>{ const c=document.createElement('canvas'); c.width=MASK.width; c.height=MASK.height; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(MASK,0,0); return {w:c.width,h:c.height,d:g.getImageData(0,0,c.width,c.height).data}; })();
function maskAt(x,z){ const i=clamp(Math.round(x/W0*(MK.w-1)),0,MK.w-1), j=clamp(Math.round(z/H0*(MK.h-1)),0,MK.h-1), k=(j*MK.w+i)*4; return [MK.d[k]/255,MK.d[k+1]/255,MK.d[k+2]/255,MK.d[k+3]/255]; }
function hAt(x,z){ const gx=clamp(x/SX,0,GW-1.001), gz=clamp(z/SZ,0,GH-1.001); const i=Math.floor(gx), j=Math.floor(gz), u=gx-i, v=gz-j;
  if(x<0||z<0||x>W0||z>H0) return -3;
  const a=HH[j*GW+i], b=HH[j*GW+i+1], c=HH[(j+1)*GW+i], d=HH[(j+1)*GW+i+1]; return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v; }
const ground=(x,z)=>Math.max(hAt(x,z),0);

// ================================================================ renderer, scéna, kamera
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas, antialias:HQ, powerPreference:'high-performance', logarithmicDepthBuffer:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, HQ?2:1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0xbfae90, 0.0004);
const camera=new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.5, 12000);
const controls=new OrbitControls(camera, canvas);
controls.enableDamping=!REDUCED; controls.dampingFactor=0.09; controls.screenSpacePanning=false;
controls.minDistance=3; controls.maxDistance=3000; controls.maxPolarAngle=1.47; controls.zoomSpeed=1.15;
controls.touches={ONE:THREE.TOUCH.PAN, TWO:THREE.TOUCH.DOLLY_ROTATE};
controls.mouseButtons={LEFT:THREE.MOUSE.PAN, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.ROTATE};

const VIEW={
  all:      ()=>PORTRAIT()?{t:[820,0,430],o:[0,2300,900]}:{t:[1288,0,440],o:[0,1650,1450]},
  tethyr:   ()=>PORTRAIT()?{t:[320,0,545],o:[0,260,190]}:{t:[318,0,548],o:[10,105,135]},
  north:    ()=>PORTRAIT()?{t:[300,0,110],o:[0,420,300]}:{t:[300,0,110],o:[0,170,215]},
  anauroch: ()=>PORTRAIT()?{t:[506,0,140],o:[0,190,150]}:{t:[506,0,140],o:[30,75,105]},
  karatur:  ()=>PORTRAIT()?{t:[1960,0,520],o:[0,1100,700]}:{t:[1960,0,520],o:[0,430,470]},
  spheres:  ()=>PORTRAIT()?{t:[-190,85,440],o:[420,260,60]}:{t:[-190,85,440],o:[250,150,40]},
};
{ const v=VIEW.all(); controls.target.copy(v3(v.t)); camera.position.copy(v3(v.t)).add(v3(v.o)).multiplyScalar(1).add(new THREE.Vector3(0,600,500)); }

// ---------------------------------------------------------------- nebe, hvězdy, světla
const skyU={ top:{value:new THREE.Color()}, horizon:{value:new THREE.Color()}, glow:{value:new THREE.Color()}, glowAmt:{value:0}, sunDir:{value:new THREE.Vector3(0,0.3,1)} };
const sky=new THREE.Mesh(new THREE.SphereGeometry(9000,32,16), new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false, uniforms:skyU,
  vertexShader:`varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform float glowAmt; uniform vec3 sunDir; varying vec3 vP;
    void main(){ float h=clamp(vP.y,0.0,1.0); vec3 c=mix(horizon, top, pow(h,0.5)); float s=pow(max(0.0, dot(normalize(sunDir), vP)),8.0); c+=glow*s*glowAmt*(1.0-h*0.6);
      gl_FragColor=vec4(c,1.0); }` }));
sky.renderOrder=-10; scene.add(sky);
const stars=(()=>{ const n=2200, p=new Float32Array(n*3), r=mulberry(9); for(let i=0;i<n;i++){ const u=r()*Math.PI*2, v=Math.acos(r()*0.96); p.set([Math.sin(v)*Math.cos(u)*8500, Math.cos(v)*8500, Math.sin(v)*Math.sin(u)*8500], i*3); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p,3));
  const m=new THREE.Points(g, new THREE.PointsMaterial({color:0xfff4e0, size:1.6, sizeAttenuation:false, fog:false, transparent:true, opacity:0, depthWrite:false})); m.frustumCulled=false; return m; })();
scene.add(stars);
const hemi=new THREE.HemisphereLight(0xdfe6f2, 0x5a4a32, 0.9); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d8, 2.0); scene.add(sun); scene.add(sun.target);

const glowTex=(()=>{ const s=128, cv=document.createElement('canvas'); cv.width=cv.height=s; const g=cv.getContext('2d');
  const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.22,'rgba(255,255,255,0.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,s,s); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; })();
const cloudTex=(()=>{ const s=256, cv=document.createElement('canvas'); cv.width=cv.height=s; const g=cv.getContext('2d'), r=mulberry(31);
  for(let i=0;i<46;i++){ const x=s*0.2+r()*s*0.6, y=s*0.35+r()*s*0.3, rad=20+r()*48; const gr=g.createRadialGradient(x,y,0,x,y,rad); gr.addColorStop(0,'rgba(255,255,255,.42)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,s,s); }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; })();

// ================================================================ terén
prog('Stavím terén…');
const TERRAIN_TILES=[]; let terrLOD='hi';
function setTerrainLOD(l){ if(l===terrLOD) return; terrLOD=l; for(const g of TERRAIN_TILES) g.setIndex(g.userData[l]); }
const mapTex=new THREE.Texture(MAPIMG); mapTex.flipY=false; mapTex.colorSpace=THREE.SRGBColorSpace; mapTex.anisotropy=Math.min(8, renderer.capabilities.getMaxAnisotropy()); mapTex.generateMipmaps=true; mapTex.minFilter=THREE.LinearMipmapLinearFilter; mapTex.needsUpdate=true;
const maskTex=new THREE.Texture(MASK); maskTex.flipY=false; maskTex.needsUpdate=true;
const terrU={ uMask:{value:maskTex}, uTime:{value:0}, uSnow:{value:1}, uWorld:{value:new THREE.Vector2(W0,H0)} };
const terrMat=new THREE.MeshStandardMaterial({ map:mapTex, roughness:0.94, metalness:0 });
terrMat.onBeforeCompile=(sh)=>{
  Object.assign(sh.uniforms, terrU);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp; varying float vNy;')
    .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz; vNy=normalize(normal).y;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vWp; varying float vNy; uniform sampler2D uMask; uniform float uSnow; uniform vec2 uWorld;
    float hh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }`)
    .replace('#include <map_fragment>',`#include <map_fragment>
    { vec4 mk=texture2D(uMask, vWp.xz/uWorld); float dist=length(vWp-cameraPosition); float near=1.0-smoothstep(25.0,160.0,dist);
      float n1=vn(vWp.xz*1.7), n2=vn(vWp.xz*6.0), n3=vn(vWp.xz*0.35);
      // zblízka: kresba stromů v lesích, skalní zrnitost v horách, vlnky písku v poušti
      diffuseColor.rgb*=1.0-near*(mk.r*(0.28*smoothstep(0.45,0.8,n2))+mk.b*0.16*(n1-0.5)+0.05*(n3-0.5));
      diffuseColor.rgb+=near*mk.g*0.05*sin(vWp.x*2.2+n1*5.0);
      // sníh na nejvyšších štítech a ledovcích
      float snow=smoothstep(13.0,18.0,vWp.y+n1*2.0)*smoothstep(0.55,0.85,vNy)*uSnow; snow=max(snow, mk.a*0.35);
      diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.94,0.95,0.98), snow*0.85);
      // pobřežní mělčina pod vodou trochu tmavší
      diffuseColor.rgb*=mix(1.0, 0.82, smoothstep(0.0,-1.5,vWp.y)); }`);
};
{
  const ST=HQ?1:2, nx=Math.floor((GW-1)/ST)+1, nz=Math.floor((GH-1)/ST)+1, n=nx*nz;
  const pos=new Float32Array(n*3), uv=new Float32Array(n*2);
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ const gi=Math.min(GW-1,i*ST), gj=Math.min(GH-1,j*ST), k=j*nx+i, x=gi*SX, z=gj*SZ;
    pos[k*3]=x; pos[k*3+1]=HH[gj*GW+gi]; pos[k*3+2]=z; uv[k*2]=x/W0; uv[k*2+1]=z/H0; }
  const big=new THREE.BufferGeometry(); big.setAttribute('position',new THREE.BufferAttribute(pos,3)); big.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const idxAll=new Uint32Array((nx-1)*(nz-1)*6); let q=0;
  for(let j=0;j<nz-1;j++) for(let i=0;i<nx-1;i++){ const a=j*nx+i, b=a+1, c=a+nx, d=c+1; idxAll[q++]=a; idxAll[q++]=c; idxAll[q++]=b; idxAll[q++]=b; idxAll[q++]=c; idxAll[q++]=d; }
  big.setIndex(new THREE.BufferAttribute(idxAll,1)); big.computeVertexNormals();
  // dlaždice se sdílenými daty – co není v záběru, nekreslí se
  const TS=HQ?96:64;
  for(let j0=0;j0<nz-1;j0+=TS) for(let i0=0;i0<nx-1;i0+=TS){ const j1=Math.min(nz-1,j0+TS), i1=Math.min(nx-1,i0+TS), ti=new Uint32Array((j1-j0)*(i1-i0)*6); let q2=0, y0=1e9, y1=-1e9;
    for(let j=j0;j<j1;j++) for(let i=i0;i<i1;i++){ const a=j*nx+i, b=a+1, c=a+nx, d=c+1; ti[q2++]=a; ti[q2++]=c; ti[q2++]=b; ti[q2++]=b; ti[q2++]=c; ti[q2++]=d; }
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const h=pos[(j*nx+i)*3+1]; if(h<y0) y0=h; if(h>y1) y1=h; }
    const lo=[]; for(let j=j0;j<j1;j+=2) for(let i=i0;i<i1;i+=2){ const i2=Math.min(i+2,i1), j2=Math.min(j+2,j1), a=j*nx+i, b=j*nx+i2, c=j2*nx+i, d=j2*nx+i2; lo.push(a,c,b,b,c,d); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',big.attributes.position); g.setAttribute('normal',big.attributes.normal); g.setAttribute('uv',big.attributes.uv); g.setIndex(new THREE.BufferAttribute(ti,1));
    g.userData.hi=g.index; g.userData.lo=new THREE.BufferAttribute(new Uint32Array(lo),1); TERRAIN_TILES.push(g);
    g.boundingBox=new THREE.Box3(new THREE.Vector3(pos[(j0*nx+i0)*3],y0,pos[(j0*nx+i0)*3+2]), new THREE.Vector3(pos[(j1*nx+i1)*3],y1,pos[(j1*nx+i1)*3+2])); g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m=new THREE.Mesh(g,terrMat); m.name='terrain'; scene.add(m); }
  // deska pod mapou
  const slab=new THREE.Mesh(new THREE.BoxGeometry(W0+40,8,H0+40), new THREE.MeshStandardMaterial({color:0x2a2118, roughness:1})); slab.position.set(CX,-7.5,CZ); scene.add(slab);
}

// ================================================================ voda (mělčiny prosvítají, hloubka z výškové mapy, vlny, pěna u břehu)
const depthTex=(()=>{ const d=new Uint8Array(GW*GH); for(let i=0;i<d.length;i++) d[i]=Math.round(clamp(-HH[i]/4,0,1)*255);
  const t=new THREE.DataTexture(d,GW,GH,THREE.RedFormat,THREE.UnsignedByteType); t.magFilter=t.minFilter=THREE.LinearFilter; t.needsUpdate=true; return t; })();
const waterU={ uTime:{value:0}, uDepth:{value:depthTex}, uWorld:{value:new THREE.Vector2(W0,H0)}, uSun:{value:new THREE.Vector3(0.3,0.6,0.5)}, uSunC:{value:new THREE.Color(0xfff0d8)},
  uSky:{value:new THREE.Color(0x9fb6c9)}, uDeep:{value:new THREE.Color(0x1d4560)}, uShallow:{value:new THREE.Color(0x5f9fb8)}, uFogC:{value:new THREE.Color()}, uFogD:{value:0.0004}, uNight:{value:0} };
const water=new THREE.Mesh(new THREE.PlaneGeometry(16000,12000), new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:waterU,
  vertexShader:`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader:`uniform float uTime; uniform sampler2D uDepth; uniform vec2 uWorld; uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFogC; uniform float uFogD; uniform float uNight; varying vec3 vW;
    float hh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
    float wv(vec2 p, float t){ return vn(p+vec2(t*0.07,t*0.04))*0.6+vn(p*2.1-vec2(t*0.05,-t*0.06))*0.3+vn(p*4.7+vec2(t*0.11,0.0))*0.12; }
    void main(){
      vec2 uv=vW.xz/uWorld; float inside=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
      float d=mix(4.0, texture2D(uDepth, clamp(uv,0.0,1.0)).r*4.0, inside);
      float dist=length(cameraPosition-vW); float sc=clamp(dist/90.0,0.4,8.0);
      vec2 p=vW.xz*0.22/sc; float e=0.08;
      float h0=wv(p,uTime), hx=wv(p+vec2(e,0.0),uTime), hz=wv(p+vec2(0.0,e),uTime);
      vec3 N=normalize(vec3((h0-hx)*3.2,1.0,(h0-hz)*3.2));
      vec3 V=normalize(cameraPosition-vW);
      float fres=pow(1.0-max(dot(N,V),0.0),3.0);
      vec3 col=mix(uShallow, uDeep, smoothstep(0.05,2.6,d));
      col=mix(col, uSky, 0.25+fres*0.45);
      float sp=pow(max(dot(reflect(-normalize(uSun),N),V),0.0), 90.0);
      col+=uSunC*sp*1.1*(1.0-uNight*0.7);
      float foam=(1.0-smoothstep(0.0,0.28,d))*(0.55+0.45*sin(d*40.0-uTime*1.6+vn(vW.xz*0.5)*6.0))*inside;
      col=mix(col, vec3(0.96,0.95,0.9), foam*0.55);
      float a=mix(0.42, 0.93, smoothstep(0.04,2.2,d))+fres*0.06+foam*0.3;
      float f=1.0-exp(-pow(dist*uFogD,2.0)); col=mix(col,uFogC,f); a=mix(a,1.0,f);
      gl_FragColor=vec4(col,clamp(a,0.0,1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` }));
water.rotation.x=-Math.PI/2; water.position.set(CX,0,CZ); water.renderOrder=2; scene.add(water);

// ================================================================ stromy v lesích (instance; zblízka dodají mapě plasticitu)
const TREES=(()=>{ const N=HQ?26000:5000, r=mulberry(5), cone=new THREE.ConeGeometry(0.42,1.15,5); cone.translate(0,0.82,0); const trunk=new THREE.CylinderGeometry(0.07,0.09,0.35,4); trunk.translate(0,0.17,0);
  const g=mergeGeometries([cone.toNonIndexed(), trunk.toNonIndexed()]); const m=new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9, flatShading:true});
  const im=new THREE.InstancedMesh(g,m,N), o=new THREE.Object3D(), c=new THREE.Color(); let k=0, tries=0;
  while(k<N && tries<N*40){ tries++; const x=8+r()*(W0-16), z=8+r()*(H0-16); const mk=maskAt(x,z); if(mk[0]<0.5||mk[2]>0.55||mk[3]>0.3) continue; const h=hAt(x,z); if(h<0.15) continue;
    const s=0.75+r()*0.9; o.position.set(x,h-0.05,z); o.rotation.set(0,r()*6.28,0); o.scale.set(s,s*(0.85+r()*0.5),s); o.updateMatrix(); im.setMatrixAt(k,o.matrix);
    const kara=x>1350; c.setHSL(kara?0.27+r()*0.06:0.22+r()*0.07, 0.38+r()*0.2, 0.2+r()*0.1); im.setColorAt(k,c); k++; }
  im.count=k; im.frustumCulled=false; scene.add(im); return {im, n:k}; })();

// ================================================================ mraky (vysoko nad mapou, pomalu plují)
const CLOUDS=[]; { const r=mulberry(12), n=HQ?46:18; for(let i=0;i<n;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex, transparent:true, depthWrite:false, opacity:0.0, color:0xffffff, fog:true}));
  const sc=120+r()*220; s.scale.set(sc,sc*0.45,1); s.position.set(r()*W0, 90+r()*80, r()*H0); s.userData={vx:2+r()*3, base:s.position.x}; scene.add(s); CLOUDS.push(s); } }

// ================================================================ modely (GLB převzaté z Desetiměstí, nahrávají se líně)
prog('Připravuji modely…');
const gltfLoader=new GLTFLoader(); gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const MODELS={}, MODP={};
let modAsk=0, modDone=0; const modStat=()=>{ $('mstat').textContent=modDone<modAsk?`Načítám modely ${modDone}/${modAsk}`:''; };
function prepModel(gl){ let mesh=null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o=>{ if(o.isMesh&&!mesh) mesh=o; });
  const geo=mesh.geometry.clone(); for(const an of ['position','normal']){ const p=geo.attributes[an]; if(p && !(p.array instanceof Float32Array)){ const f=new Float32Array(p.count*3); for(let i=0;i<p.count;i++){ f[i*3]=p.getX(i); f[i*3+1]=p.getY(i); f[i*3+2]=p.getZ(i); } geo.setAttribute(an,new THREE.BufferAttribute(f,3)); } }
  geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox(); const bb=geo.boundingBox; geo.translate(-(bb.min.x+bb.max.x)/2, -bb.min.y, -(bb.min.z+bb.max.z)/2);
  return {geo, mat:mesh.material, dx:bb.max.x-bb.min.x, dy:bb.max.y-bb.min.y, dz:bb.max.z-bb.min.z}; }
function loadModel(name){ if(MODP[name]) return MODP[name]; modAsk++; modStat();
  return MODP[name]=new Promise(res=>{ gltfLoader.load('assets/models/'+name+'.glb', gl=>{ try{ MODELS[name]=prepModel(gl); }catch(e){ MODELS[name]=null; } modDone++; modStat(); res(MODELS[name]); }, undefined, ()=>{ modDone++; modStat(); res(null); }); }); }
function modelMesh(M, height, tint){ const mat=tint? M.mat.clone() : M.mat; if(tint){ mat.color=new THREE.Color(tint); } const c=new THREE.Mesh(M.geo,mat); c.scale.setScalar(height/M.dy); return c; }

// ---------------------------------------------------------------- jednoduché tvary (původní "humanoid", "flyer", "ship" a nové: pagoda, pyramida, meče, prapor)
const MAT=(c,o={})=>new THREE.MeshStandardMaterial({color:c, roughness:0.85, flatShading:true, ...o});
const GEO={box:new THREE.BoxGeometry(1,1,1), cone:new THREE.ConeGeometry(0.5,1,6), cone4:new THREE.ConeGeometry(0.72,1,4), cyl:new THREE.CylinderGeometry(0.5,0.5,1,10), sph:new THREE.SphereGeometry(0.5,16,10)};
function part(parent,geo,mat,px,py,pz,sx,sy,sz,rx=0,ry=0,rz=0){ const m=new THREE.Mesh(GEO[geo],mat); m.position.set(px,py,pz); m.scale.set(sx,sy,sz); m.rotation.set(rx,ry,rz); parent.add(m); return m; }
// Statické skupiny tvarů se „upečou“ do jedné geometrie s barvami ve vrcholech: pagoda z 11 dílů = 1 draw call.
const BAKED_MAT=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.82, metalness:0.1, flatShading:true});
const BAKED_GLOW=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.6, emissive:0x6a3cff, emissiveIntensity:1.3, flatShading:true});
function bakeGeo(root, filter=()=>true){ root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(), list=[], mtx=new THREE.Matrix4();
  root.traverse(o=>{ if(!o.isMesh||!filter(o)) return; let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal') g.deleteAttribute(k);
    if(!g.attributes.normal) g.computeVertexNormals(); mtx.multiplyMatrices(inv,o.matrixWorld); g.applyMatrix4(mtx); const c=o.material.color||new THREE.Color(1,1,1), n=g.attributes.position.count, col=new Float32Array(n*3);
    for(let i=0;i<n;i++){ col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; } g.setAttribute('color',new THREE.BufferAttribute(col,3)); list.push(g); });
  return list.length?mergeGeometries(list,false):null; }
function bake(g){ const geo=bakeGeo(g); const out=new THREE.Group(); if(geo){ const m=new THREE.Mesh(geo,BAKED_MAT); out.add(m); } out.position.copy(g.position); out.rotation.copy(g.rotation); out.scale.copy(g.scale); out.userData=g.userData; return out; }
function pagoda(tiers=4, wall=0x8e2a1e, roof=0x2f3b33){ return bake(pagodaRaw(tiers,wall,roof)); }
function pagodaRaw(tiers=4, wall=0x8e2a1e, roof=0x2f3b33){ const g=new THREE.Group(), mw=MAT(wall), mr=MAT(roof), mb=MAT(0xb8a888); part(g,'box',mb,0,0.12,0,1.5,0.24,1.5);
  let y=0.24; for(let i=0;i<tiers;i++){ const w=1.0-i*0.15, h=0.42-i*0.03; part(g,'box',mw,0,y+h/2,0,w,h,w); y+=h; part(g,'cone4',mr,0,y+0.1,0,w*1.15,0.26,w*1.15,0,Math.PI/4,0); y+=0.16; }
  part(g,'cyl',MAT(0xc9a54a,{metalness:0.6,roughness:0.4}),0,y+0.3,0,0.05,0.7,0.05); return g; }
function pyramid(steps=5, col=0xb59b6a){ return bake(pyramidRaw(steps,col)); }
function pyramidRaw(steps=5, col=0xb59b6a){ const g=new THREE.Group(), m=MAT(col); for(let i=0;i<steps;i++){ const w=1.6-i*0.3; part(g,'box',m,0,i*0.28+0.14,0,w,0.28,w); } part(g,'box',MAT(0x8a3a24),0,steps*0.28+0.16,0,0.3,0.32,0.3); return g; }
function swords(){ return bake(swordsRaw()); }
function swordsRaw(){ const g=new THREE.Group(), bl=MAT(0xd9dde3,{metalness:0.8,roughness:0.3}), gd=MAT(0xc9a54a,{metalness:0.7,roughness:0.35}), hd=MAT(0x4a2a1a);
  for(const s of [-1,1]){ const sw=new THREE.Group(); part(sw,'box',bl,0,0.62,0,0.09,1.15,0.03); part(sw,'cone4',bl,0,1.25,0,0.065,0.14,0.02,0,Math.PI/4,0); part(sw,'box',gd,0,0.04,0,0.42,0.06,0.07); part(sw,'cyl',hd,0,-0.14,0,0.05,0.3,0.05); part(sw,'sph',gd,0,-0.31,0,0.1,0.1,0.1); sw.rotation.z=s*0.62; g.add(sw); }
  return g; }
function banner(col){ const g=new THREE.Group(); part(g,'cyl',MAT(0x3a2a1a),0,1.1,0,0.06,2.2,0.06); part(g,'sph',MAT(0xc9a54a,{metalness:0.7,roughness:0.3}),0,2.25,0,0.14,0.14,0.14);
  const fg=new THREE.PlaneGeometry(0.95,0.62,8,1); fg.translate(0.5,0,0); const f=new THREE.Mesh(fg, new THREE.MeshStandardMaterial({color:col, side:THREE.DoubleSide, roughness:0.8})); f.position.set(0.04,1.82,0); g.add(f); g.userData.flag=f; return g; }
function wave(flag,t,ph=0){ const p=flag.geometry.attributes.position; if(!flag.userData.base) flag.userData.base=p.array.slice(); const b=flag.userData.base; for(let i=0;i<p.count;i++){ const x=b[i*3]; p.array[i*3+2]=Math.sin(x*5-t*4+ph)*0.08*x; } p.needsUpdate=true; }
function humanoid(cloth,metal=0x9aa0a8){ const g=new THREE.Group(), ms=MAT(0xd2b48c), mc=MAT(cloth), mm=MAT(metal,{metalness:0.5,roughness:0.5});
  part(g,'box',mc,-0.1,0.2,0,0.14,0.4,0.16); part(g,'box',mc,0.1,0.2,0,0.14,0.4,0.16); part(g,'box',mc,0,0.6,0,0.42,0.38,0.24); part(g,'box',ms,0,0.9,0,0.2,0.2,0.2); part(g,'box',mm,0,1.0,0,0.22,0.07,0.22);
  const aR=new THREE.Group(); aR.position.set(0.28,0.76,0); part(aR,'box',ms,0,-0.2,0,0.11,0.4,0.11); part(aR,'box',mm,0,-0.42,0.3,0.05,0.05,0.75); g.add(aR); g.userData={aR}; return g; }
function flyer(col,wing){ const g=new THREE.Group(), m=MAT(col), mw=new THREE.MeshStandardMaterial({color:wing, side:THREE.DoubleSide, roughness:0.8, flatShading:true});
  part(g,'cone',m,0,0,0,0.5,1.8,0.45,Math.PI/2,0,0); part(g,'box',m,0,0.12,1.05,0.14,0.14,0.55,-0.3,0,0); part(g,'box',m,0,0.26,1.42,0.2,0.16,0.36); part(g,'cone',m,0,0,-1.3,0.16,1.4,0.16,-Math.PI/2,0,0);
  const wg=new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0.45, 1.9,0,0.25, 1.2,0,-0.7,  0,0,0.45, 1.2,0,-0.7, 0,0,-0.5],3)); wg.computeVertexNormals();
  const wl=new THREE.Mesh(wg,mw), wr=new THREE.Mesh(wg,mw); wr.scale.x=-1; g.add(wl,wr); g.userData={wl,wr}; return g; }
function junk(){ return bake(junkRaw()); }
function junkRaw(){ const g=new THREE.Group(), h=MAT(0x5a3a22), s=MAT(0xa8432a,{side:THREE.DoubleSide});
  part(g,'box',h,0,0.15,0,0.42,0.28,1.4); part(g,'box',h,0,0.38,-0.55,0.42,0.3,0.36); part(g,'box',h,0,0.32,0.62,0.36,0.2,0.24);
  for(const [z,hgt] of [[0.3,1.3],[-0.15,1.0],[0.62,0.7]]){ part(g,'cyl',MAT(0x2e2218),0,0.3+hgt/2,z,0.03,hgt,0.03); const sail=part(g,'box',s,0,0.36+hgt*0.55,z+0.02,0.04,hgt*0.8,hgt*0.6); for(let k=1;k<4;k++) part(g,'box',MAT(0x2e2218),0,0.36+hgt*(0.2+k*0.18),z+0.03,0.05,0.02,hgt*0.62); }
  return g; }
const shipGroups=[];
function shipStub(sail,hull=0x4a3526){ const g=new THREE.Group(), mh=MAT(hull), ms=new THREE.MeshStandardMaterial({color:sail, roughness:0.9, side:THREE.DoubleSide}), mm=MAT(0x2e2218);
  part(g,'box',mh,0,0.08,0,0.3,0.16,1.0); part(g,'cone',mh,0,0.08,0.68,0.3,0.4,0.16,Math.PI/2,0,0); part(g,'box',mh,0,0.2,-0.38,0.3,0.12,0.26);
  for(const [z,h] of [[0.18,1.0],[-0.2,0.8]]){ part(g,'cyl',mm,0,0.16+h/2,z,0.03,h,0.03); part(g,'box',ms,0,0.16+h*0.62,z+0.03,0.52,h*0.5,0.02); } return g; }
// loď: nejdřív jednoduchý tvar, po nahrání modelu se vymění
function ship(opts={}){ const g=new THREE.Group(), stub=shipStub(opts.sail||0xe8e2d0, opts.hull); g.add(stub); g.userData.ship=opts; shipGroups.push(g);
  loadModel('ship').then(M=>{ if(!M) return; g.remove(stub); const c=modelMesh(M,1.6,opts.tint); c.rotation.y=opts.ry||0; g.add(c); if(opts.ghost){ c.material=c.material.clone(); c.material.transparent=true; g.userData.mat=c.material; } }); return g; }

// ================================================================ popisky (DOM, jako v původní mapě, s potlačením překryvu)
const labelsEl=$('labels'); const labels=[];
function addLabel(html, x,y,z, cls, opt={}){ const el=document.createElement(opt.tag||'div'); el.className='lbl '+cls; el.innerHTML=html; labelsEl.appendChild(el);
  if(opt.click){ el.setAttribute('role','button'); el.tabIndex=0; el.addEventListener('click', e=>{ e.stopPropagation(); opt.click(e); }); el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); opt.click(e); } }); }
  if(opt.title) el.title=opt.title;
  el.style.display='none'; const L={el, p:new THREE.Vector3(x,y,z), obj:opt.obj||null, dy:opt.dy||0, w:0, h:0, min:opt.min||0, max:opt.max||1e9, pr:opt.pr||1, on:true, vis:false, kind:opt.kind||''}; labels.push(L); return L; }
const vtmp=new THREE.Vector3(), placed=[];
function updateLabels(force){
  const w=canvas.clientWidth, h=canvas.clientHeight, dens=scene.fog.density; placed.length=0;
  const list=[];
  for(const L of labels){ if(L.obj){ L.obj.getWorldPosition(L.p); L.p.y+=L.dy; }
    const d=camera.position.distanceTo(L.p);
    if(!L.on || d>L.max || d<L.min){ if(L.vis){ L.el.style.display='none'; L.vis=false; } continue; }
    vtmp.copy(L.p).project(camera);
    if(vtmp.z>1 || vtmp.x<-1.1 || vtmp.x>1.1 || vtmp.y<-1.1 || vtmp.y>1.15){ if(L.vis){ L.el.style.display='none'; L.vis=false; } continue; }
    list.push([L,d,(vtmp.x*0.5+0.5)*w,(-vtmp.y*0.5+0.5)*h]); }
  list.sort((a,b)=>b[0].pr-a[0].pr||a[1]-b[1]);
  for(const [L,d,sx,sy] of list){
    if(!L.vis){ L.el.style.display=''; L.vis=true; }
    if(!L.w||force){ L.w=L.el.offsetWidth; L.h=L.el.offsetHeight; }
    const x=sx-L.w/2, y=sy-L.h; let hit=false;
    if(L.pr<9){ for(const r of placed){ if(x<r[2]&&x+L.w>r[0]&&y<r[3]&&y+L.h>r[1]){ hit=true; break; } } }
    if(hit){ L.el.style.opacity='0'; L.el.style.pointerEvents='none'; continue; }
    placed.push([x-3,y-2,x+L.w+3,y+L.h+2]);
    const fogVis=Math.exp(-Math.pow(d*dens,2)*1.1), edge=Math.min(1,(L.max-d)/(L.max*0.12+1e-6));
    L.el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    L.el.style.opacity=(Math.max(0.35,fogVis)*clamp(edge,0,1)).toFixed(2); L.el.style.pointerEvents='';
    L.el.style.zIndex=String(1000+Math.round(L.pr*100)-Math.min(99,Math.round(d/40))); }
}

// ================================================================ data kampaně
const ERAS=CAMP.eras, ERA={}; ERAS.forEach((e,i)=>{ e.i=i; ERA[e.key]=e; });
const ERA_COL=k=>(ERA[k]&&ERA[k].col)||'#eadfc6';
const PLACES=CAMP.places, SPHERES=CAMP.spheres, ROUTE=CAMP.route, BATTLES=CAMP.battles, WITS=CAMP.witnesses, SES=CAMP.sessions;
const BYID={}; for(const p of PLACES) BYID[p.id]=p; for(const s of SPHERES) BYID[s.id]=s;
const BATT={}; for(const b of BATTLES) BATT[b.id]=b;
const WIT={}; for(const w of WITS) WIT[w.id]=w;
const eraOn=new Set(ERAS.map(e=>e.key));

// ---------------------------------------------------------------- sféry: ostrovy nad Bezstopým mořem západně od mapy
{ const n=SPHERES.length; SPHERES.forEach((s,i)=>{ const a=i/n*Math.PI*2; s.x=-190+Math.cos(a)*95; s.z=440+Math.sin(a)*120; s.y=80+((i%3)*10); }); }
function posOf(o){ if(o.sphere) return new THREE.Vector3(o.x,o.y+3,o.z); return new THREE.Vector3(o.x, ground(o.x,o.z), o.z); }

// ================================================================ místa kampaně: značky, modely, popisky
prog('Rozmisťuji místa kampaně…');
const placeObjs=[]; const pinPos=[], pinCol=[];
const KIND_COL={'město':0xe0b866,'chrám':0xf3e6c0,'sídlo':0xd7a35a,'dungeon':0xb07a5a,'říše':0xc9a54a,'bojiště':0xd0573f};
function firstEra(p){ const v=(p.visits||[])[0]; return v?v.era:'I'; }
function isKara(p){ return p.x>1330; }
const BIG=new Set(['Castle Tethyr','Hlubina','Stříbroluní','Chrám Západního úsvitu',"Kuo Te' Lung",'Thultanthar','Anauroch','Velká trhlina','Kozakura','Tempat Larang','Orofin','Pevnost Rudé rytířky']);
function findWater(x,z,maxR=26){ for(let r=3;r<maxR;r+=1.5){ for(let a=0;a<12;a++){ const ang=a/12*6.283+r*0.3, px=x+Math.cos(ang)*r, pz=z+Math.sin(ang)*r; if(hAt(px,pz)<-0.6) return [px,pz]; } } return null; }

for(const p of PLACES){
  const g=new THREE.Group(), y=ground(p.x,p.z); g.position.set(p.x,y,p.z); scene.add(g);
  const o={p, g, model:null, asked:false, deco:null, H:4.6*(p.scale||1)};
  // zástupný tvar do nahrání modelu (a pro telefony, než se přiblíží)
  const col=new THREE.Color(ERA_COL(firstEra(p)));
  pinPos.push(p.x, y+0.6, p.z); pinCol.push(col.r,col.g,col.b);
  if(p.model==='pagoda'){ const pg=pagoda(p.scale>1.3?5:4); pg.scale.setScalar(o.H/2.6); g.add(pg); o.model=pg; o.asked=true;
    if(p.deco==='monastery'){ pg.position.y=0.5; } }
  else if(p.model==='pyramid'){ const pm=pyramid(); pm.scale.setScalar(o.H/1.8); g.add(pm); o.model=pm; o.asked=true; }
  else if(p.model==='bubble'){ // podmořská místa: zářící kopule pod hladinou
    const dome=new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2), new THREE.MeshStandardMaterial({color:0x7fe0ff, emissive:0x1a6a88, transparent:true, opacity:0.42, roughness:0.2, depthWrite:false}));
    dome.scale.set(o.H*0.9,o.H*0.5,o.H*0.9); g.position.y=-0.25; g.add(dome); const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0x66ddff, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.5})); gl.scale.set(o.H*4,o.H*4,1); gl.position.y=0.3; g.add(gl); o.model=dome; o.asked=true; }
  else if(p.model==='thultanthar'){ o.asked=true; }      // létající město se staví zvlášť
  else if(!p.model){ o.asked=true; }
  placeObjs.push(o);
  // popisek
  const cls='place'+(BIG.has(p.name)?' big':'')+(p.kind==='dungeon'||p.kind==='bojiště'?' minor':'');
  const L=addLabel(esc(p.name)+(p.approx?' <span style="opacity:.6">≈</span>':''), p.x, y, p.z, cls, {dy:0, max:BIG.has(p.name)?1e9:(isKara(p)?2100:1500), pr:BIG.has(p.name)?6:4, click:()=>openPlace(p,true), title:p.region+' · '+p.kind, kind:'place'});
  L.el.style.setProperty('--c', ERA_COL(firstEra(p))); L.p.y=y+o.H*1.1+0.6; o.L=L; p._o=o;
}
// svítící body míst – vidět i z dálky
const pins=(()=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pinPos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(pinCol,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({size:HQ?13:11, sizeAttenuation:false, map:glowTex, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.95})); m.renderOrder=6; scene.add(m); return m; })();

function decorate(o){ const p=o.p; if(o.deco||!p.deco) return; o.deco=new THREE.Group(); o.g.add(o.deco); const r=mulberry(p.x*7+p.z|0), H=o.H;
  const ring=(names,n,rad,hgt)=>Promise.all(names.map(loadModel)).then(()=>{ for(let i=0;i<n;i++){ const nm=names[i%names.length], M=MODELS[nm]; if(!M) continue; const a=i/n*6.283+r()*0.5, rr=rad*(0.7+r()*0.5), x=Math.cos(a)*rr, z=Math.sin(a)*rr;
    const c=modelMesh(M,hgt*(0.8+r()*0.4)); c.position.set(x, ground(p.x+x,p.z+z)-o.g.position.y-0.05, z); c.rotation.y=r()*6.28; o.deco.add(c); } });
  if(p.deco==='town') ring(['burgher','halftimber','house2','tavern','town','house5','smithy','well'], 8, H*1.0, H*0.4);
  else if(p.deco==='city') ring(['burgher','halftimber','house3','town','cathedral','house6','manor','tavern','citytower','house7','guardhouse','stalls','granary'], 14, H*1.15, H*0.34);
  else if(p.deco==='dwarf') ring(['dwarfhouse','smithy','dwarfhouse','granary'], 5, H*0.85, H*0.4);
  else if(p.deco==='farm') ring(['mill','granary','well','house5'], 4, H*0.9, H*0.42);
  else if(p.deco==='elf') ring(['elfhouse','elftower','elfhouse'], 5, H*0.9, H*0.42);
  else if(p.deco==='shou'){ for(let i=0;i<5;i++){ const a=i/5*6.283+0.4, rr=H*(0.8+r()*0.4), x=Math.cos(a)*rr, z=Math.sin(a)*rr, pg=pagoda(2+(i%2), i%2?0x9a3322:0x7a2a1e); pg.scale.setScalar(H*0.22); pg.position.set(x,ground(p.x+x,p.z+z)-o.g.position.y,z); pg.rotation.y=r()*1.5; o.deco.add(pg); } }
  else if(p.deco==='monastery') ring(['tower'], 2, H*0.6, H*0.5);
  else if(p.deco==='port'){ ring(['crane','fishrack','house2','stalls'], 4, H*0.75, H*0.36);
    for(const nm of ['rowboat','trawler']) loadModel(nm).then(M=>{ if(!M) return; const w=findWater(p.x+(nm==='rowboat'?2:-3),p.z+(nm==='rowboat'?-3:2)); if(!w) return; const c=modelMesh(M,H*0.32); c.position.set(w[0]-p.x,-o.g.position.y+0.02,w[1]-p.z); c.rotation.y=r()*6.28; o.deco.add(c); });
    for(let i=0;i<2;i++){ const w=findWater(p.x+(i?4:-4),p.z+(i?3:-2)); if(!w) continue; const s=ship({}); s.scale.setScalar(H*0.42); s.position.set(w[0]-p.x, -o.g.position.y+0.02, w[1]-p.z); s.rotation.y=r()*6.28; o.deco.add(s); } }
  else if(p.deco==='under'){ const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0x9a55ff, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.55})); gl.scale.set(H*3,H*3,1); gl.position.y=H*0.3; o.deco.add(gl); }
}
function ensurePlaceModel(o){ if(o.asked) return; o.asked=true; const p=o.p;
  const stub=new THREE.Mesh(GEO.cone, MAT(0x8a7a62)); stub.scale.set(o.H*0.35,o.H*0.6,o.H*0.35); stub.position.y=o.H*0.3; o.g.add(stub);
  loadModel(p.model).then(M=>{ o.g.remove(stub); if(!M) return; const c=modelMesh(M, p.model==='crater'?o.H*0.45:p.model==='oak'?o.H*1.2:o.H);
    if(p.model==='crater'){ c.scale.multiplyScalar(1.0); } if(p.deco==='under'){ c.material=c.material.clone(); c.material.color=new THREE.Color(0x8877aa); }
    c.position.y=-0.05; c.rotation.y=(p.x*0.37)%6.28; o.g.add(c); o.model=c; }); }

// ================================================================ Thultanthar – létající Město stínů nad Anaurochem
const THUL=(()=>{ const p=PLACES.find(q=>q.name==='Thultanthar'); if(!p) return null; const g=new THREE.Group(), y0=ground(p.x,p.z)+26; g.position.set(p.x,y0,p.z); scene.add(g);
  const rockG=new THREE.ConeGeometry(11,18,28,8,true); rockG.rotateX(Math.PI); const rp=rockG.attributes.position;
  for(let i=0;i<rp.count;i++){ const x=rp.getX(i), y=rp.getY(i), z=rp.getZ(i), n=fbm(x*0.2+5,z*0.2+y*0.15,3); const k=0.75+n*0.55; rp.setXYZ(i,x*k,y-n*2.2,z*k); }
  rockG.computeVertexNormals(); rockG.translate(0,-9,0);
  const rock=new THREE.Mesh(rockG, new THREE.MeshStandardMaterial({color:0x3c3446, roughness:0.95, flatShading:true, side:THREE.DoubleSide})); g.add(rock);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(11.2,10.6,1.2,28), new THREE.MeshStandardMaterial({color:0x4a4256, roughness:0.9, flatShading:true})); top.position.y=0.2; g.add(top);
  const dark=new THREE.MeshStandardMaterial({color:0x2b2635, roughness:0.7, flatShading:true}), win=new THREE.MeshStandardMaterial({color:0x7a4cff, emissive:0x6a3cff, emissiveIntensity:1.4});
  const r=mulberry(41);
  for(let i=0;i<34;i++){ const a=r()*6.283, rr=Math.sqrt(r())*8.6, x=Math.cos(a)*rr, z=Math.sin(a)*rr, h=1.5+r()*r()*9*(1-rr/11), w=0.6+r()*0.9;
    const t=new THREE.Mesh(GEO.box, dark); t.scale.set(w,h,w); t.position.set(x,0.8+h/2,z); t.rotation.y=r()*3; g.add(t);
    const sp=new THREE.Mesh(GEO.cone4, dark); sp.scale.set(w*1.1,1.2+r()*1.8,w*1.1); sp.position.set(x,0.8+h+sp.scale.y/2,z); sp.rotation.y=Math.PI/4+t.rotation.y; g.add(sp);
    if(r()<0.7){ const wi=new THREE.Mesh(GEO.box, win); wi.scale.set(w*1.02,0.12,w*1.02); wi.position.set(x,0.8+h*(0.4+r()*0.5),z); wi.rotation.y=t.rotation.y; g.add(wi); } }
  const cit=new THREE.Mesh(GEO.cone4, dark); cit.scale.set(3.4,13,3.4); cit.position.set(0,7.3,0); cit.rotation.y=Math.PI/4; g.add(cit);
  { // 34 věží se špicemi a okny → dva meshe (místo ~90 draw calls)
    const towers=[], wins=[]; g.children.forEach(c=>{ if(c.isMesh&&c!==rock&&c!==top) (c.material===win?wins:towers).push(c); });
    const tmp=new THREE.Group(); towers.forEach(c=>tmp.add(c)); const tw=new THREE.Group(); wins.forEach(c=>tw.add(c));
    const tg=bakeGeo(tmp), wg=bakeGeo(tw); if(tg) g.add(new THREE.Mesh(tg,BAKED_MAT)); if(wg) g.add(new THREE.Mesh(wg,BAKED_GLOW)); }
  const crown=new THREE.Mesh(GEO.sph, win); crown.scale.setScalar(1.1); crown.position.set(0,14.4,0); g.add(crown);
  Promise.all(['ptower','cathedral'].map(loadModel)).then(()=>{ const add=(n,x,z,h)=>{ const M=MODELS[n]; if(!M) return; const c=modelMesh(M,h,0x5a5068); c.position.set(x,0.8,z); c.rotation.y=r()*6; g.add(c); };
    add('cathedral',-4.5,2,4.2); add('ptower',4.8,-1.5,4.5); add('ptower',1.2,5.5,3.6); });
  // stínová aura a temné částice
  const aura=[]; for(let i=0;i<(HQ?16:7);i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex, color:0x2a1840, transparent:true, depthWrite:false, opacity:0.4})); const sc=9+r()*9; s.scale.set(sc,sc*0.5,1); s.userData={a:r()*6.28, r:7+r()*9, y:-14+r()*14, sp:0.05+r()*0.08}; g.add(s); aura.push(s); }
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0x7a4cff, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.55})); glow.scale.set(30,30,1); glow.position.y=4; g.add(glow);
  // stín na poušti
  const shc=document.createElement('canvas'); shc.width=shc.height=128; const sg=shc.getContext('2d'), gr=sg.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(10,0,20,.7)'); gr.addColorStop(0.6,'rgba(10,0,20,.35)'); gr.addColorStop(1,'rgba(10,0,20,0)'); sg.fillStyle=gr; sg.fillRect(0,0,128,128);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shc), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4}));
  sh.rotation.x=-Math.PI/2; sh.position.set(p.x+5, ground(p.x,p.z)+0.4, p.z+5); scene.add(sh);
  p._o.g.position.set(p.x,y0+16,p.z); p._o.L.p.y=y0+17; p._o.H=14;
  return { g, y0, aura, glow, crown, p, anim(t){ g.position.y=y0+Math.sin(t*0.35)*0.9; g.rotation.y=t*0.012; for(const s of aura){ s.userData.a+=s.userData.sp*0.016; s.position.set(Math.cos(s.userData.a)*s.userData.r, s.userData.y+Math.sin(t+s.userData.a)*1.2, Math.sin(s.userData.a)*s.userData.r); }
    glow.material.opacity=0.42+0.15*Math.sin(t*1.3); crown.scale.setScalar(1.0+0.15*Math.sin(t*2.2)); } };
})();

// ================================================================ sféry: plovoucí ostrovy s portály
const sphereObjs=[];
function sphereIcon(icon){ const g=new THREE.Group(), r=mulberry(icon.length*13);
  const gold=MAT(0xd9b65a,{metalness:0.7,roughness:0.35}), stone=MAT(0x8a8278), dark=MAT(0x231a2e), vio=new THREE.MeshStandardMaterial({color:0x9a6cff, emissive:0x5a2cff, emissiveIntensity:1.2});
  if(icon==='sigil'){ const tor=new THREE.Mesh(new THREE.TorusGeometry(3.2,0.9,10,40), stone); tor.rotation.x=Math.PI/2; tor.position.y=6; g.add(tor);
    for(let i=0;i<16;i++){ const a=i/16*6.283; part(g,'box',MAT(0x6a6258),Math.cos(a)*3.2,6.9,Math.sin(a)*3.2,0.5,0.8+r()*0.9,0.5,0,a,0); }
    const sp=new THREE.Mesh(new THREE.ConeGeometry(0.6,9,8), stone); sp.rotation.x=Math.PI; sp.position.y=1.6; g.add(sp); }
  else if(icon==='hourglass'){ part(g,'cone',gold,0,1.6,0,2.4,2.6,2.4,Math.PI,0,0); part(g,'cone',gold,0,4.2,0,2.4,2.6,2.4); part(g,'cyl',MAT(0x6a4a2a),0,0.2,0,3,0.4,3); part(g,'cyl',MAT(0x6a4a2a),0,5.6,0,3,0.4,3); }
  else if(icon==='orb'){ part(g,'sph',MAT(0x8a6a3a,{metalness:0.6,roughness:0.4}),0,3.4,0,5,5,5); const ring=new THREE.Mesh(new THREE.TorusGeometry(3.1,0.18,8,40), gold); ring.position.y=3.4; ring.rotation.x=1.2; g.add(ring); const ring2=ring.clone(); ring2.rotation.set(0.3,0,1.1); g.add(ring2); }
  else if(icon==='moons'){ [[0xf2f2f2,0],[0xd04030,2.1],[0x111111,4.2]].forEach(([c,a])=>{ const m=part(g,'sph',MAT(c),Math.cos(a)*2.4,3.4,Math.sin(a)*2.4,1.6,1.6,1.6); m.userData.orb=a; }); g.userData.moons=true; }
  else if(icon==='pyramid'){ const pm=pyramid(6,0xd9b65a); pm.scale.setScalar(3.4); g.add(pm); }
  else if(icon==='shadow'){ for(let i=0;i<9;i++){ const a=r()*6.283, rr=r()*2.6; part(g,'cone',i%3?dark:vio,Math.cos(a)*rr,1.4,Math.sin(a)*rr,0.6+r()*0.6,2+r()*4,0.6+r()*0.6,(r()-0.5)*0.4,0,(r()-0.5)*0.4); } }
  else { const nm={castle:'castle',oak:'oak',inn:'inn',crater:'crater'}[icon]||'tower'; loadModel(nm).then(M=>{ if(!M) return; const c=modelMesh(M, nm==='crater'?2.6:6.5, icon==='castle'?0x6a6478:null); g.add(c); }); }
  return g; }
for(const s of SPHERES){
  const g=new THREE.Group(); g.position.set(s.x,s.y,s.z); g.scale.setScalar(1.7); scene.add(g);
  const rockG=new THREE.ConeGeometry(6.5,9,9,3); rockG.rotateX(Math.PI); const rp=rockG.attributes.position; for(let i=0;i<rp.count;i++){ const n=fbm(rp.getX(i)*0.3+s.x,rp.getZ(i)*0.3,2); rp.setXYZ(i,rp.getX(i)*(0.8+n*0.4),rp.getY(i)-n,rp.getZ(i)*(0.8+n*0.4)); } rockG.computeVertexNormals(); rockG.translate(0,-4.5,0);
  g.add(new THREE.Mesh(rockG, MAT(s.icon==='crater'?0x5a2a20:s.icon==='shadow'?0x2a2433:0x6a5f52)));
  const topC={crater:0x7a3020,shadow:0x302838,oak:0x4f7a3a,castle:0x4a4a52,sigil:0x6e6a62}[s.icon]||0x8f8468;
  const top=new THREE.Mesh(new THREE.CylinderGeometry(6.6,6.4,0.8,9), MAT(topC)); top.position.y=0.2; g.add(top);
  const ic=sphereIcon(s.icon); ic.position.y=0.6; g.add(ic);
  const portal=new THREE.Mesh(new THREE.TorusGeometry(8.4,0.22,8,64), new THREE.MeshBasicMaterial({color:0xb48cff, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false})); portal.rotation.x=Math.PI/2; portal.position.y=-1.5; g.add(portal);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0x9a6cff, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.22})); gl.scale.set(30,30,1); gl.position.y=-3; g.add(gl);
  const L=addLabel(esc(s.name), s.x, s.y+20, s.z, 'sphere', {pr:5, max:2600, click:()=>openPlace(s,true), kind:'sphere'});
  sphereObjs.push({s,g,portal,ic,ph:s.x*0.1+s.z*0.01}); s._o={g,L,H:8};
}
addLabel('Sféry', -190, 215, 440, 'region huge', {pr:2, min:160, max:3200});

// ================================================================ bitvy: zkřížené meče, zblízka šiky a prapory
const SIDE_COL=[0xc9a54a,0x7a1e22,0x6a4c9c,0x4f7a8a];
const battleObjs=[];
for(const b of BATTLES){
  let x=b.x, z=b.z, y; const sph=!x&&b.pl&&BYID[b.pl]&&BYID[b.pl].sphere;
  if(sph){ const s=BYID[b.pl]; x=s.x+7; z=s.z+4; y=s.y+3; } else if(x==null) continue; else y=ground(x,z);
  const g=new THREE.Group(); g.position.set(x,y,z); scene.add(g);
  const sw=swords(); const top=/Anauroch|Thultanthar/.test(b.name); sw.scale.setScalar(top?4.2:2.8); sw.position.y=top?16:9; g.add(sw);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xff5a3a, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:top?0.7:0.45})); gl.scale.set(top?22:14,top?22:14,1); gl.position.y=sw.position.y+2.5; g.add(gl);
  if(b.name==='Útok na Thultanthar'){ g.position.y=y+30; sw.position.y=22; gl.position.y=24; } if(b.name==='Bitva v Anaurochu'){ sw.position.y=8; gl.position.y=10; }
  const army=new THREE.Group(); army.visible=false; g.add(army);
  const o={b, g, sw, gl, army, built:false, top, flags:[], men:[]}; battleObjs.push(o);
  const L=addLabel(esc(b.name), x, g.position.y+sw.position.y+5, z, 'battle'+(b.bg?' bg':'')+(top?' top':''), {pr:top?7:5, max:top?1e9:(b.bg?900:1700), click:()=>openBattle(b,true), kind:'battle'});
  o.L=L; b._o=o;
}
function buildArmy(o){ if(o.built) return; o.built=true; const b=o.b, n=Math.max(2,b.sides.length), r=mulberry(b.name.length*31);
  b.sides.forEach((s,i)=>{ const a=i/n*6.283+0.6, cx=Math.cos(a)*7, cz=Math.sin(a)*7, face=Math.atan2(-cx,-cz), col=SIDE_COL[i%SIDE_COL.length];
    const rows=b.top||o.top?4:3, cols=b.top||o.top?7:5;
    // šik = jedna instancovaná geometrie (postava upečená s barvou strany); dřív 7 meshů na vojáka
    const hg=bakeGeo(humanoid(col)), im=new THREE.InstancedMesh(hg, BAKED_MAT, rows*cols), dm=new THREE.Object3D(); let k=0;
    for(let rr=0;rr<rows;rr++) for(let cc=0;cc<cols;cc++){ const lx=(cc-(cols-1)/2)*1.1, lz=rr*1.1; const px=cx+Math.cos(face)*lx+Math.sin(face)*lz, pz=cz-Math.sin(face)*lx+Math.cos(face)*lz;
      dm.position.set(px, ground(o.g.position.x+px,o.g.position.z+pz)-o.g.position.y, pz); dm.rotation.set(0, face+(r()-0.5)*0.4, 0); dm.scale.setScalar(0.9); dm.updateMatrix(); im.setMatrixAt(k++, dm.matrix);
      o.men.push({p:dm.position.clone(), ry:dm.rotation.y, i:k-1, im}); }
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled=false; o.army.add(im);
    const bn=banner(col); bn.position.set(cx+Math.sin(face)*-1.2, ground(o.g.position.x+cx,o.g.position.z+cz)-o.g.position.y, cz+Math.cos(face)*-1.2); bn.scale.setScalar(1.8); bn.rotation.y=face; o.army.add(bn); o.flags.push(bn.userData.flag);
    if(i===0&&o.top){ loadModel('giant').then(M=>{ if(!M) return; }); }
  });
  if(b.name==='Útok na Thultanthar') o.army.position.y=-(o.g.position.y-ground(o.g.position.x,o.g.position.z));
}

// ================================================================ svědectví: portréty u domovských míst
const witLabels=[];
{ const byHome={}; for(const w of WITS){ if(w.x==null) continue; const k=w.x+','+w.z; (byHome[k]=byHome[k]||[]).push(w); }
  for(const k in byHome){ const L=byHome[k]; L.forEach((w,i)=>{ const a=i/L.length*6.283+0.8, rr=L.length>1?5:0; const x=w.x+Math.cos(a)*rr+6, z=w.z+Math.sin(a)*rr+4; const y=ground(x,z)+1.5;
    const lab=addLabel(`${w.poster?`<img src="${esc(w.poster)}" alt="" loading="lazy">`:''}<span>${esc(w.name.split(' (')[0].split(' „')[0])}</span>`, x, y, z, 'wit'+(w.side==='nepřítel'?' foe':''), {pr:3, max:230, click:()=>openWitness(w), title:'Svědectví: '+w.name+' – '+w.role, kind:'wit'});
    witLabels.push(lab); }); } }

// ================================================================ popisky krajů a moří (česky, z dálky)
[['Faerûn',560,330,'huge',900,1e9],['Kara-Tur',1990,470,'huge',900,1e9],['Moře mečů',120,420,'sea',260,2600],['Bezstopé moře',30,640,'sea',260,2600],['Moře padlých hvězd',835,300,'sea',220,2600],
 ['Třpytivé moře',560,690,'sea',260,2600],['Velké moře',1300,820,'sea',260,2600],['Nebeské moře',2350,420,'sea',260,2600],['Žluté moře',2180,170,'sea',300,2600],
 ['Tethyr',300,560,'',160,1400],['Amn',300,470,'',160,1200],['Calimshan',330,640,'',160,1200],['Anauroch',470,95,'',180,1600],['Údolí',650,200,'',160,1100],['Cormyr',540,250,'',160,1100],
 ['Thay',1050,250,'',160,1200],['Mulhorand',1110,430,'',160,1200],['Chult',230,770,'',160,1300],['Halruaa',760,800,'',160,1200],['Turmish',730,370,'',160,1100],['Stříbrné pochody',300,40,'',160,1300],
 ['Shou Lung',1960,560,'',200,2000],['T\'u Lung',2120,790,'',200,1800],['Tuigan – Nekonečná pustina',1450,230,'',220,2200],['Kozakura',2330,240,'',200,2000],['Wa',2290,330,'',200,1800],['Tabot',1660,560,'',200,1800]
].forEach(([n,x,z,c,min,max])=>addLabel(esc(n), x, Math.max(ground(x,z),0)+6, z, 'region '+c, {min,max,pr:c==='huge'?2:1.5}));
addLabel('Maztica →', 18, 6, 575, 'region sea', {min:120,max:1500,pr:1.5}); addLabel('↓ Zakhara', 1330, 6, 860, 'region sea', {min:120,max:1500,pr:1.5});

// ================================================================ drobnosti ze hry (jen to, co je v kronice)
const eggs=[]; const EGGNOTE={};
function addEgg(g, max, anim){ scene.add(g); const e={g,max,anim}; eggs.push(e); return e; }
function eggLabel(name, x,y,z, text, sid, max=420){ EGGNOTE[name]={text,sid}; return addLabel(esc(name), x,y,z, 'egg', {pr:2.5, max, click:()=>openNote(name), kind:'egg'}); }
const orbit=(g,cx,cy,cz,r,speed,ph=0,flap=5)=>(t)=>{ const a=t*speed+ph; g.position.set(cx+Math.cos(a)*r, cy+Math.sin(t*0.7+ph)*0.8, cz+Math.sin(a)*r); g.rotation.set(0,-a+(speed>0?0:Math.PI),0.22*Math.sign(speed));
  if(g.userData.wl){ g.userData.wl.rotation.z=Math.sin(t*flap)*0.55; g.userData.wr.rotation.z=-Math.sin(t*flap)*0.55; } };
function dragon(tint, size=4){ const g=new THREE.Group(), stub=flyer(tint||0xb0b0b8, tint||0x909098); stub.scale.setScalar(size*0.45); g.add(stub); g.userData.wl=stub.userData.wl; g.userData.wr=stub.userData.wr;
  loadModel('dragon').then(M=>{ if(!M) return; g.remove(stub); g.userData.wl=null; const c=modelMesh(M,size,tint); c.rotation.x=Math.PI/2; c.rotation.z=Math.PI; c.position.set(0,0,size*0.5); const w=new THREE.Group(); w.add(c); w.rotation.y=Math.PI/2; g.add(w); }); return g; }
const ANA=PLACES.find(p=>p.name==='Orofin')||{x:500,z:118}, ANY=ground(ANA.x,ANA.z);
// 1) draci Aliance nad Anaurochem (Aliance měla 11 draků)
{ const tints=[0xd9b65a,0xc0c6cc,0xb8733a,0xc98a4a,0x9a8a4a,0xd0d4d8,0xcc9a44,0xa86a3a,0xe0c070,0xb0b4ba,0x9c7a3a]; const n=HQ?7:3;
  for(let i=0;i<n;i++){ const d=dragon(tints[i],3.4+((i*7)%3)*0.6); addEgg(d, 1300, orbit(d, ANA.x+8, ANY+24+i*2.5, ANA.z+12, 26+i*4, (i%2?1:-1)*(0.10+i*0.012), i*0.9)); }
  eggLabel('Draci Aliance', ANA.x+8, ANY+40, ANA.z-20, 'V bitvě v Anaurochu stálo na straně Aliance podle bojového hlášení 20 kontingentů, 49 630 mužů a 11 draků.', 'b-bitva-v-anaurochu', 700); }
// 2) létací džunka Shou Lungu a elfské létací lodě nad bitvou
{ const j=junk(); j.scale.setScalar(4.2); addEgg(j, 900, (t)=>{ const a=t*0.07; j.position.set(ANA.x-6+Math.cos(a)*34, ANY+20+Math.sin(t*0.9)*0.8, ANA.z+18+Math.sin(a)*22); j.rotation.set(Math.sin(t*0.8)*0.04, -a, Math.sin(t*0.6)*0.05); });
  eggLabel('Létací džunka Shou Lungu', ANA.x-40, ANY+26, ANA.z+18, 'Kontingent Shou Lungu pod velením Hwanga přivedl do bitvy v Anaurochu i létací džunku.', 'b-bitva-v-anaurochu', 420);
  for(let i=0;i<2;i++){ const s=ship({tint:i?0xd9e8d0:0xe8d18a}); s.scale.setScalar(3.6); addEgg(s, 900, (t)=>{ const a=-t*0.05+i*3.1; s.position.set(ANA.x+20+Math.cos(a)*40, ANY+30+i*4+Math.sin(t*0.7+i)*0.8, ANA.z-4+Math.sin(a)*26); s.rotation.set(0,-a-Math.PI/2,Math.sin(t*0.5)*0.05); }); }
  eggLabel('Zlatý sokol a Endarleaf', ANA.x+60, ANY+36, ANA.z-10, 'Elfští ostrostřelci bojovali v Anaurochu s létacími loděmi Zlatý sokol a Endarleaf.', 's-2025-07-26', 420); }
// 3) královnina létající loď nad Castle Tethyr
{ const CT=PLACES.find(p=>p.name==='Castle Tethyr'), y=ground(CT.x,CT.z); const s=ship({tint:0xf2e6c8}); s.scale.setScalar(3.4);
  addEgg(s, 700, (t)=>{ const a=t*0.09; s.position.set(CT.x+Math.cos(a)*16, y+16+Math.sin(t*0.8)*0.6, CT.z+Math.sin(a)*12); s.rotation.set(0,-a,0.05); });
  eggLabel('Královnina létající loď', CT.x+18, y+22, CT.z-8, 'Královna Finian půjčila družině létající loď (1383 DR, let na sever k Pevnosti Rudé rytířky). Na palubě létající lodi začala roku 1384 DR i Cesta Západních draků.', 's-2012-03-16', 360); }
// 4) lodě na Moři padlých hvězd a u Nelantheru
{ const sea=[[[790,250],[880,285]],[[760,300],[860,250]],[[905,270],[820,240]]], nel=[[[160,480],[200,530]],[[140,520],[190,470]]], S=HQ?3.4:3.8;
  const sail=(a,b,per,ph,col)=>{ const s=ship({sail:col}); s.scale.setScalar(S); const hd=Math.atan2(b[0]-a[0],b[1]-a[1]); addEgg(s, 1400, (t)=>{ const p=((t/per+ph)%2), fwd=p<1, e=smooth(0,1,fwd?p:2-p); s.position.set(a[0]+(b[0]-a[0])*e, 0.05+Math.sin(t*1.3+ph*9)*0.05, a[1]+(b[1]-a[1])*e); s.rotation.set(Math.sin(t*1.1+ph*3)*0.04, (fwd?hd:hd+Math.PI)+Math.PI/2, Math.sin(t*0.9+ph*5)*0.06); }); };
  sea.forEach((r,i)=>sail(r[0],r[1],90,i*0.6,i===2?0x2a2422:0xe8e2d0)); nel.forEach((r,i)=>sail(r[0],r[1],80,i*0.9,0x2a2422));
  eggLabel('Námořní střety', 850, 8, 236, 'Na jaře a v létě 1383 DR (u stolu březen až srpen 2016) se družina na Moři padlých hvězd a u Pirátských ostrovů utkala s loděmi Západní brány a s piráty.', 'b-namorni-strety-na-mori-padlych-hvezd', 500);
  eggLabel('Piráti z Nelantheru', 150, 8, 545, 'Pirátské ostrovy s radou kapitánů ve Skaugu. Tady se družina vyřádila v pirátské etapě (u stolu 2004–2005) a vrátila se sem i roku 1383 DR.', 's-2004', 500); }
// 5) Austiův odchod na Evermeet: elfská loď mizí na západě
{ const EV=PLACES.find(p=>p.name==='Evermeet'); const s=ship({tint:0xe6f0f2, ghost:true}); s.scale.setScalar(3.2); const a=[120,300], b=[EV?EV.x-60:-50,EV?EV.z:250];
  const hd=Math.atan2(b[0]-a[0],b[1]-a[1]);
  addEgg(s, 1500, (t)=>{ const k=(t/70)%1; s.position.set(a[0]+(b[0]-a[0])*k, 0.05, a[1]+(b[1]-a[1])*k); s.rotation.set(0,hd+Math.PI/2,Math.sin(t)*0.04); const m=s.userData.mat; const op=smooth(0,0.1,k)*(1-smooth(0.6,1,k)); if(m){ m.opacity=op; } s.visible=op>0.02; });
  eggLabel('Austiův odchod na Evermeet', 70, 6, 286, 'Byla to poslední výprava s Austiem: mág se s družinou rozloučil dopisy a odešel na Evermeet (1383 DR, u stolu květen 2016). Na ostrově dnes žijí jeho děti Daasan a Naira.', 's-2016-04-09', 600); }
// 6) kraken v Jezeře páry
{ const LX=560, LZ=604; const g=new THREE.Group(); g.position.set(LX,0,LZ); const s=ship({}); s.scale.setScalar(3); s.rotation.z=0.45; s.position.y=0.4; g.add(s);
  loadModel('kraken').then(M=>{ if(!M) return; const c=modelMesh(M,6); c.position.set(2,-2.2,0); g.add(c); g.userData.k=c; });
  addEgg(g, 700, (t)=>{ const k=g.userData.k; if(k){ k.rotation.y=Math.sin(t*0.3)*0.4; k.position.y=-2.2+Math.sin(t*0.8)*0.3; } s.rotation.x=Math.sin(t)*0.12; });
  eggLabel('Kraken z Jezera páry', LX, 9, LZ, 'Z pozadí světa: v bitvě na Jezeře páry stálo proti loďstvu ze břehů jezera i jediné monstrum, Kraken.', 'b-jezero-pary-a-kraken', 420); }
// 7) runodraci nad Shoonachem, 8) modrá dračice Iryklathagra u Dashadjenu
{ const SH=PLACES.find(p=>p.name==='Shoonach'); if(SH){ const y=ground(SH.x,SH.z); [0x6a7f9a,0xbfd8e8].forEach((c,i)=>{ const d=dragon(c,3.6); addEgg(d, 600, orbit(d, SH.x, y+15+i*3, SH.z, 12+i*5, (i?-1:1)*0.16, i*2)); });
    eggLabel('Runodraci', SH.x+14, y+22, SH.z-6, 'Při útěku z paláce v Shoonachu přilétli oba runodraci, Shappiraktar i Runomráz, a družina unikla do podzemí.', 's-2017-04-02', 300); }
  const DJ=PLACES.find(p=>p.name==='Dashadjen'); if(DJ){ const y=ground(DJ.x,DJ.z); const d=dragon(0x3a6ad8,4); addEgg(d, 600, orbit(d, DJ.x, y+13, DJ.z, 10, 0.2, 1));
    eggLabel('Iryklathagra', DJ.x+12, y+18, DJ.z+6, 'Modrá dračice z Tethyru, zvaná Ostrozub. U Dashadjenu s ní družina jednala i bojovala (1385 DR, u stolu březen až duben 2024).', 's-2024-04-13', 300); } }
// 9) kovová loď ztroskotaná u Dračího letu, 10) loď vytažená z Reghedského ledovce
{ const DL=PLACES.find(p=>p.name==='Dračí let'); if(DL){ const w=findWater(DL.x,DL.z,30)||[DL.x-8,DL.z]; const s=ship({tint:0x9aa3ad, hull:0x6a7078}); s.scale.setScalar(2.6); s.position.set(w[0],0.1,w[1]); s.rotation.set(0.15,0.8,0.42); addEgg(s, 260, null);
    eggLabel('Kovová loď', w[0], 3.6, w[1], 'U pevnosti na Dračím letu ztroskotala kovová loď jakoby z jiného času, s pobitou posádkou elfů a trpaslíků a s jugelothy ve válcích (Nový rok 1383 DR).', 's-2011-12-26', 220); }
  const RG=PLACES.find(p=>p.name==='Reghedský ledovec'); if(RG){ const x=RG.x+7, z=RG.z+5, y=ground(x,z); const s=ship({tint:0xc8dce8}); s.scale.setScalar(2.4); s.position.set(x,y+0.1,z); s.rotation.set(-0.25,2.2,0.18); addEgg(s, 260, null);
    eggLabel('Loď v ledu', x, y+4, z, 'Rauko a Austius dotáhli severní quest do konce a na jeho závěr vytáhli loď z Reghedského ledovce (1383 DR, u stolu září 2014).', 's-2014-09-06', 220); } }

// ================================================================ trasa družiny (jedna geometrie, barvy knih, kreslí se podle postupu)
prog('Kreslím trasu družiny…');
const STOPS=ROUTE.map((r,i)=>{ const o=BYID[r.p]; const p=posOf(o).clone(); p.y+=o.sphere?2:1.4; return {...r, i, o, pos:p}; });
function segCurve(a,b){ const A=a.pos, B=b.pos, d=Math.hypot(B.x-A.x,B.z-A.z);
  if(b.o.sphere||a.o.sphere){ const mid=A.clone().lerp(B,0.5); mid.y=Math.max(A.y,B.y)+30+d*0.08; return new THREE.QuadraticBezierCurve3(A.clone(),mid,B.clone()); }
  if(b.walk && d<260){ const pts=[]; const n=Math.max(4,Math.ceil(d/6)); for(let k=0;k<=n;k++){ const t=k/n, x=A.x+(B.x-A.x)*t, z=A.z+(B.z-A.z)*t; pts.push(new THREE.Vector3(x, Math.max(ground(x,z),0)+1.2+Math.sin(t*Math.PI)*Math.min(8,d*0.03), z)); } return new THREE.CatmullRomCurve3(pts); }
  const mid=A.clone().lerp(B,0.5); mid.y=Math.max(A.y,B.y)+6+d*0.07; return new THREE.QuadraticBezierCurve3(A.clone(),mid,B.clone()); }
const routeU={ uProg:{value:1e6}, uTime:{value:0}, uMask:{value:new Float32Array(6).fill(1)}, uCam:{value:new THREE.Vector3()}, uDim:{value:0} };
const SEGS=[]; let routeMesh=null;
{ const geos=[]; let arc=0;
  for(let i=1;i<STOPS.length;i++){ const a=STOPS[i-1], b=STOPS[i]; if(a.p===b.p){ SEGS.push(null); continue; } const c=segCurve(a,b), len=c.getLength(), n=Math.max(8,Math.min(120,Math.ceil(len/6)));
    const tg=new THREE.TubeGeometry(c, n, 0.5, 5, false); const cnt=tg.attributes.position.count, aSeg=new Float32Array(cnt), aArc=new Float32Array(cnt), aEra=new Float32Array(cnt), col=new Float32Array(cnt*3), uvA=tg.attributes.uv;
    const cc=new THREE.Color(ERA_COL(b.era)), ei=ERA[b.era]?ERA[b.era].i:5;
    for(let k=0;k<cnt;k++){ const u=uvA.getX(k); aSeg[k]=(i-1)+u; aArc[k]=arc+u*len; aEra[k]=ei; col[k*3]=cc.r; col[k*3+1]=cc.g; col[k*3+2]=cc.b; }
    tg.setAttribute('aSeg',new THREE.BufferAttribute(aSeg,1)); tg.setAttribute('aArc',new THREE.BufferAttribute(aArc,1)); tg.setAttribute('aEra',new THREE.BufferAttribute(aEra,1)); tg.setAttribute('color',new THREE.BufferAttribute(col,3));
    tg.deleteAttribute('uv'); geos.push(tg); SEGS.push({c,len,a,b}); arc+=len; }
  const g=mergeGeometries(geos); g.computeBoundingSphere();
  routeMesh=new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:routeU,
    vertexShader:`attribute float aSeg; attribute float aArc; attribute float aEra; attribute vec3 color; uniform vec3 uCam; varying float vSeg; varying float vArc; varying float vEra; varying vec3 vC;
      void main(){ vSeg=aSeg; vArc=aArc; vEra=aEra; vC=color; vec3 c=position-normal*0.5; float d=distance(c,uCam); float k=clamp(d/110.0,0.8,6.0); vec3 p=c+normal*0.5*k*0.36;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader:`uniform float uProg; uniform float uTime; uniform float uMask[6]; uniform float uDim; varying float vSeg; varying float vArc; varying float vEra; varying vec3 vC;
      void main(){ int ei=int(vEra+0.5); float m=1.0; for(int i=0;i<6;i++){ if(i==ei) m=uMask[i]; } if(m<0.5) discard;
        float done=step(vSeg,uProg); float dash=0.6+0.4*step(0.45,fract(vArc*0.045-uTime*0.6));
        float a=mix(0.13, 0.95*dash, done)*(1.0-uDim*0.62); vec3 c=mix(vC*0.65, vC, done);
        gl_FragColor=vec4(c,a);
        #include <colorspace_fragment>
      }` }));
  routeMesh.renderOrder=7; routeMesh.frustumCulled=false; scene.add(routeMesh); }
// paprsky portálů pro cesty do sfér
const beams=[]; for(let i=1;i<STOPS.length;i++){ const b=STOPS[i], a=STOPS[i-1]; if(b.o.sphere && !a.o.sphere){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.9,2.4,1,12,1,true), new THREE.MeshBasicMaterial({color:0xb48cff, transparent:true, opacity:0.0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
  m.position.copy(a.pos); m.scale.y=60; m.position.y+=30; scene.add(m); beams.push({m,i}); } }

// žeton družiny: prapor se zlatým kruhem
const token=(()=>{ const g=new THREE.Group(), bn=banner(0xc9a54a); bn.scale.setScalar(1.6); g.add(bn); const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,0.12,8,32), new THREE.MeshBasicMaterial({color:0xc9a54a})); ring.rotation.x=Math.PI/2; ring.position.y=0.15; g.add(ring);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xffd27a, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.75})); gl.scale.set(9,9,1); gl.position.y=2.5; g.add(gl);
  g.visible=false; scene.add(g); return {g, bn, ring, gl}; })();
const tokenLabel=addLabel('Družina', 0,0,0, 'token', {obj:token.g, dy:6, pr:10, kind:'token'}); tokenLabel.on=false;

// ================================================================ stav, kamera, animace průletu
let camD=1500, anim=null, flyMode=null;
function flyTo(pos, target, dur=1600){ if(REDUCED) dur=0; if(dur<=0){ camera.position.copy(pos); controls.target.copy(target); anim=null; return; } anim={ p0:camera.position.clone(), t0:controls.target.clone(), p1:pos.clone(), t1:target.clone(), start:performance.now(), dur }; }
function stepAnim(now){ if(!anim) return; const k=Math.min(1,(now-anim.start)/anim.dur), e=k<0.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  camera.position.lerpVectors(anim.p0,anim.p1,e); if(anim.arc){ camera.position.y+=Math.sin(k*Math.PI)*anim.arc; } controls.target.lerpVectors(anim.t0,anim.t1,e); if(k>=1) anim=null; }
function flyView(name){ const v=VIEW[name](); const t=v3(v.t); flyTo(t.clone().add(v3(v.o)), t, 1900); }
function flyToObj(o, dist){ const p=posOf(o); const D=dist||(o.sphere?115:o._o?Math.max(100,o._o.H*15):110); const dir=camera.position.clone().sub(controls.target).setY(0); if(dir.lengthSq()<1) dir.set(0,0,1); dir.normalize();
  const off=dir.multiplyScalar(D*0.78); off.y=D*0.62; const tgt=p.clone(); tgt.y+=o.sphere?2:(o._o&&o._o.H?o._o.H*0.3:0); if(PORTRAIT()) tgt.add(dir.clone().normalize().multiplyScalar(D*0.32)); if(o.name==='Thultanthar'){ tgt.y=THUL.y0+2; }
  const far=camera.position.distanceTo(tgt); const dur=clamp(far*1.3,900,2600); flyTo(tgt.clone().add(off), tgt, dur); if(anim && far>400) anim.arc=Math.min(500,far*0.25); }

// ---------------------------------------------------------------- klávesnice (jako v původní mapě)
const keys=new Set();
const kf=new THREE.Vector3(), kr=new THREE.Vector3(), koff=new THREE.Vector3(), UP=new THREE.Vector3(0,1,0);
function stepKeys(dt){ if(!keys.size) return; koff.copy(camera.position).sub(controls.target); const d=koff.length(); kf.copy(koff).setY(0).normalize().negate(); kr.crossVectors(kf,UP);
  const mv=d*0.9*dt; let fx=0, rx=0;
  if(keys.has('w')||keys.has('arrowup')) fx+=1; if(keys.has('s')||keys.has('arrowdown')) fx-=1; if(keys.has('d')||keys.has('arrowright')) rx+=1; if(keys.has('a')||keys.has('arrowleft')) rx-=1;
  if(fx||rx){ const dx=(kf.x*fx+kr.x*rx)*mv, dz=(kf.z*fx+kr.z*rx)*mv; controls.target.x+=dx; controls.target.z+=dz; camera.position.x+=dx; camera.position.z+=dz; }
  let rot=0; if(keys.has('q')) rot+=1; if(keys.has('e')) rot-=1; if(rot){ koff.applyAxisAngle(UP, rot*1.4*dt); camera.position.copy(controls.target).add(koff); }
  let zm=0; if(keys.has('r')||keys.has('+')||keys.has('=')) zm-=1; if(keys.has('f')||keys.has('-')) zm+=1;
  if(zm){ koff.copy(camera.position).sub(controls.target); const nd=clamp(d*Math.exp(zm*1.3*dt), controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(koff.multiplyScalar(nd/d)); } }

// ================================================================ nálada: světlo, mlha, nebe (podle knihy nebo ručně)
const MOODS={
  day:   {top:0x5f86b5, hor:0xcfc3a6, glow:0xfff0c8, ga:0.5, hs:0xdfe6f0, hg:0x5a4a32, hi:0.72, sc:0xfff0d8, si:2.0, sun:[0.45,0.75,0.35], fog:0xc9bc9e, fd:1.0, ex:0.95, wd:0x1d4a66, ws:0x6aa8be, sky:0xa9c2d4, cl:0.35, night:0},
  dawn:  {top:0x5a6f98, hor:0xf0b884, glow:0xffb070, ga:1.0, hs:0xf2d7b8, hg:0x5a4632, hi:0.9, sc:0xffc488, si:2.0, sun:[0.9,0.28,0.2], fog:0xe3bf98, fd:1.1, ex:1.08, wd:0x24475e, ws:0x7aa6b4, sky:0xd9b9a0, cl:0.45, night:0},
  frost: {top:0x7d97b8, hor:0xdfe6ee, glow:0xe8f2ff, ga:0.45, hs:0xe8f0ff, hg:0x5a6170, hi:1.05, sc:0xe6efff, si:1.8, sun:[-0.3,0.55,0.6], fog:0xd6dde6, fd:1.35, ex:1.06, wd:0x1e3f58, ws:0x7aa2b8, sky:0xc4d2de, cl:0.6, night:0},
  storm: {top:0x46505e, hor:0x8a8e92, glow:0xbcc6d0, ga:0.15, hs:0xb5bcc6, hg:0x403a32, hi:0.95, sc:0xc8d0dc, si:0.9, sun:[0.2,0.6,-0.4], fog:0x8c9096, fd:2.1, ex:1.0, wd:0x1a3040, ws:0x4f7080, sky:0x7a858f, cl:1.0, night:0.15},
  shadow:{top:0x241a34, hor:0x8a5a6a, glow:0xff6a4a, ga:0.8, hs:0x9a8ab8, hg:0x2a2030, hi:0.75, sc:0xff9a6a, si:1.3, sun:[-0.8,0.18,0.3], fog:0x5a4256, fd:1.7, ex:1.1, wd:0x1a2033, ws:0x4a4f6a, sky:0x5a4a62, cl:0.8, night:0.35},
  dusk:  {top:0x2c3658, hor:0xe0a070, glow:0xff9a5a, ga:1.0, hs:0xd8b8a0, hg:0x3a2e28, hi:0.8, sc:0xffae70, si:1.5, sun:[-0.9,0.16,-0.1], fog:0xb08a74, fd:1.25, ex:1.1, wd:0x1c3046, ws:0x5a7c8c, sky:0xa88a80, cl:0.5, night:0.3},
  night: {top:0x050912, hor:0x1c2a40, glow:0x000000, ga:0, hs:0x5a6c96, hg:0x1a1a22, hi:0.6, sc:0xa9c2ff, si:0.55, sun:[-0.4,0.7,-0.3], fog:0x18223a, fd:1.3, ex:1.25, wd:0x0a1624, ws:0x23384c, sky:0x1c2a40, cl:0.25, night:1},
};
let moodWant='auto', moodCur={...MOODS.day}; const moodTgt={...MOODS.day};
const ca=new THREE.Color(), cb=new THREE.Color();
function lerpCol(a,b,t){ return ca.set(a).lerp(cb.set(b),t).getHex(); }
function setMood(key){ Object.assign(moodTgt, MOODS[key]||MOODS.day); }
const MOOD_COL=new Set(['top','hor','glow','hs','hg','sc','fog','wd','ws','sky']);
function stepMood(dt){ const k=REDUCED?1:1-Math.exp(-dt*1.6); for(const n in moodTgt){ const a=moodCur[n], b=moodTgt[n]; if(Array.isArray(b)) moodCur[n]=a.map((v,i)=>v+(b[i]-v)*k); else if(MOOD_COL.has(n)) moodCur[n]=lerpCol(a,b,k); else moodCur[n]=a+(b-a)*k; } }
const sunDir=new THREE.Vector3();
function applyLook(){ const M=moodCur; skyU.top.value.set(M.top); skyU.horizon.value.set(M.hor); skyU.glow.value.set(M.glow); skyU.glowAmt.value=M.ga;
  sunDir.set(M.sun[0],M.sun[1],M.sun[2]).normalize(); skyU.sunDir.value.copy(sunDir); sun.position.copy(controls.target).addScaledVector(sunDir,600); sun.target.position.copy(controls.target);
  sun.color.set(M.sc); sun.intensity=M.si; hemi.color.set(M.hs); hemi.groundColor.set(M.hg); hemi.intensity=M.hi;
  scene.fog.color.set(M.fog); const far=smooth(300,1800,camD); scene.fog.density=(0.22/Math.max(40,camD)+0.00005)*M.fd*(1-far*0.55);
  waterU.uFogC.value.set(M.fog); waterU.uFogD.value=scene.fog.density; waterU.uSun.value.copy(sunDir); waterU.uSunC.value.set(M.sc); waterU.uDeep.value.set(M.wd); waterU.uShallow.value.set(M.ws); waterU.uSky.value.set(M.sky); waterU.uNight.value=M.night;
  stars.material.opacity=smooth(0.2,0.9,M.night)*0.95; renderer.toneMappingExposure=M.ex;
  const co=M.cl*smooth(140,420,camD)*0.85; for(const c of CLOUDS){ c.material.opacity=co*0.75; c.material.color.set(M.night>0.5?0x445066:M.top===MOODS.shadow.top?0x6a5a7a:0xffffff); }
  terrU.uSnow.value=1; }

// ================================================================ karty (místo, sféra, bitva, svědek, drobnost, zastávka deníku)
const info=$('info'), infoBody=$('infoBody'); let curCard=null;
function webLink(hash, txt='v kronice →'){ return `<a class="lnk" href="${WEB}#${esc(hash)}" target="_top">${esc(txt)}</a>`; }
function sesHTML(sid, opt={}){ const s=SES[sid]; if(!s) return ''; return `<div class="ses" style="--c:${ERA_COL(s.era)}"><div class="d">${esc(s.d)} · ${esc(s.dr)}${s.pl&&s.pl.length?' · hráli: '+esc(s.pl.join(', ')):''}</div><div class="t">${esc(s.t)}</div><div class="s${opt.clip?' clip':''}">${esc(s.s)}</div>${webLink(sid)}</div>`; }
function galHTML(imgs){ const L=imgs.filter(i=>i&&i.src); if(!L.length) return ''; return `<div class="gal">${L.map(i=>`<button data-src="${esc(i.src)}" data-cap="${esc(i.cap||'')}" aria-label="Zvětšit obraz"><img src="${esc(i.src)}" alt="${esc(i.cap||'')}" loading="lazy"></button>`).join('')}</div>`; }
function showCard(html, cls=''){ stopWit(); infoBody.innerHTML=html; info.className='glass card'+(cls?' '+cls:''); info.hidden=false; info.scrollTop=0;
  infoBody.querySelectorAll('.gal button,.hero-img').forEach(b=>b.addEventListener('click',()=>openLightbox(b.dataset.src||b.getAttribute('src'), b.dataset.cap||b.alt||'')));
  infoBody.querySelectorAll('.s.clip').forEach(s=>s.addEventListener('click',()=>s.classList.remove('clip')));
  infoBody.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openAny(b.dataset.open,true))); }
function closeInfo(){ stopWit(); info.hidden=true; curCard=null; document.querySelectorAll('.lbl.sel').forEach(e=>e.classList.remove('sel')); }
$('infoClose').onclick=closeInfo;
function openAny(key, fly){ if(BYID[key]) return openPlace(BYID[key],fly); if(BATT[key]) return openBattle(BATT[key],fly); if(WIT[key]) return openWitness(WIT[key],fly); }

function openPlace(p, fly){ if(measuring && !p.sphere){ pickMeasure(p); return; } curCard={type:'place',id:p.id}; if(fly) flyToObj(p);
  document.querySelectorAll('.lbl.sel').forEach(e=>e.classList.remove('sel')); if(p._o&&p._o.L) p._o.L.el.classList.add('sel');
  const visits=(p.visits||[]).map(v=>`<li><b style="color:${ERA_COL(v.era)}">${esc(v.era==='epilog'?'Ep.':v.era)}</b><div>${esc(v.what)}<br><span>u stolu ${esc(v.real)} · ${esc(v.dr)} DR</span></div></li>`).join('');
  const imgs=[]; for(const sid of p.sessions||[]) for(const im of (SES[sid]&&SES[sid].img)||[]) imgs.push(im); for(const bid of p.battles||[]) for(const im of (BATT[bid]&&BATT[bid].img)||[]) imgs.push(im);
  const ses=(p.sessions||[]).slice(0,12).map(s=>sesHTML(s,{clip:true})).join('');
  const npcs=p.npcs||[]; const npcH=npcs.length?`<h4>Kdo tu žije a koho tu potkali (${npcs.length})</h4><ul class="npcs">${npcs.slice(0,10).map(n=>`<li class="${n.k==='nepřítel'?'foe':''}"><b>${esc(n.n)}</b> – ${esc(n.w)}</li>`).join('')}</ul>${npcs.length>10?`<button class="more" id="npcMore">Zobrazit všech ${npcs.length}</button>`:''}`:'';
  const bt=(p.battles||[]).map(id=>BATT[id]).filter(Boolean).map(b=>`<button class="chip red" data-open="${esc(b.id)}">⚔ ${esc(b.name)}</button>`).join('');
  const wt=(p.wit||[]).map(id=>WIT[id]).filter(Boolean).map(w=>`<button class="chip" data-open="${esc(w.id)}">◉ ${esc(w.name)}</button>`).join('');
  const stops=STOPS.filter(s=>s.p===p.id).map(s=>`<button class="chip" data-stop="${s.i}" style="border-color:${ERA_COL(s.era)}">${esc(s.real)} · ${esc(s.what)}</button>`).join('');
  showCard(`<p class="kick">${p.sphere?'Sféra':esc(p.kind)} · ${esc(p.region)}</p><h2>${esc(p.name)}</h2><div class="sub">${p.approx?'Poloha na mapě je přibližná, podle popisu v kronice. ':''}${(p.sessions||[]).length} sezení v kronice</div>
    ${imgs[0]?`<img class="hero-img" src="${esc(imgs[0].src)}" alt="${esc(imgs[0].cap||p.name)}" data-cap="${esc(imgs[0].cap||'')}">`:''}
    <p>${esc(p.desc)}</p>
    ${visits?`<h4>Co se tu stalo</h4><ul class="vis">${visits}</ul>`:''}
    ${stops?`<div class="chips" aria-label="Zastávky výpravy">${stops}</div>`:''}
    ${(()=>{ const chs=[...new Set(STOPS.filter(s=>s.p===p.id&&s.ch).map(s=>s.ch))]; return chs.length?`<h4>V Příběhu kroniky</h4><p class="chl">${chs.map(c=>webLink(c,'„'+((CHAP[c]||{}).t||c)+'“ →')).join('<br>')}</p>`:''; })()}
    ${bt||wt?`<h4>Bitvy a svědectví</h4><div class="chips">${bt}${wt}</div>`:''}
    ${ses?`<h4>Sezení</h4>${ses}`:''}
    ${npcH}
    ${imgs.length>1?`<h4>Malby kroniky</h4>${galHTML(imgs.slice(1,9))}`:''}
    <p class="note" style="margin-top:12px">${webLink('mapa','Místo na 2D mapě kroniky →')}</p>`);
  infoBody.querySelectorAll('[data-stop]').forEach(b=>b.addEventListener('click',()=>goStop(+b.dataset.stop,{fly:true})));
  const nm=$('npcMore'); if(nm) nm.onclick=()=>{ nm.previousElementSibling.innerHTML=npcs.map(n=>`<li class="${n.k==='nepřítel'?'foe':''}"><b>${esc(n.n)}</b> – ${esc(n.w)}</li>`).join(''); nm.remove(); };
  setHash('p='+p.id); }

function openBattle(b, fly){ curCard={type:'battle',id:b.id}; const o=b._o; if(fly&&o){ const p=o.g.position.clone(); const D=o.top?95:70; const dir=camera.position.clone().sub(controls.target).setY(0).normalize(); if(!isFinite(dir.x)) dir.set(0,0,1);
    flyTo(p.clone().add(dir.multiplyScalar(D*0.75)).add(new THREE.Vector3(0,D*0.55,0)), p.clone().add(new THREE.Vector3(0,4,0)), clamp(camera.position.distanceTo(p)*1.3,900,2600)); if(o) buildArmy(o); }
  const sides=b.sides.map((s,i)=>`<div class="side" style="border-left:3px solid #${SIDE_COL[i%SIDE_COL.length].toString(16).padStart(6,'0')}"><h5>${esc(s.name)}</h5><div class="tot">${esc(s.total||'')}${s.commanders&&s.commanders.length?' · velení: '+esc(s.commanders.join(', ')):''}</div>
    ${s.units&&s.units.length?`<details><summary class="note" style="cursor:pointer;margin-top:6px">Soupiska (${s.units.length})</summary><table>${s.units.map(u=>`<tr><td>${esc(u.unit)}${u.commander&&u.commander!=='—'?` <span class="note">(${esc(u.commander)})</span>`:''}</td><td>${esc(u.count)}</td></tr>`).join('')}</table></details>`:''}</div>`).join('');
  showCard(`<p class="kick">Bitva · ${esc(b.dr)} DR${b.real?' · '+esc(b.real):''}</p><h2>${esc(b.name)}</h2><div class="sub">${esc(b.place)}</div>
    ${b.img&&b.img[0]?`<img class="hero-img" src="${esc(b.img[0].src)}" alt="${esc(b.img[0].cap)}" data-cap="${esc(b.img[0].cap)}">`:''}
    <p>${esc(b.summary)}</p>${b.outcome?`<div class="outcome">${esc(b.outcome)}</div>`:''}
    <h4>Strany</h4>${sides}
    ${b.session?`<h4>Sezení</h4>${sesHTML(b.session,{clip:true})}`:''}
    <p class="note" style="margin-top:12px">${webLink(b.id,'Bojové hlášení v kronice →')}${b.pl&&BYID[b.pl]?` · <button class="more" data-open="${esc(b.pl)}">${esc(BYID[b.pl].name)}</button>`:''}</p>`);
  setHash('b='+b.id); }

// svědectví: živý portrét (smyčka), hlas a titulky po větách (CZ / EN / vyp, stejné nastavení jako na webu: localStorage zd-titulky)
// Vložená mapa (iframe v kronice) si s webem povídá přes postMessage: 'zd:sound' (tady začal hrát hlas → web převezme zvuk a ostatní
// přehrávače ztiší), 'zd:pause' (jiný přehrávač webu převzal zvuk → tady pauza), 'zd:submode' (změna titulků na webu / tady).
let wit=null;
const SUBKEY='zd-titulky';
const subMode=()=>{ try{ const m=localStorage.getItem(SUBKEY); return ['cs','en','off'].includes(m)?m:'cs'; }catch(e){ return 'cs'; } };
const subsOf=w=>{ const m=subMode(); if(m==='off') return []; if(m==='en') return w.text; return (w.titulky&&w.titulky.length===w.text.length)?w.titulky:w.text; };
const toHost=msg=>{ try{ if(window.parent!==window) window.parent.postMessage(msg,location.origin); }catch(e){} };
function setSubMode(m,fromHost){ try{ localStorage.setItem(SUBKEY,m); }catch(e){} if(!fromHost) toHost({type:'zd:submode',mode:m}); if(wit&&wit.refresh) wit.refresh(); }
window.addEventListener('message',e=>{ if(e.origin!==location.origin||!e.data||typeof e.data!=='object') return;
  if(e.data.type==='zd:submode'&&['cs','en','off'].includes(e.data.mode)) setSubMode(e.data.mode,true);
  if(e.data.type==='zd:pause'&&wit&&wit.pause) wit.pause(); });
function stopWit(){ if(!wit) return; try{ wit.au.pause(); wit.v&&wit.v.pause(); }catch(e){} cancelAnimationFrame(wit.raf); wit=null; }
function openWitness(w, fly){ curCard={type:'wit',id:w.id}; if(fly&&w.pl&&BYID[w.pl]) flyToObj(BYID[w.pl]);
  const cc=['cs','en','off'].map(m=>`<button type="button" data-cc="${m}" aria-pressed="${subMode()===m}">${m==='cs'?'CZ':m==='en'?'EN':'vyp'}</button>`).join('');
  showCard(`<p class="kick">Svědectví · ${w.side==='nepřítel'?'nepřítel':w.side==='neutrální'?'neutrální':'spojenec'}</p><h2>${esc(w.name)}</h2><div class="sub">${esc(w.role)}${w.home?' · '+esc(w.home):''}</div>
    <div class="wit-v">${w.vid?`<video id="wv" muted loop playsinline preload="metadata" ${w.poster?`poster="${esc(w.poster)}"`:''} src="${esc(w.vid)}"></video>`:w.poster?`<img src="${esc(w.poster)}" alt="">`:''}<div class="subt" id="wsub"></div></div>
    <div class="wit-ctl"><button class="btn" id="wplay">▶ Přehrát svědectví</button><div class="prog"><i id="wprog"></i></div><span class="wit-cc" role="group" aria-label="Titulky">${cc}</span></div>
    <p class="note" style="margin-top:8px">${esc(w.bond||'')}</p>
    <div class="wit-tx" id="wtx"></div>
    <p class="note" style="margin-top:12px">${webLink('svedectvi/'+w.id,'Svědectví v kronice →')}${w.pl&&BYID[w.pl]?` · <button class="more" data-open="${esc(w.pl)}">${esc(BYID[w.pl].name)}</button>`:''}</p>`);
  const au=new Audio(); au.preload='none'; au.setAttribute('playsinline',''); if(w.audio) au.src=w.audio; const v=$('wv'); if(v){ v.muted=true; v.defaultMuted=true; } wit={au,v,raf:0,w};
  const sub=$('wsub'), pr=$('wprog'), btn=$('wplay'), tx=$('wtx'); let spans=[], lastK=-1;
  const starts=w.t||w.text.map((_,i)=>i*5.5);
  const refresh=()=>{ const L=subsOf(w); tx.innerHTML=L.map((t,i)=>`<span data-i="${i}">${esc(t)}</span> `).join(''); spans=[...tx.querySelectorAll('span')]; tx.hidden=!L.length; lastK=-1;
    document.querySelectorAll('.wit-cc [data-cc]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cc===subMode()))); show(curK()); };
  const curK=()=>{ const t=au.currentTime; let k=0; for(let i=0;i<starts.length;i++) if(t>=starts[i]) k=i; return k; };
  const show=k=>{ const L=subsOf(w); sub.textContent=L[k]||''; sub.hidden=!L.length; spans.forEach((s,i)=>s.classList.toggle('on',i===k&&!au.paused)); lastK=k; };
  const tick=()=>{ if(!wit||wit.w!==w) return; const t=au.currentTime, dur=au.duration||w.dur||1; show(curK()); pr.style.width=(t/dur*100).toFixed(1)+'%'; wit.raf=requestAnimationFrame(tick); };
  const pause=()=>{ au.pause(); v&&v.pause(); btn.textContent='▶ Pokračovat'; show(curK()); };
  wit.refresh=refresh; wit.pause=pause;
  document.querySelectorAll('.wit-cc [data-cc]').forEach(b=>b.addEventListener('click',()=>setSubMode(b.dataset.cc)));
  btn.onclick=()=>{ if(!w.audio){ sub.textContent='Hlas zatím chybí.'; return; } if(au.paused){ au.volume=0.95; au.play().then(()=>{ toHost({type:'zd:sound',on:true}); v&&v.play().catch(()=>{}); btn.textContent='❚❚ Pozastavit'; tick(); }).catch(()=>{ sub.textContent='Přehrávání zablokoval prohlížeč – klepni znovu.'; }); } else pause(); };
  au.onended=()=>{ btn.textContent='▶ Přehrát znovu'; v&&v.pause(); sub.textContent=''; };
  refresh(); if(v && !REDUCED) v.play().catch(()=>{});
  setHash('w='+w.id); }

function openNote(name){ const n=EGGNOTE[name]; if(!n) return; curCard={type:'note',id:name}; const s=n.sid&&SES[n.sid], b=n.sid&&BATT[n.sid];
  showCard(`<p class="kick">Ze hry</p><h2>${esc(name)}</h2><p>${esc(n.text)}</p>${s?`<h4>Sezení</h4>${sesHTML(n.sid,{clip:true})}`:''}${b?`<p class="note" style="margin-top:10px"><button class="more" data-open="${esc(b.id)}">⚔ ${esc(b.name)}</button> · ${webLink(b.id,'v kronice →')}</p>`:''}`); }

function openLightbox(src,cap){ if(!src) return; $('lbImg').src=src; $('lbImg').alt=cap||''; $('lbCap').textContent=cap||''; $('lightbox').hidden=false; }
$('lightbox').onclick=()=>{ $('lightbox').hidden=true; };

// ================================================================ výprava: přehrávání, krokování, posuvník času, deník
const tl={ i:-1, playing:false, diary:true, scale:'real', hold:0, seg:null, segT:0, segDur:0, waitUntil:0, speed:1, tour:false, lastCh:null };
const CHAP=CAMP.chapters||{};
// titulek kapitoly (při přehrávání a přeletu tažením)
let chapTimer=0;
function showChapter(s){ const c=CHAP[s.ch], el=$('chapT'); if(!c||!el) return; const e=ERA[s.era]||{};
  el.style.setProperty('--c',ERA_COL(s.era)); el.innerHTML=`<p class="ck">${esc(e.kap||'')} · u stolu ${esc(c.real)}${c.dr?' · '+esc(c.dr):''}</p><h3>${esc(c.t)}</h3>${tl.tour?`<p class="cs">${esc(s.o.name)} – ${esc(s.what)}</p>`:''}`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(chapTimer); chapTimer=setTimeout(()=>el.classList.remove('on'), (tl.tour?5200:3400)/Math.sqrt(tl.speed)); }
function setSpeed(v){ tl.speed=v; const b=$('tlSpeed'); if(b){ b.textContent=String(v).replace('.',',')+'×'; } }
function toggleTour(force){ const on=force!=null?force:!tl.tour; if(on===tl.tour) return; tl.tour=on; document.body.classList.toggle('tour',on); $('tlTour').setAttribute('aria-pressed',String(on));
  if(on){ tl.diaryWas=tl.diary; tl.diary=false; closeInfo(); tl.lastCh=null; if(tl.i>=STOPS.length-1) tl.i=-1; togglePlay(true); if(tl.i>=0) showChapter(STOPS[tl.i]); }
  else { tl.diary=tl.diaryWas!=null?tl.diaryWas:true; if(tl.playing) togglePlay(false); } }
const range=$('tlRange'); range.max=String(STOPS.length-1);
function stopEnabled(s){ return eraOn.has(s.era); }
function buildTicks(){ const T=$('tlTicks'); T.innerHTML=''; const n=STOPS.length; let cur=null, run=0; const push=()=>{ if(cur){ const i=document.createElement('i'); i.style.width=(run/n*100)+'%'; i.style.background=ERA_COL(cur); i.style.opacity=eraOn.has(cur)?1:0.25; T.appendChild(i); } };
  for(const s of STOPS){ if(s.era!==cur){ push(); cur=s.era; run=0; } run++; } push();
  let yl=$('tlYears'); if(!yl){ yl=document.createElement('div'); yl.id='tlYears'; yl.className='tl-years'; $('tlTicks').parentElement.after(yl); }
  const seen=new Set(); let last=-99; yl.innerHTML=STOPS.map((s,i)=>{ const lab=tl.scale==='real'?String(s.real).match(/\d{4}/)[0]:String(s.dr); if(seen.has(lab)) return ''; seen.add(lab); const x=i/(n-1)*100; if(x-last<6.5) return ''; last=x; return `<span style="left:${x}%">${lab}</span>`; }).join(''); }
$('tlScale').onclick=()=>{ tl.scale=tl.scale==='real'?'dr':'real'; $('tlScale').textContent=tl.scale==='real'?'u stolu':'DR'; buildTicks(); };
function capHTML(s){ const e=ERA[s.era], c=CHAP[s.ch]; return `<b style="color:${ERA_COL(s.era)}">${esc(e?e.kap:s.era)}</b>${c?` <span class="w">· ${webLink(s.ch, c.t)}</span>`:''} <span class="w">· zastávka ${s.i+1}/${STOPS.length} · u stolu ${esc(s.real)} · ${esc(s.dr)} DR</span><br><strong>${esc(s.o.name)}</strong> – ${esc(s.what)}`; }
function setProg(v){ routeU.uProg.value=v; }
function diaryCard(s){ const o=s.o, e=ERA[s.era]; const ses=(s.s||[]); const imgs=[]; for(const sid of ses) for(const im of (SES[sid]&&SES[sid].img)||[]) imgs.push(im);
  const who=new Map(); for(const sid of ses){ const S=SES[sid]; if(!S) continue; (S.ch||[]).forEach((c,i)=>{ if(!who.has(c)) who.set(c,''); }); }
  const pl=new Set(); ses.forEach(sid=>((SES[sid]&&SES[sid].pl)||[]).forEach(p=>pl.add(p)));
  showCard(`<p class="kick">${esc(e?e.kap+' · '+e.title:s.era)} · zastávka ${s.i+1} z ${STOPS.length}</p><h2>${esc(o.name)}</h2><div class="sub">u stolu ${esc(s.real)} · ${esc(s.dr)} DR · ${esc(o.region)}${o.sphere?' · cesta portálem do sféry':''}</div>
    ${imgs[0]?`<img class="hero-img" src="${esc(imgs[0].src)}" alt="${esc(imgs[0].cap||o.name)}" data-cap="${esc(imgs[0].cap||'')}">`:''}
    <p><b>${esc(s.what.charAt(0).toUpperCase()+s.what.slice(1))}.</b> ${esc(o.desc)}</p>
    ${who.size?`<h4>U toho byli</h4><div class="chips">${[...who.keys()].map(c=>`<span class="chip">${esc(c)}</span>`).join('')}</div>${pl.size?`<p class="note" style="margin-top:6px">Hráli: ${esc([...pl].join(', '))}</p>`:''}`:''}
    ${ses.length?`<h4>${s.f?'Sezení z téže doby v kraji':'Sezení'}</h4>${ses.map(sid=>sesHTML(sid)).join('')}`:`<p class="note" style="margin-top:12px">K této zastávce kronika nemá samostatný zápis sezení.</p>`}
    <div class="dnav"><button id="dPrev" ${s.i<=0?'disabled':''}>‹ Předchozí</button><button id="dPlay">${tl.playing?'❚❚ Zastavit':'▶ Přehrát odsud'}</button><button id="dNext" ${s.i>=STOPS.length-1?'disabled':''}>Další ›</button></div>
    <p class="note" style="margin-top:10px"><button class="more" data-open="${esc(o.id)}">Karta místa</button> · ${s.ch&&CHAP[s.ch]?webLink(s.ch, 'Kapitola „'+CHAP[s.ch].t+'“ v Příběhu →'):webLink(ses[0]||'pribeh', 'Příběh v kronice →')}</p>`, 'diary');
  curCard={type:'stop',id:s.i};
  $('dPrev').onclick=()=>stepRel(-1); $('dNext').onclick=()=>stepRel(1); $('dPlay').onclick=()=>togglePlay(); }
function updateUIForStop(s){ $('tlCap').innerHTML=capHTML(s); range.value=String(s.i); range.style.setProperty('--c',ERA_COL(s.era));
  token.bn.userData.flag.material.color.set(ERA_COL(s.era)); token.ring.material.color.set(ERA_COL(s.era)); tokenLabel.el.style.setProperty('--c',ERA_COL(s.era)); tokenLabel.el.textContent=s.o.name;
  document.querySelectorAll('.lbl.cur').forEach(e=>e.classList.remove('cur')); const L=s.o._o&&s.o._o.L; if(L){ L.el.classList.add('cur'); L.el.style.setProperty('--c',ERA_COL(s.era)); L.pr=8; }
  if(moodWant==='auto') setMood(ERA[s.era]?ERA[s.era].mood:'day'); $('sphereVeil').classList.toggle('on', !!s.o.sphere);
  for(const b of beams) b.m.material.opacity=(b.i===s.i)?0.55:0;
  $('sub').textContent=`${ERA[s.era]?ERA[s.era].kap:''} · u stolu ${s.real} · ${s.dr} DR · ${s.o.name}`; }
function camFor(s, segLen){ const tgt=s.pos.clone(); const D=s.o.sphere?80:(segLen?clamp(segLen*0.55,130,900):Math.max(120,(s.o._o?s.o._o.H:5)*16)); const dir=camera.position.clone().sub(controls.target).setY(0); if(dir.lengthSq()<1) dir.set(0.2,0,1); dir.normalize();
  if(PORTRAIT()&&tl.diary&&!segLen){ tgt.addScaledVector(dir,D*0.34); tgt.y-=D*0.12; }
  return {pos:tgt.clone().add(dir.clone().multiplyScalar(D*0.72)).add(new THREE.Vector3(0,D*0.66,0)), tgt}; }
function goStop(i, opt={}){ i=clamp(i,0,STOPS.length-1); const prev=tl.i; tl.i=i; const s=STOPS[i];
  for(const L of labels) if(L.kind==='place') L.pr=BIG.has(L.el.textContent.replace(' ≈',''))?6:4;
  updateUIForStop(s); token.g.visible=true; tokenLabel.on=true;
  const seg=i>0?SEGS[i-1]:null;
  if(s.ch && s.ch!==tl.lastCh){ const first=tl.lastCh==null&&!tl.playing; tl.lastCh=s.ch; if(!first||tl.tour) showChapter(s); if(tl.playing) tl.chapHold=tl.tour?2200:1200; }
  if(opt.animate && seg && prev===i-1 && !REDUCED){ tl.seg=seg; tl.segT=0; tl.segDur=clamp(seg.len/170,2.2,6.5)/tl.speed; setProg(i-1); flyMode='follow'; anim=null; }
  else { tl.seg=null; token.g.position.copy(s.pos); setProg(i); if(opt.fly!==false){ const c=camFor(s); flyTo(c.pos,c.tgt,opt.fast?900:1700); } }
  if(tl.diary) diaryCard(s); else if(curCard&&curCard.type==='stop') closeInfo();
  setHash('krok='+(i+1)); }
function stepRel(d){ let i=tl.i<0?(d>0?-1:STOPS.length):tl.i; do{ i+=d; }while(i>=0&&i<STOPS.length&&!stopEnabled(STOPS[i])); if(i<0||i>=STOPS.length) return false; goStop(i,{animate:d===1&&tl.playing||d===1&&!REDUCED&&i===tl.i+1}); return true; }
function togglePlay(force){ tl.playing=force!=null?force:!tl.playing; $('tlPlay').classList.toggle('on',tl.playing); $('tlPlay').textContent=tl.playing?'❚❚':'▶'; $('tlPlay').setAttribute('aria-label',tl.playing?'Zastavit výpravu':'Přehrát výpravu'); document.body.classList.toggle('playing',tl.playing);
  if(tl.playing){ closeProbe(); if(tl.i<0||tl.i>=STOPS.length-1){ let i=0; while(i<STOPS.length&&!stopEnabled(STOPS[i])) i++; goStop(i,{fast:true}); tl.waitUntil=performance.now()+2600; } else { tl.waitUntil=performance.now()+400; } }
  else { flyMode=null; if(tl.tour) toggleTour(false); } if(curCard&&curCard.type==='stop'){ const b=$('dPlay'); if(b) b.textContent=tl.playing?'❚❚ Zastavit':'▶ Přehrát odsud'; } }
function stepTour(now, dt){
  if(tl.seg){ tl.segT=Math.min(1,tl.segT+dt/tl.segDur); const e=tl.segT<0.5?2*tl.segT*tl.segT:1-Math.pow(-2*tl.segT+2,2)/2; const p=tl.seg.c.getPointAt(e); token.g.position.copy(p); setProg(tl.i-1+e);
    // kamera letí za žetonem
    const s=STOPS[tl.i], c=camFor(s, tl.seg.len*(0.35+0.65*Math.sin(e*Math.PI))); const want=c.pos.clone().sub(c.tgt).add(p); const k=1-Math.exp(-dt*2.2); camera.position.lerp(want,k); controls.target.lerp(p,k);
    if(tl.segT>=1){ tl.seg=null; flyMode=null; setProg(tl.i); const c2=camFor(s); flyTo(c2.pos,c2.tgt,1300); tl.waitUntil=now+holdFor(s); } return; }
  if(tl.playing && now>tl.waitUntil){ if(!stepRel(1)){ togglePlay(false); } else if(!tl.seg){ tl.waitUntil=now+holdFor(STOPS[tl.i]); } } }
function holdFor(s){ const n=(s.s||[]).length; const base=tl.tour?2400+Math.min(1800,n*400):3800+Math.min(4000,n*900); const h=(base+(s.o.sphere?1200:0)+(tl.chapHold||0))/tl.speed; tl.chapHold=0; return h; }
$('tlTour').onclick=()=>toggleTour();
$('tlSpeed').onclick=()=>{ const L=[0.5,1,2,4]; setSpeed(L[(L.indexOf(tl.speed)+1)%L.length]); };
$('tourExit').onclick=()=>toggleTour(false);
$('tlPlay').onclick=()=>togglePlay(); $('tlPrev').onclick=()=>{ togglePlay(false); stepRel(-1); }; $('tlNext').onclick=()=>{ stepRel(1); };
$('tlDiary').onclick=()=>{ tl.diary=!tl.diary; $('tlDiary').setAttribute('aria-pressed',String(tl.diary)); if(tl.diary&&tl.i>=0) diaryCard(STOPS[tl.i]); else if(curCard&&curCard.type==='stop') closeInfo(); };
range.addEventListener('input',()=>{ togglePlay(false); const i=+range.value; tl.i=i; const s=STOPS[i]; updateUIForStop(s); setProg(i); token.g.visible=true; tokenLabel.on=true; token.g.position.copy(s.pos); });
range.addEventListener('change',()=>goStop(+range.value,{fast:true}));
// filtr knih
{ const box=$('eras'); for(const e of ERAS){ const b=document.createElement('button'); b.className='era'; b.textContent=e.key==='epilog'?'Ep.':e.key; b.title=e.kap+' – '+e.title+' ('+e.real+', '+e.dr+')'; b.style.setProperty('--c',e.col); b.setAttribute('aria-pressed','true');
    b.onclick=(ev)=>{ if(ev.shiftKey||ev.altKey){ eraOn.clear(); eraOn.add(e.key); } else if(eraOn.has(e.key)&&eraOn.size===1){ ERAS.forEach(x=>eraOn.add(x.key)); } else if(eraOn.size===ERAS.length){ eraOn.clear(); eraOn.add(e.key); } else { eraOn.has(e.key)?eraOn.delete(e.key):eraOn.add(e.key); if(!eraOn.size) ERAS.forEach(x=>eraOn.add(x.key)); } applyEraFilter(); }; box.appendChild(b); }
  const leg=$('legEras'); leg.innerHTML=ERAS.map(e=>`<li><i class="lg" style="background:${e.col};border-radius:3px"></i><span><b style="color:${e.col}">${esc(e.kap)}</b> – ${esc(e.title)} · ${esc(e.real)} · ${esc(e.dr)}</span></li>`).join(''); }
function applyEraFilter(){ document.querySelectorAll('#eras .era').forEach((b,i)=>b.setAttribute('aria-pressed',String(eraOn.has(ERAS[i].key)))); ERAS.forEach((e,i)=>routeU.uMask.value[i]=eraOn.has(e.key)?1:0);
  for(const o of placeObjs){ const on=(o.p.visits||[]).some(v=>eraOn.has(v.era)); o.L.el.classList.toggle('dim',!on); }
  for(const s of SPHERES){ const on=(s.visits||[]).some(v=>eraOn.has(v.era)); s._o.L.el.style.opacity=on?'':'0.3'; }
  for(const o of battleObjs){ const on=o.b.bg||!o.b.era||eraOn.has(o.b.era); o.on=on; o.g.visible=on; o.L.on=on; }
  if(moodWant==='auto' && eraOn.size===1){ setMood(ERA[[...eraOn][0]].mood); }
  buildTicks(); }

// ================================================================ hledání
const SIDX=[]; for(const p of PLACES) SIDX.push({t:p.name, s:p.region+' · '+p.kind, k:p.id, n:norm(p.name+' '+p.region)}); for(const s of SPHERES) SIDX.push({t:s.name, s:'sféra', k:s.id, n:norm(s.name+' sfera')});
for(const b of BATTLES) SIDX.push({t:b.name, s:'bitva · '+b.dr+' DR', k:b.id, n:norm(b.name+' '+b.place)}); for(const w of WITS) SIDX.push({t:w.name, s:'svědectví · '+w.role, k:w.id, n:norm(w.name+' '+w.role)});
STOPS.forEach(s=>{ for(const sid of s.s||[]){ const S=SES[sid]; if(S&&!SIDX.find(x=>x.sid===sid)) SIDX.push({t:S.t, s:'sezení · '+S.d, stop:s.i, sid, n:norm(S.t+' '+S.d)}); } });
for(const L of Object.keys(EGGNOTE)) SIDX.push({t:L, s:'ze hry', egg:L, n:norm(L)});
{ const q=$('q'), ul=$('qList'); let res=[], sel=0;
  const render=()=>{ ul.innerHTML=res.map((r,i)=>`<li role="option" aria-selected="${i===sel}" data-i="${i}"><span>${esc(r.t)}</span><small>${esc(r.s.slice(0,40))}</small></li>`).join(''); ul.hidden=!res.length; q.setAttribute('aria-expanded',String(!!res.length)); };
  const go=r=>{ if(!r) return; togglePlay(false); ul.hidden=true; q.blur(); q.value=r.t; if(r.stop!=null) goStop(r.stop,{fly:true}); else if(r.egg){ openNote(r.egg); } else openAny(r.k,true); };
  q.addEventListener('input',()=>{ const v=norm(q.value.trim()); sel=0; if(v.length<2){ res=[]; render(); return; } const W=v.split(/\s+/); res=SIDX.map(x=>[x, W.every(w=>x.n.includes(w))?(x.n.startsWith(W[0])?0:1)+(x.sid?1:0):9]).filter(a=>a[1]<9).sort((a,b)=>a[1]-b[1]).slice(0,14).map(a=>a[0]); render(); });
  q.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'){ sel=Math.min(res.length-1,sel+1); render(); e.preventDefault(); } else if(e.key==='ArrowUp'){ sel=Math.max(0,sel-1); render(); e.preventDefault(); } else if(e.key==='Enter'){ go(res[sel]); } else if(e.key==='Escape'){ ul.hidden=true; q.blur(); } });
  ul.addEventListener('mousedown',e=>{ const li=e.target.closest('li'); if(li){ e.preventDefault(); go(res[+li.dataset.i]); } });
  q.addEventListener('blur',()=>setTimeout(()=>ul.hidden=true,150)); }

// ================================================================ měření vzdálenosti
let measuring=false; const mPts=[]; let mLine=null; const mMarks=[];
{ const opts=PLACES.slice().sort((a,b)=>a.name.localeCompare(b.name,'cs')).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(''); $('mFrom').insertAdjacentHTML('beforeend',opts); $('mTo').insertAdjacentHTML('beforeend',opts); }
function toggleMeasure(){ measuring=!measuring; document.body.classList.toggle('measuring',measuring); $('btnMeasure').setAttribute('aria-pressed',String(measuring)); $('measure').hidden=!measuring; if(!measuring) clearMeasure(); else closeProbe(); }
function clearMeasure(){ mPts.length=0; $('mFrom').value=''; $('mTo').value=''; drawMeasure(); }
function pickMeasure(p){ if(mPts.length>=2) mPts.length=0; mPts.push({x:p.x,z:p.z,name:p.name,id:p.id}); $('mFrom').value=mPts[0]&&mPts[0].id||''; $('mTo').value=mPts[1]&&mPts[1].id||''; drawMeasure(); }
$('mFrom').onchange=()=>{ const p=BYID[$('mFrom').value]; mPts[0]=p?{x:p.x,z:p.z,name:p.name,id:p.id}:undefined; if(!p) mPts.length=0; drawMeasure(); };
$('mTo').onchange=()=>{ const p=BYID[$('mTo').value]; if(!mPts[0]){ return; } mPts[1]=p?{x:p.x,z:p.z,name:p.name,id:p.id}:undefined; if(!p) mPts.length=1; drawMeasure(); };
$('measureClear').onclick=clearMeasure; $('btnMeasure').onclick=toggleMeasure;
function drawMeasure(){ if(mLine){ scene.remove(mLine); mLine.geometry.dispose(); mLine=null; } for(const m of mMarks) scene.remove(m); mMarks.length=0;
  const P=mPts.filter(Boolean); for(const p of P){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,10,10), new THREE.MeshBasicMaterial({color:0xc9a54a})); m.position.set(p.x,ground(p.x,p.z)+5,p.z); scene.add(m); mMarks.push(m); }
  if(P.length<2){ $('measureTxt').innerHTML=P.length?`Od <b>${esc(P[0].name)}</b> – vyber cíl.`:'Vyber dvě místa, klepni na popisky, nebo dvakrát do mapy.'; return; }
  const A=P[0], Bp=P[1], d=Math.hypot(Bp.x-A.x,Bp.z-A.z), mi=d*MPU; const pts=[]; for(let k=0;k<=64;k++){ const t=k/64, x=A.x+(Bp.x-A.x)*t, z=A.z+(Bp.z-A.z)*t; pts.push(new THREE.Vector3(x, Math.max(ground(x,z),0)+2+Math.sin(t*Math.PI)*Math.min(60,d*0.12), z)); }
  mLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({color:0xc9a54a, dashSize:4, gapSize:3, depthTest:false, transparent:true})); mLine.computeLineDistances(); mLine.renderOrder=9; scene.add(mLine);
  const r5=v=>v<50?Math.round(v):Math.round(v/10)*10;
  $('measureTxt').innerHTML=`<b>${esc(A.name)}</b> → <b>${esc(Bp.name)}</b>: vzdušnou čarou <b>≈ ${cz(r5(mi))} mil</b> (≈ ${cz(r5(mi*1.609))} km)<br>pěšky 24 mil/den <b>≈ ${cz(Math.max(1,Math.round(mi/24)))} dní</b> · na koni ≈ ${cz(Math.max(1,Math.round(mi/40)))} · lodí ≈ ${cz(Math.max(1,Math.round(mi/96)))} · létající lodí ≈ ${cz(Math.max(1,Math.round(mi/192)))}`; }

// ================================================================ sonda: výška a krajina po klepnutí do mapy
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let probeP=null; const probeEl=$('probe');
const terrMeshes=[]; scene.traverse(o=>{ if(o.name==='terrain') terrMeshes.push(o); });
function pickGround(cx,cy){ const r=canvas.getBoundingClientRect(); ndc.set((cx-r.left)/r.width*2-1, -((cy-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(terrMeshes,false)[0]; let p=hit?hit.point:null; const tw=-ray.ray.origin.y/ray.ray.direction.y; if(tw>0){ const wp=ray.ray.origin.clone().addScaledVector(ray.ray.direction,tw); if(!p||wp.distanceTo(ray.ray.origin)<p.distanceTo(ray.ray.origin)) p=wp; } return p; }
function terrKind(x,z){ const h=hAt(x,z); if(h<0) return h<-1.5?'moře':'pobřežní mělčina'; const m=maskAt(x,z); if(m[3]>0.45) return 'ledovec'; if(m[2]>0.45) return h>16?'velehory':'hory a vrchoviny'; if(m[1]>0.45) return 'poušť'; if(m[0]>0.45) return 'les'; return h>2.4?'pahorkatina':'roviny'; }
function showProbe(p){ probeP=p; const x=p.x, z=p.z, h=hAt(x,z); let best=null, bd=1e9; for(const q of PLACES){ const d=Math.hypot(q.x-x,q.z-z); if(d<bd){ bd=d; best=q; } }
  const m=h>0?Math.round(h*130/50)*50:0; probeEl.innerHTML=`<span class="x">×</span>${h>0?`Výška <b>≈ ${cz(m)} m n. m.</b>`:'<b>Hladina moře</b>'} · ${terrKind(x,z)}<br>${best?`Nejbližší místo kampaně: <b>${esc(best.name)}</b>, ≈ ${cz(Math.round(bd*MPU/5)*5)} mil`:''}`; probeEl.hidden=false; positionProbe(); }
function positionProbe(){ if(!probeP) return; vtmp.copy(probeP).project(camera); if(vtmp.z>1){ probeEl.style.opacity='0'; return; } probeEl.style.opacity='1'; const w=canvas.clientWidth, h=canvas.clientHeight; const x=clamp((vtmp.x*0.5+0.5)*w+12,8,w-probeEl.offsetWidth-8), y=clamp((-vtmp.y*0.5+0.5)*h-probeEl.offsetHeight-12,70,h-probeEl.offsetHeight-8); probeEl.style.transform=`translate(${x}px,${y}px)`; }
function closeProbe(){ probeP=null; probeEl.hidden=true; }
probeEl.onclick=closeProbe;
{ let down=null; canvas.addEventListener('pointerdown',e=>{ down={x:e.clientX,y:e.clientY,t:performance.now()}; anim=null; flyMode=null; if(tl.playing) togglePlay(false); });
  canvas.addEventListener('pointerup',e=>{ if(!down) return; const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y), dt=performance.now()-down.t; down=null; if(moved>6||dt>600) return;
    const p=pickGround(e.clientX,e.clientY); if(!p) return;
    if(measuring){ if(mPts.length>=2) mPts.length=0; mPts.push({x:p.x,z:p.z,name:mPts.length?'bod B':'bod A'}); drawMeasure(); return; }
    showProbe(p); }); }
canvas.addEventListener('wheel',()=>{ anim=null; flyMode=null; },{passive:true});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

// ================================================================ zvuk (smyčky převzaté z Desetiměstí: vítr, bouře, moře, přístav, město, hudba)
const SND={on:false, ctx:null, g:{}, loading:false};
async function startSound(){ if(SND.loading) return; SND.loading=true; try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); SND.ctx=ctx; SND.master=ctx.createGain(); SND.master.gain.value=0.85; SND.master.connect(ctx.destination);
    for(const k of ['music','musiccity','musicwild','wind','sea','harbor','town','storm']){ const buf=await ctx.decodeAudioData(await getBin('assets/sounds/'+k+'.mp3')); const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true; const g=ctx.createGain(); g.gain.value=0; src.connect(g); g.connect(SND.master); src.start(); SND.g[k]=g; } }
  catch(e){ SND.on=false; $('btnSound').setAttribute('aria-pressed','false'); } SND.loading=false; }
$('btnSound').onclick=()=>{ SND.on=!SND.on; $('btnSound').setAttribute('aria-pressed',String(SND.on)); if(SND.on && !SND.ctx) startSound(); else if(SND.ctx) (SND.on?SND.ctx.resume():SND.ctx.suspend()); };
function updateSound(){ if(!SND.on||!SND.ctx) return; const tx=controls.target.x, tz=controls.target.z, h=hAt(tx,tz), close=1-smooth(80,900,camD);
  let city=0; for(const o of placeObjs){ if(o.p.kind!=='město') continue; const d=Math.hypot(o.p.x-tx,o.p.z-tz); city=Math.max(city,1-smooth(4,40,d)); }
  const m=maskAt(tx,tz), sea=h<0?1:smooth(2,0,h)*0.6, storm=(moodCur.cl>0.85||moodCur.night>0.3&&moodCur.cl>0.7)?0.5:0;
  const tgt={music:0.16*(1-close*0.5), musiccity:0.22*city*close, musicwild:0.14*(1-city)*close, wind:(0.08+0.3*Math.max(m[2],m[1],smooth(400,1600,camD)))*(1-sea*0.5), sea:0.45*sea*(0.4+close*0.6), harbor:0.3*city*sea*close, town:0.4*city*close, storm};
  for(const k in SND.g) SND.g[k].gain.setTargetAtTime(tgt[k]||0, SND.ctx.currentTime, 0.9); }

// ================================================================ ostatní ovládání
document.querySelectorAll('#views [data-view]').forEach(b=>b.onclick=()=>{ togglePlay(false); flyView(b.dataset.view); });
$('btnLegend').onclick=()=>{ $('legend').hidden=false; $('legClose').focus(); }; $('legClose').onclick=()=>$('legend').hidden=true; $('legend').addEventListener('click',e=>{ if(e.target.id==='legend') $('legend').hidden=true; });
$('btnFull').onclick=()=>{ const d=document; if(d.fullscreenElement||d.webkitFullscreenElement){ (d.exitFullscreen||d.webkitExitFullscreen).call(d); } else { const el=d.documentElement; const f=el.requestFullscreen||el.webkitRequestFullscreen; if(f) f.call(el).catch(()=>{ window.open(location.href,'_blank'); }); else window.open(location.href,'_blank'); } };
if(IN_FRAME){ $('btnBack').title='Otevřít mapu samostatně'; $('btnBack').href='index.html'+location.hash; $('btnBack').target='_blank'; $('btnBack').querySelector('em').textContent='Samostatně'; $('btnBack').querySelector('span').textContent='↗'; }
$('mood').value='auto'; $('mood').onchange=e=>{ moodWant=e.target.value; if(moodWant==='auto') setMood(tl.i>=0?ERA[STOPS[tl.i].era].mood:'day'); else setMood(moodWant); };
$('quality').value=QPREF; $('quality').onchange=e=>{ try{ localStorage.setItem('mapa3d-q',e.target.value); }catch(_){} const u=new URL(location.href); u.searchParams.delete('q'); location.href=u.toString(); };
$('tLabels').onchange=e=>document.body.classList.toggle('hideLabels',!e.target.checked);
$('tRoute').onchange=e=>{ routeMesh.visible=e.target.checked; };
$('tWit').onchange=e=>{ document.body.classList.toggle('noWit',!e.target.checked); for(const L of witLabels) L.on=e.target.checked; };
$('tEggs').onchange=e=>{ eggsOn=e.target.checked; document.body.classList.toggle('noEggs',!eggsOn); };
let eggsOn=true;
window.addEventListener('keydown',e=>{ const tag=e.target.tagName; if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return; const k=e.key.toLowerCase();
  if(['w','a','s','d','q','e','r','f','arrowup','arrowdown','arrowleft','arrowright','+','-','='].includes(k)&&!(k==='f'&&e.shiftKey)){ if(k==='f'&&!keys.size&&e.repeat===false&&false){} keys.add(k); anim=null; flyMode=null; e.preventDefault(); }
  if(k===' '){ togglePlay(); e.preventDefault(); } else if(k===','){ togglePlay(false); stepRel(-1); } else if(k==='.'){ stepRel(1); } else if(k==='/'){ $('q').focus(); e.preventDefault(); }
  else if(k==='t'){ toggleTour(); }
  else if(k==='m'){ toggleMeasure(); } else if(k==='z'){ $('btnSound').click(); } else if(k==='home'){ flyView('all'); } else if(k==='?'){ $('btnLegend').click(); }
  else if(k==='escape'){ if(tl.tour){ toggleTour(false); } else if(!$('lightbox').hidden){ $('lightbox').hidden=true; } else if(!$('legend').hidden){ $('legend').hidden=true; } else if(!info.hidden) closeInfo(); else if(measuring) toggleMeasure(); else closeProbe(); } });
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase())); window.addEventListener('blur',()=>keys.clear());

// ---------------------------------------------------------------- odkazy do mapy (#p=…, #b=…, #w=…, #s=…, #krok=…, #era=…; i holé #s-… a #b-… jako v kronice)
let hashLock=false;
function setHash(h){ hashLock=true; try{ history.replaceState(null,'','#'+h); }catch(e){} setTimeout(()=>hashLock=false,50); }
function readHash(){ const h=decodeURIComponent(location.hash.slice(1)); if(!h) return false; const [k,v]=h.includes('=')?h.split('='):[h.startsWith('s-')?'s':h.startsWith('b-')?'b':'p',h];
  if(k==='p'&&BYID[v]){ openPlace(BYID[v],true); return true; } if(k==='b'&&BATT[v]){ openBattle(BATT[v],true); return true; } if(k==='w'&&WIT[v]){ openWitness(WIT[v],true); return true; }
  if(k==='s'){ const s=STOPS.find(x=>(x.s||[]).includes(v)); if(s){ goStop(s.i,{fly:true}); return true; } const p=PLACES.find(q=>(q.sessions||[]).includes(v)); if(p){ openPlace(p,true); return true; } }
  if(k==='krok'){ goStop(+v-1,{fly:true}); return true; } if(k==='prelet'||h==='prelet'){ setTimeout(()=>toggleTour(true),900); return true; }
  if(k==='ch'){ const s=STOPS.find(x=>x.ch===v); if(s){ goStop(s.i,{fly:true}); return true; } } if(k==='era'&&ERA[v]){ eraOn.clear(); eraOn.add(v); applyEraFilter(); return false; } return false; }
window.addEventListener('hashchange',()=>{ if(!hashLock) readHash(); });

// ================================================================ výkon: rozlišení podle snímků za sekundu (z původní mapy)
const PERF={max:Math.min(window.devicePixelRatio||1, HQ?2:1.5), pr:0, acc:0, n:0, good:0, t0:performance.now()}; PERF.pr=PERF.max; PERF.min=Math.min(PERF.max, HQ?0.85:0.65);
function perfStep(d){ if(d>0.4||performance.now()-PERF.t0<6000) return; PERF.acc+=d; if(++PERF.n<50) return; const avg=PERF.acc/PERF.n; PERF.acc=0; PERF.n=0; PERF.fps=1/avg;
  if(avg>1/27 && PERF.pr>PERF.min){ PERF.pr=Math.max(PERF.min,PERF.pr-0.25); PERF.good=0; renderer.setPixelRatio(PERF.pr); }
  else if(avg<1/52 && PERF.pr<PERF.max){ if(++PERF.good>=6){ PERF.pr=Math.min(PERF.max,PERF.pr+0.25); PERF.good=0; renderer.setPixelRatio(PERF.pr); } } else PERF.good=0; }
window.__perf=()=>({pr:PERF.pr,fps:PERF.fps,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,hq:HQ,anim:!!anim,camD:Math.round(camD),lod:terrLOD,frame:frameN});
window.__map={ scene, renderer, toggleTour, setSpeed, goStop, openPlace:(id)=>openPlace(BYID[id],true), openBattle:(id)=>openBattle(BATT[id],true), openWitness:(id)=>openWitness(WIT[id],true), flyView, togglePlay, camera, controls, setMood:(m)=>{ moodWant=m; setMood(m); }, toggleMeasure, pickMeasure:(a)=>pickMeasure(BYID[a]), flyTo:(p,t,d)=>flyTo(v3(p),v3(t),d), tl, buildArmy:()=>battleObjs.forEach(buildArmy) };

// ================================================================ smyčka
const SNI={ scale:$('scaleTxt'), bar:$('scaleBar') };
const NICE=[1,2,5,10,20,50,100,200,500,1000,2000];
function updateScale(){ const px=canvas.clientHeight/(2*Math.tan(camera.fov*Math.PI/360)*camD); let best=NICE[0]; for(const n of NICE) if(n*px/MPU<=140) best=n; SNI.bar.style.width=(best/MPU*px).toFixed(0)+'px'; SNI.scale.textContent=cz(best)+(best===1?' míle':best<5?' míle':' mil'); }
function resize(){ const w=innerWidth, h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov=w<h?58:45; camera.updateProjectionMatrix(); updateLabels(true); }
window.addEventListener('resize',resize); resize();
const clock=new THREE.Clock(); let t=0, frameN=0; const _dm=new THREE.Object3D();
function frame(){
  const rawdt=clock.getDelta(), dt=Math.min(0.05,rawdt); t+=dt; frameN++; perfStep(rawdt); const now=performance.now();
  stepAnim(now); stepKeys(dt); stepTour(now,dt); controls.update();
  controls.target.x=clamp(controls.target.x,-320,W0+260); controls.target.z=clamp(controls.target.z,-120,H0+120); controls.target.y=clamp(controls.target.y,-2,110);
  if(camD<120 && !anim && !tl.seg){ const gy=ground(controls.target.x,controls.target.z); if(controls.target.y<60) controls.target.y+=(gy-controls.target.y)*0.08; }
  const gh=Math.max(hAt(camera.position.x,camera.position.z),0)+1.2; if(camera.position.y<gh) camera.position.y=gh;
  camD=camera.position.distanceTo(controls.target);
  camera.near=clamp(camD*0.012,0.2,40); camera.far=camD*5+9000; camera.updateProjectionMatrix();
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  stepMood(dt); applyLook();
  waterU.uTime.value=t; terrU.uTime.value=t; routeU.uTime.value=REDUCED?0:t; routeU.uDim.value=(tl.i<0&&!tl.playing)?1:0; routeU.uCam.value.copy(camera.position);
  // terén: z dálky (celek) poloviční rozlišení sítě – všechny dlaždice najednou, takže nevzniknou švy
  if(frameN%10===0) setTerrainLOD(camD>(HQ?780:520)?'lo':'hi');
  // stromy jen zblízka
  TREES.im.visible=camD<(HQ?520:300); if(TREES.im.visible){ const f=camD<200?1:camD<360?0.6:0.35; TREES.im.count=Math.ceil(TREES.n*f); }
  for(const c of CLOUDS){ c.position.x=((c.userData.base+t*c.userData.vx)%(W0+600))-300; }
  // značky míst: modely se nahrávají, když se kamera přiblíží
  if(frameN%15===0){ const tx=controls.target.x, tz=controls.target.z, R=Math.max(camD*1.6,60), LIM=HQ?950:520;
    for(const o of placeObjs){ const d=Math.hypot(o.p.x-tx,o.p.z-tz); const near=d<R && camD<LIM; if(near) ensurePlaceModel(o); o.g.visible=camD<(HQ?1600:900) || o.p.name==='Thultanthar'; if(near && camD<260 && d<camD*1.2) decorate(o); if(o.deco) o.deco.visible=camD<320; }
    for(const o of battleObjs){ const d=camera.position.distanceTo(o.g.position); if(o.on!==false){ o.g.visible=d<(o.top?2600:1500); } if(d<(o.top?260:160) && o.g.visible){ buildArmy(o); o.army.visible=true; } else o.army.visible=false; }
    pins.material.size=(HQ?13:11)*(camD>900?0.85:1); }
  for(const o of battleObjs){ if(!o.g.visible) continue; o.sw.rotation.y=t*0.5; o.sw.position.y+=Math.sin(t*1.5)*0.004; o.gl.material.opacity=(o.top?0.6:0.38)+Math.sin(t*2+o.g.position.x)*0.12;
    if(o.army.visible){ const dm=_dm; const ims=new Set(); o.men.forEach((h,i)=>{ const ph=t*3.4+i*1.7; dm.position.set(h.p.x, h.p.y+Math.abs(Math.sin(ph))*0.12, h.p.z); dm.rotation.set(Math.sin(ph)*0.06, h.ry+Math.sin(ph*0.5)*0.12, 0); dm.scale.setScalar(0.9); dm.updateMatrix(); h.im.setMatrixAt(h.i, dm.matrix); ims.add(h.im); });
      ims.forEach(im=>im.instanceMatrix.needsUpdate=true); o.flags.forEach((f,i)=>wave(f,t,i)); } }
  for(const s of sphereObjs){ s.g.position.y=s.s.y+Math.sin(t*0.5+s.ph)*1.2; s.portal.rotation.z=t*0.3; s.portal.material.opacity=0.45+0.3*Math.sin(t*1.2+s.ph); if(s.ic.userData.moons) s.ic.children.forEach(m=>{ if(m.userData.orb!=null){ const a=m.userData.orb+t*0.4; m.position.set(Math.cos(a)*2.6,3.4+Math.sin(a*2)*0.4,Math.sin(a)*2.6); } }); }
  if(THUL) THUL.anim(t);
  for(const e of eggs){ const v=eggsOn&&camera.position.distanceTo(e.g.position)<e.max; e.g.visible=v; if(v&&e.anim) e.anim(t); }
  if(token.g.visible){ const s=clamp(camera.position.distanceTo(token.g.position)*0.012,0.8,14); token.g.scale.setScalar(s); wave(token.bn.userData.flag,t); token.ring.rotation.z=t; token.gl.material.opacity=0.55+0.2*Math.sin(t*3); }
  for(const b of beams){ if(b.m.material.opacity>0){ b.m.rotation.y=t; } }
  for(const m of mMarks) m.scale.setScalar(clamp(camD*0.006,0.5,8));
  renderer.render(scene, camera);
  updateLabels(); positionProbe(); if(frameN%15===0) updateSound(); if(frameN%10===0) updateScale();
  requestAnimationFrame(frame);
}

// ================================================================ start
prog('Hotovo');
buildTicks(); applyEraFilter();
$('tlCap').innerHTML=`<span class="w">${STOPS.length} zastávek výpravy, ${PLACES.length} míst, ${SPHERES.length} sfér, ${BATTLES.length} bitev. Stiskni ▶ nebo klepni na místo.</span>`;
setMood('day'); Object.assign(moodCur, MOODS.day);
requestAnimationFrame(frame);
renderer.compile(scene,camera);
setTimeout(()=>{ ld.el.classList.add('done'); setTimeout(()=>ld.el.remove(),1000); }, 250);
if(!readHash()){ flyView('all'); if(anim) anim.dur=REDUCED?0:2600; }
window.__ready=true;
