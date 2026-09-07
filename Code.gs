const TEMPLATE_DOCUMENT_ID = "16sDzzrhLN_JL9Q8WT2-h6Wze3xCtcmQ9mXIIJ_tWtSQ";

function doGet() {
  return jsonResponse({ ok: true, message: "API do termo ativa" });
}

function doPost(event) {
  let copyId = null;
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const fullName = String(payload.nome_completo || "").trim();
    if (!fullName) throw new Error("O campo nome_completo é obrigatório.");

    const template = DriveApp.getFileById(TEMPLATE_DOCUMENT_ID);
    const copy = template.makeCopy(`Termo de responsabilidade - ${fullName}`);
    copyId = copy.getId();

    const document = DocumentApp.openById(copyId);
    const body = document.getBody();
    body.replaceText("\\{\\{nome_completo\\}\\}", fullName);
    document.saveAndClose();

    const pdf = UrlFetchApp.fetch(
      `https://docs.google.com/document/d/${copyId}/export?format=pdf`,
      { headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken() }` } },
    ).getBlob();

    return jsonResponse({
      ok: true,
      fileName: `termo-responsabilidade-${slugify(fullName)}.pdf`,
      pdfBase64: Utilities.base64Encode(pdf.getBytes()),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    if (copyId) DriveApp.getFileById(copyId).setTrashed(true);
  }
}

function slugify(value) {
  return value.normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}