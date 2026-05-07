"use client";

import Lottie from "lottie-react";
import confettiData from "@/assets/animations/Confetti.json";
import { useEffect, useState } from "react";

interface LottieConfettiProps {
  trigger: number;
}

export default function LottieConfetti({ trigger }: LottieConfettiProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger > 0) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3500); // Animation duration approx
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      <Lottie 
        key={trigger}
        animationData={confettiData} 
        loop={false} 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
