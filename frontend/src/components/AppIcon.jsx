const iconPaths = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  home: (
    <>
      <path d="M4 10.5L12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5M10 20v-6h4v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.4-3.4 2.2-5 5.5-5s5.1 1.6 5.5 5" />
      <path d="M15 6.2a3 3 0 010 5.6M16.5 14.2c2.4.5 3.7 2.1 4 4.8" />
    </>
  ),
  pill: (
    <>
      <path d="M8.2 18.8a4.2 4.2 0 01-6-6l6.6-6.6a4.2 4.2 0 016 6z" />
      <path d="M6 9l6 6" />
      <path d="M14.5 5.5l1.3-1.3a4.2 4.2 0 016 6l-5.7 5.7" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.1 10.2a2 2 0 002 1.6h7.8a2 2 0 002-1.5L20 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </>
  ),
  sales: (
    <>
      <path d="M4 5h16v14H4zM4 9h16" />
      <path d="M8 14h3M15.5 13v3M14 14.5h3" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7" />
      <path d="M12 11v10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M8 3v5M16 3v5M3.5 10h17" />
      <path d="M12 13v3l2 1" />
    </>
  ),
  prescription: (
    <>
      <path d="M6 3h9l3 3v15H6zM15 3v4h4" />
      <path d="M9 11h6M9 15h6M9 19h3" />
    </>
  ),
  report: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M9 16v-3M12 16V9M15 16v-5" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2 2M14 9l2 2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20l4.2-1 10.7-10.7a2.1 2.1 0 00-3-3L5.2 16z" />
      <path d="M14.5 6.7l3 3" />
    </>
  ),
  reset: (
    <>
      <path d="M4 11a8 8 0 111.3 5M4 11V5M4 11h6" />
      <path d="M12 10v5M9.5 12.5h5" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M7.2 5.8a8 8 0 109.6 0" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  retry: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M18.4 16a8 8 0 10-1-9.2L20 12" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3L2.8 20h18.4z" />
      <path d="M12 9v5M12 17.5v.1" />
    </>
  ),
  check: <path d="M5 12.5l4.2 4L19 6.8" />,
  eye: (
    <>
      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
      <circle cx="12" cy="12" r="2.3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M9.8 7.3A9.5 9.5 0 0112 7c5.5 0 9 5 9 5a15.6 15.6 0 01-2.5 3M6.2 6.2A15.4 15.4 0 003 12s3.5 5 9 5a9.9 9.9 0 003-.5" />
      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
    </>
  )
};

export const AppIcon = ({ name, size = 20, className = '' }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {iconPaths[name] || null}
  </svg>
);
