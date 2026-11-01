# Resumo da Fase 3 — "Correio de arquivos"

**Período:** 31/10/2026
**Situação:** ✅ concluída (falta só o teste com a chave real do Supabase)
**Execuções que fizeram parte desta fase:**
[11 — o correio de arquivos](../11-fase3-parte1-correio-de-arquivos.md) ·
[12 — ligação com o Supabase Storage](../12-fase3-parte2-supabase-storage.md)

---

## Em uma frase

Fotos e documentos agora passam só pelo backend, que confere quem pode enviar, abrir e apagar cada arquivo antes
de falar com o lugar onde eles ficam guardados. O navegador nunca mais fala direto com o Supabase.

---

## Ponto de partida

Hoje as telas mandam e buscam arquivos **direto no Supabase**, usando o login do Supabase. Quando esse login sair
(Fase 6), isso deixaria de funcionar. Faltava um "correio" no backend.

## O que existe agora

| Ação | Quem pode |
|---|---|
| **Enviar** um arquivo (sempre para a própria pasta) | todo usuário logado |
| **Abrir** por um link temporário (um ou vários de uma vez) | o dono e a gestão; no mural de replicabilidade, todos |
| **Excluir** (um ou vários, tudo ou nada) | o dono e o admin |

Vale para os 7 tipos de arquivo do sistema: fotos de ocorrências, anexos de planos, fotos e documentos do PDI,
fotos da replicabilidade, fotos e documentos da tutoria. Cada tipo só aceita os formatos da sua tela (imagens ou
documentos), com limite de 10 MB (fotos) ou 20 MB (documentos).

**Onde os arquivos ficam** é uma configuração do servidor:
- **numa pasta do computador**, para desenvolvimento e testes;
- **no Supabase Storage**, em produção, onde os arquivos de hoje já estão. Nada precisa ser copiado.

## Decisões importantes tomadas na Fase 3

| Decisão | Por quê |
|---|---|
| O backend monta o endereço do arquivo (`<dono>/<registro>/<arquivo>`), não a tela | Ninguém consegue guardar arquivo na pasta de outra pessoa; o formato continua o de hoje |
| Quem não pode abrir um arquivo recebe "não encontrado" | Nem dá para descobrir que o arquivo existe |
| O arquivo vai "puro" no envio, sem formulário | É o jeito mais simples pelo navegador e não exigiu ferramenta nova |
| Os links apontam direto para o Supabase | O servidor gratuito não precisa carregar fotos e documentos |
| A chave do Supabase fica só no servidor, e sai mascarada até nos logs | Ela abre todos os arquivos |
| Falar com o Supabase pela API dele, sem a biblioteca oficial | São só quatro operações; o backend continua leve |
| Conferir com um "Supabase de mentira" | A chave real ainda não foi entregue |

## Como sabemos que funciona

| Conferência | Comando | Resultado |
|---|---|---|
| Correio de arquivos (armazenamento local) | `npm run test:arquivos` | 51 de 51 ✅ |
| Ligação com o Supabase (simulado) | `npm run test:supabase-storage` | 27 de 27 ✅ |
| **Total da Fase 3** | | **78 de 78 ✅** |
| Fases anteriores, repetidas | | 402 de 402 ✅ |

A **collection do Bruno** ganhou a pasta *Arquivos* (enviar, link, vários links, excluir), rodada contra a API.

## Problemas encontrados e resolvidos

- **Nome de arquivo com `..` no meio:** um nome como `../../segredo.png` não saía da pasta, mas ficava com `..`
  no nome. A conferência pegou, e a limpeza de nomes foi ajustada.
- **Chave no log:** a conferência simulou o pior caso (o Supabase devolver a chave numa mensagem de erro) e
  mostrou que ela iria para o log do servidor. Agora ela sai mascarada.

## Coisas para lembrar na Fase 6 (ligar as telas)

- As 6 telas que usam arquivos trocam `supabase.storage.from(...)` pelas rotas `/files/...`. O envio passa a ser
  `fetch('/files/<bucket>?pasta=<id do registro>&nome=<nome>', { method: 'POST', body: arquivo })`, e a tela
  grava no banco o `path` devolvido, como já faz hoje.
- No servidor de produção: `STORAGE_DRIVER=supabase`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Depois da Fase 6, as regras antigas dos buckets no Supabase podem ser **fechadas para o navegador**: só o
  backend (com a chave de serviço) precisa acessá-los.

## Limitações conhecidas (aceitas por enquanto)

- O tipo do arquivo é o que o navegador informa, não é conferido "por dentro" do arquivo. Como os links abrem no
  domínio do Supabase (e não no da API), o risco é baixo.
- Apagar os arquivos junto com o registro (ex.: excluir uma ocorrência leva as fotos) entra em cada módulo, nas
  Fases 4 e 5.

## Pendências que dependem da equipe

1. **Chave de serviço e endereço do Supabase**, e qual projeto guarda os arquivos (o atual é o natural).
2. **Região do banco:** EUA ou São Paulo.
3. **Dono de cada conta:** Neon, Render e Supabase.

## Próxima fase

**Fase 4 — Notas, provas e planos de aula**, com o fluxo de aprovação de planos pela gestão.
