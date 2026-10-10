/** Veni's logo: two v's closing in on a green dot, everyone heading to the same spot. */
export function Logo() {
  return (
    <>
      <svg className="logo-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 2.5 12 9l8-6.5M6.15 9.25 12 14.25l5.85-5" />
        <circle cx="12" cy="20" r="2.3" />
      </svg>
      <span>veni</span>
    </>
  );
}
