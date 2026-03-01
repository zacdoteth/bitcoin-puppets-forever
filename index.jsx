import { useState, useEffect, useRef } from "react";

const O = "#F7931A";
const CREAM = "#f5e6c8";
const DARK = "#110d07";
const PINK = "#FF69B4";

const ALL_NFTS = [
  { id:1,name:"Puppet #5555",price:0.009,rarity:"Common",traits:["Beanie","Coffee Time","Sign: LFG"],col:"Puppets" },
  { id:2,name:"Puppet #9999",price:0.011,rarity:"Common",traits:["Cap","Smile","Two Chairs"],col:"Puppets" },
  { id:3,name:"Puppet #8888",price:0.012,rarity:"Common",traits:["Banana","Sign: gm"],col:"Puppets" },
  { id:4,name:"Puppet #4201",price:0.015,rarity:"Legendary",traits:["Bong","Halo","Laser Eyes"],col:"Puppets" },
  { id:5,name:"Puppet #6969",price:0.018,rarity:"Rare",traits:["Coffee Mug","Two Chairs","Sign: bj"],col:"Puppets" },
  { id:6,name:"Puppet #1234",price:0.019,rarity:"Rare",traits:["Sunglasses","Pink Pipe"],col:"Puppets" },
  { id:7,name:"Puppet #3333",price:0.022,rarity:"Rare",traits:["Headband","Bong"],col:"Puppets" },
  { id:8,name:"Puppet #1337",price:0.025,rarity:"Epic",traits:["Middle Finger","Fire","Alien"],col:"Puppets" },
  { id:9,name:"Puppet #2024",price:0.031,rarity:"Epic",traits:["Bitcoin Hat","Cigar"],col:"Puppets" },
  { id:10,name:"Puppet #7777",price:0.034,rarity:"Epic",traits:["Diamond Hands","Halo"],col:"Puppets" },
  { id:11,name:"Puppet #777",price:0.042,rarity:"Mythic",traits:["Crown","Diamond Hands","Pink Pipe"],col:"Puppets" },
  { id:12,name:"Puppet #100",price:0.055,rarity:"Legendary",traits:["Crown","World Peace"],col:"Puppets" },
  { id:13,name:"Puppet #42",price:0.088,rarity:"Mythic",traits:["Alien","Laser Eyes","Crown"],col:"Puppets" },
  { id:14,name:"O.P.I.U.M. #420",price:0.157,rarity:"Genesis",traits:["Cursed","World Peace"],col:"OPIUM" },
  { id:15,name:"O.P.I.U.M. #69",price:0.210,rarity:"Genesis",traits:["Gold","OG"],col:"OPIUM" },
  { id:16,name:"O.P.I.U.M. #7",price:0.320,rarity:"Genesis",traits:["Rainbow","1/1"],col:"OPIUM" },
];

const IDLE=["Welcome to the Bitcoin Puppet Shed. Click a puppet below...","10,001 hand-drawn puppets. MS Paint. Inscribed forever.","Magic Eden abandoned Ordinals. The Shed never closes.","Every trade feeds the treasury. WE ALL RISE.","O.P.I.U.M. — 777 hand puppets. The pink pipe calls...","Two chairs. Coffee time. World peace. ☮️"];
const NL={Genesis:["Only 777 O.P.I.U.M. exist. A true masterpiece.","The pink pipe. Pure O.P.I.U.M."],Mythic:["Among the rarest in the land!","Few have owned a Mythic."],Legendary:["Legendary. Changes a whole collection.","The greats. This one among them."],Epic:["An epic find! *chef's kiss*","THIS one has character."],Rare:["A rare gem. Smart collectors know.","Not everyone sees it. But you do."],Common:["Every collection starts somewhere.","Don't sleep on Commons."]};
const rarCol=r=>({Common:"#888",Rare:"#4aa3ff",Epic:"#a855f7",Legendary:O,Mythic:"#ff4488",Genesis:"#ff6b2b"}[r]||"#888");

function puppetSVG(seed){
  const bgH=(seed*47+20)%360,fH=(seed*73+120)%360,mt=seed%3,acc=seed%5;
  let mouth=mt===0?`<ellipse cx="50" cy="63" rx="15" ry="9" fill="#111" stroke="#000" stroke-width="1.5"/><rect x="39" y="59" width="6" height="5" rx="1" fill="#fff"/><rect x="47" y="59" width="6" height="5" rx="1" fill="#fff"/><rect x="55" y="59" width="6" height="5" rx="1" fill="#fff"/><ellipse cx="50" cy="67" rx="7" ry="3.5" fill="#e44060"/>`:mt===1?`<path d="M35 59 Q50 78 65 59 Q50 68 35 59Z" fill="#111" stroke="#000" stroke-width="1.5"/>`:`<circle cx="50" cy="63" r="10" fill="#111" stroke="#000" stroke-width="1.5"/><rect x="44" y="56" width="5" height="5" rx="1" fill="#fff"/><rect x="51" y="56" width="5" height="5" rx="1" fill="#fff"/><ellipse cx="50" cy="68" rx="6" ry="3" fill="#e44060"/>`;
  let a=acc===0?`<rect x="30" y="14" width="40" height="7" rx="2" fill="hsl(${(fH+180)%360},60%,45%)"/><rect x="36" y="0" width="28" height="16" rx="3" fill="hsl(${(fH+180)%360},60%,45%)"/>`:acc===1?`<rect x="30" y="82" width="40" height="14" rx="2" fill="#f5e6c8" stroke="#8B6332" stroke-width="1.2"/><text x="50" y="93" text-anchor="middle" font-size="9" font-weight="bold" fill="#333" font-family="monospace">${["bj","gm","LFG","☮️","♡"][seed%5]}</text>`:acc===2?`<rect x="30" y="38" width="16" height="9" rx="2" fill="#222"/><rect x="54" y="38" width="16" height="9" rx="2" fill="#222"/><rect x="46" y="42" width="8" height="2" fill="#222"/>`:acc===3?`<circle cx="50" cy="16" r="10" fill="none" stroke="gold" stroke-width="2"/>`:""
  const eyes=acc===2?"":`<circle cx="42" cy="44" r="8" fill="#fff" stroke="#000" stroke-width="1.5"/><circle cx="58" cy="44" r="8" fill="#fff" stroke="#000" stroke-width="1.5"/><circle cx="43.5" cy="45" r="3.5" fill="#000"/><circle cx="56.5" cy="43.5" r="3.5" fill="#000"/><circle cx="45" cy="42" r="1.5" fill="#fff"/><circle cx="58" cy="41" r="1.5" fill="#fff"/>`;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="4" fill="hsl(${bgH},55%,72%)"/><circle cx="50" cy="56" r="36" fill="hsl(${(bgH+30)%360},45%,62%)"/><circle cx="50" cy="48" r="25" fill="hsl(${fH},65%,50%)" stroke="#000" stroke-width="1.8"/><ellipse cx="30" cy="35" rx="7" ry="9" fill="hsl(${fH},55%,40%)" stroke="#000" stroke-width="1.3"/><ellipse cx="70" cy="35" rx="7" ry="9" fill="hsl(${fH},55%,40%)" stroke="#000" stroke-width="1.3"/>${eyes}<circle cx="47" cy="53" r="1.5" fill="hsl(${fH},50%,35%)"/><circle cx="53" cy="53" r="1.5" fill="hsl(${fH},50%,35%)"/>${mouth}${a}</svg>`)}`;
}

