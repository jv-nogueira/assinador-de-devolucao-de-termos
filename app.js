const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

const form = document.querySelector("#term-form");
const fileInput = document.querySelector("#pdf-file");
const fileName = document.querySelector("#file-name");
const feedback = document.querySelector("#feedback");
const submitButton = form.querySelector('button[type="submit"]');
const termTypes = document.querySelectorAll('input[name="termType"]');
const returnFields = document.querySelector("#return-fields");
const returnData = document.querySelector("#return-data");
const loanData = document.querySelector("#loan-data");
const loanFullName = document.querySelector("#loan-full-name");
const loanCpf = document.querySelector("#loan-cpf");
const loanSector = document.querySelector("#loan-sector");
const loanRole = document.querySelector("#loan-role");
const loanWorkEmail = document.querySelector("#loan-work-email");
const loanPersonalEmail = document.querySelector("#loan-personal-email");
const loanManager = document.querySelector("#loan-manager");
const loanAcceptanceDate = document.querySelector("#loan-acceptance-date");
const loanRequiredFields = [
  loanFullName, loanCpf, loanSector, loanRole, loanWorkEmail,
  loanPersonalEmail, loanManager, loanAcceptanceDate,
];
const loanTableBody = document.querySelector("#loan-table-body");
const addRowButton = document.querySelector("#add-row");
const previewButton = document.querySelector("#preview-button");
const previewModal = document.querySelector("#preview-modal");
const previewCanvas = document.querySelector("#preview-canvas");
const previewTitle = document.querySelector("#preview-title");
const loanPreview = document.querySelector("#loan-preview");
const closePreview = document.querySelector("#close-preview");
const receiverSelect = document.querySelector("#receiver");
const otherReceiver = document.querySelector("#other-receiver");
const feedbackButton = document.querySelector("#feedback-button");
const feedbackModal = document.querySelector("#feedback-modal");
const closeFeedback = document.querySelector("#close-feedback");
const cancelFeedback = document.querySelector("#cancel-feedback");
const feedbackForm = document.querySelector("#feedback-form");
const feedbackName = document.querySelector("#feedback-name");
const feedbackMessage = document.querySelector("#feedback-message");
const feedbackStatus = document.querySelector("#feedback-status");
const sendFeedback = document.querySelector("#send-feedback");
const feedbackEndpoint = "https://script.google.com/macros/s/AKfycbwo0DnCb5T3Gtzr7TEurmK8z06BphS78E2l-x8purKh5LEw3VPvD7c5fW-qrIVuHWHiOA/exec";
const loanEndpoint = "https://script.google.com/macros/s/AKfycbxHVAwxHxS9l9Pw1zBnD8ZD7OtMo_sK_zZzHYwvD9xH2Exv5AmDxW4zvCAibu3aXpyR_w/exec";
let previewUrl = null;
let selectedFile = null;
let sourceFileHandle = null;

function todayAsInputDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

document.querySelector("#return-date").value = todayAsInputDate();
loanAcceptanceDate.value = todayAsInputDate();

