import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface FormProva {
  turma_id: string;
  disciplina_id: string;
  bimestre: number;
  titulo: string;
  numero_questoes: number;
  data_aplicacao: string;
  valor_total: number;
  observacoes: string;
  escola: string;
  professor: string;
}

interface ProvaFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormProva;
  onChange: (f: FormProva) => void;
  onSave: () => void;
  saving: boolean;
  turmas: any[];
  disciplinas: any[];
}

export function ProvaFormDialog({ open, onOpenChange, form, onChange, onSave, saving, turmas, disciplinas }: ProvaFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Prova com QR Code</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Escola</Label>
            <Input placeholder="Nome da escola" value={form.escola} onChange={e => onChange({ ...form, escola: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Título da Avaliação *</Label>
            <Input placeholder="Ex: Prova Bimestral de Matemática" value={form.titulo} onChange={e => onChange({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Turma</Label>
              <Select value={form.turma_id} onValueChange={v => onChange({ ...form, turma_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Disciplina</Label>
              <Select value={form.disciplina_id} onValueChange={v => onChange({ ...form, disciplina_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Bimestre</Label>
              <Select value={String(form.bimestre)} onValueChange={v => onChange({ ...form, bimestre: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4].map(b => <SelectItem key={b} value={String(b)}>{b}º Bim</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Questões</Label>
              <Input type="number" min={1} max={60} value={form.numero_questoes} onChange={e => onChange({ ...form, numero_questoes: parseInt(e.target.value) || 10 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Total</Label>
              <Input type="number" min={0} max={100} step={0.5} value={form.valor_total} onChange={e => onChange({ ...form, valor_total: parseFloat(e.target.value) || 10 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Professor</Label>
              <Input placeholder="Nome do professor" value={form.professor} onChange={e => onChange({ ...form, professor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={form.data_aplicacao} onChange={e => onChange({ ...form, data_aplicacao: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações / Instruções</Label>
            <Textarea rows={2} placeholder="Instruções para os alunos..." value={form.observacoes} onChange={e => onChange({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving || !form.titulo}>{saving ? 'Criando...' : 'Criar Prova'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
