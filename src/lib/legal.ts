/**
 * Legal / PDPA settings shown on /privacy, /terms and the signup consent box.
 *
 * DATA_CONTROLLER is intentionally left unset for now (the owner chose not to
 * publish a name or contact address yet), so the pages use neutral wording.
 * Before a public launch, PDPA expects the controller's identity and a
 * contact channel: set `name` / `email` here and both pages pick them up.
 * Bump PRIVACY_VERSION whenever the policy text changes; each signup stores
 * the version it agreed to (auth user metadata `privacy_version`).
 */
export const PRIVACY_VERSION = '2026-10-04';

export const DATA_CONTROLLER: { name: string | null; email: string | null } = {
  name: null,
  email: null,
};

/** Who runs the service, as written in running text. */
export const controllerName = DATA_CONTROLLER.name ?? 'ผู้ให้บริการแพลตฟอร์ม SecondServe';

/** How to reach us about personal data, as a phrase that follows "ติดต่อ". */
export const contactChannel = DATA_CONTROLLER.email ?? 'ผู้ดูแลระบบของแพลตฟอร์ม SecondServe';
