/**
 * The reasons a visitor can pick in the contact form. The text is what
 * arrives in the email, so it is the value too.
 *
 * static/api/contacto.php keeps the same list and refuses anything else.
 * Change both together.
 */
export const CONTACT_REASONS = [
	'Quiero información',
	'Quiero dar mi opinión',
	'Quiero crear un sendero',
	'Quiero ayudar a programar',
	'Tengo otro motivo'
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number];

/** Para editores opens the form with one of these already chosen. */
export const REASON_NEW_TRAIL: ContactReason = 'Quiero crear un sendero';
export const REASON_PROGRAMMING: ContactReason = 'Quiero ayudar a programar';
