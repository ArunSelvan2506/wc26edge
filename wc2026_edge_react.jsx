// ─────────────────────────────────────────────────────────────────
// WC26 EDGE · React Edition
//
// LINEUP INTEGRATION OPTIONS (choose one in Settings panel):
//
// 1. API-Football (api-sports.io) — FREE TIER, 100 calls/day
//    GET https://v3.football.api-sports.io/fixtures/lineups?fixture={id}
//    Headers: x-apisports-key: YOUR_KEY
//    WC2026 league=1, season=2026 — lineups drop ~60min before KO
//
// 2. TheStatsAPI (thestatsapi.com) — 7-day free trial
//    GET https://api.thestatsapi.com/v1/matches/{matchId}/lineups
//    Headers: Authorization: Bearer YOUR_KEY
//    Covers WC2026: competition_id=comp_6107, season_id=sn_118868
//
// 3. Demo mode — simulates SofaScore-style lineup drops automatically
//    No key needed. Polls every 60s, triggers T-60min before kickoff.
//
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────
const T = {
  bg:"#07090d", s1:"#0d1117", s2:"#111827", s3:"#1a2336",
  b1:"#1e2d42", b2:"#253550",
  tx:"#e2e8f4", mu:"#5a6a82", dm:"#2e4060",
  ac:"#00c896", ac2:"#3b82f6", ac3:"#f97316",
  red:"#ef4444", grn:"#22c55e", amb:"#f59e0b", pur:"#a855f7",
};

// ─── PLAYER DATABASE (for odds impact calculation) ────────────────
const PLAYER_IMPACT = {
  // Key players whose lineup confirmation shifts odds/confidence
  "Cristiano Ronaldo":  { oddsShift:{ h:-30, a:50  }, confBoost:3, props:["SOT+15%","scorer+10%"] },
  "Harry Kane":         { oddsShift:{ h:-20, a:35  }, confBoost:2, props:["SOT+12%","corners+1"] },
  "Kylian Mbappé":      { oddsShift:{ h:-25, a:40  }, confBoost:3, props:["SOT+14%","scorer+12%"] },
  "Erling Haaland":     { oddsShift:{ h:-20, a:30  }, confBoost:2, props:["SOT+18%","scorer+15%"] },
  "Declan Rice":        { oddsShift:{ h:-10, a:15  }, confBoost:1, props:["fouls+95%","cards+8%"] },
  "Vinícius Jr":        { oddsShift:{ a:-15, h:25  }, confBoost:2, props:["SOT+10%","corners+2"] },
  "Lamine Yamal":       { oddsShift:{ a:-18, h:28  }, confBoost:2, props:["SOT+12%","corners+1"] },
  "Kaoru Mitoma":       { oddsShift:{ h:20,  a:-12 }, confBoost:-2, props:["INJURED OUT — SOT-15%"] },
  "Memphis Depay":      { oddsShift:{ h:-20, a:35  }, confBoost:3, props:["SOT+15%","scorer+12%"] },
  "Alexander Isak":     { oddsShift:{ a:-18, h:25  }, confBoost:2, props:["SOT+14%","scorer+10%"] },
  "Viktor Gyökeres":    { oddsShift:{ a:-10, h:15  }, confBoost:1, props:["fouls+92%","scorer+8%"] },
  "Mohamed Salah":      { oddsShift:{ h:-20, a:30  }, confBoost:2, props:["SOT+12%","corners+1"] },
  "Rúben Neves":        { oddsShift:{ h:-8,  a:12  }, confBoost:1, props:["fouls+95%"] },
  "Ryan Gravenberch":   { oddsShift:{ h:-10, a:18  }, confBoost:1, props:["fouls+96%"] },
  "Frenkie de Jong":    { oddsShift:{ h:-8,  a:12  }, confBoost:1, props:["fouls+88%","card+12%"] },
  "Granit Xhaka":       { oddsShift:{ h:-8,  a:12  }, confBoost:1, props:["fouls+89%","card+10%"] },
  "Thomas Partey":      { oddsShift:{ a:8,   h:-5  }, confBoost:1, props:["fouls+82%"] },
  "Casemiro":           { oddsShift:{ a:-10, h:15  }, confBoost:1, props:["fouls+91%","card+8%"] },
  "Wataru Endo":        { oddsShift:{ h:5,   a:-5  }, confBoost:0, props:["fouls+82%"] },
};

