'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/training/training-bits';

type QuestionType = 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' | 'TEXT';

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: 'Resposta única',
  MULTIPLE: 'Múltipla escolha',
  TRUE_FALSE: 'Verdadeiro ou falso',
  TEXT: 'Discursiva (correção manual)',
};

interface Assessment {
  id: string;
  title: string;
  instructions?: string | null;
  timeLimitMinutes?: number | null;
  questionCount?: number | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showResult: boolean;
  totalPoints: number;
  questions: Array<{
    id: string;
    statement: string;
    type: QuestionType;
    points: number;
    options: Array<{ id: string; label: string; correct: boolean }>;
  }>;
  _count?: { attempts: number };
}

/** Montagem da prova de um treinamento: configuração e banco de questões. */
export function AssessmentBuilder({
  trainingId,
  trainingName,
  onClose,
}: {
  trainingId: string | null;
  trainingName?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newQuestion, setNewQuestion] = useState(false);

  const assessment = useQuery<Assessment | null>({
    queryKey: ['training-assessment', trainingId],
    queryFn: () => api(`/training/assessments/trainings/${trainingId}`),
    enabled: Boolean(trainingId),
  });

  const create = useMutation({
    mutationFn: (body: any) => api(`/training/assessments/trainings/${trainingId}`, { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Avaliação salva.');
      void qc.invalidateQueries({ queryKey: ['training-assessment', trainingId] });
      void qc.invalidateQueries({ queryKey: ['training-catalog'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeQuestion = useMutation({
    mutationFn: (questionId: string) => api(`/training/assessments/questions/${questionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Questão removida.');
      void qc.invalidateQueries({ queryKey: ['training-assessment', trainingId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = assessment.data;

  return (
    <>
      <Dialog open={Boolean(trainingId)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left">Avaliação — {trainingName}</DialogTitle>
          </DialogHeader>

          {assessment.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Este treinamento ainda não tem avaliação. Ao criar, o treinamento passa a exigir aprovação na prova.
              </p>
              <Button onClick={() => create.mutate({ title: `Avaliação — ${trainingName}` })} disabled={create.isPending}>
                Criar avaliação
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Tempo limite (min)">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={data.timeLimitMinutes ?? ''}
                    onBlur={(e) => create.mutate({ ...data, timeLimitMinutes: e.target.value || null })}
                  />
                </Field>
                <Field label="Questões sorteadas" hint="Vazio = todas">
                  <Input
                    type="number"
                    min={1}
                    defaultValue={data.questionCount ?? ''}
                    onBlur={(e) => create.mutate({ ...data, questionCount: e.target.value || null })}
                  />
                </Field>
                <Field label="Pontuação total">
                  <Input value={data.totalPoints} disabled />
                </Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle
                  checked={data.randomizeQuestions}
                  onChange={(value) => create.mutate({ ...data, randomizeQuestions: value })}
                  label="Sortear ordem das questões"
                />
                <Toggle
                  checked={data.randomizeOptions}
                  onChange={(value) => create.mutate({ ...data, randomizeOptions: value })}
                  label="Sortear alternativas"
                />
                <Toggle
                  checked={data.showResult}
                  onChange={(value) => create.mutate({ ...data, showResult: value })}
                  label="Mostrar nota ao colaborador"
                />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Questões ({data.questions.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setNewQuestion(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Nova questão
                </Button>
              </div>

              {data.questions.length === 0 ? (
                <EmptyState
                  title="Nenhuma questão cadastrada."
                  description="A prova só fica disponível ao colaborador depois que houver ao menos uma questão."
                />
              ) : (
                <ol className="space-y-2">
                  {data.questions.map((question, index) => (
                    <li key={question.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {index + 1}. {question.statement}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {TYPE_LABEL[question.type]} · {question.points} ponto(s)
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => removeQuestion.mutate(question.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {question.options.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {question.options.map((option) => (
                            <li
                              key={option.id}
                              className={cn(
                                'rounded px-2 py-1 text-xs',
                                option.correct
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {option.correct ? '✓ ' : '• '}
                              {option.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewQuestionDialog
        assessmentId={newQuestion ? data?.id ?? null : null}
        onClose={() => setNewQuestion(false)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ['training-assessment', trainingId] })}
      />
    </>
  );
}

function NewQuestionDialog({
  assessmentId,
  onClose,
  onSaved,
}: {
  assessmentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [statement, setStatement] = useState('');
  const [type, setType] = useState<QuestionType>('SINGLE');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState([
    { label: '', correct: true },
    { label: '', correct: false },
  ]);

  const save = useMutation({
    mutationFn: () =>
      api(`/training/assessments/${assessmentId}/questions`, {
        method: 'POST',
        json: { statement, type, points, options: type === 'TEXT' ? [] : options },
      }),
    onSuccess: () => {
      toast.success('Questão adicionada.');
      setStatement('');
      setOptions([
        { label: '', correct: true },
        { label: '', correct: false },
      ]);
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Verdadeiro/falso já vem com as duas alternativas prontas.
  const applyType = (next: QuestionType) => {
    setType(next);
    if (next === 'TRUE_FALSE') {
      setOptions([
        { label: 'Verdadeiro', correct: true },
        { label: 'Falso', correct: false },
      ]);
    }
  };

  return (
    <Dialog open={Boolean(assessmentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova questão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Enunciado">
            <Textarea rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <NativeSelect value={type} onChange={(e) => applyType(e.target.value as QuestionType)}>
                {(Object.keys(TYPE_LABEL) as QuestionType[]).map((key) => (
                  <option key={key} value={key}>{TYPE_LABEL[key]}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Pontos">
              <Input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
            </Field>
          </div>

          {type !== 'TEXT' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Alternativas (marque as corretas)</Label>
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type={type === 'MULTIPLE' ? 'checkbox' : 'radio'}
                    name="correct"
                    checked={option.correct}
                    onChange={() =>
                      setOptions((current) =>
                        current.map((item, position) =>
                          type === 'MULTIPLE'
                            ? position === index
                              ? { ...item, correct: !item.correct }
                              : item
                            : { ...item, correct: position === index },
                        ),
                      )
                    }
                  />
                  <Input
                    value={option.label}
                    onChange={(e) =>
                      setOptions((current) => current.map((item, position) => (position === index ? { ...item, label: e.target.value } : item)))
                    }
                    disabled={type === 'TRUE_FALSE'}
                  />
                  {type !== 'TRUE_FALSE' && options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive"
                      onClick={() => setOptions((current) => current.filter((_, position) => position !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {type !== 'TRUE_FALSE' && (
                <Button variant="outline" size="sm" onClick={() => setOptions((current) => [...current, { label: '', correct: false }])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Alternativa
                </Button>
              )}
            </div>
          )}

          {type === 'TEXT' && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Questão discursiva exige correção manual: a prova fica aguardando avaliação até alguém pontuar a resposta.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!statement.trim() || save.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