function useTypewriter(text){const[d,setD]=useState("");const[done,setDone]=useState(false);useEffect(()=>{setD("");setDone(false);let i=0;const iv=setInterval(()=>{i++;setD(text.slice(0,i));if(i>=text.length){setDone(true);clearInterval(iv);}},22);return()=>clearInterval(iv);},[text]);return{displayed:d,done};}
function Countdown(){const[t,setT]=useState({d:0,h:0,m:0,s:0});useEffect(()=>{const tgt=new Date("2026-03-09T00:00:00Z");const tick=()=>{const d=Math.max(0,tgt-Date.now());setT({d:Math.floor(d/864e5),h:Math.floor((d%864e5)/36e5),m:Math.floor((d%36e5)/6e4),s:Math.floor((d%6e4)/1e3)});};tick();const i=setInterval(tick,1000);return()=>clearInterval(i);},[]);return <div style={{display:"flex",gap:4}}>{[["D",t.d],["H",t.h],["M",t.m],["S",t.s]].map(([l,v])=>(<div key={l} style={{textAlign:"center",padding:"2px 5px",background:"rgba(255,50,50,0.1)",borderRadius:3,minWidth:26}}><div style={{fontSize:"0.75rem",fontWeight:700,color:"#ff4444",fontFamily:"monospace",lineHeight:1.2}}>{String(v).padStart(2,"0")}</div><div style={{fontSize:"0.2rem",color:"rgba(255,100,100,0.35)"}}>{l}</div></div>))}</div>;}

