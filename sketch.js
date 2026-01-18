let game;

function setup() {
  createCanvas(windowWidth, windowHeight);
  resetSeries();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function resetSeries() {
  game = {
    state: 'TITLE', raceCount: 1, maxRaces: 4,
    seriesScores: [], windAngle: 0, windShift: 0, windSpeed: 1.0
  };
  initRace();
}

function initRace() {
  game.timer = 30; game.isStarted = false; game.isFinished = false;
  game.lineVisible = true; 
  game.player = {
    x: 400, y: 500, rot: 0, speed: 0, sheet: 0.5, color: '#FFFF00',
    isDNS: false, isFinished: false, currentMarkIndex: 0, penalty: 0, penaltyRot: 0,
    finishRank: 0, radius: 12
  };
  game.npcs = [];
  for (let i = 0; i < 9; i++) {
    game.npcs.push({
      x: 200 + (i * 50), y: 550 + (random(-15, 15)), rot: 0, speed: 0, sheet: 0.7,
      color: '#A0A0A0', currentMarkIndex: 0, isFinished: false, penaltyTicks: 0,
      finishRank: 0, radius: 12
    });
  }
  game.course = [
    { id: 'UpMark',    x: 400,  y: -1500, color: 'red',   name: '1:UP' },
    { id: 'SideMark',  x: 2400, y: 0,     color: 'blue',  name: '2:SIDE' }, 
    { id: 'DownMark',  x: 400,  y: 1500,  color: 'green', name: '3:DOWN' },
    { id: 'FinishLine', y: -1650 }
  ];
  game.finishCount = 0;
}

function draw() {
  if (game.state === 'TITLE') drawTitleScreen();
  else if (game.state === 'RACING') runRaceLogic();
  else if (game.state === 'RESULT') drawRaceResult();
  else if (game.state === 'SERIES_FINAL') drawSeriesFinal();
}

function drawTitleScreen() {
  background(0, 105, 148); textAlign(CENTER); fill(255);
  textSize(30); text("INAGE REGATTA 2026\n(Mobile Edition)", width/2, height/2 - 50);
  textSize(18); text("TOUCH TO START", width/2, height/2 + 100);
  if (mouseIsPressed) game.state = 'RACING';
}

function runRaceLogic() {
  updateTimer(); updateEnvironment(); 
  handleTouchInput(); // スマホ用操作
  updateBoatPhysics(game.player, true); 
  game.npcs.forEach(n => updateBoatPhysics(n, false)); 
  checkCollisions(); checkRules(); 
  game.npcs.forEach(n => checkMarkRounding(n));
  checkMarkRounding(game.player);

  if (!game.player.isFinished && game.player.y < game.course[3].y && game.player.currentMarkIndex >= 3) {
    game.finishCount++;
    game.player.finishRank = game.player.isDNS ? "DNS" : game.finishCount;
    game.player.isFinished = true; game.state = 'RESULT';
  }
  drawRaceScene();
  drawTouchControls(); // 操作ガイド表示
}

// スマホ操作：画面左側で旋回、右側でセール調整
function handleTouchInput() {
  if (touches.length > 0) {
    for (let t of touches) {
      if (t.x < width / 2) {
        // 画面左半分：左右旋回
        if (t.y > height / 2) {
          if (t.x < width / 4) game.player.rot -= 0.05;
          else game.player.rot += 0.05;
        }
      } else {
        // 画面右半分：上下でセール調整
        game.player.sheet = map(t.y, height, height/2, 0, 1, true);
      }
    }
  }
}

function updateBoatPhysics(b, isPlayer) {
  if (b.isFinished) return;
  if (isPlayer && b.penalty > 0) {
    b.penaltyRot += 0.08;
    if (b.penaltyRot >= TWO_PI * 1.8) { b.penalty = 0; b.penaltyRot = 0; }
  } else if (!isPlayer) {
    if (b.penaltyTicks > 0) { b.rot += 0.2; b.penaltyTicks--; } 
    else {
      let target = game.course[b.currentMarkIndex];
      let targetY = game.isStarted ? target.y : 350;
      let ang = atan2(target.x - b.x, b.y - targetY);
      let wind = game.windAngle + game.windShift;
      let rel = (ang - wind) % TWO_PI; if (abs(rel) < 0.6) ang = wind + (rel > 0 ? 0.7 : -0.7);
      b.rot = lerp(b.rot, ang, 0.05);
    }
  }
  let windDir = game.windAngle + game.windShift;
  let diff = abs((b.rot - windDir) % TWO_PI); if (diff > PI) diff = TWO_PI - diff;
  let movePower = (isPlayer ? b.penalty > 0 : b.penaltyTicks > 0) ? 0.005 : 0.045; 
  if (diff < 0.5) b.speed *= 0.94; 
  else {
    let perf = map(diff, 0.5, PI, 0.8, 1.25); 
    b.speed = (b.speed + movePower * game.windSpeed * perf) * 0.96;
  }
  b.x += sin(b.rot) * b.speed; b.y -= cos(b.rot) * b.speed;
}

function checkCollisions() {
  let allBoats = [game.player, ...game.npcs];
  for (let i = 0; i < allBoats.length; i++) {
    for (let j = i + 1; j < allBoats.length; j++) {
      let b1 = allBoats[i], b2 = allBoats[j];
      if (b1.isFinished || b2.isFinished) continue;
      let d = dist(b1.x, b1.y, b2.x, b2.y);
      if (d < (b1.radius + b2.radius)) {
        let angle = atan2(b2.x - b1.x, b2.y - b1.y);
        b1.x -= sin(angle) * 3; b1.y -= cos(angle) * 3;
        b2.x += sin(angle) * 3; b2.y += cos(angle) * 3;
        let p = (isStarboard(b1.rot) && !isStarboard(b2.rot)) ? "B1" : 
                (!isStarboard(b1.rot) && isStarboard(b2.rot)) ? "B2" : (b1.y > b2.y ? "B1" : "B2");
        if (p === "B1") applyPenalty(b2); else applyPenalty(b1);
      }
    }
  }
}

function applyPenalty(b) {
  if (b === game.player) { if(b.penalty === 0) b.penalty = 1; }
  else { if(b.penaltyTicks === 0) b.penaltyTicks = 80; }
}

function checkMarkRounding(obj) {
  let t = game.course[obj.currentMarkIndex]; if (!t || !t.x) return;
  let d = dist(obj.x, obj.y, t.x, t.y);
  if (d < 120) {
    if (obj === game.player && d < 45 && obj.penalty === 0) obj.penalty = 1;
    if (d > 55 && d < 145) obj.currentMarkIndex++;
  }
}

function drawRaceScene() {
  background(0, 100, 150);
  push(); 
  translate(width/2 - game.player.x, height/2 - game.player.y);
  stroke(255, 30); for(let i=-2000; i<6000; i+=200){ line(i,-2500,i,2500); line(-2000,i,6000,i); }
  if(game.lineVisible){ stroke(255); strokeWeight(2); drawingContext.setLineDash([10,10]); line(-3000, 150, 6000, 150); drawingContext.setLineDash([]); }
  game.course.forEach((m, idx) => { if(m.x){ if(idx === game.player.currentMarkIndex){ noFill(); stroke(255,180); ellipse(m.x, m.y, 130, 130); } noStroke(); fill(m.color); ellipse(m.x, m.y, 50, 50); fill(255); textAlign(CENTER); textSize(20); text(m.name, m.x, m.y-40); }});
  game.npcs.forEach(n => drawBoat(n.x, n.y, n.rot, n.color, n.sheet));
  drawBoat(game.player.x, game.player.y, game.player.rot, game.player.color, game.player.sheet);
  pop();
  drawUI(); drawWindCompass();
}

function drawTouchControls() {
  noStroke(); fill(255, 50);
  rect(0, height/2, width/2, height/2); // 左旋回エリア
  rect(width/2, height/2, width/2, height/2); // セールエリア
  fill(255, 150); textAlign(CENTER); textSize(14);
  text("← 舵 →", width/4, height - 20);
  text("↑ セール調整 ↓", width * 0.75, height - 20);
}

function drawUI() {
  push(); fill(255); noStroke(); textAlign(LEFT); textSize(16);
  text("R: " + game.raceCount + " TIME: " + nf(abs(game.timer), 1, 1), 20, 30);
  let star = isStarboard(game.player.rot); fill(star ? "#00FF00" : "#FFCC00");
  text(star ? "STARBOARD" : "PORT", 20, 55); pop();
}

function isStarboard(r) { let w = game.windAngle + game.windShift; let rel = (r-w)%TWO_PI; if(rel<0) rel+=TWO_PI; return rel<PI; }
function updateTimer() { game.timer -= 1/60; if(!game.isStarted && game.timer <= 0) game.isStarted=true; if(game.isStarted && game.timer <= -45) game.lineVisible=false; }
function updateEnvironment() { game.windShift = sin(frameCount*0.02)*0.4; game.windSpeed = map(noise(frameCount*0.01),0,1,0.5,2.5); }
function checkRules() { if (!game.isStarted && game.player.y < 150) game.player.isDNS = true; }
function drawBoat(x, y, r, c, s) { push(); translate(x,y); rotate(r); fill(c); stroke(0); triangle(0,-15,8,15,-8,15); let side = isStarboard(r)?1:-1; stroke(255); strokeWeight(4); line(0,5,sin(map(s,0,1,PI/3,0)*side)*20,20); pop(); }
function drawWindCompass() { let cx = width-50, cy = 50, r = 25; push(); translate(cx,cy); stroke(255); fill(0,100); ellipse(0,0,r*2); rotate(game.windAngle + game.windShift); stroke(255,50,50); strokeWeight(3); line(0,-r+5,0,r-5); fill(255,0,0); noStroke(); triangle(-4,r-10,4,r-10,0,r-2); pop(); }
function drawRaceResult() { background(0, 180); textAlign(CENTER); fill(255); textSize(40); text("FINISH!", width/2, height/2 - 40); let res = game.player.isDNS ? "DNS" : "RANK: " + game.player.finishRank; text(res, width/2, height/2 + 20); text("TOUCH TO NEXT", width/2, height/2 + 100); if (mouseIsPressed) { game.seriesScores.push(game.player.isDNS ? 11 : game.player.finishRank); if (game.raceCount >= game.maxRaces) game.state = 'SERIES_FINAL'; else { game.raceCount++; initRace(); game.state = 'TITLE'; } } }
function drawSeriesFinal() { background(20, 40, 60); textAlign(CENTER); fill(255); textSize(30); text("SERIES RESULT", width/2, 100); let tot = 0; for(let i=0; i<game.seriesScores.length; i++) { tot += game.seriesScores[i]; text("Race " + (i+1) + ": " + (game.seriesScores[i] === 11 ? "DNS" : game.seriesScores[i] + " pt"), width/2, 180 + i*40); } textSize(30); fill(255, 255, 0); text("TOTAL: " + tot + " pt", width/2, height-100); if (mouseIsPressed) resetSeries(); }
