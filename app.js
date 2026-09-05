const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

const form = document.querySelector("#term-form");
const fileInput = document.querySelector("#pdf-file");
const fileName = document.querySelector("#file-name");
const feedback = document.querySelector("#feedback");
const termTypes = document.querySelectorAll('input[name="termType"]');
const returnFields = document.querySelector("#return-fields");
const returnData = document.querySelector("#return-data");
const previewButton = document.querySelector("#preview-button");
const previewModal = document.querySelector("#preview-modal");
const previewCanvas = document.querySelector("#preview-canvas");
const closePreview = document.querySelector("#close-preview");
const receiverSelect = document.querySelector("#receiver");
const otherReceiver = document.querySelector("#other-receiver");
let previewUrl = null;
let selectedFile = null;
let sourceFileHandle = null;

document.querySelector("#return-date").value = new Date().toISOString().slice(0, 10);

function selectedTermType() {
  return document.querySelector('input[name="termType"]:checked').value;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
}

function updateTermType() {
  termTypes.forEach((input) => input.closest(".term-type").classList.toggle("selected", input.checked));
}

termTypes.forEach((input) => input.addEventListener("change", updateTermType));
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
  };
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
    const slashes = findSlashPositions(pageData.items, dateAnchor, "devolvid");
    const [day, month, year] = data.date.split("/");
    if (slashes.length >= 2) {
      insert(day, slashes[0].x - font.widthOfTextAtSize(day, 9) - 2, slashes[0].y, 9);
      const monthWidth = font.widthOfTextAtSize(month, 9);
      insert(month, (slashes[0].x + slashes[0].width + slashes[1].x - monthWidth) / 2, slashes[0].y, 9);
      insert(year, slashes[1].x + slashes[1].width + 2, slashes[1].y, 9);
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
    insert(` ${data.receiver}`, receiverLabel.x + receiverLabel.width + 6, receiverLabel.y, 9);
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

async function showPreview() {
  feedback.textContent = "";
  const data = readForm();
  if (!validateData(data)) return;
  try {
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

function hidePreview() {
  previewModal.hidden = true;
  previewCanvas.width = 0;
  previewCanvas.height = 0;
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

previewButton.addEventListener("click", showPreview);
closePreview.addEventListener("click", hidePreview);
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) hidePreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  feedback.textContent = "";
  const data = readForm();
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
