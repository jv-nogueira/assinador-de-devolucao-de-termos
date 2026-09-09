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
    replacePlaceholder(body, "nome_completo", fullName, false);
    replacePlaceholder(body, "cpf", payload.cpf, false);
    replacePlaceholder(body, "setor_ou_operacao", payload.setor_ou_operacao, false);
    replacePlaceholder(body, "cargo", payload.cargo, false);
    replacePlaceholder(body, "email_profissional", payload.email_profissional, false);
    replacePlaceholder(body, "email_pessoal", payload.email_pessoal, false);
    replaceManagerPlaceholder(body, payload.gestor_que_aprovou);
    replacePlaceholder(body, "emprestimo_dia", payload.emprestimo_dia, true);
    replacePlaceholder(body, "emprestimo_mes", payload.emprestimo_mes, true);
    replacePlaceholder(body, "emprestimo_ano", payload.emprestimo_ano, true);
    replaceLiteralPlaceholder(body, "((emprestimo_ano}}", payload.emprestimo_ano, true);
    replacePlaceholder(body, "check_perfeito", "", false);
    replacePlaceholder(body, "check_defeito", "", false);
    replacePlaceholder(body, "check_faltando", "", false);
    replacePlaceholder(body, "check_outros", "", false);
    replacePlaceholder(body, "devolucao_dia", "", false);
    replacePlaceholder(body, "devolucao_mes", "", false);
    replacePlaceholder(body, "devolucao_ano", "", false);
    replacePlaceholder(body, "tecnico_recebedor", "", false);

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
  if (targetTable.getNumRows() < 2) return;

  const templateRow = targetTable.getRow(1).copy();

  while (targetTable.getNumRows() > 1) {
    targetTable.removeRow(targetTable.getNumRows() - 1);
  }

  if (linhas.length === 0) return;

  linhas.forEach((linha) => {
    const newRow = targetTable.appendTableRow(templateRow.copy());
    const values = [linha.id || "", linha.qntd || "", linha.marca || "", linha.modelo || "", linha.observacao || ""];
    for (let c = 0; c < values.length; c += 1) {
      newRow.getCell(c).setText(values[c]);
    }
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function replacePlaceholder(body, name, value, underline) {
  const replacement = String(value || "");
  let match = body.findText(`\\{\\{${name}\\}\\}`);

  replaceMatch(body, match, replacement, underline, () => body.findText(`\\{\\{${name}\\}\\}`));
}

function replaceLiteralPlaceholder(body, placeholder, value, underline) {
  const replacement = String(value || "");
  const pattern = placeholder === "((emprestimo_ano}}"
    ? "\\(\\(emprestimo_ano\\}\\}"
    : placeholder;
  const match = body.findText(pattern);
  replaceMatch(body, match, replacement, underline, () => body.findText(pattern));
}

function replaceManagerPlaceholder(body, value) {
  const manager = String(value || "");
  const replacement = manager + "_".repeat(Math.max(34 - manager.length, 0));
  let match = body.findText("\\{\\{gestor_que_aprovou\\}\\}");

  while (match) {
    const text = match.getElement().asText();
    const start = match.getStartOffset();
    const end = match.getEndOffsetInclusive();
    text.deleteText(start, end);
    text.insertText(start, replacement);
    text.setUnderline(start, start + replacement.length - 1, true);
    match = body.findText("\\{\\{gestor_que_aprovou\\}\\}");
  }
}

function replaceMatch(body, match, replacement, underline, findNext) {
  while (match) {
    const text = match.getElement().asText();
    const start = match.getStartOffset();
    const end = match.getEndOffsetInclusive();
    text.deleteText(start, end);
    if (replacement) {
      text.insertText(start, replacement);
      if (underline) text.setUnderline(start, start + replacement.length - 1, true);
    }
    match = findNext();
  }
}