/* WALL: HORIZONTAL planks (shiplap) — grain runs left→right */
function WoodWall(){
  const pH=52, W=800, count=8;
  const cfgs=[
    {seed:5, bf:"0.015 0.25",oct:8,cm:"0.5 0.12 0 0 0.12  0.25 0.16 0 0 0.06  0.08 0.03 0 0 0.01  0 0 0 1 0",ss:1,dc:0.7,lc:"#FFD080"},
    {seed:22,bf:"0.012 0.22",oct:7,cm:"0.45 0.1 0 0 0.14  0.22 0.14 0 0 0.07  0.07 0.03 0 0 0.02  0 0 0 1 0",ss:1.2,dc:0.65,lc:"#FFD890"},
    {seed:41,bf:"0.018 0.28",oct:6,cm:"0.55 0.14 0 0 0.1  0.28 0.18 0 0 0.05  0.09 0.04 0 0 0.01  0 0 0 1 0",ss:0.9,dc:0.72,lc:"#FFD070"},
  ];
  return (
    <svg viewBox={`0 0 ${W} ${count*pH}`} preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
      <defs>
        {cfgs.map((c,i)=>(
          <filter key={i} id={`wh${i}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={c.bf} numOctaves={c.oct} seed={c.seed} result="n"/>
            <feColorMatrix type="matrix" in="n" result="w" values={c.cm}/>
            <feDiffuseLighting in="n" result="l" lightingColor={c.lc} surfaceScale={c.ss} diffuseConstant={c.dc}>
              <feDistantLight azimuth="200" elevation="55"/>
            </feDiffuseLighting>
            <feComposite in="l" in2="w" operator="arithmetic" k1="0.3" k2="0.6" k3="0.4" k4="-0.1"/>
          </filter>
        ))}
      </defs>
      {Array.from({length:count}).map((_,i)=>{
        const y=i*pH;
        return (
          <g key={i}>
            <rect x="0" y={y} width={W} height={pH-2} filter={`url(#wh${i%3})`}/>
            <rect x="0" y={y+pH-2} width={W} height="3" fill="rgba(0,0,0,0.35)"/>
            <rect x="0" y={y} width={W} height="1" fill="rgba(255,230,180,0.04)"/>
          </g>
        );
      })}
    </svg>
  );
}

/* FLOOR: VERTICAL planks (running into screen) — grain runs top→bottom */
function WoodFloor(){
  const pW=65, H=300, count=12;
  const cfgs=[
    {seed:2, bf:"0.28 0.018",oct:8,cm:"0.6 0.15 0 0 0.15  0.3 0.2 0 0 0.08  0.1 0.05 0 0 0.02  0 0 0 1 0",ss:1.5,dc:0.8,lc:"#FFE0A0"},
    {seed:15,bf:"0.25 0.015",oct:7,cm:"0.55 0.15 0 0 0.13  0.28 0.18 0 0 0.07  0.08 0.04 0 0 0.01  0 0 0 1 0",ss:1.2,dc:0.75,lc:"#FFD890"},
    {seed:31,bf:"0.3 0.02", oct:7,cm:"0.65 0.18 0 0 0.12  0.32 0.22 0 0 0.06  0.12 0.06 0 0 0.02  0 0 0 1 0",ss:1.8,dc:0.7,lc:"#FFE8B0"},
  ];
  return (
    <svg viewBox={`0 0 ${count*pW} ${H}`} preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
      <defs>
        {cfgs.map((c,i)=>(
          <filter key={i} id={`fv${i}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={c.bf} numOctaves={c.oct} seed={c.seed} result="n"/>
            <feColorMatrix type="matrix" in="n" result="w" values={c.cm}/>
            <feDiffuseLighting in="n" result="l" lightingColor={c.lc} surfaceScale={c.ss} diffuseConstant={c.dc}>
              <feDistantLight azimuth="235" elevation="50"/>
            </feDiffuseLighting>
            <feComposite in="l" in2="w" operator="arithmetic" k1="0.4" k2="0.7" k3="0.3" k4="-0.1"/>
          </filter>
        ))}
      </defs>
      {Array.from({length:count}).map((_,i)=>{
        const x=i*pW;
        return (
          <g key={i}>
            <rect x={x} y="0" width={pW-2} height={H} filter={`url(#fv${i%3})`}/>
            <rect x={x+pW-2} y="0" width="3" height={H} fill="rgba(0,0,0,0.4)"/>
            <rect x={x} y="0" width="1" height={H} fill="rgba(255,230,180,0.04)"/>
          </g>
        );
      })}
    </svg>
  );
}

/* Framed puppet portrait */
function FramedPuppet({seed,size=44,frameColor="#6B4A28",tilt=0,style={}}){
  return (
    <div style={{width:size,position:"relative",transform:`rotate(${tilt}deg)`,...style}}>
      {/* Nail */}
      <div style={{position:"absolute",top:-4,left:"50%",transform:"translateX(-50%)",width:5,height:5,borderRadius:"50%",background:"radial-gradient(circle,#888,#555)",boxShadow:"0 1px 2px rgba(0,0,0,0.5)",zIndex:2}}/>
      {/* Frame */}
      <div style={{width:size,height:size*1.1,borderRadius:2,padding:4,background:`linear-gradient(135deg, ${frameColor}, ${frameColor}cc, ${frameColor})`,boxShadow:"2px 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)"}}>
        <img src={puppetSVG(seed)} alt="" style={{width:"100%",height:"100%",borderRadius:1,display:"block"}}/>
      </div>
      {/* Frame shadow on wall */}
      <div style={{position:"absolute",top:2,left:2,width:size,height:size*1.1,borderRadius:2,background:"rgba(0,0,0,0.15)",filter:"blur(3px)",zIndex:-1}}/>
    </div>
  );
}

function CRTMonitor({nft,style={}}){
  return (
    <div style={{position:"relative",...style}}>
      <div style={{width:"100%",aspectRatio:"4/3.8",background:"linear-gradient(160deg, #c8c0b0 0%, #a09888 40%, #908878 80%, #787068 100%)",borderRadius:"12px 12px 8px 8px",padding:"13% 9% 18% 9%",boxShadow:"4px 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",position:"relative"}}>
        <div style={{width:"100%",height:"100%",background:"#1a1a1a",borderRadius:6,padding:3,boxShadow:"inset 0 2px 8px rgba(0,0,0,0.8)",overflow:"hidden"}}>
          <div style={{width:"100%",height:"100%",borderRadius:4,overflow:"hidden",position:"relative",background:nft?`linear-gradient(135deg, hsl(${(nft.id*47+20)%360},30%,18%), hsl(${(nft.id*47+50)%360},20%,12%))`:"#080808"}}>
            {nft?(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
              <img src={puppetSVG(nft.id+7)} alt={nft.name} style={{width:"78%",height:"78%",objectFit:"contain",imageRendering:"pixelated"}}/>
              <div style={{position:"absolute",bottom:3,left:0,right:0,textAlign:"center",fontFamily:"monospace",fontSize:8,color:"#0f0",textShadow:"0 0 4px #0f0"}}>{nft.price} BTC</div>
              <div style={{position:"absolute",top:2,right:3,fontFamily:"monospace",fontSize:6,color:rarCol(nft.rarity),textShadow:`0 0 3px ${rarCol(nft.rarity)}`}}>{nft.rarity}</div>
            </div>):(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:3}}>
              <div style={{fontFamily:"monospace",fontSize:9,color:"#0f0",textShadow:"0 0 6px #0f0",animation:"blink 1.5s infinite"}}>SELECT A PUPPET</div>
              <div style={{fontFamily:"monospace",fontSize:6,color:"#0a0",opacity:0.5}}>▼ BROWSE BELOW ▼</div>
            </div>)}
            <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)"}}/>
            <div style={{position:"absolute",inset:0,pointerEvents:"none",boxShadow:"inset 0 0 25px 8px rgba(0,0,0,0.35)",borderRadius:4}}/>
          </div>
        </div>
        <div style={{position:"absolute",bottom:"6%",left:"50%",transform:"translateX(-50%)",fontFamily:"monospace",fontSize:5,color:"rgba(80,70,60,0.5)",letterSpacing:2}}>PUPPET-VISION</div>
        <div style={{position:"absolute",bottom:"7%",right:"12%",width:4,height:4,borderRadius:"50%",background:nft?"#0f0":"#0a0",boxShadow:nft?"0 0 4px #0f0":"none"}}/>
      </div>
      <div style={{width:"40%",height:6,margin:"-1px auto 0",background:"linear-gradient(180deg, #908878, #787068)",borderRadius:"0 0 2px 2px"}}/>
      <div style={{width:"55%",height:5,margin:"0 auto",background:"linear-gradient(180deg, #787068, #686058)",borderRadius:"0 0 3px 3px"}}/>
      {nft&&<div style={{position:"absolute",top:"5%",left:"-15%",right:"-15%",bottom:"10%",pointerEvents:"none",background:"radial-gradient(ellipse at 50% 40%, rgba(100,255,100,0.05) 0%, transparent 55%)",filter:"blur(10px)"}}/>}
    </div>
  );
}

