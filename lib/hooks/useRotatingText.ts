import { useState, useEffect, useRef } from "react";

type RotationMode = "random" | "sequential";

interface UseRotatingTextOptions {
  phrases: string[];
  intervalMs?: number;
  mode?: RotationMode;
  enabled?: boolean;
}

interface UseRotatingTextReturn {
  currentText: string;
  currentIndex: number;
}

export function useRotatingText({
  phrases,
  intervalMs = 5000,
  mode = "random",
  enabled = true,
}: UseRotatingTextOptions): UseRotatingTextReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const previousIndexRef = useRef<number>(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If not enabled or no phrases, don't start the interval
    if (!enabled || phrases.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set initial index based on mode
    if (mode === "random") {
      const initialIndex = Math.floor(Math.random() * phrases.length);
      setCurrentIndex(initialIndex);
      previousIndexRef.current = initialIndex;
    } else {
      setCurrentIndex(0);
    }

    // Start the rotation interval
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        if (mode === "random") {
          // Generate a random index, avoiding consecutive duplicates
          let newIndex = Math.floor(Math.random() * phrases.length);

          // If we have more than one phrase and got the same index, regenerate
          while (newIndex === previousIndexRef.current && phrases.length > 1) {
            newIndex = Math.floor(Math.random() * phrases.length);
          }

          previousIndexRef.current = newIndex;
          return newIndex;
        } else {
          // Sequential mode: wrap around to 0 after reaching the end
          return (prevIndex + 1) % phrases.length;
        }
      });
    }, intervalMs);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phrases.length, intervalMs, mode, enabled]);

  // Compute current text with fallback
  const currentText = phrases.length > 0 ? phrases[currentIndex] : "Thinking...";

  return {
    currentText,
    currentIndex,
  };
}
