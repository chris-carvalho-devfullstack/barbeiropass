"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export function OnboardingCelebration({ score }: { score: number }) {
  useEffect(() => {
    // Verifica se já comemorou antes
    const hasCelebrated = localStorage.getItem("hasCelebratedOnboarding");

    if (score === 100 && !hasCelebrated) {
      // Dispara o toast de sucesso
      toast.success("Parabéns! 🎉", {
        description: "Seu perfil atingiu 100% e agora tem destaque máximo!",
        duration: 8000,
      });

      // Efeito de confete na tela
      const end = Date.now() + 3 * 1000;
      const colors = ["#eab308", "#f59e0b", "#18181b"];

      (function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      // Marca no navegador que já comemorou
      localStorage.setItem("hasCelebratedOnboarding", "true");
    }

    // Se a pontuação cair (ex: apagou um serviço), limpa os registros
    // para que o banner e a comemoração voltem a acontecer no futuro.
    if (score < 100) {
      localStorage.removeItem("hasCelebratedOnboarding");
      localStorage.removeItem("onboardingBannerDismissed");
    }
  }, [score]);

  return null;
}