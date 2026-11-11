(() => {
  const STORAGE_KEY = 'jp_saved_names';
  const playerNameInput = document.getElementById('playerName');
  const nameListEl = document.getElementById('nameList');
  const playerSticks = document.getElementById('playerSticks');
  const stickSelector = document.getElementById('stickSelector');
  const playerGuess = document.getElementById('playerGuess');
  const guessSelector = document.getElementById('guessSelector');
  const buttonSound = new Audio('sons/botao03.mp3');
  const coinSound = new Audio('sons/coin.mp3');
  const betBtn = document.getElementById('betBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const log = document.getElementById('log');
  const modalOverlay = document.getElementById('modalOverlay');
  const floating = document.getElementById('floatingResult');
  const resultDetails = document.getElementById('resultDetails');
  const resultWinner = document.getElementById('resultWinner');
  const closeFloat = document.getElementById('closeFloat');

  if (!playerNameInput || !nameListEl || !playerSticks || !stickSelector || !playerGuess || !guessSelector || !betBtn || !newGameBtn || !log || !modalOverlay || !resultDetails || !resultWinner || !closeFloat) {
    console.warn('Jogo do Palitinho: elementos obrigatórios não foram encontrados no DOM.');
    return;
  }

  // --- painel flutuante de histórico ---
  const HISTORY_KEY = 'jp_matches_history';
  function loadHoverHistory(){ try{ const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; } }
  function saveHoverHistory(list){ try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }catch(e){} }

  function initHistoryPanel(){
    const floatContainer = document.getElementById('historyFloat');
    const historyPanelHover = document.getElementById('historyPanelHover');
    const hoverRanking = document.getElementById('hoverRanking');
    const hoverMatches = document.getElementById('hoverMatches');
    const hoverClear = document.getElementById('hoverClear');
    let pinnedOpen = false;

    function setPanelOpen(open){
      if(!floatContainer) return;
      floatContainer.classList.toggle('open', open);
      if(historyPanelHover) historyPanelHover.setAttribute('aria-hidden', String(!open));
    }

    function renderHover(){
      const arr = loadHoverHistory();
      const counts = {};
      arr.forEach(m=>{ if(!m.winner || m.winner === 'Empate') return; counts[m.winner] = (counts[m.winner]||0)+1; });
      const ranked = Object.keys(counts).map(k=>({name:k,wins:counts[k]})).sort((a,b)=>b.wins-a.wins);
      if(hoverRanking){
        if(ranked.length===0) hoverRanking.textContent = 'Sem vitórias registradas.';
        else hoverRanking.innerHTML = ranked.map(r=>`<div>${r.name}: ${r.wins} vitória(s)</div>`).join('');
      }
      if(hoverMatches){
        hoverMatches.innerHTML = '';
        if(arr.length===0){ hoverMatches.textContent = 'Nenhuma partida registrada.'; return; }
        arr.slice(0,30).forEach(m=>{
          const d = document.createElement('div'); d.className = 'match';
          d.innerHTML = `<div><strong>R${m.round}</strong> ${m.player} (${m.pPick}/${m.pGuess}) vs C(${m.cPick}/${m.cGuess})</div><div>Total: ${m.total} — <small>${m.winner}</small></div>`;
          hoverMatches.appendChild(d);
        });
      }
    }

    if(floatContainer){
      const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      floatContainer.addEventListener('mouseenter', ()=>{ if(supportsHover && !floatContainer.classList.contains('dragging')){ setPanelOpen(true); renderHover(); } });
      floatContainer.addEventListener('mouseleave', ()=>{ if(supportsHover && !pinnedOpen && !floatContainer.classList.contains('dragging')) setPanelOpen(false); });
      let dragging = false; let startX=0,startY=0, startLeft=0,startTop=0;
      const icon = floatContainer.querySelector('.history-icon');
      if(icon){
        icon.addEventListener('click', ()=>{
          if(supportsHover){
            pinnedOpen = !pinnedOpen;
            setPanelOpen(pinnedOpen);
          } else {
            setPanelOpen(!floatContainer.classList.contains('open'));
          }
          renderHover();
        });
      }
      function clamp(val, min, max){ return Math.max(min, Math.min(max, val)); }
      function onPointerMove(e){
        if(!dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX; const dy = clientY - startY;
        if(Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if(e.cancelable) e.preventDefault();
        const newLeft = clamp(startLeft + dx, 8, window.innerWidth - floatContainer.offsetWidth - 8);
        const newTop = clamp(startTop + dy, 8, window.innerHeight - floatContainer.offsetHeight - 8);
        floatContainer.style.left = newLeft + 'px';
        floatContainer.style.top = newTop + 'px';
        floatContainer.style.right = 'auto'; floatContainer.style.bottom = 'auto';
      }
      function onPointerUp(){
        if(!dragging) return; dragging = false; floatContainer.classList.remove('dragging');
        document.removeEventListener('mousemove', onPointerMove); document.removeEventListener('mouseup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove); document.removeEventListener('touchend', onPointerUp);
      }
      function onPointerDown(e){
        dragging = true; floatContainer.classList.add('dragging');
        startX = e.touches ? e.touches[0].clientX : e.clientX; startY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = floatContainer.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top;
        document.addEventListener('mousemove', onPointerMove); document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, {passive:false}); document.addEventListener('touchend', onPointerUp);
      }
      if(icon){ icon.addEventListener('mousedown', onPointerDown); icon.addEventListener('touchstart', onPointerDown, {passive:false}); }
    }

    if(hoverClear){ hoverClear.addEventListener('click', ()=>{ if(confirm('Limpar histórico?')){ saveHoverHistory([]); renderHover(); } }); }
  }

  initHistoryPanel();
  window.jpAddMatch = function(match){ try{ const list = loadHoverHistory(); list.unshift(match); saveHoverHistory(list); }catch(e){} };
  // --- fim painel flutuante de histórico ---

  let roundCount = 1;
  let firstRound = true;
  let computerPick = null;
  let computerGuess = null;
  let pendingNextRound = false;
  const roundDisplay = document.getElementById('roundDisplay');

  function updateRoundDisplay(){
    if(roundDisplay) roundDisplay.textContent = `Jogada ${roundCount}`;
  }

  function loadNames(){
    const raw = localStorage.getItem(STORAGE_KEY);
    try{ return raw ? JSON.parse(raw) : []; }catch(e){return []}
  }

  function saveNames(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function populateNames(){
    const names = loadNames();
    nameListEl.innerHTML = '';
    names.forEach(n=>{
      const o = document.createElement('option'); o.value = n; nameListEl.appendChild(o);
    });
  }

  function saveCurrentName(){
    const name = (playerNameInput.value || '').trim();
    if(!name) return;
    const names = loadNames();
    if(!names.includes(name)){
      names.push(name);
      saveNames(names);
      populateNames();
    }
    const leftNameEl = document.getElementById('leftName');
    if(leftNameEl) leftNameEl.textContent = name;
  }

  playerNameInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      saveCurrentName();
      const next = guessSelector.querySelector('.guess-choice');
      if(next) next.focus();
    }
  });
  playerNameInput.addEventListener('blur', ()=>{ saveCurrentName(); });
  playerNameInput.addEventListener('input', ()=>{
    const leftNameEl = document.getElementById('leftName');
    const v = (playerNameInput.value||'').trim() || 'Jogador';
    if(leftNameEl) leftNameEl.textContent = v;
  });

  const initialLeft = document.getElementById('leftName');
  if(initialLeft){ initialLeft.textContent = (playerNameInput.value||'').trim() || 'Jogador'; }

  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function playButtonSound(onEnded){
    buttonSound.currentTime = 0;
    if(onEnded) buttonSound.addEventListener('ended', onEnded, {once:true});
    buttonSound.play().catch(error=>{
      console.warn('Não foi possível reproduzir o som dos botões:', error);
      if(onEnded){
        buttonSound.removeEventListener('ended', onEnded);
        onEnded();
      }
    });
  }

  function playCoinSound(){
    coinSound.currentTime = 0;
    coinSound.play().catch(error=>console.warn('Não foi possível reproduzir o som das bolinhas:', error));
  }

  document.addEventListener('click', (e)=>{
    const button = e.target.closest('button');
    if(button && button !== newGameBtn && !button.matches('.stick-choice, .guess-choice')) playButtonSound();
  });

  function updatePlayerSticks(){
    const choices = stickSelector.querySelectorAll('.stick-choice');
    let selectedCount = 0;
    choices.forEach(choice=>{
      if(choice.getAttribute('aria-pressed') === 'true') selectedCount += 1;
    });
    playerSticks.value = String(selectedCount);
  }

  stickSelector.addEventListener('click', (e)=>{
    const choice = e.target.closest('.stick-choice');
    if(!choice) return;
    choice.setAttribute('aria-pressed', String(choice.getAttribute('aria-pressed') !== 'true'));
    updatePlayerSticks();
    playCoinSound();
  });

  function updatePlayerGuess(){
    const choices = guessSelector.querySelectorAll('.guess-choice');
    let selectedCount = 0;
    choices.forEach(choice=>{
      if(choice.getAttribute('aria-pressed') === 'true') selectedCount += 1;
    });
    playerGuess.value = String(selectedCount);
  }

  function clearGuessSelection(){
    guessSelector.querySelectorAll('.guess-choice').forEach(choice=>choice.setAttribute('aria-pressed', 'false'));
    playerGuess.value = '0';
  }

  guessSelector.addEventListener('click', (e)=>{
    const choice = e.target.closest('.guess-choice');
    if(!choice) return;
    choice.setAttribute('aria-pressed', String(choice.getAttribute('aria-pressed') !== 'true'));
    updatePlayerGuess();
    playCoinSound();
  });

  // --- INÍCIO DA RONDA: SEM BLOQUEIOS, TOTAL LIBERDADE ---
  function startRound(){
    firstRound = (roundCount === 1);
    
    const minPickC = firstRound ? 1 : 0;
    computerPick = randInt(minPickC, 3);
    const capTotal = Math.min(6, computerPick + 3);
    const extraMax = capTotal - computerPick;
    const extra = randInt(0, extraMax);
    computerGuess = computerPick + extra;
    pendingNextRound = false;

    logMessage(firstRound ? 'Primeira Rodada: Jogar 0 palitinhos Perdi a Jogada!' : 'Nova rodada iniciada. Escolha à vontade e clique em Apostar.');

    stickSelector.querySelectorAll('.stick-choice').forEach(choice=>choice.setAttribute('aria-pressed', 'false'));
    playerSticks.value = '0';
    if(playerGuess) {
      playerGuess.disabled = false;
      playerGuess.min = 0;
      playerGuess.max = 6;
      clearGuessSelection();
    }

    updateRoundDisplay();
  }

  function logMessage(txt){ if(log){ log.textContent = txt; log.classList.remove('warning'); } }
  function logWarning(txt){ if(log){ log.textContent = txt; log.classList.add('warning'); } }

  function showLoserModal(loserName){
    try{
      const loserOverlay = document.getElementById('loserOverlay');
      const loserSub = document.getElementById('loserSub');
      const loserReload = document.getElementById('loserReload');
      if(loserSub) loserSub.textContent = loserName ? `${loserName} Bebeu tudo!` : 'Bebeu tudo!';
      if(loserOverlay) loserOverlay.hidden = false;
      if(betBtn) betBtn.disabled = true;
      if(loserReload) loserReload.onclick = ()=>{ window.location.reload(); };
    }catch(e){ }
  }

  function aplicarDanoBarra(perdedorTipo){
    try{
      const leftFill = document.getElementById('leftFill');
      const rightFill = document.getElementById('rightFill');
      const leftPercent = document.getElementById('leftPercent');
      const rightPercent = document.getElementById('rightPercent');

      function adjustBar(elFill, elPercent, delta){
        if(!elFill || !elPercent) return;
        const current = parseInt(elPercent.textContent.replace('%','')) || 100;
        const next = Math.max(0, current - delta);
        elFill.style.height = next + '%';
        elFill.style.setProperty('--progress', next + '%');
        elPercent.textContent = next + '%';
        if(next === 0){
          elFill.classList.add('empty');
          const barInner = elFill.closest('.bar-inner');
          if(barInner){ barInner.classList.add('shake'); setTimeout(()=> barInner.classList.remove('shake'), 800); }
          const loserName = (elFill.id === 'leftFill') ? (document.getElementById('leftName') ? document.getElementById('leftName').textContent : 'Jogador') : 'Computador';
          setTimeout(()=> showLoserModal(loserName), 300);
        }
      }

      if(perdedorTipo === 'player'){
        adjustBar(leftFill, leftPercent, 10);
      } else if(perdedorTipo === 'computer'){
        adjustBar(rightFill, rightPercent, 10);
      }
    }catch(e){}
  }

  // --- BOTÃO APOSTAR: AVALIA REGRAS COMO PUNIÇÃO ---
  betBtn.addEventListener('click', ()=>{
    const player = (playerNameInput.value||'').trim();
    if(!player){ logWarning('Escolha ou informe o nome do jogador.'); return; }
    
    let pPick = Number(playerSticks.value);
    let pGuess = Number(playerGuess.value);

    if(isNaN(pGuess)){
      logWarning('Insira o seu palpite total.');
      return;
    }

    let regraViolada = false;
    let motivoPunicao = '';

    if(firstRound && pPick === 0){
      regraViolada = true;
      motivoPunicao = 'Jogaste 0 palitinhos na 1ª Rodada (Regra proibida)!';
    } else if(pPick === 0 && pGuess > 3){
      regraViolada = true;
      motivoPunicao = 'Jogaste 0 palitinhos mas fizeste um palpite superior a 3!';
    } else if(pGuess < pPick){
      regraViolada = true;
      motivoPunicao = 'O teu palpite total é menor do que os palitinhos que jogaste!';
    } else if(pGuess === 6 && pPick < 3){
      regraViolada = true;
      motivoPunicao = 'Pediste 6 palitinhos mas jogaste menos do que 3!';
    }

    const cPick = computerPick;
    let cGuess = computerGuess;
    const total = pPick + cPick;

    if(regraViolada){
      resultDetails.innerHTML = `<div><strong>PUNIÇÃO!</strong> ${motivoPunicao}</div>
        <div>Palitinhos Jogados ${player} = ${pPick} e Computador = ${cPick}</div>
        <div>Palitinhos Pedidos ${player} = ${pGuess} e Computador = ${cGuess}</div>
        <div>Total de Palitinhos ${total}</div>`;

      resultWinner.textContent = `O vencedor é Computador (Por Punição)`;
      closeFloat.textContent = 'Próxima rodada';
      modalOverlay.hidden = false;

      aplicarDanoBarra('player');
      
      try{
        clearGuessSelection();
        stickSelector.querySelectorAll('.stick-choice').forEach(choice=>choice.setAttribute('aria-pressed', 'false'));
        playerSticks.value = '0';
      }catch(e){}

      pendingNextRound = true;
      return;
    }

    if(cGuess === pGuess){
      const candidates = [];
      const maxTotal = (cPick === 0) ? 3 : 6;
      for(let v = cPick; v <= maxTotal; v++){
        if(v !== pGuess) candidates.push(v);
      }
      if(candidates.length > 0){
        cGuess = candidates[randInt(0, candidates.length - 1)];
        computerGuess = cGuess;
      }
    }

    resultDetails.innerHTML = `<div>Palitinhos Jogados ${player} = ${pPick} e Computador = ${cPick}</div>
      <div>Palitinhos Pedidos ${player} = ${pGuess} e Computador = ${cGuess}</div>
      <div>Total de Palitinhos ${total}</div>`;

    let winnerText = '';
    const playerHits = (pGuess === total);
    const computerHits = (cGuess === total);
    
    if(playerHits && computerHits){ 
      winnerText = `Empate: ${player} e Computador`; 
    } else if(playerHits){ 
      winnerText = `O vencedor é ${player}`; 
      aplicarDanoBarra('computer');
    } else if(computerHits){ 
      winnerText = `O vencedor é Computador`; 
      aplicarDanoBarra('player');
    } else { 
      winnerText = 'Ninguém acertou nesta rodada'; 
    }

    resultWinner.textContent = winnerText;
    closeFloat.textContent = 'Próxima rodada';
    modalOverlay.hidden = false;

    try{
      clearGuessSelection();
      stickSelector.querySelectorAll('.stick-choice').forEach(choice=>choice.setAttribute('aria-pressed', 'false'));
      playerSticks.value = '0';
    }catch(e){}

    try{
      const winnerName = (playerHits && computerHits) ? 'Empate' : (playerHits ? player : (computerHits ? 'Computador' : ''));
      const match = { round: roundCount, player, pPick, pGuess, cPick, cGuess, total, winner: winnerName };
      if(window && typeof window.jpAddMatch === 'function') window.jpAddMatch(match);
    }catch(e){}

    if(!playerHits && !computerHits){ pendingNextRound = true; }
  });

  newGameBtn.addEventListener('click', ()=>{
    playButtonSound(()=>window.location.reload());
  });

  closeFloat.addEventListener('click', ()=>{
    modalOverlay.hidden = true;
    roundCount += 1;
    updateRoundDisplay();
    startRound();
  });

  // Inicialização
  populateNames();
  updateRoundDisplay();
  startRound();
})();
