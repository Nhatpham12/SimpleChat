// Bong bóng chat + chấm hồng sen (cũng dùng làm favicon)
export default function Logo({ size = 32, light = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H13l-6.2 4.6A1 1 0 0 1 5.2 28v-4.1A4 4 0 0 1 2 20V8a4 4 0 0 1 4-4z"
        fill={light ? "#F4F7F5" : "#12403C"}
      />
      <circle cx="22.5" cy="11.5" r="3.5" fill="#E0457B" />
    </svg>
  );
}