function selectedTermType() {
  return document.querySelector('input[name="termType"]:checked').value;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function createLoanRow() {
  const row = document.createElement("tr");
  row.className = "loan-row";
  row.innerHTML = `
    <td><input type="text" name="itemId" value="" readonly /></td>
    <td><input type="text" name="itemQntd" placeholder="Qtd" /></td>
    <td><input type="text" name="itemMarca" placeholder="Marca" /></td>
    <td><input type="text" name="itemModelo" placeholder="Modelo" /></td>
    <td><input type="text" name="itemObs" placeholder="Obs" /></td>
    <td><button type="button" class="remove-row">Remover</button></td>
  `;
  row.querySelector(".remove-row").addEventListener("click", () => {
    const rows = loanTableBody.querySelectorAll(".loan-row");
    if (rows.length > 1) {
      row.remove();
      renumberLoanItems();
    } else {
      feedback.style.color = "#b42318";
      feedback.textContent = "É necessário pelo menos um item.";
    }
  });
  return row;
}

function addLoanRow() {
  loanTableBody.appendChild(createLoanRow());
  renumberLoanItems();
}

function renumberLoanItems() {
  loanTableBody.querySelectorAll(".loan-row").forEach((row, index) => {
    row.querySelector('input[name="itemId"]').value = String(index + 1);
  });
}

function readLoanRows() {
  const rows = Array.from(loanTableBody.querySelectorAll(".loan-row"));
  return rows.map((row) => {
    const inputs = row.querySelectorAll("input");
    return {
      id: inputs[0].value.trim(),
      qntd: inputs[1].value.trim(),
      marca: inputs[2].value.trim(),
      modelo: inputs[3].value.trim(),
      observacao: inputs[4].value.trim(),
    };
  });
}

async function createLoanPdf(data) {
  const response = await fetch(loanEndpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      nome_completo: data.fullName,
      cpf: data.cpf,
      setor_ou_operacao: data.sector,
      cargo: data.role,
      email_profissional: data.workEmail,
      email_pessoal: data.personalEmail,
      gestor_que_aprovou: data.manager,
      emprestimo_dia: data.acceptanceDate.day,
      emprestimo_mes: data.acceptanceDate.month,
      emprestimo_ano: data.acceptanceDate.year,
      linhas: data.linhas,
    }),
  });
  if (!response.ok) throw new Error("O Apps Script não respondeu corretamente.");
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "O Apps Script não conseguiu gerar o PDF.");
  const binary = atob(result.pdfBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return { bytes, pageIndex: 0, fileName: result.fileName };
}

async function prepareLoanPreview(data) {
  previewCanvas.hidden = false;
  previewTitle.textContent = "Prévia do termo de empréstimo";
  const result = await createLoanPdf(data);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewModal.hidden = false;
  loanPreview.hidden = true;
  loanPreview.src = "";
  await renderFullPreview(result.bytes);
  return result;
}

