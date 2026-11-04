/** Today's date in India (YYYY-MM-DD), whatever time zone this computer is set to. */
export const todayInIndia = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
