const elements = {
  seq1: document.getElementById("seq1"),
  seq2: document.getElementById("seq2"),
  match: document.getElementById("match"),
  mismatch: document.getElementById("mismatch"),
  gap: document.getElementById("gap"),
  matrixWrap: document.querySelector(".matrix-wrap"),
  matrixTable: document.getElementById("matrixTable"),
  cellDetails: document.getElementById("cellDetails"),
  alignmentBox: document.getElementById("alignmentBox"),
  pathText: document.getElementById("pathText"),
  finalScoreText: document.getElementById("finalScoreText")
};

const directionMeta = {
  diag: { label: "Diagonal", badge: "↖ Diagonal", colorClass: "dir-diag", arrow: "↖" },
  up: { label: "Up", badge: "↑ Up", colorClass: "dir-up", arrow: "↑" },
  left: { label: "Left", badge: "← Left", colorClass: "dir-left", arrow: "←" }
};

const tieBreakPriority = ["diag", "up", "left"];

let latestResult = null;
let hoveredCell = null;

function normalizeSequence(raw) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function toNumber(raw, fallback) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chooseBacktrackDirection(directions) {
  for (const direction of tieBreakPriority) {
    if (directions.includes(direction)) {
      return direction;
    }
  }
  return null;
}

function computeNeedlemanWunsch(seq1, seq2, scores) {
  const rows = seq1.length + 1;
  const cols = seq2.length + 1;

  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  const candidates = Array.from({ length: rows }, () => Array(cols).fill(null));
  const directions = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));
  const chosen = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let i = 1; i < rows; i += 1) {
    matrix[i][0] = matrix[i - 1][0] + scores.gap;
    candidates[i][0] = {
      up: matrix[i - 1][0] + scores.gap,
      upBase: matrix[i - 1][0],
      left: null,
      leftBase: null,
      diag: null,
      diagBase: null,
      diagBonus: null,
      matchType: null
    };
    directions[i][0] = ["up"];
    chosen[i][0] = "up";
  }

  for (let j = 1; j < cols; j += 1) {
    matrix[0][j] = matrix[0][j - 1] + scores.gap;
    candidates[0][j] = {
      up: null,
      upBase: null,
      left: matrix[0][j - 1] + scores.gap,
      leftBase: matrix[0][j - 1],
      diag: null,
      diagBase: null,
      diagBonus: null,
      matchType: null
    };
    directions[0][j] = ["left"];
    chosen[0][j] = "left";
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const isMatch = seq1[i - 1] === seq2[j - 1];
      const diagBonus = isMatch ? scores.match : scores.mismatch;

      const diagScore = matrix[i - 1][j - 1] + diagBonus;
      const upScore = matrix[i - 1][j] + scores.gap;
      const leftScore = matrix[i][j - 1] + scores.gap;
      const maxScore = Math.max(diagScore, upScore, leftScore);

      const parentDirections = [];
      if (diagScore === maxScore) {
        parentDirections.push("diag");
      }
      if (upScore === maxScore) {
        parentDirections.push("up");
      }
      if (leftScore === maxScore) {
        parentDirections.push("left");
      }

      matrix[i][j] = maxScore;
      directions[i][j] = parentDirections;
      chosen[i][j] = chooseBacktrackDirection(parentDirections);

      candidates[i][j] = {
        up: upScore,
        upBase: matrix[i - 1][j],
        left: leftScore,
        leftBase: matrix[i][j - 1],
        diag: diagScore,
        diagBase: matrix[i - 1][j - 1],
        diagBonus,
        matchType: isMatch ? "match" : "mismatch"
      };
    }
  }

  let row = seq1.length;
  let col = seq2.length;

  const path = [[row, col]];
  const aligned1 = [];
  const aligned2 = [];

  while (row > 0 || col > 0) {
    const move = chosen[row][col];
    if (!move) {
      break;
    }

    if (move === "diag") {
      aligned1.push(seq1[row - 1]);
      aligned2.push(seq2[col - 1]);
      row -= 1;
      col -= 1;
    } else if (move === "up") {
      aligned1.push(seq1[row - 1]);
      aligned2.push("-");
      row -= 1;
    } else {
      aligned1.push("-");
      aligned2.push(seq2[col - 1]);
      col -= 1;
    }

    path.push([row, col]);
  }

  path.reverse();

  return {
    seq1,
    seq2,
    scores,
    matrix,
    candidates,
    directions,
    chosen,
    path,
    aligned1: aligned1.reverse().join(""),
    aligned2: aligned2.reverse().join("")
  };
}

