"use client";

import { useCallback, useMemo, useState } from "react";
import type { QuizData } from "@/lib/canvas";
import { CheckIcon, CloseIcon, RefreshIcon } from "./icons";

interface QuizViewProps {
  quiz: QuizData;
}

export function QuizView({ quiz }: QuizViewProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const question = quiz.questions[index];
  const total = quiz.questions.length;
  const progress = useMemo(
    () => Math.round(((done ? total : index) / total) * 100),
    [done, index, total]
  );

  const choose = useCallback(
    (choice: number) => {
      if (selected !== null) return;
      setSelected(choice);
      if (choice === question.answer) setScore((value) => value + 1);
    },
    [question, selected]
  );

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  }, [index, total]);

  const restart = useCallback(() => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setDone(false);
    setAttempt((value) => value + 1);
  }, []);

  if (done) {
    const pct = Math.round((score / total) * 100);
    const message =
      pct === 100
        ? "Perfect score! You nailed it. 🏆"
        : pct >= 70
          ? "Great job — almost there! 🎉"
          : pct >= 40
            ? "Solid effort — keep practicing! 💪"
            : "Keep going — you'll get it next time! 🌱";
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div
          key={attempt}
          className="animate-pop-in flex h-24 w-24 items-center justify-center rounded-full text-3xl font-black text-white"
          style={{
            background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
            boxShadow: "0 12px 40px -10px var(--accent)",
          }}
        >
          {pct}%
        </div>
        <p className="text-lg font-bold text-slate-100">
          {score} / {total} correct
        </p>
        <p className="text-sm text-slate-400">{message}</p>
        <button
          type="button"
          onClick={restart}
          className="mt-2 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
          style={{
            borderColor: "var(--accent-border)",
            background: "linear-gradient(120deg, var(--accent-soft), var(--accent))",
          }}
        >
          <RefreshIcon width={14} height={14} /> Try again
        </button>
      </div>
    );
  }

  const answered = selected !== null;
  const correct = answered && selected === question.answer;

  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:px-7">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--accent-soft), var(--accent))",
            }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-slate-400">
          {index + 1} / {total}
        </span>
      </div>

      <p
        key={`${attempt}-${index}`}
        className="animate-fade-in text-base font-semibold leading-relaxed text-slate-100"
      >
        {question.question}
      </p>

      <div className="flex flex-col gap-2" role="group" aria-label="Answer choices">
        {question.choices.map((choice, choiceIndex) => {
          const isAnswer = choiceIndex === question.answer;
          const isPicked = choiceIndex === selected;
          let cls =
            "border-white/10 bg-slate-900/70 hover:border-indigo-400/40 hover:bg-slate-800/80";
          if (answered && isAnswer) {
            cls = "border-emerald-400/60 bg-emerald-500/15 text-emerald-100";
          } else if (answered && isPicked) {
            cls = "border-red-400/60 bg-red-500/15 text-red-100";
          } else if (answered) {
            cls = "border-white/5 bg-slate-900/40 opacity-60";
          }
          return (
            <button
              key={choiceIndex}
              type="button"
              onClick={() => choose(choiceIndex)}
              disabled={answered}
              aria-pressed={isPicked}
              className={`animate-fade-in flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all ${cls}`}
              style={{ animationDelay: `${choiceIndex * 60}ms` }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-[11px] font-bold">
                {String.fromCharCode(65 + choiceIndex)}
              </span>
              <span className="min-w-0 flex-1">{choice}</span>
              {answered && isAnswer && (
                <CheckIcon width={16} height={16} className="shrink-0 text-emerald-400" />
              )}
              {answered && isPicked && !isAnswer && (
                <CloseIcon width={16} height={16} className="shrink-0 text-red-400" />
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="animate-fade-in flex flex-col gap-3">
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              correct
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/30 bg-red-500/10 text-red-100"
            }`}
          >
            <p className="font-semibold">
              {correct ? "Correct!" : "Not quite —"}
              {!correct && (
                <span className="font-normal">
                  {" "}
                  the answer is{" "}
                  <strong>
                    {String.fromCharCode(65 + question.answer)}. {question.choices[question.answer]}
                  </strong>
                </span>
              )}
            </p>
            {question.explain && (
              <p className="mt-1 text-xs leading-relaxed opacity-90">{question.explain}</p>
            )}
          </div>
          <button
            type="button"
            onClick={next}
            className="self-end rounded-full border px-6 py-2 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              borderColor: "var(--accent-border)",
              background: "linear-gradient(120deg, var(--accent-soft), var(--accent))",
            }}
          >
            {index + 1 >= total ? "See results" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
