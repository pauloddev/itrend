# iTrend · Landing page

Site estático (HTML + CSS + JS puro, sem dependências), pronto para GitHub + Vercel.

```
itrend/
├── public/                  ← tudo o que vai ao ar (outputDirectory no Vercel)
│   ├── index.html           página única
│   ├── 404.html             página de erro (noindex)
│   ├── styles.css · main.js
│   ├── robots.txt · sitemap.xml · site.webmanifest
│   ├── favicon.ico (16/32/48) · favicon.svg · apple-touch-icon.png (180x180)
│   ├── icons/icon-192.png · icons/icon-512.png
│   ├── fonts/  (Sora, WOFF2, font-display: swap)
│   └── img/    (AVIF + WebP + JPG/PNG em vários tamanhos)
├── scripts/set-site-url.mjs troca a URL do site em todos os arquivos
├── site.config.json         SITE_URL centralizada
├── vercel.json              cache, headers e saída "public"
└── package.json
```

## 1. Checklist de qualidade (Parte 1)

| # | Item | Status |
|---|------|--------|
| 1 | Rolagem horizontal | ✅ Testado em 320, 375, 768 e 1440 px: `scrollWidth = clientWidth`. `box-sizing: border-box`, `max-width: 100%` em mídias, sem `100vw`, `overflow-x: clip` no html/body, carrosséis rolam só dentro da própria faixa. |
| 2 | Favicon | ✅ Arquivos gerados a partir do isotipo e tags prontas: `favicon.ico` (32x32), `favicon.svg`, `apple-touch-icon.png` (180x180), `icon-192/512.png` via `site.webmanifest`, `theme-color`. |
| 3 | Meta descrição / title | ✅ Title e description com os dados da iTrend. |
| 4 | Página 404 | ✅ `public/404.html`, mesma identidade, botão para a home e para o WhatsApp, `noindex`. |
| 5 | Imagens | ✅ AVIF/WebP + fallback, `srcset`/`sizes`, `width`/`height` declarados, `loading="lazy"` abaixo da dobra, isotipo do hero com `preload` + `fetchpriority="high"`. Textos e bordas removidos por recorte (sem borrões e sem alterar rostos). |
| 6 | Botões | ✅ Nenhum `href="#"` vazio; todos com hover, `:focus-visible` e `:active`; área de toque ≥ 44x44 px (verificado automaticamente); âncoras com `scroll-padding-top` para o header. |
| 7 | Logo clicável | ✅ Header e rodapé levam ao topo (`#topo`); na 404 leva para `/`. |
| 8 | Mobile | ✅ Viewport com `viewport-fit=cover`, texto base 16 px, menu mobile, CTAs grandes, `100dvh`, `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast` respeitados. |
| 9 | Travessões | ✅ Nenhum “—” ou “–” em nenhum arquivo. |
| 10 | Links | ✅ Âncoras conferidas, nenhuma imagem/fonte/script com erro, todo `target="_blank"` com `rel="noopener noreferrer"`, WhatsApp em `wa.me/55…`, `tel:+55…` e `mailto:` corretos. |
| 11 | Títulos | ✅ `clamp()`, `line-height` ajustado por tamanho, `text-wrap: balance`, contraste AA. |
| 12 | Velocidade | ✅ Zero dependências e zero frameworks, script com `defer`, 1 família de fonte (Sora WOFF2, `swap`, `preload`); a outra é a fonte do sistema. Mapa com `loading="lazy"`. Cache longo para `/img`, `/fonts`, `/icons` no `vercel.json`. |

## 2. SEO técnico (Parte 2)

