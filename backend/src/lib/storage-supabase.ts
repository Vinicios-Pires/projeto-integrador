import type { Armazenamento } from './storage';

/**
 * Supabase Storage pela API REST, com a chave de serviço (`service_role`), que ignora as
 * regras de acesso do Supabase: quem decide quem pode é o backend (`/files`). A chave só
 * vive no servidor e nunca vai nas respostas.
 */
export function armazenamentoSupabase({ url, chave }: { url: string; chave: string }): Armazenamento {
  const api = `${url.replace(/\/+$/, '')}/storage/v1`;
  const headers = { Authorization: `Bearer ${chave}`, apikey: chave };
  /** Cada pedaço do caminho codificado (acentos, espaços), mantendo as barras. */
  const codificar = (caminho: string) => caminho.split('/').map(encodeURIComponent).join('/');

  async function falha(res: Response, acao: string): Promise<never> {
    // Só o status e a mensagem do Supabase vão para o log (com a chave mascarada, por garantia);
    // nada disso chega a quem chamou.
    const corpo = (await res.text().catch(() => '')).replaceAll(chave, '***');
    throw new Error(`Supabase Storage: falha ao ${acao} (${res.status}) ${corpo.slice(0, 200)}`);
  }

  return {
    async salvar(bucket, caminho, conteudo, mime) {
      const res = await fetch(`${api}/object/${bucket}/${codificar(caminho)}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': mime, 'x-upsert': 'false' },
        body: new Uint8Array(conteudo),
      });
      if (!res.ok) await falha(res, 'enviar');
    },

    async excluir(bucket, caminhos) {
      const res = await fetch(`${api}/object/${bucket}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: caminhos }),
      });
      if (!res.ok) await falha(res, 'excluir');
      // O Supabase devolve só os objetos que existiam e foram apagados.
      const apagados = (await res.json()) as { name: string }[];
      const nomes = new Set(apagados.map((o) => o.name));
      return caminhos.filter((c) => nomes.has(c));
    },

    async links(bucket, caminhos, { segundos, download }) {
      const res = await fetch(`${api}/object/sign/${bucket}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: segundos, paths: caminhos }),
      });
      if (!res.ok) await falha(res, 'gerar links');
      const assinados = (await res.json()) as { path: string | null; signedURL: string | null; error: string | null }[];
      const porCaminho = new Map(assinados.filter((a) => a.path && a.signedURL).map((a) => [a.path!, a.signedURL!]));
      return caminhos.map((caminho) => {
        const assinado = porCaminho.get(caminho);
        if (!assinado) return null; // "Object not found"
        const link = `${api}${assinado}`;
        return download ? `${link}${link.includes('?') ? '&' : '?'}download=${encodeURIComponent(download)}` : link;
      });
    },
  };
}