function LeFouSVG(){
  return (
    <svg viewBox="0 0 220 380" style={{width:"100%",height:"100%",filter:"drop-shadow(0 20px 40px rgba(0,0,0,0.7))"}}>
      <rect x="103" y="215" width="14" height="160" rx="5" fill="url(#stG)"/><rect x="98" y="210" width="24" height="14" rx="4" fill="#5A3A18"/>
      <ellipse cx="110" cy="155" rx="70" ry="65" fill="url(#bdG)" stroke="#c08090" strokeWidth="1.5"/>
      <ellipse cx="110" cy="155" rx="60" ry="55" fill="#f0b8d0"/>
      <ellipse cx="110" cy="108" rx="58" ry="62" fill="url(#fcG)" stroke="#d0a070" strokeWidth="1.5"/>
      <ellipse cx="72" cy="118" rx="14" ry="10" fill="rgba(240,140,140,0.25)"/><ellipse cx="148" cy="118" rx="14" ry="10" fill="rgba(240,140,140,0.25)"/>
      <ellipse cx="48" cy="84" rx="16" ry="22" fill="#e8b890" stroke="#d0a070" strokeWidth="1.5"/><ellipse cx="48" cy="84" rx="10" ry="14" fill="#daa878"/>
      <ellipse cx="172" cy="84" rx="16" ry="22" fill="#e8b890" stroke="#d0a070" strokeWidth="1.5"/><ellipse cx="172" cy="84" rx="10" ry="14" fill="#daa878"/>
      <ellipse cx="88" cy="96" rx="18" ry="20" fill="#fff" stroke="#2a2a2a" strokeWidth="2.5"/>
      <ellipse cx="132" cy="96" rx="18" ry="20" fill="#fff" stroke="#2a2a2a" strokeWidth="2.5"/>
      <circle cx="92" cy="98" r="8" fill="#3a2a1a"/><circle cx="128" cy="95" r="8" fill="#3a2a1a"/>
      <circle cx="93" cy="97" r="4.5" fill="#111"/><circle cx="129" cy="94" r="4.5" fill="#111"/>
      <circle cx="96" cy="92" r="3" fill="#fff"/><circle cx="132" cy="89" r="3" fill="#fff"/>
      <path d="M68 72 Q80 62 104 70" stroke="#3a2a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M116 68 Q140 60 152 70" stroke="#3a2a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <ellipse cx="110" cy="112" rx="7" ry="5" fill="#d4a080"/>
      <path d="M72 126 Q90 156 110 158 Q130 156 148 126" fill="#1a1a1a"/>
      {[82,93,104,115,126].map(x=><rect key={x} x={x} y="128" width="9" height="8" rx="2" fill="#fff"/>)}
      <ellipse cx="110" cy="148" rx="18" ry="8" fill="#e44060"/>
      <g transform="translate(158,104) rotate(18)">
        <rect x="0" y="0" width="36" height="8" rx="4" fill={PINK} stroke="#d45090" strokeWidth="1.5"/>
        <rect x="30" y="-12" width="14" height="26" rx="6" fill={PINK} stroke="#d45090" strokeWidth="1.5"/>
        <circle cx="37" cy="-18" r="4" fill="rgba(255,255,255,0.12)"><animate attributeName="cy" values="-18;-42" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.15;0" dur="3s" repeatCount="indefinite"/><animate attributeName="r" values="4;10" dur="3s" repeatCount="indefinite"/></circle>
      </g>
      <ellipse cx="110" cy="48" rx="52" ry="10" fill="#2a2a2a" stroke="#1a1a1a" strokeWidth="1.5"/>
      <path d="M66 48 Q62 14,110 8 Q158 14,154 48" fill="url(#btG)" stroke="#1a1a1a" strokeWidth="1.5"/>
      <rect x="84" y="38" width="52" height="8" rx="3" fill={O}/><rect x="84" y="38" width="52" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>
      <circle cx="110" cy="10" r="5" fill="#333"/>
      <defs>
        <linearGradient id="stG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6B4A22"/><stop offset="50%" stopColor="#8B6332"/><stop offset="100%" stopColor="#6B4A22"/></linearGradient>
        <radialGradient id="bdG" cx="50%" cy="40%"><stop offset="0%" stopColor="#f0b8d0"/><stop offset="100%" stopColor="#d898b0"/></radialGradient>
        <radialGradient id="fcG" cx="45%" cy="40%"><stop offset="0%" stopColor="#f8d8b8"/><stop offset="60%" stopColor="#f0c8a0"/><stop offset="100%" stopColor="#e0b890"/></radialGradient>
        <linearGradient id="btG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#444"/><stop offset="100%" stopColor="#2a2a2a"/></linearGradient>
      </defs>
    </svg>
  );
}

