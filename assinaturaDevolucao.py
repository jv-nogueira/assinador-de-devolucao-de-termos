from datetime import datetime
import os
import tkinter.messagebox as msgbox

import customtkinter as ctk
import fitz  # PyMuPDF

ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")


class AppTermosDevolucao(ctk.CTk):

    def __init__(self):
        super().__init__()

        self.title("Gerenciador de Termos - Devolução (Wacom STU-500B)")
        self.geometry("520x480")
        self.resizable(False, False)

        # ----------------------------------------------------
        # TOP: SELEÇÃO DE CAMINHO
        # ----------------------------------------------------
        self.frame_caminho = ctk.CTkFrame(self)
        self.frame_caminho.pack(padx=20, pady=(15, 10), fill="x")

        self.entry_caminho = ctk.CTkEntry(
            self.frame_caminho,
            placeholder_text="Cole o caminho do arquivo PDF ou clique em Procurar...",
            width=360,
        )
        self.entry_caminho.pack(side="left", padx=(10, 5), pady=10)

        self.btn_procurar = ctk.CTkButton(
            self.frame_caminho,
            text="Procurar...",
            width=100,
            command=self.procurar_arquivo,
        )
        self.btn_procurar.pack(side="left", padx=(5, 10), pady=10)

        # ----------------------------------------------------
        # CORPO: DADOS DE DEVOLUÇÃO
        # ----------------------------------------------------
        self.frame_devolucao = ctk.CTkFrame(self)
        self.frame_devolucao.pack(padx=20, pady=10, fill="both", expand=True)

        ctk.CTkLabel(
            self.frame_devolucao,
            text="Dados de Devolução",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#22C55E",
        ).pack(pady=10)

        self.entry_dt_dev = ctk.CTkEntry(
            self.frame_devolucao, placeholder_text="Data Devolução"
        )
        self.entry_dt_dev.pack(fill="x", padx=25, pady=5)

        # Condição do Equipamento
        ctk.CTkLabel(
            self.frame_devolucao, text="Condição do Equipamento:", anchor="w"
        ).pack(fill="x", padx=25, pady=(5, 0))
        self.cbo_condicao = ctk.CTkOptionMenu(
            self.frame_devolucao,
            values=[
                "Em perfeito estado",
                "Apresentando defeito",
                "Faltando peças ou acessórios",
            ],
        )
        self.cbo_condicao.pack(fill="x", padx=25, pady=5)

        # Responsável pelo Recebimento (Lista Suspensa)
        ctk.CTkLabel(
            self.frame_devolucao,
            text="Responsável pelo Recebimento:",
            anchor="w",
        ).pack(fill="x", padx=25, pady=(5, 0))
        self.cbo_resp = ctk.CTkOptionMenu(
            self.frame_devolucao,
            values=[
                "João Vitor Nogueira da Silva",
                "Brian Farias Cavalcanti",
                "Thauany Mendes Pereira",
            ],
        )
        self.cbo_resp.pack(fill="x", padx=25, pady=5)

        # Label de alerta auto-ocultável
        self.lbl_status_temp = ctk.CTkLabel(
            self.frame_devolucao, text="", text_color="green"
        )
        self.lbl_status_temp.pack(pady=5)

        # BOTÃO DEVOLUÇÃO
        self.btn_salvar_dev = ctk.CTkButton(
            self.frame_devolucao,
            text="💾 Salvar e Assinar Devolução",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#16A34A",
            hover_color="#15803D",
            height=40,
            command=self.salvar_devolucao,
        )
        self.btn_salvar_dev.pack(padx=25, pady=(10, 15), fill="x")

        self.preencher_data_hoje()

    def preencher_data_hoje(self):
        hoje = datetime.now().strftime("%d/%m/%y")
        self.entry_dt_dev.insert(0, hoje)

    def procurar_arquivo(self):
        arquivo = ctk.filedialog.askopenfilename(
            filetypes=[("Arquivos PDF", "*.pdf")]
        )
        if arquivo:
            self.entry_caminho.delete(0, "end")
            self.entry_caminho.insert(0, arquivo)

    def salvar_devolucao(self):
        caminho_pdf = self.entry_caminho.get().strip()
        data_dev = self.entry_dt_dev.get().strip()
        opcao_escolhida = self.cbo_condicao.get().strip()
        resp = self.cbo_resp.get().strip()

        if not caminho_pdf or not os.path.exists(caminho_pdf):
            msgbox.showerror(
                "Erro", "Selecione um arquivo PDF válido antes de salvar."
            )
            return

        try:
            doc = fitz.open(caminho_pdf)

            # BUSCA DINÂMICA DA PÁGINA QUE CONTÉM A SEÇÃO DE DEVOLUÇÃO
            pagina = None
            for page in doc:
                if page.search_for("Em perfeito estado") or page.search_for(
                    "por recebimento:"
                ):
                    pagina = page
                    break

            if not pagina:
                doc.close()
                msgbox.showerror(
                    "Erro",
                    "Não foi encontrada a seção de Devolução neste PDF.",
                )
                return

            # -----------------------------------------------------------
            # 1. DATA DEVOLUÇÃO
            # -----------------------------------------------------------
            if data_dev:
                rects_dev = pagina.search_for("devolvidos")
                if rects_dev:
                    r_dev = rects_dev[0]
                    area_busca_data = fitz.Rect(
                        r_dev.x1,
                        r_dev.y0 - 5,
                        r_dev.x1 + 220,
                        r_dev.y1 + 5,
                    )
                    barras = pagina.search_for("/", clip=area_busca_data)
                    partes_data = data_dev.split("/")

                    if len(barras) >= 2 and len(partes_data) == 3:
                        dia, mes, ano = (
                            partes_data[0],
                            partes_data[1],
                            partes_data[2],
                        )
                        b1, b2 = barras[0], barras[1]

                        font_sz_dt, font_nm_dt = 9, "helv"

                        # Dia
                        largura_dia = fitz.get_text_length(
                            dia, fontname=font_nm_dt, fontsize=font_sz_dt
                        )
                        pagina.insert_text(
                            fitz.Point(b1.x0 - largura_dia - 2, b1.y1 - 1),
                            dia,
                            fontsize=font_sz_dt,
                            fontname=font_nm_dt,
                            color=(0, 0, 0),
                        )

                        # Mês
                        centro_mes = (b1.x1 + b2.x0) / 2
                        largura_mes = fitz.get_text_length(
                            mes, fontname=font_nm_dt, fontsize=font_sz_dt
                        )
                        pagina.insert_text(
                            fitz.Point(
                                centro_mes - (largura_mes / 2), b1.y1 - 1
                            ),
                            mes,
                            fontsize=font_sz_dt,
                            fontname=font_nm_dt,
                            color=(0, 0, 0),
                        )

                        # Ano
                        pagina.insert_text(
                            fitz.Point(b2.x1 + 2, b2.y1 - 1),
                            ano,
                            fontsize=font_sz_dt,
                            fontname=font_nm_dt,
                            color=(0, 0, 0),
                        )
                    else:
                        pagina.insert_text(
                            fitz.Point(r_dev.x1 + 6, r_dev.y1 - 1),
                            f" {data_dev}",
                            fontsize=9,
                            fontname="helv",
                            color=(0, 0, 0),
                        )

            # -----------------------------------------------------------
            # 2. CÁLCULO DO CENTRO DOS PARÊNTESES ( ) COM 'X'
            # -----------------------------------------------------------
            if opcao_escolhida:
                rects_opcao = pagina.search_for(opcao_escolhida)
                if rects_opcao:
                    r_opcao = rects_opcao[0]

                    area_busca = fitz.Rect(
                        r_opcao.x0 - 50,
                        r_opcao.y0 - 4,
                        r_opcao.x0,
                        r_opcao.y1 + 4,
                    )

                    rects_open = pagina.search_for("(", clip=area_busca)
                    rects_close = pagina.search_for(")", clip=area_busca)
                    rects_par = pagina.search_for("()", clip=area_busca)

                    x_centro = None

                    if rects_open and rects_close:
                        x_centro = (rects_open[0].x0 + rects_close[0].x1) / 2
                    elif rects_par:
                        x_centro = (rects_par[0].x0 + rects_par[0].x1) / 2

                    font_size_x, font_name_x = 11.5, "hebo"

                    if x_centro is not None:
                        largura_x = fitz.get_text_length(
                            "X", fontname=font_name_x, fontsize=font_size_x
                        )
                        pos_x = x_centro - (largura_x / 2)
                    else:
                        pos_x = r_opcao.x0 - 8.5

                    pos_y = r_opcao.y1 - 0.5

                    pagina.insert_text(
                        fitz.Point(pos_x, pos_y),
                        "X",
                        fontsize=font_size_x,
                        fontname=font_name_x,
                        color=(0, 0, 0),
                    )

            # -----------------------------------------------------------
            # 3. NOME DO RESPONSÁVEL
            # -----------------------------------------------------------
            if resp:
                rects_resp = pagina.search_for(
                    "Nome responsável por recebimento:"
                )
                if not rects_resp:
                    rects_resp = pagina.search_for("por recebimento:")

                if rects_resp:
                    r = rects_resp[0]
                    pagina.insert_text(
                        fitz.Point(r.x1 + 6, r.y1 - 1),
                        f" {resp}",
                        fontsize=9,
                        fontname="helv",
                        color=(0, 0, 0),
                    )

            # Salva mantendo a integridade incremental
            doc.save(
                caminho_pdf,
                incremental=True,
                encryption=fitz.PDF_ENCRYPT_KEEP,
            )
            doc.close()

            os.startfile(caminho_pdf)

            self.lbl_status_temp.configure(
                text="✓ Devolução salva com sucesso! Abrindo no Wacom...",
                text_color="green",
            )

        except Exception as e:
            msgbox.showerror(
                "Erro ao Salvar",
                f"Não foi possível atualizar o PDF:\n{e}\n\nVerifique se o arquivo não está aberto.",
            )


if __name__ == "__main__":
    app = AppTermosDevolucao()
    app.mainloop()