| # | Item | Status |
|---|------|--------|
| 1 | Title e description | ✅ Só com informações do site. |
| 2 | Canonical absoluta | ✅ Usa a SITE_URL. |
| 3 | robots.txt | ✅ `Allow: /` + sitemap absoluto. |
| 4 | sitemap.xml | ✅ Só a home (site de página única). |
| 5 | Open Graph / Twitter | ✅ `og:title/description/url/type/image/locale=pt_BR` + `summary_large_image`. `og:image` aponta para `/og-image.jpg` (**criar**). |
| 6 | Vercel | ✅ `vercel.json` com `outputDirectory: public`; nenhum domínio fictício além do marcador de troca. |
| 7 | noindex / conflitos | ✅ Nenhum `noindex` no site (só na 404), sem `X-Robots-Tag`; canonical, og:url e sitemap usam a mesma URL. |
| 8 | `lang="pt-BR"` | ✅ |
| 9 | Um `<h1>` e hierarquia | ✅ 1 `h1`, seções em `h2`, cards em `h3`. |
| 10 | `alt` | ✅ Descritivo nas fotos; decorativas com `alt=""`. |
| 11 | Favicon | ✅ Ver item 2 acima. |
| 12 | JSON-LD | ✅ `MobilePhoneStore` com nome, endereço com CEP, telefone, e-mail, horários (seg. a sáb. e domingo), pagamentos e Instagram. |
| 13 | Rotas | Não se aplica: página única. |

## 3. iTrend: o que mudou

* **Cores oficiais** tiradas do logo: azul `#2E1DDD` e laranja `#FE6603`. Seções majoritariamente brancas, alternando com faixas azuis (Boleto, Assistência) e laranja (Capas).
* **Logo** vetorizado a partir do arquivo oficial (`img/logo-itrend.svg`, `img/isotipo-itrend.svg`, versão branca para fundos escuros).
* **Vídeos** em `public/video/` (H.264, sem áudio, máx. 20 s, com pôster). Só o vídeo do centro toca; ao terminar, o carrossel passa para o próximo.
* **Horário aberto/fechado** calculado no fuso de Boa Vista (`America/Boa_Vista`), domingo até 12:00.
* **Fotos** recortadas na mesma proporção, sem textos por cima (recorte, sem borrões). O flyer "Faça um upgrade" entra inteiro porque o texto é parte da peça.

## 4. O que ficou para preencher

| O quê | Onde | O que fazer |
|-------|------|-------------|
| URL do site (SITE_URL) | `site.config.json`, `public/index.html`, `robots.txt`, `sitemap.xml` | `node scripts/set-site-url.mjs https://seu-projeto.vercel.app` |
| Lista de serviços da assistência | `public/index.html`, seção `#assistencia` | Os 12 serviços são os mais comuns em assistência de celular. Confira com a loja e ajuste o que não for oferecido. |
| Telefone da fachada | foto `loja-fachada` | A placa mostra (83); o site usa (95) 99138-3639, como informado. |

## 5. Publicação

**a. Vercel via GitHub**
1. Crie um repositório no GitHub e envie esta pasta inteira (`git init`, `git add .`, `git commit`, `git push`).
2. No Vercel: *Add New → Project → Import* o repositório. Framework Preset: **Other**. Não precisa de build. O `vercel.json` já indica a pasta `public`.
3. Clique em **Deploy**.

**b. Trocar a URL**
1. Copie o link de produção (`seu-projeto.vercel.app`, não o de preview).
2. Rode `node scripts/set-site-url.mjs https://seu-projeto.vercel.app`, faça commit e push.
3. Confira `https://seu-projeto.vercel.app/robots.txt` e `/sitemap.xml` no link de produção.
   Links de *preview* do Vercel ficam com `noindex` por padrão; isso é normal.

**c. Google Search Console**
1. Acesse search.google.com/search-console e adicione uma propriedade do tipo **Prefixo do URL** com o link de produção.
2. Verifique pelo método **Tag HTML**: cole a meta tag no `<head>` do `public/index.html`, publique e clique em Verificar.
3. Em **Sitemaps**, envie `sitemap.xml`.
4. Em **Inspeção de URL**, cole a home e clique em **Solicitar indexação**.
   A indexação depende da avaliação do Google e pode levar dias.

**d. Domínio próprio no futuro**
1. Vercel → Project → Settings → Domains: adicione o domínio e configure o DNS.
2. Defina o domínio novo como principal e o `.vercel.app` para **redirecionar (308)** para ele.
3. Rode `node scripts/set-site-url.mjs https://seudominio.com.br`, commit e push.
4. No Search Console, adicione a nova propriedade, envie o sitemap de novo e use **Mudança de endereço** se a antiga já estiver indexada.
