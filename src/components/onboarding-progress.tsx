"use client";

import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface OnboardingProgressProps {
  score: number; // Vai de 0 a 100
  steps: {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    href: string;
  }[];
}

export function OnboardingProgress({ score, steps }: OnboardingProgressProps) {
  // Se o score for 100, podemos esconder ou mostrar uma mensagem de sucesso
  if (score >= 100) return null;

  return (
    <Card className="border-indigo-100 bg-indigo-50/30 mb-8 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-zinc-900">
              Complete seu perfil
            </CardTitle>
            <CardDescription className="text-zinc-600 mt-1">
              Sua barbearia só ficará visível para clientes ao atingir 100%.
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-indigo-600">{score}%</span>
          </div>
        </div>
        
        {/* Barra de Progresso */}
        <div className="w-full bg-zinc-200 rounded-full h-2.5 mt-4">
          <div 
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${score}%` }}
          ></div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {steps.map((step) => (
            <Link 
              key={step.id} 
              href={step.href}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                step.completed 
                  ? "bg-white border-zinc-200 opacity-70" 
                  : "bg-white border-indigo-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer group"
              }`}
            >
              <div className="mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${step.completed ? "text-zinc-500 line-through" : "text-zinc-900"}`}>
                  {step.title}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <div className="flex items-center justify-center self-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="size-4 text-indigo-600" />
                </div>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}