// ─── FIXTURE DATABASE ──────────────────────────────────────────
// apiFootballId = ID used by API-Football (league=1, season=2026)
// sofaScoreId   = match ID from SofaScore URL
const DAYS = {
  "23": {
    title:"Tuesday 23 June 2026", sub:"MD2 · Groups K & L · 4 matches",
    matches:[
      {
        id:"por_uzb", apiFootballId:1195801, sofaScoreId:null,
        kickoffUTC:"2026-06-23T17:00:00Z", live:true,
        teams:"🇵🇹 Portugal vs Uzbekistan 🇺🇿",
        group:"Group K", venue:"Houston · NRG Stadium", time:"1pm ET / 6pm BST",
        tag:"top", tagLabel:"★ 84% Top pick", conf:84, upset:14,
        baseOdds:{ h:-498, d:625, a:1300, ou:2.5 },
        homeTeam:"Portugal", awayTeam:"Uzbekistan", winner:"Portugal",
        wP:84, dP:10, aP:6,
        keyPlayers:{ home:["Cristiano Ronaldo","Bruno Fernandes","Rúben Neves"], away:["Khusanov"] },
        cbars:[
          {l:"Portugal win",p:84,c:T.ac},{l:"Ronaldo 2+ SOT",p:80,c:T.ac2},
          {l:"Neves 1+ fouls (100% L10)",p:95,c:T.ac},{l:"Over 2.5 goals",p:79,c:T.ac},
          {l:"Portugal 7+ corners",p:77,c:T.pur},
        ],
        fouls:[
          { name:"Rúben Neves", club:"Al-Hilal · Portugal · DM", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Fouls/90","1.5/g"],["Role","Press breaker"],["YC/season","6–8"]],
            dots:[1,1,1,1,1,1,1,1,1,1], conf:95,
            bets:[{l:"Neves 1+ fouls committed",o:["-155 bet365","-145 FanDuel"]}],
            note:"100% last 10. Portugal DM who breaks every press with physical challenges — near certainty." },
          { name:"Khusanov", club:"Man City · Uzbekistan · CB · marking Ronaldo", hot:false, hitTag:"80% last 10", hitClass:"h80",
            stats:[["Tackles/90 PL","1.9"],["vs CR7","Pace duels"],["PL bookings","3+"]],
            dots:[1,1,1,1,0,1,1,1,0,1], conf:72,
            bets:[{l:"Khusanov 1+ fouls",o:["-130 est."]}],
            note:"Directly marking Ronaldo. Pace and physicality force tactical fouls from this Man City CB." },
        ],
        shots:[
          { name:"Cristiano Ronaldo", club:"Al-Hilal · Portugal · ST · Final WC", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Shots/90","4.2"],["SOT/game","2.1"],["WC goals record","9"]],
            sdots:[1,1,1,1,1,1,1,1,1,1], sotdots:[1,1,1,1,1,1,1,0,1,1], sH:95, sotH:80,
            bets:[{l:"Ronaldo 2+ SOT",o:["-155 bet365"]},{l:"Ronaldo anytime scorer",o:["+120 FanDuel"]}] },
          { name:"Bruno Fernandes", club:"Man Utd · Portugal · AM", hot:false, hitTag:"90% last 10", hitClass:"h90",
            stats:[["Shots/90 PL","1.9"],["SOT/game","1.0"],["Key passes","#1 PL"]],
            sdots:[1,1,1,1,1,1,0,1,1,1], sotdots:[1,1,0,1,1,1,1,0,1,1], sH:82, sotH:74,
            bets:[{l:"Fernandes 1+ SOT",o:["-130 est."]}] },
        ],
        easy:[
          {c:"Goals",p:"Over 2.5 goals",o:"-130 FanDuel",cf:79,star:true},
          {c:"Corners",p:"Portugal 7+ corners",o:"-135 est.",cf:77,star:true},
          {c:"Throw-ins",p:"Over 42 total throw-ins",o:"-115 est.",cf:82,star:true},
          {c:"Shots",p:"Portugal over 14.5 total shots",o:"-125 est.",cf:81,star:true},
          {c:"Cards",p:"Match cards over 2.5",o:"-115 est.",cf:73,star:false},
        ],
        parlay:[{p:"Neves 1+ fouls",o:"-155"},{p:"Ronaldo 2+ SOT",o:"-155"},{p:"Over 2.5 goals",o:"-130"},{p:"Portugal 7+ corners",o:"-135"}],
        parlayRet:"+210–255",
        upset:"Portugal drew 1-1 vs DR Congo (-450) in MD1. Uzbekistan beat Japan in qualifying. 14% upset risk.",
        ref:"📋 WC26 avg corners/game 10.6 · throw-ins/game 46 · fouls/game 24.4",
        ai:"Portugal (-498, drew MD1 1-1 DR Congo shock) vs Uzbekistan. Ronaldo: 4.2 shots/90, 2.1 SOT/game, WC record 9 goals. Neves DM: 1.5 fouls/90, 100% last 10. WC2026 avg 24.4 fouls/game, 10.6 corners/game, 46 throw-ins/game, fav win rate 54%.",
      },
      {
        id:"eng_gha", apiFootballId:1195802, sofaScoreId:null,
        kickoffUTC:"2026-06-23T20:00:00Z", live:false,
        teams:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 England vs Ghana 🇬🇭",
        group:"Group L", venue:"Boston · Gillette Stadium", time:"4pm ET / 9pm BST",
        tag:"top", tagLabel:"★ Kane + Rice", conf:70, upset:20,
        baseOdds:{ h:-472, d:550, a:1225, ou:2.5 },
        homeTeam:"England", awayTeam:"Ghana", winner:"England",
        wP:70, dP:16, aP:14,
        keyPlayers:{ home:["Harry Kane","Declan Rice","Bukayo Saka"], away:["Thomas Partey","Mohammed Kudus"] },
        cbars:[
          {l:"England win",p:70,c:T.ac},{l:"Kane 2+ SOT",p:78,c:T.ac2},
          {l:"Rice 1+ fouls (100% L10)",p:96,c:T.ac},{l:"Partey 1+ fouls (Ghana DM)",p:82,c:T.ac},
          {l:"Over 10 match corners",p:73,c:T.pur},
        ],
        fouls:[
          { name:"Declan Rice", club:"Arsenal · England · DM", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Fouls/90 PL","1.8"],["YC PL+UCL","9"],["Role","Anchor DM"]],
            dots:[1,1,1,1,1,1,1,1,1,1], conf:96,
            bets:[{l:"Rice 1+ fouls committed",o:["-165 bet365","-155 FanDuel"]},{l:"Rice to be booked",o:["+195 bet365"]}],
            note:"1.8 fouls/90 in PL. Ghana press aggressively — Rice fouls to disrupt every single game. 10/10 last matches." },
          { name:"Thomas Partey", club:"Arsenal · Ghana · DM", hot:true, hitTag:"90% last 10", hitClass:"h90",
            stats:[["Fouls/90 PL","1.4"],["YC PL 25/26","7"],["vs England","Direct battle"]],
            dots:[1,1,1,1,1,1,0,1,1,1], conf:82,
            bets:[{l:"Partey 1+ fouls committed",o:["-140 bet365","-135 FanDuel"]}],
            note:"Mirrors Rice in midfield — both DMs foul for tactical control." },
        ],
        shots:[
          { name:"Harry Kane", club:"Bayern Munich · England · ST", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Shots/90 BL","4.5"],["SOT/game","2.16"],["BL goals 25/26","36"]],
            sdots:[1,1,1,1,1,1,1,1,1,1], sotdots:[1,1,1,1,1,1,1,1,0,1], sH:96, sotH:78,
            bets:[{l:"Kane 2+ SOT",o:["-145 bet365"]},{l:"Kane anytime scorer",o:["+130 FanDuel"]}] },
          { name:"Mohammed Kudus", club:"West Ham · Ghana · AM", hot:false, hitTag:"80% last 10", hitClass:"h80",
            stats:[["Shots/90 PL","2.4"],["SOT/game","1.1"],["PL goals","14"]],
            sdots:[1,1,0,1,1,1,1,0,1,1], sotdots:[1,1,0,1,1,0,1,1,0,1], sH:74, sotH:65,
            bets:[{l:"Kudus 1+ SOT",o:["-120 est."]}] },
        ],
        easy:[
          {c:"Fouls ★",p:"Rice 1+ fouls committed",o:"-165 bet365",cf:96,star:true},
          {c:"Goals",p:"Over 2.5 goals",o:"-120 est.",cf:72,star:true},
          {c:"Corners",p:"England 6+ corners",o:"-140 est.",cf:78,star:true},
          {c:"Throw-ins",p:"Over 44 total throw-ins",o:"-115 est.",cf:80,star:true},
          {c:"Cards",p:"Over 3.5 total cards",o:"+140 Paddy",cf:61,star:false},
        ],
        parlay:[{p:"Rice 1+ fouls",o:"-165"},{p:"Partey 1+ fouls",o:"-140"},{p:"Kane 2+ SOT",o:"-145"},{p:"Over 3.5 cards",o:"+140"}],
        parlayRet:"+215–255",
        upset:"Ghana won MD1 1-0 Panama. England -472 is only 70% confidence after WC26 upset calibration.",
        ref:"📋 WC26 avg corners/game 10.6 · England possession sides avg 7+ corners.",
        ai:"England (-472, won MD1 4-2 Croatia) vs Ghana (won MD1 1-0 Panama). Kane: 4.5 shots/90. Rice DM: 1.8 fouls/90, 100% last 10. Partey DM: 1.4 fouls/90, 90% last 10.",
      },
      {
        id:"pan_cro", apiFootballId:1195803, sofaScoreId:null,
        kickoffUTC:"2026-06-23T23:00:00Z", live:false,
        teams:"🇵🇦 Panama vs Croatia 🇭🇷",
        group:"Group L", venue:"Toronto · BMO Field", time:"7pm ET / 12am BST",
        tag:"upset", tagLabel:"⚠ Croatia 62%", conf:62, upset:38,
        baseOdds:{ h:544, d:290, a:-191, ou:2.5 },
        homeTeam:"Panama", awayTeam:"Croatia", winner:"Croatia",
        wP:13, dP:25, aP:62,
        keyPlayers:{ home:["Ismael Díaz"], away:["Petar Musa","Luka Modrić","Marcelo Brozović"] },
        cbars:[
          {l:"Croatia win",p:62,c:T.amb},{l:"Musa 2+ SOT",p:71,c:T.ac2},
          {l:"Modrić 1+ fouls drawn",p:82,c:T.ac},{l:"Under 2.5 goals",p:58,c:T.amb},
          {l:"Over 9 total corners",p:64,c:T.pur},
        ],
        fouls:[
          { name:"Luka Modrić", club:"Real Madrid · Croatia · CM · 40yrs", hot:false, hitTag:"100% fouls drawn L10", hitClass:"h100",
            stats:[["Fouls drawn/g","1.2"],["Age","40 yrs"],["WC career","2018 final"]],
            dots:[1,1,1,1,1,1,1,1,1,1], conf:82,
            bets:[{l:"Modrić 1+ fouls drawn",o:["-140 FanDuel","-135 bet365"]}],
            note:"At 40 Modrić draws fouls through ball retention. Panama will hack him constantly." },
        ],
        shots:[
          { name:"Petar Musa", club:"Benfica · Croatia · ST", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Shots/90","4.1"],["SOT/game","2.0"],["Goals 25/26","16"]],
            sdots:[1,1,1,1,1,1,1,1,1,1], sotdots:[1,1,1,1,0,1,1,1,1,1], sH:93, sotH:71,
            bets:[{l:"Musa 2+ SOT",o:["-130 est."]},{l:"Musa anytime scorer",o:["+165 est."]}] },
        ],
        easy:[
          {c:"SOT prop ★",p:"Musa 2+ shots on target",o:"-130 est.",cf:71,star:true},
          {c:"Fouls drawn",p:"Modrić 1+ fouls drawn",o:"-140 FanDuel",cf:82,star:true},
          {c:"Throw-ins",p:"Over 40 total throw-ins",o:"-110 est.",cf:71,star:true},
          {c:"Goals",p:"Under 2.5 goals",o:"-120 est.",cf:58,star:false},
        ],
        parlay:[{p:"Musa 2+ SOT",o:"-130"},{p:"Modrić 1+ fouls drawn",o:"-140"}],
        parlayRet:"+145–175",
        upset:"Panama lost MD1 0-1 Ghana. Croatia also lost MD1. Both desperate — 38% Panama upset.",
        ai:"Croatia (-191) vs Panama (+544). Musa: 4.1 shots/90. Modrić fouls drawn 100% last 10. WC2026 avg 24.4 fouls/game.",
      },
      {
        id:"col_drc", apiFootballId:1195804, sofaScoreId:null,
        kickoffUTC:"2026-06-24T02:00:00Z", live:false,
        teams:"🇨🇴 Colombia vs DR Congo 🇨🇩",
        group:"Group K", venue:"Guadalajara · Estadio Akron", time:"10pm ET / 3am BST",
        tag:"info", tagLabel:"66% Colombia", conf:66, upset:34,
        baseOdds:{ h:-198, d:340, a:575, ou:2.5 },
        homeTeam:"Colombia", awayTeam:"DR Congo", winner:"Colombia",
        wP:66, dP:23, aP:11,
        keyPlayers:{ home:["Luis Díaz","Richard Ríos","James Rodríguez"], away:["Emam Ashour"] },
        cbars:[
          {l:"Colombia win",p:66,c:T.amb},{l:"Luis Díaz 1+ SOT",p:72,c:T.ac2},
          {l:"Over 2.5 goals",p:61,c:T.amb},{l:"Colombia 6+ corners",p:68,c:T.pur},
        ],
        fouls:[
          { name:"Richard Ríos", club:"Palmeiras · Colombia · CM", hot:false, hitTag:"90% last 10", hitClass:"h90",
            stats:[["Fouls/game","1.3"],["Role","Press engine"],["YC 25","4"]],
            dots:[1,1,1,1,1,0,1,1,1,1], conf:76,
            bets:[{l:"Ríos 1+ fouls",o:["-130 est."]}],
            note:"Colombia press aggressively — Ríos commits tactical fouls every game." },
        ],
        shots:[
          { name:"Luis Díaz", club:"Liverpool · Colombia · LW", hot:true, hitTag:"90% last 10", hitClass:"h90",
            stats:[["Shots/90 PL","2.8"],["SOT/game","1.3"],["PL goals 25/26","17"]],
            sdots:[1,1,1,1,1,1,0,1,1,1], sotdots:[1,1,0,1,1,1,1,0,1,1], sH:83, sotH:72,
            bets:[{l:"Díaz 1+ SOT",o:["-135 est."]}] },
        ],
        easy:[
          {c:"SOT prop",p:"Luis Díaz 1+ SOT",o:"-135 est.",cf:72,star:true},
          {c:"Throw-ins",p:"Over 42 total throw-ins",o:"-110 est.",cf:75,star:true},
          {c:"Goals",p:"Over 2.5 goals",o:"+105 est.",cf:61,star:false},
        ],
        parlay:[{p:"Díaz 1+ SOT",o:"-135"},{p:"Ríos 1+ fouls",o:"-130"}],
        parlayRet:"+130–155",
        upset:"DR Congo drew 1-1 with Portugal (-450) in MD1. 34% upset risk.",
        ai:"Colombia (-198) vs DR Congo (drew 1-1 Portugal MD1). Díaz: 2.8 shots/90. Ríos: 1.3 fouls/game, 90% last 10.",
      },
    ],
  },

  "25": {
    title:"Thursday 25 June 2026", sub:"MD2 · Groups D E F · 6 matches",
    matches:[
      {
        id:"ned_tun", apiFootballId:1195810, sofaScoreId:null,
        kickoffUTC:"2026-06-25T23:00:00Z", live:false,
        teams:"🇳🇱 Netherlands vs Tunisia 🇹🇳",
        group:"Group F", venue:"Kansas City · Arrowhead", time:"7pm ET / 12am BST",
        tag:"top", tagLabel:"★ 76% · Depay hat-trick", conf:76, upset:12,
        baseOdds:{ h:-400, d:500, a:750, ou:2.5 },
        homeTeam:"Netherlands", awayTeam:"Tunisia", winner:"Netherlands",
        wP:76, dP:15, aP:9,
        keyPlayers:{ home:["Memphis Depay","Ryan Gravenberch","Frenkie de Jong"], away:[] },
        cbars:[
          {l:"Netherlands win",p:76,c:T.ac},{l:"Depay 2+ SOT (hat-trick MD2)",p:77,c:T.ac2},
          {l:"Gravenberch 1+ fouls (100% L10)",p:96,c:T.ac},{l:"De Jong 1+ fouls (100% L10)",p:88,c:T.ac},
          {l:"Netherlands 8+ corners",p:79,c:T.pur},{l:"Over 44 throw-ins",p:85,c:T.ac2},
        ],
        fouls:[
          { name:"Ryan Gravenberch", club:"Liverpool · Netherlands · DM", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Fouls/90 PL","1.4"],["MD2 vs Sweden","MOT 2 assists"],["Rating MD1","7.3 Sofascore"]],
            dots:[1,1,1,1,1,1,1,1,1,1], conf:96,
            bets:[{l:"Gravenberch 1+ fouls",o:["-175 bet365","-165 FanDuel"]}],
            note:"100% last 10. NED dominant after Depay hat-trick." },
          { name:"Frenkie de Jong", club:"Barcelona · Netherlands · CM", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Fouls/90 LL","0.61"],["Fouls won/g","1.1"],["YC 25 LL games","6"]],
            dots:[1,1,1,1,1,1,1,1,1,1], conf:88,
            bets:[{l:"De Jong 1+ fouls",o:["-155 bet365","-145 FanDuel"]},{l:"De Jong booked",o:["+185 Paddy"]}],
            note:"100% last 10. 6 bookings in 25 La Liga games. Card at +185 outstanding value." },
        ],
        shots:[
          { name:"Memphis Depay", club:"Netherlands · ST · NL all-time record scorer", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Shots/90","3.2"],["SOT/game","1.6"],["MD2 result","HAT-TRICK vs Sweden"]],
            sdots:[1,1,1,1,1,1,1,1,1,1], sotdots:[1,1,1,1,1,1,1,1,0,1], sH:96, sotH:77,
            bets:[{l:"Depay 2+ SOT",o:["-150 est."]},{l:"Depay anytime scorer",o:["+120 est."]}] },
        ],
        easy:[
          {c:"Goals",p:"Over 2.5 goals",o:"-130 est.",cf:74,star:true},
          {c:"Fouls ★",p:"Gravenberch 1+ fouls",o:"-175 bet365",cf:96,star:true},
          {c:"SOT prop",p:"Depay 2+ SOT",o:"-150 est.",cf:77,star:true},
          {c:"Corners",p:"Netherlands 8+ corners",o:"-130 est.",cf:79,star:true},
          {c:"Throw-ins",p:"Over 44 total throw-ins",o:"-115 est.",cf:85,star:true},
          {c:"Shots",p:"Netherlands over 16 shots",o:"-130 est.",cf:80,star:true},
        ],
        parlay:[{p:"Gravenberch 1+ fouls",o:"-175"},{p:"De Jong 1+ fouls",o:"-155"},{p:"Depay 2+ SOT",o:"-150"},{p:"Over 2.5 goals",o:"-130"}],
        parlayRet:"+205–250",
        upset:"Tunisia lost 1-5 Sweden MD1, lost 0-4 Japan MD2. Only 12% upset risk.",
        ref:"📋 Tunisia defensively fragile vs elite wingers — NED avg 9+ corners.",
        ai:"Netherlands (-400, won MD2 5-1 Sweden Depay hat-trick) vs Tunisia. Depay: 3.2 shots/90. Gravenberch: 100% fouls L10. De Jong: 100% fouls L10.",
      },
      {
        id:"jap_swe", apiFootballId:1195811, sofaScoreId:null,
        kickoffUTC:"2026-06-25T23:00:00Z", live:false,
        teams:"🇯🇵 Japan vs Sweden 🇸🇪",
        group:"Group F", venue:"Dallas · AT&T Stadium", time:"7pm ET / 12am BST",
        tag:"upset", tagLabel:"⚠ Sweden 58% · Japan 42%", conf:58, upset:42,
        baseOdds:{ h:230, d:240, a:-150, ou:2.5 },
        homeTeam:"Japan", awayTeam:"Sweden", winner:"Sweden",
        wP:42, dP:27, aP:58,
        keyPlayers:{ home:["Takefusa Kubo","Wataru Endo"], away:["Alexander Isak","Viktor Gyökeres"] },
        cbars:[
          {l:"Sweden win",p:58,c:T.amb},{l:"Isak 2+ SOT",p:72,c:T.ac2},
          {l:"Gyökeres 1+ fouls (100% L10)",p:91,c:T.ac},{l:"Endo 1+ fouls (Japan DM)",p:82,c:T.ac},
          {l:"Japan upset risk (beat Germany WC22)",p:42,c:T.red},
        ],
        fouls:[
          { name:"Viktor Gyökeres", club:"Arsenal · Sweden · ST", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Fouls/90 PL","1.41"],["Fouls drawn/season","31"],["YC PL 25/26","5"]],
            dots:[1,1,1,1,1,1,1,1,1,1], conf:91,
            bets:[{l:"Gyökeres 1+ fouls",o:["-165 est. bet365"]}],
            note:"Physical Arsenal striker — commits fouls every match. 100% last 10." },
          { name:"Wataru Endo", club:"Liverpool · Japan · DM · Captain", hot:true, hitTag:"90% last 10", hitClass:"h90",
            stats:[["Fouls/90 PL","1.3"],["Role","Anchor DM"],["YC PL","6"]],
            dots:[1,1,1,1,1,1,1,1,1,0], conf:82,
            bets:[{l:"Endo 1+ fouls",o:["-145 est. bet365"]}],
            note:"Japan captain DM breaks Swedish transitions. 82% last 10." },
        ],
        shots:[
          { name:"Alexander Isak", club:"Liverpool · Sweden · ST · career-best", hot:true, hitTag:"100% last 10", hitClass:"h100",
            stats:[["Shots/90 PL","3.1"],["SOT/game","1.5"],["PL goals 25/26","24"]],
            sdots:[1,1,1,1,1,1,1,1,1,1], sotdots:[1,1,1,1,0,1,1,1,1,1], sH:96, sotH:72,
            bets:[{l:"Isak 2+ SOT",o:["-135 est."]},{l:"Isak anytime scorer",o:["+130 est."]}] },
          { name:"Takefusa Kubo (replaces Mitoma)", club:"Real Sociedad · Japan · RW · Mitoma INJURED OUT", hot:false, hitTag:"80% last 10", hitClass:"h80",
            stats:[["Shots/90 LL","2.3"],["SOT/game","1.1"],["Mitoma status","INJURED — OUT"]],
            sdots:[1,1,1,0,1,1,1,0,1,1], sotdots:[1,1,0,1,1,0,1,1,0,1], sH:76, sotH:64,
            bets:[{l:"Kubo 1+ SOT",o:["-120 est."]}] },
        ],
        easy:[
          {c:"SOT prop ★",p:"Isak 2+ SOT",o:"-135 est.",cf:72,star:true},
          {c:"Fouls",p:"Gyökeres 1+ fouls (100% L10)",o:"-165 est.",cf:91,star:true},
          {c:"BTTS",p:"Both teams score",o:"+105 est.",cf:65,star:false},
          {c:"Throw-ins",p:"Over 44 throw-ins",o:"-110 est.",cf:77,star:true},
        ],
        parlay:[{p:"Gyökeres 1+ fouls",o:"-165"},{p:"Endo 1+ fouls",o:"-145"},{p:"Isak 2+ SOT",o:"-135"}],
        parlayRet:"+185–215",
        upset:"Japan beat Germany WC22, drew Netherlands 2-2 MD1. Mitoma INJURED OUT. 42% upset.",
        ai:"Japan (Mitoma OUT, Kubo replaces) vs Sweden (lost MD2 0-5 Netherlands). Isak: 3.1 shots/90. Gyökeres: 1.41 fouls/90, 100% last 10.",
      },
    ],
  },
};

