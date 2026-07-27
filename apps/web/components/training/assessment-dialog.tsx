'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ExamQuestion {
  id: string;
  statement: string;
  type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' | 'TEXT';
  points: number;
  options: Array<{ id: string; label: string }>;
}

interface Exam {
  attemptId: string;
  attemptNumber: number;
  title: string;
  instructions?: string | null;
  expiresAt?: string | null;
  timeLimitMinutes?: number | null;
  totalPoints: number;
  questions: ExamQuestion[];
}

interface Result {
  status: 'GRADED' | 'AWAITING_GRADING';
  score: number | null;
  passed: boolean | null;
  minimumScore?: number | null;
  showResult: boolean;
}

/**
 * Aplicação da prova pelo portal.
 *
 * O gabarito nunca chega ao navegador: a correção acontece no servidor no
 * envio. Com tempo limite, o relógio conta a partir do prazo devolvido pela
 * API — não do relógio local, que o usuário poderia adiantar.
 */
export function AssessmentDialog({
  assignmentId,
  trainingName,
  onClose,
  onFinished,
}: {
  assignmentId: string | null;
  trainingName?: string;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, { optionIds?: string[]; text?: string }>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const start = useMutation({
    mutationFn: () => api<Exam>(`/training/assessments/start/${assignmentId}`, { method: 'POST' }),
    onSuccess: (data) => {
      setExam(data);
      setAnswers({});
      setResult(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onClose();
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      api<Result>(`/training/assessments/attempts/${exam?.attemptId}/submit`, {
        method: 'POST',
        json: {
          answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, ...value })),
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      onFinished();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Abre a prova ao montar.
  useEffect(() => {
    if (assignmentId && !exam && !start.isPending) start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  // Relógio do tempo limite; envia sozinho ao zerar.
  useEffect(() => {
    if (!exam?.expiresAt || result) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(exam.expiresAt!).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !submit.isPending) submit.mutate();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.expiresAt, result]);

  const answered = useMemo(
    () => (exam ? exam.questions.filter((question) => {
      const answer = answers[question.id];
      if (question.type === 'TEXT') return Boolean(answer?.text?.trim());
      return (answer?.optionIds ?? []).length > 0;
    }).length : 0),
    [answers, exam],
  );

  function toggleOption(question: ExamQuestion, optionId: string) {
    setAnswers((current) => {
      const previous = current[question.id]?.optionIds ?? [];
      if (question.type === 'MULTIPLE') {
        const next = previous.includes(optionId) ? previous.filter((id) => id !== optionId) : [...previous, optionId];
        return { ...current, [question.id]: { optionIds: next } };
      }
      return { ...current, [question.id]: { optionIds: [optionId] } };
    });
  }

  const minutes = remaining !== null ? Math.floor(remaining / 60) : null;
  const seconds = remaining !== null ? remaining % 60 : null;

  return (
    <Dialog open={Boolean(assignmentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left">{exam?.title ?? trainingName ?? 'Avaliação'}</DialogTitle>
        </DialogHeader>

        {start.isPending || (!exam && !result) ? (
          <Skeleton className="h-64 w-full" />
        ) : result ? (
          <div className="space-y-3 py-4 text-center">
            {result.status === 'AWAITING_GRADING' ? (
              <>
                <Clock className="mx-auto h-10 w-10 text-amber-500" />
                <p className="font-medium">Respostas enviadas.</p>
                <p className="text-sm text-muted-foreground">
                  Esta avaliação tem questões discursivas: o resultado sai após a correção pelo responsável.
                </p>
              </>
            ) : result.passed ? (
              <>
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="font-medium">Aprovado!</p>
                {result.showResult && result.score !== null && (
                  <p className="text-sm text-muted-foreground">
                    Nota {result.score}
                    {result.minimumScore ? ` (mínimo ${result.minimumScore})` : ''}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Seu treinamento foi concluído e a validade já foi calculada.</p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-10 w-10 text-rose-500" />
                <p className="font-medium">Não atingiu a nota mínima.</p>
                {result.showResult && result.score !== null && (
                  <p className="text-sm text-muted-foreground">
                    Nota {result.score}
                    {result.minimumScore ? ` (mínimo ${result.minimumScore})` : ''}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">O treinamento continua pendente. Procure o responsável para nova tentativa.</p>
              </>
            )}
          </div>
        ) : exam ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Tentativa {exam.attemptNumber} · {answered} de {exam.questions.length} respondidas
              </span>
              {remaining !== null && (
                <span className={cn('inline-flex items-center gap-1.5 font-medium tabular-nums', remaining < 60 && 'text-rose-600 dark:text-rose-400')}>
                  <Clock className="h-3.5 w-3.5" />
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              )}
            </div>

            {exam.instructions && <p className="text-sm text-muted-foreground">{exam.instructions}</p>}

            <ol className="space-y-4">
              {exam.questions.map((question, index) => (
                <li key={question.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {index + 1}. {question.statement}
                    {question.type === 'MULTIPLE' && (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">(múltipla escolha)</span>
                    )}
                  </p>
                  {question.type === 'TEXT' ? (
                    <Textarea
                      rows={3}
                      className="mt-2"
                      value={answers[question.id]?.text ?? ''}
                      onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: { text: e.target.value } }))}
                    />
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {question.options.map((option) => {
                        const selected = (answers[question.id]?.optionIds ?? []).includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-sm transition-colors',
                              selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                            )}
                          >
                            <input
                              type={question.type === 'MULTIPLE' ? 'checkbox' : 'radio'}
                              name={question.id}
                              className="mt-0.5"
                              checked={selected}
                              onChange={() => toggleOption(question, option.id)}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={submit.isPending}>
                Sair sem enviar
              </Button>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending || !exam}>
                {submit.isPending ? 'Enviando...' : `Enviar respostas (${answered}/${exam?.questions.length ?? 0})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
