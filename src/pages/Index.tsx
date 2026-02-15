import { useState } from "react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background">
      <span className="text-7xl font-bold text-foreground">{count}</span>
      <Button
        size="lg"
        className="text-lg px-10 py-6 active:scale-95 transition-transform"
        onClick={() => setCount((c) => c + 1)}
      >
        اضغط هنا
      </Button>
    </div>
  );
};

export default Index;
