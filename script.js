(() => {
  const STORAGE_KEY = 'jp_saved_names';
  const playerNameInput = document.getElementById('playerName');
  // --- painel flutuante de histórico (inicializa após DOM pronto; não altera lógica existente) ---
  document.addEventListener('DOMContentLoaded', ()=>{
    const HISTORY_KEY = 'jp_matches_history';
    function loadHoverHistory(){ try{ const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; } }
    function saveHoverHistory(list){ try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }catch(e){} }

    const floatContainer = document.getElementById('historyFloat');
    const historyPanelHover = document.getElementById('historyPanelHover');
    const hoverRanking = document.getElementById('hoverRanking');
    const hoverMatches = document.getElementById('hoverMatches');
    const hoverClear = document.getElementById('hoverClear');

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
      floatContainer.addEventListener('mouseenter', ()=>{ if(!floatContainer.classList.contains('dragging')){ floatContainer.classList.add('open'); if(historyPanelHover) historyPanelHover.setAttribute('aria-hidden','false'); renderHover(); } });
      floatContainer.addEventListener('mouseleave', ()=>{ if(!floatContainer.classList.contains('dragging')){ floatContainer.classList.remove('open'); if(historyPanelHover) historyPanelHover.setAttribute('aria-hidden','true'); } });
      // draggable support (mouse + touch) — position is NOT persisted across page reloads
      let dragging = false; let startX=0,startY=0, startLeft=0,startTop=0;
      const icon = floatContainer.querySelector('.history-icon');
      function clamp(val, min, max){ return Math.max(min, Math.min(max, val)); }
      function onPointerMove(e){
        if(!dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX; const dy = clientY - startY;
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
        // do not persist position — it will reset on page reload
      }
      function onPointerDown(e){
        e.preventDefault(); dragging = true; floatContainer.classList.add('dragging');
        startX = e.touches ? e.touches[0].clientX : e.clientX; startY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = floatContainer.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top;
        document.addEventListener('mousemove', onPointerMove); document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, {passive:false}); document.addEventListener('touchend', onPointerUp);
      }
      if(icon){ icon.addEventListener('mousedown', onPointerDown); icon.addEventListener('touchstart', onPointerDown, {passive:false}); }
    }

    if(hoverClear){ hoverClear.addEventListener('click', ()=>{ if(confirm('Limpar histórico?')){ saveHoverHistory([]); renderHover(); } }); }

    window.jpAddMatch = function(match){ try{ const list = loadHoverHistory(); list.unshift(match); saveHoverHistory(list); renderHover(); }catch(e){} };
  });
  // --- fim painel flutuante de histórico ---
  const nameListEl = document.getElementById('nameList');
  const playerSticks = document.getElementById('playerSticks');
  const playerGuess = document.getElementById('playerGuess');
  const betBtn = document.getElementById('betBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const log = document.getElementById('log');
  const modalOverlay = document.getElementById('modalOverlay');
  const floating = document.getElementById('floatingResult');
  const resultDetails = document.getElementById('resultDetails');
  const resultWinner = document.getElementById('resultWinner');
  const closeFloat = document.getElementById('closeFloat');

  let roundCount = 1;
  let firstRound = true;
  let computerPick = null;
  let computerGuess = null;
  let pendingNextRound = false;
  const roundDisplay = document.getElementById('roundDisplay');

  function updateRoundDisplay(){
    roundDisplay.textContent = `Rodada ${roundCount}`;
  }

  function loadNames(){
    const raw = localStorage.getItem(STORAGE_KEY);
    try{
      return raw ? JSON.parse(raw) : [];
    }catch(e){return []}
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
    // atualizar o nome exibido na barra lateral esquerda
    const leftNameEl = document.getElementById('leftName');
    if(leftNameEl) leftNameEl.textContent = name;
  }

  // salvar automaticamente quando o usuário confirma o nome (Enter) ou sai do campo (blur)
  playerNameInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      saveCurrentName();
      // após confirmar, focar no próximo controle útil
      const next = document.getElementById('playerSticks');
      if(next) next.focus();
    }
  });
  playerNameInput.addEventListener('blur', ()=>{ saveCurrentName(); });
  // atualizar a barra lateral enquanto digita
  playerNameInput.addEventListener('input', ()=>{
    const leftNameEl = document.getElementById('leftName');
    const v = (playerNameInput.value||'').trim() || 'Jogador';
    if(leftNameEl) leftNameEl.textContent = v;
  });

  // definir nome inicial na barra (caso já haja valor no input)
  const initialLeft = document.getElementById('leftName');
  if(initialLeft){ initialLeft.textContent = (playerNameInput.value||'').trim() || 'Jogador'; }

  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function startRound(){
    firstRound = (roundCount === 1);
    // gera escolha do computador (na primeira rodada não pode ser 0; nas seguintes pode)
    const minPick = firstRound ? 1 : 0;
    computerPick = randInt(minPick, 3);
    // computador pede um total aleatório: capado pelo que ele pode jogar (até +3) e pelo limite 6
    const capTotal = Math.min(6, computerPick + 3);
    const extraMax = capTotal - computerPick;
    const extra = randInt(0, extraMax);
    computerGuess = computerPick + extra;
    pendingNextRound = false;
    // esconder sempre até apostar
    logMessage(firstRound ? 'Primeira partida: computador e jogador não podem pedir ou jogar 0; pedido mínimo = 2.' : 'Nova rodada iniciada. Informe seu pedido total (0-6) e jogue (0-3).');
    // habilitar/desabilitar a opção 0 conforme a rodada (0 não permitido na primeira rodada)
    const opt0 = playerSticks.querySelector('option[value="0"]');
    if(opt0) opt0.disabled = firstRound;
    // ajustar min do playerGuess (na primeira rodada >=1, nas seguintes >=0)
    playerSticks.disabled = true;
    // na primeira partida o pedido mínimo é 2
    playerGuess.min = firstRound ? 2 : 0;
    // reset máximo do pedido (padrão 6)
    playerGuess.max = 6;
    playerGuess.value = '';
    updateRoundDisplay();
  }

  function updatePlayerGuessMin(){
    const pick = Number(playerSticks.value || 0);
    const baseMin = firstRound ? 2 : 0;
    const minVal = Math.max(baseMin, pick);
    playerGuess.min = minVal;
    // ajustar máximo dependendo do pick e regras:
    // se pick == 0 => max 3 (regra anterior)
    // se pick < 3 => max 5 (não pode pedir 6 se jogar menos de 3)
    // se pick >=3 => max 6
    let maxVal = Math.min(6, pick + 3);
    // garantir regra adicional específica: se pick === 0, max 3 (já coberto por pick+3)
    playerGuess.max = maxVal;
    if(Number(playerGuess.value) < minVal) playerGuess.value = minVal;
    if(Number(playerGuess.value) > maxVal) playerGuess.value = maxVal;
  }

  playerSticks.addEventListener('change', ()=>{
    // quando o jogador escolhe palitinhos, validar se o pedido total já satisfaz a regra
    const pPick = Number(playerSticks.value);
    const pGuess = Number(playerGuess.value);
      if(isNaN(pGuess)){
        logWarning('Informe primeiro o pedido total antes de escolher seus palitinhos.');
        playerSticks.value = '';
        playerSticks.disabled = true;
        return;
      }
    if(pGuess < pPick){
      logWarning('O pedido total do jogador não pode ser menor que a quantidade de palitinhos escolhida. Ajustando sua escolha.');
      // ajustar a escolha do jogador para o máximo permitido pelo pedido
      const baseMin = firstRound ? 1 : 0;
      const allowed = Math.min(3, Math.max(baseMin, Math.floor(pGuess)));
      playerSticks.value = String(allowed);
    }
    // após ajuste, atualizar limites do pedido (max/min)
    updatePlayerGuessMin();
  });

  // quando o jogador informa o pedido total, o computador faz seu palpite baseado no seu pick e numa previsão do jogador
  playerGuess.addEventListener('change', ()=>{
    const pGuessVal = Number(playerGuess.value);
    const minAllowed = firstRound ? 2 : 0;
      if(isNaN(pGuessVal) || pGuessVal < minAllowed || pGuessVal > 6){ logWarning(`Pedido total inválido. Informe um valor entre ${minAllowed} e 6.`); return; }
    // habilitar escolha de palitinhos apenas após pedido válido
    playerSticks.disabled = false;
    // computador determina seu palpite: computerPick + estimativa do que jogador irá escolher (0..3)
    // estimativa deve resultar em total <=6 (ou <=3 se computerPick==0) e diferente do pedido do jogador quando possível
    const candidatesEstimates = [];
    const capTotal = Math.min(6, computerPick + 3);
    for(let est=0; est<=3; est++){
      const possibleTotal = computerPick + est;
      if(possibleTotal <= capTotal && possibleTotal !== pGuessVal) candidatesEstimates.push(est);
    }
    let chosenEstimate = 0;
    if(candidatesEstimates.length === 0){
      // se não houver estimativa que evite colisão, escolha qualquer est que mantenha total<=6
      for(let est=0; est<=3; est++){
        if(computerPick + est <= 6) candidatesEstimates.push(est);
      }
    }
    if(candidatesEstimates.length > 0){
      chosenEstimate = candidatesEstimates[randInt(0, candidatesEstimates.length-1)];
    }
    computerGuess = computerPick + chosenEstimate;
    // não revelar o palpite do computador ainda — será mostrado apenas ao apostar
    if (computerGuess === pGuessVal) {
      // aviso visível quando o pedido do jogador é igual ao do computador
      log.classList.add('warning');
      log.textContent = `Aviso: seu pedido (${pGuessVal}) é igual ao pedido do Computador.`;
    } else {
      log.classList.remove('warning');
      log.textContent = `Pedido armazenado: você pediu ${pGuessVal}. Computador já definiu seu palpite (oculto).`;
    }
  });
  // garantir que o pedido seja sempre número inteiro e dentro dos limites enquanto digita
  playerGuess.addEventListener('input', ()=>{
    let v = playerGuess.value;
    if(v === '') return;
    // converter para numero inteiro
    let n = Math.floor(Number(v));
    if(isNaN(n)) n = 0;
    const minAllowed = firstRound ? 2 : 0;
    const maxAllowed = Number(playerGuess.max || 6);
    if(n < minAllowed) n = minAllowed;
    if(n > maxAllowed) n = maxAllowed;
    if(String(n) !== v) playerGuess.value = String(n);
  });

  function logMessage(txt){ log.textContent = txt; log.classList.remove('warning'); }
  function logWarning(txt){ log.textContent = txt; log.classList.add('warning'); }
  function clearLogWarning(){ log.classList.remove('warning'); }

  // mostra modal de perdedor quando uma barra chega a 0%
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

  betBtn.addEventListener('click', ()=>{
    // garantir limites atualizados antes de validar
    updatePlayerGuessMin();
    const player = (playerNameInput.value||'').trim();
    if(!player){ logWarning('Escolha ou informe o nome do jogador.'); return; }
    let pPick = Number(playerSticks.value);
    let pGuess = Number(playerGuess.value);
      const baseMin = firstRound ? 1 : 0;
      if(isNaN(pPick) || pPick < baseMin || pPick > 3){ logWarning(`Escolha entre ${baseMin} e 3 palitinhos.`); return; }
    // recalcular dinamicamente o máximo permitido baseado no pick (garantia no clique)
    const dynamicMax = (pPick === 0) ? 3 : (pPick < 3 ? 5 : 6);
    // se o valor atual do input estiver fora do máximo, ajustar e impedir prosseguir
    if(isNaN(pGuess) || pGuess < baseMin || pGuess < pPick){ logWarning(`O valor pedido deve ser entre ${baseMin} e ${dynamicMax} e não pode ser menor que sua escolha.`); return; }
    if(pGuess > dynamicMax){
      // ajustar o input para o máximo permitido e avisar
      playerGuess.value = String(dynamicMax);
      logMessage(`Pedido inválido: quando joga ${pPick} palitinho(s) o máximo permitido é ${dynamicMax}. Valor ajustado para ${dynamicMax}. Clique novamente para confirmar.`);
      return;
    }
    // Regras específicas
    if(pPick === 0 && pGuess > 3){ logWarning('Regra: quem joga 0 palitinhos não pode pedir mais que 3. Ajuste seu pedido.'); return; }
    if(pGuess === 6 && pPick < 3){ logWarning('Regra: quem pede 6 palitinhos deve jogar pelo menos 3. Ajuste sua escolha.'); return; }
    // Regra adicional: se o jogador jogar 0 palitinhos, ele não pode pedir mais que 3
    //if(pPick === 3 && pGuess > 0){ alert('Regra: quem joga 0 palitinhos não pode pedir mais que 3. Ajuste seu pedido.'); return; }

    // revelar escolhas do computador agora
    const cPick = computerPick;
    let cGuess = computerGuess;
    // garantir que o computador não peça o mesmo total que o jogador
    if(cGuess === pGuess){
      const candidates = [];
      const maxTotal = (cPick === 0) ? 3 : 6;
      for(let v = cPick; v <= maxTotal; v++){
        if(v !== pGuess) candidates.push(v);
      }
      if(candidates.length > 0){
        cGuess = candidates[randInt(0, candidates.length - 1)];
        computerGuess = cGuess; // atualizar estado do computador
      }
    }
    const total = pPick + cPick;

    // mostrar caixa flutuante com detalhes
    resultDetails.innerHTML = `<div>Palitinhos Jogados ${player} = ${pPick} e Computador = ${cPick}</div>
      <div>Palitinhos Pedidos ${player} = ${pGuess} e Computador = ${cGuess}</div>
      <div>Total de Palitinhos ${total}</div>`;

    let winnerText = '';
    const playerHits = (pGuess === total);
    const computerHits = (cGuess === total);
    if(playerHits && computerHits){ winnerText = `Empate: ${player} e Computador`; }
    else if(playerHits){ winnerText = `O vencedor é ${player}`; }
    else if(computerHits){ winnerText = `O vencedor é Computador`; }
    else { winnerText = 'Segunda rodada'; }

    resultWinner.textContent = winnerText;
    // ajustar texto do botão de fechar para próxima rodada
    closeFloat.textContent = 'Próxima rodada';
    modalOverlay.hidden = false;

    // limpar valores das caixas após mostrar resultado
    try{
      playerGuess.value = '';
      playerSticks.value = '';
      // resetar estado de disabled conforme rodada (playerSticks será desabilitado até novo pedido)
      playerSticks.disabled = true;
      // atualizar limites
      updatePlayerGuessMin();
    }catch(e){}

    // gravar a partida no histórico (se o helper estiver disponível)
    try{
      const winnerName = (playerHits && computerHits) ? 'Empate' : (playerHits ? player : (computerHits ? 'Computador' : ''));
      const match = { round: roundCount, player, pPick, pGuess, cPick, cGuess, total, winner: winnerName };
      if(window && typeof window.jpAddMatch === 'function') window.jpAddMatch(match);
    }catch(e){ /* não bloquear o jogo se houver erro */ }

      // reduzir 5% na barra do perdedor
      try{
        const leftFill = document.getElementById('leftFill');
        const rightFill = document.getElementById('rightFill');
        const leftPercent = document.getElementById('leftPercent');
        const rightPercent = document.getElementById('rightPercent');
        function adjustBar(elFill, elPercent, delta){
          if(!elFill || !elPercent) return;
          const current = parseInt(elPercent.textContent.replace('%','')) || 100;
          const next = Math.max(0, current - delta);
          // agora as fills são verticais (height)
          elFill.style.height = next + '%';
          elPercent.textContent = next + '%';
          // se a barra atingir 0%: animação + alerta
          if(next === 0){
            elFill.classList.add('empty');
            const barInner = elFill.closest('.bar-inner');
            if(barInner){ barInner.classList.add('shake'); setTimeout(()=> barInner.classList.remove('shake'), 800); }
            const loserName = (elFill.id === 'leftFill') ? (document.getElementById('leftName') ? document.getElementById('leftName').textContent : 'Jogador') : (document.getElementById('rightName') ? document.getElementById('rightName').textContent : 'Computador');
            setTimeout(()=> showLoserModal(loserName), 300);
          }
        }
        if(playerHits && !computerHits){
          // player won -> computer loses
          adjustBar(rightFill, rightPercent, 5);
        } else if(computerHits && !playerHits){
          // computer won -> player loses
          adjustBar(leftFill, leftPercent, 5);
        }
      }catch(e){ }
    // se não houver vencedor, aguarda o clique em 'Próxima rodada' para iniciar próxima rodada
    if(!playerHits && !computerHits){ pendingNextRound = true; }
    else { pendingNextRound = false; /* jogo terminou — permite próxima rodada ao clicar */ }
  });

  newGameBtn.addEventListener('click', ()=>{
    // recarrega a página para reiniciar completamente o estado
    window.location.reload();
  });

  closeFloat.addEventListener('click', ()=>{
    // ao clicar em Próxima rodada: fechar caixa, incrementar rodada, iniciar nova rodada
    modalOverlay.hidden = true;
    roundCount += 1;
    updateRoundDisplay();
    // iniciar nova rodada (define firstRound conforme roundCount)
    startRound();
  });

  // inicialização
  populateNames();
  updateRoundDisplay();
  startRound();
})();
