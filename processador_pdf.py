import re
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
import pdfplumber
import pikepdf

PADRAO_NOME = re.compile(
    r"Nome:\s*(.+?)\s*Setor/opera[cç][aã]o:", re.IGNORECASE
)


def extrair_nome(texto: str) -> str:
    if not texto:
        return "NÃO ENCONTRADO"
    m = PADRAO_NOME.search(texto)
    return m.group(1).strip() if m else "NÃO ENCONTRADO"


def identificar_posicao_devolucao(caminho_pdf: Path):
    try:
        with pdfplumber.open(caminho_pdf) as pdf:
            for idx, pagina in enumerate(pdf.pages, start=1):
                words = pagina.extract_words()
                for w in words:
                    if re.search(r"\bDevolução\b", w["text"]):
                        altura = float(pagina.height)
                        top = float(w["top"])
                        return idx, altura - top
    except Exception:
        pass
    return None, None


def formatar_data_pdf(data_bruta: str) -> str:
    if not data_bruta.startswith("D:"):
        return data_bruta
    try:
        dt = datetime.strptime(data_bruta[2:16], "%Y%m%d%H%M%S")
        return dt.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return data_bruta


def verificar_assinatura(caminho_pdf: Path, pag_dev: int, y_dev_pdf: float):
    try:
        pdf = pikepdf.open(caminho_pdf)
    except Exception as e:
        return "", "", f"Erro ao abrir PDF: {e}"

    assinaturas_emprestimo, assinaturas_devolucao, detalhes = [], [], []

    for i, page in enumerate(pdf.pages, start=1):
        annots = page.get("/Annots", [])
        for a in annots:
            if a.get("/FT") == "/Sig":
                valor = a.get("/V")
                nome_campo = str(a.get("/T", ""))
                if valor is not None:
                    nome_assinante = str(valor.get("/Name", ""))
                    data_fmt = formatar_data_pdf(str(valor.get("/M", "")))
                    info_str = (
                        f"{data_fmt} ({nome_assinante})"
                        if nome_assinante
                        else data_fmt
                    )
                    detalhes.append(
                        f"Pág {i} [campo={nome_campo}, data={data_fmt}]"
                    )

                    eh_devolucao = False
                    if pag_dev is not None:
                        if i > pag_dev:
                            eh_devolucao = True
                        elif i == pag_dev and y_dev_pdf is not None:
                            rect = a.get("/Rect", [0, 0, 0, 0])
                            sig_y = (float(rect[1]) + float(rect[3])) / 2.0
                            if sig_y < y_dev_pdf:
                                eh_devolucao = True

                    if eh_devolucao:
                        assinaturas_devolucao.append(info_str)
                    else:
                        assinaturas_emprestimo.append(info_str)

    return (
        "; ".join(assinaturas_emprestimo),
        "; ".join(assinaturas_devolucao),
        "; ".join(detalhes) if detalhes else "Nenhum campo de assinatura",
    )


def extrair_texto_completo(caminho_pdf: Path) -> str:
    partes = []
    try:
        with pdfplumber.open(caminho_pdf) as pdf:
            for pagina in pdf.pages:
                t = pagina.extract_text()
                if t:
                    partes.append(t)
    except Exception:
        pass
    return "\n".join(partes)


def processar_pdf(caminho_pdf: Path) -> dict:
    texto = extrair_texto_completo(caminho_pdf)
    nome = extrair_nome(texto)
    pag_dev, y_dev_pdf = identificar_posicao_devolucao(caminho_pdf)
    empr_dt, dev_dt, detalhes = verificar_assinatura(
        caminho_pdf, pag_dev, y_dev_pdf
    )

    return {
        "arquivo": caminho_pdf.name,
        "caminho": str(caminho_pdf),
        "nome": nome,
        "emprestimo": empr_dt,
        "devolucao": dev_dt,
        "detalhes": detalhes,
    }