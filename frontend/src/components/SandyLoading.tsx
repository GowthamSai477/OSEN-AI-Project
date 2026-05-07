"use client";

import Lottie from "lottie-react";
import loadingData from "@/assets/animations/Sandy Loading.json";

export default function SandyLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-48 h-48 md:w-64 md:h-64">
        <Lottie 
          animationData={loadingData} 
          loop={true} 
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <p className="text-muted text-sm font-black uppercase tracking-[0.2em] animate-pulse">
        Optimizing your schedule...
      </p>
    </div>
  );
}
