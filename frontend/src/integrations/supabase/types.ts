export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_escola_eventos: {
        Row: {
          cor: string | null
          created_at: string
          criado_por: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          dia_todo: boolean
          id: string
          tipo: Database["public"]["Enums"]["tipo_evento_escola"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          criado_por: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          dia_todo?: boolean
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_evento_escola"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          dia_todo?: boolean
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_evento_escola"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      agenda_excecoes: {
        Row: {
          atividade: string | null
          cancelado: boolean
          created_at: string
          data: string
          disciplina_id: string | null
          horario_grade_id: string
          id: string
          observacao: string | null
          turma_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atividade?: string | null
          cancelado?: boolean
          created_at?: string
          data: string
          disciplina_id?: string | null
          horario_grade_id: string
          id?: string
          observacao?: string | null
          turma_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atividade?: string | null
          cancelado?: boolean
          created_at?: string
          data?: string
          disciplina_id?: string | null
          horario_grade_id?: string
          id?: string
          observacao?: string | null
          turma_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_excecoes_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_excecoes_horario_grade_id_fkey"
            columns: ["horario_grade_id"]
            isOneToOne: false
            referencedRelation: "horario_grade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_excecoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_professor: {
        Row: {
          atividade: string | null
          cor: string | null
          created_at: string
          dia_semana: number
          disciplina_id: string | null
          horario_grade_id: string
          id: string
          turma_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atividade?: string | null
          cor?: string | null
          created_at?: string
          dia_semana: number
          disciplina_id?: string | null
          horario_grade_id: string
          id?: string
          turma_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atividade?: string | null
          cor?: string | null
          created_at?: string
          dia_semana?: number
          disciplina_id?: string | null
          horario_grade_id?: string
          id?: string
          turma_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_professor_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_professor_horario_grade_id_fkey"
            columns: ["horario_grade_id"]
            isOneToOne: false
            referencedRelation: "horario_grade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_professor_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes_plano: {
        Row: {
          created_at: string
          descricao: string
          id: string
          plano_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          plano_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_plano_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_aula"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          id: string
          nome: string
          numero_chamada: number | null
          observacoes: string | null
          responsavel: string | null
          serie: string | null
          telefone: string | null
          turma_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome: string
          numero_chamada?: number | null
          observacoes?: string | null
          responsavel?: string | null
          serie?: string | null
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome?: string
          numero_chamada?: number | null
          observacoes?: string | null
          responsavel?: string | null
          serie?: string | null
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ano_letivo: {
        Row: {
          ano: number
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
        }
        Insert: {
          ano: number
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
        }
        Update: {
          ano?: number
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
        }
        Relationships: []
      }
      apoio_presencial: {
        Row: {
          created_at: string
          criado_por: string
          data: string
          horario_grade_id: string | null
          id: string
          observacao: string | null
          professor_id: string
          responsavel_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          data: string
          horario_grade_id?: string | null
          id?: string
          observacao?: string | null
          professor_id: string
          responsavel_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          data?: string
          horario_grade_id?: string | null
          id?: string
          observacao?: string | null
          professor_id?: string
          responsavel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apoio_presencial_horario_grade_id_fkey"
            columns: ["horario_grade_id"]
            isOneToOne: false
            referencedRelation: "horario_grade"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_atividades: {
        Row: {
          bimestre: number
          categoria: string | null
          created_at: string
          data: string | null
          disciplina_id: string | null
          id: string
          nome: string
          observacao: string | null
          ordem: number | null
          peso: number | null
          tipo: string
          turma_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bimestre?: number
          categoria?: string | null
          created_at?: string
          data?: string | null
          disciplina_id?: string | null
          id?: string
          nome: string
          observacao?: string | null
          ordem?: number | null
          peso?: number | null
          tipo?: string
          turma_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bimestre?: number
          categoria?: string | null
          created_at?: string
          data?: string | null
          disciplina_id?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          ordem?: number | null
          peso?: number | null
          tipo?: string
          turma_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_atividades_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_atividades_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_lancamentos: {
        Row: {
          aluno_id: string
          atividade_id: string
          created_at: string
          fez: boolean | null
          id: string
          observacao: string | null
          updated_at: string
          user_id: string
          valor: string | null
        }
        Insert: {
          aluno_id: string
          atividade_id: string
          created_at?: string
          fez?: boolean | null
          id?: string
          observacao?: string | null
          updated_at?: string
          user_id: string
          valor?: string | null
        }
        Update: {
          aluno_id?: string
          atividade_id?: string
          created_at?: string
          fez?: boolean | null
          id?: string
          observacao?: string | null
          updated_at?: string
          user_id?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_lancamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_lancamentos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "diario_atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_observacoes_aluno: {
        Row: {
          aluno_id: string
          bimestre: number
          created_at: string
          disciplina_id: string | null
          id: string
          observacao: string
          turma_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aluno_id: string
          bimestre?: number
          created_at?: string
          disciplina_id?: string | null
          id?: string
          observacao: string
          turma_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aluno_id?: string
          bimestre?: number
          created_at?: string
          disciplina_id?: string | null
          id?: string
          observacao?: string
          turma_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diario_observacoes_aluno_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_observacoes_aluno_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_observacoes_aluno_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          carga_horaria: number | null
          cor: string | null
          created_at: string | null
          id: string
          nome: string
          professor: string | null
          user_id: string
        }
        Insert: {
          carga_horaria?: number | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          professor?: string | null
          user_id: string
        }
        Update: {
          carga_horaria?: number | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          professor?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gabaritos: {
        Row: {
          anulada: boolean | null
          id: string
          numero_questao: number
          peso: number | null
          prova_id: string | null
          resposta_correta: string
        }
        Insert: {
          anulada?: boolean | null
          id?: string
          numero_questao: number
          peso?: number | null
          prova_id?: string | null
          resposta_correta: string
        }
        Update: {
          anulada?: boolean | null
          id?: string
          numero_questao?: number
          peso?: number | null
          prova_id?: string | null
          resposta_correta?: string
        }
        Relationships: [
          {
            foreignKeyName: "gabaritos_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
        ]
      }
      horario_grade: {
        Row: {
          created_at: string
          hora_fim: string
          hora_inicio: string
          id: string
          ordem: number
          rotulo: string
          tipo: Database["public"]["Enums"]["tipo_bloco_horario"]
        }
        Insert: {
          created_at?: string
          hora_fim: string
          hora_inicio: string
          id?: string
          ordem: number
          rotulo: string
          tipo?: Database["public"]["Enums"]["tipo_bloco_horario"]
        }
        Update: {
          created_at?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          ordem?: number
          rotulo?: string
          tipo?: Database["public"]["Enums"]["tipo_bloco_horario"]
        }
        Relationships: []
      }
      lembretes: {
        Row: {
          concluido: boolean
          cor: string
          created_at: string
          data: string | null
          descricao: string | null
          disciplina_id: string | null
          fixado: boolean
          id: string
          posicao: number | null
          prioridade: string
          titulo: string
          turma_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          cor?: string
          created_at?: string
          data?: string | null
          descricao?: string | null
          disciplina_id?: string | null
          fixado?: boolean
          id?: string
          posicao?: number | null
          prioridade?: string
          titulo: string
          turma_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          cor?: string
          created_at?: string
          data?: string | null
          descricao?: string | null
          disciplina_id?: string | null
          fixado?: boolean
          id?: string
          posicao?: number | null
          prioridade?: string
          titulo?: string
          turma_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      medias_arredondadas: {
        Row: {
          aluno_id: string
          bimestre: number
          created_at: string
          disciplina_id: string
          id: string
          manual: boolean
          nota_arredondada: number
          turma_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aluno_id: string
          bimestre: number
          created_at?: string
          disciplina_id: string
          id?: string
          manual?: boolean
          nota_arredondada: number
          turma_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aluno_id?: string
          bimestre?: number
          created_at?: string
          disciplina_id?: string
          id?: string
          manual?: boolean
          nota_arredondada?: number
          turma_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          aluno_id: string | null
          bimestre: number | null
          created_at: string | null
          id: string
          nota: number | null
          observacoes: string | null
          tipo_avaliacao_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aluno_id?: string | null
          bimestre?: number | null
          created_at?: string | null
          id?: string
          nota?: number | null
          observacoes?: string | null
          tipo_avaliacao_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aluno_id?: string | null
          bimestre?: number | null
          created_at?: string | null
          id?: string
          nota?: number | null
          observacoes?: string | null
          tipo_avaliacao_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_tipo_avaliacao_id_fkey"
            columns: ["tipo_avaliacao_id"]
            isOneToOne: false
            referencedRelation: "tipos_avaliacao"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_fotos: {
        Row: {
          created_at: string
          id: string
          ocorrencia_id: string
          path: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          ocorrencia_id: string
          path: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          ocorrencia_id?: string
          path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_fotos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias_notebook"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias_escolares: {
        Row: {
          alunos: string | null
          created_at: string
          data: string
          descricao: string
          disciplina: string | null
          gestao_user_id: string | null
          id: string
          providencias: string | null
          respondido_em: string | null
          status: string
          tipo: string
          turma: string | null
          updated_at: string
          user_id: string
          visto_pelo_professor: boolean
        }
        Insert: {
          alunos?: string | null
          created_at?: string
          data?: string
          descricao: string
          disciplina?: string | null
          gestao_user_id?: string | null
          id?: string
          providencias?: string | null
          respondido_em?: string | null
          status?: string
          tipo: string
          turma?: string | null
          updated_at?: string
          user_id: string
          visto_pelo_professor?: boolean
        }
        Update: {
          alunos?: string | null
          created_at?: string
          data?: string
          descricao?: string
          disciplina?: string | null
          gestao_user_id?: string | null
          id?: string
          providencias?: string | null
          respondido_em?: string | null
          status?: string
          tipo?: string
          turma?: string | null
          updated_at?: string
          user_id?: string
          visto_pelo_professor?: boolean
        }
        Relationships: []
      }
      ocorrencias_notebook: {
        Row: {
          alunos_envolvidos: string | null
          created_at: string | null
          data_ocorrencia: string
          descricao: string | null
          equipamento_danificado: boolean | null
          id: string
          internet_funcionou: boolean | null
          observacoes: string | null
          problema_encontrado: string | null
          quantidade_notebooks: number | null
          solucao_adotada: string | null
          turma_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alunos_envolvidos?: string | null
          created_at?: string | null
          data_ocorrencia?: string
          descricao?: string | null
          equipamento_danificado?: boolean | null
          id?: string
          internet_funcionou?: boolean | null
          observacoes?: string | null
          problema_encontrado?: string | null
          quantidade_notebooks?: number | null
          solucao_adotada?: string | null
          turma_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alunos_envolvidos?: string | null
          created_at?: string | null
          data_ocorrencia?: string
          descricao?: string | null
          equipamento_danificado?: boolean | null
          id?: string
          internet_funcionou?: boolean | null
          observacoes?: string | null
          problema_encontrado?: string | null
          quantidade_notebooks?: number | null
          solucao_adotada?: string | null
          turma_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_notebook_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_evidencia_documentos: {
        Row: {
          created_at: string
          evidencia_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          evidencia_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          evidencia_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      pdi_evidencia_fotos: {
        Row: {
          created_at: string
          evidencia_id: string
          id: string
          nome: string | null
          storage_path: string
          url: string
        }
        Insert: {
          created_at?: string
          evidencia_id: string
          id?: string
          nome?: string | null
          storage_path: string
          url: string
        }
        Update: {
          created_at?: string
          evidencia_id?: string
          id?: string
          nome?: string | null
          storage_path?: string
          url?: string
        }
        Relationships: []
      }
      pdi_evidencias: {
        Row: {
          ano_letivo: number
          bimestre: number
          created_at: string
          data_realizacao: string
          descricao: string | null
          disciplina_id: string | null
          id: string
          objetivo: string | null
          resultados: string | null
          tipo_atividade: string
          titulo: string
          turma_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano_letivo?: number
          bimestre?: number
          created_at?: string
          data_realizacao?: string
          descricao?: string | null
          disciplina_id?: string | null
          id?: string
          objetivo?: string | null
          resultados?: string | null
          tipo_atividade?: string
          titulo: string
          turma_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano_letivo?: number
          bimestre?: number
          created_at?: string
          data_realizacao?: string
          descricao?: string | null
          disciplina_id?: string | null
          id?: string
          objetivo?: string | null
          resultados?: string | null
          tipo_atividade?: string
          titulo?: string
          turma_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planejamentos_bimestrais: {
        Row: {
          ano: number
          bimestre: number
          created_at: string
          disciplina_id: string | null
          id: string
          observacao_validacao: string | null
          status: string
          turma_id: string
          updated_at: string
          user_id: string
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          ano?: number
          bimestre: number
          created_at?: string
          disciplina_id?: string | null
          id?: string
          observacao_validacao?: string | null
          status?: string
          turma_id: string
          updated_at?: string
          user_id: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          ano?: number
          bimestre?: number
          created_at?: string
          disciplina_id?: string | null
          id?: string
          observacao_validacao?: string | null
          status?: string
          turma_id?: string
          updated_at?: string
          user_id?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planejamentos_bimestrais_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planejamentos_bimestrais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_anexos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          plano_id: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          plano_id: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          plano_id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_anexos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_aula"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_aula: {
        Row: {
          aprendizagem_essencial: string | null
          aprovado_por: string | null
          aulas_previstas: number | null
          avaliacao_aprendizagem: string | null
          bimestre: number
          comentario_aprovacao: string | null
          conteudo: string | null
          created_at: string | null
          data_aprovacao: string | null
          data_aula: string
          desenvolvimento: string | null
          dia_semana: string | null
          disciplina_id: string | null
          duplicado_de: string | null
          habilidades: string | null
          id: string
          material_digital: string | null
          numero_aulas: number | null
          objetivo_geral: string | null
          objetivos: string | null
          planejamento_id: string | null
          professor: string | null
          recursos: string | null
          status: string
          tipo: string
          turma_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aprendizagem_essencial?: string | null
          aprovado_por?: string | null
          aulas_previstas?: number | null
          avaliacao_aprendizagem?: string | null
          bimestre?: number
          comentario_aprovacao?: string | null
          conteudo?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          data_aula: string
          desenvolvimento?: string | null
          dia_semana?: string | null
          disciplina_id?: string | null
          duplicado_de?: string | null
          habilidades?: string | null
          id?: string
          material_digital?: string | null
          numero_aulas?: number | null
          objetivo_geral?: string | null
          objetivos?: string | null
          planejamento_id?: string | null
          professor?: string | null
          recursos?: string | null
          status?: string
          tipo?: string
          turma_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aprendizagem_essencial?: string | null
          aprovado_por?: string | null
          aulas_previstas?: number | null
          avaliacao_aprendizagem?: string | null
          bimestre?: number
          comentario_aprovacao?: string | null
          conteudo?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          data_aula?: string
          desenvolvimento?: string | null
          dia_semana?: string | null
          disciplina_id?: string | null
          duplicado_de?: string | null
          habilidades?: string | null
          id?: string
          material_digital?: string | null
          numero_aulas?: number | null
          objetivo_geral?: string | null
          objetivos?: string | null
          planejamento_id?: string | null
          professor?: string | null
          recursos?: string | null
          status?: string
          tipo?: string
          turma_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_aula_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_aula_duplicado_de_fkey"
            columns: ["duplicado_de"]
            isOneToOne: false
            referencedRelation: "planos_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_aula_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamentos_bimestrais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_aula_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      provas: {
        Row: {
          bimestre: number | null
          created_at: string | null
          data_aplicacao: string | null
          disciplina_id: string | null
          escola: string | null
          id: string
          numero_questoes: number
          observacoes: string | null
          professor: string | null
          titulo: string
          turma_id: string | null
          user_id: string
          valor_total: number | null
        }
        Insert: {
          bimestre?: number | null
          created_at?: string | null
          data_aplicacao?: string | null
          disciplina_id?: string | null
          escola?: string | null
          id?: string
          numero_questoes?: number
          observacoes?: string | null
          professor?: string | null
          titulo: string
          turma_id?: string | null
          user_id: string
          valor_total?: number | null
        }
        Update: {
          bimestre?: number | null
          created_at?: string | null
          data_aplicacao?: string | null
          disciplina_id?: string | null
          escola?: string | null
          id?: string
          numero_questoes?: number
          observacoes?: string | null
          professor?: string | null
          titulo?: string
          turma_id?: string | null
          user_id?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      replicabilidade_fotos: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          ordem: number
          replicabilidade_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string | null
          ordem?: number
          replicabilidade_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          ordem?: number
          replicabilidade_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "replicabilidade_fotos_replicabilidade_id_fkey"
            columns: ["replicabilidade_id"]
            isOneToOne: false
            referencedRelation: "replicabilidades"
            referencedColumns: ["id"]
          },
        ]
      }
      replicabilidades: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resultados_prova: {
        Row: {
          acertos: number | null
          ajuste_manual: boolean | null
          aluno_id: string | null
          created_at: string | null
          id: string
          nota: number | null
          observacoes: string | null
          prova_id: string | null
          respostas: Json | null
          user_id: string
        }
        Insert: {
          acertos?: number | null
          ajuste_manual?: boolean | null
          aluno_id?: string | null
          created_at?: string | null
          id?: string
          nota?: number | null
          observacoes?: string | null
          prova_id?: string | null
          respostas?: Json | null
          user_id: string
        }
        Update: {
          acertos?: number | null
          ajuste_manual?: boolean | null
          aluno_id?: string | null
          created_at?: string | null
          id?: string
          nota?: number | null
          observacoes?: string | null
          prova_id?: string | null
          respostas?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resultados_prova_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_prova_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_avaliacao: {
        Row: {
          bimestre: number | null
          categoria: string
          created_at: string | null
          descricao: string | null
          disciplina_id: string | null
          id: string
          nome: string
          ordem: number | null
          peso: number | null
          turma_id: string | null
          user_id: string
        }
        Insert: {
          bimestre?: number | null
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          disciplina_id?: string | null
          id?: string
          nome: string
          ordem?: number | null
          peso?: number | null
          turma_id?: string | null
          user_id: string
        }
        Update: {
          bimestre?: number | null
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          disciplina_id?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          peso?: number | null
          turma_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_avaliacao_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_avaliacao_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_disciplinas: {
        Row: {
          created_at: string
          disciplina_id: string
          id: string
          turma_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disciplina_id: string
          id?: string
          turma_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          disciplina_id?: string
          id?: string
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_membros: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          turma_id: string
          user_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          turma_id: string
          user_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          turma_id?: string
          user_id?: string
        }
        Relationships: []
      }
      turmas: {
        Row: {
          ano_letivo: number
          capacidade: number | null
          created_at: string | null
          id: string
          nome: string
          observacoes: string | null
          serie: string
          tipo: string
          turno: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ano_letivo?: number
          capacidade?: number | null
          created_at?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          serie: string
          tipo?: string
          turno?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ano_letivo?: number
          capacidade?: number | null
          created_at?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          serie?: string
          tipo?: string
          turno?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tutorados: {
        Row: {
          aluno_id: string | null
          created_at: string
          data_inicio: string
          foto_path: string | null
          id: string
          nome: string
          numero_chamada: number | null
          observacoes: string | null
          status: string
          turma: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          data_inicio?: string
          foto_path?: string | null
          id?: string
          nome: string
          numero_chamada?: number | null
          observacoes?: string | null
          status?: string
          turma?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          data_inicio?: string
          foto_path?: string | null
          id?: string
          nome?: string
          numero_chamada?: number | null
          observacoes?: string | null
          status?: string
          turma?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoria_checkins: {
        Row: {
          created_at: string
          humor: string
          id: string
          observacao: string | null
          tutorado_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          humor: string
          id?: string
          observacao?: string | null
          tutorado_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          humor?: string
          id?: string
          observacao?: string | null
          tutorado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoria_checkins_tutorado_id_fkey"
            columns: ["tutorado_id"]
            isOneToOne: false
            referencedRelation: "tutorados"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoria_combinados: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          status: string
          tutorado_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          id?: string
          status?: string
          tutorado_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          status?: string
          tutorado_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoria_combinados_tutorado_id_fkey"
            columns: ["tutorado_id"]
            isOneToOne: false
            referencedRelation: "tutorados"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoria_documentos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tutorado_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tutorado_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tutorado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoria_documentos_tutorado_id_fkey"
            columns: ["tutorado_id"]
            isOneToOne: false
            referencedRelation: "tutorados"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoria_registros: {
        Row: {
          combinado: string | null
          como_esta: string | null
          created_at: string
          data: string
          id: string
          observacao: string | null
          proxima_acao: string | null
          tutorado_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          combinado?: string | null
          como_esta?: string | null
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          proxima_acao?: string | null
          tutorado_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          combinado?: string | null
          como_esta?: string | null
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          proxima_acao?: string | null
          tutorado_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoria_registros_tutorado_id_fkey"
            columns: ["tutorado_id"]
            isOneToOne: false
            referencedRelation: "tutorados"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_gestao: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "professor"
        | "coordenador"
        | "direcao"
        | "vice_direcao"
        | "admin"
      tipo_bloco_horario:
        | "aula"
        | "intervalo"
        | "almoco"
        | "planejamento"
        | "atpc"
        | "reuniao"
        | "outro"
      tipo_evento_escola:
        | "reuniao"
        | "formacao"
        | "evento"
        | "avaliacao_externa"
        | "conselho"
        | "apoio_presencial"
        | "acompanhamento"
        | "observacao"
        | "visita"
        | "aviso"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "professor",
        "coordenador",
        "direcao",
        "vice_direcao",
        "admin",
      ],
      tipo_bloco_horario: [
        "aula",
        "intervalo",
        "almoco",
        "planejamento",
        "atpc",
        "reuniao",
        "outro",
      ],
      tipo_evento_escola: [
        "reuniao",
        "formacao",
        "evento",
        "avaliacao_externa",
        "conselho",
        "apoio_presencial",
        "acompanhamento",
        "observacao",
        "visita",
        "aviso",
      ],
    },
  },
} as const
