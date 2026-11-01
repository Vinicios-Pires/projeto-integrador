import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { env } from './env';

/**
 * Onde os arquivos ficam guardados. As rotas de `/files` só conversam com esta interface,
 * então trocar o disco local pelo Supabase Storage é só mudar `STORAGE_DRIVER`.
 * `caminho` é sempre relativo ao bucket (ex.: `<dono>/<registro>/<arquivo>`).
 */
export interface Armazenamento {
  salvar(bucket: string, caminho: string, conteudo: Buffer, mime: string): Promise<void>;
  /** Devolve os caminhos que existiam e foram apagados. */
  excluir(bucket: string, caminhos: string[]): Promise<string[]>;
  /**
   * Links temporários para abrir (ou baixar, com `download` = nome do arquivo) sem login,
   * válidos por `segundos`, na mesma ordem dos caminhos. `null` para o arquivo que não existe.
   * `base` = endereço da própria API (usado só pelo disco local).
   */
  links(bucket: string, caminhos: string[], opcoes: { segundos: number; download?: string; base: string }): Promise<(string | null)[]>;
}

// ===== Disco local (desenvolvimento e testes) =====

/** Chave dos links de arquivo: derivada do JWT_SECRET, mas diferente da do login. */
const chaveLink = () => `${env.JWT_SECRET}:arquivos`;

interface LinkPayload {
  b: string;
  p: string;
  d?: string;
}

/** Guarda cada arquivo em `<dir>/<bucket>/<caminho>`, com o tipo num `.meta.json` ao lado. */
export function armazenamentoLocal(dir = env.STORAGE_LOCAL_DIR): Armazenamento & {
  ler(token: string): Promise<{ conteudo: Buffer; mime: string; download?: string } | null>;
} {
  const raiz = path.resolve(dir);
  const arquivo = (bucket: string, caminho: string) => {
    const destino = path.resolve(raiz, bucket, caminho);
    // Defesa extra: as rotas já recusam "..", mas nada pode sair da pasta raiz.
    if (!destino.startsWith(raiz + path.sep)) throw new Error('Caminho fora da pasta de arquivos.');
    return destino;
  };
  const existe = async (destino: string) => readFile(`${destino}.meta.json`).then(() => true, () => false);

  return {
    async salvar(bucket, caminho, conteudo, mime) {
      const destino = arquivo(bucket, caminho);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, conteudo);
      await writeFile(`${destino}.meta.json`, JSON.stringify({ mime }));
    },

    async excluir(bucket, caminhos) {
      const apagados: string[] = [];
      for (const caminho of caminhos) {
        const destino = arquivo(bucket, caminho);
        if (!(await existe(destino))) continue;
        await rm(destino, { force: true });
        await rm(`${destino}.meta.json`, { force: true });
        apagados.push(caminho);
      }
      return apagados;
    },

    async links(bucket, caminhos, { segundos, download, base }) {
      return Promise.all(
        caminhos.map(async (caminho) => {
          if (!(await existe(arquivo(bucket, caminho)))) return null;
          const payload: LinkPayload = { b: bucket, p: caminho, ...(download ? { d: download } : {}) };
          const token = jwt.sign(payload, chaveLink(), { expiresIn: segundos, algorithm: 'HS256' });
          return `${base}/files/link/${token}`;
        }),
      );
    },

    /** Abre um link gerado por `links` (rota pública `/files/link/:token`). */
    async ler(token) {
      let payload: LinkPayload;
      try {
        payload = jwt.verify(token, chaveLink(), { algorithms: ['HS256'] }) as LinkPayload;
      } catch {
        return null;
      }
      const destino = arquivo(payload.b, payload.p);
      if (!(await existe(destino))) return null;
      const { mime } = JSON.parse(await readFile(`${destino}.meta.json`, 'utf8')) as { mime: string };
      return { conteudo: await readFile(destino), mime, download: payload.d };
    },
  };
}
