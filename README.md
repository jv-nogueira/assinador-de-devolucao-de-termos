# Assinador de termos

Aplicação web estática para gerar termos de empréstimo e devolução de equipamentos.

## Executar localmente

Abra `index.html` no navegador ou sirva a pasta com qualquer servidor HTTP local.
A biblioteca de geração de PDF é carregada pelo navegador via CDN.

## Publicar no GitHub Pages

O workflow em `.github/workflows/deploy-pages.yml` publica automaticamente o
conteúdo do repositório quando houver push na branch `main`. No repositório,
configure **Settings > Pages > Source** como **GitHub Actions**.

## Próximas integrações

Os dados são preenchidos manualmente nesta primeira versão. A consulta ao
Active Directory e o acesso à pasta de rede devem ser adicionados posteriormente
por meio de uma API interna autorizada pela TI.
