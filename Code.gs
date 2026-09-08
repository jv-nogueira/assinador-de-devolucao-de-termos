const TEMPLATE_DOCUMENT_ID = "16sDzzrhLN_JL9Q8WT2-h6Wze3xCtcmQ9mXIIJ_tWtSQ";

function doGet() {
  return jsonResponse({ ok: true, message: "API do termo ativa" });
}

function doPost(event) {
  let copyId = null;
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const fullName = String(payload.nome_completo || "").trim();
    const linhas = Array.isArray(payload.linhas) ? payload.linhas : [];
    if (!fullName) throw new Error("O campo nome_completo é obrigatório.");

    const template = DriveApp.getFileById(TEMPLATE_DOCUMENT_ID);
    const copy = template.makeCopy(`Termo de responsabilidade - ${fullName}`);
    copyId = copy.getId();

    const document = DocumentApp.openById(copyId);
    const body = document.getBody();
    body.replaceText("\\{\\{nome_completo\\}\\}", fullName);

    if (linhas.length > 0) {
      fillTable(body, linhas);
    }

    document.saveAndClose();

    const pdf = UrlFetchApp.fetch(
      `https://docs.google.com/document/d/${copyId}/export?format=pdf`,
      { headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` } }
    ).getBlob();

    return jsonResponse({
      ok: true,
      fileName: `termo-responsabilidade-${slugify(fullName)}.pdf`,
      pdfBase64: Utilities.base64Encode(pdf.getBytes()),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    if (copyId) {
      try { DriveApp.getFileById(copyId).setTrashed(true); } catch (e) {}
    }
  }
}

function slugify(value) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fillTable(body, linhas) {
  const tables = body.getTables();
  let targetTable = null;

  for (const table of tables) {
    const firstRow = table.getRow(0);
    const headerTexts = [];
    for (let c = 0; c < firstRow.getNumCells(); c++) {
      headerTexts.push(normalizeText(firstRow.getCell(c).getText()));
    }
    if (headerTexts.some((t) => t.includes("item")) && headerTexts.some((t) => t.includes("qtd"))) {
      targetTable = table;
      break;
    }
  }

  if (!targetTable) return;

  while (targetTable.getNumRows() > 1) {
    targetTable.removeRow(targetTable.getNumRows() - 1);
  }

  if (linhas.length === 0) return;

  for (const linha of linhas) {
    const newRow = targetTable.appendTableRow();
    const values = [linha.id || "", linha.qntd || "", linha.marca || "", linha.modelo || "", linha.observacao || ""];
    for (let c = 0; c < values.length; c += 1) {
      newRow.appendTableCell(values[c]);
    }
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}