# Landing page — Marketing Local em Ação

Abra esta pasta no VS Code.

- index.html: textos e estrutura.
- style.css: cores, fontes e layout responsivo.
- mockup.png: imagem do ebook.

Para visualizar, abra index.html no navegador ou use a extensão Live Server do VS Code.

Checkout configurado: https://pay.kiwify.com.br/feioxoq

## Barra e cronômetro

`future-banner.js` registra a primeira visita no início do carregamento com a chave
`desafio-first-visit-at`. A barra aparece após dez segundos na primeira visita e
imediatamente nos retornos. A contagem inclui o tempo com o site fechado; se o
armazenamento estiver bloqueado, começa de novo em cada visita.

`style.css` define os dígitos mecânicos, movimento reduzido, área segura e layout
lado a lado até 760px. A altura medida da barra reserva espaço no conteúdo e nas âncoras.

## Verificação

Os testes usam Node.js e Chromium real por meio de Playwright Core (dependência
somente de desenvolvimento; não é carregada pelo site). Com `playwright-core`
disponível, execute `node --test`. Para preparar essas ferramentas localmente:

```powershell
npm.cmd install --no-save playwright-core
npx.cmd playwright-core install chromium
node --test
```

Se Playwright Core já estiver instalado em outra pasta, defina `PLAYWRIGHT_MODULE`
com o caminho absoluto desse módulo antes de executar `node --test`.

A suíte verifica persistência, primeira visita, armazenamento inválido/bloqueado,
viradas de dígitos e horas acima de 99, retorno à visibilidade, acessibilidade,
movimento reduzido, redimensionamento e âncoras. Gera capturas em
`tests/artifacts/` nas larguras de 1280, 760, 320, 375 e 390px.

A animação usa uma roda de dez números por dígito, adaptada do Counter do React Bits
(https://reactbits.dev/components/counter), com repetição para a passagem contínua de 9 para 0.
