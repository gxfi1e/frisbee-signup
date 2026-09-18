const signupConfig = {
  apiEndpoint: "/api/signup",
  endpoint: "https://script.google.com/macros/s/AKfycbzSNVgtOrjKp95rRlqOjb3v_IaKpCE4UREg0lK_ytMFe7FNdL7vIEYCdS77cXQXRFDe/exec",
  timezoneLabel: "Asia/Riyadh",

  gameTimeText: "Friday 7-10PM",
  locationText: "KAUST Stadiums 🏟 ",
  googleMapsLink: "https://maps.app.goo.gl/EMWe4tmD6z9rHBqU7",

  maxPlayers: 32,
  teamsMinForFour: 24,
  minimumPlayersToPlay: 12,

  registrationEnabled: true,
  registrationOffTitle: "Registration is off this Friday",
  registrationOffText: "",

  announcementEnabled: false,
  announcementTone: "warn",
  announcementTitle: "",
  announcementText: ""
};

if (typeof window !== "undefined") window.SIGNUP_CONFIG = signupConfig;
if (typeof module !== "undefined") module.exports = signupConfig;
