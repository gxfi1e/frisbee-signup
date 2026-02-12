// config.js
window.SIGNUP_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbzSNVgtOrjKp95rRlqOjb3v_IaKpCE4UREg0lK_ytMFe7FNdL7vIEYCdS77cXQXRFDe/exec",

  timezoneLabel: "Asia/Riyadh",

  // signup rules
  maxPlayers: 28,
  cutoffWeekday: 5,   // Fri (0=Sun..6=Sat)
  cutoffHour: 15,
  cutoffMinute: 0,

  // game info (display only)
  gameTimeText: "Friday 6:30 PM",
  locationText: "KAUST (Stadium)",
  googleMapsLink: "https://maps.google.com/?q=KAUST+football+field",

  // team rules
  teamsMinForFour: 20,  // >= 20 => 4 teams, otherwise 2 teams (after cutoff)
};