async function saveLoanPdf(data) {
  const result = await createLoanPdf(data);
  const fileName = result.fileName || `termo-responsabilidade-${data.fullName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  if (window.showSaveFilePicker && window.location.protocol === "https:") {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "Arquivo PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([result.bytes], { type: "application/pdf" }));
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(new Blob([result.bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function updateTermType() {
  termTypes.forEach((input) => input.closest(".term-type").classList.toggle("selected", input.checked));
  const isLoan = selectedTermType() === "emprestimo";
  returnFields.hidden = isLoan;
  returnData.hidden = isLoan;
  loanData.hidden = !isLoan;
  loanRequiredFields.forEach((field) => { field.required = isLoan; });
}

termTypes.forEach((input) => input.addEventListener("change", updateTermType));
addRowButton.addEventListener("click", addLoanRow);
fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0] || null;
  sourceFileHandle = null;
  fileName.textContent = selectedFile?.name || "Selecionar PDF base";
});

async function choosePdfFile(event) {
  if (!window.showOpenFilePicker || !window.isSecureContext) return;
  event.preventDefault();
  try {
    [sourceFileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "Arquivo PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    selectedFile = await sourceFileHandle.getFile();
    fileName.textContent = selectedFile.name;
  } catch (error) {
    if (error.name !== "AbortError") {
      feedback.style.color = "#b42318";
      feedback.textContent = `Não foi possível selecionar o PDF: ${error.message}`;
    }
  }
}

document.querySelector(".upload").addEventListener("click", choosePdfFile);
receiverSelect.addEventListener("change", () => {
  const isOther = receiverSelect.value === "outro";
  otherReceiver.hidden = !isOther;
  otherReceiver.required = isOther;
  if (isOther) otherReceiver.focus();
});

function readForm() {
  return {
    type: selectedTermType(),
    returnFile: selectedFile || fileInput.files[0],
    condition: document.querySelector("#return-condition").value,
    receiver: receiverSelect.value === "outro" ? otherReceiver.value.trim() : receiverSelect.value,
    date: formatDate(document.querySelector("#return-date").value),
    fullName: loanFullName.value.trim(),
    cpf: loanCpf.value.trim(),
    sector: loanSector.value.trim(),
    role: loanRole.value.trim(),
    workEmail: loanWorkEmail.value.trim(),
    personalEmail: loanPersonalEmail.value.trim(),
    manager: loanManager.value.trim(),
    acceptanceDate: parseLoanDate(loanAcceptanceDate.value),
    linhas: readLoanRows(),
  };
}

function parseLoanDate(value) {
  if (!value) return { day: "", month: "", year: "" };
  const [year, month, day] = value.split("-");
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return { day, month: monthNames[Number(month) - 1] || "", year };
}

function normalizeText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function readPdfPages(bytes) {
  const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
  const source = await loadingTask.promise;
  const pages = [];
  for (let index = 1; index <= source.numPages; index += 1) {
    const page = await source.getPage(index);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      height: viewport.height,
      items: content.items.map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
      })),
    });
  }
  return pages;
}

function itemContains(item, value) {
  return normalizeText(item.text).includes(normalizeText(value));
}

function textEndX(item, value) {
  const normalizedItem = normalizeText(item.text);
  const normalizedValue = normalizeText(value);
  const start = normalizedItem.indexOf(normalizedValue);
  if (start < 0) return item.x + item.width;
  const end = start + normalizedValue.length;
  return item.x + (item.width * end) / Math.max(item.text.length, 1);
}

function sameLine(item, other) {
  return Math.abs(item.y - other.y) < 12;
}

function findParenthesisPositions(items, option) {
  const positions = [];
  const leftEdge = option.x - 50;
  items
    .filter((item) => item.x + item.width >= leftEdge && item.x <= option.x && sameLine(item, option))
    .forEach((item) => {
      [...item.text].forEach((character, index) => {
        if (character !== "(" && character !== ")") return;
        const characterWidth = item.width / Math.max(item.text.length, 1);
        positions.push({ character, x: item.x + characterWidth * index, width: characterWidth });
      });
    });
  return positions.sort((left, right) => left.x - right.x);
}

function findSlashPositions(items, anchor, anchorText) {
  const normalizedItem = normalizeText(anchor.text);
  const normalizedAnchor = normalizeText(anchorText);
  const anchorStart = normalizedItem.indexOf(normalizedAnchor);
  const anchorEndIndex = anchorStart >= 0
    ? anchorStart + normalizedAnchor.length
    : anchor.text.length;
  const rightEdge = anchor.x + (anchor.width * anchorEndIndex) / Math.max(anchor.text.length, 1);
  const leftEdge = rightEdge;
  const areaRight = rightEdge + 220;
  const positions = [];

  items
    .filter((item) => item.x + item.width >= leftEdge && item.x <= areaRight && sameLine(item, anchor))
    .forEach((item) => {
      [...item.text].forEach((character, index) => {
        if (character !== "/") return;
        const characterWidth = item.width / Math.max(item.text.length, 1);
        const x = item.x + characterWidth * index;
        if (x >= leftEdge) positions.push({ x, width: characterWidth, y: item.y });
      });
    });

  return positions.sort((left, right) => left.x - right.x).slice(0, 2);
}

function findDateSlots(items, anchor, anchorText) {
  const normalizedItem = normalizeText(anchor.text);
  const normalizedAnchor = normalizeText(anchorText);
  const anchorStart = normalizedItem.indexOf(normalizedAnchor);
  const rightEdge = anchor.x + (anchor.width * (anchorStart + normalizedAnchor.length))
    / Math.max(anchor.text.length, 1);
  const dateItems = items
    .filter((item) => item.x + item.width >= rightEdge && item.x <= rightEdge + 220 && sameLine(item, anchor))
    .sort((left, right) => left.x - right.x);
  const slashes = findSlashPositions(items, anchor, anchorText);
  if (slashes.length < 2) return [];

  const firstSlash = slashes[0];
  const secondSlash = slashes[1];
  const findUnderlineStart = (start, end) => {
    const underscores = [];
    dateItems.forEach((item) => {
      const characterWidth = item.width / Math.max(item.text.length, 1);
      [...item.text].forEach((character, index) => {
        const x = item.x + characterWidth * index;
        if (character === "_" && x >= start && x < end) underscores.push(x);
      });
    });
    return underscores.length ? Math.min(...underscores) : start;
  };
  const firstStart = findUnderlineStart(rightEdge, firstSlash.x);
  const secondStart = findUnderlineStart(firstSlash.x + firstSlash.width, secondSlash.x);
  const thirdStart = findUnderlineStart(secondSlash.x + secondSlash.width, secondSlash.x + secondSlash.width + 40);
  const thirdCharacters = [];
  dateItems.forEach((item) => {
    const characterWidth = item.width / Math.max(item.text.length, 1);
    [...item.text].forEach((character, index) => {
      const x = item.x + characterWidth * index;
      if ((character === "," || character === "_") && x > secondSlash.x) {
        thirdCharacters.push({ character, x, width: characterWidth });
      }
    });
  });
  const comma = thirdCharacters.find((character) => character.character === ",");
  const lastUnderline = [...thirdCharacters].reverse().find((character) => character.character === "_");
  const thirdEnd = comma
    ? comma.x
    : lastUnderline
      ? lastUnderline.x + lastUnderline.width
      : secondSlash.x + secondSlash.width + 30;

  return [
    { start: firstStart, end: firstSlash.x },
    { start: secondStart, end: secondSlash.x },
    { start: thirdStart, end: thirdEnd },
  ];
}

function findDateLine(items, anchor, anchorText) {
  const normalizedItem = normalizeText(anchor.text);
  const normalizedAnchor = normalizeText(anchorText);
  const anchorStart = normalizedItem.indexOf(normalizedAnchor);
  const rightEdge = anchor.x + (anchor.width * (anchorStart + normalizedAnchor.length))
    / Math.max(anchor.text.length, 1);
  const lineItems = items.filter((item) =>
    item.x + item.width >= rightEdge && item.x <= rightEdge + 220 && sameLine(item, anchor));
  const underlines = [];

  lineItems.forEach((item) => {
    const characterWidth = item.width / Math.max(item.text.length, 1);
    [...item.text].forEach((character, index) => {
      if (character === "_") {
        underlines.push({
          x: item.x + characterWidth * index,
          width: characterWidth,
        });
      }
    });
  });

  if (underlines.length) {
    return {
      start: Math.min(...underlines.map(({ x }) => x)),
      end: Math.max(...underlines.map(({ x, width }) => x + width)),
      y: anchor.y,
    };
  }

  return {
    start: rightEdge + 4,
    end: rightEdge + 100,
    y: anchor.y,
  };
}

async function createPdf(data) {
  const bytes = new Uint8Array(await data.returnFile.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  const pages = await readPdfPages(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageIndex = pages.findIndex(({ items }) => items.some(
    (item) => itemContains(item, "Em perfeito estado") || itemContains(item, "por recebimento:"),
  ));

  if (pageIndex < 0) {
    throw new Error("Não foi encontrada a seção de Devolução neste PDF.");
  }

  const page = pdf.getPages()[pageIndex];
  const pageData = pages[pageIndex];
  const insert = (text, x, y, size = 9, useBold = false) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color: rgb(0, 0, 0) });
  };

  const dateAnchor = pageData.items.find((item) => itemContains(item, "devolvid"));
  if (data.date && dateAnchor) {
    const slots = findDateSlots(pageData.items, dateAnchor, "devolvid");
    const [day, month, year] = data.date.split("/");
    if (slots.length === 3) {
      [day, month, year].forEach((value, index) => {
        const slot = slots[index];
        const textWidth = font.widthOfTextAtSize(value, 9);
        insert(value, slot.start + (slot.end - slot.start - textWidth) / 2, dateAnchor.y, 9);
      });
    } else {
      const dateLine = findDateLine(pageData.items, dateAnchor, "devolvid");
      const textWidth = font.widthOfTextAtSize(data.date, 9);
      insert(data.date, dateLine.start + (dateLine.end - dateLine.start - textWidth) / 2, dateLine.y, 9);
    }
  }

  const option = pageData.items.find((item) => itemContains(item, data.condition));
  if (option) {
    const punctuation = findParenthesisPositions(pageData.items, option);
    const open = punctuation.filter((item) => item.character === "(").pop();
    const close = punctuation.find((item) => item.character === ")" && (!open || item.x > open.x));
    const center = open && close
      ? (open.x + close.x + close.width) / 2
      : option.x - 8.5;
    const xWidth = bold.widthOfTextAtSize("X", 11.5);
    insert("X", center - xWidth / 2, option.y, 11.5, true);
  }

  const receiverLabel = pageData.items.find((item) =>
    itemContains(item, "Nome responsável por recebimento:") || itemContains(item, "por recebimento:"),
  );
  if (data.receiver && receiverLabel) {
    const label = itemContains(receiverLabel, "Nome responsável por recebimento:")
      ? "Nome responsável por recebimento:"
      : "por recebimento:";
    insert(` ${data.receiver}`, textEndX(receiverLabel, label) + 6, receiverLabel.y, 9);
  }

  return { bytes: await pdf.save(), pageIndex };
}

function validateData(data) {
  if (!data.returnFile) {
    feedback.style.color = "#b42318";
    feedback.textContent = "Selecione o PDF do termo de devolução na etapa 2.";
    return false;
  }
  return true;
}

async function showPreviewContent() {
  const data = readForm();
  if (data.type === "emprestimo") {
    if (!data.fullName) {
      feedback.style.color = "#b42318";
      feedback.textContent = "Informe o nome completo para visualizar a prévia.";
      loanFullName.focus();
      return;
    }
    try {
      await prepareLoanPreview(data);
    } catch (error) {
      previewModal.hidden = true;
      feedback.style.color = "#b42318";
      feedback.textContent = `Não foi possível carregar o modelo: ${error.message}`;
    }
    return;
  }
  if (!validateData(data)) return;
  try {
    previewTitle.textContent = "Prévia do termo de devolução";
    const result = await createPdf(data);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(new Blob([result.bytes], { type: "application/pdf" }));
    previewModal.hidden = false;
    await renderPreview(result.bytes, result.pageIndex);
  } catch (error) {
    feedback.style.color = "#b42318";
    feedback.textContent = `Não foi possível gerar a prévia: ${error.message}`;
  }
}

async function showPreview() {
  if (previewButton.disabled) return;
  const originalText = previewButton.textContent;
  previewButton.disabled = true;
  previewButton.textContent = "Carregando prévia...";
  feedback.style.color = "#667085";
  feedback.textContent = "Carregando o documento preenchido...";
  try {
    await showPreviewContent();
  } finally {
    previewButton.disabled = false;
    previewButton.textContent = originalText;
    if (feedback.textContent === "Carregando o documento preenchido...") feedback.textContent = "";
  }
}

function hidePreview() {
  previewModal.hidden = true;
  previewCanvas.width = 0;
  previewCanvas.height = 0;
  previewCanvas.hidden = false;
  loanPreview.hidden = true;
  loanPreview.removeAttribute("src");
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

async function renderPreview(bytes, pageIndex) {
  const documentProxy = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await documentProxy.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const maxWidth = Math.max(previewCanvas.parentElement.clientWidth - 40, 320);
  const scale = Math.min(1.5, maxWidth / baseViewport.width);
  const viewport = page.getViewport({ scale });
  previewCanvas.width = viewport.width;
  previewCanvas.height = viewport.height;
  await page.render({ canvasContext: previewCanvas.getContext("2d"), viewport }).promise;
}

async function renderFullPreview(bytes) {
  const documentProxy = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  const maxWidth = Math.max(previewCanvas.parentElement.clientWidth - 40, 320);
  const pageCount = documentProxy.numPages;
  const pages = [];
  const viewports = [];
  let totalHeight = 0;
  let scale = 1.5;

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await documentProxy.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const pageScale = Math.min(1.5, maxWidth / baseViewport.width);
    const viewport = page.getViewport({ scale: pageScale });
    pages.push(page);
    viewports.push(viewport);
    totalHeight += viewport.height;
    if (i === 1) scale = pageScale;
  }

  previewCanvas.width = Math.max(...viewports.map((viewport) => viewport.width));
  previewCanvas.height = totalHeight;
  const context = previewCanvas.getContext("2d");
  context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  let offsetY = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const viewport = viewports[i];
    if (!viewport.width || !viewport.height) continue;
    const width = viewport.width;
    const height = viewport.height;
    const x = (previewCanvas.width - width) / 2;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempContext = tempCanvas.getContext("2d");

    try {
      await page.render({ canvasContext: tempContext, viewport }).promise;
      context.drawImage(tempCanvas, x, offsetY);
    } catch (error) {
      console.error(`Falha ao renderizar a página ${i + 1}`, error);
    }
    offsetY += height;
  }
}

previewButton.addEventListener("click", showPreview);
closePreview.addEventListener("click", hidePreview);
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) hidePreview();
});

function buildFeedbackRecord() {
  const data = readForm();
  return {
    pagina: window.location.href,
    arquivo: data.returnFile?.name || "Nenhum arquivo selecionado",
    tipoTermo: data.type,
    dataDevolucao: data.date,
    condicao: data.condition,
    responsavel: data.receiver,
    navegador: navigator.userAgent,
    enviadoEm: new Date().toISOString(),
  };
}

function formatFeedbackRecord(record) {
  return [
    `Página: ${record.pagina}`,
    `Arquivo: ${record.arquivo}`,
    `Tipo de termo: ${record.tipoTermo}`,
    `Data de devolução: ${record.dataDevolucao}`,
    `Condição: ${record.condicao}`,
    `Responsável: ${record.responsavel}`,
    `Navegador: ${record.navegador}`,
    `Enviado em: ${record.enviadoEm}`,
  ].join("\n");
}

function hideFeedback() {
  feedbackModal.hidden = true;
  feedbackName.value = "";
  feedbackMessage.value = "";
  feedbackStatus.textContent = "";
}

feedbackButton.addEventListener("click", () => {
  feedbackStatus.textContent = "";
  feedbackModal.hidden = false;
  feedbackName.focus();
});
closeFeedback.addEventListener("click", hideFeedback);
cancelFeedback.addEventListener("click", hideFeedback);
feedbackModal.addEventListener("click", (event) => {
  if (event.target === feedbackModal) hideFeedback();
});

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = feedbackName.value.trim();
  const message = feedbackMessage.value.trim();
  if (!name || !message) return;

  sendFeedback.disabled = true;
  feedbackStatus.style.color = "#667085";
  feedbackStatus.textContent = "Enviando...";
  try {
    const record = buildFeedbackRecord();
    const response = await fetch(feedbackEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ registro: formatFeedbackRecord(record), mensagem: `${message}\n\nNome: ${name}` }),
    });
    if (response.type !== "opaque" && !response.ok) throw new Error("Resposta inválida do servidor.");
    feedbackStatus.style.color = "#027a48";
    feedbackStatus.textContent = "Feedback enviado com sucesso.";
    feedbackName.value = "";
    feedbackMessage.value = "";
    window.setTimeout(hideFeedback, 900);
  } catch (error) {
    feedbackStatus.style.color = "#b42318";
    feedbackStatus.textContent = `Não foi possível enviar: ${error.message}`;
  } finally {
    sendFeedback.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  feedback.textContent = "";
  const data = readForm();
  if (data.type === "emprestimo") {
    if (!data.fullName) {
      feedback.style.color = "#b42318";
      feedback.textContent = "Informe o nome completo para gerar o PDF.";
      loanFullName.focus();
      return;
    }
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Gerando PDF...";
    feedback.style.color = "#667085";
    feedback.textContent = "Gerando o documento preenchido...";
    try {
      await saveLoanPdf(data);
      feedback.style.color = "#027a48";
      feedback.textContent = "PDF do termo de empréstimo gerado com sucesso.";
    } catch (error) {
      if (error.name === "AbortError") return;
      feedback.style.color = "#b42318";
      feedback.textContent = `Não foi possível gerar o PDF: ${error.message}`;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
    return;
  }
  if (!validateData(data)) return;
  try {
    const result = await createPdf(data);
    if (sourceFileHandle) {
      try {
        if (sourceFileHandle.requestPermission) {
          const permission = await sourceFileHandle.requestPermission({ mode: "readwrite" });
          if (permission !== "granted") throw new Error("Permissão de escrita não concedida.");
        }
        const writable = await sourceFileHandle.createWritable();
        await writable.write(result.bytes);
        await writable.close();
        selectedFile = await sourceFileHandle.getFile();
        feedback.style.color = "#027a48";
        feedback.textContent = "Termo salvo no mesmo arquivo e local de origem.";
        return;
      } catch (writeError) {
        sourceFileHandle = null;
      }
    }
    const url = URL.createObjectURL(new Blob([result.bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = data.returnFile.name || "termo-de-devolucao.pdf";
    link.click();
    URL.revokeObjectURL(url);
    feedback.style.color = "#027a48";
    feedback.textContent = "Termo gerado com o mesmo nome. O navegador iniciou o download.";
  } catch (error) {
    feedback.style.color = "#b42318";
    feedback.textContent = `Não foi possível gerar o PDF: ${error.message}`;
  }
});

updateTermType();