function escapeHtml(raw) {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMatchLine(aligned1, aligned2) {
  const chars = [];

  for (let idx = 0; idx < aligned1.length; idx += 1) {
    const ch1 = aligned1[idx];
    const ch2 = aligned2[idx];

    if (ch1 === ch2 && ch1 !== "-") {
      chars.push("|");
    } else if (ch1 === "-" || ch2 === "-") {
      chars.push(" ");
    } else {
      chars.push(".");
    }
  }

  return chars.join("");
}

function renderSequenceWithHighlight(sequence, directionClass = null, highlightHistory = false) {
  if (!directionClass || sequence.length === 0 || !highlightHistory) {
    return `<span class="alignment-seq">${escapeHtml(sequence)}</span>`;
  }

  const history = escapeHtml(sequence.slice(0, -1));
  const current = escapeHtml(sequence.slice(-1));

  if (sequence.length === 1) {
    return `<span class="alignment-seq"><span class="alignment-current">${current}</span></span>`;
  }

  return `<span class="alignment-seq"><span class="alignment-history ${directionClass}">${history}</span><span class="alignment-current">${current}</span></span>`;
}

function renderThreeLineAlignment(aligned1, aligned2, directionClass = null, highlightHistory = false) {
  const matchLine = buildMatchLine(aligned1, aligned2);

  return `
    <div class="alignment-line"><span class="alignment-prefix">Seq1:</span>${renderSequenceWithHighlight(aligned1, directionClass, highlightHistory)}</div>
    <div class="alignment-line"><span class="alignment-prefix"></span><span class="alignment-seq">${escapeHtml(matchLine)}</span></div>
    <div class="alignment-line"><span class="alignment-prefix">Seq2:</span>${renderSequenceWithHighlight(aligned2, directionClass, highlightHistory)}</div>
  `;
}

function makePathSet(path) {
  return new Set(path.map(([row, col]) => `${row},${col}`));
}

function applyHoveredCellClass() {
  const previous = elements.matrixTable.querySelectorAll("td.current-hover, td.parent-diag, td.parent-up, td.parent-left");
  previous.forEach((cell) => {
    cell.classList.remove("current-hover", "parent-diag", "parent-up", "parent-left");
  });

  if (!hoveredCell || !latestResult) {
    return;
  }

  const { i, j } = hoveredCell;

  const getCell = (row, col) => elements.matrixTable.querySelector(`td.score-cell[data-i="${row}"][data-j="${col}"]`);

  const current = getCell(i, j);
  if (current) {
    current.classList.add("current-hover");
  }

  if (i > 0 && j > 0) {
    const diagCell = getCell(i - 1, j - 1);
    if (diagCell) {
      diagCell.classList.add("parent-diag");
    }
  }

  if (i > 0) {
    const upCell = getCell(i - 1, j);
    if (upCell) {
      upCell.classList.add("parent-up");
    }
  }

  if (j > 0) {
    const leftCell = getCell(i, j - 1);
    if (leftCell) {
      leftCell.classList.add("parent-left");
    }
  }
}

function renderMatrix(result) {
  const { matrix, seq1, seq2, path, directions } = result;
  const table = elements.matrixTable;
  const pathSet = makePathSet(path);

  table.innerHTML = "";

  const headerRow = document.createElement("tr");

  const axisHeader = document.createElement("th");
  axisHeader.textContent = "S1\\S2";
  headerRow.appendChild(axisHeader);

  const gapHeader = document.createElement("th");
  gapHeader.textContent = "-";
  headerRow.appendChild(gapHeader);

  for (const ch of seq2) {
    const th = document.createElement("th");
    th.textContent = ch;
    headerRow.appendChild(th);
  }

  table.appendChild(headerRow);

  for (let i = 0; i < matrix.length; i += 1) {
    const rowElement = document.createElement("tr");

    const rowHeader = document.createElement("th");
    rowHeader.textContent = i === 0 ? "-" : seq1[i - 1];
    rowElement.appendChild(rowHeader);

    for (let j = 0; j < matrix[i].length; j += 1) {
      const cell = document.createElement("td");
      cell.className = "score-cell";

      if (pathSet.has(`${i},${j}`)) {
        cell.classList.add("path");
      }

      const bestDirections = directions[i][j] ?? [];

      const scoreElement = document.createElement("span");
      scoreElement.className = "cell-score";
      scoreElement.textContent = matrix[i][j];
      cell.appendChild(scoreElement);

      for (const directionKey of tieBreakPriority) {
        if (!bestDirections.includes(directionKey)) {
          continue;
        }

        const marker = document.createElement("span");
        marker.className = `cell-marker marker-${directionKey}`;
        marker.textContent = directionMeta[directionKey].arrow;
        marker.setAttribute("aria-hidden", "true");
        cell.appendChild(marker);
      }

      const bestDirectionNames = tieBreakPriority
        .filter((directionKey) => bestDirections.includes(directionKey))
        .map((directionKey) => directionMeta[directionKey].label)
        .join(", ");

      cell.title = bestDirectionNames
        ? `Best direction(s): ${bestDirectionNames}`
        : "Boundary cell";
      cell.dataset.i = String(i);
      cell.dataset.j = String(j);

      const activateCell = () => {
        hoveredCell = { i, j };
        renderCellDetails(i, j, result);
        applyHoveredCellClass();
      };

      cell.addEventListener("mouseenter", activateCell);
      cell.addEventListener("click", activateCell);

      rowElement.appendChild(cell);
    }

    table.appendChild(rowElement);
  }

  applyHoveredCellClass();
}

function reconstructAlignmentToCell(result, row, col) {
  const { chosen, seq1, seq2 } = result;

  const aligned1 = [];
  const aligned2 = [];

  let i = row;
  let j = col;

  while (i > 0 || j > 0) {
    let direction = chosen[i][j];

    if (!direction) {
      direction = i > 0 ? "up" : "left";
    }

    if (direction === "diag" && i > 0 && j > 0) {
      aligned1.push(seq1[i - 1]);
      aligned2.push(seq2[j - 1]);
      i -= 1;
      j -= 1;
    } else if (direction === "up" && i > 0) {
      aligned1.push(seq1[i - 1]);
      aligned2.push("-");
      i -= 1;
    } else if (j > 0) {
      aligned1.push("-");
      aligned2.push(seq2[j - 1]);
      j -= 1;
    } else {
      break;
    }
  }

  return {
    aligned1: aligned1.reverse().join(""),
    aligned2: aligned2.reverse().join("")
  };
}

function buildIntermediateAlignmentForCase(i, j, direction, result) {
  const { seq1, seq2 } = result;

  let prevI;
  let prevJ;
  let stepAlign1;
  let stepAlign2;

  if (direction === "diag") {
    prevI = i - 1;
    prevJ = j - 1;
    stepAlign1 = seq1[i - 1];
    stepAlign2 = seq2[j - 1];
  } else if (direction === "up") {
    prevI = i - 1;
    prevJ = j;
    stepAlign1 = seq1[i - 1];
    stepAlign2 = "-";
  } else {
    prevI = i;
    prevJ = j - 1;
    stepAlign1 = "-";
    stepAlign2 = seq2[j - 1];
  }

  const baseAlignment = reconstructAlignmentToCell(result, Math.max(0, prevI), Math.max(0, prevJ));

  return {
    stepAlign1,
    stepAlign2,
    aligned1: `${baseAlignment.aligned1}${stepAlign1}`,
    aligned2: `${baseAlignment.aligned2}${stepAlign2}`
  };
}

function getCaseEntries(i, j, result) {
  const { candidates, scores } = result;
  const candidate = candidates[i][j];

  if (!candidate) {
    return [];
  }

  const entries = [];

  if (i > 0) {
    const intermediate = buildIntermediateAlignmentForCase(i, j, "up", result);
    entries.push({
      key: "up",
      score: candidate.up,
      formula: `score[${i - 1}][${j}] + gap = ${candidate.upBase} + (${scores.gap}) = ${candidate.up}`,
      align1: intermediate.stepAlign1,
      align2: intermediate.stepAlign2,
      intermediate
    });
  }

  if (j > 0) {
    const intermediate = buildIntermediateAlignmentForCase(i, j, "left", result);
    entries.push({
      key: "left",
      score: candidate.left,
      formula: `score[${i}][${j - 1}] + gap = ${candidate.leftBase} + (${scores.gap}) = ${candidate.left}`,
      align1: intermediate.stepAlign1,
      align2: intermediate.stepAlign2,
      intermediate
    });
  }

  if (i > 0 && j > 0) {
    const relation = candidate.matchType === "match" ? "match" : "mismatch";
    const intermediate = buildIntermediateAlignmentForCase(i, j, "diag", result);
    entries.push({
      key: "diag",
      score: candidate.diag,
      formula: `score[${i - 1}][${j - 1}] + ${relation} = ${candidate.diagBase} + (${candidate.diagBonus}) = ${candidate.diag}`,
      align1: intermediate.stepAlign1,
      align2: intermediate.stepAlign2,
      intermediate
    });
  }

  return entries;
}

function renderEmptyCellDetails() {
  elements.cellDetails.innerHTML = `
    <div class="empty-state">
      <p>Hover or click a score cell to view candidate calculations and intermediate alignments.</p>
    </div>
  `;
}

function clearSelection() {
  if (!hoveredCell) {
    return;
  }

  hoveredCell = null;
  applyHoveredCellClass();
  renderEmptyCellDetails();
}

function renderCellDetails(i, j, result) {
  const { matrix, directions } = result;

  if (i === 0 && j === 0) {
    elements.cellDetails.innerHTML = `
      <div class="empty-state">
        <p>This is the start cell (0, 0). There are no candidate origin cells here.</p>
      </div>
    `;
    return;
  }

  const entries = getCaseEntries(i, j, result);
  const maxScore = matrix[i][j];
  const chosenMoves = directions[i][j] ?? [];

  const candidateCardsHtml = entries.map((entry) => {
    const isBest = chosenMoves.includes(entry.key);
    const directionClass = directionMeta[entry.key].colorClass;

    return `
      <article class="candidate-card ${isBest ? "is-best" : ""} ${directionClass}">
        <div class="candidate-head">
          <span class="direction-badge ${directionClass}">${directionMeta[entry.key].badge}</span>
          <span class="score-badge ${directionClass}">Score ${entry.score}${isBest ? " · MAX" : ""}</span>
        </div>
        <p class="candidate-formula">${escapeHtml(entry.formula)}</p>
        <div class="mini-alignment">
          ${renderThreeLineAlignment(entry.intermediate.aligned1, entry.intermediate.aligned2, directionClass, true)}
        </div>
      </article>
    `;
  }).join("");

  elements.cellDetails.innerHTML = `
    <section class="detail-section">
      <h3 class="detail-section-title">Cell (${i}, ${j}) · Score ${maxScore}</h3>
      <div class="candidate-list">
        ${candidateCardsHtml}
      </div>
    </section>
  `;
}

function renderAlignment(result) {
  const { aligned1, aligned2, matrix, seq1, seq2 } = result;
  const finalScore = matrix[seq1.length][seq2.length];

  elements.finalScoreText.textContent = `Final score: ${finalScore}`;
  elements.alignmentBox.innerHTML = renderThreeLineAlignment(aligned1, aligned2);
}

function renderPath(result) {
  const pathCoordinates = result.path.map(([i, j]) => `(${i},${j})`).join(" → ");
  elements.pathText.textContent = pathCoordinates;
}

function update() {
  const seq1 = normalizeSequence(elements.seq1.value);
  const seq2 = normalizeSequence(elements.seq2.value);
  const scores = {
    match: toNumber(elements.match.value, 1),
    mismatch: toNumber(elements.mismatch.value, -1),
    gap: toNumber(elements.gap.value, -1)
  };

  latestResult = computeNeedlemanWunsch(seq1, seq2, scores);

  renderMatrix(latestResult);
  renderAlignment(latestResult);
  renderPath(latestResult);

  if (hoveredCell) {
    const i = Math.min(hoveredCell.i, latestResult.seq1.length);
    const j = Math.min(hoveredCell.j, latestResult.seq2.length);
    hoveredCell = { i, j };
    renderCellDetails(i, j, latestResult);
    applyHoveredCellClass();
  } else {
    renderEmptyCellDetails();
  }
}

[elements.seq1, elements.seq2, elements.match, elements.mismatch, elements.gap].forEach((input) => {
  input.addEventListener("input", update);
});

elements.matrixTable.addEventListener("mouseleave", clearSelection);
if (elements.matrixWrap) {
  elements.matrixWrap.addEventListener("mouseleave", clearSelection);
}

update();