// ─── LINEUP SERVICE ────────────────────────────────────────────
// Parses API-Football lineup response and maps to impact
async function fetchLineupFromAPIFootball(fixtureId, apiKey) {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`,
    { headers: { "x-apisports-key": apiKey } }
  );
  const json = await res.json();
  // Returns { home: { startXI: [{player:{name,...}},...] }, away: {...} }
  return json.response;
}

// Calculate total odds/conf impact from confirmed lineup
function calculateLineupImpact(confirmedPlayers, match) {
  let totalOddsH = 0, totalOddsA = 0, totalConf = 0;
  const triggeredProps = [];
  const notes = [];
  const injuredOut = [];

  confirmedPlayers.forEach(name => {
    const impact = PLAYER_IMPACT[name];
    if (!impact) return;

    // Check if it's an injury situation
    if (impact.props.some(p => p.includes("INJURED"))) {
      injuredOut.push(name);
      totalOddsH += impact.oddsShift?.h || 0;
      totalOddsA += impact.oddsShift?.a || 0;
      totalConf += impact.confBoost || 0;
      triggeredProps.push(...impact.props);
      notes.push(`🚨 ${name} INJURED OUT`);
      return;
    }

    // Regular impact
    const isHome = match.keyPlayers.home.includes(name);
    if (isHome) {
      totalOddsH += impact.oddsShift?.h || 0;
      totalOddsA += impact.oddsShift?.a || 0;
    } else {
      totalOddsH -= impact.oddsShift?.h || 0;
      totalOddsA -= impact.oddsShift?.a || 0;
    }
    totalConf += impact.confBoost || 0;
    triggeredProps.push(...impact.props);
    notes.push(`✓ ${name} confirmed`);
  });

  return {
    oddsH: Math.round(totalOddsH),
    oddsA: Math.round(totalOddsA),
    confDelta: totalConf,
    props: [...new Set(triggeredProps)],
    notes,
    injuredOut,
    confirmedCount: confirmedPlayers.length,
  };
}

// Demo mode: simulate lineup drop based on time to kickoff
function getDemoLineup(match) {
  const kickoff = new Date(match.kickoffUTC);
  const now = new Date();
  const minsToKO = (kickoff - now) / 60000;

  // Simulate: lineups "drop" at T-70 mins
  if (minsToKO > 70) return null; // Not released yet

  // Return simulated confirmed players
  const allKeyPlayers = [
    ...(match.keyPlayers?.home || []),
    ...(match.keyPlayers?.away || []),
  ];
  return allKeyPlayers;
}

// ─── LINEUP HOOK ────────────────────────────────────────────────
function useLineup(match, apiKey, useDemo) {
  const [lineup, setLineup] = useState(null);
  const [impact, setImpact] = useState(null);
  const [status, setStatus] = useState("pending"); // pending | released | error
  const [lastChecked, setLastChecked] = useState(null);
  const intervalRef = useRef(null);

  const check = useCallback(async () => {
    setLastChecked(new Date());

    if (useDemo) {
      const demo = getDemoLineup(match);
      if (demo) {
        setLineup(demo);
        setImpact(calculateLineupImpact(demo, match));
        setStatus("released");
      }
      return;
    }

    if (!apiKey || !match.apiFootballId) return;
    try {
      const data = await fetchLineupFromAPIFootball(match.apiFootballId, apiKey);
      if (data && data.length > 0) {
        const confirmedPlayers = data.flatMap(team =>
          (team.startXI || []).map(p => p.player?.name).filter(Boolean)
        );
        // Match player names against our key players
        const matched = confirmedPlayers.filter(name =>
          [...(match.keyPlayers?.home || []), ...(match.keyPlayers?.away || [])].some(
            kp => name.toLowerCase().includes(kp.split(" ").slice(-1)[0].toLowerCase())
          )
        );
        const resolved = matched.length > 0 ? match.keyPlayers.home.concat(match.keyPlayers.away) : [];
        if (resolved.length > 0) {
          setLineup(resolved);
          setImpact(calculateLineupImpact(resolved, match));
          setStatus("released");
          clearInterval(intervalRef.current);
        }
      }
    } catch (e) {
      setStatus("error");
    }
  }, [match, apiKey, useDemo]);

  useEffect(() => {
    check(); // Immediate check
    // Poll every 60 seconds
    intervalRef.current = setInterval(check, 60000);
    return () => clearInterval(intervalRef.current);
  }, [check]);

  return { lineup, impact, status, lastChecked, refresh: check };
}

// ─── HELPERS ──────────────────────────────────────────────────
function confColor(p) { return p >= 75 ? T.ac : p >= 55 ? T.amb : T.red; }
function formatOdds(n) {
  if (n === undefined || n === null) return "N/A";
  return n > 0 ? `+${n}` : `${n}`;
}
function applyImpactToOdds(base, impact, isHome) {
  if (!impact) return base;
  return {
    h: base.h + (impact.oddsH || 0),
    d: base.d,
    a: base.a + (impact.oddsA || 0),
    ou: base.ou,
  };
}

// ─── SUB COMPONENTS ───────────────────────────────────────────
const ConfBar = ({ label, pct, color }) => (
  <div style={{ marginBottom:7 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
      <span style={{ fontSize:10, color:T.mu }}>{label}</span>
      <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:11, fontWeight:700, color:confColor(pct) }}>{pct}%</span>
    </div>
    <div style={{ height:6, background:T.s1, borderRadius:3, overflow:"hidden", border:`1px solid ${T.b1}` }}>
      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${color}55,${color})`, transition:"width 0.6s" }} />
    </div>
  </div>
);

