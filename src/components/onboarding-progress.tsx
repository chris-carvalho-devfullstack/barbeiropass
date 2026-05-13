"use client";

import { CheckCircle2, Circle, MapPin, Clock, Scissors, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface OnboardingProgressProps {
  score: number;
  stepsCompleted: {
    hasAddress: boolean;
    hasHours: boolean;
    hasServices: boolean;
    hasAppearance: boolean;
  };
}

export function OnboardingProgress({ score, stepsCompleted }: OnboardingProgressProps) {
  const steps = [
    {
      title: "Endereço",
      description: "Localização da sua barbearia",
      href: "/perfil/endereco",
      icon: MapPin,
      completed: stepsCompleted.hasAddress,
    },
    {
      title: "Horários",
      description: "Quando você está aberto",
      href: "/perfil/horarios",
      icon: Clock,
      completed: stepsCompleted.hasHours,
    },
    {
      title: "Serviços",
      description: "O que você oferece",
      href: "/servicos",
      icon: Scissors,
      completed: stepsCompleted.hasServices,
    },
    {
      title: "Aparência",
      description: "Fotos e descrição",
      href: "/perfil/aparencia",
      icon: ImageIcon,
      completed: stepsCompleted.hasAppearance,
    },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Seu Perfil</h3>
            <p className="text-sm text-zinc-500">Complete seu cadastro para ganhar visibilidade</p>
          </div>
          <span className="text-2xl font-black text-zinc-900">{score}%</span>
        </div>
        <Progress value={score} className="h-2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <Link
            key={step.title}
            href={step.href}
            className="group p-4 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${step.completed ? 'bg-green-50 text-green-600' : 'bg-zinc-100 text-zinc-500 group-hover:bg-white'}`}>
                <step.icon size={20} />
              </div>
              {step.completed ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : (
                <Circle size={18} className="text-zinc-300" />
              )}
            </div>
            <h4 className="font-semibold text-sm text-zinc-900">{step.title}</h4>
            <p className="text-xs text-zinc-500 line-clamp-1">{step.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}