export default function TheShed(){
  const[selNFT,setSelNFT]=useState(null);
  const[wallet,setWallet]=useState(false);
  const[sortBy,setSortBy]=useState("price-asc");
  const[filterCol,setFilterCol]=useState("All");
  const[filterRarity,setFilterRarity]=useState("All");
  const[idleIdx,setIdleIdx]=useState(0);
  const scrollRef=useRef(null);

  useEffect(()=>{if(!selNFT){const iv=setInterval(()=>setIdleIdx(i=>(i+1)%IDLE.length),7000);return()=>clearInterval(iv);};},[selNFT]);
  const txt=selNFT?(NL[selNFT.rarity]||NL.Common)[selNFT.id%2]:IDLE[idleIdx];
  const{displayed,done}=useTypewriter(txt);
  const filtered=ALL_NFTS.filter(n=>filterCol==="All"||n.col===filterCol).filter(n=>filterRarity==="All"||n.rarity===filterRarity).sort((a,b)=>{if(sortBy==="price-asc")return a.price-b.price;if(sortBy==="price-desc")return b.price-a.price;const o={Common:0,Rare:1,Epic:2,Legendary:3,Mythic:4,Genesis:5};return(o[b.rarity]||0)-(o[a.rarity]||0);});
  const selectNFT=(nft)=>{setSelNFT(prev=>prev?.id===nft.id?null:nft);scrollRef.current?.scrollTo({top:0,behavior:"smooth"});};

  return (
    <div ref={scrollRef} style={{height:"100vh",overflow:"auto",background:DARK,color:CREAM,fontFamily:"'JetBrains Mono',monospace"}}>
      <link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=JetBrains+Mono:wght@400;500;700&family=Caveat:wght@400;700&display=swap" rel="stylesheet"/>

      <header style={{position:"sticky",top:0,zIndex:50,background:"rgba(17,13,7,0.97)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{background:"rgba(255,40,40,0.05)",borderBottom:"1px solid rgba(255,40,40,0.06)",padding:"4px 16px",display:"flex",justifyContent:"center",alignItems:"center",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:5,height:5,borderRadius:"50%",background:"#ff4444",animation:"pulse 2s infinite"}}/><span style={{fontSize:"0.36rem",color:"#ff5555",letterSpacing:"0.06em"}}>MAGIC EDEN ORDINALS CLOSES</span></div>
          <Countdown/>
        </div>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",height:44}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:"1rem"}}>🎭</span><span style={{fontFamily:"'Permanent Marker',cursive",fontSize:"0.95rem",color:O}}>BITCOIN PUPPET SHED</span></div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {[{l:"FLOOR",v:"0.012₿",c:O},{l:"OPIUM",v:"0.157₿",c:"#ff6b2b"},{l:"VAULT",v:"0.84₿",c:CREAM}].map((s,i)=>(<div key={i} style={{textAlign:"right"}}><div style={{fontSize:"0.26rem",color:"rgba(255,255,255,0.2)",letterSpacing:"0.08em"}}>{s.l}</div><div style={{fontSize:"0.6rem",fontWeight:700,color:s.c}}>{s.v}</div></div>))}
            <button onClick={()=>setWallet(!wallet)} style={{padding:"5px 12px",background:wallet?"transparent":`linear-gradient(135deg,${O},#e8820f)`,border:wallet?`1px solid ${O}40`:"none",borderRadius:6,fontFamily:"'Permanent Marker',cursive",fontSize:"0.5rem",color:wallet?O:DARK,cursor:"pointer"}}>{wallet?"bc1q...x8f2":"CONNECT"}</button>
          </div>
        </div>
      </header>

      {/* ═══ THE SHED ═══ */}
      <section style={{position:"relative",width:"100%",aspectRatio:"16/7.5",minHeight:400,maxHeight:580,overflow:"hidden"}}>

        {/* BACK WALL — horizontal shiplap planks */}
        <div style={{position:"absolute",inset:0,overflow:"hidden"}}><WoodWall/></div>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(90,65,30,0.3) 0%, rgba(110,78,38,0.15) 50%, rgba(80,55,25,0.3) 100%)"}}/>

        {/* Ceiling */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:"16%",zIndex:2,background:"linear-gradient(180deg, rgba(12,6,2,0.95) 0%, rgba(25,15,5,0.6) 60%, transparent 100%)"}}/>
        {[10,30,50,70,90].map(p=>(<div key={p} style={{position:"absolute",top:0,left:`${p}%`,width:26,height:"14%",zIndex:3,background:"linear-gradient(90deg, #1A0E04, #4A3218 50%, #1A0E04)",borderRadius:"0 0 4px 4px",boxShadow:"0 6px 16px rgba(0,0,0,0.35)"}}/>))}

        {/* ═══ FRAMED PUPPETS ON WALL — gallery spread ═══ */}
        <FramedPuppet seed={42} size={40} tilt={-3} frameColor="#7B5A32" style={{position:"absolute",top:"16%",left:"5%",zIndex:6}}/>
        <FramedPuppet seed={17} size={34} tilt={2} frameColor="#5A3A1E" style={{position:"absolute",top:"20%",left:"16%",zIndex:6}}/>
        <FramedPuppet seed={88} size={44} tilt={-1} frameColor="#8B6914" style={{position:"absolute",top:"15%",left:"28%",zIndex:6}}/>
        <FramedPuppet seed={55} size={32} tilt={4} frameColor="#6B4A28" style={{position:"absolute",top:"22%",left:"40%",zIndex:6}}/>
        <FramedPuppet seed={33} size={38} tilt={-2} frameColor="#7B5A32" style={{position:"absolute",top:"17%",left:"52%",zIndex:6}}/>
        <FramedPuppet seed={71} size={34} tilt={3} frameColor="#5A3A1E" style={{position:"absolute",top:"21%",left:"64%",zIndex:6}}/>
        <FramedPuppet seed={99} size={42} tilt={-2} frameColor="#D4A843" style={{position:"absolute",top:"16%",left:"76%",zIndex:6}}/>
        <FramedPuppet seed={12} size={30} tilt={1} frameColor="#6B4A28" style={{position:"absolute",top:"23%",left:"88%",zIndex:6}}/>

        {/* ═══ WORKBENCH — spans mid-section like Dr. ICU desk ═══ */}
        <div style={{position:"absolute",bottom:"22%",left:"20%",right:"4%",height:28,zIndex:6,background:"linear-gradient(180deg, #8B6B3A 0%, #7B5A32 30%, #6B4A28 70%, #5A3A1E 100%)",borderRadius:"3px 3px 0 0",boxShadow:"0 6px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"}}>
          {/* Top edge highlight */}
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg, rgba(255,230,180,0.08), rgba(255,230,180,0.04) 50%, rgba(255,230,180,0.08))",borderRadius:"3px 3px 0 0"}}/>
          {/* Plank line */}
          <div style={{position:"absolute",top:"50%",left:0,right:0,height:1,background:"rgba(0,0,0,0.06)"}}/>
          {/* Legs */}
          <div style={{position:"absolute",bottom:-24,left:"5%",width:10,height:24,background:"linear-gradient(90deg, #4A2A14, #5A3A1E, #4A2A14)",borderRadius:"0 0 2px 2px",boxShadow:"2px 2px 4px rgba(0,0,0,0.3)"}}/>
          <div style={{position:"absolute",bottom:-24,left:"35%",width:10,height:24,background:"linear-gradient(90deg, #4A2A14, #5A3A1E, #4A2A14)",borderRadius:"0 0 2px 2px",boxShadow:"2px 2px 4px rgba(0,0,0,0.3)"}}/>
          <div style={{position:"absolute",bottom:-24,right:"5%",width:10,height:24,background:"linear-gradient(90deg, #4A2A14, #5A3A1E, #4A2A14)",borderRadius:"0 0 2px 2px",boxShadow:"2px 2px 4px rgba(0,0,0,0.3)"}}/>
        </div>

        {/* CRT ON the workbench */}
        <div style={{position:"absolute",bottom:"28%",left:"42%",width:"clamp(110px,16vw,165px)",zIndex:8}}>
          <CRTMonitor nft={selNFT}/>
        </div>

        {/* Items on bench: mug, papers, bottle */}
        <div style={{position:"absolute",bottom:"23%",left:"62%",zIndex:7,display:"flex",gap:8,alignItems:"flex-end"}}>
          {/* Coffee mug */}
          <div style={{width:11,height:14,borderRadius:"2px 2px 3px 3px",background:"rgba(200,180,150,0.25)",border:"1px solid rgba(200,180,150,0.15)",position:"relative"}}>
            <div style={{position:"absolute",right:-4,top:3,width:5,height:6,borderRadius:"0 3px 3px 0",border:"1.5px solid rgba(200,180,150,0.15)",borderLeft:"none"}}/>
          </div>
          {/* Stack of papers */}
          <div style={{width:20,height:3,background:"rgba(245,230,200,0.12)",transform:"rotate(-2deg)"}}/>
        </div>
        <div style={{position:"absolute",bottom:"23%",right:"8%",zIndex:7}}>
          {/* Brown bottle */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{width:6,height:7,background:"#4A3525",borderRadius:"2px 2px 0 0"}}/>
            <div style={{width:14,height:22,borderRadius:"2px 2px 3px 3px",background:"linear-gradient(135deg, rgba(100,70,35,0.45), rgba(80,55,25,0.55))",boxShadow:"1px 2px 4px rgba(0,0,0,0.2)"}}/>
          </div>
        </div>

        {/* ═══ FLOOR — vertical planks running into screen ═══ */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"40%",zIndex:1,overflow:"hidden"}}>
          <WoodFloor/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg, rgba(65,45,22,0.2) 0%, rgba(85,60,30,0.1) 50%, rgba(100,72,38,0.15) 100%)"}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(0deg, rgba(120,90,50,0.08), transparent)"}}/>
          <div style={{position:"absolute",top:0,left:0,right:0,height:20,background:"linear-gradient(180deg, rgba(0,0,0,0.3), transparent)"}}/>
          {/* Rug */}
          <div style={{position:"absolute",bottom:"5%",left:"50%",transform:"translateX(-50%)",width:"44%",maxWidth:380,aspectRatio:"2.2/1",borderRadius:4,overflow:"hidden",opacity:0.5}}>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg, #8B3A2A, #6A2818, #8B3A2A)"}}/>
            <div style={{position:"absolute",inset:4,border:"2px solid rgba(200,160,60,0.3)",borderRadius:2}}/>
            <div style={{position:"absolute",inset:10,border:"1px solid rgba(200,160,60,0.15)"}}/>
          </div>
        </div>

        {/* Barrels left */}
        <div style={{position:"absolute",bottom:"4%",left:"2%",zIndex:8}}>
          <div style={{width:44,height:58,borderRadius:"8px 8px 10px 10px",background:"linear-gradient(90deg, #3A2210, #7B5A32 50%, #3A2210)",boxShadow:"4px 6px 16px rgba(0,0,0,0.5)",position:"relative"}}>
            <div style={{position:"absolute",top:"25%",left:-1,right:-1,height:5,background:"linear-gradient(90deg, transparent 5%, #B8A060 50%, transparent 95%)"}}/>
            <div style={{position:"absolute",top:"58%",left:-1,right:-1,height:5,background:"linear-gradient(90deg, transparent 5%, #B8A060 50%, transparent 95%)"}}/>
          </div>
        </div>

        {/* Lanterns */}
        {[28,72].map((p,i)=>(<div key={i} style={{position:"absolute",top:0,left:`${p}%`,zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",transform:"translateX(-50%)"}}>
          <div style={{width:2,height:"11%",background:"rgba(120,100,70,0.5)"}}/>
          <div style={{width:18,height:16,borderRadius:3,background:"linear-gradient(180deg, #6B5A38, #4A3A20)",position:"relative"}}>
            <div style={{position:"absolute",inset:3,borderRadius:2,background:"radial-gradient(circle, rgba(255,220,120,0.6), rgba(255,180,60,0.2) 60%, transparent)"}}/>
          </div>
          <div style={{position:"absolute",top:"12%",width:"28vw",maxWidth:260,height:"88%",pointerEvents:"none",background:"radial-gradient(ellipse at 50% 0%, rgba(255,200,80,0.12) 0%, rgba(255,180,60,0.04) 40%, transparent 65%)"}}/>
        </div>))}

        {/* Atmosphere */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:9,background:"radial-gradient(ellipse at 32% 30%, rgba(255,200,80,0.1) 0%, transparent 40%), radial-gradient(ellipse at 68% 25%, rgba(255,195,70,0.08) 0%, transparent 35%)"}}/>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:9,opacity:0.4,background:"radial-gradient(2px 2px at 22% 30%, rgba(255,220,150,0.6), transparent), radial-gradient(1.5px 1.5px at 50% 18%, rgba(255,220,150,0.5), transparent), radial-gradient(2px 2px at 75% 38%, rgba(255,220,150,0.4), transparent), radial-gradient(2.5px 2.5px at 62% 24%, rgba(255,220,150,0.5), transparent)"}}/>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:10,boxShadow:"inset 0 0 120px 40px rgba(8,4,1,0.5)"}}/>

        {/* ═══ CONTENT LAYER ═══ */}
        <div style={{position:"relative",zIndex:20,display:"flex",alignItems:"flex-end",height:"100%",maxWidth:1200,margin:"0 auto",padding:"0 16px"}}>

          {/* LE FOU + SPEECH BUBBLE above head */}
          <div style={{width:"clamp(140px,22vw,220px)",minWidth:140,marginBottom:"-2%",position:"relative",zIndex:12}}>
            {/* Speech bubble — floating well above head */}
            <div style={{position:"absolute",top:"-28%",left:"10%",right:"-70%",zIndex:15}}>
              <div style={{background:"rgba(255,255,255,0.12)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:14,padding:"8px 14px",boxShadow:"0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",position:"relative"}}>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:"clamp(0.75rem,1.5vw,0.95rem)",color:"#fff",lineHeight:1.4,textShadow:"0 1px 3px rgba(0,0,0,0.3)"}}>
                  {displayed}{!done&&<span style={{animation:"blink 0.5s infinite",color:O}}>|</span>}
                </div>
                {/* Downward tail */}
                <div style={{position:"absolute",bottom:-8,left:"20%",width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:"8px solid rgba(255,255,255,0.12)"}}/>
              </div>
            </div>
            <LeFouSVG/>
            <div style={{position:"absolute",bottom:"2%",left:"10%",right:"10%",height:16,background:"radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 70%)",filter:"blur(6px)"}}/>
          </div>

          {/* BUY PANEL — right side */}
          <div style={{flex:1,paddingBottom:"5%",paddingLeft:8,display:"flex",flexDirection:"column",gap:8,maxWidth:480,minWidth:0,marginLeft:"auto"}}>
            {selNFT?(
              <div style={{background:"rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${rarCol(selNFT.rarity)}30`,borderRadius:16,padding:"10px 12px",animation:"fadeScale 0.25s ease-out",boxShadow:`0 8px 30px rgba(0,0,0,0.25), 0 0 24px ${rarCol(selNFT.rarity)}08`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontFamily:"'Permanent Marker',cursive",fontSize:"0.85rem",color:"#fff"}}>{selNFT.name}</div>
                    <div style={{display:"flex",gap:4,marginTop:3}}>
                      <span style={{fontSize:"0.35rem",color:rarCol(selNFT.rarity),padding:"2px 6px",border:`1px solid ${rarCol(selNFT.rarity)}40`,borderRadius:5,background:`${rarCol(selNFT.rarity)}15`}}>{selNFT.rarity}</span>
                      <span style={{fontSize:"0.28rem",color:"rgba(255,255,255,0.3)"}}>{selNFT.col}</span>
                    </div>
                  </div>
                  <button onClick={()=>setSelNFT(null)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"2px 6px",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:"0.5rem"}}>✕</button>
                </div>
                <div style={{marginTop:5,display:"flex",alignItems:"baseline",gap:5}}>
                  <span style={{fontSize:"1.2rem",fontWeight:700,color:O,textShadow:`0 0 10px ${O}40`}}>{selNFT.price}</span>
                  <span style={{fontSize:"0.5rem",color:"rgba(255,255,255,0.4)"}}>₿</span>
                  <span style={{fontSize:"0.33rem",color:"rgba(255,255,255,0.2)",marginLeft:"auto"}}>≈ ${(selNFT.price*84000).toLocaleString()}</span>
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:4}}>
                  {selNFT.traits.map((t,i)=>(<span key={i} style={{fontSize:"0.32rem",padding:"2px 5px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,color:"rgba(255,255,255,0.5)"}}>{t}</span>))}
                </div>
                <div style={{display:"flex",gap:6,marginTop:7}}>
                  <button style={{flex:1,padding:"8px 0",background:`linear-gradient(135deg,${O},#e8820f)`,border:"none",borderRadius:8,fontFamily:"'Permanent Marker',cursive",fontSize:"0.72rem",color:DARK,cursor:"pointer",boxShadow:`0 4px 16px ${O}35`}}>BUY NOW</button>
                  <button style={{padding:"8px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${O}40`,borderRadius:8,fontFamily:"'Permanent Marker',cursive",fontSize:"0.72rem",color:O,cursor:"pointer"}}>OFFER</button>
                </div>
              </div>
            ):(
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:16,padding:"16px 12px",textAlign:"center"}}>
                <div style={{fontSize:"1rem",opacity:0.12,marginBottom:2}}>👇</div>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:"0.72rem",color:"rgba(255,255,255,0.12)"}}>Select a puppet to inspect...</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ BELOW ═══ */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 16px",position:"relative",zIndex:1}}>
        <div style={{position:"sticky",top:76,zIndex:40,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",padding:"7px 12px",marginTop:8,background:"rgba(17,13,7,0.97)",backdropFilter:"blur(12px)",borderRadius:8,border:"1px solid rgba(255,255,255,0.04)"}}>
          <span style={{fontSize:"0.34rem",color:"rgba(255,255,255,0.18)"}}>SORT</span>
          {[{v:"price-asc",l:"Price ↑"},{v:"price-desc",l:"Price ↓"},{v:"rarity",l:"Rarity"}].map(s=>(<Chip key={s.v} active={sortBy===s.v} color={O} onClick={()=>setSortBy(s.v)}>{s.l}</Chip>))}
          <Sep/>
          {["All","Puppets","OPIUM"].map(c=>(<Chip key={c} active={filterCol===c} color={c==="OPIUM"?"#ff6b2b":O} onClick={()=>setFilterCol(c)}>{c}</Chip>))}
          <Sep/>
          {["All","Common","Rare","Epic","Legendary","Mythic","Genesis"].map(r=>(<Chip key={r} active={filterRarity===r} color={rarCol(r)} onClick={()=>setFilterRarity(r)}>{r}</Chip>))}
          <span style={{marginLeft:"auto",fontSize:"0.38rem",color:"rgba(255,255,255,0.1)"}}>{filtered.length}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,padding:"12px 0 36px"}}>
          {filtered.map((nft,i)=>(<NFTCard key={nft.id} nft={nft} delay={i*25} active={selNFT?.id===nft.id} onClick={()=>selectNFT(nft)}/>))}
          {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:50,fontFamily:"'Caveat',cursive",fontSize:"0.85rem",color:"rgba(255,255,255,0.1)"}}>Nothing here. 🎭</div>}
        </div>
        <footer style={{padding:"20px 0 12px",borderTop:"1px solid rgba(255,255,255,0.03)",textAlign:"center"}}><div style={{fontFamily:"'Permanent Marker',cursive",fontSize:"0.55rem",color:"rgba(255,255,255,0.04)"}}>world peace ☮️</div></footer>
      </div>

      <style>{`*{box-sizing:border-box;margin:0;padding:0}::selection{background:${O}33}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes cardIn{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes fadeScale{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${DARK}}::-webkit-scrollbar-thumb{background:#3A2010;border-radius:3px}`}</style>
    </div>
  );
}

function NFTCard({nft,delay,active,onClick}){
  const[hov,setHov]=useState(false);
  const isGold=nft.rarity==="Mythic"||nft.rarity==="Genesis";
  return(<div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{borderRadius:8,overflow:"hidden",cursor:"pointer",background:active?`linear-gradient(135deg,${rarCol(nft.rarity)}10,${rarCol(nft.rarity)}05)`:"linear-gradient(135deg,rgba(30,20,8,0.6),rgba(20,14,5,0.8))",border:`1.5px solid ${active?rarCol(nft.rarity)+"50":hov?O+"28":"rgba(255,255,255,0.03)"}`,transition:"all 0.2s cubic-bezier(0.23,1,0.32,1)",transform:hov&&!active?"translateY(-2px)":"none",boxShadow:active?`0 0 16px ${rarCol(nft.rarity)}12`:hov?"0 6px 16px rgba(0,0,0,0.3)":"none",animation:`cardIn 0.3s ease-out ${delay}ms both`}}>
    <div style={{margin:6,borderRadius:5,background:isGold?"linear-gradient(135deg,#D4A843,#8B6914,#D4A843)":"linear-gradient(135deg,#4A2A12,#2A1508,#4A2A12)",padding:3.5}}>
      <div style={{borderRadius:2.5,overflow:"hidden",position:"relative"}}>
        <img src={puppetSVG(nft.id+7)} alt={nft.name} style={{width:"100%",aspectRatio:"1",display:"block",filter:hov||active?"brightness(1.05)":"brightness(0.87)",transition:"filter 0.15s"}}/>
        <div style={{position:"absolute",top:3,left:3,width:6,height:6,borderRadius:"50%",background:rarCol(nft.rarity),boxShadow:`0 0 5px ${rarCol(nft.rarity)}66`}}/>
      </div>
    </div>
    <div style={{padding:"2px 8px 7px"}}><div style={{fontFamily:"'Permanent Marker',cursive",fontSize:"0.48rem",color:"rgba(255,255,255,0.4)",lineHeight:1.2}}>{nft.name}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}><span style={{fontSize:"0.72rem",fontWeight:700,color:O}}>{nft.price}₿</span><span style={{fontSize:"0.3rem",color:rarCol(nft.rarity),padding:"1px 4px",border:`1px solid ${rarCol(nft.rarity)}25`,borderRadius:3,background:`${rarCol(nft.rarity)}08`}}>{nft.rarity}</span></div></div>
  </div>);
}

function Chip({children,active,color,onClick}){return <button onClick={onClick} style={{padding:"3px 7px",fontSize:"0.36rem",background:active?`${color}14`:"rgba(255,255,255,0.02)",border:`1px solid ${active?color+"40":"rgba(255,255,255,0.04)"}`,borderRadius:4,color:active?color:"rgba(255,255,255,0.2)",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",transition:"all 0.15s"}}>{children}</button>;}
function Sep(){return <div style={{width:1,height:11,background:"rgba(255,255,255,0.04)"}}/>;}
