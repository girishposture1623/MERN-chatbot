const iconPaths = {
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  close: <path d="m18 6-12 12M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4 4" />
    </>
  ),
  message: (
    <>
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.4A7.5 7.5 0 1 1 20 11.5Z" />
      <path d="M8.5 10h7M8.5 13.5h4" />
    </>
  ),
  edit: (
    <>
      <path d="m15 5 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 6.5h17M9 6.5V4h6v2.5M19 6.5l-1 14H6l-1-14" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </>
  ),
  moon: <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />,
  send: <path d="M5 12h14m-6-6 6 6-6 6" />,
  regenerate: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.6 9A7 7 0 0 1 17 6.5L20 12M4 12l3 5.5A7 7 0 0 0 18.4 15" />
    </>
  ),
  warning: (
    <>
      <path d="m10.3 4.7-7 12.1A2 2 0 0 0 5 19.8h14a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 3h.01" />
    </>
  ),
};

export default function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}
