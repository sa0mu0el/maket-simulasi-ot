import React from 'react';
import { PltaState } from '../types';
import { QUIZ_QUESTIONS } from '../data';
import { Award, CheckCircle, XCircle, AlertCircle, RotateCcw, PenTool } from 'lucide-react';

interface QuizSectionProps {
  state: PltaState;
  onChangeState: (updater: Partial<PltaState>) => void;
}

export default function QuizSection({ state, onChangeState }: QuizSectionProps) {
  const { selectedAnswers, quizSubmitted, quizScore } = state;

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (quizSubmitted) return; // locked once submitted
    const updated = { ...selectedAnswers, [questionId]: optionIndex };
    onChangeState({ selectedAnswers: updated });
  };

  const handleSubmitQuiz = () => {
    // Validate if any responses are completely missing
    const totalQuestions = QUIZ_QUESTIONS.length;
    if (Object.keys(selectedAnswers).length < totalQuestions) {
      alert('Harap selesaikan seluruh pertanyaan sebelum mengirimkan kuis.');
      return;
    }

    // Calculate score
    let score = 0;
    QUIZ_QUESTIONS.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        score++;
      }
    });

    const finalPercent = Math.round((score / totalQuestions) * 100);
    onChangeState({
      quizSubmitted: true,
      quizScore: finalPercent
    });
  };

  const handleResetQuiz = () => {
    onChangeState({
      quizSubmitted: false,
      quizScore: 0,
      selectedAnswers: {}
    });
  };

  const allAnswered = Object.keys(selectedAnswers).length === QUIZ_QUESTIONS.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80 justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-amber-400" />
          <h3 className="font-semibold text-sm tracking-wider font-display text-slate-100">UJI PEMAHAMAN TEKNIS PLTA</h3>
        </div>
        {quizSubmitted && (
          <button
            onClick={handleResetQuiz}
            className="text-[11px] inline-flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold px-3 py-1 rounded-md transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Ulangi Kuis
          </button>
        )}
      </div>

      {/* QUIZ SCORE HEADER BANNER */}
      {quizSubmitted && (
        <div className={`p-4 rounded-xl border flex items-center gap-4 animate-fadeIn ${
          quizScore >= 80
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : quizScore >= 50
            ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
            : 'bg-red-955/20 border-red-500/30 text-red-300'
        }`}>
          <div className="p-3 bg-slate-900 rounded-lg shadow-inner">
            <Award className="h-10 w-10 text-amber-400 shrink-0" />
          </div>
          <div>
            <h4 className="font-bold text-base font-display">
              Hasil Tes: {quizScore}% ({Math.round((quizScore / 100) * QUIZ_QUESTIONS.length)}/{QUIZ_QUESTIONS.length} Benar)
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {quizScore === 100
                ? 'Luar biasa! Pemahaman Anda setara Kepala Teknisi Pembangkit Listrik Utama!'
                : quizScore >= 80
                ? 'Sangat bagus! Anda sudah memahami komponen vital penggerak turbin dan induksi generator.'
                : 'Belajar kembali konsep dasar, klik bagian-bagian maket diagram, dan coba lagi.'}
            </p>
          </div>
        </div>
      )}

      {/* QUESTION CARDS LIST */}
      <div className="flex flex-col gap-5">
        {QUIZ_QUESTIONS.map((q, qIndex) => {
          const selectedIdx = selectedAnswers[q.id];
          const isCorrect = selectedIdx === q.correctIndex;

          return (
            <div key={q.id} className="bg-slate-950/30 border border-slate-850 p-4.5 rounded-xl flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs font-bold bg-slate-800 text-slate-400 h-5 w-5 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                  {qIndex + 1}
                </span>
                <h4 className="text-sm font-semibold text-slate-100 leading-relaxed font-sans">{q.question}</h4>
              </div>

              {/* OPTIONS CONTAINER */}
              <div className="grid grid-cols-1 gap-2.5 mt-1 pl-7">
                {q.options.map((opt, oIndex) => {
                  const isOptionSelected = selectedIdx === oIndex;
                  const isThisCorrectOption = oIndex === q.correctIndex;

                  // Dynamic color styles
                  let variantStyles = 'bg-slate-950/45 border-slate-850 text-slate-300 hover:border-slate-800 hover:bg-slate-900/50';

                  if (quizSubmitted) {
                    if (isThisCorrectOption) {
                      variantStyles = 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 font-medium';
                    } else if (isOptionSelected && !isCorrect) {
                      variantStyles = 'bg-red-950/25 border-red-500/40 text-red-300';
                    } else {
                      variantStyles = 'bg-slate-950/15 border-slate-900 text-slate-500 opacity-60';
                    }
                  } else if (isOptionSelected) {
                    variantStyles = 'bg-sky-500/10 border-sky-500/40 text-sky-400 font-semibold ring-1 ring-sky-500/20';
                  }

                  return (
                    <button
                      key={oIndex}
                      type="button"
                      onClick={() => handleSelectOption(q.id, oIndex)}
                      disabled={quizSubmitted}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-left text-xs transition-all duration-200 cursor-pointer ${variantStyles}`}
                    >
                      {/* Interactive Radio Box or Result Icon */}
                      {quizSubmitted ? (
                        isThisCorrectOption ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : isOptionSelected ? (
                          <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-slate-800 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <span className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isOptionSelected ? 'border-sky-400' : 'border-slate-700'
                        }`}>
                          {isOptionSelected && <span className="h-2 w-2 rounded-full bg-sky-400" />}
                        </span>
                      )}
                      <span className="leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* PHYSICS EXPLANATION BOX */}
              {quizSubmitted && (
                <div className="mt-3.5 pt-3.5 border-t border-slate-900 pl-7 flex items-start gap-2 text-xs text-slate-400 leading-relaxed font-sans animate-fadeIn bg-slate-900/10 p-2.5 rounded-lg">
                  <AlertCircle className="h-4.5 w-4.5 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-sky-400">Pembahasan: </span>
                    {q.explanation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ACTION SUBMIT CONTROL */}
      {!quizSubmitted && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
          <p className="text-xs text-slate-400">
            {allAnswered
              ? 'Seluruh jawaban telah terisi. Tekan tombol kirim di kanan.'
              : 'Harap selesaikan seluruh 5 pertanyaan untuk melihat hasil tes.'}
          </p>
          <button
            onClick={handleSubmitQuiz}
            disabled={!allAnswered}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold tracking-wider font-display transition-all cursor-pointer ${
              allAnswered
                ? 'bg-sky-400 text-slate-950 shadow-md hover:bg-sky-300 hover:scale-103'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            KIRIM JAWABAN KUIS
          </button>
        </div>
      )}
    </div>
  );
}