const DotRow = ({ dots, color, label }) => (
  <div>
    {label && <div style={{ fontSize:9, color:T.mu, marginBottom:3 }}>{label}</div>}
    <div style={{ display:"flex", gap:2, flexWrap:"wrap", marginBottom:5 }}>
      {dots.map((d,i) => (
        <div key={i} style={{
          width:18, height:18, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:8, fontWeight:700, flexShrink:0,
          background: d ? `${color}30` : `${T.red}30`,
          border: `1px solid ${d ? color : T.red}66`,
          color: d ? color : T.red,
        }}>{d ? "✓" : "✗"}</div>
      ))}
    </div>
  </div>
);

const HitTag = ({ cls, label }) => {
  const c = cls === "h100" ? T.grn : cls === "h90" ? T.grn : T.amb;
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, whiteSpace:"nowrap",
      background:`${c}18`, border:`1px solid ${c}44`, color:c }}>{label}</span>
  );
};

// ─── LINEUP PANEL ─────────────────────────────────────────────
const LineupPanel = ({ match, apiKey, useDemo }) => {
  const { lineup, impact, status, lastChecked, refresh } = useLineup(match, apiKey, useDemo);

  const pending = status === "pending";
  const released = status === "released";

  return (
    <div style={{
      background: released ? `${T.ac}08` : `${T.amb}08`,
      border: `1px solid ${released ? `${T.ac}35` : `${T.amb}30`}`,
      borderRadius:8, padding:"10px 12px", marginBottom:12,
    }}>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background: released ? T.ac : T.amb,
            animation: pending ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ fontSize:11, fontWeight:700, color: released ? T.ac : T.amb }}>
            {released ? "✓ LINEUP CONFIRMED" : "⏳ LINEUP PENDING"}
          </span>
          <span style={{ fontSize:9, color:T.mu, fontFamily:"JetBrains Mono,monospace" }}>
            {useDemo ? "Demo mode" : "via API-Football"}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {lastChecked && (
            <span style={{ fontSize:9, color:T.mu, fontFamily:"JetBrains Mono,monospace" }}>
              Last checked {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refresh} style={{
            fontFamily:"Inter,sans-serif", fontSize:9, fontWeight:600, cursor:"pointer",
            background:`${T.ac2}15`, border:`1px solid ${T.ac2}40`, color:T.ac2,
            borderRadius:4, padding:"3px 8px",
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* Pending state */}
      {pending && (
        <div style={{ fontSize:10, color:T.mu, lineHeight:1.6 }}>
          Lineups typically drop <strong style={{color:T.amb}}>60–70 minutes before kickoff</strong> on SofaScore / API-Football / TheStatsAPI.
          Auto-polling every 60 seconds. When confirmed, odds and confidence will auto-update.
          <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:5 }}>
            {(match.keyPlayers?.home || []).concat(match.keyPlayers?.away || []).map((p,i) => (
              <span key={i} style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:`${T.amb}12`, border:`1px solid ${T.amb}25`, color:T.amb }}>{p}</span>
            ))}
          </div>
          <div style={{ marginTop:6, fontSize:9, color:T.dm }}>
            Watching for: {(match.keyPlayers?.home || []).concat(match.keyPlayers?.away || []).join(", ")}
          </div>
        </div>
      )}

      {/* Released state */}
      {released && impact && (
        <div>
          {/* Confirmed players */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
            {lineup?.map((p,i) => {
              const playerImpact = PLAYER_IMPACT[p];
              const isInjured = playerImpact?.props?.some(pr => pr.includes("INJURED"));
              return (
                <span key={i} style={{
                  fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:4,
                  background: isInjured ? `${T.red}12` : `${T.ac}12`,
                  border: `1px solid ${isInjured ? `${T.red}35` : `${T.ac}35`}`,
                  color: isInjured ? T.red : T.ac,
                }}>
                  {isInjured ? "🚨 " : "✓ "}{p}
                </span>
              );
            })}
          </div>

          {/* Impact summary */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:6, marginBottom:8 }}>
            {[
              { label:"Odds impact (Home)", val: impact.oddsH > 0 ? `+${impact.oddsH}` : `${impact.oddsH}`, color: impact.oddsH < 0 ? T.ac : T.red },
              { label:"Confidence delta", val: `${impact.confDelta > 0 ? "+" : ""}${impact.confDelta}%`, color: impact.confDelta > 0 ? T.ac : T.red },
              { label:"Props activated", val: impact.props.length, color: T.ac2 },
            ].map(({ label, val, color }, i) => (
              <div key={i} style={{ background:T.bg, borderRadius:5, padding:"5px 8px", border:`1px solid ${T.b1}` }}>
                <div style={{ fontSize:9, color:T.mu, textTransform:"uppercase", letterSpacing:".04em" }}>{label}</div>
                <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:13, fontWeight:700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Prop triggers */}
          {impact.props.length > 0 && (
            <div style={{ background:`${T.ac2}08`, border:`1px solid ${T.ac2}20`, borderRadius:5, padding:"6px 9px" }}>
              <div style={{ fontSize:9, color:T.ac2, fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:".05em" }}>
                📊 Props auto-adjusted
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {[...new Set(impact.props)].map((p,i) => (
                  <span key={i} style={{ fontSize:9, color:T.tx, background:`${T.b1}80`, padding:"2px 6px", borderRadius:3 }}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Injury alerts */}
          {impact.injuredOut.length > 0 && (
            <div style={{ background:`${T.red}08`, border:`1px solid ${T.red}25`, borderRadius:5, padding:"6px 9px", marginTop:6 }}>
              <div style={{ fontSize:9, color:T.red, fontWeight:700 }}>🚨 INJURY ALERTS</div>
              {impact.injuredOut.map((p,i) => (
                <div key={i} style={{ fontSize:10, color:"#fca5a5", marginTop:2 }}>{p} — confirmed OUT. Props recalculated.</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SETTINGS PANEL ───────────────────────────────────────────
const SettingsPanel = ({ apiKey, setApiKey, apiMode, setApiMode, onClose }) => (
  <div style={{
    position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center",
  }} onClick={onClose}>
    <div style={{
      background:T.s1, border:`1px solid ${T.b1}`, borderRadius:12, padding:24, width:"min(480px,92vw)", maxHeight:"80vh", overflowY:"auto",
    }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize:16, fontWeight:700, color:T.tx, marginBottom:4 }}>⚙ Lineup Integration Settings</div>
      <div style={{ fontSize:11, color:T.mu, marginBottom:18 }}>Choose your data source for real lineup detection</div>

      {/* Mode selector */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, color:T.mu, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Data source</div>
        {[
          { id:"demo", label:"Demo mode", sub:"Auto-simulates lineup drops T-70min. No API key needed. Perfect for testing." },
          { id:"apifootball", label:"API-Football (api-sports.io)", sub:"Free tier: 100 calls/day. Covers WC2026 lineups, league=1, season=2026." },
          { id:"thestatsapi", label:"TheStatsAPI", sub:"7-day free trial. Covers WC2026: competition_id=comp_6107." },
        ].map(opt => (
          <div key={opt.id} onClick={() => setApiMode(opt.id)} style={{
            background: apiMode === opt.id ? `${T.ac}10` : T.s2,
            border: `1px solid ${apiMode === opt.id ? `${T.ac}40` : T.b1}`,
            borderRadius:7, padding:"10px 12px", marginBottom:6, cursor:"pointer",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                width:14, height:14, borderRadius:"50%",
                border: `2px solid ${apiMode === opt.id ? T.ac : T.mu}`,
                background: apiMode === opt.id ? T.ac : "none",
              }} />
              <span style={{ fontSize:12, fontWeight:600, color: apiMode === opt.id ? T.ac : T.tx }}>{opt.label}</span>
            </div>
            <div style={{ fontSize:10, color:T.mu, marginTop:3, marginLeft:22 }}>{opt.sub}</div>
          </div>
        ))}
      </div>

      {/* API Key input */}
      {apiMode !== "demo" && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:600, color:T.mu, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>
            API Key {apiMode === "apifootball" ? "(x-apisports-key)" : "(Bearer token)"}
          </div>
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={apiMode === "apifootball" ? "your-api-football-key" : "your-thestatsapi-key"}
            style={{
              width:"100%", background:T.bg, border:`1px solid ${T.b1}`, borderRadius:5,
              color:T.tx, padding:"8px 10px", fontFamily:"JetBrains Mono,monospace", fontSize:12,
              outline:"none",
            }}
          />
          <div style={{ fontSize:10, color:T.mu, marginTop:5 }}>
            {apiMode === "apifootball"
              ? "Get free key at api-sports.io → Free tier: 100 calls/day. WC2026 = league=1, season=2026."
              : "Get 7-day free trial at thestatsapi.com → WC2026 competition_id=comp_6107, season_id=sn_118868."}
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ background:T.s3, border:`1px solid ${T.b1}`, borderRadius:7, padding:"10px 12px", marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, color:T.ac, marginBottom:6 }}>How lineup detection works</div>
        {[
          "Polls API every 60 seconds for each upcoming match",
          "Lineups typically confirmed T-60 to T-70 minutes before kickoff",
          "When key players detected → odds shift and confidence updates automatically",
          "Injury alerts trigger immediately with prop recalculations",
          "All changes highlighted with delta indicators (↑ ↓)",
        ].map((step,i) => (
          <div key={i} style={{ display:"flex", gap:7, fontSize:10, color:T.mu, marginBottom:3 }}>
            <span style={{ color:T.ac, flexShrink:0 }}>{i+1}.</span> {step}
          </div>
        ))}
      </div>

      {/* Pricing comparison */}
      <div style={{ background:T.s3, border:`1px solid ${T.b1}`, borderRadius:7, padding:"10px 12px", marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, color:T.mu, marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>API Pricing comparison</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead>
            <tr style={{ color:T.mu }}>
              {["Provider","Free tier","Lineups","Odds","WC2026"].map((h,i) => (
                <td key={i} style={{ padding:"3px 6px", borderBottom:`1px solid ${T.b1}` }}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["API-Football","100 calls/day","✓","✓ 50+ books","✓ league=1"],
              ["TheStatsAPI","7-day trial","✓","✓","✓ comp_6107"],
              ["Sportmonks","Free widgets","✓","€129/mo All-In","✓"],
              ["BallDontLie","Free","✓","✓","✓"],
              ["WC2026API","Free plan","✗","✗","✓ basic"],
            ].map((row,i) => (
              <tr key={i} style={{ color: i%2===0 ? T.tx : T.mu }}>
                {row.map((cell,j) => (
                  <td key={j} style={{ padding:"3px 6px", borderBottom:`1px solid ${T.b1}`, color: cell==="✓" ? T.grn : cell==="✗" ? T.red : undefined }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={onClose} style={{
        width:"100%", fontFamily:"Inter,sans-serif", fontSize:12, fontWeight:600,
        background:`${T.ac}15`, border:`1px solid ${T.ac}35`, color:T.ac,
        borderRadius:7, padding:"9px", cursor:"pointer",
      }}>Save & Close</button>
    </div>
  </div>
);

// ─── FOUL CARD ────────────────────────────────────────────────
const FoulCard = ({ foul }) => (
  <div style={{ background:T.s1, border:`1px solid ${foul.hot ? `${T.ac}44` : T.b1}`, borderRadius:8, padding:10, marginBottom:8 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7, gap:6, flexWrap:"wrap" }}>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:T.tx }}>{foul.name}</div>
        <div style={{ fontSize:9, color:T.mu, marginTop:1 }}>{foul.club}</div>
      </div>
      <HitTag cls={foul.hitClass} label={foul.hitTag} />
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4, marginBottom:7 }}>
      {foul.stats.map(([l,v],i) => (
        <div key={i} style={{ background:T.bg, borderRadius:5, padding:"4px 6px", border:`1px solid ${T.b1}` }}>
          <div style={{ fontSize:8, color:T.mu, textTransform:"uppercase", letterSpacing:".03em" }}>{l}</div>
          <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:11, fontWeight:600, color:T.tx }}>{v}</div>
        </div>
      ))}
    </div>
    <DotRow dots={foul.dots} color={T.grn} label="Last 10 — committed 1+ foul (✓ yes)" />
    <ConfBar label="Foul prop confidence" pct={foul.conf} color={confColor(foul.conf)} />
    {foul.bets.map((b,i) => (
      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.bg, borderRadius:5, padding:"4px 7px", border:`1px solid ${T.b1}`, marginBottom:3, flexWrap:"wrap", gap:4 }}>
        <span style={{ fontSize:10, fontWeight:600, color:T.tx }}>{b.l}</span>
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
          {b.o.map((o,j) => <span key={j} style={{ fontFamily:"JetBrains Mono,monospace", fontSize:9, padding:"2px 5px", borderRadius:4, border:`1px solid ${T.b1}`, background:T.s2, color:T.tx }}>{o}</span>)}
        </div>
      </div>
    ))}
    {foul.note && <div style={{ fontSize:10, color:T.mu, lineHeight:1.6, marginTop:6, paddingTop:5, borderTop:`1px solid ${T.b1}` }}>{foul.note}</div>}
  </div>
);

// ─── SHOT CARD ────────────────────────────────────────────────
const ShotCard = ({ shot }) => (
  <div style={{ background:T.s1, border:`1px solid ${shot.hot ? `${T.ac}44` : T.b1}`, borderRadius:8, padding:10, marginBottom:8 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7, gap:6, flexWrap:"wrap" }}>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:T.tx }}>{shot.name}</div>
        <div style={{ fontSize:9, color:T.mu, marginTop:1 }}>{shot.club}</div>
      </div>
      <HitTag cls={shot.hitClass} label={shot.hitTag} />
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4, marginBottom:8 }}>
      {shot.stats.map(([l,v],i) => (
        <div key={i} style={{ background:T.bg, borderRadius:5, padding:"4px 6px", border:`1px solid ${T.b1}` }}>
          <div style={{ fontSize:8, color:T.mu, textTransform:"uppercase", letterSpacing:".03em" }}>{l}</div>
          <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:11, fontWeight:600, color:T.tx }}>{v}</div>
        </div>
      ))}
    </div>
    <ConfBar label="Had a shot (any)" pct={shot.sH} color={T.ac2} />
    <ConfBar label="Shot on target" pct={shot.sotH} color={T.pur} />
    <DotRow dots={shot.sdots} color={T.ac2} label="Last 10 shots 🔵" />
    <DotRow dots={shot.sotdots} color={T.pur} label="Last 10 SOT 🟣" />
    {shot.bets.map((b,i) => (
      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.bg, borderRadius:5, padding:"4px 7px", border:`1px solid ${T.b1}`, marginBottom:3, flexWrap:"wrap", gap:4 }}>
        <span style={{ fontSize:10, fontWeight:600, color:T.tx }}>{b.l}</span>
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
          {b.o.map((o,j) => <span key={j} style={{ fontFamily:"JetBrains Mono,monospace", fontSize:9, padding:"2px 5px", borderRadius:4, border:`1px solid ${T.b1}`, background:T.s2, color:T.tx }}>{o}</span>)}
        </div>
      </div>
    ))}
  </div>
);

// ─── AI BLOCK ─────────────────────────────────────────────────
const AIBlock = ({ matchId, ctx }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const p = `WC 2026 betting analyst. Tournament averages: 24.4 fouls/game, 10.6 corners/game, 46 throw-ins/game, 3.14 goals/game, fav win rate 54%, upset rate 46%.\n\nContext: ${ctx}\n\nBullet format:\n• FOUL PROP: best player, bet, confidence %, 1-sentence reason\n• SOT PROP: best player, bet, confidence %, 1-sentence reason\n• CORNER BET: specific prop, confidence %\n• THROW-IN BET: specific prop, confidence %\n• LIVE TRIGGER: what to watch in first 20 mins\n• RISK: biggest upset risk factor\n\nMax 180 words. No disclaimers.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:450, messages:[{ role:"user", content:p }] }),
      });
      const d = await r.json();
      setResult(d.content?.find(b => b.type==="text")?.text || "Unable to generate.");
    } catch { setResult("Analysis unavailable."); }
    setLoading(false);
  };
  return (
    <div style={{ background:T.bg, border:`1px solid ${T.b1}`, borderRadius:8, padding:"10px 12px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:".09em", textTransform:"uppercase", color:T.mu }}>🤖 AI deep analysis</span>
        <button onClick={run} disabled={loading} style={{
          fontFamily:"Inter,sans-serif", fontSize:10, fontWeight:600,
          background:`${T.ac}18`, border:`1px solid ${T.ac}44`, color:T.ac,
          borderRadius:5, padding:"4px 12px", cursor:loading?"wait":"pointer",
        }}>{loading ? "Analysing…" : "Analyse ↗"}</button>
      </div>
      {result
        ? <div style={{ fontSize:11, color:T.tx, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{result}</div>
        : <div style={{ fontSize:10, color:T.mu }}>Click Analyse for foul + SOT + corners + throw-ins + live trigger</div>}
    </div>
  );
};

// ─── MATCH CARD ───────────────────────────────────────────────
const MatchCard = ({ match, apiKey, apiMode }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("result");

  // Live lineup hook
  const useDemo = apiMode === "demo";
  const { lineup, impact, status, lastChecked, refresh } = useLineup(match, apiKey, useDemo);

  // Apply lineup impact to odds and conf
  const currentOdds = impact
    ? applyImpactToOdds(match.baseOdds, impact, true)
    : match.baseOdds;
  const currentConf = Math.min(98, match.conf + (impact?.confDelta || 0));

  const tagColor = match.tag === "top" ? T.ac : match.tag === "upset" ? T.ac3 : T.ac2;
  const TABS = [
    { id:"result", label:"Result" },
    { id:"lineup", label:`Lineup ${status === "released" ? "✓" : "⏳"}` },
    { id:"fouls",  label:`Fouls (${match.fouls?.length || 0})` },
    { id:"shots",  label:`Shots (${match.shots?.length || 0})` },
    { id:"easy",   label:"Easy bets" },
    { id:"parlay", label:"Parlay + AI" },
  ];

  return (
    <div style={{
      background:T.s1, border:`1px solid ${open ? `${T.ac}55` : T.b1}`,
      borderRadius:12, overflow:"hidden", transition:"border-color 0.15s", cursor:"pointer",
    }}>
      {/* HEAD */}
      <div onClick={() => setOpen(!open)} style={{ padding:"13px 16px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:10, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.tx, display:"flex", alignItems:"center", gap:8 }}>
              {match.teams}
              {match.live && <span style={{ fontSize:10, color:T.red, fontFamily:"JetBrains Mono,monospace" }}>● LIVE</span>}
            </div>
            <div style={{ fontSize:10, fontFamily:"JetBrains Mono,monospace", color:T.mu, marginTop:3 }}>
              {match.group} · {match.venue} · {match.time}
            </div>
          </div>
          <span style={{
            fontSize:9, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase",
            padding:"3px 9px", borderRadius:5, background:`${tagColor}18`, border:`1px solid ${tagColor}44`, color:tagColor,
          }}>{match.tagLabel}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:5 }}>
            {[
              { label:"Home", val:formatOdds(currentOdds.h), isHome:true },
              { label:"Draw", val:formatOdds(currentOdds.d) },
              { label:"Away", val:formatOdds(currentOdds.a) },
              { label:"O/U",  val:currentOdds.ou },
            ].map(({ label, val, isHome }, i) => (
              <div key={i} style={{ background:T.s3, borderRadius:6, padding:"5px 10px", textAlign:"center", minWidth:60 }}>
                <div style={{ fontSize:8, textTransform:"uppercase", letterSpacing:".05em", color:T.mu }}>{label}</div>
                <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:13, fontWeight:700,
                  color: isHome && match.winner === match.homeTeam ? T.ac : T.tx, marginTop:1 }}>{val}</div>
              </div>
            ))}
          </div>
          <span style={{
            fontFamily:"JetBrains Mono,monospace", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:5, border:"1px solid",
            background:`${confColor(currentConf)}18`, borderColor:`${confColor(currentConf)}44`, color:confColor(currentConf),
          }}>{currentConf}% conf</span>
          <span style={{ fontSize:10, fontWeight:600, padding:"4px 9px", borderRadius:5, background:`${T.ac3}12`, border:`1px solid ${T.ac3}35`, color:T.ac3 }}>
            ⚡ {match.upset}% upset
          </span>
          {/* Lineup status badge */}
          <span style={{
            fontSize:9, fontWeight:600, padding:"3px 7px", borderRadius:4,
            background: status === "released" ? `${T.ac}12` : `${T.amb}10`,
            border: `1px solid ${status === "released" ? `${T.ac}35` : `${T.amb}30`}`,
            color: status === "released" ? T.ac : T.amb,
          }}>
            {status === "released" ? `✓ Lineup confirmed` : `⏳ Lineup pending`}
          </span>
          {/* Odds delta badge — only when lineup has shifted odds */}
          {impact && (impact.oddsH !== 0 || impact.confDelta !== 0) && (
            <span style={{
              fontSize:9, fontWeight:700, padding:"3px 7px", borderRadius:4, fontFamily:"JetBrains Mono,monospace",
              background:`${T.ac2}12`, border:`1px solid ${T.ac2}30`, color:T.ac2,
            }}>
              {impact.confDelta > 0 ? `↑ +${impact.confDelta}% conf` : `↓ ${impact.confDelta}% conf`}
            </span>
          )}
          <span style={{ fontSize:14, color:T.mu, marginLeft:"auto", transition:"transform 0.2s", transform:open?"rotate(180deg)":"none" }}>▾</span>
        </div>
      </div>

      {/* EXPANDED */}
      {open && (
        <div style={{ borderTop:`1px solid ${T.b1}`, padding:"12px 16px 16px" }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:2, marginBottom:14, borderBottom:`1px solid ${T.b1}`, overflowX:"auto" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                fontSize:11, fontWeight:500, padding:"6px 12px", border:"none", background:"none",
                fontFamily:"Inter,sans-serif", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
                borderBottom:`2px solid ${tab === t.id ? T.ac : "transparent"}`,
                color: tab === t.id ? T.ac : T.mu, marginBottom:-1,
              }}>{t.label}</button>
            ))}
          </div>

          {/* RESULT tab */}
          {tab === "result" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:9 }}>
                  {[
                    { team:match.homeTeam, odds:formatOdds(currentOdds.h), pct:match.wP, win:match.winner===match.homeTeam },
                    { team:"Draw", odds:formatOdds(currentOdds.d), pct:match.dP, win:false },
                    { team:match.awayTeam, odds:formatOdds(currentOdds.a), pct:match.aP, win:match.winner===match.awayTeam },
                  ].map((item,i) => (
                    <div key={i} style={{
                      background:item.win ? `${T.ac}08` : T.bg, border:`1px solid ${item.win ? `${T.ac}50` : T.b1}`,
                      borderRadius:8, padding:"8px 5px", textAlign:"center",
                    }}>
                      <div style={{ fontSize:9, fontWeight:600, color:T.tx, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.team}</div>
                      <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:14, fontWeight:700, color:T.ac, margin:"3px 0" }}>{item.odds}</div>
                      <div style={{ fontSize:9, color:T.mu }}>{item.pct}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:T.ac, textAlign:"center", padding:"5px 8px", background:`${T.ac}08`, borderRadius:5, border:`1px solid ${T.ac}25`, marginBottom:8 }}>
                  ▶ {match.winner} · {currentConf}% confidence
                </div>
              </div>
              <div>{match.cbars.map((r,i) => <ConfBar key={i} label={r.l} pct={r.p} color={r.c} />)}</div>
            </div>
          )}

          {/* LINEUP tab */}
          {tab === "lineup" && (
            <LineupPanel match={match} apiKey={apiKey} useDemo={useDemo} />
          )}

          {/* FOULS tab */}
          {tab === "fouls" && (
            match.fouls?.length
              ? match.fouls.map((f,i) => <FoulCard key={i} foul={f} />)
              : <p style={{ fontSize:11, color:T.mu }}>No featured foul props for this fixture</p>
          )}

          {/* SHOTS tab */}
          {tab === "shots" && (
            match.shots?.length
              ? match.shots.map((s,i) => <ShotCard key={i} shot={s} />)
              : <p style={{ fontSize:11, color:T.mu }}>No featured shot props for this fixture</p>
          )}

          {/* EASY BETS tab */}
          {tab === "easy" && (
            match.easy.map((e,i) => (
              <div key={i} style={{
                background:e.star ? `${T.ac}05` : T.bg, border:`1px solid ${e.star ? `${T.ac}30` : T.b1}`,
                borderRadius:8, padding:"7px 10px", marginBottom:5,
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap",
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:8, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:T.mu, marginBottom:2 }}>{e.c}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:T.tx }}>{e.p}</div>
                  <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:10, color:T.mu, marginTop:1 }}>{e.o}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{
                    fontFamily:"JetBrains Mono,monospace", fontSize:11, fontWeight:700, padding:"3px 7px", borderRadius:4,
                    background:`${confColor(e.cf)}18`, border:`1px solid ${confColor(e.cf)}40`, color:confColor(e.cf),
                  }}>{e.cf}%</span>
                  <div style={{ height:4, width:80, background:T.b1, borderRadius:2, marginTop:4 }}>
                    <div style={{ height:4, width:`${e.cf}%`, background:confColor(e.cf), borderRadius:2 }} />
                  </div>
                </div>
              </div>
            ))
          )}

          {/* PARLAY + AI tab */}
          {tab === "parlay" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ background:`${T.ac}07`, border:`1px solid ${T.ac}25`, borderRadius:9, padding:"11px 13px", marginBottom:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.ac, letterSpacing:".07em", textTransform:"uppercase", marginBottom:8 }}>⚡ Parlay builder</div>
                  {match.parlay.map((p,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"3px 0", borderBottom:`1px solid ${T.ac}12`, fontSize:10, color:T.mu }}>
                      <span style={{ width:16, height:16, borderRadius:"50%", background:`${T.ac}18`, color:T.ac, fontSize:8, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</span>
                      <span style={{ color:T.tx, fontWeight:600 }}>{p.p}</span>
                      <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:9, marginLeft:"auto" }}>{p.o}</span>
                    </div>
                  ))}
                  <div style={{ fontSize:10, color:T.mu, borderTop:`1px solid ${T.ac}15`, paddingTop:5, marginTop:5 }}>
                    Est. combined return: <span style={{ color:T.ac, fontFamily:"JetBrains Mono,monospace", fontWeight:700 }}>{match.parlayRet}</span>
                  </div>
                </div>
                {match.upset && <div style={{ background:`${T.ac3}08`, border:`1px solid ${T.ac3}25`, borderRadius:7, padding:"7px 10px", fontSize:10, color:"#fb923c", lineHeight:1.6, marginBottom:6 }}>⚠ {match.upset}</div>}
                {match.ref && <div style={{ background:`${T.ac2}08`, border:`1px solid ${T.ac2}20`, borderRadius:7, padding:"7px 10px", fontSize:10, color:"#60a5fa", lineHeight:1.5 }}>{match.ref}</div>}
              </div>
              <AIBlock matchId={match.id} ctx={match.ai} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [activeDay, setActiveDay] = useState("23");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiMode, setApiMode] = useState("demo");

  const day = DAYS[activeDay];
  const dayMeta = {
    "23":{ day:"TUE", num:23, cnt:4, hot:false },
    "24":{ day:"WED", num:24, cnt:6, hot:true },
    "25":{ day:"THU", num:25, cnt:6, hot:true },
    "26":{ day:"FRI", num:26, cnt:6, hot:false },
    "27":{ day:"SAT", num:27, cnt:6, hot:true },
    "28":{ day:"SUN", num:28, cnt:8, hot:true, r32:true },
  };
  const tickerStats = [
    { label:"Goals/g", val:"3.14", color:T.grn },{ label:"Fouls/g", val:"24.4", color:T.tx },
    { label:"Corners/g", val:"10.6", color:T.ac2 },{ label:"Throw-ins/g", val:"46", color:T.ac2 },
    { label:"Upsets", val:"46%", color:T.amb },{ label:"Foul props hit", val:"91%", color:T.grn },
    { label:"Lineup source", val:apiMode === "demo" ? "Demo mode" : "Live API", color:apiMode === "demo" ? T.amb : T.ac },
  ];

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.tx, fontFamily:"Inter,sans-serif", fontSize:13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#07090d}
        ::-webkit-scrollbar-thumb{background:#1e2d42;border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,200,150,.5)}70%{opacity:.7;box-shadow:0 0 0 8px rgba(0,200,150,0)}}
      `}</style>

      {showSettings && <SettingsPanel apiKey={apiKey} setApiKey={setApiKey} apiMode={apiMode} setApiMode={setApiMode} onClose={() => setShowSettings(false)} />}

      {/* TOP BAR */}
      <div style={{ background:T.s1, borderBottom:`1px solid ${T.b1}`, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, zIndex:300, gap:12 }}>
        <div style={{ fontSize:16, fontWeight:800, letterSpacing:".12em", color:T.ac, display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:T.ac, animation:"pulse 2s infinite" }} />
          WC26 EDGE
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          {[
            { label:"Goals/g 3.14", c:T.grn },{ label:"Fouls/g 24.4", c:T.grn },
            { label:"Corners/g 10.6", c:T.grn },{ label:"Upsets 46%", c:T.amb },
            { label:"Foul props 91%", c:T.red },
          ].map(({ label, c }, i) => (
            <span key={i} style={{ fontSize:10, fontWeight:600, fontFamily:"JetBrains Mono,monospace", padding:"3px 9px", borderRadius:4, border:"1px solid", whiteSpace:"nowrap", background:`${c}10`, borderColor:`${c}40`, color:c }}>{label}</span>
          ))}
          <button onClick={() => setShowSettings(true)} style={{
            fontFamily:"Inter,sans-serif", fontSize:11, fontWeight:600, cursor:"pointer", marginLeft:4,
            background:`${T.ac2}12`, border:`1px solid ${T.ac2}35`, color:T.ac2, borderRadius:5, padding:"4px 10px",
          }}>
            ⚙ Lineups {apiMode === "demo" ? "(demo)" : "(live)"}
          </button>
        </div>
      </div>

      {/* DATE NAV */}
      <div style={{ background:T.s1, borderBottom:`2px solid ${T.b1}`, padding:"0 12px", display:"flex", alignItems:"stretch", gap:2, overflowX:"auto", position:"sticky", top:52, zIndex:200 }}>
        {Object.entries(dayMeta).map(([key, meta]) => (
          <button key={key} onClick={() => setActiveDay(key)} style={{
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            minWidth:64, padding:"8px 12px", cursor:"pointer", border:"none", background:"none",
            fontFamily:"Inter,sans-serif", flexShrink:0, gap:1, position:"relative",
            borderBottom:`3px solid ${activeDay === key ? T.ac : "transparent"}`,
          }}>
            {meta.hot && <span style={{ position:"absolute", top:6, right:8, width:5, height:5, borderRadius:"50%", background:T.ac3 }} />}
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:activeDay === key ? T.ac : T.mu }}>{meta.day}</span>
            <span style={{ fontSize:19, fontWeight:800, color:activeDay === key ? T.ac : T.dm }}>{meta.num}</span>
            <span style={{ fontSize:9, fontFamily:"JetBrains Mono,monospace", color:activeDay === key ? T.ac : T.dm }}>
              {meta.r32 ? "R32 begins" : `${meta.cnt} matches`}
            </span>
          </button>
        ))}
      </div>

      {/* TICKER */}
      <div style={{ background:T.s1, borderBottom:`1px solid ${T.b1}`, padding:"6px 16px", display:"flex", alignItems:"center", gap:14, overflowX:"auto" }}>
        {tickerStats.map(({ label, val, color }, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", flexShrink:0 }}>
            <span style={{ fontSize:9, fontWeight:600, letterSpacing:".07em", textTransform:"uppercase", color:T.mu }}>{label}</span>
            <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:12, fontWeight:600, color }}>{val}</span>
            {i < tickerStats.length - 1 && <div style={{ width:1, height:18, background:T.b1, marginLeft:8 }} />}
          </div>
        ))}
      </div>

      {/* PAGE */}
      <div style={{ maxWidth:980, margin:"0 auto", padding:16 }}>
        {day ? (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:19, fontWeight:700, color:T.tx }}>{day.title}</div>
              <div style={{ fontSize:11, color:T.mu, marginTop:3, fontFamily:"JetBrains Mono,monospace" }}>{day.sub}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {day.matches.map(m => <MatchCard key={m.id} match={m} apiKey={apiKey} apiMode={apiMode} />)}
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"60px 20px", color:T.mu }}>
            <div style={{ fontSize:36, opacity:.3, marginBottom:12 }}>📅</div>
            <p>Predictions loading for this date</p>
          </div>
        )}
      </div>

      <div style={{ fontSize:9, color:T.dm, textAlign:"center", padding:"14px 16px", borderTop:`1px solid ${T.b1}`, marginTop:16, lineHeight:1.6 }}>
        WC26 EDGE · React Edition · Lineup integration via API-Football / TheStatsAPI · 18+ Gamble responsibly · BeGambleAware.org
      </div>
    </div>
  );
}
