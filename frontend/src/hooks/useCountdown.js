import { useEffect, useState } from "react";

// Đếm ngược theo giây, dùng cho nút "Gửi lại mã"
export default function useCountdown(initial = 0) {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return [seconds, setSeconds];
}
