const SUPABASE_URL = 'https://gktlnfifydbauetttewr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdGxuZmlmeWRiYXVldHR0ZXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjQ3MzAsImV4cCI6MjEwNzAwMDczMH0.Txq0iymbWJiUpmWQRCDzYID6hsbG7tt1mAF-p2LCpHg';

// グローバル変数
let supabase2 = null;
let currentRoomId = null;
let myColor = null; // "black" または "white"
let roomChannel = null;

document.addEventListener("DOMContentLoaded", () => {
  // Supabaseクライアントの安全な初期化
  if (window.supabase) {
    supabase2 = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("Supabase SDKが読み込まれていません。index.htmlのscriptタグの順序を確認してください。");
  }

  const board = document.getElementById("board");
  const boardContainer = document.querySelector(".board-container");
  const BOARD_SIZE = 17;

  let currentTurn = "black";
  let selectedCell = null;
  let blackSoulPoints = 0;
  let whiteSoulPoints = 0;

  let saviorCount = 0;
  let activeSavior = null;

  // 陣営ごとに独立して信徒系の撃破数を管理
  let blackBelieverDefeated = 0;
  let whiteBelieverDefeated = 0;

  let collapseLevel = 0;

  // モーダル処理
  const ruleBtn = document.getElementById("rule-btn");
  const ruleModal = document.getElementById("rule-modal");
  const closeModal = document.getElementById("close-modal");

  if (ruleBtn && ruleModal && closeModal) {
    ruleBtn.addEventListener("click", () => ruleModal.style.display = "flex");
    closeModal.addEventListener("click", () => ruleModal.style.display = "none");
    window.addEventListener("click", (e) => {
      if (e.target === ruleModal) ruleModal.style.display = "none";
    });
  }

  // 17x17 盤面生成
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");

      if ((row + col) % 2 === 0) cell.classList.add("light");
      else cell.classList.add("dark");

      cell.dataset.row = row;
      cell.dataset.col = col;

      cell.addEventListener("click", () => handleCellClick(cell));
      board.appendChild(cell);
    }
  }

  setupInitialPieces();
  render9x9MiniGrids();

  // 陣営に応じた盤面の回転状態を更新する関数
  function updateBoardRotation() {
    if (!boardContainer) return;
    // 先手（黒陣営）の場合は盤面を回転させる（オンライン対戦の黒陣営、またはオフライン）
    if (myColor === "black" || myColor === null) {
      boardContainer.classList.add("rotated");
    } else {
      boardContainer.classList.remove("rotated");
    }
  }

  // 初期状態ではオフライン想定（または未選択）のため黒視点として回転を反映
  updateBoardRotation();

  // 9x9 ミニ盤面の動的生成処理
  function render9x9MiniGrids() {
    const miniGrids = document.querySelectorAll(".mini-grid.grid-9x9");
    const centerR = 4;
    const centerC = 4;

    miniGrids.forEach(grid => {
      const pType = grid.dataset.piece;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement("div");
          cell.classList.add("m-cell");

          if (r === centerR && c === centerC) {
            cell.classList.add("center");
            cell.innerText = getPieceLabel(pType);
          } else {
            const dr = r - centerR;
            const dc = c - centerC;
            const typeClass = getMovementTypeClass(pType, dr, dc);
            if (typeClass) {
              cell.classList.add(typeClass);
              if (typeClass === "green") cell.innerText = "🟢";
              else if (typeClass === "red") cell.innerText = "🔴";
              else if (typeClass === "yellow") cell.innerText = "🟡";
            }
          }
          grid.appendChild(cell);
        }
      }
    });
  }

  function getPieceLabel(type) {
    const labels = {
      demon_king: "魔", angel: "天", fallen: "堕", inquisitor: "審",
      knight: "騎", reaper: "死", dragon: "龍王", stareater: "星喰い",
      believer: "信", fanatic: "教", beast: "凶", apocalypse_beast: "獣"
    };
    return labels[type] || "";
  }

  function getMovementTypeClass(type, dr, dc) {
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);

    switch (type) {
      case "demon_king":
        return (absR <= 1 && absC <= 1) ? "yellow" : null;

      case "angel":
        return (absR === absC) ? "yellow" : null;

      case "fallen":
        return (absR <= 4 && absC <= 4 && (absR === 0 || absC === 0 || absR === absC)) ? "yellow" : null;

      case "inquisitor":
        return (dr === 0 || dc === 0) ? "yellow" : null;

      case "knight":
        return ((absR === 2 && absC === 1) || (absR === 1 && absC === 2)) ? "yellow" : null;

      case "reaper":
        return (absR === 2 && absC === 2) ? "yellow" : null;

      case "dragon":
        if (absR <= 4 && absC <= 1 && !(dr === 0 && dc === 0)) return "yellow";
        return null;

      case "stareater":
        if (absR <= 1 && absC <= 4 && !(dr === 0 && dc === 0)) return "yellow";
        return null;

      case "believer":
        if (dc === 0 && dr >= -2 && dr < 0) return "green";
        if (dr === -1 && absC === 1) return "red";
        return null;

      case "fanatic":
        if (dc === 0 && dr >= -2 && dr < 0) return "green";
        if (dr === -1 && absC <= 1) return "red";
        return null;

      case "beast":
        if ((dr >= -2 && dr < 0 && dc === 0) || (dr === 1 && dc === 0) || (dr === 0 && absC === 1)) return "yellow";
        if (absR === 1 && absC === 1) return "red";
        return null;

      case "apocalypse_beast":
        if ((absR <= 2 && dc === 0) || (absC <= 2 && dr === 0)) return "yellow";
        if (absR === 1 && absC === 1) return "red";
        return null;

      default:
        return null;
    }
  }

  function setupInitialPieces() {
    const backRowPieces = [
      { col: 2, label: "騎", type: "knight" },
      { col: 3, label: "死", type: "reaper" },
      { col: 4, label: "星", type: "stareater" },
      { col: 5, label: "審", type: "inquisitor" },
      { col: 6, label: "天", type: "angel" },
      { col: 7, label: "堕", type: "fallen" },
      { col: 8, label: "魔", type: "demon_king" },
      { col: 9, label: "龍", type: "dragon" },
      { col: 10, label: "天", type: "angel" },
      { col: 11, label: "審", type: "inquisitor" },
      { col: 12, label: "星", type: "stareater" },
      { col: 13, label: "死", type: "reaper" },
      { col: 14, label: "騎", type: "knight" },
    ];

    backRowPieces.forEach(p => placePiece(0, p.col, p.label, "black", p.type));
    for (let col = 1; col <= 15; col++) placePiece(1, col, "信", "black", "believer");

    backRowPieces.forEach(p => placePiece(16, p.col, p.label, "white", p.type));
    for (let col = 15; col >= 1; col--) placePiece(15, col, "信", "white", "believer");
  }

  function placePiece(row, col, label, color, type) {
    const cell = getCell(row, col);
    if (cell) {
      const piece = document.createElement("div");
      piece.classList.add("piece", color);
      piece.dataset.type = type;
      piece.dataset.color = color;
      piece.dataset.label = label;
      piece.innerText = label;
      cell.appendChild(piece);
    }
  }

  function getCell(row, col) {
    return document.querySelector(`[data-row='${row}'][data-col='${col}']`);
  }

  function handleCellClick(cell) {
    if (myColor && currentTurn !== myColor) {
      return;
    }

    if (cell.classList.contains("collapsed")) return;

    const piece = cell.querySelector(".piece");

    if (selectedCell) {
      if (cell === selectedCell) {
        deselectAll();
        return;
      }

      if (piece && piece.dataset.color === currentTurn) {
        deselectAll();
        selectCell(cell);
        return;
      }

      if (cell.classList.contains("movable") || cell.classList.contains("capturable")) {
        movePiece(selectedCell, cell);
      }

      deselectAll();
      return;
    }

    if (piece && piece.dataset.color === currentTurn) {
      selectCell(cell);
    }
  }

  function selectCell(cell) {
    cell.classList.add("selected");
    selectedCell = cell;
    highlightValidMoves(cell);
  }

  function deselectAll() {
    document.querySelectorAll(".cell").forEach(c => {
      c.classList.remove("selected", "movable", "capturable");
    });
    selectedCell = null;
  }

  function checkTargetCell(r, c, myColor, canMoveToEmpty = true, canCaptureEnemy = true) {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
    const tc = getCell(r, c);
    if (!tc || tc.classList.contains("collapsed")) return;

    const tp = tc.querySelector(".piece");
    if (!tp) {
      if (canMoveToEmpty) tc.classList.add("movable");
    } else {
      if (canCaptureEnemy && tp.dataset.color !== myColor) {
        tc.classList.add("capturable");
      }
    }
  }

  function highlightValidMoves(fromCell) {
    const piece = fromCell.querySelector(".piece");
    const r = parseInt(fromCell.dataset.row);
    const c = parseInt(fromCell.dataset.col);
    const color = piece.dataset.color;
    const type = piece.dataset.type;

    let isBuffed = false;
    if (activeSavior && activeSavior.team === color) {
      if (type !== "demon_king" && type !== "angel" && type !== "believer") {
        isBuffed = true;
      }
    }

    const calcDist = (base) => isBuffed ? Math.ceil(base * 1.5) : base;
    const dirForward = color === "black" ? 1 : -1;

    const raycast = (dirs, baseDist) => {
      const maxDist = calcDist(baseDist);
      dirs.forEach(([dr, dc]) => {
        for (let step = 1; step <= maxDist; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;

          const targetCell = getCell(nr, nc);
          if (targetCell.classList.contains("collapsed")) break;

          const targetPiece = targetCell.querySelector(".piece");
          if (!targetPiece) {
            targetCell.classList.add("movable");
          } else {
            if (targetPiece.dataset.color !== color) {
              targetCell.classList.add("capturable");
            }
            break;
          }
        }
      });
    };

    const jumpMove = (positions) => {
      positions.forEach(([nr, nc]) => {
        checkTargetCell(nr, nc, color, true, true);
      });
    };

    switch (type) {
      case "demon_king":
        raycast([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], 1);
        break;

      case "angel":
        raycast([[1,1],[1,-1],[-1,1],[-1,-1]], 17);
        break;

      case "fallen":
        raycast([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], 4);
        break;

      case "inquisitor":
        raycast([[1,0],[-1,0],[0,1],[0,-1]], 6);
        break;

      case "reaper":
        const rDist = calcDist(2);
        let reaperMoves = [];
        for (let step = 1; step <= rDist; step++) {
          reaperMoves.push([r+step, c+step], [r+step, c-step], [r-step, c+step], [r-step, c-step]);
        }
        jumpMove(reaperMoves);
        break;

      case "knight":
        jumpMove([
          [r-2, c-1], [r-2, c+1], [r-1, c-2], [r-1, c+2],
          [r+1, c-2], [r+1, c+2], [r+2, c-1], [r+2, c+1]
        ]);
        break;

      case "dragon":
        const dDist = calcDist(4);
        let dragonMoves = [];
        for (let dr = -dDist; dr <= dDist; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr !== 0 || dc !== 0) {
              dragonMoves.push([r + dr, c + dc]);
            }
          }
        }
        jumpMove(dragonMoves);
        break;

      case "stareater":
        const sDist = calcDist(4);
        let starMoves = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -sDist; dc <= sDist; dc++) {
            if (dr !== 0 || dc !== 0) {
              starMoves.push([r + dr, c + dc]);
            }
          }
        }
        jumpMove(starMoves);
        break;

      case "believer":
        if (saviorCount === 0) {
          for (let step = 1; step <= 2; step++) {
            const nr = r + dirForward * step;
            if (nr >= 0 && nr < BOARD_SIZE) {
              const tc = getCell(nr, c);
              if (!tc.classList.contains("collapsed") && !tc.querySelector(".piece")) {
                tc.classList.add("movable");
              } else break;
            }
          }
          [-1, 1].forEach(dc => checkTargetCell(r + dirForward, c + dc, color, false, true));

        } else if (saviorCount === 1) {
          for (let step = 1; step <= 2; step++) {
            const nr = r + dirForward * step;
            if (nr >= 0 && nr < BOARD_SIZE) {
              const tc = getCell(nr, c);
              if (!tc.classList.contains("collapsed") && !tc.querySelector(".piece")) tc.classList.add("movable");
              else break;
            }
          }
          [-1, 0, 1].forEach(dc => checkTargetCell(r + dirForward, c + dc, color, false, true));

        } else if (saviorCount === 2) {
          for (let step = 1; step <= 2; step++) {
            const nr = r + dirForward * step;
            if (nr >= 0 && nr < BOARD_SIZE) {
              const tc = getCell(nr, c);
              if (!tc.classList.contains("collapsed")) {
                const tp = tc.querySelector(".piece");
                if (!tp) tc.classList.add("movable");
                else {
                  if (tp.dataset.color !== color) tc.classList.add("capturable");
                  break;
                }
              }
            }
          }
          checkTargetCell(r - dirForward, c, color, true, true);
          checkTargetCell(r, c + 1, color, true, true);
          checkTargetCell(r, c - 1, color, true, true);
          [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr, dc]) => checkTargetCell(r + dr, c + dc, color, false, true));

        } else {
          const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
          dirs.forEach(([dr, dc]) => {
            for (let step = 1; step <= 2; step++) {
              const nr = r + dr * step;
              const nc = c + dc * step;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                const tc = getCell(nr, nc);
                if (!tc.classList.contains("collapsed")) {
                  const tp = tc.querySelector(".piece");
                  if (!tp) tc.classList.add("movable");
                  else {
                    if (tp.dataset.color !== color) tc.classList.add("capturable");
                    break;
                  }
                }
              }
            }
          });
          [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr, dc]) => checkTargetCell(r + dr, c + dc, color, false, true));
        }
        break;
    }
  }

  function movePiece(fromCell, toCell) {
    if (activeSavior && activeSavior.pendingCollapse) {
      if (activeSavior.triggerTeam === currentTurn) {
        alert("救世主消滅の次のターンになりました。【縮退】が発生します！");
        triggerCollapse();
        activeSavior = null;
        document.getElementById("savior-status").innerText = "未降臨";
      }
    }

    const piece = fromCell.querySelector(".piece");
    const targetPiece = toCell.querySelector(".piece");

    if (targetPiece) {
      handleCapture(targetPiece);
      toCell.removeChild(targetPiece);
    }

    toCell.appendChild(piece);

    if (activeSavior && activeSavior.team === currentTurn && !activeSavior.pendingCollapse) {
      activeSavior.turnsLeft--;

      if (activeSavior.turnsLeft > 0) {
        document.getElementById("savior-status").innerText = `${activeSavior.team === "black" ? "黒" : "白"}降臨中 (残り${activeSavior.turnsLeft}ターン)`;
      } else {
        alert("救世主の効果時間が終了しました！次の手番開始時に【縮退】が発生します！");
        activeSavior.pendingCollapse = true;
        activeSavior.triggerTeam = currentTurn;
        document.getElementById("savior-status").innerText = "次ターン縮退予定";
      }
    }

    currentTurn = currentTurn === "black" ? "white" : "black";
    document.getElementById("turn-display").innerText = currentTurn === "black" ? "黒 (先手)" : "白 (後手)";

    broadcastGameState();
  }

  function handleCapture(capturedPiece) {
    const pType = capturedPiece.dataset.type;
    const pColor = capturedPiece.dataset.color;

    let pts = 1;
    if (pType === "dragon" || pType === "stareater") pts = 4;
    else if (pType === "angel" || pType === "fallen" || pType === "reaper") pts = 3;
    else if (pType === "inquisitor" || pType === "knight") pts = 2;
    else if (pType === "believer") pts = saviorCount >= 1 ? 2 : 1;
    else if (pType === "demon_king") pts = 0;

    if (currentTurn === "black") {
      blackSoulPoints += pts;
      checkSaviorTrigger("black", blackSoulPoints);
      document.getElementById("tp-black").innerText = blackSoulPoints;
      document.getElementById("gauge-black").style.width = Math.min(100, (blackSoulPoints % 20 / 20) * 100) + "%";
    } else {
      whiteSoulPoints += pts;
      checkSaviorTrigger("white", whiteSoulPoints);
      document.getElementById("tp-white").innerText = whiteSoulPoints;
      document.getElementById("gauge-white").style.width = Math.min(100, (whiteSoulPoints % 20 / 20) * 100) + "%";
    }

    if (pType === "believer") {
      if (pColor === "black") {
        blackBelieverDefeated++;
        if (blackBelieverDefeated % 2 === 0) {
          alert(`黒陣営の信徒系列の駒が累計${blackBelieverDefeated}体撃破されました！【縮退】が発生します！`);
          triggerCollapse();
        }
      } else if (pColor === "white") {
        whiteBelieverDefeated++;
        if (whiteBelieverDefeated % 2 === 0) {
          alert(`白陣営の信徒系列の駒が累計${whiteBelieverDefeated}体撃破されました！【縮退】が発生します！`);
          triggerCollapse();
        }
      }
    }

    if (pType === "demon_king") {
      alert(`魔王が捕獲されました！${currentTurn === "black" ? "黒陣営" : "白陣営"}の勝利です！`);
    }
  }

  function checkSaviorTrigger(team, totalPts) {
    if (totalPts > 0 && totalPts % 20 === 0) {
      saviorCount++;
      activeSavior = { team: team, turnsLeft: 3, pendingCollapse: false, triggerTeam: null };

      let evoText = "信徒";
      if (saviorCount === 1) evoText = "教信者";
      else if (saviorCount === 2) evoText = "凶獣";
      else if (saviorCount >= 3) evoText = "終末の獣";

      document.getElementById("evolution-status").innerText = evoText;
      document.getElementById("savior-status").innerText = `${team === "black" ? "黒" : "白"}降臨中 (残り3ターン)`;

      document.querySelectorAll('.piece[data-type="believer"]').forEach(p => {
        p.innerText = evoText.substring(0, 1);
      });

      alert(`魂ポイントが20点に到達！【救世主】が降臨しました！
3ターンの間移動力1.5倍＆信徒が【${evoText}】に進化！`);
    }
  }

  function triggerCollapse() {
    const min = collapseLevel;
    const max = BOARD_SIZE - 1 - collapseLevel;

    if (min >= max) return;

    for (let r = min; r <= max; r++) {
      for (let c = min; c <= max; c++) {
        if (r === min || r === max || c === min || c === max) {
          const cell = getCell(r, c);
          if (cell && !cell.classList.contains("collapsed")) {
            cell.classList.add("collapsed");

            const piece = cell.querySelector(".piece");
            if (piece) {
              if (piece.dataset.type === "demon_king") {
                alert(`【縮退】により${piece.dataset.color === "black" ? "黒" : "白"}の魔王が消滅しました！ゲーム終了！`);
              }
              cell.removeChild(piece);
            }
          }
        }
      }
    }
    collapseLevel++;
  }

  // ----------------------------------------------------
  // ゲーム状態の取得・復元・同期用関数
  // ----------------------------------------------------

  function getCurrentGameState() {
    const boardState = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      const rowState = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = getCell(r, c);
        const isCollapsed = cell.classList.contains("collapsed");
        const piece = cell.querySelector(".piece");
        let pieceData = null;
        if (piece) {
          pieceData = {
            type: piece.dataset.type,
            color: piece.dataset.color,
            label: piece.dataset.label
          };
        }
        rowState.push({
          collapsed: isCollapsed,
          piece: pieceData
        });
      }
      boardState.push(rowState);
    }

    return {
      turn: currentTurn,
      blackSoulPoints: blackSoulPoints,
      whiteSoulPoints: whiteSoulPoints,
      saviorCount: saviorCount,
      activeSavior: activeSavior,
      blackBelieverDefeated: blackBelieverDefeated,
      whiteBelieverDefeated: whiteBelieverDefeated,
      collapseLevel: collapseLevel,
      board: boardState
    };
  }

  function getInitialGameState() {
    return getCurrentGameState();
  }

  function applyGameState(state) {
    if (!state) return;

    currentTurn = state.turn;
    blackSoulPoints = state.blackSoulPoints || 0;
    whiteSoulPoints = state.whiteSoulPoints || 0;
    saviorCount = state.saviorCount || 0;
    activeSavior = state.activeSavior || null;
    blackBelieverDefeated = state.blackBelieverDefeated || 0;
    whiteBelieverDefeated = state.whiteBelieverDefeated || 0;
    collapseLevel = state.collapseLevel || 0;

    // UIパネルの更新
    document.getElementById("turn-display").innerText = currentTurn === "black" ? "黒 (先手)" : "白 (後手)";
    document.getElementById("tp-black").innerText = blackSoulPoints;
    document.getElementById("gauge-black").style.width = Math.min(100, (blackSoulPoints % 20 / 20) * 100) + "%";
    document.getElementById("tp-white").innerText = whiteSoulPoints;
    document.getElementById("gauge-white").style.width = Math.min(100, (whiteSoulPoints % 20 / 20) * 100) + "%";

    let evoText = "信徒";
    if (saviorCount === 1) evoText = "教信者";
    else if (saviorCount === 2) evoText = "凶獣";
    else if (saviorCount >= 3) evoText = "終末の獣";
    document.getElementById("evolution-status").innerText = evoText;

    if (activeSavior) {
      if (activeSavior.pendingCollapse) {
        document.getElementById("savior-status").innerText = "次ターン縮退予定";
      } else {
        document.getElementById("savior-status").innerText = `${activeSavior.team === "black" ? "黒" : "白"}降臨中 (残り${activeSavior.turnsLeft}ターン)`;
      }
    } else {
      document.getElementById("savior-status").innerText = "未降臨";
    }

    // 盤面復元
    if (state.board) {
      deselectAll();
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = getCell(r, c);
          const cellState = state.board[r][c];

          // 縮退状態の同期
          if (cellState.collapsed) {
            cell.classList.add("collapsed");
          } else {
            cell.classList.remove("collapsed");
          }

          // 駒の再配置
          cell.innerHTML = "";
          if (cellState.piece) {
            const piece = document.createElement("div");
            piece.classList.add("piece", cellState.piece.color);
            piece.dataset.type = cellState.piece.type;
            piece.dataset.color = cellState.piece.color;
            piece.dataset.label = cellState.piece.label;

            // 信徒系の表示ラベルの進化反映
            if (cellState.piece.type === "believer") {
              piece.innerText = evoText.substring(0, 1);
            } else {
              piece.innerText = cellState.piece.label;
            }

            cell.appendChild(piece);
          }
        }
      }
    }
  }

  // ----------------------------------------------------
  // ロビー・ルーム管理ロジック
  // ----------------------------------------------------
  const createBtn = document.getElementById("btn-create-room");
  const joinBtn = document.getElementById("btn-join-room");
  const deleteRoomBtn = document.getElementById("btn-delete-room");

  // 1. ルーム作成 (先手: 黒 になる)
  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      if (!supabase2) return alert("Supabaseの初期化に失敗しています");

      const code = document.getElementById("create-room-code").value.trim();
      const pass = document.getElementById("create-room-pass").value.trim();
      if (!code || !pass) return alert("部屋コードとパスワードを入力してください");

      console.log(`[LOG] 部屋を作成中... コード: ${code}`);

      const initialState = getInitialGameState();

      const { data, error } = await supabase2
        .from('rooms')
        .insert([{
          room_code: code,
          password: pass,
          game_state: initialState,
          black_present: true,
          white_present: false
        }])
        .select()
        .single();

      if (error) {
        console.error("[LOG] 部屋の作成に失敗しました:", error);
        alert("部屋の作成に失敗しました (重複している可能性があります)");
        return;
      }

      currentRoomId = data.id;
      myColor = "black";
      updateBoardRotation(); // 黒陣営（先手）なので盤面を回転

      console.log("[LOG] 部屋を作成しました:", data);
      alert(`部屋を作成しました！
部屋コード: ${data.room_code}
あなたは【黒 (先手)】です。相手の入室を待っています...`);
      document.getElementById("lobby-modal").style.display = "none";
      subscribeToRoomUpdates(currentRoomId);
    });
  }

  // 2. ルーム参加 (後手: 白 になる)
  if (joinBtn) {
    joinBtn.addEventListener("click", async () => {
      if (!supabase2) return alert("Supabaseの初期化に失敗しています");

      const code = document.getElementById("join-room-code").value.trim();
      const pass = document.getElementById("join-room-pass").value.trim();
      if (!code || !pass) return alert("部屋コードとパスワードを入力してください");

      console.log(`[LOG] 部屋を検索中... コード: ${code}`);

      const { data, error } = await supabase2
        .from('rooms')
        .select('*')
        .eq('room_code', code)
        .eq('password', pass)
        .single();

      if (error || !data) {
        console.error("[LOG] 部屋の検索に失敗しました:", error);
        alert("部屋が見つからないか、パスワードが間違っています");
        return;
      }

      if (data.white_present) {
        console.warn("[LOG] 部屋が満員です");
        alert("この部屋はすでに満員です");
        return;
      }

      await supabase2
        .from('rooms')
        .update({ white_present: true })
        .eq('id', data.id);

      currentRoomId = data.id;
      myColor = "white";
      updateBoardRotation(); // 白陣営（後手）なので盤面を通常（回転なし）に

      console.log("[LOG] 部屋に参加しました:", data);
      alert(`部屋に参加しました！あなたは【白 (後手)】です。`);
      document.getElementById("lobby-modal").style.display = "none";

      applyGameState(data.game_state);
      subscribeToRoomUpdates(currentRoomId);
    });
  }

  // 3. 部屋削除 / ゲーム終了ボタン
  if (deleteRoomBtn) {
    deleteRoomBtn.addEventListener("click", async () => {
      if (currentRoomId && supabase2) {
        await supabase2.from('rooms').delete().eq('id', currentRoomId);
      }
      alert("ルームを消去しました。");
      location.reload();
    });
  }

  // ----------------------------------------------------
  // Realtime リアルタイム同期 & 切断（サイト閉じ）検知ロジック
  // ----------------------------------------------------
  function subscribeToRoomUpdates(roomId) {
    if (!supabase2) return;

    console.log(`[LOG] Realtime 購読を開始します... ルームID: ${roomId}`);
    
    roomChannel = supabase2.channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          console.log("[LOG] 部屋データの更新を受信しました:", payload.new);
          const roomData = payload.new;

          if (myColor === 'white' && !roomData.black_present) {
            alert("ホスト（黒陣営）が退出したため、部屋を閉じました。");
            leaveRoomAndReset();
            return;
          }

          if (roomData.game_state) {
            applyGameState(roomData.game_state);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          console.log("[LOG] 部屋が削除されました:", payload);
          alert("対戦相手がサイトを閉じた（またはルームを削除した）ため、部屋を閉じました。");
          leaveRoomAndReset();
        }
      )
      .subscribe((status) => {
        console.log(`[LOG] Realtime 接続ステータス: ${status}`);
      });
  }

  async function broadcastGameState() {
    if (!currentRoomId || !supabase2) return;

    const gameState = getCurrentGameState();
    const { error } = await supabase2
      .from('rooms')
      .update({
        game_state: gameState,
        updated_at: new Date()
      })
      .eq('id', currentRoomId);

    if (error) {
      console.error("[LOG] 盤面データの送信に失敗しました:", error);
    }
  }

  // ページが隠れたり閉じられる直前にデータベースのステータスを更新
  window.addEventListener('pagehide', async () => {
    if (!currentRoomId || !supabase2) return;
    if (myColor === 'black') {
      await supabase2.from('rooms').delete().eq('id', currentRoomId);
    } else if (myColor === 'white') {
      await supabase2.from('rooms').update({ white_present: false }).eq('id', currentRoomId);
    }
  });

  function leaveRoomAndReset() {
    currentRoomId = null;
    myColor = null;
    updateBoardRotation(); // リセット時にデフォルト状態へ戻す
    if (roomChannel) {
      supabase2.removeChannel(roomChannel);
    }
    document.getElementById("lobby-modal").style.display = "flex";
  }
});